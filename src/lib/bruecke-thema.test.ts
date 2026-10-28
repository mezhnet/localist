// Nachricht „thema“ in der Seite (src-tauri/seite/bruecke.js): Modus Hell, Dunkel oder Schwarz und die Akzentfarbe
// kommen an, unbekannte Werte und Nachrichten von anderen Fenstern werden nicht übernommen.
import { afterEach, describe, expect, it } from "vitest";
import bridgeScript from "../../src-tauri/seite/bruecke.js?raw";

let frame: HTMLIFrameElement | null = null;
afterEach(() => {
  frame?.remove();
  frame = null;
});

/** Lädt die Brücke in ein iframe (so ist window.parent die App) und liefert dessen Fenster. */
function seite() {
  frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const fenster = frame.contentWindow as Window & typeof globalThis;
  const skript = fenster.document.createElement("script");
  skript.textContent = bridgeScript;
  fenster.document.head.appendChild(skript);
  return fenster;
}

/** Nachricht an die Seite; Absender ist die App (window.parent der Seite) oder ein anderes Fenster. */
const senden = (fenster: Window & typeof globalThis, daten: unknown, source: Window | null = fenster.parent) =>
  fenster.dispatchEvent(new fenster.MessageEvent("message", { data: daten, source }));
const html = (fenster: Window) => fenster.document.documentElement;

describe("Brücke: Modus und Akzentfarbe", () => {
  it("übernimmt Hell, Dunkel und Schwarz samt Akzentfarbe", () => {
    const fenster = seite();
    expect(html(fenster).getAttribute("data-localist")).toBe("app");
    senden(fenster, { localist: 1, typ: "thema", wert: "schwarz", akzent: "lila" });
    expect(html(fenster).getAttribute("data-theme")).toBe("black");
    expect(html(fenster).getAttribute("data-accent")).toBe("lila");
    expect(html(fenster).style.colorScheme).toBe("dark");
    senden(fenster, { localist: 1, typ: "thema", wert: "dunkel", akzent: "blau" });
    expect([html(fenster).getAttribute("data-theme"), html(fenster).getAttribute("data-accent")]).toEqual(["dark", "blau"]);
    senden(fenster, { localist: 1, typ: "thema", wert: "hell" });
    expect([html(fenster).getAttribute("data-theme"), html(fenster).getAttribute("data-accent")]).toEqual(["light", "orange"]);
    expect(html(fenster).style.colorScheme).toBe("light");
  });

  it("ignoriert unbekannte Werte und Nachrichten, die nicht von der App kommen", () => {
    const fenster = seite();
    senden(fenster, { localist: 1, typ: "thema", wert: "dunkel", akzent: "gruen" });
    for (const daten of [
      { localist: 1, typ: "thema", wert: "toString" },
      { localist: 1, typ: "thema", wert: "__proto__" },
      { localist: 1, typ: "thema", wert: "rot" },
      { localist: 2, typ: "thema", wert: "schwarz" },
    ]) {
      senden(fenster, daten);
      expect(html(fenster).getAttribute("data-theme"), JSON.stringify(daten)).toBe("dark");
    }
    // Unbekannte Akzentfarbe: Modus gilt, Akzent fällt auf Orange zurück (kein beliebiger Text im Attribut).
    senden(fenster, { localist: 1, typ: "thema", wert: "schwarz", akzent: "\" onload=\"x" });
    expect([html(fenster).getAttribute("data-theme"), html(fenster).getAttribute("data-accent")]).toEqual(["black", "orange"]);
    // Von einem anderen Fenster (z. B. einem Skript der Seite selbst) wird nichts übernommen.
    senden(fenster, { localist: 1, typ: "thema", wert: "hell" }, fenster);
    expect(html(fenster).getAttribute("data-theme")).toBe("black");
  });
});
