// Eigene Bausteine: Dateiformat (gleich wie src-tauri/src/eigene.rs) und Bibliotheksseite.
import { describe, expect, it } from "vitest";
import gebauteVorlage from "../../src-tauri/seite/bibliothek.html?raw";
import { BAUSTEINE } from "./bausteine";
import { bibliothekSeite, bibliothekVorlage, EIGENE_MARKE, vorschauCode } from "./bibliothek";
import { eigenerBausteinDatei, eigenerBausteinLesen, eigenerBausteinName, eigenerBausteinZeilen } from "./eigene-bausteine";

describe("Eigene Bausteine: Speichern und Laden", () => {
  it("Beschreibung als Kommentar in der ersten Zeile, dann der Code (wie in Rust)", () => {
    const datei = eigenerBausteinDatei("Box für Lernziele", '<l-callout typ="tipp">\r\n  Lernziel\r\n</l-callout>\r\n\r\n');
    expect(datei).toBe('<!-- beschreibung: Box für Lernziele -->\n<l-callout typ="tipp">\n  Lernziel\n</l-callout>\n');
    expect(eigenerBausteinLesen(datei)).toEqual({ beschreibung: "Box für Lernziele", code: '<l-callout typ="tipp">\n  Lernziel\n</l-callout>' });
    expect(eigenerBausteinDatei("a --> b\nc", "x")).toBe("<!-- beschreibung: a –> b c -->\nx\n");
    expect(eigenerBausteinLesen("﻿<p>Nur Code</p>\n")).toEqual({ beschreibung: "", code: "<p>Nur Code</p>" });
    expect(eigenerBausteinLesen("<!--beschreibung:kurz-->")).toEqual({ beschreibung: "kurz", code: "" });
  });

  it("Namen werden wie Dateinamen geprüft, Code wird zum Einfügen in Zeilen geteilt", () => {
    expect(eigenerBausteinName("  Lernziel-Box ")).toBe("Lernziel-Box");
    for (const bad of ["", "  ", "../x", "a/b", "a:b", ".versteckt"]) expect(() => eigenerBausteinName(bad), bad).toThrow();
    expect(eigenerBausteinZeilen("<p>\r\n  x\r\n</p>")).toEqual(["<p>", "  x", "</p>"]);
  });
});

describe("Bibliothek", () => {
  it("die Vorlage der App passt zum Katalog (sonst: npm run build ausführen)", () => {
    expect(gebauteVorlage.replace(/\r\n/g, "\n")).toBe(bibliothekVorlage());
  });

  it("zeigt jeden eingebauten Baustein mit Beispiel; Bilder und Links der Beispiele brauchen keinen Vault", () => {
    const vorlage = bibliothekVorlage();
    for (const info of BAUSTEINE) {
      expect(vorlage).toContain(`<section class="eintrag" id="baustein-${info.art}">\n<h2>${info.name}</h2>`);
      expect(vorlage).toContain(vorschauCode(info));
    }
    expect(vorschauCode(BAUSTEINE.find((info) => info.art === "bild")!)).toMatch(/src="data:image\/svg\+xml,/);
    expect(vorschauCode(BAUSTEINE.find((info) => info.art === "seitenlink")!)).toContain('class="l-seitenlink" href="#"');
    expect(vorlage).toContain('<link rel="stylesheet" href="localist.css">');
    expect(vorlage).toContain(EIGENE_MARKE);
  });

  it("setzt die eigenen Bausteine ein (wie bibliothek_seite in Rust)", () => {
    expect(bibliothekSeite("<main>\n<!-- eigene-bausteine -->\n</main>", [{ name: "A <b>", beschreibung: "x & y", code: "<p>Code</p>" }])).toBe(
      '<main>\n<section class="eintrag" id="eigen-0">\n<h2>A &lt;b&gt;</h2>\n<p class="beschreibung">x &amp; y</p>\n<p>Code</p>\n</section>\n</main>',
    );
    expect(bibliothekSeite(bibliothekVorlage(), [])).toContain("Noch keine eigenen Bausteine.");
    // $-Zeichen im Code sind keine Ersetzungsmuster
    expect(bibliothekSeite(EIGENE_MARKE, [{ name: "Preis", beschreibung: "", code: "<p>$& 5 €</p>" }])).toContain("<p>$& 5 €</p>");
  });
});
