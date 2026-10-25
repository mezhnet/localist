// Trennt das YAML-Frontmatter vom Seiteninhalt, ohne es zu verändern.
// Das Frontmatter wird hier nicht interpretiert: Es bleibt Zeichen für Zeichen erhalten.

export interface SplitResult {
  /** Frontmatter-Block inklusive der Begrenzer "---" und abschließendem Zeilenumbruch, sonst null. */
  frontmatter: string | null;
  /** Der restliche Markdown-Text ohne Frontmatter. */
  body: string;
}

const OPENING = /^---[ \t]*\r?\n/;
// Obsidian und Jekyll beenden Frontmatter mit "---", YAML erlaubt auch "...".
const CLOSING = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m;

/** Trennt ein YAML-Frontmatter am Dateianfang vom Inhalt, ohne es zu interpretieren. */
export function splitFrontmatter(text: string): SplitResult {
  const opening = OPENING.exec(text);
  if (!opening) return { frontmatter: null, body: text };

  const rest = text.slice(opening[0].length);
  const closing = CLOSING.exec(rest);
  if (!closing) return { frontmatter: null, body: text };

  const end = opening[0].length + closing.index + closing[0].length;
  return { frontmatter: text.slice(0, end), body: text.slice(end) };
}

/** Setzt Frontmatter und Inhalt wieder zusammen; splitFrontmatter(joinFrontmatter(f, b)) == { f, b }. */
export function joinFrontmatter(frontmatter: string | null, body: string): string {
  if (frontmatter === null) return body;
  // Fehlt der Zeilenumbruch nach dem schließenden "---", würde der Inhalt sonst daran kleben.
  const needsBreak = body !== "" && !frontmatter.endsWith("\n");
  return frontmatter + (needsBreak ? "\n" : "") + body;
}
