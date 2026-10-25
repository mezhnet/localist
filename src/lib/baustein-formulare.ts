// Bausteine in HTML-Seiten ohne Code bearbeiten: die Stelle eines Bausteins in der Datei finden (gleiche
// Auswahl und Reihenfolge wie das Brücken-Skript im iframe), seine Werte für ein Formular lesen und nur die
// geänderten Teile zurückschreiben. Außerdem Häkchen in Checklisten setzen. Alles über die Quellpositionen
// von parse5: Der Rest der Datei bleibt Zeichen für Zeichen gleich (auch Zeilenenden und BOM).
import type { BausteinArt } from "./bausteine";
import { applyEdits, attr, escapeAttribute, escapeText, isElement, lineEnding, parseWithPositions, textContent, type Edit, type Element, type Node, type ParentNode } from "./html";

/** Gleiche Auswahl wie im Brücken-Skript (src-tauri/seite/bruecke.js, Variablen BAUSTEINE und HAEKCHEN). */
export const BAUSTEIN_SELEKTOR =
  "l-callout, details, table, ul.l-checkliste, l-spalten, figure, hr, pre, a.l-seitenlink, l-karteikarte, l-kartenstapel, l-quiz, l-diagramm";
export const HAEKCHEN_SELEKTOR = 'ul.l-checkliste input[type="checkbox"]';

/** Text eines Feldes im Formular. `html`: Der Inhalt enthält Markup und wird als HTML gezeigt und gespeichert. */
export interface Inhalt {
  wert: string;
  html: boolean;
}

export interface Checkpunkt {
  /** Nummer des Punkts in der Datei (null: neu hinzugefügt). */
  quelle: number | null;
  an: boolean;
  text: Inhalt;
}

export interface Tabellenzeile {
  quelle: number | null;
  zellen: Inhalt[];
}

export interface Spalte {
  quelle: number | null;
  inhalt: Inhalt;
}

/** Daten einer Tabelle (auch die Daten eines Diagramms). */
export interface TabellenWerte {
  kopfzeile: boolean;
  zeilen: Tabellenzeile[];
  /** Nummer der Spalte in der Datei je Spalte im Formular (null: neu). */
  spalten: (number | null)[];
}

export interface Karte {
  quelle: number | null;
  frage: Inhalt;
  antwort: Inhalt;
}

export interface Quizantwort {
  quelle: number | null;
  text: Inhalt;
  richtig: boolean;
}

export interface Quizfrage {
  quelle: number | null;
  frage: Inhalt;
  antworten: Quizantwort[];
}

export type BausteinWerte =
  | { art: "callout"; typ: string; text: Inhalt }
  | { art: "toggle"; titel: Inhalt; inhalt: Inhalt; offen: boolean }
  | ({ art: "tabelle" } & TabellenWerte)
  | { art: "checkliste"; punkte: Checkpunkt[] }
  | { art: "spalten"; spalten: Spalte[] }
  | { art: "bild"; src: string; alt: string; beschriftung: Inhalt }
  | { art: "trennlinie" }
  | { art: "code"; sprache: string; code: string }
  | { art: "seitenlink"; href: string; text: Inhalt }
  | { art: "karteikarte"; frage: Inhalt; antwort: Inhalt }
  | { art: "kartenstapel"; karten: Karte[] }
  | { art: "quiz"; fragen: Quizfrage[] }
  | { art: "diagramm"; typ: string; titel: string; daten: TabellenWerte };

export const LEER: Inhalt = { wert: "", html: false };

// ---------------------------------------------------------------------------
// Bausteine in der Datei finden

interface Gefunden {
  art: BausteinArt;
  element: Element;
}

interface Seite {
  html: string;
  /** Länge eines BOM (Positionen von parse5 zählen ohne BOM). */
  offset: number;
  eol: string;
  bausteine: Gefunden[];
  haekchen: Element[];
}

const hasClass = (element: Element, name: string) => (attr(element, "class") ?? "").split(/\s+/).includes(name);

/** Wie `querySelectorAll`: in Dokument-Reihenfolge, nicht in den Inhalt von <template>. */
function* elements(node: ParentNode): Generator<Element> {
  for (const child of node.childNodes) {
    if (isElement(child)) {
      yield child;
      yield* elements(child);
    }
  }
}

function children(element: Element, tag?: string): Element[] {
  return element.childNodes.filter((child): child is Element => isElement(child) && (tag === undefined || child.tagName === tag));
}

export function bausteinArt(element: Element): BausteinArt | null {
  switch (element.tagName) {
    case "l-callout":
      return "callout";
    case "details":
      return "toggle";
    case "table":
      return "tabelle";
    case "ul":
      return hasClass(element, "l-checkliste") ? "checkliste" : null;
    case "l-spalten":
      return "spalten";
    case "figure":
      return "bild";
    case "hr":
      return "trennlinie";
    case "pre":
      return "code";
    case "a":
      return hasClass(element, "l-seitenlink") ? "seitenlink" : null;
    case "l-karteikarte":
      return "karteikarte";
    case "l-kartenstapel":
      return "kartenstapel";
    case "l-quiz":
      return "quiz";
    case "l-diagramm":
      return "diagramm";
    default:
      return null;
  }
}

