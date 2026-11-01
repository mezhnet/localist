// Arbeitsbereich eines geöffneten Vaults: Sidebar links, rechts Reiter mit Startseite, Seite, Datenbank, Notizbuch
// oder Bausteinen. Hier laufen alle Aktionen zusammen (anlegen, umbenennen, löschen, anheften) und die Meldungen des
// Dateiwächters. Die Reiter-Logik steht in src/lib/reiter.ts; angezeigt wird immer nur der aktive Reiter.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { WikiLinkContext, type WikiLinkActions } from "../editor/wikilink";
import { AutoSaver, errorMessage, speicherZustandZuruecksetzen } from "../lib/autosave";
import { instantiateHtmlTemplate, isHtmlPath, pathMapper, readHead, rewriteReferences, setTitle } from "../lib/html";
import { allPages, linkPageName, linkTargetFor, renamedTarget, resolveLink, rewriteLinks, type PageRef } from "../lib/links";
import { today } from "../lib/calendar";
import { createDatabaseConfig, VIEWS_FILE, type DatabaseConfig } from "../lib/database";
import { readFavorites, removeFromFavorites, renameInFavorites, toggleFavorite, withFavorites } from "../lib/favorites";
import { pageIcons, schnellNotiz } from "../lib/home";
import { DEFAULT_STATUS_OPTIONS } from "../lib/properties";
import { instantiateTemplate, TEMPLATES_DIR, type IndexEntry } from "../lib/search";
import {
  aktiverReiter,
  aktivieren,
  entfernen,
  istFest,
  neuerStartReiter,
  oeffnen,
  pfadeFolgen,
  reiterLaden,
  reiterMerken,
  schliessen,
  START_REITER,
  verlassen,
  wechseln,
  type ReiterInhalt,
  type ReiterScroll,
  type ReiterStand,
} from "../lib/reiter";
import { ScrollGedaechtnisContext, scrollWiederherstellen, type ScrollGedaechtnis } from "../lib/scroll-gedaechtnis";
import { storedEingeklappt, storeEingeklappt, useEingeklappt, useSeitenleisteSeite } from "../lib/seitenleiste";
import { useVaultSettings } from "../lib/settings";
import { getFrontmatterField, splitFrontmatter } from "../markdown/frontmatter";
import { childrenOf, findNode, isInside, namensKonflikt, pageTitle, parentDir, sortTree, uniqueName } from "../lib/tree";
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
import { Navigationsleiste, type NavZiel } from "./Navigationsleiste";
import { BausteinBibliothek } from "./BausteinBibliothek";
import { HtmlPageView } from "./HtmlPageView";
import { NotizbuchView } from "./NotizbuchView";
import { PageView } from "./PageView";
import { Fensterleiste, hatFensterrahmen } from "./Fenster";
import { Reiterleiste, useSchmal } from "./Reiterleiste";
import { SeitenKopf } from "./SeitenKopf";
import { Sidebar, type CreateKind } from "./Sidebar";
import { Button, cx, IconButton } from "./ui";

interface Props {
  vault: VaultInfo;
  /** Betriebssystem ("windows", "android", …); auf dem Handy gibt es z. B. keinen Explorer. */
  platform: string;
  onSwitchVault: () => void;
}

interface Notice {
  kind: "error" | "info";
  text: string;
  /** Knopf in der Meldung, z. B. „Rückgängig“ nach dem Verschieben. */
  aktion?: { label: string; onClick: () => void };
}

/** „Links in 2 Seiten angepasst.“ (leer, wenn keine Seite geändert wurde). */
const linksText = (changed: number) => (changed > 0 ? `Links in ${changed} ${changed === 1 ? "Seite" : "Seiten"} angepasst.` : "");

