// Fließtext (Inline-Inhalt) zwischen Markdown-Syntaxbaum (mdast) und BlockNote umwandeln.
//
// Beim Speichern wird zuerst "wörtliches" Markdown ohne Maskierung erzeugt, damit z. B. [[Links]],
// a_b oder [!info] so bleiben, wie sie getippt wurden. Dieses Ergebnis wird erneut eingelesen und
// mit dem Editor-Inhalt verglichen. Nur wenn es abweicht, wird mit remark-stringify maskiert (\*, \[ …).
import type { Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import { parseMarkdown, stringifyMarkdown } from "./mdast";

export interface Styles {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  code?: true;
  raw?: true;
}

export interface TextRun {
  type: "text";
  text: string;
  styles: Styles;
}

export interface LinkRun {
  type: "link";
  href: string;
  content: TextRun[];
}

/** Link zwischen Seiten im Obsidian-Format: [[target]] oder [[target|alias]]. */
export interface WikiLinkRun {
  type: "wikilink";
  props: { target: string; alias: string };
}

export type InlineRun = TextRun | LinkRun | WikiLinkRun;

// [[Seite]], [[Ordner/Seite#Abschnitt|Anzeigetext]]; ein "!" davor ist eine Einbettung und bleibt Text.
const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;

/** Markdown-Schreibweise eines Seitenlinks. */
export function wikiLinkMarkdown(props: { target: string; alias: string }): string {
  return props.alias ? `[[${props.target}|${props.alias}]]` : `[[${props.target}]]`;
}

/** So sieht der Inhalt eines Blocks im Editor aus (als Zeichenkette oder als Liste). */
export type InlineInput = string | readonly unknown[] | undefined;

const STYLE_KEYS = ["strike", "bold", "italic", "underline", "code", "raw"] as const;
type StyleKey = (typeof STYLE_KEYS)[number];
type MarkKey = Exclude<StyleKey, "code" | "raw">;
const MARK_KEYS: readonly MarkKey[] = ["strike", "bold", "italic", "underline"];

// ---------------------------------------------------------------------------
// Markdown → Editor

/** Wandelt mdast-Fließtext in Editor-Inhalt um. `source` ist der Text, aus dem der Baum stammt. */
export function phrasingToInline(nodes: readonly PhrasingContent[], source: string): InlineRun[] {
  const out: InlineRun[] = [];
  convertPhrasing(nodes, source, {}, out, false);
  return mergeRuns(out);
}

function convertPhrasing(
  nodes: readonly PhrasingContent[],
  source: string,
  styles: Styles,
  out: InlineRun[],
  inLink: boolean,
): void {
  let current = styles;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    switch (node.type) {
      case "text":
        if (inLink || Object.keys(current).length > 0) pushText(out, node.value, current);
        else pushTextWithWikiLinks(out, node.value);
        break;
      case "strong":
        convertPhrasing(node.children, source, { ...current, bold: true }, out, inLink);
        break;
      case "emphasis":
        convertPhrasing(node.children, source, { ...current, italic: true }, out, inLink);
        break;
      case "delete":
        convertPhrasing(node.children, source, { ...current, strike: true }, out, inLink);
        break;
      case "inlineCode":
        pushText(out, node.value, { ...current, code: true });
        break;
      case "break":
        pushText(out, "\n", current);
        break;
      case "link":
        if (inLink || node.title) {
          pushText(out, sliceSource(node, source), { ...current, raw: true });
        } else {
          const content: InlineRun[] = [];
          convertPhrasing(node.children, source, current, content, true);
          out.push({ type: "link", href: node.url, content: mergeRuns(content) as TextRun[] });
        }
        break;
      case "html": {
        // <u>…</u> ist die übliche Markdown-Schreibweise für Unterstreichen (auch in Obsidian).
        const tag = node.value.trim().toLowerCase();
        if (tag === "<u>" && !current.underline && hasClosingUnderline(nodes, i + 1)) {
          current = { ...current, underline: true };
        } else if (tag === "</u>" && current.underline && !styles.underline) {
          current = withoutStyle(current, "underline");
        } else {
          pushText(out, node.value, { ...current, raw: true });
        }
        break;
      }
      default:
        // Bilder im Fließtext, Fußnoten, Referenz-Links …: wörtlich übernehmen.
        pushText(out, sliceSource(node, source), { ...current, raw: true });
    }
  }
}

