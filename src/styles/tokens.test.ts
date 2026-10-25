// Prüft das Design-System: Feste Farbwerte stehen nur in tokens.css, alle anderen CSS-Dateien
// unter src/ nutzen die Variablen daraus. So sehen hell und dunkel überall gleich gut aus.
import { describe, expect, it } from "vitest";

const cssFiles = import.meta.glob("../**/*.css", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const tokens = cssFiles["./tokens.css"];

/** Feste Farbwerte in Deklarationen (#…, rgb(…), rgba(…), hsl(…), hsla(…)), Kommentare zählen nicht. */
function findColorLiterals(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  // Deklarationen "eigenschaft: wert;" – Selektoren wie a:hover { … } enden mit "{" und zählen nicht.
  for (const match of withoutComments.matchAll(/([-\w]+)\s*:\s*([^;{}]+)(?=[;}])/g)) {
    const value = match[2];
    for (const literal of value.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/gi)) {
      found.push(`${match[1]}: ${literal[0]}`);
    }
  }
  return found;
}

describe("Design-System (tokens.css)", () => {
  it("findet feste Farbwerte zuverlässig", () => {
    const css = `/* #ffffff im Kommentar ist erlaubt */
      #root { color: var(--color-text); }
      .a:hover { color: #fff; }
      .b { background: rgba(0, 0, 0, 0.1); border-color: RGB(1,2,3) }
      .c { box-shadow: 0 0 0 1px hsl(10 20% 30%); outline-color: hsla(0, 0%, 0%, 0.5); }
      .d { background: color-mix(in srgb, var(--color-accent) 10%, transparent); }`;
    expect(findColorLiterals(css)).toEqual([
      "color: #fff",
      "background: rgba(",
      "border-color: RGB(",
      "box-shadow: hsl(",
      "outline-color: hsla(",
    ]);
  });

  it("enthält Farben, Abstände, Schriftgrößen, Radien und Schatten für hell und dunkel", () => {
    expect(tokens).toBeTruthy();
    for (const group of ["--color-", "--space-", "--font-size-", "--radius-", "--shadow-"]) {
      expect(tokens, group).toContain(group);
    }
    const light = tokens.slice(tokens.indexOf(":root {"), tokens.indexOf(':root[data-theme="dark"]'));
    const dark = tokens.slice(tokens.indexOf(':root[data-theme="dark"]'), tokens.indexOf("@media"));
    // Jede Farbe des hellen Modus hat einen Gegenwert im dunklen Modus.
    const lightColors = [...light.matchAll(/(--color-[\w-]+):/g)].map((m) => m[1]);
    const darkColors = new Set([...dark.matchAll(/(--color-[\w-]+):/g)].map((m) => m[1]));
    expect(lightColors.length).toBeGreaterThan(20);
    expect(lightColors.filter((name) => !darkColors.has(name))).toEqual([]);
  });

  it("Schrift und Styles kommen nicht aus dem Internet (keine externen Adressen in CSS und index.html)", () => {
    const html = import.meta.glob("../../index.html", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const sources = { ...cssFiles, ...html };
    expect(Object.keys(html)).toHaveLength(1);
    const external = Object.entries(sources).flatMap(([path, text]) =>
      [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"')]*/gi)].map((m) => `${path} → ${m[0]}`),
    );
    expect(external).toEqual([]);
    expect(tokens).toMatch(/--font-sans: "Inter Variable"/);
  });

  it("außer tokens.css enthält keine CSS-Datei unter src/ feste Farbwerte", () => {
    const checked = Object.keys(cssFiles).filter((path) => path !== "./tokens.css");
    expect(checked.length).toBeGreaterThan(3);
    const problems = checked.flatMap((path) => findColorLiterals(cssFiles[path]).map((hit) => `${path} → ${hit}`));
    expect(problems).toEqual([]);
  });
});