/** Hat das Element einen Vorfahren, auf den `test` zutrifft? */
function hatVorfahre(element: Element, test: (vorfahre: Element) => boolean): boolean {
  for (let parent = element.parentNode; parent && isElement(parent as Node); parent = (parent as Element).parentNode) {
    if (test(parent as Element)) return true;
  }
  return false;
}

const inCheckliste = (element: Element) => hatVorfahre(element, (vorfahre) => vorfahre.tagName === "ul" && hasClass(vorfahre, "l-checkliste"));

/** Die Tabelle eines Diagramms gehört zum Diagramm und ist kein eigener Baustein (wie im Brücken-Skript). */
const zaehltAlsBaustein = (element: Element, art: BausteinArt) => art !== "tabelle" || !hatVorfahre(element, (vorfahre) => vorfahre.tagName === "l-diagramm");

function lesen(html: string): Seite {
  const { document, offset } = parseWithPositions(html);
  // Bereich wie im iframe: das erste <main>, sonst <body>.
  const all = [...elements(document)];
  const bereich = all.find((element) => element.tagName === "main") ?? all.find((element) => element.tagName === "body");
  const bausteine: Gefunden[] = [];
  const haekchen: Element[] = [];
  if (bereich) {
    for (const element of elements(bereich)) {
      const art = bausteinArt(element);
      if (art && zaehltAlsBaustein(element, art)) bausteine.push({ art, element });
      if (element.tagName === "input" && (attr(element, "type") ?? "").toLowerCase() === "checkbox" && inCheckliste(element)) haekchen.push(element);
    }
  }
  return { html, offset, eol: lineEnding(html), bausteine, haekchen };
}

export function bausteinAnzahl(html: string): number {
  return lesen(html).bausteine.length;
}

// ---------------------------------------------------------------------------
// Positionen und kleine Änderungen

/** Innenbereich eines Elements (zwischen Start- und End-Tag), Positionen ohne BOM. */
function innen(element: Element): { from: number; to: number } | null {
  const location = element.sourceCodeLocation;
  if (!location?.startTag) return null;
  if (location.endTag) return { from: location.startTag.endOffset, to: location.endTag.startOffset };
  // Ohne End-Tag (z. B. <li> ohne </li>): bis zum Ende des letzten Kindes.
  const ends = element.childNodes.map((child) => child.sourceCodeLocation?.endOffset ?? 0);
  return { from: location.startTag.endOffset, to: Math.max(location.startTag.endOffset, ...ends) };
}

/** Einrückung der Zeile, in der `position` (mit BOM) steht. */
function einzugAn(html: string, position: number): string {
  const lineStart = html.lastIndexOf("\n", position - 1) + 1;
  return /^[ \t]*/.exec(html.slice(lineStart))![0];
}

/** Steht das Element allein auf seiner Zeile? Dann gilt deren Einrückung, sonst die übliche Einrückung + 2. */
function kindEinzug(seite: Seite, kind: Element | undefined, fallback: string): string {
  const start = kind?.sourceCodeLocation?.startOffset;
  if (start === undefined) return fallback;
  const abs = seite.offset + start;
  const lineStart = seite.html.lastIndexOf("\n", abs - 1) + 1;
  const before = seite.html.slice(lineStart, abs);
  return /^[ \t]*$/.test(before) ? before : fallback;
}

/** Setzt, ändert oder entfernt (null) ein Attribut im Start-Tag. `bool`: Attribut ohne Wert (z. B. checked). */
function attrEdit(seite: Seite, element: Element, name: string, value: string | null, bool = false): Edit | null {
  const location = element.sourceCodeLocation;
  if (!location?.startTag) return null;
  const current = attr(element, name);
  const existing = location.attrs?.[name];
  if (value === null) {
    if (current === undefined || !existing) return null;
    let start = seite.offset + existing.startOffset;
    while (start > 0 && /[ \t\r\n]/.test(seite.html[start - 1])) start--;
    return { start, end: seite.offset + existing.endOffset, text: "" };
  }
  if (current === value) return null;
  const text = bool ? name : `${name}="${escapeAttribute(value)}"`;
  if (existing) return { start: seite.offset + existing.startOffset, end: seite.offset + existing.endOffset, text };
  const tagEnd = seite.offset + location.startTag.endOffset;
  const at = tagEnd - (seite.html.slice(0, tagEnd).endsWith("/>") ? 2 : 1);
  return { start: at, end: at, text: ` ${text}` };
}

/** Entfernt ein Element; steht es allein auf seiner Zeile, verschwindet die ganze Zeile. */
function entfernenEdit(seite: Seite, element: Element): Edit {
  const location = element.sourceCodeLocation!;
  let start = seite.offset + location.startOffset;
  let end = seite.offset + location.endOffset;
  const lineStart = seite.html.lastIndexOf("\n", start - 1) + 1;
  const rest = /^[ \t]*(\r?\n|$)/.exec(seite.html.slice(end));
  if (/^[ \t]*$/.test(seite.html.slice(lineStart, start)) && rest) {
    start = lineStart;
    end += rest[0].length;
  }
  return { start, end, text: "" };
}

