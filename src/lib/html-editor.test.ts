import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { joinFromEditor, mainContentRange, nextViewMode, splitForEditor } from "./html-editor";

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
