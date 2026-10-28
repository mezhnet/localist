import { EditorState } from "@codemirror/state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  anteilAusZeiger,
  anteilNachTaste,
  begrenzeAnteil,
  GETEILT_MIN_PX,
  joinFromEditor,
  mainContentRange,
  nextViewMode,
  splitForEditor,
  storeAnteil,
  storeCodeSeite,
  storedAnteil,
  storedCodeSeite,
} from "./html-editor";

const PAGE = `<!doctype html>
<html lang="de">
<head>
<title>DNS</title>
</head>
<body>
<main>
<h1>DNS</h1>
<p>Port 53</p>
</main>
<footer>Fuß</footer>
</body>
</html>
`;

/**
 * Wie im Editor: Text in CodeMirror laden (mit dem Zeilenende der Datei) und wieder herausholen.
 * Wichtig: `sliceDoc()` nutzt das eingestellte Zeilenende, `doc.toString()` dagegen immer LF.
 */
function throughCodeMirror(body: string, lineBreak: string, edit?: (state: EditorState) => EditorState): string {
  let state = EditorState.create({ doc: body, extensions: [EditorState.lineSeparator.of(lineBreak)] });
  if (edit) state = edit(state);
  return state.sliceDoc();
}

describe("Code-Editor: Ausschnitt und Zusammensetzen", () => {
  it("zeigt nur den Inhalt von <main>, der Rest bleibt außerhalb des Editors", () => {
    const split = splitForEditor(PAGE, false);
    expect(split.mainOnly).toBe(true);
    expect(split.body).toBe("\n<h1>DNS</h1>\n<p>Port 53</p>\n");
    expect(split.prefix.endsWith("<main>")).toBe(true);
    expect(split.suffix.startsWith("</main>\n<footer>")).toBe(true);
    expect(joinFromEditor(split, split.body)).toBe(PAGE);
  });

  it("„Ganze Datei“ zeigt alles; ohne <main> immer die ganze Datei", () => {
    expect(splitForEditor(PAGE, true)).toMatchObject({ prefix: "", body: PAGE, suffix: "", mainOnly: false });
    const without = "<!doctype html><title>x</title><p>kein main</p>";
    expect(splitForEditor(without, false)).toMatchObject({ body: without, mainOnly: false });
    expect(mainContentRange(without)).toBeNull();
  });

  it("CRLF und BOM: Unveränderte Teile bleiben Zeichen für Zeichen gleich, nur die bearbeitete Stelle ändert sich", () => {
    const file = `﻿${PAGE.replace(/\n/g, "\r\n")}`;
    for (const whole of [false, true]) {
      const split = splitForEditor(file, whole);
      expect(split.lineBreak).toBe("\r\n");
      expect(split.body.startsWith("﻿")).toBe(false); // das BOM sieht der Editor nie
      // Ohne Änderung: identisch
      expect(joinFromEditor(split, throughCodeMirror(split.body, split.lineBreak))).toBe(file);
      // Eine Zeile einfügen (Enter im Editor = Zeilenende der Datei) und ein Wort ändern
      const edited = throughCodeMirror(split.body, split.lineBreak, (state) => {
        const at = state.doc.toString().indexOf("Port 53");
        return state.update({ changes: [{ from: at + 5, to: at + 7, insert: "5353" }, { from: at + 7 + "</p>".length, insert: `${state.lineBreak}<p>neu</p>` }] }).state;
      });
      expect(joinFromEditor(split, edited)).toBe(file.replace("<p>Port 53</p>", "<p>Port 5353</p>\r\n<p>neu</p>"));
    }
  });

  it("gemischte Zeilenenden bleiben erhalten", () => {
    const mixed = "<main>\r\n<p>a</p>\n<p>b</p>\r</main>";
    const split = splitForEditor(mixed, true);
    expect(joinFromEditor(split, throughCodeMirror(split.body, split.lineBreak))).toBe(mixed);
  });

  it("fehlerhaftes HTML geht nie verloren", () => {
    // <main> ohne End-Tag: ganze Datei im Editor, Inhalt unverändert
    const unclosed = "<!doctype html><body><main><p>offen<div>noch offen";
    const split = splitForEditor(unclosed, false);
    expect(split.mainOnly).toBe(false);
    expect(joinFromEditor(split, throughCodeMirror(split.body, split.lineBreak))).toBe(unclosed);
    // Nicht geschlossene Tags innerhalb von <main>: nur der Ausschnitt, wörtlich
    const broken = "<main><div><p>offen<span>auch</main><p>danach";
    const inner = splitForEditor(broken, false);
    expect(inner).toMatchObject({ mainOnly: true, body: "<div><p>offen<span>auch" });
    expect(joinFromEditor(inner, `${inner.body}<b>`)).toBe("<main><div><p>offen<span>auch<b></main><p>danach");
  });

  it("Strg+E schaltet Lesen → Code → Geteilt → Lesen", () => {
    expect(nextViewMode("lesen")).toBe("code");
    expect(nextViewMode("code")).toBe("geteilt");
    expect(nextViewMode("geteilt")).toBe("lesen");
  });
});

