import { describe, expect, it } from "vitest";
import { isExternalUrl, normalizeVaultPath, parseBridgeMessage, themeMessage } from "./bridge";

describe("Nachrichten der HTML-Seiten (postMessage)", () => {
  it("nimmt nur bekannte Nachrichtentypen mit richtigen Feldern an", () => {
    expect(parseBridgeMessage({ localist: 1, typ: "bereit" })).toEqual({ typ: "bereit" });
    expect(parseBridgeMessage({ localist: 1, typ: "groesse", hoehe: 812.4 })).toEqual({ typ: "groesse", hoehe: 812 });
    expect(parseBridgeMessage({ localist: 1, typ: "link", pfad: "Notizen/Ideen.md", anker: "oben" })).toEqual({
      typ: "link",
      pfad: "Notizen/Ideen.md",
      anker: "oben",
    });
    expect(parseBridgeMessage({ localist: 1, typ: "extern", url: "https://example.com/" })).toEqual({ typ: "extern", url: "https://example.com/" });
    expect(parseBridgeMessage({ localist: 1, typ: "taste", taste: "p", umschalt: false })).toEqual({ typ: "taste", taste: "p", umschalt: false });

    for (const bad of [
      null,
      "link",
      { typ: "bereit" }, // ohne Kennung
      { localist: 1, typ: "unbekannt" },
      { localist: 1, typ: "groesse", hoehe: "100" },
      { localist: 1, typ: "groesse", hoehe: Infinity },
      { localist: 1, typ: "link", pfad: "../geheim.md" },
      { localist: 1, typ: "link", pfad: "Notizen/../../geheim.md" },
      { localist: 1, typ: "link", pfad: "/C:/Windows/win.ini" },
      { localist: 1, typ: "link", pfad: "C:\\Windows\\win.ini" },
      { localist: 1, typ: "link", pfad: ".localist/settings.json" },
      { localist: 1, typ: "link", pfad: 42 },
      { localist: 1, typ: "extern", url: "javascript:alert(1)" },
      { localist: 1, typ: "extern", url: "file:///C:/Windows/win.ini" },
      { localist: 1, typ: "extern", url: "ipc://localhost/plugin" },
      { localist: 1, typ: "taste", taste: "w", umschalt: false },
      { localist: 1, typ: "sicherheitstest", ergebnisse: [{ pruefung: "x" }] },
    ]) {
      expect(parseBridgeMessage(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("Pfade aus Seiten müssen im Vault liegen", () => {
    expect(normalizeVaultPath("Lernen/DNS.html")).toBe("Lernen/DNS.html");
    for (const bad of ["", "/a.md", "a//b.md", "./a.md", "a/../b.md", "..", "a\\b.md", "C:/x.md", ".git/config"]) {
      expect(normalizeVaultPath(bad), bad).toBeNull();
    }
  });

  it("öffnet nur http, https und mailto im Standardbrowser", () => {
    expect(isExternalUrl("https://example.com")).toBe(true);
    expect(isExternalUrl("mailto:a@b.de")).toBe(true);
    expect(isExternalUrl("javascript:void(0)")).toBe(false);
    expect(isExternalUrl("kein url")).toBe(false);
  });

  it("schickt der Seite nur das Farbschema", () => {
    expect(themeMessage("dark")).toEqual({ localist: 1, typ: "thema", wert: "dunkel" });
    expect(Object.keys(themeMessage("light"))).toEqual(["localist", "typ", "wert"]);
  });
});
