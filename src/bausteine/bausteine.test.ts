// localist.css und localist.js: entstehen aus tokens.css und src/bausteine/, die erzeugten Dateien sind aktuell
// und tragen eine Version, und das Skript macht die Grundbausteine interaktiv, ohne die Seite umzubauen.
import { afterEach, describe, expect, it } from "vitest";
import pkg from "../../package.json";
import vaultCss from "../../beispiel-vault/.localist/bausteine/localist.css?raw";
import vaultJs from "../../beispiel-vault/.localist/bausteine/localist.js?raw";
import gebautesCss from "../../src-tauri/seite/localist.css?raw";
import gebautesJs from "../../src-tauri/seite/localist.js?raw";
import tokens from "../styles/tokens.css?raw";
import { bausteineBauen, bausteinVersion } from "./bauen";

const css = import.meta.glob("./*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const js = import.meta.glob("./*.js", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const gebaut = bausteineBauen({ appVersion: pkg.version, tokens, css, js });

describe("localist.css und localist.js (Build)", () => {
  it("die erzeugten Dateien passen zum Quellcode (sonst: npm run build oder npm run dev ausführen)", () => {
    expect(lf(gebautesCss)).toBe(gebaut.css);
    expect(lf(gebautesJs)).toBe(gebaut.js);
    // Der Beispiel-Vault hat dieselbe Fassung, wie nach dem Öffnen in der App.
    expect(lf(vaultCss)).toBe(gebaut.css);
    expect(lf(vaultJs)).toBe(gebaut.js);
  });

  it("beide Dateien nennen in der ersten Zeile dieselbe Version (App-Version + Prüfsumme)", () => {
    expect(gebaut.version).toMatch(new RegExp(`^${pkg.version.replace(/\./g, "\\.")}\\+[0-9a-f]{8}$`));
    expect(bausteinVersion(gebaut.css)).toBe(gebaut.version);
    expect(bausteinVersion(gebaut.js)).toBe(gebaut.version);
    expect(gebaut.js).toContain(`var VERSION = "${gebaut.version}";`);
  });

  it("enthält tokens.css und alle Grundbausteine, basis zuerst", () => {
    const order = [...gebaut.css.matchAll(/\/\* ---- ([\w.-]+) ---- \*\//g)].map((m) => m[1]);
    expect(order.slice(0, 2)).toEqual(["tokens.css", "basis.css"]);
    for (const name of ["callout", "toggle", "tabelle", "checkliste", "spalten", "bild", "trennlinie", "code", "seitenlink"]) {
      expect(order, name).toContain(`${name}.css`);
    }
    for (const selector of ["l-callout", "details > summary", "table", "ul.l-checkliste", "l-spalten", "figure", "hr", "pre", "a.l-seitenlink"]) {
      expect(gebaut.css, selector).toContain(selector);
    }
  });

  it("eine Änderung an einer Quelle ändert die Version, CRLF beim Auschecken nicht", () => {
    const geaendert = bausteineBauen({ appVersion: pkg.version, tokens, css: { ...css, "./callout.css": `${css["./callout.css"]}\n/* neu */` }, js });
    expect(geaendert.version).not.toBe(gebaut.version);
    const crlf = Object.fromEntries(Object.entries(css).map(([name, text]) => [name, text.replace(/\n/g, "\r\n")]));
    expect(bausteineBauen({ appVersion: pkg.version, tokens: tokens.replace(/\n/g, "\r\n"), css: crlf, js }).version).toBe(gebaut.version);
  });
});

describe("localist.js im Browser", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  /** Lädt localist.js wie ein klassisches Skript (einmal; Custom Elements lassen sich nicht abmelden). */
  let geladen = false;
  const laden = (html: string) => {
    document.body.innerHTML = html;
    if (!geladen) new Function(gebaut.js)();
    geladen = true;
  };

  it("Callout bekommt eine Beschriftung für Bildschirmleser, der Text bleibt unverändert", () => {
    laden('<main><l-callout typ="warnung">Vorsicht, heiß!</l-callout><l-callout>Ohne Typ</l-callout></main>');
    const [warnung, ohne] = document.querySelectorAll("l-callout");
    expect(customElements.get("l-callout")).toBeDefined();
    expect(warnung.getAttribute("role")).toBe("note");
    expect(warnung.getAttribute("aria-label")).toBe("Warnung");
    expect(ohne.getAttribute("aria-label")).toBe("Info");
    expect(warnung.textContent).toBe("Vorsicht, heiß!");
    expect(document.documentElement.getAttribute("data-localist-bausteine")).toBe(gebaut.version);
  });

  it("Klick auf den Text eines Checklisten-Punkts setzt das Häkchen", () => {
    laden('<main><ul class="l-checkliste"><li><input type="checkbox"> Milch kaufen</li><li><input type="checkbox" checked> Brot</li></ul></main>');
    const [erster, zweiter] = document.querySelectorAll("li");
    erster.click();
    zweiter.click();
    const boxes = document.querySelectorAll<HTMLInputElement>("input");
    expect([boxes[0].checked, boxes[1].checked]).toEqual([true, false]);
    // Ein Klick direkt aufs Kästchen wird nicht doppelt gezählt.
    boxes[0].click();
    expect(boxes[0].checked).toBe(false);
  });
});
