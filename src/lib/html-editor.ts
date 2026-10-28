// Was der Code-Editor einer HTML-Seite zeigt und wie daraus wieder die Datei wird.
// Der Editor bekommt nur einen Ausschnitt: den Inhalt von <main> oder die ganze Datei (ohne BOM). Beim Speichern
// wird die Datei aus dem unveränderten Anfang, dem Editor-Text und dem unveränderten Ende zusammengesetzt.
// So bleibt alles, was der Nutzer nicht bearbeitet, Zeichen für Zeichen gleich – auch Zeilenenden und BOM.
// Es wird nichts geparst und neu geschrieben: Auch fehlerhaftes HTML geht nie verloren.
// Dazu die Bedien-Einstellungen dieses Geräts (App-Speicher, nicht im Vault): Ansicht, Seite des Code-Editors und
// Teilungsverhältnis in „Geteilt“.
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { useSyncExternalStore } from "react";

export interface EditorSplit {
  /** Unveränderter Anfang der Datei (bei "ganze Datei" nur ein BOM). */
  prefix: string;
  /** Was der Editor zeigt. */
  body: string;
  /** Unveränderter Rest der Datei. */
  suffix: string;
  /** Zeigt der Editor nur den Inhalt von <main>? */
  mainOnly: boolean;
  /** Zeilenende im Editor: so bleiben CRLF-Dateien (und gemischte) beim Speichern unverändert. */
  lineBreak: "\r\n" | "\n";
}

type ParentNode = DefaultTreeAdapterTypes.ParentNode;
type Element = DefaultTreeAdapterTypes.Element;

function findMain(node: ParentNode): Element | undefined {
  for (const child of node.childNodes) {
    if (!("tagName" in child)) continue;
    if (child.tagName === "main") return child;
    const found = findMain(child);
    if (found) return found;
  }
  return undefined;
}

/** Bereich des Inhalts von <main> (zwischen Start- und End-Tag). null, wenn <main> fehlt oder nicht geschlossen ist. */
export function mainContentRange(html: string): { start: number; end: number } | null {
  const offset = html.startsWith("﻿") ? 1 : 0;
  const main = findMain(parse(html.slice(offset), { sourceCodeLocationInfo: true }));
  const location = main?.sourceCodeLocation;
  if (!location?.startTag || !location.endTag) return null;
  // parse5 erfindet für fehlende Tags keine Positionen; das End-Tag muss wirklich "</main" sein.
  const end = offset + location.endTag.startOffset;
  if (!/^<\/main/i.test(html.slice(end, end + 6))) return null;
  return { start: offset + location.startTag.endOffset, end };
}

/** Teilt den Dateiinhalt für den Editor auf. `wholeFile`: ganze Datei statt nur <main>. */
export function splitForEditor(text: string, wholeFile: boolean): EditorSplit {
  const lineBreak = text.includes("\r\n") ? "\r\n" : "\n";
  const bom = text.startsWith("﻿") ? "﻿" : "";
  const range = wholeFile ? null : mainContentRange(text);
  if (!range) return { prefix: bom, body: text.slice(bom.length), suffix: "", mainOnly: false, lineBreak };
  return { prefix: text.slice(0, range.start), body: text.slice(range.start, range.end), suffix: text.slice(range.end), mainOnly: true, lineBreak };
}

/** Setzt die Datei wieder zusammen: unveränderter Anfang + Editor-Text + unveränderter Rest. */
export function joinFromEditor(split: Pick<EditorSplit, "prefix" | "suffix">, body: string): string {
  return split.prefix + body + split.suffix;
}

export type HtmlViewMode = "lesen" | "code" | "geteilt";

export const HTML_VIEW_MODES: { value: HtmlViewMode; label: string }[] = [
  { value: "lesen", label: "Lesen" },
  { value: "code", label: "Code" },
  { value: "geteilt", label: "Geteilt" },
];

/** Strg+E: Lesen → Code → Geteilt → Lesen. */
export function nextViewMode(mode: HtmlViewMode): HtmlViewMode {
  const index = HTML_VIEW_MODES.findIndex((option) => option.value === mode);
  return HTML_VIEW_MODES[(index + 1) % HTML_VIEW_MODES.length].value;
}

const MODE_KEY = "html-ansicht";

/** Zuletzt gewählte Ansicht (nur Bedienkomfort, nicht im Vault gespeichert). */
export function storedViewMode(): HtmlViewMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    return HTML_VIEW_MODES.some((option) => option.value === stored) ? (stored as HtmlViewMode) : "lesen";
  } catch {
    return "lesen";
  }
}

