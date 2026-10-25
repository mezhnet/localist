// Arbeitsbereich eines geöffneten Vaults: Sidebar links, Seite rechts.
// Hier laufen alle Aktionen zusammen (anlegen, umbenennen, löschen) und die Meldungen des Dateiwächters.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { AutoSaver, errorMessage } from "../lib/autosave";
import { childrenOf, findNode, isInside, movePath, pageTitle, sortTree, uniqueName } from "../lib/tree";
import {
  confirmAction,
  createFolder,
  createPage,
  deleteEntry,
  listTree,
  onVaultChanged,
  renameEntry,
  type TreeNode,
  type VaultInfo,
} from "../lib/vault-api";
import { PageView } from "./PageView";
import { Sidebar } from "./Sidebar";

interface Props {
  vault: VaultInfo;
  onSwitchVault: () => void;
}

/** Die geöffnete Seite. `key` bleibt beim Umbenennen gleich, damit der Editor offen bleibt. */
interface OpenPage {
  key: number;
  path: string;
  isNew: boolean;
}

interface Notice {
  kind: "error" | "info";
  text: string;
}

let nextPageKey = 1;

export function Workspace({ vault, onSwitchVault }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [page, setPage] = useState<OpenPage | null>(null);
  const [externalVersion, setExternalVersion] = useState(0);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const saverRef = useRef<AutoSaver | null>(null);
  const pageRef = useRef(page);
  pageRef.current = page;

  const showError = useCallback((text: string) => setNotice({ kind: "error", text }), []);

  // Hinweise verschwinden nach einigen Sekunden von selbst, Fehler bleiben bis zum Schließen stehen.
  useEffect(() => {
    if (notice?.kind !== "info") return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const setPagePath = (path: string) => {
    if (!pageRef.current) return;
    pageRef.current = { ...pageRef.current, path };
    setPage(pageRef.current);
  };

  const closePage = () => {
    saverRef.current?.cancel();
    pageRef.current = null;
    setPage(null);
  };

  const refreshTree = useCallback(async () => {
    try {
      const next = sortTree(await listTree());
      setTree(next);
      const current = pageRef.current;
      if (current && !findNode(next, current.path)) {
        closePage();
        setNotice({ kind: "info", text: `„${pageTitle(current.path)}“ wurde außerhalb der App gelöscht oder verschoben.` });
      }
    } catch (error) {
      showError(errorMessage(error));
    }
  }, [showError]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  // Dateiwächter: Baum neu laden, offene Seite nachziehen.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    onVaultChanged((change) => {
      const current = pageRef.current;
      if (current && change.kind === "renamed" && change.path && change.newPath && isInside(current.path, change.path)) {
        setPagePath(movePath(current.path, change.path, change.newPath));
      }
      const openPath = pageRef.current?.path;
      const touchesOpenPage = openPath !== undefined && (change.path === openPath || change.newPath === openPath);
      if ((touchesOpenPage && change.kind !== "removed") || change.kind === "rescan") {
        setExternalVersion((version) => version + 1);
      }
      clearTimeout(timer);
      timer = setTimeout(() => void refreshTree(), 150);
    }).then(
      (stop) => (disposed ? stop() : (unlisten = stop)),
      (error) => showError(`Der Dateiwächter ist nicht verfügbar: ${errorMessage(error)}`),
    );
    return () => {
      disposed = true;
      unlisten?.();
      clearTimeout(timer);
    };
  }, [refreshTree, showError]);

  // Vor dem Schließen des Fensters ungespeicherte Eingaben sichern.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      getCurrentWindow()
        .onCloseRequested(async () => {
          await saverRef.current?.flush();
        })
        .then((stop) => (unlisten = stop))
        .catch(() => {});
    } catch {
      // Außerhalb von Tauri (Tests, Browser) gibt es kein Fenster-Objekt.
    }
    return () => unlisten?.();
  }, []);

  const openPage = async (path: string, isNew = false) => {
    if (pageRef.current?.path === path) return;
    await saverRef.current?.flush();
    pageRef.current = { key: nextPageKey++, path, isNew };
    setPage(pageRef.current);
  };

  const handleCreatePage = async (dir: string) => {
    try {
      const title = uniqueName(childrenOf(tree, dir), "Unbenannt");
      const path = await createPage(dir, title);
      await refreshTree();
      await openPage(path, true);
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  const handleCreateFolder = async (dir: string) => {
    try {
      const name = uniqueName(childrenOf(tree, dir), "Neuer Ordner");
      const path = await createFolder(dir, name);
      await refreshTree();
      setRenamingPath(path);
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  const rename = async (node: TreeNode, newName: string): Promise<boolean> => {
    try {
      const current = pageRef.current;
      const affectsOpenPage = current !== null && isInside(current.path, node.path);
      if (affectsOpenPage) await saverRef.current?.flush();
      const newPath = await renameEntry(node.path, newName);
      if (affectsOpenPage && current) setPagePath(movePath(current.path, node.path, newPath));
      await refreshTree();
      return true;
    } catch (error) {
      showError(errorMessage(error));
      return false;
    }
  };

  const handleDelete = async (node: TreeNode) => {
    const what =
      node.kind === "folder"
        ? `Den Ordner „${node.name}“ mit allen Seiten darin löschen?`
        : `Die Seite „${node.name}“ löschen?`;
    const confirmed = await confirmAction(`${what}\n\nEr wird in den Papierkorb verschoben.`, "Löschen bestätigen");
    if (!confirmed) return;
    try {
      const current = pageRef.current;
      if (current && isInside(current.path, node.path)) closePage();
      await deleteEntry(node.path);
      await refreshTree();
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  const renameOpenPage = (newTitle: string) => {
    const current = pageRef.current;
    const node = current && findNode(tree, current.path);
    return node ? rename(node, newTitle) : Promise.resolve(false);
  };

  return (
    <div className="workspace">
      <Sidebar
        vaultName={vault.name}
        tree={tree}
        openPath={page?.path ?? null}
        renamingPath={renamingPath}
        onRenamingDone={() => setRenamingPath(null)}
        onOpen={(path) => void openPage(path)}
        onCreatePage={(dir) => void handleCreatePage(dir)}
        onCreateFolder={(dir) => void handleCreateFolder(dir)}
        onRename={(node, newName) => void rename(node, newName)}
        onDelete={(node) => void handleDelete(node)}
        onSwitchVault={async () => {
          await saverRef.current?.flush();
          onSwitchVault();
        }}
      />
      <main className="main">
        {notice && (
          <div className={`notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Meldung schließen" onClick={() => setNotice(null)}>
              ×
            </button>
          </div>
        )}
        {page ? (
          <PageView
            key={page.key}
            path={page.path}
            isNew={page.isNew}
            externalVersion={externalVersion}
            saverRef={saverRef}
            onRename={renameOpenPage}
            onError={showError}
          />
        ) : (
          <div className="empty-state">
            <p>Wähle links eine Seite aus oder lege eine neue an.</p>
          </div>
        )}
      </main>
    </div>
  );
}