const roh = (seite: Seite, element: Element) => {
  const location = element.sourceCodeLocation!;
  return seite.html.slice(seite.offset + location.startOffset, seite.offset + location.endOffset);
};

const startTag = (seite: Seite, element: Element) => {
  const tag = element.sourceCodeLocation!.startTag!;
  return seite.html.slice(seite.offset + tag.startOffset, seite.offset + tag.endOffset);
};

// ---------------------------------------------------------------------------
// Inhalte (Text oder HTML)

/** Gemeinsame Einrückung der Folgezeilen entfernen. */
function dedent(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const rest = lines.slice(1).filter((line) => line.trim() !== "");
  const common = rest.length === 0 ? 0 : Math.min(...rest.map((line) => /^[ \t]*/.exec(line)![0].length));
  return [lines[0], ...lines.slice(1).map((line) => line.slice(Math.min(common, /^[ \t]*/.exec(line)![0].length)))].join("\n");
}

/** Liest Knoten als Formularwert: reiner Text (Zeilenumbrüche aus <br>) oder, sobald Markup drin ist, HTML. */
function inhaltLesen(seite: Seite, nodes: Node[], from: number, to: number): Inhalt {
  const plain = nodes.every(
    (node) => node.nodeName === "#text" || (isElement(node) && node.tagName === "br" && node.attrs.length === 0 && node.childNodes.length === 0),
  );
  if (plain) {
    const text = nodes.map((node) => (node.nodeName === "#text" && "value" in node ? node.value.replace(/\s+/g, " ") : "\n")).join("");
    return { wert: text.split("\n").map((line) => line.trim()).join("\n").trim(), html: false };
  }
  return { wert: dedent(seite.html.slice(seite.offset + from, seite.offset + to)).trim(), html: true };
}

function inhaltVon(seite: Seite, element: Element | undefined): Inhalt {
  const range = element && innen(element);
  return element && range ? inhaltLesen(seite, element.childNodes, range.from, range.to) : LEER;
}

const gleich = (a: Inhalt, b: Inhalt) => a.wert === b.wert && a.html === b.html;

/** Wert für die Datei: Text wird maskiert (Zeilen mit <br>), HTML bleibt wie eingegeben. */
function kodieren(inhalt: Inhalt, eol: string, einzug: string): string {
  const lines = inhalt.wert.split("\n");
  if (inhalt.html) return lines.map((line, i) => (i === 0 || line === "" ? line : einzug + line)).join(eol);
  return lines.map(escapeText).join(`<br>${eol}${einzug}`);
}

/** Ersetzt den Bereich [from, to) durch einen neuen Inhalt; Leerraum davor und danach bleibt. */
function inhaltEdit(seite: Seite, from: number, to: number, neu: Inhalt, alt: Inhalt): Edit | null {
  if (gleich(neu, alt)) return null;
  const raw = seite.html.slice(seite.offset + from, seite.offset + to);
  const blank = raw.trim() === "";
  const lead = blank ? "" : /^\s*/.exec(raw)![0];
  const trail = blank ? "" : /\s*$/.exec(raw)![0];
  const einzug = lead.includes("\n") ? lead.slice(lead.lastIndexOf("\n") + 1) : einzugAn(seite.html, seite.offset + from);
  const body = kodieren(neu, seite.eol, einzug);
  return { start: seite.offset + from, end: seite.offset + to, text: body === "" ? "" : lead + body + trail };
}

function inhaltEditVon(seite: Seite, element: Element, neu: Inhalt, alt: Inhalt): Edit | null {
  const range = innen(element);
  return range ? inhaltEdit(seite, range.from, range.to, neu, alt) : null;
}

// ---------------------------------------------------------------------------
// Werte lesen

function tabellenZeilen(table: Element): Element[] {
  const rows: Element[] = [];
  for (const child of children(table)) {
    if (child.tagName === "tr") rows.push(child);
    else if (child.tagName === "thead" || child.tagName === "tbody" || child.tagName === "tfoot") rows.push(...children(child, "tr"));
  }
  return rows;
}

const zellen = (row: Element) => children(row).filter((cell) => cell.tagName === "th" || cell.tagName === "td");

function checkPunkte(ul: Element): { li: Element; input: Element | undefined }[] {
  return children(ul, "li").map((li) => ({ li, input: children(li, "input").find((input) => (attr(input, "type") ?? "").toLowerCase() === "checkbox") }));
}

/** Text eines Checklisten-Punkts: alles nach dem Kästchen. */
function punktBereich(punkt: { li: Element; input: Element | undefined }): { nodes: Node[]; from: number; to: number } | null {
  const range = innen(punkt.li);
  if (!range) return null;
  if (!punkt.input?.sourceCodeLocation) return { nodes: punkt.li.childNodes, ...range };
  const index = punkt.li.childNodes.indexOf(punkt.input);
  return { nodes: punkt.li.childNodes.slice(index + 1), from: punkt.input.sourceCodeLocation.endOffset, to: range.to };
}

function toggleBereich(details: Element): { summary: Element | undefined; nodes: Node[]; from: number; to: number } | null {
  const range = innen(details);
  if (!range) return null;
  const summary = children(details, "summary")[0];
  if (!summary?.sourceCodeLocation) return { summary: undefined, nodes: details.childNodes, ...range };
  const index = details.childNodes.indexOf(summary);
  return { summary, nodes: details.childNodes.slice(index + 1), from: summary.sourceCodeLocation.endOffset, to: range.to };
}

