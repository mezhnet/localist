// Gemeinsames Editor-Schema für BlockNote. Konverter und Oberfläche nutzen dieselben Typen.
// Es enthält nur Blöcke und Formatierungen, die sich verlustfrei als Markdown speichern lassen.
import {
  BlockNoteSchema,
  createBlockSpec,
  createBulletListItemBlockSpec,
  createCheckListItemBlockSpec,
  createCodeBlockSpec,
  createDividerBlockSpec,
  createHeadingBlockSpec,
  createImageBlockSpec,
  createNumberedListItemBlockSpec,
  createParagraphBlockSpec,
  createQuoteBlockSpec,
  createStyleSpec,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import { createCalloutBlockSpec } from "./callout";
import { WikiLink } from "./wikilink";

/**
 * Markdown, das der Editor (noch) nicht als eigenen Block kennt, z. B. Tabellen oder HTML.
 * Der Originaltext steht in `source` und wird beim Speichern unverändert zurückgeschrieben.
 */
const createRawMarkdownBlockSpec = createBlockSpec(
  {
    type: "rawMarkdown" as const,
    propSchema: { source: { default: "" as string } },
    content: "none" as const,
  },
  {
    render: (block) => {
      const pre = document.createElement("pre");
      pre.className = "md-raw-block";
      pre.title = "Unveränderter Markdown-Text (wird beim Speichern so übernommen)";
      pre.textContent = block.props.source;
      return { dom: pre };
    },
  },
);

/** Markdown im Fließtext, das wörtlich erhalten bleibt (z. B. Inline-HTML oder Fußnoten). */
const rawStyle = createStyleSpec(
  { type: "raw", propSchema: "boolean" },
  {
    render: () => {
      const span = document.createElement("span");
      span.className = "md-raw";
      return { dom: span, contentDOM: span };
    },
  },
);

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: createParagraphBlockSpec(),
    heading: createHeadingBlockSpec({ allowToggleHeadings: false }),
    bulletListItem: createBulletListItemBlockSpec(),
    numberedListItem: createNumberedListItemBlockSpec(),
    checkListItem: createCheckListItemBlockSpec(),
    quote: createQuoteBlockSpec(),
    codeBlock: createCodeBlockSpec({ defaultLanguage: "" }),
    image: createImageBlockSpec(),
    divider: createDividerBlockSpec(),
    rawMarkdown: createRawMarkdownBlockSpec(),
    callout: createCalloutBlockSpec(),
  },
  styleSpecs: {
    bold: defaultStyleSpecs.bold,
    italic: defaultStyleSpecs.italic,
    underline: defaultStyleSpecs.underline,
    strike: defaultStyleSpecs.strike,
    code: defaultStyleSpecs.code,
    raw: rawStyle,
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, wikilink: WikiLink },
});

export type VaultBlock = typeof schema.Block;
export type VaultPartialBlock = typeof schema.PartialBlock;
export type VaultEditor = typeof schema.BlockNoteEditor;
