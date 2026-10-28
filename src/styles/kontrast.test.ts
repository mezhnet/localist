// Rechnet die Kontraste aus tokens.css nach (WCAG 2.1, Stufe AA): Text mindestens 4,5 : 1, Bedienelemente und
// Symbole mindestens 3 : 1 – für jeden Modus (Hell, Dunkel, Schwarz) und jede Akzentfarbe (Orange, Blau, Grün, Lila).
// Halbtransparente Farben werden dabei über die jeweilige Fläche gelegt.
import { describe, expect, it } from "vitest";
import tokens from "./tokens.css?raw";

type Werte = Map<string, string>;

/** Alle Blöcke „Selektor { --name: wert; … }“ der Datei (auch innerhalb von @media). */
function bloecke(css: string): { selektor: string; werte: Werte }[] {
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const liste: { selektor: string; werte: Werte }[] = [];
  for (const treffer of ohneKommentare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const werte: Werte = new Map();
    for (const zeile of treffer[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) werte.set(zeile[1], zeile[2].trim());
    liste.push({ selektor: treffer[1].replace(/@media[^{]*/g, "").trim(), werte });
  }
  return liste;
}

const MODI = { hell: "light", dunkel: "dark", schwarz: "black" } as const;
const AKZENTE = ["orange", "blau", "gruen", "lila"] as const;
type Modus = keyof typeof MODI;

/** Werte, die bei <html data-theme=… data-accent=…> gelten (Reihenfolge wie die Kaskade: Spezifität, dann Position). */
function wirksam(modus: Modus, akzent: (typeof AKZENTE)[number]): Werte {
  const theme = MODI[modus];
  const passt = (selektor: string) => {
    if (selektor === ":root") return 1;
    const t = /data-theme="(\w+)"/.exec(selektor)?.[1];
    const a = /data-accent="(\w+)"/.exec(selektor)?.[1];
    if (selektor.includes(":not([data-theme])")) return 0;
    if (t && t !== theme) return 0;
    if (a && a !== akzent) return 0;
    return 1 + (t ? 1 : 0) + (a ? 1 : 0);
  };
  const treffer = bloecke(tokens)
    .map((b, position) => ({ ...b, position, gewicht: passt(b.selektor) }))
    .filter((b) => b.gewicht > 0)
    .sort((x, y) => x.gewicht - y.gewicht || x.position - y.position);
  const werte: Werte = new Map();
  for (const b of treffer) for (const [k, v] of b.werte) werte.set(k, v);
  return werte;
}

type Rgba = [number, number, number, number];
function farbe(werte: Werte, name: string): Rgba {
  let wert = werte.get(name);
  for (let i = 0; wert?.startsWith("var("); i++) wert = werte.get(wert.slice(4, -1).split(",")[0].trim());
  if (!wert) throw new Error(`${name} fehlt`);
  const h = /^#([0-9a-f]{6})$/i.exec(wert);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)).concat(1) as Rgba;
  const r = /^rgba?\(([^)]+)\)$/.exec(wert);
  if (r) {
    const [rr, gg, bb, aa = "1"] = r[1].split(",").map((s) => s.trim());
    return [Number(rr), Number(gg), Number(bb), Number(aa)];
  }
  throw new Error(`${name}: unbekannter Wert ${wert}`);
}
const ueber = (oben: Rgba, unten: Rgba): Rgba => [0, 1, 2].map((i) => oben[i] * oben[3] + unten[i] * (1 - oben[3])).concat(1) as Rgba;
const luminanz = ([r, g, b]: Rgba) => {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const kontrast = (a: Rgba, b: Rgba) => {
  const [x, y] = [luminanz(a), luminanz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const FLAECHEN = ["--color-window", "--color-bg", "--color-bg-subtle", "--color-surface", "--color-surface-raised"];
/** [Vordergrund, Hintergründe, Mindestkontrast] */
const PAARE: [string, string[], number][] = [
  ["--color-text", [...FLAECHEN, "--color-bg-muted", "--color-surface-selected", "--color-menu-selected", "--color-accent-callout", "--color-accent-soft"], 4.5],
  ["--color-text-muted", FLAECHEN, 4.5],
  ["--color-accent-text", ["--color-window", "--color-bg", "--color-bg-subtle", "--color-surface"], 4.5],
  ["--color-text-on-accent", ["--color-accent", "--color-accent-hover"], 4.5],
  ["--color-accent-chip-text", ["--color-accent-chip"], 4.5],
  ["--color-danger", ["--color-window", "--color-bg", "--color-bg-subtle"], 4.5],
  ["--color-success", ["--color-bg", "--color-bg-subtle"], 4.5],
  ["--color-warning", ["--color-bg", "--color-bg-subtle"], 4.5],
  ["--color-info", ["--color-bg", "--color-bg-subtle"], 4.5],
  ["--color-code-tag", ["--color-bg"], 4.5],
  ["--color-code-attribute", ["--color-bg"], 4.5],
  ["--color-code-string", ["--color-bg"], 4.5],
  ["--color-code-comment", ["--color-bg"], 4.5],
  ["--color-code-keyword", ["--color-bg"], 4.5],
  ["--color-code-number", ["--color-bg"], 4.5],
  // Bedienelemente und Symbole: Füllung der Knöpfe und Häkchen, Fokusring, gedämpfte Symbole, Zeilennummern
  ["--color-accent", ["--color-window", "--color-bg", "--color-bg-subtle"], 3],
  ["--color-focus-ring", ["--color-window", "--color-bg", "--color-bg-subtle"], 3],
  ["--color-text-faint", ["--color-window", "--color-bg", "--color-bg-subtle"], 3],
  ["--color-accent-text", ["--color-accent-callout", "--color-accent-chip"], 3],
  ["--color-code-gutter", ["--color-bg-subtle"], 3],
  // Fensterrahmen (Etappe 18): Symbol auf dem roten Schließen-Knopf
  ["--color-window-close-text", ["--color-window-close"], 4.5],
];

describe("Kontraste (WCAG AA) in allen Modi und Akzentfarben", () => {
  for (const modus of Object.keys(MODI) as Modus[]) {
    for (const akzent of AKZENTE) {
      it(`${modus}, ${akzent}`, () => {
        const werte = wirksam(modus, akzent);
        const zuSchwach: string[] = [];
        for (const [vorne, hinten, mindestens] of PAARE) {
          for (const flaeche of hinten) {
            // Halbtransparente Flächen liegen auf der Inhaltsfläche.
            const unten = ueber(farbe(werte, flaeche), farbe(werte, "--color-bg"));
            const k = kontrast(ueber(farbe(werte, vorne), unten), unten);
            if (k < mindestens) zuSchwach.push(`${vorne} auf ${flaeche}: ${k.toFixed(2)} < ${mindestens}`);
          }
        }
        expect(zuSchwach).toEqual([]);
      });
    }
  }

  it("rechnet richtig (Schwarz auf Weiß 21 : 1, Orange #c2410c auf Weiß 5,18 : 1, halbtransparent wird gemischt)", () => {
    const weiss: Rgba = [255, 255, 255, 1];
    expect(kontrast([0, 0, 0, 1], weiss)).toBeCloseTo(21, 1);
    expect(kontrast([194, 65, 12, 1], weiss)).toBeCloseTo(5.18, 2);
    expect(ueber([0, 0, 0, 0.5], weiss)).toEqual([127.5, 127.5, 127.5, 1]);
  });

  it("jede Farbe hat Werte für Hell, Dunkel und Schwarz, jede Akzentfarbe alle Akzent-Töne", () => {
    const hell = wirksam("hell", "orange");
    const farben = [...hell.keys()].filter((k) => k.startsWith("--color-"));
    expect(farben.length).toBeGreaterThan(40);
    const bl = bloecke(tokens);
    for (const theme of ["dark", "black"]) {
      const block = bl.find((b) => b.selektor === `:root[data-theme="${theme}"]`)!;
      expect(farben.filter((k) => !block.werte.has(k)), theme).toEqual([]);
    }
    const akzentTöne = [...bl.find((b) => b.selektor === ':root[data-accent="blau"]')!.werte.keys()];
    expect(akzentTöne).toEqual(expect.arrayContaining(["--color-accent", "--color-accent-text", "--color-accent-chip", "--color-accent-chip-text", "--color-accent-callout", "--color-text-on-accent"]));
    for (const theme of ["", '[data-theme="dark"]', '[data-theme="black"]']) {
      for (const a of ["blau", "gruen", "lila"]) {
        const block = bl.find((b) => b.selektor === `:root${theme}[data-accent="${a}"]`);
        expect([...(block?.werte.keys() ?? [])], `${theme} ${a}`).toEqual(akzentTöne);
      }
    }
  });
});
