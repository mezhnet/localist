// Eine geöffnete Seite: lädt die Datei, zeigt Titel und Editor, speichert automatisch
// und lädt neu, wenn die Datei außerhalb der App geändert wurde.
import { convertFileSrc } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { VaultEditor } from "../editor/schema";
import { AutoSaver, errorMessage } from "../lib/autosave";
import { pageTitle } from "../lib/tree";
import { readPage, resolveAttachment, writePage } from "../lib/vault-api";
import { parsePage, serializePage, type ParsedPage } from "../markdown";
import { BlockEditor } from "./BlockEditor";

interface Props {
  /** Aktueller Pfad der Seite. Ändert er sich (Umbenennen), bleibt der Editor offen. */
  path: string;
  /** Neu angelegte Seite: Titel gleich zum Eintippen markieren. */
  isNew?: boolean;
  /** Wird erhöht, wenn der Dateiwächter eine Änderung an dieser Seite meldet. */
  externalVersion: number;
  /** Hier legt die Seite ihren AutoSaver ab, damit vor Seitenwechsel oder Schließen gespeichert werden kann. */
  saverRef: MutableRefObject<AutoSaver | null>;
  onRename: (newTitle: string) => Promise<boolean>;
  onError: (message: string) => void;
}

interface Loaded {
  page: ParsedPage;
  /** Zählt Neuladungen, damit der Editor mit dem neuen Inhalt frisch aufgebaut wird. */
  version: number;
}

export function PageView({ path, isNew = false, externalVersion, saverRef, onRename, onError }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const formatRef = useRef<ParsedPage["format"] | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  // Seite einmal laden. Für eine andere Seite baut Workspace eine neue PageView (key).
  useEffect(() => {
    let cancelled = false;
    readPage(pathRef.current).then(
      (text) => {
        if (cancelled) return;
        const page = parsePage(text);
        formatRef.current = page.format;
        saverRef.current = new AutoSaver(text, (content) => writePage(pathRef.current, content), onError);
        setLoaded({ page, version: 0 });
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

  // Änderung von außen: neu laden, außer es ist die eigene Speicherung oder es gibt ungespeicherte Eingaben.
  useEffect(() => {
    if (externalVersion === 0) return;
    let cancelled = false;
    readPage(pathRef.current).then(
      (text) => {
        const saver = saverRef.current;
        if (cancelled || !saver || saver.isOwnWrite(text) || saver.dirty) return;
        const page = parsePage(text);
        formatRef.current = page.format;
        saver.lastSaved = text;
        setLoaded((previous) => ({ page, version: (previous?.version ?? 0) + 1 }));
      },
      () => {
        // Datei ist weg oder gerade nicht lesbar: Die Sidebar kümmert sich ums Schließen.
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf neue Meldungen reagieren
  }, [externalVersion]);

  const handleChange = useCallback(
    (editor: VaultEditor) => {
      const format = formatRef.current;
      if (!format) return;
      saverRef.current?.schedule(() => serializePage(format, editor.document));
    },
    [saverRef],
  );

  const resolveFileUrl = useCallback(async (url: string) => {
    if (/^(https?|data|blob|asset):/i.test(url)) return url;
    const absolute = await resolveAttachment(pathRef.current, url).catch(() => null);
    return absolute ? convertFileSrc(absolute) : url;
  }, []);

  if (loadError) {
    return (
      <div className="page">
        <p className="notice error">Die Seite konnte nicht geöffnet werden: {loadError}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageTitle title={pageTitle(path)} autoFocus={isNew} onRename={onRename} />
      {loaded ? (
        <BlockEditor
          key={loaded.version}
          initialBlocks={loaded.page.blocks}
          onChange={handleChange}
          resolveFileUrl={resolveFileUrl}
        />
      ) : (
        <p className="muted">Lädt …</p>
      )}
    </div>
  );
}

/** Großer Seitentitel wie in Notion. Er ist der Dateiname: Ändern benennt die Datei um. */
interface PageTitleProps {
  title: string;
  autoFocus: boolean;
  onRename: (newTitle: string) => Promise<boolean>;
}

function PageTitle({ title, autoFocus, onRename }: PageTitleProps) {
  const [value, setValue] = useState(title);
  const cancelled = useRef(false);
  useEffect(() => setValue(title), [title]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim ersten Anzeigen
  }, []);

  const commit = async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === title) {
      setValue(title);
      return;
    }
    if (!(await onRename(trimmed))) setValue(title);
  };

  return (
    <input
      ref={input}
      className="page-title"
      aria-label="Seitentitel"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelled.current = true;
          setValue(title);
          event.currentTarget.blur();
        }
      }}
    />
  );
}
