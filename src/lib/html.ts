// HTML-Seiten (.html): Kopfbereich lesen und ändern, relative Pfade neu berechnen, sichtbaren Text und
// Links auslesen. Geändert wird immer nur genau die betroffene Stelle in der Datei (über die Quellpositionen
// von parse5), nie durch Neu-Schreiben des ganzen Dokuments. Zeilenenden und ein BOM bleiben erhalten.
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { isInside, parentDir } from "./tree";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

/** Ordner mit `localist.css`, `localist.js` und eigenen Bausteinen (relativ zum Vault). */
export const BAUSTEINE_DIR = ".localist/bausteine";

export function isHtmlPath(path: string): boolean {
  return /\.html$/i.test(path);
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

/** Wendet Änderungen an (von hinten nach vorn, damit die Positionen stimmen). */
function applyEdits(text: string, edits: Edit[]): string {
  let out = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

/** Parst mit Quellpositionen. Ein BOM wird vorher abgetrennt, `offset` gleicht die Positionen aus. */
function parseWithPositions(text: string): { document: DefaultTreeAdapterTypes.Document; offset: number } {
  const offset = text.startsWith("﻿") ? 1 : 0;
  return { document: parse(text.slice(offset), { sourceCodeLocationInfo: true }), offset };
}

function isElement(node: Node): node is Element {
  return "tagName" in node;
}

function childrenOf(node: ParentNode): Node[] {
  // <template> hat seinen Inhalt in `content`.
  return isElement(node) && node.tagName === "template" ? (node as DefaultTreeAdapterTypes.Template).content.childNodes : node.childNodes;
}

function* walk(node: ParentNode): Generator<Element> {
  for (const child of childrenOf(node)) {
    if (isElement(child)) {
      yield child;
      yield* walk(child);
    }
  }
}

function find(node: ParentNode, tag: string): Element | undefined {
  for (const element of walk(node)) if (element.tagName === tag) return element;
  return undefined;
}

function attr(element: Element, name: string): string | undefined {
  return element.attrs.find((a) => a.name === name)?.value;
}

function lineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttribute(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function textContent(node: ParentNode): string {
  return childrenOf(node)
    .map((child) => ("value" in child && child.nodeName === "#text" ? child.value : isElement(child) ? textContent(child) : ""))
    .join("");
}

// ---------------------------------------------------------------------------
// Neue Seite und Kopfbereich

/** Relativer Weg aus dem Ordner einer Seite zur Vault-Wurzel, z. B. "../../" (Wurzel: ""). */
function upToRoot(pagePath: string): string {
  return "../".repeat(pagePath.split("/").length - 1);
}

/** Inhalt einer neuen HTML-Seite nach dem Speicherformat (gleich wie `new_html_page` in vault.rs). */
export function newHtmlPage(title: string, id: string, pagePath: string): string {
  const up = upToRoot(pagePath);
  return [
    "<!doctype html>",
    '<html lang="de">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeText(title).replace(/"/g, "&quot;")}</title>`,
    `<meta name="localist-id" content="${escapeAttribute(id)}">`,
    `<link rel="stylesheet" href="${up}${BAUSTEINE_DIR}/localist.css">`,
    `<script src="${up}${BAUSTEINE_DIR}/localist.js" defer></script>`,
    "</head>",
    "<body>",
    "<main>",
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

export interface HeadInfo {
  title: string | null;
  id: string | null;
  icon: string | null;
  cover: string | null;
}

/** Titel und Localist-Angaben aus dem Kopfbereich (`<meta name="localist-…">`). */
export function readHead(html: string): HeadInfo {
  const { document } = parseWithPositions(html);
  const head = find(document, "head");
  const meta = (name: string) => {
    if (!head) return null;
    for (const element of walk(head)) if (element.tagName === "meta" && attr(element, "name") === name) return attr(element, "content") ?? null;
    return null;
  };
  const title = head ? find(head, "title") : undefined;
  return { title: title ? textContent(title) : null, id: meta("localist-id"), icon: meta("localist-icon") || null, cover: meta("localist-cover") || null };
}

/** Setzt den Text von `<title>`. Fehlt `<title>`, wird es am Anfang von `<head>` eingefügt. */
export function setTitle(html: string, title: string): string {
  const { document, offset } = parseWithPositions(html);
  const head = find(document, "head");
  const element = head ? find(head, "title") : undefined;
  const location = element?.sourceCodeLocation;
  if (element && location?.startTag && location.endTag) {
    if (textContent(element) === title) return html;
    return applyEdits(html, [{ start: offset + location.startTag.endOffset, end: offset + location.endTag.startOffset, text: escapeText(title) }]);
  }
  const headStart = head?.sourceCodeLocation?.startTag;
  if (!headStart) return html;
  const at = offset + headStart.endOffset;
  return applyEdits(html, [{ start: at, end: at, text: `${lineEnding(html)}<title>${escapeText(title)}</title>` }]);
}

/**
 * Setzt `<meta name="…" content="…">` (null entfernt es). Ein bestehendes Tag behält seine Form, nur der
 * Wert ändert sich. Neue Tags kommen hinter `localist-id`, sonst hinter `<title>`, sonst an den Anfang von `<head>`.
 */
export function setMeta(html: string, name: string, value: string | null): string {
  const { document, offset } = parseWithPositions(html);
  const head = find(document, "head");
  if (!head?.sourceCodeLocation?.startTag) return html;
  const metas = [...walk(head)].filter((element) => element.tagName === "meta");
  const existing = metas.find((element) => attr(element, "name") === name);
  const eol = lineEnding(html);

  if (existing?.sourceCodeLocation) {
    const location = existing.sourceCodeLocation;
    if (value === null) {
      // Ganze Zeile entfernen, wenn das Tag allein darauf steht.
      let start = offset + location.startOffset;
      let end = offset + location.endOffset;
      const lineStart = html.lastIndexOf("\n", start - 1) + 1;
      if (/^[ \t]*$/.test(html.slice(lineStart, start)) && html.startsWith(eol, end)) {
        start = lineStart;
        end += eol.length;
      }
      return applyEdits(html, [{ start, end, text: "" }]);
    }
    if (attr(existing, "content") === value) return html;
    const content = location.attrs?.content;
    if (content) return applyEdits(html, [{ start: offset + content.startOffset, end: offset + content.endOffset, text: `content="${escapeAttribute(value)}"` }]);
    const tagEnd = offset + location.startTag!.endOffset;
    const close = html.slice(0, tagEnd).endsWith("/>") ? 2 : 1;
    return applyEdits(html, [{ start: tagEnd - close, end: tagEnd - close, text: ` content="${escapeAttribute(value)}"` }]);
  }
  if (value === null) return html;

  const anchor = metas.find((element) => attr(element, "name") === "localist-id") ?? find(head, "title");
  const at = offset + (anchor?.sourceCodeLocation?.endOffset ?? head.sourceCodeLocation.startTag.endOffset);
  return applyEdits(html, [{ start: at, end: at, text: `${eol}<meta name="${escapeAttribute(name)}" content="${escapeAttribute(value)}">` }]);
}

// ---------------------------------------------------------------------------
// Relative Pfade

/** Ist ein href/src-Wert ein relativer Pfad im Vault (kein Schema, kein "/", kein "#", kein "//")? */
function isRelativeReference(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[/#?\\]/.test(trimmed) && !trimmed.startsWith("{{");
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Löst einen relativen Pfad aus dem Ordner `dir` auf. null, wenn er den Vault verlassen würde. */
export function resolveRelative(dir: string, reference: string): string | null {
  const parts = dir ? dir.split("/") : [];
  for (const part of safeDecode(reference).split(/[/\\]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

/** Relativer Weg von Ordner `fromDir` zu `target` (beides Vault-Pfade), z. B. "../Notizen/Ideen.md". */
export function relativePath(fromDir: string, target: string): string {
  const from = fromDir ? fromDir.split("/") : [];
  const to = target.split("/");
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common++;
  return "../".repeat(from.length - common) + to.slice(common).join("/");
}

/** Kodiert einen Pfad für href/src: Leerzeichen als %20, Umlaute bleiben lesbar. */
export function encodePath(path: string): string {
  return path.replace(/[%#? "<>\u0000-\u001f]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
}

/**
 * Nach Umbenennen oder Verschieben: rechnet relative href- und src-Werte einer HTML-Seite neu.
 * `oldPath` / `newPath` sind der alte und neue Ort der Seite, `mapPath` liefert für jede Datei im Vault
 * ihren neuen Ort. Werte, deren Ziel gleich bleibt, und alles andere in der Datei bleiben unverändert.
 */
export function rewriteReferences(html: string, oldPath: string, newPath: string, mapPath: (path: string) => string): string {
  const { document, offset } = parseWithPositions(html);
  const oldDir = parentDir(oldPath);
  const newDir = parentDir(newPath);
  const edits: Edit[] = [];
  for (const element of walk(document)) {
    for (const name of ["href", "src"]) {
      const value = attr(element, name);
      const location = element.sourceCodeLocation?.attrs?.[name];
      if (value === undefined || !location || !isRelativeReference(value)) continue;
      const split = value.search(/[?#]/);
      const pathPart = split === -1 ? value : value.slice(0, split);
      const suffix = split === -1 ? "" : value.slice(split);
      if (pathPart === "") continue;
      const target = resolveRelative(oldDir, pathPart);
      if (target === null) continue;
      const newTarget = mapPath(target);
      if (newDir === oldDir && newTarget === target) continue;
      const updated = relativePath(newDir, newTarget);
      if (resolveRelative(newDir, pathPart) === newTarget) continue; // zeigt schon richtig
      const raw = html.slice(offset + location.startOffset, offset + location.endOffset);
      const match = /^([^=]*=\s*)(["']?)/.exec(raw);
      if (!match) continue;
      const quote = match[2] || '"';
      edits.push({
        start: offset + location.startOffset,
        end: offset + location.endOffset,
        text: `${match[1]}${quote}${escapeAttribute(encodePath(updated) + suffix)}${quote}`,
      });
    }
  }
  return edits.length === 0 ? html : applyEdits(html, edits);
}

/** Zuordnung alter → neuer Pfade nach Umbenennen/Verschieben von `from` nach `to` (auch Ordner). */
export function pathMapper(from: string, to: string): (path: string) => string {
  return (path) => (isInside(path, from) ? to + path.slice(from.length) : path);
}

// ---------------------------------------------------------------------------
// Text und Links für Suche und Backlinks

const INVISIBLE = new Set(["script", "style", "template", "noscript", "head", "svg", "math"]);
const BLOCKS = /^(p|div|main|section|article|header|footer|aside|nav|h[1-6]|li|ul|ol|tr|td|th|table|details|summary|figure|figcaption|blockquote|pre|br|hr|dt|dd|l-[a-z-]+)$/;

const textCache = new Map<string, string>();

/** Sichtbarer Text einer HTML-Seite (ohne Tags, Kopfbereich, Skripte und Styles). */
export function htmlVisibleText(html: string): string {
  const cached = textCache.get(html);
  if (cached !== undefined) return cached;
  const parts: string[] = [];
  const visit = (node: ParentNode) => {
    for (const child of childrenOf(node)) {
      if (child.nodeName === "#text" && "value" in child) parts.push(child.value);
      else if (isElement(child) && !INVISIBLE.has(child.tagName)) {
        const block = BLOCKS.test(child.tagName);
        if (block) parts.push(" ");
        visit(child);
        if (block) parts.push(" ");
      }
    }
  };
  visit(parse(html.replace(/^﻿/, "")));
  const text = parts.join("").replace(/\s+/g, " ").trim();
  if (textCache.size > 500) textCache.clear();
  textCache.set(html, text);
  return text;
}

export interface HtmlLink {
  /** Der href-Wert, wie er in der Datei steht. */
  href: string;
  /** Vault-Pfad des Ziels (relative Links), sonst null. */
  target: string | null;
  /** Sichtbarer Text des Links. */
  text: string;
}

/** Alle `<a href>`-Links einer HTML-Seite. In HTML-Seiten zählen nur diese als Links. */
export function htmlLinks(html: string, pagePath: string): HtmlLink[] {
  const document = parse(html.replace(/^﻿/, ""));
  const dir = parentDir(pagePath);
  const links: HtmlLink[] = [];
  for (const element of walk(document)) {
    if (element.tagName !== "a") continue;
    const href = attr(element, "href");
    if (href === undefined) continue;
    const pathPart = href.split(/[?#]/)[0];
    const target = isRelativeReference(href) && pathPart !== "" ? resolveRelative(dir, pathPart) : null;
    links.push({ href, target, text: textContent(element).replace(/\s+/g, " ").trim() });
  }
  return links;
}

// ---------------------------------------------------------------------------
// Vorlagen

/**
 * Neue HTML-Seite aus einer Vorlage: {{title}}, {{date}} und {{time}} ersetzen, neue `localist-id`,
 * `<title>` gleich dem neuen Namen und relative Pfade (Bausteine, Bilder, Links) für den Zielordner neu berechnet.
 */
export function instantiateHtmlTemplate(
  template: string,
  templatePath: string,
  newPath: string,
  values: { id: string; title: string; date: string; time: string },
): string {
  let html = template.replace(/\{\{\s*(title|date|time)\s*\}\}/gi, (_, key: string) => {
    const value = values[key.toLowerCase() as "title" | "date" | "time"];
    return escapeText(value);
  });
  html = setMeta(html, "localist-id", values.id);
  html = setTitle(html, values.title);
  return rewriteReferences(html, templatePath, newPath, (path) => path);
}
