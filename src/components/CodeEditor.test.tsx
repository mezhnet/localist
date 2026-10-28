// Tab und Shift+Tab im Code-Editor der HTML-Seiten (Etappe 17): eine Stufe = EINRUECKUNG (wie die Vorlagen der
// Bausteine), immer die ganze Zeile, auch mit dem Cursor mitten in der Zeile. Escape und danach Tab verlässt den
// Editor (Tab-Fokus-Modus von CodeMirror). Die Tasten laufen als echte keydown-Ereignisse durch die Keymap; ob der
// Browser danach den Fokus weitergibt, kann jsdom nicht zeigen. Das prüft scripts/tab-pruefung.mjs in Edge.
import { indentUnit } from "@codemirror/language";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { render } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPlan, bausteinInfo, EINRUECKUNG, planInsert } from "../lib/bausteine";
import { CodeEditor, type CodeEditorApi } from "./CodeEditor";

function editor(doc: string, lineBreak = "\n") {
  const onChange = vi.fn();
  const apiRef: MutableRefObject<CodeEditorApi | null> = { current: null };
  const { container } = render(
    <CodeEditor value={doc} docVersion={0} lineBreak={lineBreak} dark={false} label="Code" onChange={onChange} apiRef={apiRef} />,
  );
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!;
  return { view, onChange, apiRef };
}

const KEYCODES: Record<string, number> = { Tab: 9, Escape: 27, ArrowRight: 39 };

/** Drückt eine Taste im Editor; `true`, wenn CodeMirror sie abgefangen hat (der Fokus bleibt dann im Editor). */
function taste(view: EditorView, key: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", { key, keyCode: KEYCODES[key], shiftKey, bubbles: true, cancelable: true });
  return !view.contentDOM.dispatchEvent(event);
}

const setze = (view: EditorView, anchor: number, head = anchor) => view.dispatch({ selection: EditorSelection.single(anchor, head) });
const text = (view: EditorView) => view.state.sliceDoc();

afterEach(() => vi.restoreAllMocks());