const codeElement = (pre: Element) => children(pre, "code")[0] ?? pre;
const sprachKlasse = (element: Element) => (attr(element, "class") ?? "").split(/\s+/).find((name) => name.startsWith("language-"));

function tabellenWerte(seite: Seite, table: Element | undefined): TabellenWerte {
  const rows = table ? tabellenZeilen(table) : [];
  const breite = Math.max(0, ...rows.map((row) => zellen(row).length));
  return {
    kopfzeile: rows.length > 0 && zellen(rows[0]).length > 0 && zellen(rows[0]).every((cell) => cell.tagName === "th"),
    zeilen: rows.map((row, r) => ({ quelle: r, zellen: Array.from({ length: breite }, (_, c) => inhaltVon(seite, zellen(row)[c])) })),
    spalten: Array.from({ length: breite }, (_, c) => c),
  };
}

const quizListe = (frage: Element) => children(frage, "ul")[0] ?? children(frage, "ol")[0];

function werteLesen(seite: Seite, gefunden: Gefunden): BausteinWerte {
  const { element } = gefunden;
  switch (gefunden.art) {
    case "callout":
      return { art: "callout", typ: attr(element, "typ") ?? "info", text: inhaltVon(seite, element) };
    case "toggle": {
      const bereich = toggleBereich(element);
      return {
        art: "toggle",
        titel: inhaltVon(seite, bereich?.summary),
        inhalt: bereich ? inhaltLesen(seite, bereich.nodes, bereich.from, bereich.to) : LEER,
        offen: attr(element, "open") !== undefined,
      };
    }
    case "tabelle":
      return { art: "tabelle", ...tabellenWerte(seite, element) };
    case "checkliste":
      return {
        art: "checkliste",
        punkte: checkPunkte(element).map((punkt, i) => {
          const bereich = punktBereich(punkt);
          return {
            quelle: i,
            an: punkt.input !== undefined && attr(punkt.input, "checked") !== undefined,
            text: bereich ? inhaltLesen(seite, bereich.nodes, bereich.from, bereich.to) : LEER,
          };
        }),
      };
    case "spalten":
      return { art: "spalten", spalten: children(element, "l-spalte").map((spalte, i) => ({ quelle: i, inhalt: inhaltVon(seite, spalte) })) };
    case "bild": {
      const img = [...elements(element)].find((child) => child.tagName === "img");
      return { art: "bild", src: (img && attr(img, "src")) ?? "", alt: (img && attr(img, "alt")) ?? "", beschriftung: inhaltVon(seite, children(element, "figcaption")[0]) };
    }
    case "trennlinie":
      return { art: "trennlinie" };
    case "code": {
      const code = codeElement(element);
      return { art: "code", sprache: sprachKlasse(code)?.slice("language-".length) ?? "", code: textContent(code) };
    }
    case "seitenlink":
      return { art: "seitenlink", href: attr(element, "href") ?? "", text: inhaltVon(seite, element) };
    case "karteikarte":
      return { art: "karteikarte", frage: inhaltVon(seite, children(element, "l-frage")[0]), antwort: inhaltVon(seite, children(element, "l-antwort")[0]) };
    case "kartenstapel":
      return {
        art: "kartenstapel",
        karten: children(element, "l-karteikarte").map((karte, i) => ({
          quelle: i,
          frage: inhaltVon(seite, children(karte, "l-frage")[0]),
          antwort: inhaltVon(seite, children(karte, "l-antwort")[0]),
        })),
      };
    case "quiz":
      return {
        art: "quiz",
        fragen: children(element, "l-quizfrage").map((frage, i) => {
          const liste = quizListe(frage);
          return {
            quelle: i,
            frage: inhaltVon(seite, children(frage, "l-frage")[0]),
            antworten: liste ? children(liste, "li").map((li, j) => ({ quelle: j, text: inhaltVon(seite, li), richtig: attr(li, "data-richtig") !== undefined })) : [],
          };
        }),
      };
    case "diagramm":
      return { art: "diagramm", typ: attr(element, "typ") ?? "balken", titel: attr(element, "titel") ?? "", daten: tabellenWerte(seite, children(element, "table")[0]) };
  }
}

/** Werte des Bausteins Nummer `index` (wie im iframe gezählt) oder null, wenn es ihn nicht gibt. */
export function bausteinLesen(html: string, index: number): BausteinWerte | null {
  const seite = lesen(html);
  const gefunden = seite.bausteine[index];
  return gefunden ? werteLesen(seite, gefunden) : null;
}

// ---------------------------------------------------------------------------
// Werte schreiben

/** Ersetzt das ganze Element (bei geänderter Struktur, z. B. neue Zeilen einer Tabelle). */
function ersetzen(seite: Seite, element: Element, text: string): Edit {
  const location = element.sourceCodeLocation!;
  return { start: seite.offset + location.startOffset, end: seite.offset + location.endOffset, text };
}

