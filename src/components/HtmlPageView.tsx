// Eine HTML-Seite: oben der Seitenkopf wie bei Notizen (Icon und Cover aus den <meta>-Tags, Titel = Dateiname),
// darunter eine von drei Ansichten: „Lesen“ (abgeschottete Anzeige), „Code“ (CodeMirror) und „Geteilt“
// (Code und Vorschau nebeneinander, getrennt durch eine verschiebbare Linie; der Code steht links oder rechts,
// siehe Einstellungen und Knopf „Seiten tauschen“). Umschalten per Schaltflächen oder Strg+E.
// Der Editor zeigt nur den Inhalt von <main> (Schalter „Ganze Datei“ zeigt alles). Gespeichert wird automatisch:
// unveränderter Anfang + Editor-Text + unveränderter Rest (siehe src/lib/html-editor.ts).
// Über dem Editor fügt die Werkzeugleiste Bausteine ein, im Editor auch das „/“-Menü.
// In „Lesen“ und „Geteilt“ öffnet das Stift-Symbol eines Bausteins ein Formular; Häkchen werden gespeichert.
import { ArrowLeftRight, FileCode } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { AutoSaver, errorMessage } from "../lib/autosave";
import { bausteinAnzahl, bausteinEntfernen, bausteinLesen, bausteinSchreiben, haekchenSetzen, type BausteinWerte } from "../lib/baustein-formulare";
import { BAUSTEINE, bausteinInfo, type BausteinArt } from "../lib/bausteine";
import { eigenerBausteinZeilen, type EigenerBaustein } from "../lib/eigene-bausteine";
import { encodePath, readHead, relativePath, setMeta } from "../lib/html";
import {
  HTML_VIEW_MODES,
  joinFromEditor,
  nextViewMode,
  splitForEditor,
  storedViewMode,
  storeViewMode,
  useCodeSeite,
  type EditorSplit,
  type HtmlViewMode,
} from "../lib/html-editor";
import type { PageRef } from "../lib/links";
import { useTheme } from "../lib/theme";
import { pageTitle, parentDir } from "../lib/tree";
import { confirmAction, importAttachment, pickImage, readPage, writePage } from "../lib/vault-api";
import { BausteinDialog } from "./BausteinDialog";
import { BausteinLeiste } from "./BausteinLeiste";
import { CodeEditor, type CodeEditorApi, type SlashEintrag } from "./CodeEditor";
import { EigenerBausteinDialog } from "./EigenerBausteinDialog";
import { GeteiltTrenner } from "./GeteiltTrenner";
import { PagePicker } from "./Dialogs";
import { PageHeader } from "./PageHeader";
import { PagePreview } from "./PagePreview";
import { PageTitle, resolveFileUrlFor } from "./PageView";
import { Button, cx, IconButton, Segmented } from "./ui";

interface Props {
  path: string;
  /** Neu angelegte Seite: öffnet in „Geteilt“, Titel zum Eintippen markiert. */
  isNew?: boolean;
  /** Wird erhöht, wenn der Dateiwächter eine Änderung an dieser Seite meldet. */
  externalVersion: number;
  /** Hier legt die Seite ihren AutoSaver ab, damit vor Seitenwechsel oder Schließen gespeichert werden kann. */
  saverRef: MutableRefObject<AutoSaver | null>;
  onRename: (newTitle: string) => Promise<boolean>;
  onError: (message: string) => void;
  /** Ein Link in der Seite zeigt auf eine Datei im Vault (Pfad ist geprüft). */
  onOpenLink: (path: string) => void;
  /** Ein Link in der Seite zeigt nach außen (http, https, mailto). */
  onOpenExternal: (url: string) => void;
  /** Alle Seiten des Vaults (Ziele für Seitenlinks). */
  pages: PageRef[];
  /** Eigene Bausteine des Vaults (Werkzeugleiste und „/“-Menü). */
  eigene?: EigenerBaustein[];
  /** Ein eigener Baustein wurde gespeichert: Liste neu laden. */
  onEigeneChanged?: () => void;
  /** Wird unter der Seite angezeigt (Backlinks). */
  children?: ReactNode;
}

