// Abgeschottete Anzeige einer HTML-Seite (iframe mit sandbox="allow-scripts", ohne allow-same-origin).
// Nach einer Änderung lädt die neue Fassung unsichtbar hinter der alten, bekommt deren Scrollposition und
// ersetzt sie erst dann: Die Vorschau springt nicht. Nachrichten werden nur aus den eigenen iframes
// angenommen und in src/lib/bridge.ts geprüft.
import { useEffect, useRef, useState } from "react";
import type { BausteinArt } from "../lib/bausteine";
import { editMessage, parseBridgeMessage, scrollMessage, themeMessage, userIsActive } from "../lib/bridge";
import { useTheme } from "../lib/theme";
import { pageUrl } from "../lib/vault-api";
import { cx } from "./ui";

interface Props {
  path: string;
  /** Wird erhöht, wenn sich die Datei geändert hat: Dann lädt die Vorschau neu. */
  version: number;
  /** true: so hoch wie der Inhalt (Ansicht „Lesen“), false: feste Höhe mit eigenem Bildlauf („Geteilt“). */
  fitContent: boolean;
  title: string;
  onOpenLink: (path: string) => void;
  onOpenExternal: (url: string) => void;
  /** Bausteine mit Stift-Symbol bearbeiten und Häkchen speichern (nur mit diesen Rückrufen). */
  onEditBaustein?: (index: number, art: BausteinArt, anzahl: number) => void;
  onToggleCheckbox?: (index: number, an: boolean) => void;
}

/** So lange darf eine neue Fassung zum Laden brauchen, bevor sie trotzdem gezeigt wird. */
const SWAP_TIMEOUT_MS = 2000;
/** So lange wartet eine geladene Fassung höchstens auf die Bestätigung ihrer Scrollposition. */
const SCROLL_CONFIRM_MS = 500;

interface Frame {
  version: number;
  /** Sichtbar (die alte Fassung ist dann weg). */
  shown: boolean;
}

export function PagePreview({ path, version, fitContent, title, onOpenLink, onOpenExternal, onEditBaustein, onToggleCheckbox }: Props) {
  const [frames, setFrames] = useState<Frame[]>([{ version, shown: true }]);
  const [height, setHeight] = useState<number | null>(null);
  const elements = useRef(new Map<number, HTMLIFrameElement>());
  const scrollY = useRef(0);
  const { resolved } = useTheme();
  const actions = useRef({ onOpenLink, onOpenExternal, onEditBaustein, onToggleCheckbox, resolved, fitContent });
  actions.current = { onOpenLink, onOpenExternal, onEditBaustein, onToggleCheckbox, resolved, fitContent };

  /** Macht eine Fassung sichtbar und entfernt alle älteren. */
  const show = (shownVersion: number) =>
    setFrames((list) => list.filter((frame) => frame.version >= shownVersion).map((frame) => (frame.version === shownVersion ? { ...frame, shown: true } : frame)));

  // Neue Fassung: unsichtbar dazuladen (höchstens eine wartet).
  useEffect(() => {
    setFrames((list) => (list.some((frame) => frame.version === version) ? list : [...list.filter((frame) => frame.shown).slice(-1), { version, shown: false }]));
    const timer = window.setTimeout(() => show(version), SWAP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [version]);

  useEffect(() => {
    const visible = () => [...frames].reverse().find((frame) => frame.shown)?.version;
    const onMessage = (event: MessageEvent) => {
      const entry = [...elements.current].find(([, element]) => element.contentWindow === event.source);
      if (!entry) return;
      const [frameVersion, element] = entry;
      const message = parseBridgeMessage(event.data);
      if (!message) return;
      const isVisible = frameVersion === visible();
      const waiting = !isVisible && frames.some((frame) => frame.version === frameVersion && !frame.shown);
      if (message.typ === "bereit") {
        element.contentWindow?.postMessage(themeMessage(actions.current.resolved), "*");
        element.contentWindow?.postMessage(editMessage(actions.current.onEditBaustein !== undefined), "*");
        if (waiting && !actions.current.fitContent) {
          // Erst an die alte Stelle scrollen, dann zeigen (sobald die Seite die Position bestätigt).
          if (scrollY.current > 0) {
            element.contentWindow?.postMessage(scrollMessage(scrollY.current), "*");
            window.setTimeout(() => show(frameVersion), SCROLL_CONFIRM_MS);
          } else window.setTimeout(() => show(frameVersion), 30);
        }
      } else if (message.typ === "groesse") {
        if (isVisible || waiting) setHeight(message.hoehe);
        if (waiting && actions.current.fitContent) show(frameVersion);
      } else if (message.typ === "position") {
        if (isVisible) scrollY.current = message.y;
        else if (waiting && !actions.current.fitContent && Math.abs(message.y - scrollY.current) <= 2) show(frameVersion);
      } else if (isVisible && message.typ === "bearbeiten" && userIsActive()) {
        actions.current.onEditBaustein?.(message.index, message.art, message.anzahl);
      } else if (isVisible && message.typ === "haekchen" && userIsActive()) {
        actions.current.onToggleCheckbox?.(message.index, message.an);
      } else if (isVisible && message.typ === "link") actions.current.onOpenLink(message.pfad);
      else if (isVisible && message.typ === "extern") actions.current.onOpenExternal(message.url);
      else if (isVisible && message.typ === "taste") {
        // Tastenkürzel der App: wie ein Tastendruck im App-Fenster behandeln.
        window.dispatchEvent(new KeyboardEvent("keydown", { key: message.taste, ctrlKey: true, shiftKey: message.umschalt, bubbles: true }));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frames]);

  // Hell/Dunkel an alle geladenen Fassungen weitergeben.
  useEffect(() => {
    for (const element of elements.current.values()) element.contentWindow?.postMessage(themeMessage(resolved), "*");
  }, [resolved]);

  return (
    <div className={cx("html-preview", fitContent ? "is-fit" : "is-fixed")} style={fitContent && height !== null ? { height: Math.max(height, 120) } : undefined}>
      {frames.map((frame) => (
        <iframe
          key={`${path}#${frame.version}`}
          ref={(element) => {
            if (element) elements.current.set(frame.version, element);
            else elements.current.delete(frame.version);
          }}
          className={cx("html-frame", !frame.shown && "is-loading")}
          title={`HTML-Seite „${title}“`}
          aria-hidden={frame.shown ? undefined : true}
          tabIndex={frame.shown ? undefined : -1}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          src={pageUrl(path, frame.version)}
        />
      ))}
    </div>
  );
}
