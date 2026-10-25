// Code-Editor für HTML-Seiten (CodeMirror 6): Syntaxhervorhebung, Zeilennummern, Einklappen, Suchen und
// Ersetzen, Autovervollständigung für HTML-Tags und Bausteine, „/“-Menü zum Einfügen von Bausteinen.
// Farben kommen aus tokens.css (hell und dunkel).
// Der Editor kennt keine Dateien: Er bekommt einen Text und meldet jede Änderung (mit dem Zeilenende der Datei).
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { html, htmlLanguage } from "@codemirror/lang-html";
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, syntaxHighlighting, syntaxTree } from "@codemirror/language";
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
import { useEffect, useRef, type MutableRefObject } from "react";
import { BAUSTEIN_KLASSEN, BAUSTEIN_TAGS, planInsert } from "../lib/bausteine";

/** Was die Seite mit dem Editor machen kann (Werkzeugleiste). */
export interface CodeEditorApi {
  /** Fügt eine Vorlage eingerückt an der Cursorposition ein und markiert `auswahl`. */
  insert: (vorlage: readonly string[], auswahl?: string) => void;
  /** Der markierte Text (mit dem Zeilenende "\n"), leer ohne Markierung. */
  markierung: () => string;
}

/** Eintrag im „/“-Menü: eingebauter Baustein (id = Art) oder eigener (id = "eigen:<Name>"). */
export interface SlashEintrag {
  id: string;
  name: string;
  beschreibung: string;
}

interface Props {
  /** Startinhalt. Wird nur übernommen, wenn sich `docVersion` ändert (z. B. nach Änderungen von außen). */
  value: string;
  docVersion: number;
  /** Zeilenende der Datei ("\r\n" oder "\n"): Enter fügt es ein, beim Melden bleibt es erhalten. */
  lineBreak: string;
  dark: boolean;
  label: string;
  onChange: (value: string) => void;
  /** Hier legt der Editor seine Schnittstelle ab. */
  apiRef?: MutableRefObject<CodeEditorApi | null>;
  /** Einträge des „/“-Menüs. */
  slashEintraege?: SlashEintrag[];
  /** Ein Baustein wurde im „/“-Menü gewählt (das „/…“ ist schon entfernt, der Cursor steht an seiner Stelle). */
  onSlash?: (id: string) => void;
}

/** Hier darf „/“ das Bausteinmenü öffnen: nicht in Tags, Attributen, Kommentaren, Skripten und Styles. */
const NO_SLASH_MENU = new Set(["OpenTag", "CloseTag", "SelfClosingTag", "Attribute", "AttributeValue", "Comment", "ScriptText", "StyleText", "TextareaText"]);

/**
 * „/“-Menü: „/“ am Zeilenanfang (oder direkt nach einem Tag) zeigt alle Bausteine, weitere Buchstaben filtern.
 * Die Auswahl löscht „/…“ und übergibt den Baustein an `onSlash`.
 */
function slashMenu(eintraege: MutableRefObject<SlashEintrag[]>, onSlash: MutableRefObject<((id: string) => void) | undefined>) {
  return (context: CompletionContext): CompletionResult | null => {
    if (!onSlash.current || eintraege.current.length === 0) return null;
    const match = context.matchBefore(/\/[\p{L}\d-]*$/u);
    if (!match) return null;
    const line = context.state.doc.lineAt(match.from);
    const before = line.text.slice(0, match.from - line.from);
    if (!/^\s*$/.test(before) && !/>\s*$/.test(before)) return null;
    type Node = ReturnType<typeof syntaxTree>["topNode"];
    for (let node: Node | null = syntaxTree(context.state).resolve(match.from, -1); node; node = node.parent) {
      if (NO_SLASH_MENU.has(node.name)) return null;
    }
    return {
      from: match.from + 1,
      validFor: /^[\p{L}\d-]*$/u,
      options: eintraege.current.map((eintrag, index) => ({
        label: eintrag.name,
        detail: eintrag.beschreibung,
        type: eintrag.id.startsWith("eigen:") ? "variable" : "class",
        boost: -index,
        apply: (view: EditorView, _completion: unknown, from: number, to: number) => {
          view.dispatch({ changes: { from: from - 1, to, insert: "" } });
          onSlash.current?.(eintrag.id);
        },
      })),
    };
  };
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

export function CodeEditor({ value, docVersion, lineBreak, dark, label, onChange, apiRef, slashEintraege = [], onSlash }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const themeSlot = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSlashRef = useRef(onSlash);
  onSlashRef.current = onSlash;
  const slashRef = useRef(slashEintraege);
  slashRef.current = slashEintraege;
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
        html({ autoCloseTags: true, selfClosingTags: false, extraTags: BAUSTEIN_TAGS, extraGlobalAttributes: { class: BAUSTEIN_KLASSEN } }),
        htmlLanguage.data.of({ autocomplete: slashMenu(slashRef, onSlashRef) }),
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
    const editor = new EditorView({ state, parent: host.current });
    view.current = editor;
    if (apiRef) {
      apiRef.current = {
        insert: (vorlage, auswahl) => {
          // Planen mit "\n" (Positionen wie in CodeMirror), einfügen mit dem Zeilenende der Datei. Ist etwas markiert
          // (z. B. der Platzhalter des zuletzt eingefügten Bausteins), kommt der neue Baustein hinter diese Zeile.
          const selection = editor.state.selection.main;
          const pos = selection.empty ? selection.head : editor.state.doc.lineAt(selection.to).to;
          const plan = planInsert(editor.state.doc.toString(), pos, vorlage, auswahl);
          editor.dispatch({
            changes: { from: plan.from, to: plan.to, insert: plan.insert.split("\n").join(editor.state.lineBreak) },
            selection: { anchor: plan.anchor, head: plan.head },
            scrollIntoView: true,
            userEvent: "input",
          });
          editor.focus();
        },
        markierung: () => {
          const { from, to } = editor.state.selection.main;
          return editor.state.doc.sliceString(from, to);
        },
      };
    }
    return () => {
      if (apiRef?.current) apiRef.current = null;
      editor.destroy();
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