function tabelleSchreiben(seite: Seite, table: Element, alt: TabellenWerte, neu: TabellenWerte): Edit[] {
  const rows = tabellenZeilen(table);
  const sameShape =
    neu.kopfzeile === alt.kopfzeile &&
    neu.zeilen.length === rows.length &&
    neu.zeilen.every((zeile, r) => zeile.quelle === r && zellen(rows[r]).length === neu.spalten.length) &&
    neu.spalten.every((quelle, c) => quelle === c) &&
    neu.spalten.length === alt.spalten.length;
  if (sameShape) {
    const edits: Edit[] = [];
    neu.zeilen.forEach((zeile, r) =>
      zeile.zellen.forEach((inhalt, c) => {
        const edit = inhaltEditVon(seite, zellen(rows[r])[c], inhalt, alt.zeilen[r].zellen[c]);
        if (edit) edits.push(edit);
      }),
    );
    return edits;
  }
  // Neu aufbauen; unveränderte Zellen behalten ihren Inhalt wörtlich.
  const einzug = einzugAn(seite.html, seite.offset + table.sourceCodeLocation!.startOffset);
  const teile = children(table).filter((child) => ["thead", "tbody", "tfoot"].includes(child.tagName) && child.sourceCodeLocation);
  const zeilenEinzug = kindEinzug(seite, teile.length > 0 ? teile[0] : rows[0], `${einzug}  `);
  const extra = children(table).filter((child) => (child.tagName === "caption" || child.tagName === "colgroup") && child.sourceCodeLocation);
  const zeileText = (zeile: Tabellenzeile, r: number) => {
    const tag = neu.kopfzeile && r === 0 ? "th" : "td";
    const cells = zeile.zellen.map((inhalt, c) => {
      const quelleZeile = zeile.quelle;
      const quelleSpalte = neu.spalten[c];
      const cell = quelleZeile !== null && quelleSpalte !== null ? zellen(rows[quelleZeile])?.[quelleSpalte] : undefined;
      const range = cell && innen(cell);
      const body =
        cell && range && gleich(inhalt, alt.zeilen[quelleZeile!].zellen[quelleSpalte!])
          ? seite.html.slice(seite.offset + range.from, seite.offset + range.to)
          : kodieren(inhalt, seite.eol, "").replace(/\r?\n[ \t]*/g, " ");
      return `<${tag}>${body}</${tag}>`;
    });
    return `<tr>${cells.join("")}</tr>`;
  };
  const lines = [startTag(seite, table), ...extra.map((child) => `${kindEinzug(seite, child, `${einzug}  `)}${roh(seite, child)}`)];
  if (teile.length > 0) {
    const kopf = neu.kopfzeile ? neu.zeilen.slice(0, 1) : [];
    const rumpf = neu.kopfzeile ? neu.zeilen.slice(1) : neu.zeilen;
    if (kopf.length) lines.push(`${zeilenEinzug}<thead>`, `${zeilenEinzug}  ${zeileText(kopf[0], 0)}`, `${zeilenEinzug}</thead>`);
    if (rumpf.length) lines.push(`${zeilenEinzug}<tbody>`, ...rumpf.map((zeile, i) => `${zeilenEinzug}  ${zeileText(zeile, i + kopf.length)}`), `${zeilenEinzug}</tbody>`);
  } else {
    lines.push(...neu.zeilen.map((zeile, r) => `${zeilenEinzug}${zeileText(zeile, r)}`));
  }
  lines.push(`${einzug}</table>`);
  return [ersetzen(seite, table, lines.join(seite.eol))];
}

function checklisteSchreiben(seite: Seite, ul: Element, alt: Extract<BausteinWerte, { art: "checkliste" }>, neu: Extract<BausteinWerte, { art: "checkliste" }>): Edit[] {
  const punkte = checkPunkte(ul);
  const sameShape = neu.punkte.length === punkte.length && neu.punkte.every((punkt, i) => punkt.quelle === i);
  if (sameShape) {
    const edits: Edit[] = [];
    neu.punkte.forEach((punkt, i) => {
      const quelle = punkte[i];
      const bereich = punktBereich(quelle);
      const text = bereich && inhaltEdit(seite, bereich.from, bereich.to, punkt.text, alt.punkte[i].text);
      if (text) edits.push(text);
      if (punkt.an !== alt.punkte[i].an) {
        if (quelle.input) {
          const edit = attrEdit(seite, quelle.input, "checked", punkt.an ? "" : null, true);
          if (edit) edits.push(edit);
        } else {
          const at = seite.offset + innen(quelle.li)!.from;
          edits.push({ start: at, end: at, text: `<input type="checkbox"${punkt.an ? " checked" : ""}> ` });
        }
      }
    });
    return edits;
  }
  const einzug = einzugAn(seite.html, seite.offset + ul.sourceCodeLocation!.startOffset);
  const punktEinzug = kindEinzug(seite, punkte[0]?.li, `${einzug}  `);
  const lines = [
    startTag(seite, ul),
    ...neu.punkte.map((punkt) => {
      const quelle = punkt.quelle === null ? undefined : punkte[punkt.quelle];
      const unverändert = quelle && punkt.an === alt.punkte[punkt.quelle!].an && gleich(punkt.text, alt.punkte[punkt.quelle!].text);
      if (quelle && unverändert && quelle.li.sourceCodeLocation?.endTag) return `${punktEinzug}${roh(seite, quelle.li)}`;
      return `${punktEinzug}<li><input type="checkbox"${punkt.an ? " checked" : ""}> ${kodieren(punkt.text, seite.eol, `${punktEinzug}  `)}</li>`;
    }),
    `${einzug}</ul>`,
  ];
  return [ersetzen(seite, ul, lines.join(seite.eol))];
}

