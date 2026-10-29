// Der Block-Editor (BlockNote) für eine Seite. Er kennt keine Dateien: Er bekommt Blöcke
// und meldet jede Änderung. Laden und Speichern übernimmt PageView.
import "@blocknote/mantine/style.css";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { de } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  DragHandleMenu,
  FileCaptionButton,
  FileDeleteButton,
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  SuggestionMenuController,
  AddButton,
  DeleteButton,
  TableHandle,
  TableHandleMenu,
  TableHandlesController,
  type TableHandleMenuProps,
  useBlockNoteEditor,
  useComponentsContext,
  useCreateBlockNote,
  useEditorState,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { ChevronRight, FileCode, FileText, Info, ListIndentDecrease, ListIndentIncrease } from "lucide-react";
import { useContext, useEffect, useMemo, type FC } from "react";
import { markToggleOpen } from "../editor/callout";
import { darfEinruecken, einruecken, MarkdownEinruecken, type Richtung } from "../editor/einruecken";
import { schema, type VaultEditor, type VaultPartialBlock } from "../editor/schema";
import { WikiLinkContext, type WikiLinkActions } from "../editor/wikilink";
import { useTheme } from "../lib/theme";
import { abfrageSpeicher, bausteinMenu } from "./BausteinMenu";
import { useSchmal } from "./Reiterleiste";
import { Tastaturleiste, useSchreibt } from "./Tastaturleiste";

interface Props {
  initialBlocks: VaultPartialBlock[];
  onChange: (editor: VaultEditor) => void;
  /** Wird einmal mit dem fertigen Editor aufgerufen (z. B. um später den Inhalt zu lesen). */
  onReady?: (editor: VaultEditor) => void;
  /** Wandelt eine Bildadresse aus dem Markdown in eine anzeigbare Adresse um. */
  resolveFileUrl: (url: string) => Promise<string>;
}

/** Knopf zum Ein- bzw. Ausrücken, nach denselben Regeln wie Tab und Shift+Tab (src/editor/einruecken.ts). */
function EinrueckenButton({ richtung }: { richtung: Richtung }) {
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor(schema);
  const erlaubt = useEditorState({ editor, selector: ({ editor }) => darfEinruecken(editor.prosemirrorState, richtung) });
  const ein = richtung === "ein";
  const name = ein ? "Einrücken" : "Ausrücken";
  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      data-test={ein ? "nestBlock" : "unnestBlock"}
      onClick={() => {
        editor.focus();
        einruecken(editor, richtung);
      }}
      isDisabled={!erlaubt}
      label={name}
      mainTooltip={name}
      secondaryTooltip={ein ? "Tab" : "Umschalt+Tab"}
      icon={ein ? <ListIndentIncrease size={18} /> : <ListIndentDecrease size={18} />}
    />
  );
}

/** Nur Formatierungen, die sich als Markdown speichern lassen (keine Farben, keine Ausrichtung). */
function MarkdownFormattingToolbar() {
  return (
    <FormattingToolbar>
      <BlockTypeSelect key="blockTypeSelect" />
      <FileCaptionButton key="fileCaptionButton" />
      <FileDeleteButton key="fileDeleteButton" />
      <BasicTextStyleButton basicTextStyle="bold" key="boldStyleButton" />
      <BasicTextStyleButton basicTextStyle="italic" key="italicStyleButton" />
      <BasicTextStyleButton basicTextStyle="underline" key="underlineStyleButton" />
      <BasicTextStyleButton basicTextStyle="strike" key="strikeStyleButton" />
      <BasicTextStyleButton basicTextStyle="code" key="codeStyleButton" />
      <EinrueckenButton richtung="ein" key="nestBlockButton" />
      <EinrueckenButton richtung="aus" key="unnestBlockButton" />
      <CreateLinkButton key="createLinkButton" />
    </FormattingToolbar>
  );
}

/** Menü am Ziehgriff: nur "Löschen" (Farben lassen sich nicht als Markdown speichern). */
function MarkdownDragHandleMenu() {
  return (
    <DragHandleMenu>
      <RemoveBlockItem>{de.drag_handle.delete_menuitem}</RemoveBlockItem>
    </DragHandleMenu>
  );
}

/**
 * Menü am Griff einer Tabellenzeile oder -spalte: nur Löschen und Hinzufügen. Kopfspalten, mehrere Kopfzeilen und
 * Farben lassen sich in einer Markdown-Tabelle nicht speichern.
 */
function MarkdownTableHandleMenu(props: TableHandleMenuProps) {
  return (
    <TableHandleMenu {...props}>
      <DeleteButton orientation={props.orientation} />
      {props.orientation === "row" ? (
        <>
          <AddButton orientation="row" side="above" />
          <AddButton orientation="row" side="below" />
        </>
      ) : (
        <>
          <AddButton orientation="column" side="left" />
          <AddButton orientation="column" side="right" />
        </>
      )}
    </TableHandleMenu>
  );
}

