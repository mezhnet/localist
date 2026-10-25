// Katalog der Bausteine für HTML-Seiten (Markup nach dem Speicherformat in CLAUDE.md) und das Einfügen in den
// Code-Editor: Werkzeugleiste und „/“-Menü fügen eine Vorlage sauber eingerückt an der Cursorposition ein.
// Die Autovervollständigung kennt die Tags und Klassen der Bausteine (BAUSTEIN_TAGS, BAUSTEIN_KLASSEN).

export type BausteinArt = "callout" | "toggle" | "tabelle" | "checkliste" | "spalten" | "bild" | "trennlinie" | "code" | "seitenlink";

export interface VorlagenWerte {
  /** Bild: Pfad relativ zur Seite (schon kodiert). */
  src?: string;
  /** Seitenlink: Ziel relativ zur Seite (schon kodiert) und angezeigter Titel. */
  href?: string;
  titel?: string;
}

export interface BausteinInfo {
  art: BausteinArt;
  name: string;
  beschreibung: string;
  /** Zeilen der Vorlage, eingerückt mit zwei Leerzeichen je Ebene. */
  vorlage: (werte: VorlagenWerte) => string[];
  /** Dieser Text ist nach dem Einfügen markiert, damit man gleich lostippen kann. */
  auswahl?: string;
  /** Vor dem Einfügen ein Bild bzw. eine Seite auswählen. */
  ziel?: "bild" | "seite";
}

const attr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const text = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const BAUSTEINE: readonly BausteinInfo[] = [
  {
    art: "callout",
    name: "Callout",
    beschreibung: "Farbige Box für Hinweise, Tipps und Warnungen",
    vorlage: () => ['<l-callout typ="info">Text</l-callout>'],
    auswahl: "Text",
  },
  {
    art: "toggle",
    name: "Toggle",
    beschreibung: "Aufklappbarer Abschnitt mit Titel",
    vorlage: () => ["<details>", "  <summary>Titel</summary>", "  <p>Inhalt</p>", "</details>"],
    auswahl: "Titel",
  },
  {
    art: "tabelle",
    name: "Tabelle",
    beschreibung: "Tabelle mit Überschriftenzeile",
    vorlage: () => ["<table>", "  <tr><th>Spalte 1</th><th>Spalte 2</th></tr>", "  <tr><td>Wert</td><td>Wert</td></tr>", "</table>"],
    auswahl: "Spalte 1",
  },
  {
    art: "checkliste",
    name: "Checkliste",
    beschreibung: "Liste zum Abhaken",
    vorlage: () => ['<ul class="l-checkliste">', '  <li><input type="checkbox"> Erster Punkt</li>', '  <li><input type="checkbox"> Zweiter Punkt</li>', "</ul>"],
    auswahl: "Erster Punkt",
  },
  {
    art: "spalten",
    name: "Spalten",
    beschreibung: "Zwei Spalten nebeneinander",
    vorlage: () => ["<l-spalten>", "  <l-spalte>", "    <p>Linke Spalte</p>", "  </l-spalte>", "  <l-spalte>", "    <p>Rechte Spalte</p>", "  </l-spalte>", "</l-spalten>"],
    auswahl: "Linke Spalte",
  },
  {
    art: "bild",
    name: "Bild",
    beschreibung: "Bild aus dem Vault mit Bildunterschrift",
    vorlage: ({ src = "" }) => ["<figure>", `  <img src="${attr(src)}" alt="Beschreibung">`, "  <figcaption>Bildunterschrift</figcaption>", "</figure>"],
    auswahl: "Bildunterschrift",
    ziel: "bild",
  },
  {
    art: "trennlinie",
    name: "Trennlinie",
    beschreibung: "Waagerechte Linie zwischen Abschnitten",
    vorlage: () => ["<hr>"],
  },
  {
    art: "code",
    name: "Code-Block",
    beschreibung: "Programmcode in Festbreitenschrift",
    vorlage: () => ['<pre><code class="language-text">Code</code></pre>'],
    auswahl: "Code",
  },
  {
    art: "seitenlink",
    name: "Seitenlink",
    beschreibung: "Verweis auf eine andere Seite im Vault",
    vorlage: ({ href = "", titel = "" }) => [`<a class="l-seitenlink" href="${attr(href)}">${text(titel)}</a>`],
    ziel: "seite",
  },
];