describe("Code-Editor: Tab und Shift+Tab", () => {
  it("Tab rückt die Zeile um eine Stufe ein, auch mit dem Cursor mitten in der Zeile", () => {
    const { view, onChange } = editor("<ul>\n<li>Eins</li>\n</ul>");
    const pos = "<ul>\n<li>Ei".length;
    setze(view, pos);
    expect(taste(view, "Tab")).toBe(true);
    expect(text(view)).toBe(`<ul>\n${EINRUECKUNG}<li>Eins</li>\n</ul>`);
    // Der Cursor bleibt an derselben Textstelle (hinter „Ei“).
    expect(view.state.selection.main.head).toBe(pos + EINRUECKUNG.length);
    expect(view.state.sliceDoc(view.state.selection.main.head - 6, view.state.selection.main.head)).toBe("<li>Ei");
    expect(onChange).toHaveBeenLastCalledWith(`<ul>\n${EINRUECKUNG}<li>Eins</li>\n</ul>`);
  });

  it("Shift+Tab rückt aus, auch mitten in der Zeile; ohne Einrückung bleibt alles stehen und der Fokus im Editor", () => {
    const { view, onChange } = editor("    <p>x</p>\n<p>y</p>");
    setze(view, "    <p>".length);
    expect(taste(view, "Tab", true)).toBe(true);
    expect(text(view)).toBe("  <p>x</p>\n<p>y</p>");
    expect(view.state.sliceDoc(view.state.selection.main.head - 3, view.state.selection.main.head)).toBe("<p>");

    onChange.mockClear();
    setze(view, text(view).indexOf("<p>y") + 2);
    expect(taste(view, "Tab", true)).toBe(true);
    expect(text(view)).toBe("  <p>x</p>\n<p>y</p>");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mehrere markierte Zeilen: Tab rückt alle ein, Shift+Tab alle aus; endet die Markierung in Spalte 0, bleibt diese Zeile", () => {
    const doc = "<a>\n<b>\n<c>\n<d>";
    const { view } = editor(doc);
    setze(view, 1, doc.indexOf("<c>")); // von „a“ in Zeile 1 bis zum Anfang von Zeile 3
    expect(taste(view, "Tab")).toBe(true);
    expect(text(view)).toBe(`${EINRUECKUNG}<a>\n${EINRUECKUNG}<b>\n<c>\n<d>`);
    // Die Markierung wandert mit: Sie beginnt weiter hinter „<“ und endet weiter am Anfang von „<c>“.
    const { anchor, head } = view.state.selection.main;
    expect(view.state.sliceDoc(anchor - 1, anchor)).toBe("<");
    expect(view.state.sliceDoc(head, head + 3)).toBe("<c>");

    expect(taste(view, "Tab", true)).toBe(true);
    expect(text(view)).toBe(doc);
  });

  it("dieselbe Einrückung wie eingefügte Bausteine", () => {
    const { view, apiRef } = editor("<main>\n\n</main>");
    expect(view.state.facet(indentUnit)).toBe(EINRUECKUNG);
    setze(view, "<main>\n".length);
    const toggle = bausteinInfo("toggle");
    apiRef.current!.insert(toggle.vorlage({}), toggle.auswahl);
    const start = "<main>\n".length;
    const ende = text(view).indexOf("\n</main>");
    setze(view, start, ende);
    expect(taste(view, "Tab")).toBe(true);
    // Gleiches Ergebnis, als wäre der Baustein in eine Zeile mit einer Stufe Einrückung eingefügt worden.
    const doc = `<main>\n${EINRUECKUNG}\n</main>`;
    expect(text(view)).toBe(applyPlan(doc, planInsert(doc, doc.indexOf("\n</main>"), toggle.vorlage({}), toggle.auswahl)));
  });

  it("mit CRLF: Tab über zwei Zeilen behält die Zeilenenden der Datei", () => {
    const { view, onChange } = editor("<p>a</p>\r\n<p>b</p>\r\n", "\r\n");
    setze(view, 0, view.state.doc.length);
    expect(taste(view, "Tab")).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(`${EINRUECKUNG}<p>a</p>\r\n${EINRUECKUNG}<p>b</p>\r\n`);
  });
});

describe("Code-Editor: Escape und danach Tab verlässt den Editor", () => {
  it("nach Escape fängt der Editor Tab und Shift+Tab nicht ab, der Text bleibt gleich", () => {
    const { view } = editor("<p>Text</p>");
    setze(view, 3);
    expect(taste(view, "Escape")).toBe(false);
    expect(taste(view, "Tab")).toBe(false);
    expect(taste(view, "Tab", true)).toBe(false);
    expect(text(view)).toBe("<p>Text</p>");
  });

  it("der Modus endet nach 2 s oder bei einer anderen Taste, danach rückt Tab wieder ein", () => {
    const { view } = editor("<p>Text</p>");
    setze(view, 3);
    const jetzt = Date.now();
    const uhr = vi.spyOn(Date, "now").mockReturnValue(jetzt);
    taste(view, "Escape");
    uhr.mockReturnValue(jetzt + 2001);
    expect(taste(view, "Tab")).toBe(true);
    expect(text(view)).toBe(`${EINRUECKUNG}<p>Text</p>`);

    taste(view, "Escape");
    taste(view, "ArrowRight");
    expect(taste(view, "Tab")).toBe(true);
    expect(text(view)).toBe(`${EINRUECKUNG}${EINRUECKUNG}<p>Text</p>`);
  });

  it("mit Markierung hebt das erste Escape die Markierung auf, erst nach dem zweiten verlässt Tab den Editor", () => {
    const { view } = editor("<p>Text</p>");
    setze(view, 3, 7);
    expect(taste(view, "Escape")).toBe(true);
    expect(view.state.selection.main.empty).toBe(true);
    expect(taste(view, "Escape")).toBe(false);
    expect(taste(view, "Tab")).toBe(false);
    expect(text(view)).toBe("<p>Text</p>");
  });
});