export function storeViewMode(mode: HtmlViewMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neustart.
  }
}

/** Wo der Code-Editor in „Geteilt“ steht. Auf schmalen Bildschirmen (untereinander) heißt links „oben“. */
export type CodeSeite = "links" | "rechts";

export const CODE_SEITEN: { value: CodeSeite; label: string }[] = [
  { value: "links", label: "Links" },
  { value: "rechts", label: "Rechts" },
];

const SEITE_KEY = "html-code-seite";
/** Nur falls der App-Speicher nicht geht: Dann gilt die Wahl bis zum Neustart. */
let seiteOhneSpeicher: CodeSeite | null = null;
const seitenHoerer = new Set<() => void>();

export function storedCodeSeite(): CodeSeite {
  try {
    return localStorage.getItem(SEITE_KEY) === "rechts" ? "rechts" : "links";
  } catch {
    return seiteOhneSpeicher ?? "links";
  }
}

export function storeCodeSeite(seite: CodeSeite): void {
  try {
    localStorage.setItem(SEITE_KEY, seite);
  } catch {
    seiteOhneSpeicher = seite;
  }
  seitenHoerer.forEach((hoerer) => hoerer());
}

/** Seite des Code-Editors; eine Änderung (Einstellungen, Knopf „Seiten tauschen“) wirkt sofort überall. */
export function useCodeSeite(): [CodeSeite, (seite: CodeSeite) => void] {
  const seite = useSyncExternalStore(
    (hoerer) => {
      seitenHoerer.add(hoerer);
      return () => seitenHoerer.delete(hoerer);
    },
    storedCodeSeite,
    () => "links" as const,
  );
  return [seite, storeCodeSeite];
}

/** Jede Seite in „Geteilt“ bleibt mindestens so breit (px, wie --split-pane-min-width in tokens.css). */
export const GETEILT_MIN_PX = 280;
export const GETEILT_STANDARD = 0.5;
const ANTEIL_KEY = "html-geteilt-anteil";

/** Gemerkter Anteil des Code-Editors an der Breite (0 … 1); fehlt er oder ist er kaputt, gilt 50 : 50. */
export function storedAnteil(): number {
  try {
    const wert = Number(localStorage.getItem(ANTEIL_KEY));
    return wert > 0 && wert < 1 ? wert : GETEILT_STANDARD;
  } catch {
    return GETEILT_STANDARD;
  }
}

export function storeAnteil(anteil: number): void {
  try {
    localStorage.setItem(ANTEIL_KEY, String(Math.round(anteil * 1000) / 1000));
  } catch {
    // Ohne Speicher gilt das Verhältnis nur bis zum Neustart.
  }
}

/**
 * Begrenzt den Anteil des Code-Editors so, dass beide Seiten mindestens `minPx` breit bleiben. `breite` ist der
 * Platz für beide Seiten (ohne Trennlinie). Reicht er dafür nicht, gilt 50 : 50.
 */
export function begrenzeAnteil(anteil: number, breite: number, minPx = GETEILT_MIN_PX): number {
  if (!Number.isFinite(anteil) || !(breite >= 2 * minPx)) return GETEILT_STANDARD;
  const min = minPx / breite;
  return Math.min(1 - min, Math.max(min, anteil));
}

/** Anteil des Code-Editors, wenn die Mitte der Trennlinie bei `x` steht (`links`, `breite`: die ganze Fläche). */
export function anteilAusZeiger(x: number, links: number, breite: number, dicke: number, seite: CodeSeite): number {
  const linkerAnteil = (x - links - dicke / 2) / (breite - dicke);
  return seite === "links" ? linkerAnteil : 1 - linkerAnteil;
}

/**
 * Tastatur an der Trennlinie, bezogen auf die sichtbare Linie: ←/→ verschieben sie um 2 % (mit Umschalt um 10 %),
 * Pos1/Ende ganz nach links/rechts, Enter setzt auf 50 : 50. Ist der Code rechts, macht ← ihn also breiter.
 * Liefert null für andere Tasten.
 */
export function anteilNachTaste(anteil: number, taste: string, umschalt: boolean, seite: CodeSeite): number | null {
  const richtung = seite === "links" ? 1 : -1;
  const schritt = umschalt ? 0.1 : 0.02;
  switch (taste) {
    case "ArrowLeft":
      return anteil - richtung * schritt;
    case "ArrowRight":
      return anteil + richtung * schritt;
    case "Home":
      return seite === "links" ? 0 : 1;
    case "End":
      return seite === "links" ? 1 : 0;
    case "Enter":
      return GETEILT_STANDARD;
    default:
      return null;
  }
}