/** Teilt unformatierten Text in Text und [[Links]]. Formatierte Links bleiben Text (z. B. **[[Seite]]**). */
function pushTextWithWikiLinks(out: InlineRun[], text: string): void {
  let last = 0;
  for (const match of text.matchAll(WIKILINK)) {
    if (match[1] === "!") continue;
    const inner = match[2];
    const bar = inner.indexOf("|");
    const target = (bar === -1 ? inner : inner.slice(0, bar)).trim();
    if (target === "") continue;
    pushText(out, text.slice(last, match.index), {});
    out.push({ type: "wikilink", props: { target, alias: bar === -1 ? "" : inner.slice(bar + 1).trim() } });
    last = match.index + match[0].length;
  }
  pushText(out, text.slice(last), {});
}

function hasClosingUnderline(nodes: readonly PhrasingContent[], from: number): boolean {
  for (let i = from; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === "html") {
      const tag = node.value.trim().toLowerCase();
      if (tag === "</u>") return true;
      if (tag === "<u>") return false;
    }
  }
  return false;
}

export function sliceSource(node: { position?: { start: { offset?: number }; end: { offset?: number } } }, source: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return "";
  return source.slice(start, end);
}

function pushText(out: InlineRun[], text: string, styles: Styles): void {
  if (text === "") return;
  out.push({ type: "text", text, styles: cleanStyles(styles) });
}

function withoutStyle(styles: Styles, key: StyleKey): Styles {
  const copy = { ...styles };
  delete copy[key];
  return copy;
}

function cleanStyles(styles: Styles): Styles {
  const result: Styles = {};
  for (const key of STYLE_KEYS) if (styles[key]) result[key] = true;
  return result;
}

function sameStyles(a: Styles, b: Styles): boolean {
  return STYLE_KEYS.every((key) => !!a[key] === !!b[key]);
}

/** Fasst benachbarte Textstücke mit gleicher Formatierung zusammen und entfernt leere. */
export function mergeRuns(runs: readonly InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (run.type === "link") {
      out.push({ type: "link", href: run.href, content: mergeRuns(run.content) as TextRun[] });
      continue;
    }
    if (run.type === "wikilink") {
      out.push(run);
      continue;
    }
    if (run.text === "") continue;
    const last = out[out.length - 1];
    if (last && last.type === "text" && sameStyles(last.styles, run.styles)) {
      out[out.length - 1] = { ...last, text: last.text + run.text };
    } else {
      out.push({ type: "text", text: run.text, styles: cleanStyles(run.styles) });
    }
  }
  return out;
}

/** Bringt Editor-Inhalt (Zeichenkette oder Liste von Textstücken/Links) in eine einheitliche Form. */
export function normalizeInline(content: InlineInput): InlineRun[] {
  if (content === undefined) return [];
  if (typeof content === "string") return content ? [{ type: "text", text: content, styles: {} }] : [];
  const runs: InlineRun[] = [];
  for (const item of content as readonly Record<string, unknown>[]) {
    if (typeof item === "string") {
      runs.push({ type: "text", text: item, styles: {} });
    } else if (item.type === "text") {
      runs.push({ type: "text", text: String(item.text ?? ""), styles: cleanStyles((item.styles ?? {}) as Styles) });
    } else if (item.type === "wikilink") {
      const props = (item.props ?? {}) as Record<string, unknown>;
      runs.push({ type: "wikilink", props: { target: String(props.target ?? ""), alias: String(props.alias ?? "") } });
    } else if (item.type === "link") {
      runs.push({
        type: "link",
        href: String(item.href ?? ""),
        content: normalizeInline(item.content as InlineInput).filter((r): r is TextRun => r.type === "text"),
      });
    }
  }
  return mergeRuns(runs);
}