describe("„Geteilt“: Seite des Code-Editors und Trennlinie (Etappe 17)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("Code-Seite: Standard links, gemerkt unter „html-code-seite“, ungültige Werte ergeben links", () => {
    expect(storedCodeSeite()).toBe("links");
    storeCodeSeite("rechts");
    expect(localStorage.getItem("html-code-seite")).toBe("rechts");
    expect(storedCodeSeite()).toBe("rechts");
    localStorage.setItem("html-code-seite", "oben");
    expect(storedCodeSeite()).toBe("links");
  });

  it("Code-Seite ohne App-Speicher: gilt bis zum Neustart, nichts wirft", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("kein Speicher");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("kein Speicher");
    });
    expect(storedCodeSeite()).toBe("links");
    storeCodeSeite("rechts");
    expect(storedCodeSeite()).toBe("rechts");
    storeCodeSeite("links");
    expect(storedAnteil()).toBe(0.5);
    expect(() => storeAnteil(0.7)).not.toThrow();
  });

  it("Verhältnis wird gemerkt unter „html-geteilt-anteil“, kaputte Werte ergeben 50 : 50", () => {
    expect(storedAnteil()).toBe(0.5);
    storeAnteil(0.61234);
    expect(localStorage.getItem("html-geteilt-anteil")).toBe("0.612");
    expect(storedAnteil()).toBe(0.612);
    for (const kaputt of ["abc", "2", "-1", "0", "1", ""]) {
      localStorage.setItem("html-geteilt-anteil", kaputt);
      expect(storedAnteil(), kaputt).toBe(0.5);
    }
  });

  it("Begrenzung: jede Seite bleibt mindestens 280 px breit, zu wenig Platz ergibt 50 : 50", () => {
    expect(GETEILT_MIN_PX).toBe(280);
    expect(begrenzeAnteil(0.6, 1000)).toBe(0.6);
    expect(begrenzeAnteil(0.1, 1000)).toBeCloseTo(0.28);
    expect(begrenzeAnteil(0.95, 1000)).toBeCloseTo(0.72);
    expect(begrenzeAnteil(0, 1000) * 1000).toBeCloseTo(280);
    expect(begrenzeAnteil(0.7, 559)).toBe(0.5);
    expect(begrenzeAnteil(0.7, 0)).toBe(0.5);
    expect(begrenzeAnteil(Number.NaN, 1000)).toBe(0.5);
  });

  it("Anteil aus der Zeigerposition, bei Code rechts gespiegelt", () => {
    // Fläche ab x = 100, 1016 px breit, Trennlinie 16 px: Mitte bei x = 608
    expect(anteilAusZeiger(608, 100, 1016, 16, "links")).toBeCloseTo(0.5);
    expect(anteilAusZeiger(708, 100, 1016, 16, "links")).toBeCloseTo(0.6);
    expect(anteilAusZeiger(708, 100, 1016, 16, "rechts")).toBeCloseTo(0.4);
  });

  it("Tastatur: Pfeile 2 % (Umschalt 10 %), Pos1/Ende, Enter = 50 : 50; bezogen auf die sichtbare Linie", () => {
    expect(anteilNachTaste(0.5, "ArrowRight", false, "links")).toBeCloseTo(0.52);
    expect(anteilNachTaste(0.5, "ArrowLeft", true, "links")).toBeCloseTo(0.4);
    // Code rechts: Linie nach links macht den Code breiter
    expect(anteilNachTaste(0.5, "ArrowLeft", false, "rechts")).toBeCloseTo(0.52);
    expect(anteilNachTaste(0.5, "Home", false, "links")).toBe(0);
    expect(anteilNachTaste(0.5, "End", false, "links")).toBe(1);
    expect(anteilNachTaste(0.5, "Home", false, "rechts")).toBe(1);
    expect(anteilNachTaste(0.7, "Enter", false, "links")).toBe(0.5);
    expect(anteilNachTaste(0.7, "a", false, "links")).toBeNull();
  });
});