function spaltenSchreiben(seite: Seite, element: Element, alt: Extract<BausteinWerte, { art: "spalten" }>, neu: Extract<BausteinWerte, { art: "spalten" }>): Edit[] {
  const spalten = children(element, "l-spalte");
  const sameShape = neu.spalten.length === spalten.length && neu.spalten.every((spalte, i) => spalte.quelle === i);
  if (sameShape) {
    return neu.spalten.map((spalte, i) => inhaltEditVon(seite, spalten[i], spalte.inhalt, alt.spalten[i].inhalt)).filter((edit): edit is Edit => edit !== null);
  }
  const einzug = einzugAn(seite.html, seite.offset + element.sourceCodeLocation!.startOffset);
  const spaltenEinzug = kindEinzug(seite, spalten[0], `${einzug}  `);
  const eol = seite.eol;
  const lines = [
    startTag(seite, element),
    ...neu.spalten.map((spalte) => {
      const quelle = spalte.quelle === null ? undefined : spalten[spalte.quelle];
      if (quelle?.sourceCodeLocation?.endTag && gleich(spalte.inhalt, alt.spalten[spalte.quelle!].inhalt)) return `${spaltenEinzug}${roh(seite, quelle)}`;
      const innenEinzug = `${spaltenEinzug}  `;
      const body = spalte.inhalt.html ? kodieren(spalte.inhalt, eol, innenEinzug) : `<p>${kodieren(spalte.inhalt, eol, innenEinzug)}</p>`;
      return [`${spaltenEinzug}<l-spalte>`, `${innenEinzug}${body}`, `${spaltenEinzug}</l-spalte>`].join(eol);
    }),
    `${einzug}</l-spalten>`,
  ];
  return [ersetzen(seite, element, lines.join(eol))];
}

function bildSchreiben(seite: Seite, figure: Element, alt: Extract<BausteinWerte, { art: "bild" }>, neu: Extract<BausteinWerte, { art: "bild" }>): Edit[] {
  const edits: (Edit | null)[] = [];
  const img = [...elements(figure)].find((child) => child.tagName === "img");
  const einzug = einzugAn(seite.html, seite.offset + figure.sourceCodeLocation!.startOffset);
  const kind = kindEinzug(seite, img ?? children(figure)[0], `${einzug}  `);
  if (img) {
    if (neu.src !== alt.src) edits.push(attrEdit(seite, img, "src", neu.src));
    if (neu.alt !== alt.alt) edits.push(attrEdit(seite, img, "alt", neu.alt));
  } else if (neu.src) {
    const at = seite.offset + innen(figure)!.from;
    edits.push({ start: at, end: at, text: `${seite.eol}${kind}<img src="${escapeAttribute(neu.src)}" alt="${escapeAttribute(neu.alt)}">` });
  }
  const caption = children(figure, "figcaption")[0];
  if (caption) {
    edits.push(neu.beschriftung.wert === "" && alt.beschriftung.wert !== "" ? entfernenEdit(seite, caption) : inhaltEditVon(seite, caption, neu.beschriftung, alt.beschriftung));
  } else if (neu.beschriftung.wert !== "") {
    const range = innen(figure)!;
    const inner = seite.html.slice(seite.offset + range.from, seite.offset + range.to);
    const at = seite.offset + range.from + inner.trimEnd().length;
    edits.push({ start: at, end: at, text: `${seite.eol}${kind}<figcaption>${kodieren(neu.beschriftung, seite.eol, kind)}</figcaption>` });
  }
  return edits.filter((edit): edit is Edit => edit !== null);
}

function codeSchreiben(seite: Seite, pre: Element, alt: Extract<BausteinWerte, { art: "code" }>, neu: Extract<BausteinWerte, { art: "code" }>): Edit[] {
  const code = codeElement(pre);
  const edits: (Edit | null)[] = [];
  if (neu.code !== alt.code) {
    const range = innen(code);
    if (range) edits.push({ start: seite.offset + range.from, end: seite.offset + range.to, text: escapeText(neu.code).split("\n").join(seite.eol) });
  }
  if (neu.sprache.trim() !== alt.sprache) {
    const classes = (attr(code, "class") ?? "").split(/\s+/).filter((name) => name && !name.startsWith("language-"));
    const sprache = neu.sprache.trim().replace(/\s+/g, "-");
    if (sprache) classes.push(`language-${sprache}`);
    edits.push(attrEdit(seite, code, "class", classes.length ? classes.join(" ") : null));
  }
  return edits.filter((edit): edit is Edit => edit !== null);
}

/** Eine Karteikarte neu schreiben (für neue oder geänderte Karten in einem Stapel). */
function karteText(karte: Karte, einzug: string, eol: string): string {
  return [
    `${einzug}<l-karteikarte>`,
    `${einzug}  <l-frage>${kodieren(karte.frage, eol, `${einzug}    `)}</l-frage>`,
    `${einzug}  <l-antwort>${kodieren(karte.antwort, eol, `${einzug}    `)}</l-antwort>`,
    `${einzug}</l-karteikarte>`,
  ].join(eol);
}