export function Workspace({ vault, platform, onSwitchVault }: Props) {
  const explorer = platform !== "android" && platform !== "ios";
  const [tree, setTree] = useState<TreeNode[]>([]);
  /** Ordnerbaum einmal geladen (vorher werden gemerkte Reiter noch nicht angezeigt, sie könnten fehlen). */
  const [baumGeladen, setBaumGeladen] = useState(false);
  const baumGeladenRef = useRef(false);
  /** Offene Reiter (pro Vault gemerkt) und der aktive Reiter; er bestimmt, was rechts angezeigt wird. */
  const [stand, setStandState] = useState<ReiterStand>(() => reiterLaden(vault.root));
  const standRef = useRef(stand);
  const setStand = (next: ReiterStand) => {
    standRef.current = next;
    setStandState(next);
  };
  const aktiv = aktiverReiter(stand);
  /** Die Seite im aktiven Reiter. `key` bleibt beim Umbenennen gleich, damit der Editor offen bleibt. */
  const page = aktiv.inhalt.art === "seite" ? { key: aktiv.ansicht, path: aktiv.inhalt.pfad, isNew: aktiv.neu === true } : null;
  /** Geöffnete Datenbank bzw. geöffnetes Notizbuch (Ordnerpfad) im aktiven Reiter. */
  const database = aktiv.inhalt.art === "datenbank" ? aktiv.inhalt.pfad : null;
  const notebook = aktiv.inhalt.art === "notizbuch" ? aktiv.inhalt.pfad : null;
  /** Bereich „Bausteine“ (Bibliothek und Hilfe) ist offen. */
  const library = aktiv.inhalt.art === "bausteine";
  const [externalVersion, setExternalVersion] = useState(0);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** Der Vault-Ordner ist verschwunden (z. B. USB-Stick abgezogen oder umbenannt). */
  const [vaultMissing, setVaultMissing] = useState(false);
  /** Eigene Bausteine des Vaults („Code-Speicher“). */
  const [eigene, setEigene] = useState<EigenerBaustein[]>([]);
  const loadEigene = useCallback(() => {
    listEigeneBausteine().then(setEigene, () => setEigene([]));
  }, []);
  useEffect(loadEigene, [loadEigene]);
  const [databaseVersion, setDatabaseVersion] = useState(0);
  /** Wird bei jeder Änderung im Vault erhöht (z. B. damit Backlinks neu berechnet werden). */
  const [vaultVersion, setVaultVersion] = useState(0);
  /** Auf dem Handy zeigt „Seiten“ in der Navigationsleiste die Sidebar (Ordnerbaum mit Favoriten) über dem Inhalt. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Seitenleiste links oder rechts (Einstellungen → Darstellung) und eingeklappt (nur auf dem PC). */
  const [seitenleisteSeite] = useSeitenleisteSeite();
  const fensterrahmen = hatFensterrahmen(platform);
  const fensterrahmenRef = useRef(fensterrahmen);
  fensterrahmenRef.current = fensterrahmen;
  const [eingeklapptGemerkt] = useEingeklappt();
  const eingeklappt = fensterrahmen && eingeklapptGemerkt;
  /** Auf dem Handy und in schmalen Fenstern gibt es keine Reiterleiste, dafür die untere Navigationsleiste. */
  const schmal = useSchmal();
  const ohneLeiste = !fensterrahmen || schmal;
  const ohneLeisteRef = useRef(ohneLeiste);
  ohneLeisteRef.current = ohneLeiste;
  const seitenleisteKnopf = useRef<HTMLButtonElement>(null);
  /** Ein- oder ausklappen; liegt der Fokus in der Seitenleiste, wandert er auf den Knopf (sonst ginge er verloren). */
  const seitenleisteUmschalten = useCallback(() => {
    if (!fensterrahmenRef.current) return;
    const zu = !storedEingeklappt();
    if (zu && document.getElementById("seitenleiste")?.contains(document.activeElement)) seitenleisteKnopf.current?.focus();
    storeEingeklappt(zu);
  }, []);
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

  /** Pfad der Seite bzw. Datenbank im aktiven Reiter (oder undefined). */
  const offeneSeite = () => {
    const inhalt = aktiverReiter(standRef.current).inhalt;
    return inhalt.art === "seite" ? inhalt.pfad : undefined;
  };
  const offeneDatenbank = () => {
    const inhalt = aktiverReiter(standRef.current).inhalt;
    return inhalt.art === "datenbank" ? inhalt.pfad : undefined;
  };

  const refreshTree = useCallback(async () => {
    try {
      const next = sortTree(await listTree());
      setVaultMissing(false);
      setTree(next);
      // Reiter, deren Seite, Datenbank oder Notizbuch es nicht mehr gibt, schließen.
      const weg = (inhalt: ReiterInhalt) =>
        inhalt.art === "seite"
          ? !findNode(next, inhalt.pfad)
          : inhalt.art === "datenbank"
            ? !findNode(next, inhalt.pfad)?.database
            : inhalt.art === "notizbuch" && !findNode(next, inhalt.pfad)?.notebook;
      const alt = standRef.current;
      const neu = entfernen(alt, weg);
      if (neu !== alt) {
        const war = aktiverReiter(alt);
        const aktivWeg = !istFest(war) && weg(war.inhalt);
        if (aktivWeg) saverRef.current?.cancel();
        standRef.current = neu;
        setStandState(neu);
        // Gemerkte Reiter aus einer früheren Sitzung verschwinden still.
        if (aktivWeg && war.inhalt.art === "seite" && baumGeladenRef.current) {
          setNotice({ kind: "info", text: `„${pageTitle(war.inhalt.pfad)}“ wurde außerhalb der App gelöscht oder verschoben.` });
        }
      }
      baumGeladenRef.current = true;
      setBaumGeladen(true);
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
      if (change.kind === "renamed" && change.path && change.newPath) {
        const neu = pfadeFolgen(standRef.current, change.path, change.newPath);
        standRef.current = neu;
        setStandState(neu);
      }
      const openPath = offeneSeite();
      const touchesOpenPage = openPath !== undefined && (change.path === openPath || change.newPath === openPath);
      if ((touchesOpenPage && change.kind !== "removed") || change.kind === "rescan") {
        setExternalVersion((version) => version + 1);
      }
      for (const path of [change.path, change.newPath]) {
        if (path?.endsWith(`/${VIEWS_FILE}`)) void reloadConfigRef.current(parentDir(path));
      }
      const db = offeneDatenbank();
      if (db && [change.path, change.newPath].some((path) => path && isInside(path, db))) {
        setDatabaseVersion((version) => version + 1);
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refreshTree();
        setVaultVersion((version) => version + 1);
      }, 150);
    }).then(
      (stop) => {
        if (!disposed) unlisten = stop;
        // Schon abgebaut (z. B. in Tests nach dem Entfernen der Tauri-Attrappe): Das Abmelden darf dann scheitern.
        else void Promise.resolve().then(stop).catch(() => {});
      },
      (error) => showError(`Der Dateiwächter ist nicht verfügbar: ${errorMessage(error)}`),
    );
    return () => {
      disposed = true;
      unlisten?.();
      clearTimeout(timer);
    };
  }, [refreshTree, showError]);

  // Nach dem Öffnen einer Seite oder Datenbank klappt das Menü auf dem Handy wieder zu.
  useEffect(() => setMenuOpen(false), [page?.path, database, aktiv.ansicht]);

  // Neue Ansicht: Der Speicherstatus im Seitenkopf gilt ab jetzt für sie.
  useEffect(() => speicherZustandZuruecksetzen(), [aktiv.ansicht]);

  // Offene Reiter pro Vault im App-Speicher merken.
  useEffect(() => reiterMerken(vault.root, stand), [stand, vault.root]);

  // Scrollposition je Reiter: Inhaltsfläche hier, Code-Editor und Vorschau melden sich über den Kontext.
  const mainScroll = useRef<HTMLDivElement>(null);
  const laufendScroll = useRef<Omit<ReiterScroll, "haupt">>({});
  const aktivRef = useRef(aktiv);
  aktivRef.current = aktiv;
  const gedaechtnis = useMemo<ScrollGedaechtnis>(
    () => ({ anfang: aktivRef.current.scroll, merken: (teil) => Object.assign(laufendScroll.current, teil) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur, wenn eine andere Ansicht erscheint
    [aktiv.ansicht],
  );
  useLayoutEffect(() => {
    laufendScroll.current = {};
    const element = mainScroll.current;
    if (!element) return;
    element.scrollTop = 0;
    return scrollWiederherstellen(element, aktivRef.current.scroll?.haupt ?? 0);
  }, [aktiv.ansicht, baumGeladen]);

  /** Handy: zuletzt gezeigte Inhalte für den Zurück-Pfeil im Kopf (ohne Reiterleiste gibt es nur einen Reiter). */
  const verlaufRef = useRef<ReiterInhalt[]>([]);
  const zurueckRef = useRef(false);

  /**
   * Wechselt Reiter oder Inhalt: Vorher ist gespeichert, und der verlassene Reiter merkt sich seine Scrollposition
   * (wenn er offen bleibt und dasselbe zeigt). Alle Wege zum Öffnen, Schließen und Wechseln laufen hierüber.
   */
  const wechsel = async (aendern: (stand: ReiterStand) => ReiterStand) => {
    await saverRef.current?.flush();
    const alt = standRef.current;
    let neu = aendern(alt);
    if (neu === alt) return;
    const war = aktiverReiter(alt);
    const wird = aktiverReiter(neu);
    if (ohneLeisteRef.current && !zurueckRef.current && inhaltSchluessel(war.inhalt) !== inhaltSchluessel(wird.inhalt)) {
      verlaufRef.current = [...verlaufRef.current, war.inhalt].slice(-VERLAUF_MAX);
    }
    if (wird.id !== war.id || wird.ansicht !== war.ansicht) {
      const bleibt = neu.reiter.find((reiter) => reiter.id === war.id);
      if (bleibt && bleibt.ansicht === war.ansicht) neu = verlassen(neu, war.id, { ...laufendScroll.current, haupt: mainScroll.current?.scrollTop ?? 0 });
    }
    setStand(neu);
    setMenuOpen(false);
  };
  const wechselRef = useRef(wechsel);
  wechselRef.current = wechsel;

  // Tastenkürzel: Strg+P Schnellsuche, Strg+Umschalt+F Volltextsuche, Strg+. Seitenleiste ein-/ausklappen (auf
  // deutscher Tastatur ohne AltGr; weder BlockNote noch CodeMirror belegen es). Reiter (nur mit Reiterleiste):
  // Strg+T neuer Reiter, Strg+W schließen, Strg+Tab und Strg+Umschalt+Tab wechseln.
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
      } else if (key === "." && !event.shiftKey) {
        event.preventDefault();
        seitenleisteUmschalten();
      } else if (ohneLeisteRef.current) {
        return;
      } else if (key === "t" && !event.shiftKey) {
        event.preventDefault();
        void wechselRef.current(neuerStartReiter);
      } else if (key === "w" && !event.shiftKey) {
        event.preventDefault();
        void wechselRef.current((stand) => schliessen(stand, stand.aktiv));
      } else if (key === "tab") {
        event.preventDefault();
        const richtung = event.shiftKey ? -1 : 1;
        void wechselRef.current((stand) => wechseln(stand, richtung));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seitenleisteUmschalten]);

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

  /** Öffnen im aktuellen Reiter; `neu` (Strg+Klick, Mittelklick): in einem neuen Reiter. */
  const oeffnenIn = (inhalt: ReiterInhalt, neu = false, isNew = false) =>
    wechsel((stand) => oeffnen(stand, inhalt, { neuerReiter: neu, ohneLeiste: ohneLeisteRef.current, neu: isNew }));

  const openPage = (path: string, isNew = false, neu = false) => oeffnenIn({ art: "seite", pfad: path }, neu, isNew);

  const openDatabase = async (folder: string, neu = false) => {
    await oeffnenIn({ art: "datenbank", pfad: folder }, neu);
    // Liegen in einem Ordner beide Dateien, gilt er als Datenbank.
    if (findNode(treeRef.current, folder)?.notebook) {
      setNotice({ kind: "info", text: `„${pageTitle(folder)}“ hat auch eine ${NOTIZBUCH_DATEI}. Ein Ordner ist entweder Datenbank oder Notizbuch – er wird als Datenbank angezeigt.` });
    }
  };

  const openNotebook = (folder: string, neu = false) => oeffnenIn({ art: "notizbuch", pfad: folder }, neu);

  /** „Startseite“ in der Seitenleiste: zum festen Reiter „Startseite“. */
  const openHome = () => wechsel((stand) => aktivieren(stand, START_REITER));

  /** Zurück-Pfeil (Handy): zum zuletzt gezeigten Inhalt, den es noch gibt, sonst zur Startseite. */
  const zurueck = async () => {
    let ziel: ReiterInhalt | undefined;
    while ((ziel = verlaufRef.current.pop())) {
      const node = "pfad" in ziel ? findNode(treeRef.current, ziel.pfad) : null;
      const gibtEs = ziel.art === "seite" ? !!node : ziel.art === "datenbank" ? !!node?.database : ziel.art === "notizbuch" ? !!node?.notebook : true;
      if (gibtEs && inhaltSchluessel(ziel) !== inhaltSchluessel(aktiverReiter(standRef.current).inhalt)) break;
    }
    zurueckRef.current = true;
    try {
      await wechsel((stand) => (!ziel || ziel.art === "start" ? aktivieren(stand, START_REITER) : oeffnen(stand, ziel, { ohneLeiste: true })));
    } finally {
      zurueckRef.current = false;
    }
  };

  const openLibrary = (neu = false) => oeffnenIn({ art: "bausteine" }, neu);

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
      // Reiter mit der Notiz zeigen danach die HTML-Seite (vorher nichts mehr in die Notiz speichern).
      if (offeneSeite() === node.path) saverRef.current?.cancel();
      setStand(pfadeFolgen(standRef.current, node.path, htmlPath));
      await deleteEntry(node.path);
      await updateFavorites((list) => renameInFavorites(list, node.path, htmlPath));
      await updateNotebookEntry(node.path, htmlPath);
      await refreshTree();
      const changed = await updateLinksAfterRelocate(oldPages, pathMapper(node.path, htmlPath));
      // Die neue Seite zeigen: im Reiter, der die Notiz zeigte, sonst wie ein Klick.
      await wechsel((stand) => {
        const vorhanden = stand.reiter.find((reiter) => reiter.inhalt.art === "seite" && reiter.inhalt.pfad === htmlPath);
        return vorhanden ? aktivieren(stand, vorhanden.id) : oeffnen(stand, { art: "seite", pfad: htmlPath }, { ohneLeiste: ohneLeisteRef.current });
      });
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

  /**
   * „Schnell notieren“ auf der Startseite: neue Notiz in der Vault-Wurzel, erste Zeile = Titel (eindeutig, ohne
   * ungültige Zeichen), der Rest = Inhalt. Die Notiz wird nicht geöffnet, man kann gleich die nächste schreiben.
   */
  const schnellNotieren = async (text: string): Promise<boolean> => {
    const notiz = schnellNotiz(text);
    if (!notiz) return false;
    try {
      const title = uniqueName(childrenOf(treeRef.current, ""), notiz.titel);
      const path = await createPage("", title, "notiz");
      if (notiz.inhalt) {
        const angelegt = await readPage(path);
        await writePage(path, `${angelegt}${angelegt.endsWith("\n") ? "" : "\n"}${notiz.inhalt}\n`);
      }
      await refreshTree();
      setVaultVersion((version) => version + 1);
      setNotice({ kind: "info", text: `Notiz „${title}“ gespeichert.` });
      return true;
    } catch (error) {
      showError(errorMessage(error));
      return false;
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
   * bei HTML-Seiten der <title> und alle Links im Vault angepasst. `meldung` ersetzt den Hinweis zu den Links.
   */
  const relocate = async (
    node: TreeNode,
    action: () => Promise<string>,
    renamed: boolean,
    meldung?: (newPath: string, changed: number) => Notice,
  ): Promise<boolean> => {
    try {
      // Vorher speichern: Auch die offene Seite kann Links enthalten, die gleich angepasst werden.
      await saverRef.current?.flush();
      const oldPages = allPages(tree);
      const newPath = await action();
      if (newPath === node.path) return true;
      // Alle Reiter folgen (Seiten, Datenbanken und Notizbücher in einem umbenannten Ordner auch).
      setStand(pfadeFolgen(standRef.current, node.path, newPath));
      await updateFavorites((list) => renameInFavorites(list, node.path, newPath));
      if (node.kind === "page") await updateNotebookEntry(node.path, newPath);
      if (renamed && node.kind === "page" && isHtmlPath(newPath)) {
        const text = await readPage(newPath);
        const updated = setTitle(text, pageTitle(newPath));
        if (updated !== text) await writePage(newPath, updated);
      }
      await refreshTree();
      const changed = await updateLinksAfterRelocate(oldPages, pathMapper(node.path, newPath));
      if (meldung) setNotice(meldung(newPath, changed));
      else if (changed > 0) setNotice({ kind: "info", text: linksText(changed) });
      return true;
    } catch (error) {
      showError(errorMessage(error));
      return false;
    }
  };

  const rename = (node: TreeNode, newName: string) => relocate(node, () => renameEntry(node.path, newName), true);
  /** Name eines Ordners für Meldungen ("" = der Vault). */
  const ordnerName = (dir: string) => (dir ? pageTitle(dir) : vault.name);

  /**
   * Verschieben (per Ziehen oder „Verschieben nach …“): Gibt es im Ziel schon einen gleichnamigen Eintrag, bleibt
   * alles, wie es ist, und eine Meldung sagt warum. Sonst erscheint „„Ideen“ nach „Archiv“ verschoben.“ mit
   * „Rückgängig“ (verschwindet nach etwa 6 Sekunden). Rückgängig schiebt zurück und passt die Links wieder an.
   */
  const move = async (node: TreeNode, targetDir: string) => {
    const konflikt = namensKonflikt(treeRef.current, node, targetDir);
    if (konflikt) {
      const was = node.kind === "folder" ? "einen Ordner" : "eine Seite";
      showError(`„${node.name}“ wurde nicht verschoben: In „${ordnerName(targetDir)}“ gibt es schon ${was} „${konflikt.name}“.`);
      return false;
    }
    const herkunft = parentDir(node.path);
    return relocate(node, () => moveEntry(node.path, targetDir), false, (newPath, changed) => ({
      kind: "info",
      text: [`„${node.name}“ nach „${ordnerName(targetDir)}“ verschoben.`, linksText(changed)].filter(Boolean).join(" "),
      aktion: { label: "Rückgängig", onClick: () => void rueckgaengig(newPath, herkunft) },
    }));
  };

  /** „Rückgängig“ nach dem Verschieben: zurück in den alten Ordner, Links, Reiter und Favoriten folgen wieder. */
  const rueckgaengig = async (path: string, herkunft: string) => {
    setNotice(null);
    const node = findNode(treeRef.current, path);
    if (!node) {
      showError(`„${pageTitle(path)}“ ist nicht mehr da und kann nicht zurückgeschoben werden.`);
      return;
    }
    await relocate(node, () => moveEntry(path, herkunft), false, (_, changed) => ({
      kind: "info",
      text: [`„${node.name}“ ist wieder in „${ordnerName(herkunft)}“.`, linksText(changed)].filter(Boolean).join(" "),
    }));
  };

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
  const openFromHtmlPage = (path: string, neu = false) => {
    const node = findNode(treeRef.current, path);
    if (node?.kind === "page") void openPage(path, false, neu);
    else if (node?.database) void openDatabase(path, neu);
    else if (node?.notebook) void openNotebook(path, neu);
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
      resolve: (target) => resolveLink(pages, target, offeneSeite()),
      open: (target, neu = false) => {
        const path = resolveLink(pages, target, offeneSeite());
        if (path) void openPage(path, false, neu);
        else void createAndOpenLinkedPage(linkPageName(target), neu);
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

  const createAndOpenLinkedPage = async (name: string, neu = false) => {
    try {
      const html = isHtmlPath(name);
      const title = pageTitle(name.includes("/") ? name.slice(name.lastIndexOf("/") + 1) : name);
      const path = await createPage("", title, html ? "html" : "notiz");
      await refreshTree();
      await openPage(path, false, neu);
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
      // Reiter mit dem Gelöschten schließen (vorher nichts mehr dorthin speichern).
      const offen = offeneSeite();
      if (offen && isInside(offen, node.path)) saverRef.current?.cancel();
      setStand(entfernen(standRef.current, (inhalt) => "pfad" in inhalt && isInside(inhalt.pfad, node.path)));
      await deleteEntry(node.path);
      await updateFavorites((list) => removeFromFavorites(list, node.path));
      await refreshTree();
    } catch (error) {
      showError(errorMessage(error));
    }
  };

  const renameOpenPage = (newTitle: string) => {
    const current = offeneSeite();
    const node = current && findNode(tree, current);
    return node ? rename(node, newTitle) : Promise.resolve(false);
  };

  const current = page?.path ?? database ?? notebook;
  const homeActive = aktiv.inhalt.art === "start" && !vaultMissing;
  const favoriteNodes = favorites.map((path) => findNode(tree, path)).filter((node): node is TreeNode => node !== null);
  const currentNode = current ? findNode(tree, current) : null;

  /** „Umbenennen“ aus dem Seitenkopf: bei der offenen Seite im Seitentitel, sonst in der Seitenleiste. */
  const umbenennenStarten = (node: TreeNode) => {
    const titel = document.querySelector<HTMLInputElement>(".page-title");
    if (node.kind === "page" && titel) {
      titel.focus();
      titel.select();
      return;
    }
    if (eingeklappt) storeEingeklappt(false);
    if (ohneLeiste) setMenuOpen(true);
    setRenamingPath(node.path);
  };
  /** „…“ im Seitenkopf: dieselben Aktionen wie das Kontextmenü der Seitenleiste. */
  const kopfAktionen = currentNode
    ? {
        tree,
        onCreate: handleCreate,
        onRename: () => umbenennenStarten(currentNode),
        onMove: () => setDialog({ kind: "move", node: currentNode }),
        onDelete: () => void handleDelete(currentNode),
        onDatabase: () => void (currentNode.database ? openDatabase(currentNode.path) : convertToDatabase(currentNode.path)),
        onNotebook: () => void (currentNode.notebook ? openNotebook(currentNode.path) : convertToNotebook(currentNode.path)),
        onConvertToHtml: () => void convertToHtml(currentNode),
        onExport: () => void exportPage(currentNode),
        onReveal: explorer ? () => void revealInExplorer(currentNode.path) : undefined,
      }
    : null;

  /** Hervorgehobener Eintrag der Navigationsleiste (Handy). */
  const navAktiv: NavZiel | null =
    dialog?.kind === "settings" ? "einstellungen" : dialog?.kind === "quick" || dialog?.kind === "search" ? "suchen" : menuOpen ? "seiten" : homeActive ? "start" : null;

  return (
    <div className={cx("workspace", `seitenleiste-${seitenleisteSeite}`, fensterrahmen && "hat-fensterleiste", eingeklappt && "is-eingeklappt", schmal && "is-handy")}>
      <div id="seitenleiste" className={cx("sidebar-shell", menuOpen && "open")} inert={schmal && !menuOpen ? true : undefined}>
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
          fensterrahmen={fensterrahmen}
          seite={seitenleisteSeite}
          handy={schmal}
          onOpen={(path, neu) => void openPage(path, false, neu)}
          onOpenDatabase={(path, neu) => void openDatabase(path, neu)}
          onOpenHome={() => void openHome()}
          libraryActive={library}
          onOpenLibrary={(neu) => void openLibrary(neu)}
          onConvertToDatabase={(path) => void convertToDatabase(path)}
          onOpenNotebook={(path, neu) => void openNotebook(path, neu)}
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
      <Fensterleiste platform={platform} className="workspace-leiste">
        <IconButton
          ref={seitenleisteKnopf}
          className="seitenleiste-knopf"
          label={eingeklappt ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
          title={`${eingeklappt ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"} (Strg+.)`}
          aria-expanded={!eingeklappt}
          aria-controls="seitenleiste"
          onClick={seitenleisteUmschalten}
        >
          {seitenleisteSeite === "rechts" ? eingeklappt ? <PanelRightOpen /> : <PanelRightClose /> : eingeklappt ? <PanelLeftOpen /> : <PanelLeftClose />}
        </IconButton>
      </Fensterleiste>
      {/* Handy: Hinter der Ansicht „Seiten“ ist der Inhalt nicht erreichbar (weder per Tippen noch per Tab). */}
      <main className="main" inert={schmal && menuOpen ? true : undefined}>
        {!ohneLeiste && (
          <Reiterleiste
            stand={stand}
            onAktivieren={(id) => void wechsel((s) => aktivieren(s, id))}
            onSchliessen={(id) => void wechsel((s) => schliessen(s, id))}
            onNeu={() => void wechsel(neuerStartReiter)}
          />
        )}
        <div className="main-scroll" ref={mainScroll}>
        <SeitenKopf
          ordner={current ? ancestorNames(current) : []}
          titel={current ? pageTitle(current) : vaultMissing ? vault.name : library ? "Bausteine" : "Startseite"}
          istSeite={page !== null}
          geaendert={page ? index.find((entry) => entry.path === page.path)?.modified : undefined}
          node={currentNode}
          favorit={current !== null && favorites.includes(current)}
          onFavorit={() => current && void updateFavorites((list) => toggleFavorite(list, current))}
          aktionen={kopfAktionen}
          start={homeActive}
          handy={schmal ? { ort: (current ? ancestorNames(current).pop() : undefined) ?? vault.name, onZurueck: () => void zurueck() } : undefined}
        />
        <ScrollGedaechtnisContext.Provider value={gedaechtnis}>
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
        ) : !baumGeladen && aktiv.inhalt.art !== "start" ? null : library ? (
          <BausteinBibliothek key={aktiv.ansicht} eigene={eigene} onEigeneChanged={loadEigene} onError={showError} />
        ) : notebook ? (
          <NotizbuchView
            key={aktiv.ansicht}
            folder={notebook}
            node={findNode(tree, notebook)}
            pages={pages}
            version={vaultVersion}
            onEdit={(path) => void openPage(path)}
            onOpenLink={(path, neu) => openFromHtmlPage(path, neu)}
            onOpenExternal={(url) => void openExternal(url)}
            onError={showError}
          />
        ) : database && schemas.configs[database] ? (
          <DatabaseView
            key={aktiv.ansicht}
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
              onOpenLink={(path, neu) => openFromHtmlPage(path, neu)}
              onOpenExternal={(url) => void openExternal(url)}
              pages={pages}
              eigene={eigene}
              onEigeneChanged={loadEigene}
            >
              <Backlinks path={page.path} pages={pages} loadIndex={loadIndex} version={vaultVersion} icons={icons} onOpen={(path, neu) => void openPage(path, false, neu)} />
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
              <Backlinks path={page.path} pages={pages} loadIndex={loadIndex} version={vaultVersion} icons={icons} onOpen={(path, neu) => void openPage(path, false, neu)} />
            </PageView>
          </WikiLinkContext.Provider>
          )
        ) : database ? null : (
          <HomePage
            key={aktiv.ansicht}
            index={index}
            favorites={favoriteNodes}
            icons={icons}
            onOpen={(node, neu) => void (node.kind === "folder" ? openDatabase(node.path, neu) : openPage(node.path, false, neu))}
            onCreateNote={() => void handleCreatePage("")}
            onCreateDatabase={() => void handleCreateDatabase("")}
            onCreateFromTemplate={() => setDialog({ kind: "template", dir: "" })}
            onQuickNote={schnellNotieren}
            handy={
              schmal
                ? {
                    vaultName: vault.name,
                    onSwitchVault: async () => {
                      await saverRef.current?.flush();
                      onSwitchVault();
                    },
                    onRevealVault: explorer ? () => void revealInExplorer("") : undefined,
                    onOpenSettings: () => setDialog({ kind: "settings" }),
                  }
                : undefined
            }
          />
        )}
        </ScrollGedaechtnisContext.Provider>
        </div>
      </main>
      {/* Meldungen liegen außerhalb von <main>: Auf dem Handy ist <main> hinter der Ansicht „Seiten“ inert, der Knopf
          „Rückgängig“ muss trotzdem erreichbar sein. */}
      {notice && (
        <div className={`notice toast ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          {notice.aktion && (
            <Button size="sm" variant="ghost" className="toast-aktion" onClick={notice.aktion.onClick}>
              {notice.aktion.label}
            </Button>
          )}
          <IconButton size="sm" label="Meldung schließen" onClick={() => setNotice(null)}>
            <X />
          </IconButton>
        </div>
      )}
      {schmal && (
        <Navigationsleiste
          aktiv={navAktiv}
          tree={tree}
          onStart={() => {
            setDialog(null);
            setMenuOpen(false);
            // „Start“ beginnt von vorn: Der Zurück-Pfeil führt danach wieder zur Startseite.
            void openHome().then(() => (verlaufRef.current = []));
          }}
          onSuchen={() => {
            setMenuOpen(false);
            setDialog({ kind: "quick" });
          }}
          onSeiten={() => {
            setDialog(null);
            setMenuOpen(!menuOpen);
          }}
          onEinstellungen={() => {
            setMenuOpen(false);
            setDialog({ kind: "settings" });
          }}
          onCreate={(kind, dir) => {
            setMenuOpen(false);
            handleCreate(kind, dir);
          }}
        />
      )}
      {dialog?.kind === "quick" && (
        <QuickSwitcher
          pages={pages}
          onClose={() => setDialog(null)}
          onOpen={(path, neu) => {
            setDialog(null);
            void openPage(path, false, neu);
          }}
        />
      )}
      {dialog?.kind === "search" && (
        <SearchDialog
          loadIndex={loadIndex}
          initialQuery={dialog.query}
          onClose={() => setDialog(null)}
          onOpen={(path, neu) => {
            setDialog(null);
            void openPage(path, false, neu);
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
          handy={schmal}
          vaultName={vault.name}
          vaultRoot={vault.root}
          onClose={() => setDialog(null)}
          onSwitchVault={async () => {
            setDialog(null);
            await saverRef.current?.flush();
            onSwitchVault();
          }}
          platform={platform}
          vorDemUpdate={async () => {
            await saverRef.current?.sicherSpeichern();
          }}
          onOpenExternal={(url) => void openExternal(url)}
        />
      )}
    </div>
  );
}

/** So viele Inhalte merkt sich der Zurück-Pfeil (Handy). */
const VERLAUF_MAX = 50;

/** Gleicher Inhalt (Art und Pfad), egal in welchem Reiter. */
function inhaltSchluessel(inhalt: ReiterInhalt): string {
  return `${inhalt.art}:${"pfad" in inhalt ? inhalt.pfad : ""}`;
}

/** Ordnernamen auf dem Weg zu einer Seite, z. B. "Notizen/Ideen.md" → ["Notizen"]. */
function ancestorNames(path: string): string[] {
  return path.split("/").slice(0, -1);
}
