// Arbeitsbereich eines geöffneten Vaults: Sidebar links, Seite rechts.
// Hier laufen alle Aktionen zusammen (anlegen, umbenennen, löschen) und die Meldungen des Dateiwächters.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WikiLinkContext, type WikiLinkActions } from "../editor/wikilink";
import { AutoSaver, errorMessage } from "../lib/autosave";
import { allPages, linkPageName, linkTargetFor, renamedTarget, resolveLink, rewriteLinks, type PageRef } from "../lib/links";
import { today } from "../lib/calendar";
import { createDatabaseConfig, VIEWS_FILE } from "../lib/database";
import { instantiateTemplate, TEMPLATES_DIR } from "../lib/search";
import { getFrontmatterField, splitFrontmatter } from "../markdown/frontmatter";
import { childrenOf, findNode, isInside, movePath, pageTitle, parentDir, sortTree, uniqueName } from "../lib/tree";
import { useSchemas } from "../lib/useSchemas";
import {
  confirmAction,
  createFolder,
  createPage,
  deleteEntry,
  listTree,
  onVaultChanged,
  readPage,
  renameEntry,
  vaultIndex,
  writePage,
  type TreeNode,
  type VaultInfo,
} from "../lib/vault-api";
import { Backlinks } from "./Backlinks";
import { DatabaseView, loadRows } from "./DatabaseView";
import { QuickSwitcher, SearchDialog, TemplatePicker } from "./Dialogs";
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
  /** Geöffnete Datenbank (Ordnerpfad); dann ist keine Seite offen. */
  const [database, setDatabase] = useState<string | null>(null);
  const [databaseVersion, setDatabaseVersion] = useState(0);
  /** Wird bei jeder Änderung im Vault erhöht (z. B. damit Backlinks neu berechnet werden). */
  const [vaultVersion, setVaultVersion] = useState(0);
  const [dialog, setDialog] = useState<{ kind: "quick" } | { kind: "search" } | { kind: "template"; dir: string } | null>(null);
  const saverRef = useRef<AutoSaver | null>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const databaseRef = useRef(database);
  databaseRef.current = database;

  const showError = useCallback((text: string) => setNotice({ kind: "error", text }), []);
  const schemas = useSchemas(tree, showError);
  const reloadConfigRef = useRef(schemas.reloadConfig);
  reloadConfigRef.current = schemas.reloadConfig;

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
      const db = databaseRef.current;
      if (db && !findNode(next, db)?.database) setDatabase(null);
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
      for (const path of [change.path, change.newPath]) {
        if (path?.endsWith(`/${VIEWS_FILE}`)) void reloadConfigRef.current(parentDir(path));
      }
      const db = databaseRef.current;
      if (db && [change.path, change.newPath].some((path) => path && isInside(path, db))) {
        setDatabaseVersion((version) => version + 1);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshTree();
        setVaultVersion((version) => version + 1);
      }, 150);
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

  // Tastenkürzel: Strg+P Schnellsuche, Strg+Umschalt+F Volltextsuche.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "p" && !event.shiftKey) {
        event.preventDefault(); // sonst öffnet sich der Druckdialog
        setDialog({ kind: "quick" });
      } else if (key === "f" && event.shiftKey) {
        event.preventDefault();
        setDialog({ kind: "search" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadIndex = useCallback(() => vaultIndex(), []);

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
    setDatabase(null);
  };

  const openDatabase = async (folder: string) => {
    await saverRef.current?.flush();
    pageRef.current = null;
    setPage(null);
    setDatabase(folder);
  };

  /** Macht einen Ordner zur Datenbank: legt _ansichten.yaml mit den erkannten Eigenschaften an. */
  const convertToDatabase = async (folder: string) => {
    try {
      const pages = (findNode(tree, folder)?.children ?? []).filter((node) => node.kind === "page").map((node) => node.path);
      const config = createDatabaseConfig(await loadRows(pages));
      await schemas.saveConfig(folder, config);
      await refreshTree();
      await openDatabase(folder);
      const count = Object.keys(config.eigenschaften).length;
      setNotice({ kind: "info", text: `„${pageTitle(folder)}“ ist jetzt eine Datenbank mit ${count} ${count === 1 ? "Eigenschaft" : "Eigenschaften"}.` });
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  /** Neue Seite in `dir` aus einer Vorlage: Eigenschaften und Inhalt der Vorlage, eigene id. */
  const createFromTemplate = async (dir: string, templatePath: string) => {
    try {
      const title = uniqueName(childrenOf(tree, dir), "Unbenannt");
      const path = await createPage(dir, title);
      const id = getFrontmatterField(splitFrontmatter(await readPage(path)).frontmatter, "id") ?? "";
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      await writePage(path, instantiateTemplate(await readPage(templatePath), { id, title, date: today(), time }));
      await refreshTree();
      await openPage(path, true);
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  const createDatabaseRow = async (folder: string): Promise<string | null> => {
    try {
      const title = uniqueName(childrenOf(tree, folder), "Unbenannt");
      const path = await createPage(folder, title);
      await refreshTree();
      return path;
    } catch (error) {
      showError(errorMessage(error));
      return null;
    }
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
      // Vorher speichern: Auch die offene Seite kann Links enthalten, die gleich angepasst werden.
      await saverRef.current?.flush();
      const oldPages = allPages(tree);
      const current = pageRef.current;
      const newPath = await renameEntry(node.path, newName);
      if (current && isInside(current.path, node.path)) setPagePath(movePath(current.path, node.path, newPath));
      const db = databaseRef.current;
      if (db && isInside(db, node.path)) setDatabase(movePath(db, node.path, newPath));

      const moved = new Map<string, string>();
      for (const page of oldPages) {
        if (isInside(page.path, node.path)) moved.set(page.path, movePath(page.path, node.path, newPath));
      }
      await refreshTree();
      const changed = await updateLinksAfterRename(oldPages, moved);
      if (changed > 0) {
        setNotice({ kind: "info", text: `Links in ${changed} ${changed === 1 ? "Seite" : "Seiten"} angepasst.` });
      }
      return true;
    } catch (error) {
      showError(errorMessage(error));
      return false;
    }
  };

  /** Schreibt in allen Seiten die Links auf umbenannte Seiten um. Liefert die Zahl geänderter Seiten. */
  const updateLinksAfterRename = async (oldPages: PageRef[], moved: Map<string, string>): Promise<number> => {
    if (moved.size === 0) return 0;
    let changed = 0;
    for (const page of oldPages) {
      const path = moved.get(page.path) ?? page.path;
      let text: string;
      try {
        text = await readPage(path);
      } catch {
        continue;
      }
      const updated = rewriteLinks(text, (name) => {
        const target = resolveLink(oldPages, name, page.path);
        const newTarget = target === null ? undefined : moved.get(target);
        if (newTarget === undefined) return null;
        const replacement = renamedTarget(name, newTarget);
        return replacement === name ? null : replacement;
      });
      if (updated !== text) {
        await writePage(path, updated);
        changed++;
      }
    }
    return changed;
  };

  // Für [[Links]] im Editor: auflösen, öffnen (fehlende Seiten anlegen) und Vorschläge.
  const pages = useMemo(() => allPages(tree), [tree]);
  const linkActions = useMemo<WikiLinkActions>(
    () => ({
      resolve: (target) => resolveLink(pages, target, pageRef.current?.path),
      open: (target) => {
        const path = resolveLink(pages, target, pageRef.current?.path);
        if (path) void openPage(path);
        else void createAndOpenLinkedPage(linkPageName(target));
      },
      suggest: (query) => {
        const q = query.trim().toLowerCase();
        return pages
          .filter((page) => page.title.toLowerCase().includes(q))
          .sort((a, b) => Number(!a.title.toLowerCase().startsWith(q)) - Number(!b.title.toLowerCase().startsWith(q)) || a.title.localeCompare(b.title, "de"))
          .slice(0, 12)
          .map((page) => ({ title: page.title, folder: parentDir(page.path), target: linkTargetFor(pages, page.path) }));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openPage nutzt nur Refs
    [pages],
  );

  const createAndOpenLinkedPage = async (name: string) => {
    try {
      const title = name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name;
      const path = await createPage("", title);
      await refreshTree();
      await openPage(path);
    } catch (error) {
      showError(errorMessage(error));
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
        openDatabase={database}
        onOpen={(path) => void openPage(path)}
        onOpenDatabase={(path) => void openDatabase(path)}
        onConvertToDatabase={(path) => void convertToDatabase(path)}
        onQuickOpen={() => setDialog({ kind: "quick" })}
        onSearch={() => setDialog({ kind: "search" })}
        onCreateFromTemplate={(dir) => setDialog({ kind: "template", dir })}
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
        {database && schemas.configs[database] ? (
          <DatabaseView
            key={database}
            folder={database}
            config={schemas.configs[database]}
            pagePaths={(findNode(tree, database)?.children ?? []).filter((node) => node.kind === "page").map((node) => node.path)}
            version={databaseVersion}
            onSaveConfig={(config) => void schemas.saveConfig(database, config)}
            onOpenPage={(path) => void openPage(path)}
            onCreateRow={() => createDatabaseRow(database)}
            onRenamePage={(path, title) => {
              const node = findNode(tree, path);
              return node ? rename(node, title) : Promise.resolve(false);
            }}
            beforeWrite={async () => {
              await saverRef.current?.flush();
            }}
            onError={showError}
          />
        ) : page ? (
          <WikiLinkContext.Provider value={linkActions}>
            <PageView
              key={page.key}
              path={page.path}
              isNew={page.isNew}
              externalVersion={externalVersion}
              saverRef={saverRef}
              onRename={renameOpenPage}
              onError={showError}
              propertySchema={schemas.schemaForPage(page.path)}
              onPropertyType={(name, type) => void schemas.setTypeForPage(page.path, name, type)}
            >
              <Backlinks path={page.path} pages={pages} loadIndex={loadIndex} version={vaultVersion} onOpen={(path) => void openPage(path)} />
            </PageView>
          </WikiLinkContext.Provider>
        ) : (
          <div className="empty-state">
            <p>Wähle links eine Seite aus oder lege eine neue an.</p>
          </div>
        )}
      </main>
      {dialog?.kind === "quick" && (
        <QuickSwitcher
          pages={pages}
          onClose={() => setDialog(null)}
          onOpen={(path) => {
            setDialog(null);
            void openPage(path);
          }}
        />
      )}
      {dialog?.kind === "search" && (
        <SearchDialog
          loadIndex={loadIndex}
          onClose={() => setDialog(null)}
          onOpen={(path) => {
            setDialog(null);
            void openPage(path);
          }}
        />
      )}
      {dialog?.kind === "template" && (
        <TemplatePicker
          templates={pages.filter((page) => isInside(page.path, TEMPLATES_DIR))}
          onClose={() => setDialog(null)}
          onPick={(templatePath) => {
            const dir = dialog.dir;
            setDialog(null);
            void createFromTemplate(dir, templatePath);
          }}
        />
      )}
    </div>
  );
}
