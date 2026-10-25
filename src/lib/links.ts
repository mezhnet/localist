// Seitenlinks [[…]]: auflösen (welche Datei ist gemeint?) und nach dem Umbenennen anpassen.
// Aufgelöst wird wie in Obsidian: [[Name]] sucht im ganzen Vault nach einer Notiz mit diesem Titel,
// [[Ordner/Name]] meint genau diesen Pfad. "#Abschnitt" am Ende gehört nicht zum Seitennamen.
// [[Name]] und [[Ordner/Name]] meinen nur Notizen (.md), [[Name.html]] meint eine HTML-Seite.
import { isHtmlPath } from "./html";
import { pageTitle, parentDir } from "./tree";
import type { TreeNode } from "./vault-api";

export interface PageRef {
  path: string;
  title: string;
}

/** Alle Seiten des Baums als flache Liste. */
export function allPages(nodes: readonly TreeNode[]): PageRef[] {
  const out: PageRef[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      if (node.kind === "page") out.push({ path: node.path, title: node.name });
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** Seitenname ohne "#Abschnitt" bzw. "^Block" und ohne ".md". */
export function linkPageName(target: string): string {
  return target.split(/[#^]/)[0].trim().replace(/\.md$/i, "");
}

/** Dateiname einer Seite in Kleinbuchstaben, z. B. "ideen.md". */
function fileName(page: PageRef): string {
  return page.path.slice(page.path.lastIndexOf("/") + 1).toLowerCase();
}

/** Pfad der Seite, auf die ein Link zeigt, oder null. `from` ist die Seite mit dem Link. */
export function resolveLink(pages: readonly PageRef[], target: string, from?: string): string | null {
  const name = linkPageName(target).toLowerCase();
  if (name === "") return from ?? null; // [[#Abschnitt]] zeigt auf die eigene Seite
  const html = name.endsWith(".html");
  const candidates = pages.filter((page) => isHtmlPath(page.path) === html);
  const wanted = html ? name : `${name}.md`;
  if (name.includes("/")) {
    const exact = candidates.find((page) => page.path.toLowerCase() === wanted);
    if (exact) return exact.path;
    const suffix = candidates.filter((page) => page.path.toLowerCase().endsWith(`/${wanted}`));
    return suffix.length > 0 ? shortest(suffix).path : null;
  }
  const matches = candidates.filter((page) => fileName(page) === wanted);
  if (matches.length === 0) return null;
  if (from !== undefined) {
    const sameFolder = matches.find((page) => parentDir(page.path) === parentDir(from));
    if (sameFolder) return sameFolder.path;
  }
  return shortest(matches).path;
}

function shortest(pages: readonly PageRef[]): PageRef {
  return [...pages].sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))[0];
}

/**
 * Linkziel für eine Seite: bei Notizen der Titel, bei HTML-Seiten "Titel.html". Ist der Name im Vault
 * mehrdeutig, der Pfad (bei Notizen ohne ".md").
 */
export function linkTargetFor(pages: readonly PageRef[], path: string): string {
  const html = isHtmlPath(path);
  const own = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const sameName = pages.filter((page) => isHtmlPath(page.path) === html && fileName(page) === own);
  if (html) return sameName.length > 1 ? path : `${pageTitle(path)}.html`;
  return sameName.length > 1 ? path.replace(/\.md$/i, "") : pageTitle(path);
}

/** Wie ein Link im Editor angezeigt wird: ohne Endung, z. B. [[DNS.html]] → "DNS". */
export function linkLabel(target: string): string {
  return target.replace(/\.(md|html)$/i, "");
}

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;

/**
 * Schreibt alle [[Links]] in einem Markdown-Text um. `replace` bekommt das bisherige Ziel (ohne
 * Abschnitt) und liefert das neue Ziel oder null für "unverändert". Code-Blöcke und Code im Text
 * bleiben unangetastet, Abschnitt (#…), Anzeigetext (|…) und Einbettungen (!) bleiben erhalten.
 */
export function rewriteLinks(markdown: string, replace: (pageName: string) => string | null): string {
  return mapOutsideCode(markdown, (text) =>
    text.replace(WIKILINK, (whole, bang: string, inner: string) => {
      const bar = inner.indexOf("|");
      const target = bar === -1 ? inner : inner.slice(0, bar);
      const rest = bar === -1 ? "" : inner.slice(bar);
      const hashIndex = target.search(/[#^]/);
      const page = hashIndex === -1 ? target : target.slice(0, hashIndex);
      const anchor = hashIndex === -1 ? "" : target.slice(hashIndex);
      if (page.trim() === "") return whole;
      const replacement = replace(page.trim());
      if (replacement === null) return whole;
      return `${bang}[[${replacement}${anchor}${rest}]]`;
    }),
  );
}

/** Alle Linkziele [[…]] eines Markdown-Textes (Seitenname ohne Abschnitt), ohne Links in Code. */
export function extractLinks(markdown: string): string[] {
  const names: string[] = [];
  rewriteLinks(markdown, (pageName) => {
    names.push(pageName);
    return null;
  });
  return names;
}

/** Wendet `fn` nur auf Text außerhalb von Code-Blöcken (``` / ~~~) und Code-Spannen (`…`) an. */
function mapOutsideCode(markdown: string, fn: (text: string) => string): string {
  const lines = markdown.split("\n");
  let fence: string | null = null;
  const out = lines.map((line) => {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      return line;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      return line;
    }
    // Code-Spannen in der Zeile aussparen.
    return line
      .split(/(`+[^`]*`+)/)
      .map((part, index) => (index % 2 === 1 ? part : fn(part)))
      .join("");
  });
  return out.join("\n");
}

/** Wie heißt das neue Linkziel, nachdem `oldPath` zu `newPath` umbenannt/verschoben wurde? Die Endung bleibt. */
export function renamedTarget(oldTarget: string, newPath: string): string {
  const html = isHtmlPath(newPath);
  if (oldTarget.includes("/")) return html ? newPath : newPath.replace(/\.md$/i, "");
  const name = html ? `${pageTitle(newPath)}.html` : pageTitle(newPath);
  // Name gleich geblieben (nur Ordner verschoben oder Groß-/Kleinschreibung geändert): Der Link
  // funktioniert weiter und bleibt so, wie er geschrieben war.
  return name.toLowerCase() === oldTarget.toLowerCase() ? oldTarget : name;
}
