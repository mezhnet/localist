// Gemerkte Einstellungen der Seitenleiste (Etappe 18): links/rechts und eingeklappt, im App-Speicher.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storedEingeklappt, storedSeitenleisteSeite, storeEingeklappt, storeSeitenleisteSeite } from "./seitenleiste";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("Seitenleiste links oder rechts, eingeklappt", () => {
  it("Standard: links und ausgeklappt; gemerkt unter seitenleiste-seite und seitenleiste-eingeklappt", () => {
    expect(storedSeitenleisteSeite()).toBe("links");
    expect(storedEingeklappt()).toBe(false);
    storeSeitenleisteSeite("rechts");
    storeEingeklappt(true);
    expect(localStorage.getItem("seitenleiste-seite")).toBe("rechts");
    expect(localStorage.getItem("seitenleiste-eingeklappt")).toBe("true");
    expect(storedSeitenleisteSeite()).toBe("rechts");
    expect(storedEingeklappt()).toBe(true);
    storeEingeklappt(false);
    expect(storedEingeklappt()).toBe(false);
  });

  it("kaputte Werte gelten als Standard", () => {
    localStorage.setItem("seitenleiste-seite", "oben");
    localStorage.setItem("seitenleiste-eingeklappt", "ja");
    expect(storedSeitenleisteSeite()).toBe("links");
    expect(storedEingeklappt()).toBe(false);
  });

  it("ohne App-Speicher gilt die Wahl bis zum Neustart", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("kein Speicher");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("kein Speicher");
    });
    expect(storedSeitenleisteSeite()).toBe("links");
    storeSeitenleisteSeite("rechts");
    storeEingeklappt(true);
    expect(storedSeitenleisteSeite()).toBe("rechts");
    expect(storedEingeklappt()).toBe(true);
  });
});
