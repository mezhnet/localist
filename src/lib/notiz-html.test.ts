// „In HTML-Seite umwandeln“: jedes Element einer Notiz wird zum passenden HTML bzw. Baustein.
import { describe, expect, it } from "vitest";
import formatierung from "../../beispiel-vault/Notizen/Formatierung.md?raw";
import { bausteinAnzahl, bausteinLesen } from "./baustein-formulare";
import { readHead } from "./html";
import { bildZiele, markdownZuHtml, notizAlsHtml, type NotizHtmlOptionen } from "./notiz-html";

const pages = [
  { path: "Notizen/Ideen.md", title: "Ideen" },
  { path: "Notizen/DNS.html", title: "DNS" },
  { path: "Projekte/Website-Relaunch.md", title: "Website-Relaunch" },
  { path: "Notizen/Formatierung.md", title: "Formatierung" },
];
const optionen: NotizHtmlOptionen = {
  pfad: "Notizen/Formatierung.html",
  titel: "Formatierung",
  pages,
  bild: (ziel) => (ziel === "Anhänge/skizze.png" || ziel === "skizze.png" ? "Anhänge/skizze.png" : null),
};
const html = (markdown: string) => markdownZuHtml(markdown, optionen);

describe("Notiz → HTML-Seite, je Element", () => {
  it("Überschriften und Absätze", () => {
    expect(html("# Eins\n\n## Zwei\n\n###### Sechs\n\nEin Absatz.\nNoch eine Zeile.")).toBe(
      "<h1>Eins</h1>\n\n<h2>Zwei</h2>\n\n<h6>Sechs</h6>\n\n<p>Ein Absatz.\nNoch eine Zeile.</p>",
    );
  });

  it("Formatierungen und Zeichen, die maskiert werden müssen", () => {
    expect(html("**fett** *kursiv* ~~durch~~ `a < b` <u>unter</u> und 1 < 2 & 3 > 2")).toBe(
      "<p><strong>fett</strong> <em>kursiv</em> <s>durch</s> <code>a &lt; b</code> <u>unter</u> und 1 &lt; 2 &amp; 3 &gt; 2</p>",
    );
    expect(html("Zeile  \nUmbruch")).toBe("<p>Zeile<br>\nUmbruch</p>");
    expect(html("[Tauri](https://tauri.app)")).toBe('<p><a href="https://tauri.app">Tauri</a></p>');
  });

  it("Listen (auch verschachtelt und nummeriert)", () => {
    expect(html("- Eins\n- Zwei\n  - Drei")).toBe("<ul>\n  <li>Eins</li>\n  <li>Zwei\n    <ul>\n      <li>Drei</li>\n    </ul>\n  </li>\n</ul>");
    expect(html("1. Eins\n2. Zwei")).toBe("<ol>\n  <li>Eins</li>\n  <li>Zwei</li>\n</ol>");
    expect(html("3. Drei\n4. Vier")).toBe('<ol start="3">\n  <li>Drei</li>\n  <li>Vier</li>\n</ol>');
  });

  it("Checklisten → Baustein Checkliste", () => {
    expect(html("- [ ] Offen\n- [x] Erledigt")).toBe('<ul class="l-checkliste">\n  <li><input type="checkbox"> Offen</li>\n  <li><input type="checkbox" checked> Erledigt</li>\n</ul>');
  });

  it("Zitate", () => {
    expect(html("> Ein Zitat\n> über zwei Zeilen")).toBe("<blockquote>\n  <p>Ein Zitat\n  über zwei Zeilen</p>\n</blockquote>");
  });

  it("Callouts → <l-callout> (Obsidian-Arten werden zugeordnet)", () => {
    expect(html("> [!info] Hinweis mit [[Ideen]]")).toBe('<l-callout typ="info">Hinweis mit <a href="Ideen.md">Ideen</a></l-callout>');
    expect(html("> [!tip] Merke\n> Der Inhalt.")).toBe('<l-callout typ="tipp">\n  <p><strong>Merke</strong></p>\n  <p>Der Inhalt.</p>\n</l-callout>');
    expect(html("> [!warning]\n> Vorsicht")).toBe('<l-callout typ="warnung">\n  <p>Vorsicht</p>\n</l-callout>');
    expect(html("> [!bug] Fehler")).toBe('<l-callout typ="fehler">Fehler</l-callout>');
    expect(html("> [!unbekannt] Text")).toBe('<l-callout typ="info">Text</l-callout>');
  });

  it("Toggles (> [!note]- Titel) → <details>, mit + anfangs offen", () => {
    expect(html("> [!note]- Mehr dazu\n> Versteckter Text.")).toBe("<details>\n  <summary>Mehr dazu</summary>\n  <p>Versteckter Text.</p>\n</details>");
    expect(html("> [!faq]+ Offen\n>\n> - Punkt")).toBe("<details open>\n  <summary>Offen</summary>\n  <ul>\n    <li>Punkt</li>\n  </ul>\n</details>");
  });

  it("Code (mit Sprache und maskiert) und Trennlinie", () => {
    expect(html("```ts\nconst a = 1 < 2;\n```\n\n---")).toBe('<pre><code class="language-ts">const a = 1 &lt; 2;</code></pre>\n\n<hr>');
    expect(html("```\nohne Sprache\n```")).toBe("<pre><code>ohne Sprache</code></pre>");
  });

  it("Bilder: allein im Absatz → Baustein Bild, Pfad relativ zur neuen Seite", () => {
    expect(html("![Skizze](Anhänge/skizze.png)")).toBe('<figure>\n  <img src="../Anhänge/skizze.png" alt="Skizze">\n</figure>');
    expect(html('![Skizze](Anhänge/skizze.png "Unterschrift")')).toBe('<figure>\n  <img src="../Anhänge/skizze.png" alt="Skizze">\n  <figcaption>Unterschrift</figcaption>\n</figure>');
    expect(html("![[skizze.png]]")).toBe('<figure>\n  <img src="../Anhänge/skizze.png" alt="">\n</figure>');
    expect(html("Im Text ![x](https://example.com/a.png) bleibt die Adresse.")).toBe('<p>Im Text <img src="https://example.com/a.png" alt="x"> bleibt die Adresse.</p>');
  });

  it("Tabellen → <table> mit Überschriftenzeile", () => {
    expect(html("| A | B |\n|---|---|\n| 1 | **2** |")).toBe("<table>\n  <tr><th>A</th><th>B</th></tr>\n  <tr><td>1</td><td><strong>2</strong></td></tr>\n</table>");
  });

  it("[[Links]] → <a> mit relativem Pfad (Notizen, HTML-Seiten, Alias, fehlende Seiten)", () => {
    expect(html("[[Ideen]] [[DNS.html]] [[Website-Relaunch|Projekt]] [[Neue Seite]] [[Formatierung]]")).toBe(
      '<p><a href="Ideen.md">Ideen</a> <a href="DNS.html">DNS</a> <a href="../Projekte/Website-Relaunch.md">Projekt</a> <a href="Neue%20Seite.md">Neue Seite</a> <a href="Formatierung.html">Formatierung</a></p>',
    );
    // In Code bleibt [[…]] Text.
    expect(html("`[[Ideen]]`")).toBe("<p><code>[[Ideen]]</code></p>");
  });

  it("Roh-HTML in der Notiz bleibt erhalten (läuft nur in der abgeschotteten Anzeige)", () => {
    expect(html('<div class="eigen">Hallo</div>')).toBe('<div class="eigen">Hallo</div>');
  });
});

