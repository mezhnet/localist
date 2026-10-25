// Eine HTML-Seite: oben der Seitenkopf wie bei Notizen (Icon und Cover aus den <meta>-Tags, Titel = Dateiname),
// darunter eine von drei Ansichten: „Lesen“ (abgeschottete Anzeige), „Code“ (CodeMirror) und „Geteilt“
// (Code links, Vorschau rechts). Umschalten per Schaltflächen oder Strg+E.
// Der Editor zeigt nur den Inhalt von <main> (Schalter „Ganze Datei“ zeigt alles). Gespeichert wird automatisch:
// unveränderter Anfang + Editor-Text + unveränderter Rest (siehe src/lib/html-editor.ts).
import { FileCode } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { AutoSaver, errorMessage } from "../lib/autosave";
import { readHead, relativePath, setMeta } from "../lib/html";
import {
  HTML_VIEW_MODES,
  joinFromEditor,
  nextViewMode,
  splitForEditor,
  storedViewMode,
  storeViewMode,
  type EditorSplit,
  type HtmlViewMode,
} from "../lib/html-editor";
import { useTheme } from "../lib/theme";
import { pageTitle, parentDir } from "../lib/tree";
import { importAttachment, pickImage, readPage, writePage } from "../lib/vault-api";
import { CodeEditor } from "./CodeEditor";
import { PageHeader } from "./PageHeader";
import { PagePreview } from "./PagePreview";
import { PageTitle, resolveFileUrlFor } from "./PageView";
import { Button, cx, Segmented } from "./ui";

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
  /** Wird unter der Seite angezeigt (Backlinks). */
  children?: ReactNode;
}

export function HtmlPageView({ path, isNew = false, externalVersion, saverRef, onRename, onError, onOpenLink, onOpenExternal, children }: Props) {
  const [mode, setModeState] = useState<HtmlViewMode>(() => (isNew ? "geteilt" : storedViewMode()));
  const [wholeFile, setWholeFile] = useState(false);
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
            <Segmented<HtmlViewMode> size="sm" label="Ansicht (Strg+E)" options={HTML_VIEW_MODES} value={mode} onChange={setMode} />
          </div>
        </div>
        {text === null || split === null ? (
          <p className="muted">Lädt …</p>
        ) : (
          <div className={cx("html-workspace", `is-${mode}`)}>
            {editing && (
              <div className="html-code-pane">
                <CodeEditor
                  value={splitRef.current?.body ?? split.body}
                  docVersion={editorVersion}
                  lineBreak={split.lineBreak}
                  dark={resolved === "dark"}
                  label={`HTML-Code von „${title}“`}
                  onChange={onEditorChange}
                />
              </div>
            )}
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
                />
              </div>
            )}
          </div>
        )}
        {text !== null && children}
      </div>
    </div>
  );
}
