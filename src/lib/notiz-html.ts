// Notiz (.md) → HTML-Seite nach dem Speicherformat. Grundlage ist der mdast-Baum aus src/markdown/ (nicht das
// verlustbehaftete HTML von BlockNote). Übernommen werden Überschriften, Absätze, Formatierungen, Listen,
// Checklisten, Zitate, Code, Bilder, Tabellen, Callouts (→ <l-callout>), Toggles (→ <details>) und [[Links]]
// (→ <a>); aus dem Frontmatter id, Icon und Cover, alle weiteren Felder als <meta name="localist-prop-…">.
// Genutzt für „In HTML-Seite umwandeln“, die Darstellung von Notizen im Notizbuch und den Export.
import type { BlockContent, DefinitionContent, List, ListItem, PhrasingContent, Root, RootContent, Table } from "mdast";
import { parse as parseYaml } from "yaml";
import { parseMarkdown } from "../markdown/mdast";
import { frontmatterInner, splitFrontmatter } from "../markdown/frontmatter";
import { BAUSTEINE_DIR, encodePath, escapeAttribute, escapeText, relativePath } from "./html";
import { resolveLink, type PageRef } from "./links";
import { parentDir } from "./tree";

export interface NotizHtmlOptionen {
  /** Pfad der (neuen) HTML-Seite im Vault, z. B. "Notizen/Ideen.html". Links und Bilder stehen relativ dazu. */
  pfad: string;
  titel: string;
  /** Alle Seiten des Vaults (zum Auflösen von [[Links]]). */
  pages: readonly PageRef[];
  /** Vault-Pfad eines Bildes aus der Notiz (relativ zur Notiz oder zum Vault) oder null, wenn es fehlt. */
  bild?: (ziel: string) => string | null;
  /** id, falls die Notiz keine hat. */
  neueId?: string;
}

type Typ = "info" | "tipp" | "warnung" | "fehler";

/** Obsidian-Callout-Arten → Localist-Typ. */
const CALLOUT_TYPEN: Record<string, Typ> = {
  note: "info",
  info: "info",
  abstract: "info",
  summary: "info",
  tldr: "info",
  todo: "info",
  quote: "info",
  cite: "info",
  example: "info",
  tip: "tipp",
  tipp: "tipp",
  hint: "tipp",
  important: "tipp",
  success: "tipp",
  check: "tipp",
  done: "tipp",
  warning: "warnung",
  warnung: "warnung",
  caution: "warnung",
  attention: "warnung",
  question: "warnung",
  help: "warnung",
  faq: "warnung",
  danger: "fehler",
  error: "fehler",
  fehler: "fehler",
  failure: "fehler",
  fail: "fehler",
  missing: "fehler",
  bug: "fehler",
};

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;
const BILD = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

class Umwandler {
  private dir: string;
  constructor(private optionen: NotizHtmlOptionen) {
    this.dir = parentDir(optionen.pfad);
  }