/** Einträge des Slash-Menüs: Standardblöcke von BlockNote plus Callout und Toggle. */
export function slashMenuItems(editor: VaultEditor): DefaultReactSuggestionItem[] {
  const defaults = getDefaultReactSlashMenuItems(editor);
  const group = defaults.find((item) => item.title === de.slash_menu.quote.title)?.group;
  const callout: DefaultReactSuggestionItem = {
    title: "Callout",
    subtext: "Hervorgehobener Kasten mit Symbol",
    aliases: ["callout", "hinweis", "info", "kasten", "warnung"],
    group,
    icon: <Info aria-hidden="true" size={18} />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { calloutType: "info", fold: "" } }),
  };
  const toggle: DefaultReactSuggestionItem = {
    title: "Toggle",
    subtext: "Einklappbarer Abschnitt",
    aliases: ["toggle", "aufklappen", "einklappen", "details"],
    group,
    icon: <ChevronRight aria-hidden="true" size={18} />,
    onItemClick: () => {
      // Ein neuer Toggle ist zum Weiterschreiben offen, in der Datei startet er zugeklappt ("-").
      markToggleOpen(editor.getTextCursorPosition().block.id);
      insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { calloutType: "note", fold: "-" } });
    },
  };
  // Namen und Reihenfolge wie im Menü der Vorlage: Text, Überschrift, Checkliste, Callout, Toggle, Tabelle, Bild, …
  const umbenannt = defaults.map((item) =>
    item.title === de.slash_menu.paragraph.title
      ? { ...item, title: "Text", aliases: [...(item.aliases ?? []), "absatz"] }
      : item.title === de.slash_menu.heading.title
        ? { ...item, title: "Überschrift", aliases: [...(item.aliases ?? []), "überschrift 1"] }
        : item,
  );
  const zuerst = ["Text", "Überschrift", "Checkliste", "Callout", "Toggle", "Tabelle", "Bild"];
  const alle = [...umbenannt, callout, toggle];
  const rang = (titel: string) => (zuerst.includes(titel) ? zuerst.indexOf(titel) : zuerst.length);
  return alle.map((item, index) => ({ item, index })).sort((a, b) => rang(a.item.title) - rang(b.item.title) || a.index - b.index).map(({ item }) => item);
}

/** Vorschläge nach "[[": passende Seiten, sonst ein Link auf eine noch fehlende Seite. */
function linkMenuItems(editor: VaultEditor, links: WikiLinkActions, query: string): DefaultReactSuggestionItem[] {
  const insert = (target: string) => () => {
    editor.insertInlineContent([{ type: "wikilink", props: { target, alias: "" } }, " "]);
  };
  const items: DefaultReactSuggestionItem[] = links.suggest(query).map((page) => ({
    title: page.title,
    subtext: page.folder || "Vault",
    icon: page.html ? <FileCode aria-hidden="true" size={18} /> : <FileText aria-hidden="true" size={18} />,
    onItemClick: insert(page.target),
  }));
  const name = query.trim();
  if (name && !items.some((item) => item.title.toLowerCase() === name.toLowerCase())) {
    items.push({
      title: `„${name}“ verlinken`,
      subtext: "Seite gibt es noch nicht – ein Klick auf den Link legt sie an",
      icon: <span aria-hidden="true">➕</span>,
      onItemClick: insert(name),
    });
  }
  return items;
}

/** Deutsche Texte von BlockNote; ein leerer Block zeigt „Baustein wählen …“ (Vorlage 02). */
export const WOERTERBUCH = { ...de, placeholders: { ...de.placeholders, default: "Baustein wählen …", emptyDocument: "Baustein wählen …" } };

export function BlockEditor({ initialBlocks, onChange, onReady, resolveFileUrl }: Props) {
  const { dark } = useTheme();
  const links = useContext(WikiLinkContext);
  // Was nach „/“ getippt wurde (für die Filterzeile im Menü „Baustein wählen …“).
  const slashAbfrage = useMemo(abfrageSpeicher, []);
  const BausteinMenu = useMemo(() => bausteinMenu(slashAbfrage), [slashAbfrage]);
  const editor = useCreateBlockNote(
    {
      schema,
      dictionary: WOERTERBUCH,
      initialContent: initialBlocks.length > 0 ? initialBlocks : undefined,
      resolveFileUrl,
      // Tab rückt immer ein (eigene Regeln in MarkdownEinruecken), statt in die Formatierungsleiste zu springen.
      tabBehavior: "prefer-indent",
      extensions: [MarkdownEinruecken],
    },
    [],
  );
  useEffect(() => {
    onReady?.(editor);
  }, [editor, onReady]);
  // Handy: Beim Schreiben steht über der Tastatur die Leiste mit „+“, Checkliste, Callout, Toggle, Bild und „Fertig“.
  const schmal = useSchmal();
  const schreibt = useSchreibt(editor);

  return (
    <>
    <BlockNoteView
      editor={editor}
      theme={dark ? "dark" : "light"}
      onChange={() => onChange(editor)}
      formattingToolbar={false}
      slashMenu={false}
      sideMenu={false}
      tableHandles={false}
      className="block-editor"
    >
      <FormattingToolbarController formattingToolbar={MarkdownFormattingToolbar} />
      <SideMenuController sideMenu={(props) => <SideMenu {...props} dragHandleMenu={MarkdownDragHandleMenu} />} />
      {/* Tabellen: Zeilen und Spalten hinzufügen, verschieben und löschen; keine Zellen-Griffe (Verbinden, Farben). */}
      <TableHandlesController
        tableHandle={(props) => <TableHandle {...props} tableHandleMenu={MarkdownTableHandleMenu as FC} />}
        tableCellHandle={() => null}
      />
      <SuggestionMenuController
        triggerCharacter="/"
        suggestionMenuComponent={BausteinMenu}
        getItems={async (query) => {
          slashAbfrage.setzen(query);
          return filterSuggestionItems(slashMenuItems(editor), query);
        }}
      />
      <SuggestionMenuController triggerCharacter="[[" getItems={async (query) => linkMenuItems(editor, links, query)} />
    </BlockNoteView>
    {schmal && schreibt && <Tastaturleiste editor={editor} onBild={() => slashMenuItems(editor).find((item) => item.title === "Bild")?.onItemClick()} />}
    </>
  );
}