export function HtmlPageView({
  path,
  isNew = false,
  externalVersion,
  saverRef,
  onRename,
  onError,
  onOpenLink,
  onOpenExternal,
  pages,
  eigene = [],
  onEigeneChanged,
  children,
}: Props) {
  const [mode, setModeState] = useState<HtmlViewMode>(() => (isNew ? "geteilt" : storedViewMode()));
  const [wholeFile, setWholeFile] = useState(false);
  const [codeSeite, setCodeSeite] = useCodeSeite();
  const flaeche = useRef<HTMLDivElement>(null);
  const codeId = useId();
  /** Dateiinhalt zuletzt geladen oder gespeichert (für Kopf und Neuladen). */
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [split, setSplit] = useState<EditorSplit | null>(null);
  /** Zählt, wie oft der Editor-Inhalt von außen ersetzt wurde. */
  const [editorVersion, setEditorVersion] = useState(0);
  /** Zählt Neuladungen der Vorschau (nach Speichern oder Änderungen von außen). */
  const [previewVersion, setPreviewVersion] = useState(1);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const { resolved } = useTheme();
  /** Aktueller Inhalt inklusive noch nicht gespeicherter Eingaben. */
  const current = useRef<string | null>(null);
  /** Aktueller Ausschnitt inklusive der letzten Eingaben (für einen neu aufgebauten Editor nach Ansichtswechsel). */
  const splitRef = useRef<EditorSplit | null>(null);
  const applySplit = (next: EditorSplit) => {
    splitRef.current = next;
    setSplit(next);
  };
  const wholeFileRef = useRef(wholeFile);
  wholeFileRef.current = wholeFile;
  const pathRef = useRef(path);
  pathRef.current = path;
  const editorApi = useRef<CodeEditorApi | null>(null);
  /** Auswahl der Seite für einen neuen Seitenlink. */
  const [pickingPage, setPickingPage] = useState(false);
  /** Baustein, der gerade im Formular bearbeitet wird (Nummer wie im iframe gezählt). */
  const [formular, setFormular] = useState<{ index: number; werte: BausteinWerte } | null>(null);
  /** Markierter Code, der als eigener Baustein gespeichert werden soll. */
  const [speichernCode, setSpeichernCode] = useState<string | null>(null);
  /** Änderungen aus Formular und Häkchen nacheinander schreiben, damit keine eine andere überholt. */
  const changes = useRef<Promise<void>>(Promise.resolve());

  const setMode = useCallback((next: HtmlViewMode) => {
    setModeState(next);
    storeViewMode(next);
  }, []);

  /** Übernimmt einen Dateiinhalt in Editor, Kopf und Vorschau. */
  const adopt = (content: string, reloadPreview: boolean) => {
    current.current = content;
    setText(content);
    applySplit(splitForEditor(content, wholeFileRef.current));
    setEditorVersion((version) => version + 1);
    if (reloadPreview) setPreviewVersion((version) => version + 1);
  };

  // Seite einmal laden. Für eine andere Seite baut Workspace eine neue Ansicht (key).
  useEffect(() => {
    let cancelled = false;
    readPage(pathRef.current).then(
      (loaded) => {
        if (cancelled) return;
        saverRef.current = new AutoSaver(
          loaded,
          async (content) => {
            await writePage(pathRef.current, content);
            // Nach dem Speichern: Kopf aktualisieren und die Vorschau neu laden.
            setText(content);
            setPreviewVersion((version) => version + 1);
          },
          onError,
        );
        adopt(loaded, false);
      },
      (error) => !cancelled && setLoadError(errorMessage(error)),
    );
    return () => {
      cancelled = true;
      // Beim Verlassen der Seite nichts verlieren.
      void saverRef.current?.flush();
      saverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Öffnen laden
  }, []);

  // Änderung von außen (oder Umbenennen): neu laden, außer es ist die eigene Speicherung oder es gibt ungespeicherte Eingaben.
  useEffect(() => {
    if (externalVersion === 0 && current.current === null) return;
    let cancelled = false;
    readPage(pathRef.current).then(
      (loaded) => {
        const saver = saverRef.current;
        if (cancelled || !saver || loaded === current.current) return;
        if (saver.isOwnWrite(loaded) || saver.dirty) return;
        saver.lastSaved = loaded;
        adopt(loaded, true);
      },
      () => {
        // Datei ist weg oder gerade nicht lesbar: Die Sidebar kümmert sich ums Schließen.
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf neue Meldungen reagieren
  }, [externalVersion, path]);

  // Strg+E: Lesen → Code → Geteilt (auch aus der Seite heraus, die Brücke reicht die Taste weiter).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      setModeState((previous) => {
        const next = nextViewMode(previous);
        storeViewMode(next);
        return next;
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /** Eingabe im Editor: Datei = unveränderter Anfang + Editor-Text + unveränderter Rest, automatisch gespeichert. */
  const onEditorChange = useCallback(
    (body: string) => {
      const parts = splitRef.current;
      if (!parts) return;
      splitRef.current = { ...parts, body };
      current.current = joinFromEditor(parts, body);
      saverRef.current?.schedule(() => current.current ?? "");
    },
    [saverRef],
  );

  const insertEigen = (name: string) => {
    const baustein = eigene.find((candidate) => candidate.name === name);
    if (baustein) editorApi.current?.insert(eigenerBausteinZeilen(baustein.code));
  };

  /** Markierten Code als eigenen Baustein speichern (öffnet den Dialog für Name und Beschreibung). */
  const saveSelection = () => {
    const code = editorApi.current?.markierung() ?? "";
    if (!code.trim()) onError("Markiere zuerst den Code, den du als eigenen Baustein speichern möchtest.");
    else setSpeichernCode(code);
  };

  /** Einträge des „/“-Menüs: eingebaute Bausteine, dann die eigenen. */
  const slashEintraege: SlashEintrag[] = [
    ...BAUSTEINE.map((info) => ({ id: info.art, name: info.name, beschreibung: info.beschreibung })),
    ...eigene.map((baustein) => ({ id: `eigen:${baustein.name}`, name: baustein.name, beschreibung: baustein.beschreibung || "Eigener Baustein" })),
  ];
  const onSlash = (id: string) => (id.startsWith("eigen:") ? insertEigen(id.slice("eigen:".length)) : void insertBaustein(id as BausteinArt));

  /** Baustein aus Werkzeugleiste oder „/“-Menü einfügen. Bild und Seitenlink fragen vorher nach dem Ziel. */
  const insertBaustein = async (art: BausteinArt) => {
    const info = bausteinInfo(art);
    if (info.ziel === "seite") {
      setPickingPage(true);
      return;
    }
    let src: string | undefined;
    if (info.ziel === "bild") {
      try {
        const source = await pickImage();
        if (!source) return;
        // Bilder von außen kommen nach „Anhänge“; der Pfad steht relativ zur Seite.
        src = encodePath(relativePath(parentDir(pathRef.current), await importAttachment(source)));
      } catch (error) {
        onError(errorMessage(error));
        return;
      }
    }
    editorApi.current?.insert(info.vorlage({ src }), info.auswahl);
  };

  /**
   * Ändert die Datei sofort an genau einer Stelle (Formular, Entfernen, Häkchen). `change` liefert den neuen
   * Inhalt, null wenn die Stelle nicht (mehr) da ist, oder wirft einen Fehler mit verständlicher Meldung.
   */
  const applyChange = (change: (content: string) => string | null, notFound: string, reloadPreview: boolean) => {
    changes.current = changes.current.then(async () => {
      const saver = saverRef.current;
      await saver?.flush();
      const content = current.current;
      if (content === null || !saver) return;
      let updated: string | null;
      try {
        updated = change(content);
      } catch (error) {
        onError(errorMessage(error));
        return;
      }
      if (updated === null) {
        onError(notFound);
        setPreviewVersion((version) => version + 1);
        return;
      }
      if (updated === content) return;
      try {
        await writePage(pathRef.current, updated);
        saver.lastSaved = updated;
        adopt(updated, reloadPreview);
      } catch (error) {
        onError(errorMessage(error));
      }
    });
    return changes.current;
  };

  /** Stift-Symbol: Formular für diesen Baustein öffnen, wenn er in der Datei an derselben Stelle steht. */
  const editBaustein = async (index: number, art: BausteinArt, anzahl: number) => {
    await changes.current;
    await saverRef.current?.flush();
    const content = current.current;
    if (content === null) return;
    const werte = bausteinAnzahl(content) === anzahl ? bausteinLesen(content, index) : null;
    if (!werte || werte.art !== art) {
      onError("Dieser Baustein lässt sich nicht ohne Code bearbeiten, weil ein Skript der Seite sie verändert hat. Bitte in der Ansicht „Code“ ändern.");
      return;
    }
    setFormular({ index, werte });
  };

  const saveBaustein = (werte: BausteinWerte) => {
    if (!formular) return;
    const { index } = formular;
    setFormular(null);
    void applyChange((content) => bausteinSchreiben(content, index, werte), "Der Baustein wurde in der Datei nicht gefunden.", true);
  };

  const removeBaustein = async () => {
    if (!formular) return;
    const { index, werte } = formular;
    if (!(await confirmAction(`${bausteinInfo(werte.art).name} wirklich aus der Seite entfernen?`, "Baustein entfernen"))) return;
    setFormular(null);
    void applyChange((content) => bausteinEntfernen(content, index), "Der Baustein wurde in der Datei nicht gefunden.", true);
  };

  const toggleCheckbox = (index: number, an: boolean) =>
    void applyChange((content) => haekchenSetzen(content, index, an), "Das Häkchen konnte nicht gespeichert werden: Die Checkliste wurde in der Datei nicht gefunden.", false);

  const insertPageLink = (page: PageRef) => {
    setPickingPage(false);
    const info = bausteinInfo("seitenlink");
    editorApi.current?.insert(info.vorlage({ href: encodePath(relativePath(parentDir(pathRef.current), page.path)), titel: page.title }), info.auswahl);
  };

  const toggleWholeFile = () => {
    const next = !wholeFile;
    setWholeFile(next);
    wholeFileRef.current = next;
    if (current.current !== null) {
      applySplit(splitForEditor(current.current, next));
      setEditorVersion((version) => version + 1);
    }
  };

  const head = text === null ? null : readHead(text);
  const cover = head?.cover ?? null;

  useEffect(() => {
    let cancelled = false;
    setCoverUrl(null);
    if (cover) void resolveFileUrlFor(pathRef.current, cover).then((url) => !cancelled && setCoverUrl(url));
    return () => {
      cancelled = true;
    };
  }, [cover]);

  /** Ändert eine Angabe im Kopfbereich (Icon, Cover) an genau dieser Stelle und speichert sofort. */
  const updateMeta = async (name: string, value: string | null) => {
    const saver = saverRef.current;
    await saver?.flush();
    const content = current.current;
    if (content === null || !saver) return;
    const updated = setMeta(content, name, value);
    if (updated === content) return;
    try {
      await writePage(pathRef.current, updated);
      saver.lastSaved = updated;
      adopt(updated, true);
    } catch (error) {
      onError(errorMessage(error));
    }
  };

  const pickCover = async () => {
    try {
      const source = await pickImage();
      if (!source) return;
      // In HTML-Seiten steht das Cover relativ zur Seite (z. B. "../Anhänge/bild.png").
      const inVault = await importAttachment(source);
      await updateMeta("localist-cover", relativePath(parentDir(pathRef.current), inVault));
    } catch (error) {
      onError(errorMessage(error));
    }
  };

  if (loadError) {
    return (
      <div className="page">
        <p className="notice error">Die Seite konnte nicht geöffnet werden: {loadError}</p>
      </div>
    );
  }

  const title = pageTitle(path);
  const editing = mode !== "lesen";
  return (
    <div className={cx("page-view html-page-view", `is-${mode}`)}>
      {head && (
        <PageHeader
          icon={head.icon}
          coverUrl={coverUrl}
          hasCover={cover !== null}
          onSetIcon={(icon) => void updateMeta("localist-icon", icon)}
          onPickCover={() => void pickCover()}
          onRemoveCover={() => void updateMeta("localist-cover", null)}
        />
      )}
      <div className={cx("page", editing && "is-wide")}>
        <PageTitle title={title} autoFocus={isNew} onRename={onRename} />
        <div className="html-page-bar">
          <span className="html-page-type">
            <FileCode aria-hidden="true" /> HTML-Seite
          </span>
          <div className="html-page-controls">
            {editing && split && (
              <Button
                variant="ghost"
                size="sm"
                active={!split.mainOnly}
                aria-pressed={!split.mainOnly}
                disabled={!wholeFile && !split.mainOnly}
                title={!wholeFile && !split.mainOnly ? "Die Seite hat kein <main>: Der Editor zeigt die ganze Datei." : "Ganze Datei statt nur den Inhalt von <main> zeigen"}
                onClick={toggleWholeFile}
              >
                Ganze Datei
              </Button>
            )}
            {mode === "geteilt" && (
              <IconButton
                size="sm"
                label="Seiten tauschen"
                title={`Seiten tauschen (Code-Editor nach ${codeSeite === "links" ? "rechts" : "links"})`}
                onClick={() => setCodeSeite(codeSeite === "links" ? "rechts" : "links")}
              >
                <ArrowLeftRight />
              </IconButton>
            )}
            <Segmented<HtmlViewMode> size="sm" label="Ansicht (Strg+E)" options={HTML_VIEW_MODES} value={mode} onChange={setMode} />
          </div>
        </div>
        {text === null || split === null ? (
          <p className="muted">Lädt …</p>
        ) : (
          <div ref={flaeche} className={cx("html-workspace", `is-${mode}`, mode === "geteilt" && codeSeite === "rechts" && "is-code-rechts")}>
            {editing && (
              <div className="html-code-pane" id={codeId}>
                <BausteinLeiste onPick={(art) => void insertBaustein(art)} eigene={eigene} onPickEigen={insertEigen} onSave={saveSelection} />
                <CodeEditor
                  value={splitRef.current?.body ?? split.body}
                  docVersion={editorVersion}
                  lineBreak={split.lineBreak}
                  dark={resolved === "dark"}
                  label={`HTML-Code von „${title}“`}
                  onChange={onEditorChange}
                  apiRef={editorApi}
                  slashEintraege={slashEintraege}
                  onSlash={onSlash}
                />
              </div>
            )}
            {mode === "geteilt" && <GeteiltTrenner flaeche={flaeche} seite={codeSeite} codeId={codeId} />}
            {mode !== "code" && (
              <div className="html-preview-pane">
                <PagePreview
                  key={path}
                  path={path}
                  version={previewVersion}
                  fitContent={mode === "lesen"}
                  title={title}
                  onOpenLink={onOpenLink}
                  onOpenExternal={onOpenExternal}
                  onEditBaustein={(index, art, anzahl) => void editBaustein(index, art, anzahl)}
                  onToggleCheckbox={toggleCheckbox}
                />
              </div>
            )}
          </div>
        )}
        {text !== null && children}
      </div>
      {formular && (
        <BausteinDialog
          werte={formular.werte}
          pagePath={path}
          pages={pages}
          onSave={saveBaustein}
          onRemove={() => void removeBaustein()}
          onClose={() => setFormular(null)}
          onError={onError}
        />
      )}
      {speichernCode !== null && (
        <EigenerBausteinDialog
          baustein={null}
          code={speichernCode}
          onClose={() => setSpeichernCode(null)}
          onSaved={() => {
            setSpeichernCode(null);
            onEigeneChanged?.();
          }}
        />
      )}
      {pickingPage && (
        <PagePicker
          pages={pages.filter((page) => page.path !== path)}
          label="Seite für den Seitenlink wählen"
          onPick={insertPageLink}
          onClose={() => setPickingPage(false)}
        />
      )}
    </div>
  );
}
