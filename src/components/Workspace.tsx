// Arbeitsbereich eines geöffneten Vaults: Sidebar links, rechts Startseite, Seite oder Datenbank.
// Hier laufen alle Aktionen zusammen (anlegen, umbenennen, löschen, anheften) und die Meldungen des Dateiwächters.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChevronRight, Menu as MenuIcon, Search, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WikiLinkContext, type WikiLinkActions } from "../editor/wikilink";
import { AutoSaver, errorMessage } from "../lib/autosave";
import { instantiateHtmlTemplate, isHtmlPath, pathMapper, readHead, rewriteReferences, setTitle } from "../lib/html";
import { allPages, linkPageName, linkTargetFor, renamedTarget, resolveLink, rewriteLinks, type PageRef } from "../lib/links";
import { today } from "../lib/calendar";
import { createDatabaseConfig, VIEWS_FILE, type DatabaseConfig } from "../lib/database";
import { readFavorites, removeFromFavorites, renameInFavorites, toggleFavorite, withFavorites } from "../lib/favorites";
import { pageIcons } from "../lib/home";
import { DEFAULT_STATUS_OPTIONS } from "../lib/properties";
import { instantiateTemplate, TEMPLATES_DIR, type IndexEntry } from "../lib/search";
import { useVaultSettings } from "../lib/settings";
import { getFrontmatterField, splitFrontmatter } from "../markdown/frontmatter";
import { childrenOf, findNode, isInside, movePath, pageTitle, parentDir, sortTree, uniqueName } from "../lib/tree";
import { useSchemas } from "../lib/useSchemas";
import type { EigenerBaustein } from "../lib/eigene-bausteine";
import { eigenstaendigesHtml } from "../lib/export";
import { LOCALIST_CSS, LOCALIST_JS } from "../lib/gebuendelt";
import { seiteAlsHtml } from "../lib/notiz-darstellung";
import { NOTIZBUCH_DATEI, notizbuchNeu, notizbuchReihenfolge, notizbuchUmbenennen } from "../lib/notizbuch";
import {
  confirmAction,
  createFolder,
  createPage,
  dateiBase64,
  deleteEntry,
  exportSchreiben,
  imExplorerZeigen,
  listEigeneBausteine,
  pickExportTarget,
  listTree,
  onVaultChanged,
  readPage,
  moveEntry,
  renameEntry,
  vaultIndex,
  writePage,
  type TreeNode,
  type VaultInfo,
} from "../lib/vault-api";
import { Backlinks } from "./Backlinks";
import { DatabaseView, loadRows } from "./DatabaseView";
import { MoveDialog, QuickSwitcher, SearchDialog, SettingsDialog, TemplatePicker } from "./Dialogs";
import { HomePage } from "./HomePage";
import { BausteinBibliothek } from "./BausteinBibliothek";
import { HtmlPageView } from "./HtmlPageView";
import { NotizbuchView } from "./NotizbuchView";
import { PageView } from "./PageView";
import { Sidebar, type CreateKind } from "./Sidebar";
import { Button, cx, IconButton } from "./ui";

