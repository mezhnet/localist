// Code-Editor für HTML-Seiten (CodeMirror 6): Syntaxhervorhebung, Zeilennummern, Einklappen, Suchen und
// Ersetzen, Autovervollständigung für HTML-Tags. Farben kommen aus tokens.css (hell und dunkel).
// Der Editor kennt keine Dateien: Er bekommt einen Text und meldet jede Änderung (mit dem Zeilenende der Datei).
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

interface Props {
  /** Startinhalt. Wird nur übernommen, wenn sich `docVersion` ändert (z. B. nach Änderungen von außen). */
  value: string;
  docVersion: number;
  /** Zeilenende der Datei ("\r\n" oder "\n"): Enter fügt es ein, beim Melden bleibt es erhalten. */
  lineBreak: string;
  dark: boolean;
  label: string;
  onChange: (value: string) => void;
}

/** Beschriftungen von CodeMirror auf Deutsch (Suchen und Ersetzen, Einklappen, Vorschläge). */
const GERMAN = {
  Find: "Suchen",
  Replace: "Ersetzen",
  next: "weiter",
  previous: "zurück",
  all: "alle",
  "match case": "Groß/klein",
  "by word": "ganzes Wort",
  regexp: "regulärer Ausdruck",
  replace: "ersetzen",
  "replace all": "alle ersetzen",
  close: "schließen",
  "current match": "aktueller Treffer",
  "replaced $ matches": "$ Treffer ersetzt",
  "replaced match on line $": "Treffer in Zeile $ ersetzt",
  "on line": "in Zeile",
  "Go to line": "Gehe zu Zeile",
  go: "los",
  "Folded lines": "Eingeklappte Zeilen",
  "Unfolded lines": "Ausgeklappte Zeilen",
  to: "bis",
  "folded code": "eingeklappter Code",
  unfold: "ausklappen",
  "Fold line": "Zeile einklappen",
  "Unfold line": "Zeile ausklappen",
  Completions: "Vorschläge",
};

/** Farben der Hervorhebung: nur Variablen aus tokens.css, damit hell und dunkel passen. */
const highlightStyle = HighlightStyle.define([
  { tag: tags.tagName, color: "var(--color-code-tag)" },
  { tag: tags.attributeName, color: "var(--color-code-attribute)" },
  { tag: [tags.attributeValue, tags.string], color: "var(--color-code-string)" },
  { tag: tags.comment, color: "var(--color-code-comment)", fontStyle: "italic" },
  { tag: [tags.keyword, tags.documentMeta, tags.processingInstruction, tags.definitionKeyword], color: "var(--color-code-keyword)" },
  { tag: [tags.number, tags.bool, tags.atom, tags.unit], color: "var(--color-code-number)" },
  { tag: [tags.propertyName, tags.className], color: "var(--color-code-attribute)" },
  { tag: [tags.angleBracket, tags.bracket, tags.punctuation, tags.separator], color: "var(--color-text-faint)" },
  { tag: tags.invalid, color: "var(--color-danger)" },
]);

const editorTheme = (dark: boolean) =>
  EditorView.theme(
    {
      "&": { height: "100%", color: "var(--color-text)", backgroundColor: "var(--color-bg)", fontSize: "var(--font-size-sm)" },
      ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "var(--line-height-normal)" },
      ".cm-content": { caretColor: "var(--color-accent)", padding: "var(--space-2) 0" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-accent)" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--color-code-selection) !important" },
      ".cm-gutters": { backgroundColor: "var(--color-bg-subtle)", color: "var(--color-code-gutter)", border: "none", borderRight: "var(--border-width) solid var(--color-border)" },
      ".cm-activeLine": { backgroundColor: "var(--color-accent-softer)" },
      ".cm-activeLineGutter": { backgroundColor: "var(--color-hover)", color: "var(--color-text-muted)" },
      ".cm-foldPlaceholder": { backgroundColor: "var(--color-bg-muted)", border: "none", color: "var(--color-text-muted)" },
      ".cm-matchingBracket": { backgroundColor: "var(--color-accent-soft)", outline: "none" },
      ".cm-selectionMatch": { backgroundColor: "var(--color-highlight)" },
      ".cm-searchMatch": { backgroundColor: "var(--color-highlight)", outline: "var(--border-width) solid var(--color-warning)" },
      ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--color-accent-soft)" },
      ".cm-panels": { backgroundColor: "var(--color-bg-subtle)", color: "var(--color-text)" },
      ".cm-panels-top": { borderBottom: "var(--border-width) solid var(--color-border)" },
      ".cm-panel.cm-search": { padding: "var(--space-2) var(--space-3)", fontFamily: "var(--font-sans)", fontSize: "var(--font-size-sm)" },
      ".cm-panel.cm-search input, .cm-panel.cm-search button": { fontFamily: "var(--font-sans)", fontSize: "var(--font-size-sm)" },
      ".cm-textfield": {
        backgroundColor: "var(--color-surface)",
        color: "var(--color-text)",
        border: "var(--border-width) solid var(--color-border-strong)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-0-5) var(--space-1-5)",
      },
      ".cm-button": {
        backgroundImage: "none",
        backgroundColor: "var(--color-surface)",
        color: "var(--color-text)",
        border: "var(--border-width) solid var(--color-border-strong)",
        borderRadius: "var(--radius-sm)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--color-surface-raised)",
        color: "var(--color-text)",
        border: "none",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--color-accent)", color: "var(--color-text-on-accent)" },
      ".cm-specialChar": { color: "var(--color-danger)" },
    },
    { dark },
  );

export function CodeEditor({ value, docVersion, lineBreak, dark, label, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const themeSlot = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Während der Inhalt von außen ersetzt wird, keine Änderung melden.
  const replacing = useRef(false);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        EditorState.lineSeparator.of(lineBreak),
        EditorState.phrases.of(GERMAN),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        html({ autoCloseTags: true, selfClosingTags: false }),
        syntaxHighlighting(highlightStyle),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": label }),
        themeSlot.current.of(editorTheme(dark)),
        EditorView.updateListener.of((update) => {
          // sliceDoc() nutzt das Zeilenende der Datei (doc.toString() immer "\n").
          if (update.docChanged && !replacing.current) onChangeRef.current(update.state.sliceDoc());
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // Der Editor wird nur einmal je Zeilenende aufgebaut; neuer Inhalt kommt über docVersion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineBreak]);

  // Inhalt von außen ersetzen (Neuladen, Umschalten „Ganze Datei“).
  useEffect(() => {
    const current = view.current;
    if (!current || current.state.sliceDoc() === value) return;
    replacing.current = true;
    current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } });
    replacing.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docVersion]);

  useEffect(() => {
    view.current?.dispatch({ effects: themeSlot.current.reconfigure(editorTheme(dark)) });
  }, [dark]);

  return <div ref={host} className="code-editor" />;
}