  /** Pfad aus der Notiz → src relativ zur neuen Seite (unbekannte Bilder bleiben wie geschrieben). */
  private bildSrc(ziel: string): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(ziel) || ziel.startsWith("#")) return ziel;
    const imVault = this.optionen.bild?.(ziel) ?? null;
    return imVault === null ? ziel : encodePath(relativePath(this.dir, imVault));
  }

  private wikiLink(inner: string, eingebettet: boolean): string {
    const bar = inner.indexOf("|");
    const ziel = (bar === -1 ? inner : inner.slice(0, bar)).trim();
    const alias = bar === -1 ? "" : inner.slice(bar + 1).trim();
    const seite = ziel.split(/[#^]/)[0].trim();
    if (eingebettet && BILD.test(seite)) return `<img src="${escapeAttribute(this.bildSrc(seite))}" alt="${escapeAttribute(alias)}">`;
    // Die Notiz selbst heißt noch .md; ein Link auf sie zeigt auf die neue Seite.
    const eigeneNotiz = this.optionen.pfad.replace(/\.html$/i, ".md");
    let pfad = resolveLink(this.optionen.pages, seite, eigeneNotiz);
    if (pfad === eigeneNotiz) pfad = this.optionen.pfad;
    // Fehlt die Seite, zeigt der Link auf den Namen im selben Ordner (wie in Obsidian).
    const href = pfad ? relativePath(this.dir, pfad) : /\.html$/i.test(seite) ? seite : `${seite}.md`;
    const text = alias || seite.replace(/\.(md|html)$/i, "").split("/").pop() || ziel;
    return `<a href="${escapeAttribute(encodePath(href))}">${escapeText(text)}</a>`;
  }

  private text(wert: string, mitLinks: boolean): string {
    if (!mitLinks) return escapeText(wert);
    let out = "";
    let last = 0;
    for (const match of wert.matchAll(WIKILINK)) {
      out += escapeText(wert.slice(last, match.index));
      out += this.wikiLink(match[2], match[1] === "!");
      last = match.index! + match[0].length;
    }
    return out + escapeText(wert.slice(last));
  }

  inline(nodes: readonly PhrasingContent[], inLink = false): string {
    return nodes
      .map((node) => {
        switch (node.type) {
          case "text":
            return this.text(node.value, !inLink);
          case "strong":
            return `<strong>${this.inline(node.children, inLink)}</strong>`;
          case "emphasis":
            return `<em>${this.inline(node.children, inLink)}</em>`;
          case "delete":
            return `<s>${this.inline(node.children, inLink)}</s>`;
          case "inlineCode":
            return `<code>${escapeText(node.value)}</code>`;
          case "break":
            return "<br>\n";
          case "link":
            return `<a href="${escapeAttribute(node.url)}">${this.inline(node.children, true)}</a>`;
          case "image":
            return `<img src="${escapeAttribute(this.bildSrc(node.url))}" alt="${escapeAttribute(node.alt ?? "")}">`;
          case "html":
            return node.value; // z. B. <u>…</u>
          default:
            return "";
        }
      })
      .join("");
  }

  private einruecken(text: string, tiefe: string): string {
    return text
      .split("\n")
      .map((line) => (line === "" ? line : tiefe + line))
      .join("\n");
  }

  private liste(liste: List): string {
    const check = liste.children.length > 0 && liste.children.every((item) => item.checked === true || item.checked === false);
    const tag = liste.ordered && !check ? "ol" : "ul";
    const start = liste.ordered && liste.start !== null && liste.start !== undefined && liste.start !== 1 ? ` start="${liste.start}"` : "";
    const auf = check ? '<ul class="l-checkliste">' : `<${tag}${start}>`;
    const punkte = liste.children.map((item) => this.einruecken(this.punkt(item, check), "  "));
    return [auf, ...punkte, `</${tag}>`].join("\n");
  }

  private punkt(item: ListItem, check: boolean): string {
    const kaestchen = check ? `<input type="checkbox"${item.checked ? " checked" : ""}> ` : "";
    const [erster, ...rest] = item.children;
    if (erster?.type === "paragraph" && rest.length === 0) return `<li>${kaestchen}${this.inline(erster.children)}</li>`;
    if (erster?.type === "paragraph") {
      return [`<li>${kaestchen}${this.inline(erster.children)}`, ...rest.map((block) => this.einruecken(this.block(block), "  ")), "</li>"].join("\n");
    }
    return ["<li>" + kaestchen, ...item.children.map((block) => this.einruecken(this.block(block), "  ")), "</li>"].join("\n");
  }

  private tabelle(tabelle: Table): string {
    const zeilen = tabelle.children.map((zeile, r) => {
      const tag = r === 0 ? "th" : "td";
      return `  <tr>${zeile.children.map((zelle) => `<${tag}>${this.inline(zelle.children)}</${tag}>`).join("")}</tr>`;
    });
    return ["<table>", ...zeilen, "</table>"].join("\n");
  }

  /** Zitat, Callout (> [!info] Titel) oder Toggle (> [!note]- Titel). */
  private zitat(kinder: (BlockContent | DefinitionContent)[]): string {
    const erster = kinder[0];
    const erstesText = erster?.type === "paragraph" && erster.children[0]?.type === "text" ? erster.children[0] : null;
    const marke = erstesText ? /^\[!([\w-]+)\]([+-]?)[ \t]*/.exec(erstesText.value) : null;
    if (!erster || erster.type !== "paragraph" || !erstesText || !marke) {
      return ["<blockquote>", ...kinder.map((block) => this.einruecken(this.block(block), "  ")), "</blockquote>"].join("\n");
    }
    // Titelzeile ohne Marke; was in der ersten Zeile danach folgt, gehört zum Inhalt.
    const ersterAbsatz = this.inline([{ ...erstesText, value: erstesText.value.slice(marke[0].length) }, ...erster.children.slice(1)]);
    const umbruch = ersterAbsatz.indexOf("\n");
    const titel = (umbruch === -1 ? ersterAbsatz : ersterAbsatz.slice(0, umbruch)).replace(/<br>$/, "").trim();
    const restText = umbruch === -1 ? "" : ersterAbsatz.slice(umbruch + 1).trim();
    const inhalt = [...(restText ? [`<p>${restText}</p>`] : []), ...kinder.slice(1).map((block) => this.block(block))];
    const typ = CALLOUT_TYPEN[marke[1].toLowerCase()] ?? "info";
    if (marke[2]) {
      // Toggle: aufklappbar, mit „+“ anfangs offen
      return [`<details${marke[2] === "+" ? " open" : ""}>`, `  <summary>${titel || "Details"}</summary>`, ...inhalt.map((teil) => this.einruecken(teil, "  ")), "</details>"].join("\n");
    }
    if (inhalt.length === 0) return `<l-callout typ="${typ}">${titel}</l-callout>`;
    const kopf = titel ? [`<p><strong>${titel}</strong></p>`] : [];
    return [`<l-callout typ="${typ}">`, ...[...kopf, ...inhalt].map((teil) => this.einruecken(teil, "  ")), "</l-callout>"].join("\n");
  }

  block(node: RootContent): string {
    switch (node.type) {
      case "heading":
        return `<h${node.depth}>${this.inline(node.children)}</h${node.depth}>`;
      case "paragraph": {
        // Ein Bild allein in einem Absatz wird zum Baustein „Bild“.
        const [einziges] = node.children;
        if (node.children.length === 1 && einziges.type === "image") {
          const unterschrift = einziges.title ? [`  <figcaption>${escapeText(einziges.title)}</figcaption>`] : [];
          return ["<figure>", `  ${this.inline(node.children)}`, ...unterschrift, "</figure>"].join("\n");
        }
        if (node.children.length === 1 && einziges.type === "text" && /^!\[\[[^\]]+\]\]$/.test(einziges.value.trim()) && BILD.test(einziges.value.trim().slice(3, -2).split("|")[0])) {
          return ["<figure>", `  ${this.inline(node.children)}`, "</figure>"].join("\n");
        }
        return `<p>${this.inline(node.children)}</p>`;
      }
      case "list":
        return this.liste(node);
      case "blockquote":
        return this.zitat(node.children);
      case "code":
        return `<pre><code${node.lang ? ` class="language-${escapeAttribute(node.lang)}"` : ""}>${escapeText(node.value)}</code></pre>`;
      case "thematicBreak":
        return "<hr>";
      case "table":
        return this.tabelle(node);
      case "html":
        return node.value;
      default:
        return "";
    }
  }

  dokument(root: Root): string {
    return root.children
      .map((node) => this.block(node))
      .filter((teil) => teil !== "")
      .join("\n\n");
  }
}