describe("Notiz → vollständige HTML-Seite", () => {
  it("Frontmatter: id, Icon und Cover werden übernommen, alle anderen Felder werden localist-prop-…", () => {
    const notiz = "---\nid: 1234-abcd\nicon: 🚀\ncover: Anhänge/skizze.png\nstatus: In Arbeit\nfällig: 2026-11-15\ntags:\n  - a\n  - b\n---\n# Titel\n";
    const seite = notizAlsHtml(notiz, { ...optionen, pfad: "Projekte/Website-Relaunch.html", titel: "Website-Relaunch" });
    expect(seite).toBe(
      [
        "<!doctype html>",
        '<html lang="de">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>Website-Relaunch</title>",
        '<meta name="localist-id" content="1234-abcd">',
        '<meta name="localist-icon" content="🚀">',
        '<meta name="localist-cover" content="../Anhänge/skizze.png">',
        '<meta name="localist-prop-status" content="In Arbeit">',
        '<meta name="localist-prop-fällig" content="2026-11-15">',
        '<meta name="localist-prop-tags" content="a, b">',
        '<link rel="stylesheet" href="../.localist/bausteine/localist.css">',
        '<script src="../.localist/bausteine/localist.js" defer></script>',
        "</head>",
        "<body>",
        "<main>",
        "<h1>Titel</h1>",
        "</main>",
        "</body>",
        "</html>",
        "",
      ].join("\n"),
    );
    expect(readHead(seite)).toEqual({ title: "Website-Relaunch", id: "1234-abcd", icon: "🚀", cover: "../Anhänge/skizze.png" });
    // Ohne id bekommt die Seite eine neue.
    expect(notizAlsHtml("# Ohne", { ...optionen, neueId: "neu-1" })).toContain('<meta name="localist-id" content="neu-1">');
  });

  it("die Beispielnotiz „Formatierung“ wird vollständig umgewandelt, die Bausteine sind ohne Code bearbeitbar", () => {
    const seite = notizAlsHtml(formatierung, optionen);
    for (const teil of [
      "<h1>Alle Formatierungen</h1>",
      "<h2>Überschrift zweiter Ebene</h2>",
      "<strong>fettem</strong>",
      "<em>kursivem</em>",
      "<code>Code im Text</code>",
      '<a href="https://tauri.app">Link</a>',
      "<li>Eingerückter Punkt</li>",
      "<ol>",
      '<ul class="l-checkliste">',
      "<blockquote>",
      '<pre><code class="language-ts">const antwort = 42;',
      '<img src="../Anhänge/skizze.png" alt="Skizze">',
    ]) {
      expect(seite, teil).toContain(teil);
    }
    // Checkliste, Code und Bild sind Bausteine (Stift-Symbol), wie in Etappe 12
    const arten = Array.from({ length: bausteinAnzahl(seite) }, (_, i) => bausteinLesen(seite, i)!.art);
    expect(arten).toEqual(["checkliste", "code", "bild"]);
  });

  it("findet die Bilder einer Notiz vorab (für die Suche im Vault)", () => {
    expect(bildZiele("---\ncover: Anhänge/c.png\n---\n![a](a.png) ![[b.png|x]] ![w](https://x.de/w.png)")).toEqual(["a.png", "b.png", "Anhänge/c.png"]);
  });
});
