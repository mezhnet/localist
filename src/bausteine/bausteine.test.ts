// localist.css und localist.js: entstehen aus tokens.css und src/bausteine/, die erzeugten Dateien sind aktuell
// und tragen eine Version, und das Skript macht die Grundbausteine interaktiv, ohne die Seite umzubauen.
import { afterEach, describe, expect, it } from "vitest";
import jetbrainsLizenz from "../../node_modules/@fontsource-variable/jetbrains-mono/LICENSE?raw";
import jetbrainsSchrift from "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?inline";
import jakartaLizenz from "../../node_modules/@fontsource-variable/plus-jakarta-sans/LICENSE?raw";
import jakartaSchrift from "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2?inline";
import pkg from "../../package.json";
import jetbrainsApp from "../../public/lizenzen/JetBrainsMono-OFL.txt?raw";
import jakartaApp from "../../public/lizenzen/PlusJakartaSans-OFL.txt?raw";
import vaultCss from "../../beispiel-vault/.localist/bausteine/localist.css?raw";
import vaultJs from "../../beispiel-vault/.localist/bausteine/localist.js?raw";
import gebautesCss from "../../src-tauri/seite/localist.css?raw";
import gebautesJs from "../../src-tauri/seite/localist.js?raw";
import tokens from "../styles/tokens.css?raw";
import { bausteineBauen, bausteinVersion } from "./bauen";

const css = import.meta.glob("./*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const js = import.meta.glob("./*.js", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const base64 = (url: string) => url.slice(url.indexOf("base64,") + "base64,".length);
const schriften = [
  { familie: "Plus Jakarta Sans Variable", gewichte: "200 800", base64: base64(jakartaSchrift), lizenz: jakartaLizenz },
  { familie: "JetBrains Mono Variable", gewichte: "100 800", base64: base64(jetbrainsSchrift), lizenz: jetbrainsLizenz },
];
const gebaut = bausteineBauen({ appVersion: pkg.version, tokens, css, js, schriften });

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
    expect(order.slice(0, 4)).toEqual(["schrift", "schrift", "tokens.css", "basis.css"]);
    for (const name of ["callout", "toggle", "tabelle", "checkliste", "spalten", "bild", "trennlinie", "code", "seitenlink"]) {
      expect(order, name).toContain(`${name}.css`);
    }
    for (const selector of ["l-callout", "details > summary", "table", "ul.l-checkliste", "l-spalten", "figure", "hr", "pre", "a.l-seitenlink"]) {
      expect(gebaut.css, selector).toContain(selector);
    }
  });

  it("bettet die Schriften Plus Jakarta Sans und JetBrains Mono samt Lizenz ein, damit Seiten in App und Browser gleich aussehen", () => {
    expect(gebaut.css).toContain('font-family: "Plus Jakarta Sans Variable";');
    expect(gebaut.css).toContain('font-family: "JetBrains Mono Variable";');
    expect(gebaut.css.match(/src: url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{30000,}\) format\("woff2-variations"\);/g)).toHaveLength(2);
    expect(gebaut.css.match(/SIL Open Font License, Version 1.1/g)?.length).toBeGreaterThanOrEqual(2);
    // Nur lateinische Zeichen (mit Umlauten und deutschen Anführungszeichen), keine weiteren Zeichensätze, kein Kursivschnitt.
    expect(gebaut.css.match(/@font-face/g)).toHaveLength(2);
    expect(gebaut.css).not.toContain("font-style: italic");
    expect(tokens).toContain('--font-sans: "Plus Jakarta Sans Variable"');
    expect(tokens).toContain('--font-mono: "JetBrains Mono Variable"');
    // Die App liefert die Lizenztexte mit (public/lizenzen/, landen beim Build in der App).
    expect(lf(jakartaApp)).toBe(lf(jakartaLizenz));
    expect(lf(jetbrainsApp)).toBe(lf(jetbrainsLizenz));
  });

  it("eine Änderung an einer Quelle ändert die Version, CRLF beim Auschecken nicht", () => {
    const geaendert = bausteineBauen({ appVersion: pkg.version, tokens, css: { ...css, "./callout.css": `${css["./callout.css"]}\n/* neu */` }, js, schriften });
    expect(geaendert.version).not.toBe(gebaut.version);
    const crlf = Object.fromEntries(Object.entries(css).map(([name, text]) => [name, text.replace(/\r?\n/g, "\r\n")]));
    expect(bausteineBauen({ appVersion: pkg.version, tokens: tokens.replace(/\r?\n/g, "\r\n"), css: crlf, js, schriften }).version).toBe(gebaut.version);
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
