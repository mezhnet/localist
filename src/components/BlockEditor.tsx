// Der Block-Editor (BlockNote) für eine Seite. Er kennt keine Dateien: Er bekommt Blöcke
// und meldet jede Änderung. Laden und Speichern übernimmt PageView.
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { de } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  FileCaptionButton,
  FileDeleteButton,
  FormattingToolbar,
  FormattingToolbarController,
  NestBlockButton,
  UnnestBlockButton,
  useCreateBlockNote,
} from "@blocknote/react";
import { schema, type VaultEditor, type VaultPartialBlock } from "../editor/schema";

interface Props {
  initialBlocks: VaultPartialBlock[];
  onChange: (editor: VaultEditor) => void;
  /** Wandelt eine Bildadresse aus dem Markdown in eine anzeigbare Adresse um. */
  resolveFileUrl: (url: string) => Promise<string>;
}

const dictionary = {
  ...de,
  placeholders: { ...de.placeholders, default: "Schreibe etwas …", emptyDocument: "Schreibe etwas …" },
};

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
      <NestBlockButton key="nestBlockButton" />
      <UnnestBlockButton key="unnestBlockButton" />
      <CreateLinkButton key="createLinkButton" />
    </FormattingToolbar>
  );
}

export function BlockEditor({ initialBlocks, onChange, resolveFileUrl }: Props) {
  const editor = useCreateBlockNote(
    {
      schema,
      dictionary,
      initialContent: initialBlocks.length > 0 ? initialBlocks : undefined,
      resolveFileUrl,
    },
    [],
  );

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      onChange={() => onChange(editor)}
      formattingToolbar={false}
      // Slash-Menü und Ziehgriff folgen in Etappe 2.
      slashMenu={false}
      sideMenu={false}
      className="block-editor"
    >
      <FormattingToolbarController formattingToolbar={MarkdownFormattingToolbar} />
    </BlockNoteView>
  );
}
