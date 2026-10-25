// Markdown (ohne Frontmatter) <-> BlockNote-Blöcke.
//
// Unterstützt: Überschriften, Absätze, Aufzählungen, nummerierte Listen, Checklisten, Zitate,
// Code-Blöcke, Bilder und Trennlinien. Alles andere (Tabellen, HTML …) wird als "rawMarkdown"-Block
// wörtlich übernommen, damit beim Speichern nichts verloren geht.
import type { Code, Image, List, Paragraph, RootContent } from "mdast";
import type { VaultBlock, VaultPartialBlock } from "../editor/schema";
import {
  inlineToMarkdown,
  inlineToPlainText,
  normalizeInline,
  phrasingToInline,
  sliceSource,
  type InlineInput,
} from "./inline";
import { parseMarkdown, stringifyMarkdown } from "./mdast";

/** Gemeinsame, lockere Sicht auf Blöcke aus dem Editor (Block) und aus dem Konverter (PartialBlock). */
interface LooseBlock {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: readonly LooseBlock[];
}

// ---------------------------------------------------------------------------
// Markdown → Blöcke

/** Wandelt Markdown (ohne Frontmatter) in BlockNote-Blöcke um. */
export function markdownToBlocks(body: string): VaultPartialBlock[] {
  const source = body.replace(/\r\n?/g, "\n");
  const tree = parseMarkdown(source);
  return convertFlow(tree.children, source, true) as VaultPartialBlock[];
}

function convertFlow(nodes: readonly RootContent[], source: string, topLevel: boolean): LooseBlock[] {
  const out: LooseBlock[] = [];
  nodes.forEach((node, index) => {
    // Mehr als eine Leerzeile zwischen zwei Blöcken wird als leere Absätze erhalten.
    if (topLevel && index > 0) {
      const previous = nodes[index - 1];
      const gap = (node.position?.start.line ?? 0) - (previous.position?.end.line ?? 0) - 1;
      for (let i = 1; i < gap; i++) out.push({ type: "paragraph", content: [] });
    }
    if (!topLevel || isSupported(node)) {
      out.push(...convertNode(node, source));
    } else {
      out.push(rawBlock(sliceSource(node, source)));
    }
  });
  return out;
}

/** Kann der Knoten samt Inhalt verlustfrei als Editor-Blöcke dargestellt werden? */
function isSupported(node: RootContent): boolean {
  switch (node.type) {
    case "heading":
    case "paragraph":
    case "code":
    case "thematicBreak":
      return true;
    case "list":
      // Nummerierte Checklisten ("1. [ ] …") kennt der Editor nicht.
      if (node.ordered && node.children.some((item) => item.checked !== null && item.checked !== undefined)) return false;
      return node.children.every((item) => item.children.every(isSupported));
    case "blockquote":
      return node.children[0]?.type === "paragraph" && node.children.every(isSupported);
    default:
      return false;
  }
}

function rawBlock(source: string): LooseBlock {
  return { type: "rawMarkdown", props: { source } };
}

function convertNode(node: RootContent, source: string): LooseBlock[] {
  switch (node.type) {
    case "heading":
      return [{ type: "heading", props: { level: node.depth }, content: phrasingToInline(node.children, source) }];
    case "paragraph": {
      const image = soleImage(node);
      if (image) return [{ type: "image", props: { url: image.url, caption: image.alt ?? "" } }];
      return [{ type: "paragraph", content: phrasingToInline(node.children, source) }];
    }
    case "list":
      return convertList(node, source);
    case "blockquote": {
      const [first, ...rest] = node.children;
      return [
        {
          type: "quote",
          content: phrasingToInline((first as Paragraph).children, source),
          children: convertFlow(rest, source, false),
        },
      ];
    }
    case "code":
      return [{ type: "codeBlock", props: { language: codeLanguage(node) }, content: node.value }];
    case "thematicBreak":
      return [{ type: "divider" }];
    default:
      return [rawBlock(sliceSource(node, source))];
  }
}

function soleImage(paragraph: Paragraph): Image | null {
  const [only] = paragraph.children;
  if (paragraph.children.length !== 1 || only.type !== "image" || only.title) return null;
  return only;
}

function codeLanguage(code: Code): string {
  return [code.lang, code.meta].filter(Boolean).join(" ");
}

function convertList(list: List, source: string): LooseBlock[] {
  return list.children.map((item, index) => {
    const checked = item.checked !== null && item.checked !== undefined;
    const type = list.ordered ? "numberedListItem" : checked ? "checkListItem" : "bulletListItem";
    const props: Record<string, unknown> = {};
    if (type === "checkListItem") props.checked = item.checked === true;
    if (type === "numberedListItem" && index === 0 && typeof list.start === "number" && list.start !== 1) {
      props.start = list.start;
    }

    const [first, ...rest] = item.children;
    const hasText = first?.type === "paragraph";
    return {
      type,
      props,
      content: hasText ? phrasingToInline(first.children, source) : [],
      children: convertFlow(hasText ? rest : item.children, source, false),
    };
  });
}

// ---------------------------------------------------------------------------
// Blöcke → Markdown

/** Wandelt BlockNote-Blöcke zurück in Markdown (ohne Frontmatter). */
export function blocksToMarkdown(blocks: readonly (VaultBlock | VaultPartialBlock)[]): string {
  const text = serializeFlow(blocks as readonly LooseBlock[], true);
  return text === "" ? "" : `${text}\n`;
}

