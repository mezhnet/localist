// Bearbeiten ohne Code: Bausteine finden (gleich wie das Brücken-Skript im iframe), Werte lesen und nur die
// geänderten Stellen zurückschreiben, Häkchen setzen.
import { describe, expect, it } from "vitest";
import beispielSeite from "../../beispiel-vault/Lernen/Bausteine.html?raw";
import dnsSeite from "../../beispiel-vault/Notizen/DNS.html?raw";
import bridgeScript from "../../src-tauri/seite/bruecke.js?raw";
import {
  BAUSTEIN_SELEKTOR,
  bausteinAnzahl,
  bausteinEntfernen,
  bausteinLesen,
  bausteinSchreiben,
  haekchenSetzen,
  HAEKCHEN_SELEKTOR,
  type BausteinWerte,
} from "./baustein-formulare";

const seite = (main: string) => `<!doctype html>\n<html lang="de">\n<head>\n<title>T</title>\n</head>\n<body>\n<main>\n${main}\n</main>\n</body>\n</html>\n`;

/** Liest, ändert mit `change` und schreibt zurück. */
function bearbeiten<T extends BausteinWerte>(html: string, index: number, change: (werte: T) => T): string {
  const werte = bausteinLesen(html, index) as T;
  expect(werte).not.toBeNull();
  return bausteinSchreiben(html, index, change(structuredClone(werte)));
}

/** Prüft, dass sich nur der Text zwischen `vorher` und `nachher` geändert hat. */
function nurDazwischen(alt: string, neu: string, vorher: string, nachher: string) {
  const start = alt.indexOf(vorher) + vorher.length;
  const end = alt.indexOf(nachher, start);
  expect(neu.startsWith(alt.slice(0, start))).toBe(true);
  expect(neu.endsWith(alt.slice(end))).toBe(true);
}

describe("Bausteine finden", () => {
  it("gleiche Auswahl und Reihenfolge wie im Browser-DOM (iframe)", () => {
    for (const html of [beispielSeite, dnsSeite, seite('<l-spalten><l-spalte><l-callout>A</l-callout><table><tr><td>1</td></tr></table></l-spalte></l-spalten><template><hr></template><svg><a class="l-seitenlink"></a></svg>')]) {
      const dom = new DOMParser().parseFromString(html, "text/html");
      const bereich = dom.querySelector("main") ?? dom.body;
      const imDom = [...bereich.querySelectorAll(BAUSTEIN_SELEKTOR)].map((element) => element.localName);
      expect(bausteinAnzahl(html)).toBe(imDom.length);
      const arten = imDom.map((_, i) => bausteinLesen(html, i)!.art);
      const erwartet = imDom.map((tag) =>
        ({ "l-callout": "callout", details: "toggle", table: "tabelle", ul: "checkliste", "l-spalten": "spalten", figure: "bild", hr: "trennlinie", pre: "code", a: "seitenlink" })[tag],
      );
      expect(arten).toEqual(erwartet);
    }
    expect(bausteinAnzahl(beispielSeite)).toBe(13); // 4 Callouts, Toggle, Tabelle, Checkliste, Spalten, Bild, Linie, Code, 2 Seitenlinks
  });

  it("das Brücken-Skript nutzt dieselben Selektoren", () => {
    expect(bridgeScript).toContain(`var BAUSTEINE = "${BAUSTEIN_SELEKTOR}";`);
    expect(bridgeScript).toContain(`var HAEKCHEN = '${HAEKCHEN_SELEKTOR}';`);
  });

  it("liest die Werte jedes Bausteins der Beispielseite", () => {
    const werte = Array.from({ length: bausteinAnzahl(beispielSeite) }, (_, i) => bausteinLesen(beispielSeite, i));
    expect(werte[0]).toEqual({ art: "callout", typ: "info", text: { wert: "Ein Callout hebt einen Hinweis hervor.", html: false } });
    expect(werte[1]).toEqual({ art: "callout", typ: "tipp", text: { wert: "Mit dem Attribut <code>typ</code> wählst du Farbe und Symbol.", html: true } });
    expect(werte[4]).toEqual({
      art: "toggle",
      titel: { wert: "Was passiert beim Klick?", html: false },
      inhalt: { wert: "<p>Der Inhalt klappt auf und wieder zu. Das kann der Browser von selbst, auch ohne Skript.</p>", html: true },
      offen: false,
    });
    expect(werte[5]).toMatchObject({ art: "tabelle", kopfzeile: true, spalten: [0, 1, 2] });
    expect((werte[5] as Extract<BausteinWerte, { art: "tabelle" }>).zeilen[1].zellen.map((zelle) => zelle.wert)).toEqual(["DNS", "53", "UDP und TCP"]);
    expect(werte[6]).toEqual({
      art: "checkliste",
      punkte: [
        { quelle: 0, an: true, text: { wert: "Bausteine kennenlernen", html: false } },
        { quelle: 1, an: false, text: { wert: "Eine eigene Lernseite anlegen", html: false } },
        { quelle: 2, an: false, text: { wert: "Die Seite im Browser öffnen", html: false } },
      ],
    });
    expect(werte[7]).toMatchObject({ art: "spalten", spalten: [{ quelle: 0 }, { quelle: 1 }] });
    expect(werte[8]).toEqual({
      art: "bild",
      src: "../Anh%C3%A4nge/netzwerk.svg",
      alt: "Drei Rechner an einem Router",
      beschriftung: { wert: "Ein kleines Netzwerk: drei Rechner hängen an einem Router.", html: false },
    });
    expect(werte[9]).toEqual({ art: "trennlinie" });
    expect(werte[10]).toEqual({ art: "code", sprache: "html", code: '<l-callout typ="tipp">Text</l-callout>' });
    expect(werte[11]).toEqual({ art: "seitenlink", href: "../Notizen/Ideen.md", text: { wert: "Ideen", html: false } });
  });
});

