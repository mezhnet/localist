// Katalog der Bausteine für HTML-Seiten (Markup nach dem Speicherformat in CLAUDE.md) und das Einfügen in den
// Code-Editor: Werkzeugleiste und „/“-Menü fügen eine Vorlage sauber eingerückt an der Cursorposition ein.
// Die Autovervollständigung kennt die Tags und Klassen der Bausteine (BAUSTEIN_TAGS, BAUSTEIN_KLASSEN).

export type BausteinArt =
  | "callout"
  | "toggle"
  | "tabelle"
  | "checkliste"
  | "spalten"
  | "bild"
  | "trennlinie"
  | "code"
  | "seitenlink"
  | "karteikarte"
  | "kartenstapel"
  | "quiz"
  | "diagramm";

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
  /** Kurze Erklärung für die Hilfe-Ansicht. */
  hilfe: string;
  /** Beispielcode für Hilfe und Bibliothek. */
  beispiel: string[];
}

const attr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const text = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const BAUSTEINE: readonly BausteinInfo[] = [
  {
    art: "callout",
    hilfe: "Hebt einen Hinweis farbig hervor. Mit typ wählst du die Art: info (blau), tipp (grün), warnung (gelb) oder fehler (rot).",
    beispiel: ["<l-callout typ=\"tipp\">Speichere regelmäßig eine Sicherung deiner Arbeit.</l-callout>"],
    name: "Callout",
    beschreibung: "Farbige Box für Hinweise, Tipps und Warnungen",
    vorlage: () => ['<l-callout typ="info">Text</l-callout>'],
    auswahl: "Text",
  },
  {
    art: "toggle",
    hilfe: "Ein Abschnitt zum Auf- und Zuklappen. Der Titel steht in <summary>, alles danach ist der Inhalt. Mit dem Attribut open ist er anfangs aufgeklappt.",
    beispiel: ["<details>", "  <summary>Mehr erfahren</summary>", "  <p>Dieser Text erscheint erst nach einem Klick auf den Titel.</p>", "</details>"],
    name: "Toggle",
    beschreibung: "Aufklappbarer Abschnitt mit Titel",
    vorlage: () => ["<details>", "  <summary>Titel</summary>", "  <p>Inhalt</p>", "</details>"],
    auswahl: "Titel",
  },
  {
    art: "tabelle",
    hilfe: "Eine normale HTML-Tabelle: <tr> ist eine Zeile, <th> eine Überschrift, <td> eine Zelle. Ohne Code bearbeitest du sie mit dem Tabellen-Editor (Stift-Symbol).",
    beispiel: ["<table>", "  <tr><th>Protokoll</th><th>Port</th></tr>", "  <tr><td>HTTP</td><td>80</td></tr>", "  <tr><td>HTTPS</td><td>443</td></tr>", "</table>"],
    name: "Tabelle",
    beschreibung: "Tabelle mit Überschriftenzeile",
    vorlage: () => ["<table>", "  <tr><th>Spalte 1</th><th>Spalte 2</th></tr>", "  <tr><td>Wert</td><td>Wert</td></tr>", "</table>"],
    auswahl: "Spalte 1",
  },
  {
    art: "checkliste",
    hilfe: "Eine Liste zum Abhaken. checked bedeutet erledigt. In der Ansicht „Lesen“ werden Häkchen direkt in der Datei gespeichert.",
    beispiel: ["<ul class=\"l-checkliste\">", "  <li><input type=\"checkbox\" checked> Vokabeln wiederholen</li>", "  <li><input type=\"checkbox\"> Übungsblatt lösen</li>", "</ul>"],
    name: "Checkliste",
    beschreibung: "Liste zum Abhaken",
    vorlage: () => ['<ul class="l-checkliste">', '  <li><input type="checkbox"> Erster Punkt</li>', '  <li><input type="checkbox"> Zweiter Punkt</li>', "</ul>"],
    auswahl: "Erster Punkt",
  },
  {
    art: "spalten",
    hilfe: "Stellt Inhalte nebeneinander. Jede <l-spalte> ist eine Spalte; auf schmalen Bildschirmen stehen sie untereinander.",
    beispiel: ["<l-spalten>", "  <l-spalte>", "    <p><strong>Vorteile:</strong> schnell und günstig</p>", "  </l-spalte>", "  <l-spalte>", "    <p><strong>Nachteile:</strong> weniger sicher</p>", "  </l-spalte>", "</l-spalten>"],
    name: "Spalten",
    beschreibung: "Zwei Spalten nebeneinander",
    vorlage: () => ["<l-spalten>", "  <l-spalte>", "    <p>Linke Spalte</p>", "  </l-spalte>", "  <l-spalte>", "    <p>Rechte Spalte</p>", "  </l-spalte>", "</l-spalten>"],
    auswahl: "Linke Spalte",
  },
  {
    art: "bild",
    hilfe: "Ein Bild mit Bildunterschrift. src ist der Pfad relativ zur Seite, alt beschreibt das Bild für Menschen, die es nicht sehen können.",
    beispiel: ["<figure>", "  <img src=\"../Anhänge/bild.png\" alt=\"Skizze eines kleinen Netzwerks\">", "  <figcaption>Ein kleines Netzwerk</figcaption>", "</figure>"],
    name: "Bild",
    beschreibung: "Bild aus dem Vault mit Bildunterschrift",
    vorlage: ({ src = "" }) => ["<figure>", `  <img src="${attr(src)}" alt="Beschreibung">`, "  <figcaption>Bildunterschrift</figcaption>", "</figure>"],
    auswahl: "Bildunterschrift",
    ziel: "bild",
  },
  {
    art: "trennlinie",
    hilfe: "Eine waagerechte Linie zwischen zwei Abschnitten.",
    beispiel: ["<p>Erster Abschnitt</p>", "<hr>", "<p>Zweiter Abschnitt</p>"],
    name: "Trennlinie",
    beschreibung: "Waagerechte Linie zwischen Abschnitten",
    vorlage: () => ["<hr>"],
  },
  {
    art: "code",
    hilfe: "Programmcode in Festbreitenschrift. Die Sprache steht in class=\"language-…\". Zeichen wie < und & schreibst du als &lt; und &amp;.",
    beispiel: ["<pre><code class=\"language-js\">const gruss = \"Hallo\";", "console.log(gruss);</code></pre>"],
    name: "Code-Block",
    beschreibung: "Programmcode in Festbreitenschrift",
    vorlage: () => ['<pre><code class="language-text">Code</code></pre>'],
    auswahl: "Code",
  },
  {
    art: "seitenlink",
    hilfe: "Verweist auf eine andere Seite im Vault. href ist der Pfad relativ zu dieser Seite; ein Klick öffnet sie in Localist.",
    beispiel: ["<p>Weiter geht es mit <a class=\"l-seitenlink\" href=\"../Notizen/Ideen.md\">Ideen</a>.</p>"],
    name: "Seitenlink",
    beschreibung: "Verweis auf eine andere Seite im Vault",
    vorlage: ({ href = "", titel = "" }) => [`<a class="l-seitenlink" href="${attr(href)}">${text(titel)}</a>`],
    ziel: "seite",
  },
  {
    art: "karteikarte",
    hilfe: "Vorne steht die Frage, hinten die Antwort. Umdrehen per Klick, Fingertipp oder Leertaste.",
    beispiel: ["<l-karteikarte>", "  <l-frage>Welchen Port nutzt DNS?</l-frage>", "  <l-antwort>Port 53</l-antwort>", "</l-karteikarte>"],
    name: "Karteikarte",
    beschreibung: "Frage vorne, Antwort hinten – zum Umdrehen",
    vorlage: () => ["<l-karteikarte>", "  <l-frage>Frage</l-frage>", "  <l-antwort>Antwort</l-antwort>", "</l-karteikarte>"],
    auswahl: "Frage",
  },
  {
    art: "kartenstapel",
    hilfe: "Mehrere Karteikarten zum Lernen: eine Karte nach der anderen, mit „Gewusst“ und „Nochmal“. Nicht gewusste Karten kommen erneut dran, am Ende gibt es eine Auswertung.",
    beispiel: ["<l-kartenstapel>", "  <l-karteikarte>", "    <l-frage>Hauptstadt von Frankreich?</l-frage>", "    <l-antwort>Paris</l-antwort>", "  </l-karteikarte>", "  <l-karteikarte>", "    <l-frage>Hauptstadt von Italien?</l-frage>", "    <l-antwort>Rom</l-antwort>", "  </l-karteikarte>", "</l-kartenstapel>"],
    name: "Kartenstapel",
    beschreibung: "Mehrere Karteikarten mit Lernmodus",
    vorlage: () => [
      "<l-kartenstapel>",
      "  <l-karteikarte>",
      "    <l-frage>Erste Frage</l-frage>",
      "    <l-antwort>Antwort</l-antwort>",
      "  </l-karteikarte>",
      "  <l-karteikarte>",
      "    <l-frage>Zweite Frage</l-frage>",
      "    <l-antwort>Antwort</l-antwort>",
      "  </l-karteikarte>",
      "</l-kartenstapel>",
    ],
    auswahl: "Erste Frage",
  },
  {
    art: "quiz",
    hilfe: "Multiple-Choice-Fragen. Die richtige Antwort bekommt das Attribut data-richtig. Wer antwortet, sieht sofort, ob es stimmt, und unten die Punktzahl.",
    beispiel: ["<l-quiz>", "  <l-quizfrage>", "    <l-frage>Wie viele Bit hat ein Byte?</l-frage>", "    <ul>", "      <li>4</li>", "      <li data-richtig>8</li>", "      <li>16</li>", "    </ul>", "  </l-quizfrage>", "</l-quiz>"],
    name: "Quiz",
    beschreibung: "Multiple-Choice-Fragen mit Punktzahl",
    vorlage: () => [
      "<l-quiz>",
      "  <l-quizfrage>",
      "    <l-frage>Frage</l-frage>",
      "    <ul>",
      "      <li>Falsche Antwort</li>",
      "      <li data-richtig>Richtige Antwort</li>",
      "    </ul>",
      "  </l-quizfrage>",
      "</l-quiz>",
    ],
    auswahl: "Frage",
  },
  {
    art: "diagramm",
    hilfe: "Zeichnet die Tabelle darin als Balken-, Linien- oder Kreisdiagramm (typ). Erste Spalte: Beschriftung, weitere Spalten: Werte; die erste Zeile nennt die Reihen.",
    beispiel: ["<l-diagramm typ=\"balken\" titel=\"Lernzeit pro Tag\">", "  <table>", "    <tr><th>Tag</th><th>Minuten</th></tr>", "    <tr><td>Mo</td><td>30</td></tr>", "    <tr><td>Di</td><td>45</td></tr>", "    <tr><td>Mi</td><td>20</td></tr>", "  </table>", "</l-diagramm>"],
    name: "Diagramm",
    beschreibung: "Balken-, Linien- oder Kreisdiagramm aus einer Tabelle",
    vorlage: () => [
      '<l-diagramm typ="balken" titel="Titel">',
      "  <table>",
      "    <tr><th>Beschriftung</th><th>Wert</th></tr>",
      "    <tr><td>A</td><td>10</td></tr>",
      "    <tr><td>B</td><td>20</td></tr>",
      "  </table>",
      "</l-diagramm>",
    ],
    auswahl: "Titel",
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
  "l-karteikarte": { children: ["l-frage", "l-antwort"] },
  "l-kartenstapel": { children: ["l-karteikarte"] },
  "l-frage": {},
  "l-antwort": {},
  "l-quiz": { children: ["l-quizfrage"] },
  "l-quizfrage": { children: ["l-frage", "ul"] },
  "l-diagramm": { attrs: { typ: ["balken", "linie", "kreis"], titel: null }, children: ["table"] },
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
  // Bei pos 0 nicht suchen: lastIndexOf("\n", -1) fände ein Zeilenende an Stelle 0.
  const lineStart = pos === 0 ? 0 : doc.lastIndexOf("\n", pos - 1) + 1;
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