function kartenstapelSchreiben(seite: Seite, stapel: Element, alt: Extract<BausteinWerte, { art: "kartenstapel" }>, neu: Extract<BausteinWerte, { art: "kartenstapel" }>): Edit[] {
  const karten = children(stapel, "l-karteikarte");
  const sameShape = neu.karten.length === karten.length && neu.karten.every((karte, i) => karte.quelle === i);
  if (sameShape) {
    const edits: (Edit | null)[] = [];
    neu.karten.forEach((karte, i) => {
      const frage = children(karten[i], "l-frage")[0];
      const antwort = children(karten[i], "l-antwort")[0];
      if (frage) edits.push(inhaltEditVon(seite, frage, karte.frage, alt.karten[i].frage));
      if (antwort) edits.push(inhaltEditVon(seite, antwort, karte.antwort, alt.karten[i].antwort));
    });
    return edits.filter((edit): edit is Edit => edit !== null);
  }
  // Neu aufbauen; unveränderte Karten bleiben wörtlich erhalten.
  const einzug = einzugAn(seite.html, seite.offset + stapel.sourceCodeLocation!.startOffset);
  const kartenEinzug = kindEinzug(seite, karten[0], `${einzug}  `);
  const lines = [
    startTag(seite, stapel),
    ...neu.karten.map((karte) => {
      const quelle = karte.quelle === null ? undefined : karten[karte.quelle];
      const vorher = karte.quelle === null ? undefined : alt.karten[karte.quelle];
      if (quelle?.sourceCodeLocation?.endTag && vorher && gleich(karte.frage, vorher.frage) && gleich(karte.antwort, vorher.antwort)) return `${kartenEinzug}${roh(seite, quelle)}`;
      return karteText(karte, kartenEinzug, seite.eol);
    }),
    `${einzug}</l-kartenstapel>`,
  ];
  return [ersetzen(seite, stapel, lines.join(seite.eol))];
}

const frageGleich = (a: Quizfrage, b: Quizfrage) =>
  gleich(a.frage, b.frage) &&
  a.antworten.length === b.antworten.length &&
  a.antworten.every((antwort, i) => antwort.quelle === i && gleich(antwort.text, b.antworten[i].text) && antwort.richtig === b.antworten[i].richtig);

function quizSchreiben(seite: Seite, quiz: Element, alt: Extract<BausteinWerte, { art: "quiz" }>, neu: Extract<BausteinWerte, { art: "quiz" }>): Edit[] {
  const fragen = children(quiz, "l-quizfrage");
  const sameShape =
    neu.fragen.length === fragen.length &&
    neu.fragen.every((frage, i) => frage.quelle === i && frage.antworten.length === alt.fragen[i].antworten.length && frage.antworten.every((antwort, j) => antwort.quelle === j));
  if (sameShape) {
    const edits: (Edit | null)[] = [];
    neu.fragen.forEach((frage, i) => {
      const element = children(fragen[i], "l-frage")[0];
      if (element) edits.push(inhaltEditVon(seite, element, frage.frage, alt.fragen[i].frage));
      const liste = quizListe(fragen[i]);
      const optionen = liste ? children(liste, "li") : [];
      frage.antworten.forEach((antwort, j) => {
        const option = optionen[j];
        if (!option) return;
        edits.push(inhaltEditVon(seite, option, antwort.text, alt.fragen[i].antworten[j].text));
        if (antwort.richtig !== alt.fragen[i].antworten[j].richtig) edits.push(attrEdit(seite, option, "data-richtig", antwort.richtig ? "" : null, true));
      });
    });
    return edits.filter((edit): edit is Edit => edit !== null);
  }
  // Neu aufbauen; unveränderte Fragen bleiben wörtlich erhalten.
  const eol = seite.eol;
  const einzug = einzugAn(seite.html, seite.offset + quiz.sourceCodeLocation!.startOffset);
  const frageEinzug = kindEinzug(seite, fragen[0], `${einzug}  `);
  const lines = [
    startTag(seite, quiz),
    ...neu.fragen.map((frage) => {
      const quelle = frage.quelle === null ? undefined : fragen[frage.quelle];
      const vorher = frage.quelle === null ? undefined : alt.fragen[frage.quelle];
      if (quelle?.sourceCodeLocation?.endTag && vorher && frageGleich(frage, vorher)) return `${frageEinzug}${roh(seite, quelle)}`;
      const innen = `${frageEinzug}  `;
      return [
        `${frageEinzug}<l-quizfrage>`,
        `${innen}<l-frage>${kodieren(frage.frage, eol, `${innen}  `)}</l-frage>`,
        `${innen}<ul>`,
        ...frage.antworten.map((antwort) => `${innen}  <li${antwort.richtig ? " data-richtig" : ""}>${kodieren(antwort.text, eol, `${innen}    `)}</li>`),
        `${innen}</ul>`,
        `${frageEinzug}</l-quizfrage>`,
      ].join(eol);
    }),
    `${einzug}</l-quiz>`,
  ];
  return [ersetzen(seite, quiz, lines.join(eol))];
}