interface Props {
  vault: VaultInfo;
  /** Betriebssystem ("windows", "android", …); auf dem Handy gibt es z. B. keinen Explorer. */
  platform: string;
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

export function Workspace({ vault, platform, onSwitchVault }: Props) {
  const explorer = platform !== "android" && platform !== "ios";
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [page, setPage] = useState<OpenPage | null>(null);
  const [externalVersion, setExternalVersion] = useState(0);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** Der Vault-Ordner ist verschwunden (z. B. USB-Stick abgezogen oder umbenannt). */
  const [vaultMissing, setVaultMissing] = useState(false);
  /** Geöffnete Datenbank (Ordnerpfad); dann ist keine Seite offen. */
  const [database, setDatabase] = useState<string | null>(null);
  /** Geöffnetes Notizbuch (Ordnerpfad) oder null. */
  const [notebook, setNotebook] = useState<string | null>(null);
  const notebookRef = useRef(notebook);
  notebookRef.current = notebook;
  /** Bereich „Bausteine“ (Bibliothek und Hilfe) ist offen. */
  const [library, setLibrary] = useState(false);
  /** Eigene Bausteine des Vaults („Code-Speicher“). */
  const [eigene, setEigene] = useState<EigenerBaustein[]>([]);
  const loadEigene = useCallback(() => {
    listEigeneBausteine().then(setEigene, () => setEigene([]));
  }, []);
  useEffect(loadEigene, [loadEigene]);
  const [databaseVersion, setDatabaseVersion] = useState(0);
  /** Wird bei jeder Änderung im Vault erhöht (z. B. damit Backlinks neu berechnet werden). */
  const [vaultVersion, setVaultVersion] = useState(0);
  /** Auf dem Handy ist die Sidebar ein ausklappbares Menü. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: "quick" }
    | { kind: "search"; query?: string }
    | { kind: "template"; dir: string }
    | { kind: "settings" }
    | { kind: "move"; node: TreeNode }
    | null
  >(null);
  /** Suchindex für Startseite und Icons in der Sidebar (wird bei Änderungen im Vault neu geladen). */
  const [index, setIndex] = useState<IndexEntry[]>([]);
  const saverRef = useRef<AutoSaver | null>(null);
  const pageRef = useRef(page);
  pageRef.current = page;
  const databaseRef = useRef(database);
  databaseRef.current = database;
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const showError = useCallback((text: string) => setNotice({ kind: "error", text }), []);
  const vaultSettings = useVaultSettings(showError);
  const schemas = useSchemas(tree, showError, vaultSettings);
  const favorites = readFavorites(vaultSettings.settings);
  const updateFavorites = (change: (favorites: string[]) => string[]) =>
    vaultSettings.update((settings) => withFavorites(settings, change(readFavorites(settings))));
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
      setVaultMissing(false);
      setTree(next);
      const current = pageRef.current;
      if (current && !findNode(next, current.path)) {
        closePage();
        setNotice({ kind: "info", text: `„${pageTitle(current.path)}“ wurde außerhalb der App gelöscht oder verschoben.` });
      }
      const db = databaseRef.current;
      if (db && !findNode(next, db)?.database) setDatabase(null);
      const nb = notebookRef.current;
      if (nb && !findNode(next, nb)?.notebook) setNotebook(null);
    } catch (error) {
      const message = errorMessage(error);
      if (/Vault-Ordner .* wurde nicht gefunden/.test(message)) setVaultMissing(true);
      else showError(message);
    }
  }, [showError]);

  // Unerwartete Fehler im Hintergrund als Meldung zeigen statt sie still zu verschlucken.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      const message = errorMessage(event.reason);
      if (/ResizeObserver/.test(message)) return;
      showError(`Unerwarteter Fehler: ${message}`);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
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

  // Nach dem Öffnen einer Seite oder Datenbank klappt das Menü auf dem Handy wieder zu.
  useEffect(() => setMenuOpen(false), [page?.path, database]);

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

  useEffect(() => {
    let cancelled = false;
    vaultIndex().then(
      (entries) => !cancelled && setIndex(entries),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [vaultVersion]);
  const icons = useMemo(() => pageIcons(index), [index]);

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
    setNotebook(null);
    setLibrary(false);
  };

  const openDatabase = async (folder: string) => {
    await saverRef.current?.flush();
    pageRef.current = null;
    setPage(null);
    setDatabase(folder);
    setNotebook(null);
    setLibrary(false);
    // Liegen in einem Ordner beide Dateien, gilt er als Datenbank.
    if (findNode(treeRef.current, folder)?.notebook) {
      setNotice({ kind: "info", text: `„${pageTitle(folder)}“ hat auch eine ${NOTIZBUCH_DATEI}. Ein Ordner ist entweder Datenbank oder Notizbuch – er wird als Datenbank angezeigt.` });
    }
  };

  const openNotebook = async (folder: string) => {
    await saverRef.current?.flush();
    closePage();
    setDatabase(null);
    setLibrary(false);
    setNotebook(folder);
    setMenuOpen(false);
  };

  const openHome = async () => {
    await saverRef.current?.flush();
    closePage();
    setDatabase(null);
    setNotebook(null);
    setLibrary(false);
    setMenuOpen(false);
  };

  const openLibrary = async () => {
    await saverRef.current?.flush();
    closePage();
    setDatabase(null);
    setNotebook(null);
    setLibrary(true);
    setMenuOpen(false);
  };

  /** Macht einen Ordner zur Datenbank: legt _ansichten.yaml mit den erkannten Eigenschaften an. */
  const convertToDatabase = async (folder: string) => {
    if (findNode(tree, folder)?.notebook) {
      showError(`„${pageTitle(folder)}“ ist ein Notizbuch und kann keine Datenbank werden.`);
      return;
    }
    try {
      const pages = (findNode(tree, folder)?.children ?? []).filter((node) => node.kind === "page" && !node.html).map((node) => node.path);
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

  /** Macht einen Ordner zum Notizbuch: legt _notizbuch.yaml mit den Seiten in der jetzigen Reihenfolge an. */
  const convertToNotebook = async (folder: string) => {
    const node = findNode(tree, folder);
    if (node?.database) {
      showError(`„${pageTitle(folder)}“ ist eine Datenbank und kann kein Notizbuch werden.`);
      return;
    }
    try {
      const dateien = (node?.children ?? []).filter((kind) => kind.kind === "page").map((kind) => kind.path.slice(folder.length + 1));
      await writePage(`${folder}/${NOTIZBUCH_DATEI}`, notizbuchNeu(pageTitle(folder), notizbuchReihenfolge({ titel: null, seiten: [] }, dateien)));
      await refreshTree();
      await openNotebook(folder);
      setNotice({ kind: "info", text: `„${pageTitle(folder)}“ ist jetzt ein Notizbuch.` });
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  /** Liegt eine Seite in einem Notizbuch, wandert ihr Eintrag in _notizbuch.yaml mit (verlässt sie den Ordner, fällt er weg). */
  const updateNotebookEntry = async (oldPath: string, newPath: string) => {
    const folder = parentDir(oldPath);
    if (!folder || !findNode(treeRef.current, folder)?.notebook) return;
    const file = `${folder}/${NOTIZBUCH_DATEI}`;
    try {
      const text = await readPage(file);
      const updated = notizbuchUmbenennen(text, oldPath.slice(folder.length + 1), parentDir(newPath) === folder ? newPath.slice(folder.length + 1) : null);
      if (updated !== text) await writePage(file, updated);
    } catch {
      // ohne lesbare _notizbuch.yaml gibt es nichts anzupassen
    }
  };

  /**
   * Notiz → HTML-Seite (nach Rückfrage): auf Basis des mdast, id/Icon/Cover und Eigenschaften werden übernommen.
   * Die Notiz kommt in den Papierkorb, Links im Vault und der Eintrag im Notizbuch zeigen danach auf die neue Seite.
   */
  const convertToHtml = async (node: TreeNode) => {
    if (node.kind !== "page" || node.html) return;
    const dir = parentDir(node.path);
    const htmlPath = node.path.replace(/\.md$/i, ".html");
    if (findNode(tree, htmlPath)) {
      showError(`Hier gibt es schon eine HTML-Seite „${node.name}“.`);
      return;
    }
    const inDatabase = findNode(tree, dir)?.database ?? false;
    const frage = inDatabase
      ? `„${node.name}“ in eine HTML-Seite umwandeln? Sie liegt in einer Datenbank und erscheint danach nicht mehr in Tabelle, Kanban und Kalender. Die Notiz kommt in den Papierkorb, Links im Vault werden angepasst.`
      : `„${node.name}“ in eine HTML-Seite umwandeln? Die Notiz kommt in den Papierkorb, Links im Vault werden angepasst.`;
    if (!(await confirmAction(frage, "In HTML-Seite umwandeln"))) return;
    try {
      await saverRef.current?.flush();
      const oldPages = allPages(tree);
      const html = await seiteAlsHtml(node.path, htmlPath, oldPages, crypto.randomUUID());
      await writePage(htmlPath, html);
      if (pageRef.current?.path === node.path) closePage();
      await deleteEntry(node.path);
      await updateFavorites((list) => renameInFavorites(list, node.path, htmlPath));
      await updateNotebookEntry(node.path, htmlPath);
      await refreshTree();
      const changed = await updateLinksAfterRelocate(oldPages, pathMapper(node.path, htmlPath));
      await openPage(htmlPath);
      const links = changed > 0 ? ` Links in ${changed} ${changed === 1 ? "Seite" : "Seiten"} angepasst.` : "";
      setNotice({ kind: "info", text: `„${node.name}“ ist jetzt eine HTML-Seite.${links}` });
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  /** Seite als eigenständige HTML-Datei exportieren: CSS, Skript und Bilder eingebettet, funktioniert ohne Vault. */
  const exportPage = async (node: TreeNode) => {
    if (node.kind !== "page") return;
    try {
      await saverRef.current?.flush();
      const ziel = await pickExportTarget(node.name);
      if (!ziel) return;
      const htmlPath = node.path.replace(/\.md$/i, ".html");
      const html = await seiteAlsHtml(node.path, htmlPath, allPages(tree));
      const datei = await eigenstaendigesHtml(html, htmlPath, { css: LOCALIST_CSS, js: LOCALIST_JS, laden: (pfad) => dateiBase64(pfad).catch(() => null) });
      await exportSchreiben(ziel, datei);
      setNotice({ kind: "info", text: `„${node.name}“ wurde als eigenständige HTML-Datei gespeichert: ${ziel}` });
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  /** „Im Explorer öffnen“ ("" = Vault). Vorher speichern, damit der Explorer den aktuellen Stand zeigt. */
  const revealInExplorer = async (path: string) => {
    try {
      await saverRef.current?.flush();
      const hinweis = await imExplorerZeigen(path);
      if (hinweis) setNotice({ kind: "info", text: hinweis });
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  /**
   * Neue Seite in `dir` aus einer Vorlage (Notiz oder HTML-Seite): Inhalt der Vorlage, eigene id, bei
   * HTML-Seiten Titel und relative Pfade für den Zielordner neu.
   */
  const createFromTemplate = async (dir: string, templatePath: string) => {
    try {
      const title = uniqueName(childrenOf(tree, dir), "Unbenannt");
      const html = isHtmlPath(templatePath);
      const path = await createPage(dir, title, html ? "html" : "notiz");
      const created = await readPage(path);
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const template = await readPage(templatePath);
      if (html) {
        const values = { id: readHead(created).id ?? "", title, date: today(), time };
        await writePage(path, instantiateHtmlTemplate(template, templatePath, path, values));
      } else {
        const id = getFrontmatterField(splitFrontmatter(created).frontmatter, "id") ?? "";
        await writePage(path, instantiateTemplate(template, { id, title, date: today(), time }));
      }
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

  const handleCreatePage = async (dir: string, kind: "notiz" | "html" = "notiz") => {
    try {
      const title = uniqueName(childrenOf(tree, dir), "Unbenannt");
      const path = await createPage(dir, title, kind);
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

  /** Neue Datenbank: Ordner mit _ansichten.yaml, Status und Datum, damit Kanban und Kalender gleich gehen. */
  const handleCreateDatabase = async (dir: string) => {
    try {
      const name = uniqueName(childrenOf(tree, dir), "Neue Datenbank");
      const path = await createFolder(dir, name);
      const config: DatabaseConfig = {
        ...createDatabaseConfig([]),
        eigenschaften: { status: { typ: "status", optionen: DEFAULT_STATUS_OPTIONS }, datum: { typ: "datum" } },
      };
      await schemas.saveConfig(path, config);
      await refreshTree();
      await openDatabase(path);
      setRenamingPath(path);
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  const handleCreate = (kind: CreateKind, dir: string) => {
    if (kind === "page") void handleCreatePage(dir);
    else if (kind === "html") void handleCreatePage(dir, "html");
    else if (kind === "folder") void handleCreateFolder(dir);
    else if (kind === "database") void handleCreateDatabase(dir);
    else setDialog({ kind: "template", dir });
  };

  /**
   * Umbenennen oder Verschieben (`action` liefert den neuen Pfad). Danach werden offene Seite, Favoriten,
   * bei HTML-Seiten der <title> und alle Links im Vault angepasst.
   */
  const relocate = async (node: TreeNode, action: () => Promise<string>, renamed: boolean): Promise<boolean> => {
    try {
      // Vorher speichern: Auch die offene Seite kann Links enthalten, die gleich angepasst werden.
      await saverRef.current?.flush();
      const oldPages = allPages(tree);
      const current = pageRef.current;
      const newPath = await action();
      if (newPath === node.path) return true;
      if (current && isInside(current.path, node.path)) setPagePath(movePath(current.path, node.path, newPath));
      const db = databaseRef.current;
      if (db && isInside(db, node.path)) setDatabase(movePath(db, node.path, newPath));
      const nb = notebookRef.current;
      if (nb && isInside(nb, node.path)) setNotebook(movePath(nb, node.path, newPath));
      await updateFavorites((list) => renameInFavorites(list, node.path, newPath));
      if (node.kind === "page") await updateNotebookEntry(node.path, newPath);
      if (renamed && node.kind === "page" && isHtmlPath(newPath)) {
        const text = await readPage(newPath);
        const updated = setTitle(text, pageTitle(newPath));
        if (updated !== text) await writePage(newPath, updated);
      }
      await refreshTree();
      const changed = await updateLinksAfterRelocate(oldPages, pathMapper(node.path, newPath));
      if (changed > 0) {
        setNotice({ kind: "info", text: `Links in ${changed} ${changed === 1 ? "Seite" : "Seiten"} angepasst.` });
      }
      return true;
    } catch (error) {
      showError(errorMessage(error));
      return false;
    }
  };

  const rename = (node: TreeNode, newName: string) => relocate(node, () => renameEntry(node.path, newName), true);
  const move = (node: TreeNode, targetDir: string) => relocate(node, () => moveEntry(node.path, targetDir), false);

  /**
   * Passt nach Umbenennen/Verschieben alle Seiten an: in Notizen die [[Links]], in HTML-Seiten die relativen
   * href- und src-Werte (Links, Bilder, Bausteine). Liefert die Zahl geänderter Seiten.
   */
  const updateLinksAfterRelocate = async (oldPages: PageRef[], mapPath: (path: string) => string): Promise<number> => {
    let changed = 0;
    for (const page of oldPages) {
      const path = mapPath(page.path);
      let text: string;
      try {
        text = await readPage(path);
      } catch {
        continue;
      }
      const updated = isHtmlPath(path)
        ? rewriteReferences(text, page.path, path, mapPath)
        : rewriteLinks(text, (name) => {
            const target = resolveLink(oldPages, name, page.path);
            if (target === null || mapPath(target) === target) return null;
            const replacement = renamedTarget(name, mapPath(target));
            return replacement === name ? null : replacement;
          });
      if (updated !== text) {
        await writePage(path, updated);
        changed++;
      }
    }
    return changed;
  };

  /** Ein Link in einer HTML-Seite: Seite oder Datenbank im Vault öffnen. Der Pfad ist schon geprüft (bridge.ts). */
  const openFromHtmlPage = (path: string) => {
    const node = findNode(treeRef.current, path);
    if (node?.kind === "page") void openPage(path);
    else if (node?.database) void openDatabase(path);
    else if (node?.notebook) void openNotebook(path);
    else showError(`„${path}“ wurde im Vault nicht gefunden.`);
  };

  const openExternal = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener");
    }
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
          .map((page) => ({ title: page.title, folder: parentDir(page.path), target: linkTargetFor(pages, page.path), html: isHtmlPath(page.path) }));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openPage nutzt nur Refs
    [pages],
  );

  const createAndOpenLinkedPage = async (name: string) => {
    try {
      const html = isHtmlPath(name);
      const title = pageTitle(name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name);
      const path = await createPage("", title, html ? "html" : "notiz");
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
      await updateFavorites((list) => removeFromFavorites(list, node.path));
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

  const current = page?.path ?? database ?? notebook;
  const homeActive = !page && !database && !notebook && !library && !vaultMissing;
  const favoriteNodes = favorites.map((path) => findNode(tree, path)).filter((node): node is TreeNode => node !== null);

  return (
    <div className="workspace">
      {menuOpen && <div className="drawer-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
      <div className={cx("sidebar-shell", menuOpen && "open")}>
        <Sidebar
          vaultName={vault.name}
          tree={tree}
          openPath={page?.path ?? null}
          openDatabase={database}
          openNotebook={notebook}
          homeActive={homeActive}
          favorites={favorites}
          icons={icons}
          renamingPath={renamingPath}
          onRenamingDone={() => setRenamingPath(null)}
          onOpen={(path) => void openPage(path)}
          onOpenDatabase={(path) => void openDatabase(path)}
          onOpenHome={() => void openHome()}
          libraryActive={library}
          onOpenLibrary={() => void openLibrary()}
          onConvertToDatabase={(path) => void convertToDatabase(path)}
          onOpenNotebook={(path) => void openNotebook(path)}
          onConvertToNotebook={(path) => void convertToNotebook(path)}
          onConvertToHtml={(node) => void convertToHtml(node)}
          onExport={(node) => void exportPage(node)}
          onRevealInExplorer={explorer ? (path) => void revealInExplorer(path) : undefined}
          onToggleFavorite={(path) => void updateFavorites((list) => toggleFavorite(list, path))}
          onQuickOpen={() => setDialog({ kind: "quick" })}
          onSearch={() => setDialog({ kind: "search" })}
          onOpenSettings={() => setDialog({ kind: "settings" })}
          onCreate={handleCreate}
          onRename={(node, newName) => void rename(node, newName)}
          onMove={(node, targetDir) => void move(node, targetDir)}
          onRequestMove={(node) => setDialog({ kind: "move", node })}
          onDelete={(node) => void handleDelete(node)}
          onSwitchVault={async () => {
            await saverRef.current?.flush();
            onSwitchVault();
          }}
        />
      </div>
      <main className="main">
        <header className="topbar">
          <IconButton className="topbar-menu" label="Menü öffnen" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </IconButton>
          <nav className="breadcrumb" aria-label="Pfad">
            {current ? (
              <>
                {ancestorNames(current).map((name, i) => (
                  <span key={i} className="breadcrumb-folder">
                    <span className="breadcrumb-name">{name}</span>
                    <ChevronRight className="breadcrumb-separator" aria-hidden="true" />
                  </span>
                ))}
                <span className="topbar-title">
                  {page && icons.get(page.path) && <span className="topbar-icon">{icons.get(page.path)}</span>}
                  {pageTitle(current)}
                </span>
              </>
            ) : (
              <span className="topbar-title">{vaultMissing ? vault.name : library ? "Bausteine" : "Startseite"}</span>
            )}
          </nav>
          <div className="topbar-actions">
            {current && (
              <IconButton
                label={favorites.includes(current) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
                active={favorites.includes(current)}
                className="favorite-toggle"
                onClick={() => void updateFavorites((list) => toggleFavorite(list, current))}
              >
                <Star />
              </IconButton>
            )}
            <IconButton className="topbar-search" label="Seite suchen" onClick={() => setDialog({ kind: "quick" })}>
              <Search />
            </IconButton>
          </div>
        </header>
        {notice && (
          <div className={`notice toast ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
            <span>{notice.text}</span>
            <IconButton size="sm" label="Meldung schließen" onClick={() => setNotice(null)}>
              <X />
            </IconButton>
          </div>
        )}
        {vaultMissing ? (
          <div className="empty-state">
            <div className="vault-missing" role="alert">
              <h2>Der Vault-Ordner ist nicht erreichbar</h2>
              <p>
                „{vault.root}“ wurde nicht gefunden. Vielleicht wurde er verschoben, umbenannt oder das Laufwerk ist nicht
                angeschlossen. Sobald er wieder da ist, lädt die App ihn automatisch.
              </p>
              <Button variant="primary" onClick={onSwitchVault}>
                Anderen Vault öffnen …
              </Button>
            </div>
          </div>
        ) : library ? (
          <BausteinBibliothek eigene={eigene} onEigeneChanged={loadEigene} onError={showError} />
        ) : notebook ? (
          <NotizbuchView
            folder={notebook}
            node={findNode(tree, notebook)}
            pages={pages}
            version={vaultVersion}
            onEdit={(path) => void openPage(path)}
            onOpenLink={openFromHtmlPage}
            onOpenExternal={(url) => void openExternal(url)}
            onError={showError}
          />
        ) : database && schemas.configs[database] ? (
          <DatabaseView
            key={database}
            folder={database}
            config={schemas.configs[database]}
            pagePaths={(findNode(tree, database)?.children ?? []).filter((node) => node.kind === "page" && !node.html).map((node) => node.path)}
            icons={icons}
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
          isHtmlPath(page.path) ? (
            <HtmlPageView
              key={page.key}
              path={page.path}
              isNew={page.isNew}
              externalVersion={externalVersion}
              saverRef={saverRef}
              onRename={renameOpenPage}
              onError={showError}
              onOpenLink={openFromHtmlPage}
              onOpenExternal={(url) => void openExternal(url)}
              pages={pages}
              eigene={eigene}
              onEigeneChanged={loadEigene}
            >
              <Backlinks path={page.path} pages={pages} loadIndex={loadIndex} version={vaultVersion} icons={icons} onOpen={(path) => void openPage(path)} />
            </HtmlPageView>
          ) : (
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
              <Backlinks path={page.path} pages={pages} loadIndex={loadIndex} version={vaultVersion} icons={icons} onOpen={(path) => void openPage(path)} />
            </PageView>
          </WikiLinkContext.Provider>
          )
        ) : database ? null : (
          <HomePage
            vaultName={vault.name}
            pages={pages}
            index={index}
            favorites={favoriteNodes}
            icons={icons}
            onOpen={(node) => void (node.kind === "folder" ? openDatabase(node.path) : openPage(node.path))}
            onCreateNote={() => void handleCreatePage("")}
            onCreateDatabase={() => void handleCreateDatabase("")}
            onCreateFromTemplate={() => setDialog({ kind: "template", dir: "" })}
            onSearch={(query) => setDialog({ kind: "search", query })}
          />
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
          initialQuery={dialog.query}
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
      {dialog?.kind === "move" && (
        <MoveDialog
          node={dialog.node}
          tree={tree}
          onClose={() => setDialog(null)}
          onPick={(targetDir) => {
            const node = dialog.node;
            setDialog(null);
            void move(node, targetDir);
          }}
        />
      )}
      {dialog?.kind === "settings" && (
        <SettingsDialog
          vaultName={vault.name}
          vaultRoot={vault.root}
          onClose={() => setDialog(null)}
          onSwitchVault={async () => {
            setDialog(null);
            await saverRef.current?.flush();
            onSwitchVault();
          }}
        />
      )}
    </div>
  );
}

/** Ordnernamen auf dem Weg zu einer Seite, z. B. "Notizen/Ideen.md" → ["Notizen"]. */
function ancestorNames(path: string): string[] {
  return path.split("/").slice(0, -1);
}
