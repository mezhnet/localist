// Modus und Akzentfarbe beim Start (vor dem ersten Zeichnen, src/main.tsx): aus dem App-Speicher, alte Werte gelten.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { themaAnwenden } from "./theme";

function system(dunkel: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: dunkel && query.includes("dark") }) as MediaQueryList);
}
const html = () => [document.documentElement.dataset.theme, document.documentElement.dataset.accent, document.documentElement.style.colorScheme];

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("themaAnwenden (Start ohne Flackern)", () => {
  it("setzt gewählten Modus und Akzentfarbe sofort am <html>", () => {
    system(false);
    localStorage.setItem("theme", "black");
    localStorage.setItem("akzent", "lila");
    themaAnwenden();
    expect(html()).toEqual(["black", "lila", "dark"]);
  });

  it("„Wie System“: helles System → Hell, dunkles System → zuletzt gewählter dunkler Modus", () => {
    system(false);
    themaAnwenden();
    expect(html()).toEqual(["light", "orange", "light"]);
    system(true);
    themaAnwenden();
    expect(html()[0]).toBe("dark");
    localStorage.setItem("theme-dunkel", "black");
    themaAnwenden();
    expect(html()[0]).toBe("black");
  });

  it("übernimmt alte Werte aus Version 2.0 (theme = light/dark) und ignoriert kaputte", () => {
    system(true);
    localStorage.setItem("theme", "light");
    themaAnwenden();
    expect(html()[0]).toBe("light");
    localStorage.setItem("theme", "dark");
    themaAnwenden();
    expect(html()[0]).toBe("dark");
    localStorage.setItem("theme", "rosa");
    localStorage.setItem("akzent", "gelb");
    themaAnwenden();
    expect(html()).toEqual(["dark", "orange", "dark"]); // kaputt = „Wie System“ (dunkel) und Orange
  });
});
