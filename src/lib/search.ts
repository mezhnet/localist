// Volltextsuche, Schnellsuche (Strg+P), Backlinks und Vorlagen. Grundlage ist der Suchindex,
// den die Rust-Seite im Cache-Ordner der App pflegt (Titel und Inhalt aller Seiten).
import { extractLinks, resolveLink, type PageRef } from "./links";
import { readProperties, setProperty } from "./properties";
import { joinFrontmatter, replaceFrontmatterEntry, splitFrontmatter } from "../markdown/frontmatter";

export interface IndexEntry {
  path: string;
  title: string;
  content: string;
  /** Änderungszeit der Datei in Millisekunden seit 1970 (für „Zuletzt bearbeitet“). */
  modified?: number;
}

export interface SearchHit {
  path: string;
  title: string;
  /** Textausschnitt um den ersten Treffer (eine Zeile). */
  snippet: string;
  /** Position und Länge des Treffers im Ausschnitt, zum Hervorheben. */
  highlight: [number, number] | null;
  score: number;
}

/** Kleinschreibung ohne Akzente, damit "Muller" auch "Müller" findet und umgekehrt. */
export function fold(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
}

/** Text einer Seite ohne Frontmatter, mit Zeilenumbrüchen als Leerzeichen. */
function bodyText(content: string): string {
  return splitFrontmatter(content.replace(/^﻿/, "")).body.replace(/\s+/g, " ").trim();
}

/**
 * Volltextsuche: Alle Wörter der Suche müssen im Titel oder Text vorkommen.
 * Treffer im Titel zählen mehr; das Ergebnis ist nach Relevanz sortiert.
 */
export function searchEntries(entries: readonly IndexEntry[], query: string, limit = 50): SearchHit[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const entry of entries) {
    const body = bodyText(entry.content);
    const title = fold(entry.title);
    // Gleiche Länge wie das Original, damit Positionen passen (fold ändert die Länge nur bei ß).
    const foldedBody = fold(body);
    if (!terms.every((term) => title.includes(term) || foldedBody.includes(term))) continue;

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += title === term ? 20 : 10;
      score += Math.min(5, foldedBody.split(term).length - 1);
    }
    hits.push({ path: entry.path, title: entry.title, ...snippet(body, terms), score });
  }
  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "de")).slice(0, limit);
}

function snippet(body: string, terms: string[]): { snippet: string; highlight: [number, number] | null } {
  const folded = fold(body);
  const positions = terms.map((term) => ({ term, at: folded.indexOf(term) })).filter((p) => p.at >= 0);
  if (positions.length === 0 || folded.length !== body.length) {
    return { snippet: body.slice(0, 140) + (body.length > 140 ? " …" : ""), highlight: null };
  }
  const first = positions.sort((a, b) => a.at - b.at)[0];
  let start = Math.max(0, first.at - 50);
  // Ausschnitt an einer Wortgrenze beginnen lassen, nicht mitten im Wort.
  if (start > 0) {
    const space = body.indexOf(" ", start);
    if (space !== -1 && space < first.at) start = space + 1;
  }
  const end = Math.min(body.length, first.at + first.term.length + 90);
  const prefix = start > 0 ? "… " : "";
  return {
    snippet: prefix + body.slice(start, end) + (end < body.length ? " …" : ""),
    highlight: [prefix.length + first.at - start, first.term.length],
  };
}

/**
 * Unscharfe Suche für Strg+P: Die Buchstaben der Eingabe müssen in dieser Reihenfolge im Titel
 * vorkommen ("wsrl" findet "Website-Relaunch"). Zusammenhängende Treffer und Wortanfänge zählen mehr.
 */
export function fuzzyScore(title: string, query: string): number | null {
  const t = fold(title);
  const q = fold(query).replace(/\s+/g, "");
  if (q === "") return 0;
  let score = 0;
  let position = -1;
  for (const char of q) {
    const next = t.indexOf(char, position + 1);
    if (next === -1) return null;
    if (next === position + 1) score += 3; // direkt hintereinander
    if (next === 0 || /[\s\-_/.]/.test(t[next - 1])) score += 2; // Wortanfang
    score -= Math.min(3, next - position - 1) * 0.1;
    position = next;
  }
  if (t.startsWith(q)) score += 10;
  return score;
}

export function quickSwitch(pages: readonly PageRef[], query: string, limit = 20): PageRef[] {
  return pages
    .map((page) => ({ page, score: fuzzyScore(page.title, query) }))
    .filter((item): item is { page: PageRef; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title, "de"))
    .slice(0, limit)
    .map((item) => item.page);
}

// ---------------------------------------------------------------------------
// Backlinks

export interface Backlink {
  path: string;
  title: string;
  /** Die Zeile mit dem Link, gekürzt. */
  context: string;
}

/** Seiten, die auf `target` verlinken (ohne die Seite selbst), mit der Zeile des ersten Links. */
export function backlinksFor(entries: readonly IndexEntry[], pages: readonly PageRef[], target: string): Backlink[] {
  const result: Backlink[] = [];
  for (const entry of entries) {
    if (entry.path === target) continue;
    const body = splitFrontmatter(entry.content.replace(/^﻿/, "")).body;
    const lines = body.split(/\r?\n/);
    const hit = lines.find((line) => extractLinks(line).some((name) => resolveLink(pages, name, entry.path) === target));
    if (hit === undefined) continue;
    // Prüfen über den ganzen Text, damit Links in Code-Blöcken nicht zählen.
    if (!extractLinks(body).some((name) => resolveLink(pages, name, entry.path) === target)) continue;
    const context = hit.trim().replace(/^[-*>#\s]+(\[[ x]\]\s*)?/, "");
    result.push({ path: entry.path, title: entry.title, context: context.length > 160 ? `${context.slice(0, 157)}…` : context });
  }
  return result.sort((a, b) => a.title.localeCompare(b.title, "de"));
}

// ---------------------------------------------------------------------------
// Vorlagen

export const TEMPLATES_DIR = "Vorlagen";

export interface TemplateValues {
  id: string;
  title: string;
  /** Heutiges Datum "YYYY-MM-DD" und Uhrzeit "HH:MM". */
  date: string;
  time: string;
}

/**
 * Inhalt einer neuen Seite aus einer Vorlage: Frontmatter und Text der Vorlage, mit eigener `id`
 * (eine `id` der Vorlage wird ersetzt). Platzhalter wie in Obsidian: {{title}}, {{date}}, {{time}}.
 */
export function instantiateTemplate(template: string, values: TemplateValues): string {
  const fill = (text: string) =>
    text.replace(/\{\{\s*(title|date|time)\s*\}\}/gi, (_, key: string) => values[key.toLowerCase() as "title" | "date" | "time"]);
  const { frontmatter, body } = splitFrontmatter(fill(template.replace(/^﻿/, "")));
  let fm = frontmatter;
  if (fm !== null && "id" in readProperties(fm)) {
    fm = setProperty(fm, "id", values.id);
  } else if (fm !== null) {
    // id als erste Zeile, wie bei neu angelegten Seiten.
    fm = fm.replace(/^---[ \t]*\r?\n/, (opening) => `${opening}id: ${values.id}\n`);
  } else {
    fm = replaceFrontmatterEntry(null, "id", [`id: ${values.id}`]);
  }
  return joinFrontmatter(fm, body);
}
