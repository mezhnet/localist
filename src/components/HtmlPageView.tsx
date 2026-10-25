// Eine HTML-Seite in der Ansicht „Lesen“: oben der Seitenkopf wie bei Notizen (Icon und Cover aus den
// <meta>-Tags, Titel = Dateiname), darunter die Seite in der abgeschotteten Anzeige. Das iframe hat
// sandbox="allow-scripts" ohne allow-same-origin: Die Seite hat keinen Zugriff auf App, Dateien oder Netzwerk
// und spricht mit der App nur über postMessage (siehe src/lib/bridge.ts und src-tauri/seite/bruecke.js).
import { FileCode } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorMessage } from "../lib/autosave";
import { parseBridgeMessage, themeMessage } from "../lib/bridge";
import { readHead, relativePath, setMeta } from "../lib/html";
import { useTheme } from "../lib/theme";
import { pageTitle, parentDir } from "../lib/tree";
import { importAttachment, pageUrl, pickImage, readPage, writePage } from "../lib/vault-api";
import { PageHeader } from "./PageHeader";
import { PageTitle, resolveFileUrlFor } from "./PageView";

interface Props {
  path: string;
  isNew?: boolean;
  /** Wird erhöht, wenn der Dateiwächter eine Änderung an dieser Seite meldet. */
  externalVersion: number;
  onRename: (newTitle: string) => Promise<boolean>;
  onError: (message: string) => void;
  /** Ein Link in der Seite zeigt auf eine Datei im Vault (Pfad ist geprüft). */
  onOpenLink: (path: string) => void;
  /** Ein Link in der Seite zeigt nach außen (http, https, mailto). */
  onOpenExternal: (url: string) => void;
  /** Wird unter der Seite angezeigt (Backlinks). */
  children?: ReactNode;
}

export function HtmlPageView({ path, isNew = false, externalVersion, onRename, onError, onOpenLink, onOpenExternal, children }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Zählt Neuladungen der Anzeige (nach Änderungen an der Datei). */
  const [frameVersion, setFrameVersion] = useState(1);
  const [height, setHeight] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const textRef = useRef<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;
  const { resolved } = useTheme();
  const actions = useRef({ onOpenLink, onOpenExternal });
  actions.current = { onOpenLink, onOpenExternal };

  // Laden und bei Änderungen von außen neu laden (eigene Änderungen nicht doppelt).
  useEffect(() => {
    let cancelled = false;
    readPage(pathRef.current).then(
      (loaded) => {
        if (cancelled || loaded === textRef.current) return;
        const first = textRef.current === null;
        textRef.current = loaded;
        setText(loaded);
        setLoadError(null);
        if (!first) setFrameVersion((version) => version + 1);
      },
      (error) => !cancelled && textRef.current === null && setLoadError(errorMessage(error)),
    );
    return () => {
      cancelled = true;
    };
  }, [externalVersion, path]);

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

  // Nachrichten nur aus genau diesem iframe annehmen, dann Typ und Felder prüfen.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = parseBridgeMessage(event.data);
      if (!message) return;
      if (message.typ === "bereit") frame.current.contentWindow?.postMessage(themeMessage(resolved), "*");
      else if (message.typ === "groesse") setHeight(message.hoehe);
      else if (message.typ === "link") actions.current.onOpenLink(message.pfad);
      else if (message.typ === "extern") actions.current.onOpenExternal(message.url);
      else if (message.typ === "taste") {
        // Tastenkürzel der App: wie ein Tastendruck im App-Fenster behandeln.
        window.dispatchEvent(new KeyboardEvent("keydown", { key: message.taste, ctrlKey: true, shiftKey: message.umschalt, bubbles: true }));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resolved]);

  // Hell/Dunkel an die Seite weitergeben (nur das Farbschema, keine anderen Daten).
  useEffect(() => {
    frame.current?.contentWindow?.postMessage(themeMessage(resolved), "*");
  }, [resolved]);

  /** Ändert eine Angabe im Kopfbereich (Icon, Cover) an genau dieser Stelle und speichert sofort. */
  const updateMeta = async (name: string, value: string | null) => {
    const current = textRef.current;
    if (current === null) return;
    const updated = setMeta(current, name, value);
    if (updated === current) return;
    try {
      await writePage(pathRef.current, updated);
      textRef.current = updated;
      setText(updated);
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
  return (
    <div className="page-view html-page-view">
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
      <div className="page">
        <PageTitle title={title} autoFocus={isNew} onRename={onRename} />
        <div className="html-page-bar">
          <span className="html-page-type">
            <FileCode aria-hidden="true" /> HTML-Seite
          </span>
          <span className="html-page-mode">Lesen</span>
        </div>
        {text === null ? (
          <p className="muted">Lädt …</p>
        ) : (
          <iframe
            ref={frame}
            key={path}
            className="html-frame"
            title={`HTML-Seite „${title}“`}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            src={pageUrl(path, frameVersion)}
            style={height !== null ? { height: Math.max(height, 120) } : undefined}
          />
        )}
        {text !== null && children}
      </div>
    </div>
  );
}
