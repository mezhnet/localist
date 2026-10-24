// Markdown <-> BlockNote-Blöcke. Markdown ist die Quelle der Wahrheit (siehe CLAUDE.md).
// Diese Datei ist vorerst ein Platzhalter mit den verbindlichen Signaturen.
import type { VaultBlock, VaultPartialBlock } from "../editor/schema";

export interface SplitResult {
  /** Frontmatter-Block inklusive der Begrenzer "---" und abschließendem Zeilenumbruch, sonst null. */
  frontmatter: string | null;
  /** Der restliche Markdown-Text ohne Frontmatter. */
  body: string;
}

/** Trennt ein YAML-Frontmatter am Dateianfang vom Inhalt, ohne es zu interpretieren. */
export function splitFrontmatter(_text: string): SplitResult {
  throw new Error("noch nicht implementiert");
}

/** Setzt Frontmatter und Inhalt wieder zusammen; splitFrontmatter(joinFrontmatter(f, b)) == { f, b }. */
export function joinFrontmatter(_frontmatter: string | null, _body: string): string {
  throw new Error("noch nicht implementiert");
}

/** Wandelt Markdown (ohne Frontmatter) in BlockNote-Blöcke um. */
export function markdownToBlocks(_body: string): VaultPartialBlock[] {
  throw new Error("noch nicht implementiert");
}

/** Wandelt BlockNote-Blöcke zurück in Markdown (ohne Frontmatter). */
export function blocksToMarkdown(_blocks: VaultBlock[]): string {
  throw new Error("noch nicht implementiert");
}