describe("Formulare ändern nur den betroffenen Baustein", () => {
  it("unveränderte Werte ändern nichts", () => {
    for (let i = 0; i < bausteinAnzahl(beispielSeite); i++) expect(bearbeiten(beispielSeite, i, (werte) => werte)).toBe(beispielSeite);
  });

  it("Callout: Typ und Text, auch in einer Datei mit CRLF und BOM", () => {
    const html = `﻿${seite('<l-callout typ="info">Erster &amp; bester</l-callout>\n<l-callout typ="tipp">Zweiter</l-callout>').replace(/\n/g, "\r\n")}`;
    const neu = bearbeiten<Extract<BausteinWerte, { art: "callout" }>>(html, 1, (w) => ({ ...w, typ: "warnung", text: { wert: "Vorsicht <heiß>\nZweite Zeile", html: false } }));
    expect(neu).toBe(html.replace('<l-callout typ="tipp">Zweiter</l-callout>', '<l-callout typ="warnung">Vorsicht &lt;heiß&gt;<br>\r\nZweite Zeile</l-callout>'));
    // Text mit Zeichen wie & wird gelesen wie angezeigt und unverändert gelassen.
    expect(bausteinLesen(html, 0)).toMatchObject({ text: { wert: "Erster & bester", html: false } });
  });

  it("Toggle: Titel, Inhalt (HTML) und aufgeklappt", () => {
    const html = seite("<details>\n  <summary>Alt</summary>\n  <p>Eins</p>\n</details>\n<p>danach</p>");
    const neu = bearbeiten<Extract<BausteinWerte, { art: "toggle" }>>(html, 0, (w) => ({ ...w, offen: true, titel: { wert: "Neu", html: false }, inhalt: { wert: "<p>Eins</p>\n<p>Zwei</p>", html: true } }));
    expect(neu).toBe(seite("<details open>\n  <summary>Neu</summary>\n  <p>Eins</p>\n  <p>Zwei</p>\n</details>\n<p>danach</p>"));
  });

  it("Tabelle: eine Zelle ändern ändert nur diese Zelle", () => {
    const neu = bearbeiten<Extract<BausteinWerte, { art: "tabelle" }>>(beispielSeite, 5, (w) => {
      w.zeilen[2].zellen[1] = { wert: "8080", html: false };
      return w;
    });
    expect(neu).toBe(beispielSeite.replace("<td>HTTP</td><td>80</td>", "<td>HTTP</td><td>8080</td>"));
  });

  it("Tabellen-Editor: Zeilen und Spalten hinzufügen und entfernen, unveränderte Zellen bleiben wörtlich", () => {
    const html = seite("<table>\n  <tr><th>A</th><th>B</th></tr>\n  <tr><td><b>1</b></td><td>2</td></tr>\n</table>");
    const neu = bearbeiten<Extract<BausteinWerte, { art: "tabelle" }>>(html, 0, (w) => {
      // Spalte B entfernen, Spalte C und eine Zeile hinzufügen
      w.spalten = [0, null];
      w.zeilen = [
        { quelle: 0, zellen: [w.zeilen[0].zellen[0], { wert: "C", html: false }] },
        { quelle: 1, zellen: [w.zeilen[1].zellen[0], { wert: "x & y", html: false }] },
        { quelle: null, zellen: [{ wert: "neu", html: false }, { wert: "", html: false }] },
      ];
      return w;
    });
    expect(neu).toBe(seite("<table>\n  <tr><th>A</th><th>C</th></tr>\n  <tr><td><b>1</b></td><td>x &amp; y</td></tr>\n  <tr><td>neu</td><td></td></tr>\n</table>"));
    // Ohne Überschrift: die erste Zeile wird zu <td>
    const ohne = bearbeiten<Extract<BausteinWerte, { art: "tabelle" }>>(html, 0, (w) => ({ ...w, kopfzeile: false }));
    expect(ohne).toContain("<tr><td>A</td><td>B</td></tr>");
  });

  it("Tabelle mit <thead>/<tbody> und <caption> behält die Gliederung", () => {
    const html = seite("<table>\n  <caption>Ports</caption>\n  <thead>\n    <tr><th>A</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>1</td></tr>\n  </tbody>\n</table>");
    const neu = bearbeiten<Extract<BausteinWerte, { art: "tabelle" }>>(html, 0, (w) => ({ ...w, zeilen: [...w.zeilen, { quelle: null, zellen: [{ wert: "2", html: false }] }] }));
    expect(neu).toBe(seite("<table>\n  <caption>Ports</caption>\n  <thead>\n    <tr><th>A</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>1</td></tr>\n    <tr><td>2</td></tr>\n  </tbody>\n</table>"));
  });

  it("Checkliste: Häkchen und Text ändern genau diese Stellen, neue Punkte werden ergänzt", () => {
    const geändert = bearbeiten<Extract<BausteinWerte, { art: "checkliste" }>>(beispielSeite, 6, (w) => {
      w.punkte[0].an = false;
      w.punkte[2] = { ...w.punkte[2], an: true, text: { wert: "Im Browser öffnen", html: false } };
      return w;
    });
    expect(geändert).toBe(
      beispielSeite
        .replace('<li><input type="checkbox" checked> Bausteine kennenlernen</li>', '<li><input type="checkbox"> Bausteine kennenlernen</li>')
        .replace('<li><input type="checkbox"> Die Seite im Browser öffnen</li>', '<li><input type="checkbox" checked> Im Browser öffnen</li>'),
    );
    const ergänzt = bearbeiten<Extract<BausteinWerte, { art: "checkliste" }>>(beispielSeite, 6, (w) => ({
      ...w,
      punkte: [w.punkte[0], w.punkte[2], { quelle: null, an: false, text: { wert: "Neu <3", html: false } }],
    }));
    expect(ergänzt).toContain(
      '<ul class="l-checkliste">\n  <li><input type="checkbox" checked> Bausteine kennenlernen</li>\n  <li><input type="checkbox"> Die Seite im Browser öffnen</li>\n  <li><input type="checkbox"> Neu &lt;3</li>\n</ul>\n\n<h2>Spalten</h2>',
    );
    nurDazwischen(beispielSeite, ergänzt, "<h2>Checkliste</h2>\n", "\n\n<h2>Spalten</h2>");
  });

  it("Spalten: Inhalt ändern und eine Spalte hinzufügen", () => {
    const html = seite("<l-spalten>\n  <l-spalte>\n    <p>Links</p>\n  </l-spalte>\n  <l-spalte>\n    <p>Rechts</p>\n  </l-spalte>\n</l-spalten>");
    const inhalt = bearbeiten<Extract<BausteinWerte, { art: "spalten" }>>(html, 0, (w) => {
      w.spalten[1].inhalt = { wert: "<p>Rechts</p>\n<p>mehr</p>", html: true };
      return w;
    });
    expect(inhalt).toBe(html.replace("    <p>Rechts</p>\n", "    <p>Rechts</p>\n    <p>mehr</p>\n"));
    const dritte = bearbeiten<Extract<BausteinWerte, { art: "spalten" }>>(html, 0, (w) => ({ ...w, spalten: [...w.spalten, { quelle: null, inhalt: { wert: "Mitte", html: false } }] }));
    expect(dritte).toBe(html.replace("  </l-spalte>\n</l-spalten>", "  </l-spalte>\n  <l-spalte>\n    <p>Mitte</p>\n  </l-spalte>\n</l-spalten>"));
  });

  it("Bild: Pfad, Alternativtext und Bildunterschrift (entfernen und neu anlegen)", () => {
    const html = seite('<figure>\n  <img src="a.png" alt="A" width="240">\n  <figcaption>Alt</figcaption>\n</figure>');
    const neu = bearbeiten<Extract<BausteinWerte, { art: "bild" }>>(html, 0, (w) => ({ ...w, src: "../Anhänge/b c.png", alt: 'Ein "B"' }));
    expect(neu).toBe(html.replace('src="a.png" alt="A"', 'src="../Anhänge/b c.png" alt="Ein &quot;B&quot;"'));
    const ohne = bearbeiten<Extract<BausteinWerte, { art: "bild" }>>(html, 0, (w) => ({ ...w, beschriftung: { wert: "", html: false } }));
    expect(ohne).toBe(html.replace("  <figcaption>Alt</figcaption>\n", ""));
    const wieder = bearbeiten<Extract<BausteinWerte, { art: "bild" }>>(ohne, 0, (w) => ({ ...w, beschriftung: { wert: "Neu", html: false } }));
    expect(wieder).toBe(html.replace("Alt</figcaption>", "Neu</figcaption>"));
  });

  it("Code-Block: Code wird maskiert, Zeilenenden der Datei bleiben, Sprache ändert die Klasse", () => {
    const html = seite('<pre><code class="language-text">alt</code></pre>').replace(/\n/g, "\r\n");
    const neu = bearbeiten<Extract<BausteinWerte, { art: "code" }>>(html, 0, () => ({ art: "code", sprache: "html", code: "<p>\n  x & y\n</p>" }));
    expect(neu).toBe(html.replace('<code class="language-text">alt</code>', '<code class="language-html">&lt;p&gt;\r\n  x &amp; y\r\n&lt;/p&gt;</code>'));
    expect(bausteinLesen(neu, 0)).toEqual({ art: "code", sprache: "html", code: "<p>\n  x & y\n</p>" });
  });

  it("Seitenlink: Ziel und Text", () => {
    const neu = bearbeiten<Extract<BausteinWerte, { art: "seitenlink" }>>(beispielSeite, 12, (w) => ({ ...w, href: "../Notizen/Formatierung.md", text: { wert: "Formatierung", html: false } }));
    expect(neu).toBe(beispielSeite.replace('<a class="l-seitenlink" href="../Notizen/DNS.html">DNS</a>', '<a class="l-seitenlink" href="../Notizen/Formatierung.md">Formatierung</a>'));
  });

  it("Entfernen löscht den Baustein samt seiner Zeile", () => {
    const neu = bausteinEntfernen(beispielSeite, 9);
    expect(neu).toBe(beispielSeite.replace("<hr>\n", ""));
    expect(() => bausteinSchreiben(beispielSeite, 99, { art: "trennlinie" })).toThrow("nicht gefunden");
    expect(() => bausteinSchreiben(beispielSeite, 9, { art: "code", sprache: "", code: "" })).toThrow("nicht gefunden");
  });
});