const BULLET_TYPES = new Set(["bulletListItem", "checkListItem"]);

function isEmptyParagraph(block: LooseBlock): boolean {
  return (
    (block.type ?? "paragraph") === "paragraph" &&
    normalizeInline(block.content as InlineInput).length === 0 &&
    (block.children?.length ?? 0) === 0
  );
}

function sameList(previous: LooseBlock, next: LooseBlock): boolean {
  if (BULLET_TYPES.has(previous.type ?? "") && BULLET_TYPES.has(next.type ?? "")) return true;
  return previous.type === "numberedListItem" && next.type === "numberedListItem";
}

function serializeFlow(blocks: readonly LooseBlock[], topLevel: boolean): string {
  let out = "";
  let previous: LooseBlock | null = null;
  let emptyParagraphs = 0;
  let number = 0;

  for (const block of blocks) {
    if (isEmptyParagraph(block)) {
      if (previous && topLevel) emptyParagraphs++;
      continue;
    }

    const continuesList = previous !== null && emptyParagraphs === 0 && sameList(previous, block);
    if (block.type === "numberedListItem") {
      number = continuesList ? number + 1 : startNumber(block);
    }
    const chunk = serializeBlock(block, number);
    if (chunk === "") continue;

    if (previous !== null) out += continuesList ? "\n" : "\n\n" + "\n".repeat(emptyParagraphs);
    out += chunk;
    previous = block;
    emptyParagraphs = 0;
  }
  return out;
}

function startNumber(block: LooseBlock): number {
  const start = block.props?.start;
  return typeof start === "number" && Number.isFinite(start) ? start : 1;
}

function serializeBlock(block: LooseBlock, number: number): string {
  const children = block.children ?? [];
  const props = block.props ?? {};
  switch (block.type ?? "paragraph") {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(props.level ?? 1)));
      const text = inlineToMarkdown(block.content as InlineInput, "heading");
      return appendSiblings(`${"#".repeat(level)}${text ? ` ${text}` : ""}`, children);
    }
    case "bulletListItem":
      return listItem("- ", inlineToMarkdown(block.content as InlineInput, "bullet"), children);
    case "checkListItem": {
      const marker = props.checked === true ? "- [x] " : "- [ ] ";
      return listItem(marker, inlineToMarkdown(block.content as InlineInput, "check"), children, "  ");
    }
    case "numberedListItem":
      return listItem(`${number}. `, inlineToMarkdown(block.content as InlineInput, "numbered"), children);
    case "quote":
      return quote(block, children);
    case "codeBlock":
      return appendSiblings(codeBlock(String(props.language ?? ""), plainText(block.content)), children);
    case "image":
      return appendSiblings(image(String(props.url ?? ""), String(props.caption ?? "")), children);
    case "divider":
      return appendSiblings("---", children);
    case "rawMarkdown":
      return appendSiblings(String(props.source ?? "").replace(/\n+$/, ""), children);
    default:
      return appendSiblings(inlineToMarkdown(block.content as InlineInput, "paragraph"), children);
  }
}

/** Markdown kennt keine eingerückten Kinder unter Absätzen: Sie folgen als normale Blöcke. */
function appendSiblings(text: string, children: readonly LooseBlock[]): string {
  const rest = serializeFlow(children, false);
  if (rest === "") return text;
  if (text === "") return rest;
  return `${text}\n\n${rest}`;
}

function indentLines(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? line : indent + line))
    .join("\n");
}

function listItem(marker: string, text: string, children: readonly LooseBlock[], childIndent?: string): string {
  const indent = childIndent ?? " ".repeat(marker.length);
  let out = marker + text.replace(/\n/g, `\n${indent}`);
  const visibleChildren = children.filter((child) => !isEmptyParagraph(child));
  if (visibleChildren.length > 0) {
    const nested = serializeFlow(visibleChildren, false);
    // Unterlisten und Code-Blöcke dürfen direkt folgen, ein Absatz braucht eine Leerzeile davor.
    const first = visibleChildren[0].type ?? "paragraph";
    const tight = /ListItem$/.test(first) || first === "codeBlock";
    out += (tight ? "\n" : "\n\n") + indentLines(nested, indent);
  }
  return out;
}

function quote(block: LooseBlock, children: readonly LooseBlock[]): string {
  const parts = [inlineToMarkdown(block.content as InlineInput, "quote")];
  const nested = serializeFlow(children, false);
  if (nested !== "") parts.push(nested);
  return parts
    .join("\n\n")
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");
}

function plainText(content: unknown): string {
  return inlineToPlainText(normalizeInline(content as InlineInput));
}

function codeBlock(language: string, code: string): string {
  const longest = Math.max(0, ...Array.from(code.matchAll(/`+/g), (m) => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${code}${code === "" ? "" : "\n"}${fence}`;
}

function image(url: string, caption: string): string {
  if (url === "") return "";
  const literal = `![${caption.replace(/([[\]\\])/g, "\\$1")}](${/[\s()<>]/.test(url) ? `<${url}>` : url})`;
  const reparsed = parseMarkdown(literal).children[0];
  if (reparsed?.type === "paragraph") {
    const parsedImage = soleImage(reparsed);
    if (parsedImage && parsedImage.url === url && (parsedImage.alt ?? "") === caption) return literal;
  }
  const escaped = stringifyMarkdown({
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "image", url, alt: caption, title: null }] }],
  });
  return escaped.replace(/\n$/, "");
}

