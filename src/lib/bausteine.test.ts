// Bausteine: Vorlagen nach dem Speicherformat, Einfügen an der Cursorposition (sauber eingerückt) und
// lesbarer Text ohne Skript.
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import beispielSeite from "../../beispiel-vault/Lernen/Bausteine.html?raw";
import localistCss from "../../src-tauri/seite/localist.css?raw";
import { applyPlan, BAUSTEINE, bausteinInfo, planInsert, type BausteinArt } from "./bausteine";
import { htmlVisibleText } from "./html";

const vorlage = (art: BausteinArt) => bausteinInfo(art).vorlage({ src: "../Anh%C3%A4nge/netzwerk.svg", href: "../Notizen/Ideen.md", titel: "Ideen" });

/** Fügt ein wie der Code-Editor und liefert Text und markierten Bereich. */
function insert(doc: string, pos: number, art: BausteinArt) {
  const info = bausteinInfo(art);
  const plan = planInsert(doc, pos, vorlage(art), info.auswahl);
  const result = applyPlan(doc, plan);
  return { text: result, selected: result.slice(plan.anchor, plan.head) };
}

describe("Bausteine einfügen", () => {
  it("leere Zeile: Der Baustein ersetzt sie und bekommt ihre Einrückung, der Platzhalter ist markiert", () => {
    const doc = "<l-spalte>\n    \n</l-spalte>";
    const { text, selected } = insert(doc, doc.indexOf("    \n") + 4, "toggle");
    expect(text).toBe("<l-spalte>\n    <details>\n      <summary>Titel</summary>\n      <p>Inhalt</p>\n    </details>\n</l-spalte>");
    expect(selected).toBe("Titel");
  });

  it("Cursor am Zeilenende: Der Baustein kommt in die nächste Zeile", () => {
    const doc = "  <p>Eins</p>\n  <p>Zwei</p>";
    const { text, selected } = insert(doc, "  <p>Eins</p>".length, "callout");
    expect(text).toBe('  <p>Eins</p>\n  <l-callout typ="info">Text</l-callout>\n  <p>Zwei</p>');
    expect(selected).toBe("Text");
  });

  it("Cursor vor dem Text einer Zeile: Der Baustein kommt darüber", () => {
    const { text } = insert("  <p>Eins</p>", 0, "trennlinie");
    expect(text).toBe("  <hr>\n  <p>Eins</p>");
  });

  it("mitten in einer Zeile: Die Zeile wird geteilt", () => {
    const doc = "<p>Eins</p> <p>Zwei</p>";
    const { text } = insert(doc, doc.indexOf(" <p>Zwei"), "trennlinie");
    expect(text).toBe("<p>Eins</p>\n<hr>\n<p>Zwei</p>");
  });

  it("Tabelle, Checkliste und Spalten werden mehrzeilig eingerückt eingefügt", () => {
    const doc = "<main>\n  \n</main>";
    const pos = doc.indexOf("  \n") + 2;
    expect(insert(doc, pos, "tabelle").text).toBe(
      "<main>\n  <table>\n    <tr><th>Spalte 1</th><th>Spalte 2</th></tr>\n    <tr><td>Wert</td><td>Wert</td></tr>\n  </table>\n</main>",
    );
    expect(insert(doc, pos, "checkliste").text).toBe(
      '<main>\n  <ul class="l-checkliste">\n    <li><input type="checkbox"> Erster Punkt</li>\n    <li><input type="checkbox"> Zweiter Punkt</li>\n  </ul>\n</main>',
    );
    expect(insert(doc, pos, "spalten").text).toBe(
      "<main>\n  <l-spalten>\n    <l-spalte>\n      <p>Linke Spalte</p>\n    </l-spalte>\n    <l-spalte>\n      <p>Rechte Spalte</p>\n    </l-spalte>\n  </l-spalten>\n</main>",
    );
  });

  it("Bild und Seitenlink: Ziel relativ zur Seite, Sonderzeichen im Titel werden maskiert", () => {
    expect(vorlage("bild")).toEqual(["<figure>", '  <img src="../Anh%C3%A4nge/netzwerk.svg" alt="Beschreibung">', "  <figcaption>Bildunterschrift</figcaption>", "</figure>"]);
    expect(bausteinInfo("seitenlink").vorlage({ href: "../A%20B.html", titel: "A & <B>" })).toEqual([
      '<a class="l-seitenlink" href="../A%20B.html">A &amp; &lt;B&gt;</a>',
    ]);
  });

  it("im Editor mit CRLF: eingefügt wird mit dem Zeilenende der Datei, der Rest bleibt gleich", () => {
    const original = "<main>\r\n  <p>Eins</p>\r\n  \r\n  <p>Zwei</p>\r\n</main>\r\n";
    let state = EditorState.create({ doc: original, extensions: [EditorState.lineSeparator.of("\r\n")] });
    const pos = state.doc.line(3).to;
    // Wie CodeEditor.insert: planen mit "\n", einfügen mit state.lineBreak.
    const plan = planInsert(state.doc.toString(), pos, vorlage("toggle"), "Titel");
    state = state.update({ changes: { from: plan.from, to: plan.to, insert: plan.insert.split("\n").join(state.lineBreak) }, selection: { anchor: plan.anchor, head: plan.head } }).state;
    expect(state.sliceDoc()).toBe(
      "<main>\r\n  <p>Eins</p>\r\n  <details>\r\n    <summary>Titel</summary>\r\n    <p>Inhalt</p>\r\n  </details>\r\n  <p>Zwei</p>\r\n</main>\r\n",
    );
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe("Titel");
  });
});