/** Nur der Inhalt für <main> (ohne Frontmatter). */
export function markdownZuHtml(markdown: string, optionen: NotizHtmlOptionen): string {
  const { body } = splitFrontmatter(markdown.replace(/^﻿/, ""));
  return new Umwandler(optionen).dokument(parseMarkdown(body.replace(/\r\n?/g, "\n")));
}

/** Frontmatter als Werte (YAML), Fehler ergeben ein leeres Objekt. */
function frontmatterWerte(markdown: string): Record<string, unknown> {
  const { frontmatter } = splitFrontmatter(markdown.replace(/^﻿/, ""));
  if (!frontmatter) return {};
  try {
    const werte = parseYaml(frontmatterInner(frontmatter));
    return werte && typeof werte === "object" && !Array.isArray(werte) ? (werte as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function alsText(wert: unknown): string {
  if (wert === null || wert === undefined) return "";
  if (Array.isArray(wert)) return wert.map(alsText).join(", ");
  if (wert instanceof Date) return wert.toISOString().slice(0, 10);
  if (typeof wert === "object") return JSON.stringify(wert);
  return String(wert);
}

/** Vollständige HTML-Seite nach dem Speicherformat aus einer Notiz. */
export function notizAlsHtml(markdown: string, optionen: NotizHtmlOptionen): string {
  const werte = frontmatterWerte(markdown);
  const hoch = "../".repeat(optionen.pfad.split("/").length - 1);
  const meta: string[] = [];
  const id = alsText(werte.id) || optionen.neueId || "";
  if (id) meta.push(`<meta name="localist-id" content="${escapeAttribute(id)}">`);
  if (alsText(werte.icon)) meta.push(`<meta name="localist-icon" content="${escapeAttribute(alsText(werte.icon))}">`);
  if (alsText(werte.cover)) {
    const cover = alsText(werte.cover);
    const imVault = optionen.bild?.(cover) ?? cover;
    meta.push(`<meta name="localist-cover" content="${escapeAttribute(encodePath(relativePath(parentDir(optionen.pfad), imVault)))}">`);
  }
  for (const [name, wert] of Object.entries(werte)) {
    if (name === "id" || name === "icon" || name === "cover") continue;
    meta.push(`<meta name="localist-prop-${escapeAttribute(name)}" content="${escapeAttribute(alsText(wert))}">`);
  }
  const inhalt = markdownZuHtml(markdown, optionen);
  return [
    "<!doctype html>",
    '<html lang="de">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeText(optionen.titel)}</title>`,
    ...meta,
    `<link rel="stylesheet" href="${hoch}${BAUSTEINE_DIR}/localist.css">`,
    `<script src="${hoch}${BAUSTEINE_DIR}/localist.js" defer></script>`,
    "</head>",
    "<body>",
    "<main>",
    ...(inhalt ? [inhalt] : []),
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** Bildziele einer Notiz (Markdown-Bilder und ![[Einbettungen]]), um sie vorher im Vault zu suchen. */
export function bildZiele(markdown: string): string[] {
  const { body } = splitFrontmatter(markdown.replace(/^﻿/, ""));
  const ziele = new Set<string>();
  const besuchen = (node: { type: string; url?: string; value?: string; children?: unknown[] }) => {
    if (node.type === "image" && node.url) ziele.add(node.url);
    if (node.type === "text" && node.value) {
      for (const match of node.value.matchAll(WIKILINK)) if (match[1] === "!") ziele.add(match[2].split("|")[0].trim());
    }
    for (const kind of (node.children ?? []) as (typeof node)[]) besuchen(kind);
  };
  besuchen(parseMarkdown(body) as unknown as { type: string; children: unknown[] });
  const cover = alsText(frontmatterWerte(markdown).cover);
  if (cover) ziele.add(cover);
  return [...ziele].filter((ziel) => !/^[a-z][a-z0-9+.-]*:/i.test(ziel));
}