function editsFor(seite: Seite, gefunden: Gefunden, alt: BausteinWerte, neu: BausteinWerte): Edit[] {
  const { element } = gefunden;
  const only = (...edits: (Edit | null)[]) => edits.filter((edit): edit is Edit => edit !== null);
  switch (neu.art) {
    case "callout": {
      const vorher = alt as typeof neu;
      return only(neu.typ !== vorher.typ ? attrEdit(seite, element, "typ", neu.typ) : null, inhaltEditVon(seite, element, neu.text, vorher.text));
    }
    case "toggle": {
      const vorher = alt as typeof neu;
      const bereich = toggleBereich(element);
      if (!bereich) return [];
      const edits: Edit[] = only(
        neu.offen !== vorher.offen ? attrEdit(seite, element, "open", neu.offen ? "" : null, true) : null,
        inhaltEdit(seite, bereich.from, bereich.to, neu.inhalt, vorher.inhalt),
      );
      if (bereich.summary) {
        const titel = inhaltEditVon(seite, bereich.summary, neu.titel, vorher.titel);
        if (titel) edits.push(titel);
      } else if (neu.titel.wert !== "") {
        // Zuletzt einfügen: Änderungen an derselben Stelle werden vorher angewendet.
        const at = seite.offset + bereich.from;
        edits.push({ start: at, end: at, text: `<summary>${kodieren(neu.titel, seite.eol, "")}</summary>` });
      }
      return edits;
    }
    case "tabelle":
      return tabelleSchreiben(seite, element, alt as typeof neu, neu);
    case "checkliste":
      return checklisteSchreiben(seite, element, alt as typeof neu, neu);
    case "spalten":
      return spaltenSchreiben(seite, element, alt as typeof neu, neu);
    case "bild":
      return bildSchreiben(seite, element, alt as typeof neu, neu);
    case "trennlinie":
      return [];
    case "code":
      return codeSchreiben(seite, element, alt as typeof neu, neu);
    case "seitenlink": {
      const vorher = alt as typeof neu;
      return only(neu.href !== vorher.href ? attrEdit(seite, element, "href", neu.href) : null, inhaltEditVon(seite, element, neu.text, vorher.text));
    }
    case "karteikarte": {
      const vorher = alt as typeof neu;
      const frage = children(element, "l-frage")[0];
      const antwort = children(element, "l-antwort")[0];
      return only(frage ? inhaltEditVon(seite, frage, neu.frage, vorher.frage) : null, antwort ? inhaltEditVon(seite, antwort, neu.antwort, vorher.antwort) : null);
    }
    case "kartenstapel":
      return kartenstapelSchreiben(seite, element, alt as typeof neu, neu);
    case "quiz":
      return quizSchreiben(seite, element, alt as typeof neu, neu);
    case "diagramm": {
      const vorher = alt as typeof neu;
      const table = children(element, "table")[0];
      return [
        ...only(neu.typ !== vorher.typ ? attrEdit(seite, element, "typ", neu.typ) : null, neu.titel !== vorher.titel ? attrEdit(seite, element, "titel", neu.titel) : null),
        ...(table?.sourceCodeLocation ? tabelleSchreiben(seite, table, vorher.daten, neu.daten) : []),
      ];
    }
  }
}

/**
 * Schreibt die Werte aus dem Formular in den Baustein Nummer `index`. Geändert werden nur die Teile, deren
 * Wert sich geändert hat; ändert sich die Struktur (z. B. neue Tabellenzeile), wird nur dieser Baustein neu
 * aufgebaut. Fehler, wenn der Baustein nicht (mehr) da ist oder eine andere Art hat.
 */
export function bausteinSchreiben(html: string, index: number, neu: BausteinWerte): string {
  const seite = lesen(html);
  const gefunden = seite.bausteine[index];
  if (!gefunden || gefunden.art !== neu.art || !gefunden.element.sourceCodeLocation) throw new Error("Der Baustein wurde in der Datei nicht gefunden.");
  const edits = editsFor(seite, gefunden, werteLesen(seite, gefunden), neu);
  return edits.length === 0 ? html : applyEdits(html, edits);
}

/** Entfernt den Baustein Nummer `index` aus der Datei. */
export function bausteinEntfernen(html: string, index: number): string {
  const seite = lesen(html);
  const gefunden = seite.bausteine[index];
  if (!gefunden?.element.sourceCodeLocation) throw new Error("Der Baustein wurde in der Datei nicht gefunden.");
  return applyEdits(html, [entfernenEdit(seite, gefunden.element)]);
}

/**
 * Setzt oder entfernt das Häkchen Nummer `index` (gezählt wie HAEKCHEN_SELEKTOR im iframe).
 * Liefert null, wenn es das Kästchen in der Datei nicht gibt.
 */
export function haekchenSetzen(html: string, index: number, an: boolean): string | null {
  const seite = lesen(html);
  const input = seite.haekchen[index];
  if (!input?.sourceCodeLocation) return null;
  const edit = attrEdit(seite, input, "checked", an ? "" : null, true);
  return edit ? applyEdits(html, [edit]) : html;
}