/** Reiner Text ohne Formatierung, z. B. für Bildunterschriften. */
export function inlineToPlainText(runs: readonly InlineRun[]): string {
  return runs
    .map((run) => {
      if (run.type === "text") return run.text;
      if (run.type === "wikilink") return run.props.alias || run.props.target;
      return run.content.map((c) => c.text).join("");
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Editor → Markdown

/** In welchem Block der Text steht. Das bestimmt die Prüfung durch erneutes Einlesen. */
export type InlineContext = "paragraph" | "heading" | "bullet" | "check" | "numbered" | "quote";

/** Wandelt Editor-Inhalt in Markdown-Fließtext um (ohne Blockpräfix wie "# " oder "- "). */
export function inlineToMarkdown(content: InlineInput, context: InlineContext): string {
  let runs = normalizeInline(content);
  if (context === "heading") runs = runs.map(replaceNewlines);
  if (runs.length === 0) return "";

  const phrasing = buildPhrasing(runs);
  const literal = emitPhrasing(phrasing);
  if (sameInline(parseInlineIn(literal, context), runs)) return literal;

  return escapedPhrasing(phrasing, context);
}

function replaceNewlines(run: InlineRun): InlineRun {
  if (run.type === "wikilink") return run;
  if (run.type === "text") return { ...run, text: run.text.replace(/\n/g, " ") };
  return { ...run, content: run.content.map((c) => ({ ...c, text: c.text.replace(/\n/g, " ") })) };
}

/** Baut aus flachen Textstücken einen verschachtelten Baum mit möglichst wenigen Markierungen. */
export function buildPhrasing(runs: readonly InlineRun[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let i = 0;
  while (i < runs.length) {
    const run = runs[i];
    if (run.type === "link") {
      out.push({ type: "link", url: run.href, title: null, children: buildMarks(run.content, new Set()) });
      i++;
      continue;
    }
    if (run.type === "wikilink") {
      // Als wörtliches Markdown, damit es beim Maskieren nicht zu \[\[…]] wird.
      out.push({ type: "html", value: wikiLinkMarkdown(run.props) });
      i++;
      continue;
    }
    let j = i;
    while (j < runs.length && runs[j].type === "text") j++;
    out.push(...buildMarks(runs.slice(i, j) as TextRun[], new Set()));
    i = j;
  }
  return out;
}

function buildMarks(runs: readonly TextRun[], applied: Set<MarkKey>): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  let i = 0;
  while (i < runs.length) {
    const open = MARK_KEYS.filter((key) => runs[i].styles[key] && !applied.has(key));
    if (open.length === 0) {
      out.push(leaf(runs[i]));
      i++;
      continue;
    }
    // Die Markierung, die am weitesten reicht, kommt nach außen.
    let best = open[0];
    let bestEnd = i;
    for (const key of open) {
      let end = i;
      while (end + 1 < runs.length && runs[end + 1].styles[key]) end++;
      if (end > bestEnd) {
        best = key;
        bestEnd = end;
      }
    }
    const inner = buildMarks(runs.slice(i, bestEnd + 1), new Set([...applied, best]));
    out.push(...wrapMark(best, inner));
    i = bestEnd + 1;
  }
  return out;
}

function leaf(run: TextRun): PhrasingContent {
  if (run.styles.code) return { type: "inlineCode", value: run.text };
  if (run.styles.raw) return { type: "html", value: run.text };
  return { type: "text", value: run.text };
}

function wrapMark(key: MarkKey, children: PhrasingContent[]): PhrasingContent[] {
  switch (key) {
    case "bold":
      return [{ type: "strong", children }];
    case "italic":
      return [{ type: "emphasis", children }];
    case "strike":
      return [{ type: "delete", children }];
    case "underline":
      return [{ type: "html", value: "<u>" }, ...children, { type: "html", value: "</u>" }];
  }
}

/** Erzeugt Markdown ohne Maskierung. Leerzeichen am Rand einer Markierung kommen nach außen. */
export function emitPhrasing(nodes: readonly PhrasingContent[]): string {
  return nodes.map(emitNode).join("");
}

function emitNode(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "html":
      return node.value;
    case "inlineCode":
      return emitInlineCode(node.value);
    case "strong":
      return wrapDelimiter("**", emitPhrasing(node.children));
    case "emphasis":
      return wrapDelimiter("*", emitPhrasing(node.children));
    case "delete":
      return wrapDelimiter("~~", emitPhrasing(node.children));
    case "link": {
      const label = emitPhrasing(node.children);
      if (isAutolink(label, node.url, node.children)) return label;
      return `[${label}](${emitDestination(node.url)})`;
    }
    default:
      return "";
  }
}

function wrapDelimiter(delimiter: string, inner: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner)!;
  if (match[2] === "") return inner;
  return `${match[1]}${delimiter}${match[2]}${delimiter}${match[3]}`;
}

function emitInlineCode(value: string): string {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g), (m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = value.startsWith("`") || value.endsWith("`") || (/^ .* $/.test(value) && value.trim() !== "") ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}

function isAutolink(label: string, url: string, children: readonly PhrasingContent[]): boolean {
  if (children.length !== 1 || children[0].type !== "text") return false;
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return false;
  return label === url || `mailto:${label}` === url || `http://${label}` === url;
}

function emitDestination(url: string): string {
  if (url === "") return "<>";
  if (/[\s()<>]/.test(url)) return `<${url.replace(/[<>]/g, (c) => encodeURIComponent(c))}>`;
  return url;
}

/** Maskierte Variante über remark-stringify, falls das wörtliche Markdown anders gelesen würde. */
function escapedPhrasing(phrasing: PhrasingContent[], context: InlineContext): string {
  if (context === "heading") {
    const text = stringifyMarkdown({ type: "root", children: [{ type: "heading", depth: 1, children: phrasing }] });
    return text.replace(/^# ?/, "").replace(/\n$/, "");
  }
  const text = stringifyMarkdown({ type: "root", children: [{ type: "paragraph", children: phrasing }] });
  return text.replace(/\n$/, "");
}

// ---------------------------------------------------------------------------
// Prüfung: Liest wörtliches Markdown im passenden Zusammenhang wieder ein.

function indentContinuation(text: string, indent: string): string {
  return text.replace(/\n/g, `\n${indent}`);
}

function parseInlineIn(literal: string, context: InlineContext): InlineRun[] | null {
  let markdown: string;
  switch (context) {
    case "paragraph":
      markdown = literal;
      break;
    case "heading":
      markdown = `# ${literal}`;
      break;
    case "bullet":
      markdown = `- ${indentContinuation(literal, "  ")}`;
      break;
    case "check":
      markdown = `- [ ] ${indentContinuation(literal, "  ")}`;
      break;
    case "numbered":
      markdown = `1. ${indentContinuation(literal, "   ")}`;
      break;
    case "quote":
      markdown = `> ${literal.replace(/\n/g, "\n> ")}`;
      break;
  }
  const tree = parseMarkdown(markdown);
  const container = singleTextContainer(tree, context);
  if (!container) return null;
  return phrasingToInline(container.children, markdown);
}

function singleTextContainer(tree: Root, context: InlineContext): { children: PhrasingContent[] } | null {
  if (tree.children.length !== 1) return null;
  const node: RootContent = tree.children[0];
  switch (context) {
    case "paragraph":
      return node.type === "paragraph" ? node : null;
    case "heading":
      return node.type === "heading" && node.depth === 1 ? node : null;
    case "quote":
      return node.type === "blockquote" && node.children.length === 1 && node.children[0].type === "paragraph"
        ? (node.children[0] as Paragraph)
        : null;
    case "bullet":
    case "check":
    case "numbered": {
      if (node.type !== "list" || node.ordered !== (context === "numbered") || node.children.length !== 1) return null;
      const item = node.children[0];
      if ((item.checked !== null && item.checked !== undefined) !== (context === "check")) return null;
      if (item.children.length !== 1 || item.children[0].type !== "paragraph") return null;
      return item.children[0];
    }
  }
}

/** Vergleich Zeichen für Zeichen. Leerzeichen am Zeilenrand zählen nicht (Markdown ignoriert sie). */
function sameInline(parsed: InlineRun[] | null, original: InlineRun[]): boolean {
  if (parsed === null) return false;
  const a = flatten(parsed);
  const b = flatten(original);
  if (a.length !== b.length) return false;
  return a.every((token, i) => sameToken(token, b[i]));
}

interface CharToken {
  kind: "char";
  char: string;
  styles: string;
  raw: boolean;
}
interface LinkToken {
  kind: "linkStart" | "linkEnd";
  href: string;
}
type Token = CharToken | LinkToken;

function styleKey(styles: Styles): string {
  return STYLE_KEYS.filter((key) => key !== "raw" && styles[key]).join(",");
}

function flatten(runs: readonly InlineRun[]): Token[] {
  const tokens: Token[] = [];
  const pushRun = (run: TextRun) => {
    const styles = styleKey(run.styles);
    // Ein fettes oder kursives Leerzeichen sieht aus wie ein normales: Nur Code zählt dort.
    const spaceStyles = run.styles.code ? "code" : "";
    for (const char of run.text) {
      tokens.push({ kind: "char", char, styles: /\s/.test(char) ? spaceStyles : styles, raw: !!run.styles.raw });
    }
  };
  for (const run of runs) {
    if (run.type === "wikilink") {
      // Ein [[Link]] und derselbe Text "[[…]]" sind gleichwertig: Getippte Links werden beim Speichern zu Links.
      pushRun({ type: "text", text: wikiLinkMarkdown(run.props), styles: {} });
    } else if (run.type === "link") {
      tokens.push({ kind: "linkStart", href: run.href });
      run.content.forEach(pushRun);
      tokens.push({ kind: "linkEnd", href: run.href });
    } else {
      pushRun(run);
    }
  }
  return trimInsignificantWhitespace(tokens);
}

function isPlainSpace(token: Token | undefined): boolean {
  return token?.kind === "char" && (token.char === " " || token.char === "\t") && !token.styles.includes("code");
}

function isBoundary(token: Token | undefined): boolean {
  return token === undefined || (token.kind === "char" && token.char === "\n");
}

function trimInsignificantWhitespace(tokens: Token[]): Token[] {
  const keep = tokens.map(() => true);
  // Vorwärts: Leerzeichen direkt nach Textanfang oder Zeilenumbruch.
  let atBoundary = true;
  tokens.forEach((token, i) => {
    if (atBoundary && isPlainSpace(token)) keep[i] = false;
    else atBoundary = isBoundary(token);
  });
  // Rückwärts: Leerzeichen direkt vor Textende oder Zeilenumbruch.
  atBoundary = true;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (atBoundary && isPlainSpace(tokens[i])) keep[i] = false;
    else atBoundary = isBoundary(tokens[i]);
  }
  return tokens.filter((_, i) => keep[i]);
}

function sameToken(parsed: Token, original: Token): boolean {
  if (parsed.kind !== original.kind) return false;
  if (parsed.kind !== "char" || original.kind !== "char") {
    return (parsed as LinkToken).href === (original as LinkToken).href;
  }
  // Wörtlich übernommenes Markdown darf beim erneuten Einlesen wieder zu Text werden, aber
  // normaler Text darf nicht plötzlich als HTML o. Ä. gelesen werden.
  return parsed.char === original.char && parsed.styles === original.styles && (!parsed.raw || original.raw);
}