describe("Häkchen in Checklisten", () => {
  it("setzt und entfernt genau das Attribut checked", () => {
    const an = haekchenSetzen(beispielSeite, 1, true)!;
    expect(an).toBe(beispielSeite.replace('<input type="checkbox"> Eine eigene Lernseite', '<input type="checkbox" checked> Eine eigene Lernseite'));
    const aus = haekchenSetzen(beispielSeite, 0, false)!;
    expect(aus).toBe(beispielSeite.replace('<input type="checkbox" checked> Bausteine', '<input type="checkbox"> Bausteine'));
    expect(haekchenSetzen(beispielSeite, 0, true)).toBe(beispielSeite);
    expect(haekchenSetzen(beispielSeite, 3, true)).toBeNull();
  });

  it("zählt wie der Selektor im iframe (nur Kästchen in Checklisten, auch mit BOM)", () => {
    const html = `﻿${seite('<input type="checkbox">\n<ul class="l-checkliste">\n  <li><input type="CHECKBOX"> A</li>\n  <li><input type="checkbox" checked/> B</li>\n</ul>')}`;
    const dom = new DOMParser().parseFromString(html, "text/html");
    expect(dom.querySelector("main")!.querySelectorAll(HAEKCHEN_SELEKTOR)).toHaveLength(2);
    expect(haekchenSetzen(html, 0, true)).toBe(html.replace('type="CHECKBOX">', 'type="CHECKBOX" checked>'));
    expect(haekchenSetzen(html, 1, false)).toBe(html.replace('type="checkbox" checked/>', 'type="checkbox"/>'));
  });
});
