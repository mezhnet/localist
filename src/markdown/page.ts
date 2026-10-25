// Eine Seite als Ganzes: Frontmatter (bleibt unverändert), Inhalt als Editor-Blöcke und
// Dateieigenschaften wie Zeilenenden, damit beim Speichern keine unnötigen Änderungen entstehen.
import type { VaultBlock, VaultPartialBlock } from "../editor/schema";
import { blocksToMarkdown, markdownToBlocks } from "./blocks";
import { joinFrontmatter, splitFrontmatter } from "./frontmatter";

export interface PageFormat {
  /** Frontmatter genau so, wie es in der Datei stand (oder null). */
  frontmatter: string | null;
  /** Leerzeilen zwischen Frontmatter und erstem Block. */
  leadingBlankLines: string;
  /** Zeilenende der Datei. Windows-Dateien behalten "\r\n". */
  eol: "\n" | "\r\n";
  /** Byte-Order-Mark am Dateianfang, wie ihn manche Windows-Editoren schreiben. */
  bom: boolean;
}

export interface ParsedPage {
  format: PageFormat;
  blocks: VaultPartialBlock[];
}

export function parsePage(text: string): ParsedPage {
  const bom = text.startsWith("﻿");
  const withoutBom = bom ? text.slice(1) : text;
  const { frontmatter, body } = splitFrontmatter(withoutBom);
  const eol = /\r\n/.test(body) || (body === "" && /\r\n/.test(frontmatter ?? "")) ? "\r\n" : "\n";
  const normalized = body.replace(/\r\n?/g, "\n");
  const leadingBlankLines = /^\n*/.exec(normalized)![0];
  return {
    format: { frontmatter, leadingBlankLines, eol, bom },
    blocks: markdownToBlocks(normalized),
  };
}

export function serializePage(format: PageFormat, blocks: readonly (VaultBlock | VaultPartialBlock)[]): string {
  const markdown = blocksToMarkdown(blocks);
  let body = markdown === "" ? "" : format.leadingBlankLines + markdown;
  if (format.eol === "\r\n") body = body.replace(/\n/g, "\r\n");
  return (format.bom ? "﻿" : "") + joinFrontmatter(format.frontmatter, body);
}