describe("Markup der Bausteine", () => {
  it("entspricht dem Speicherformat aus CLAUDE.md", () => {
    const joined = (art: BausteinArt) => vorlage(art).join("\n");
    expect(joined("callout")).toMatch(/^<l-callout typ="(info|tipp|warnung|fehler)">[^<]*<\/l-callout>$/);
    expect(joined("toggle")).toMatch(/^<details>\n\s+<summary>[^<]+<\/summary>[\s\S]*<\/details>$/);
    expect(joined("tabelle")).toMatch(/^<table>\n\s+<tr><th>.*<\/th><\/tr>\n\s+<tr><td>.*<\/td><\/tr>\n<\/table>$/);
    expect(joined("checkliste")).toMatch(/^<ul class="l-checkliste">\n(\s+<li><input type="checkbox"> [^<]+<\/li>\n)+<\/ul>$/);
    expect(joined("spalten")).toMatch(/^<l-spalten>\n(\s+<l-spalte>[\s\S]*?<\/l-spalte>\n)+<\/l-spalten>$/);
    expect(joined("bild")).toMatch(/^<figure>\n\s+<img src="[^"]+" alt="[^"]*">\n\s+<figcaption>[^<]+<\/figcaption>\n<\/figure>$/);
    expect(joined("trennlinie")).toBe("<hr>");
    expect(joined("code")).toMatch(/^<pre><code class="language-[\w-]+">[^<]*<\/code><\/pre>$/);
    expect(joined("seitenlink")).toMatch(/^<a class="l-seitenlink" href="[^"]+">[^<]+<\/a>$/);
    expect(BAUSTEINE.map((info) => info.art)).toEqual(["callout", "toggle", "tabelle", "checkliste", "spalten", "bild", "trennlinie", "code", "seitenlink"]);
  });

  it("der Text jedes Bausteins steht ohne Skript lesbar in der Datei (nicht in Attributen)", () => {
    const sichtbar: Record<BausteinArt, string[]> = {
      callout: ["Text"],
      toggle: ["Titel", "Inhalt"],
      tabelle: ["Spalte 1", "Spalte 2", "Wert"],
      checkliste: ["Erster Punkt", "Zweiter Punkt"],
      spalten: ["Linke Spalte", "Rechte Spalte"],
      bild: ["Bildunterschrift"],
      trennlinie: [],
      code: ["Code"],
      seitenlink: ["Ideen"],
    };
    for (const info of BAUSTEINE) {
      const text = htmlVisibleText(`<main>${vorlage(info.art).join("\n")}</main>`);
      for (const part of sichtbar[info.art]) expect(text, info.name).toContain(part);
    }
    // Die Beispielseite: jeder Baustein ist da und sein Text ohne Skript sichtbar.
    const seite = htmlVisibleText(beispielSeite);
    for (const part of [
      "Ein Callout hebt einen Hinweis hervor.",
      "Was passiert beim Klick?",
      "Der Inhalt klappt auf und wieder zu.",
      "Protokoll Port Transport",
      "Bausteine kennenlernen",
      "32 Bit, geschrieben als vier Zahlen",
      "Ein kleines Netzwerk",
      '<l-callout typ="tipp">Text</l-callout>',
      "Ideen DNS",
    ]) {
      expect(seite).toContain(part);
    }
    for (const markup of ["<l-callout", "<details>", "<table>", '<ul class="l-checkliste">', "<l-spalten>", "<figure>", "<hr>", "<pre><code", 'class="l-seitenlink"']) {
      expect(beispielSeite).toContain(markup);
    }
  });

  it("localist.css versteckt keinen Inhalt eines Bausteins", () => {
    const hidden = [...localistCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{[^}]*(?:display:\s*none|visibility:\s*hidden)[^}]*\}/g)].map((m) => m[1].trim());
    expect(hidden).toEqual(["details > summary::-webkit-details-marker"]);
  });
});
