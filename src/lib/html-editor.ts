// Was der Code-Editor einer HTML-Seite zeigt und wie daraus wieder die Datei wird.
// Der Editor bekommt nur einen Ausschnitt: den Inhalt von <main> oder die ganze Datei (ohne BOM). Beim Speichern
// wird die Datei aus dem unveränderten Anfang, dem Editor-Text und dem unveränderten Ende zusammengesetzt.
// So bleibt alles, was der Nutzer nicht bearbeitet, Zeichen für Zeichen gleich – auch Zeilenenden und BOM.
// Es wird nichts geparst und neu geschrieben: Auch fehlerhaftes HTML geht nie verloren.
import { parse, type DefaultTreeAdapterTypes } from "parse5";

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