export function bausteinInfo(art: BausteinArt): BausteinInfo {
  return BAUSTEINE.find((info) => info.art === art)!;
}

/** Tags der Bausteine für die Autovervollständigung (Format von @codemirror/lang-html, `extraTags`). */
export const BAUSTEIN_TAGS: Record<string, { attrs?: Record<string, readonly string[] | null>; children?: readonly string[] }> = {
  "l-callout": { attrs: { typ: ["info", "tipp", "warnung", "fehler"] } },
  "l-spalten": { children: ["l-spalte"] },
  "l-spalte": {},
};

/** Klassen der Bausteine für die Autovervollständigung von `class="…"`. */
export const BAUSTEIN_KLASSEN: readonly string[] = ["l-checkliste", "l-seitenlink", "language-html", "language-css", "language-js", "language-text"];

export interface EinfuegePlan {
  /** Ersetzter Bereich (Positionen zählen ein Zeilenende als ein Zeichen, wie CodeMirror). */
  from: number;
  to: number;
  /** Eingefügter Text mit "\n" als Zeilenende (der Editor setzt das Zeilenende der Datei ein). */
  insert: string;
  /** Danach markierter Bereich (oder Cursor ans Ende des Bausteins). */
  anchor: number;
  head: number;
}

/**
 * Plant das Einfügen einer Vorlage in `doc` (Zeilenende "\n") an Position `pos`:
 * - leere Zeile: der Baustein ersetzt sie, mit der Einrückung dieser Zeile;
 * - Cursor vor dem Text einer Zeile: der Baustein kommt darüber;
 * - Cursor am Zeilenende: darunter;
 * - mitten im Text: die Zeile wird geteilt, der Baustein steht dazwischen.
 * Folgezeilen der Vorlage bekommen die Einrückung der aktuellen Zeile.
 */
export function planInsert(doc: string, pos: number, vorlage: readonly string[], auswahl?: string): EinfuegePlan {
  const lineStart = doc.lastIndexOf("\n", pos - 1) + 1;
  const newline = doc.indexOf("\n", pos);
  const lineEnd = newline === -1 ? doc.length : newline;
  const line = doc.slice(lineStart, lineEnd);
  const indent = /^[ \t]*/.exec(line)![0];
  const before = doc.slice(lineStart, pos);
  const after = doc.slice(pos, lineEnd);
  const block = vorlage.map((row, i) => (i === 0 || row === "" ? row : indent + row)).join("\n");

  let from: number;
  let to: number;
  let insert: string;
  let blockStart: number;
  if (line.trim() === "") {
    from = lineStart;
    to = lineEnd;
    insert = indent + block;
    blockStart = from + indent.length;
  } else if (before.trim() === "") {
    from = to = lineStart + indent.length;
    insert = `${block}\n${indent}`;
    blockStart = from;
  } else if (after.trim() === "") {
    from = to = lineEnd;
    insert = `\n${indent}${block}`;
    blockStart = from + 1 + indent.length;
  } else {
    from = pos - (/[ \t]*$/.exec(before)![0].length);
    to = pos + /^[ \t]*/.exec(after)![0].length;
    insert = `\n${indent}${block}\n${indent}`;
    blockStart = from + 1 + indent.length;
  }
  const found = auswahl ? block.indexOf(auswahl) : -1;
  if (found === -1) return { from, to, insert, anchor: blockStart + block.length, head: blockStart + block.length };
  return { from, to, insert, anchor: blockStart + found, head: blockStart + found + auswahl!.length };
}

/** Wendet einen Plan auf einen Text an (für Tests und ohne Editor). */
export function applyPlan(doc: string, plan: EinfuegePlan): string {
  return doc.slice(0, plan.from) + plan.insert + doc.slice(plan.to);
}
