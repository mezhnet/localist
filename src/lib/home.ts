// Hilfsfunktionen für die Startseite: zuletzt bearbeitete Seiten, Icons aus dem Suchindex,
// Begrüßung und verständliche Zeitangaben ("vor 5 Min.").
import { getFrontmatterField, splitFrontmatter } from "../markdown/frontmatter";
import { isHtmlPath, readHead } from "./html";
import { TEMPLATES_DIR, type IndexEntry } from "./search";
import { isInside } from "./tree";

/** Die zuletzt geänderten Seiten, neueste zuerst. Vorlagen zählen nicht dazu. */
export function recentPages(entries: readonly IndexEntry[], limit = 8): IndexEntry[] {
  return entries
    .filter((entry) => !isInside(entry.path, TEMPLATES_DIR))
    .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0) || a.title.localeCompare(b.title, "de"))
    .slice(0, limit);
}

/** Icon (Emoji) jeder Seite aus dem Frontmatter bzw. `<meta name="localist-icon">`, z. B. für Sidebar und Startseite. */
export function pageIcons(entries: readonly IndexEntry[]): Map<string, string> {
  const icons = new Map<string, string>();
  for (const entry of entries) {
    const icon = isHtmlPath(entry.path)
      ? readHead(entry.content).icon
      : getFrontmatterField(splitFrontmatter(entry.content.replace(/^﻿/, "")).frontmatter, "icon");
    if (icon) icons.set(entry.path, icon);
  }
  return icons;
}

/** Begrüßung passend zur Tageszeit. */
export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Datum wie "Sonntag, 25. Oktober 2026". */
export function longDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Zeitabstand in Worten, z. B. "gerade eben", "vor 5 Min.", "gestern", sonst das Datum. */
export function relativeTime(then: number, now: number): string {
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const thenDay = new Date(then);
  const nowDay = new Date(now);
  const dayDiff = Math.round(
    (Date.UTC(nowDay.getFullYear(), nowDay.getMonth(), nowDay.getDate()) - Date.UTC(thenDay.getFullYear(), thenDay.getMonth(), thenDay.getDate())) /
      86_400_000,
  );
  if (dayDiff === 0) return `vor ${hours} Std.`;
  if (dayDiff === 1) return "gestern";
  if (dayDiff < 7) return `vor ${dayDiff} Tagen`;
  return thenDay.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Datum oben auf der Startseite (Vorlage): „Mo, 26.10.2026“. */
export function kurzesDatum(date: Date): string {
  const zwei = (zahl: number) => String(zahl).padStart(2, "0");
  return `${WOCHENTAGE[date.getDay()]}, ${zwei(date.getDate())}.${zwei(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Alle Seiten nach Änderungszeit, neueste zuerst (Link „Alle Seiten“ auf der Startseite, Vorlagen eingeschlossen). */
export function allePagesNachZeit(entries: readonly IndexEntry[]): IndexEntry[] {
  return [...entries].sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0) || a.title.localeCompare(b.title, "de"));
}

const NAME_MAX = 100;

/**
 * Dateiname aus einem Text (erste Zeile von „Schnell notieren“): ohne Zeichen, die Windows, Android oder Links in
 * Obsidian nicht erlauben (< > : " / \ | ? * # ^ [ ] und Steuerzeichen), ohne Punkt am Anfang (versteckt) und ohne
 * Punkt oder Leerzeichen am Ende, höchstens 100 Zeichen, keine reservierten Namen wie „CON“. Leer → „Unbenannt“.
 */
export function gueltigerName(text: string): string {
  // eslint-disable-next-line no-control-regex -- Steuerzeichen sind in Dateinamen verboten
  let name = text.replace(/[\u0000-\u001f\u007f<>:"/\\|?*#^[\]]/g, " ").replace(/\s+/g, " ").trim();
  name = name.replace(/^[.\s]+/, "");
  if (name.length > NAME_MAX) name = name.slice(0, NAME_MAX);
  name = name.replace(/[.\s]+$/, "");
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) name = `${name} (Notiz)`;
  return name || "Unbenannt";
}

/**
 * „Schnell notieren“: erste nicht leere Zeile = Titel (als gültiger Dateiname), der Rest = Inhalt (ohne Leerzeilen am
 * Anfang und Leerraum am Ende). Ein leeres Feld ergibt null (es passiert nichts).
 */
export function schnellNotiz(text: string): { titel: string; inhalt: string } | null {
  const zeilen = text.replace(/\r\n?/g, "\n").split("\n");
  const erste = zeilen.findIndex((zeile) => zeile.trim() !== "");
  if (erste < 0) return null;
  const inhalt = zeilen
    .slice(erste + 1)
    .join("\n")
    .replace(/^\s*\n/, "")
    .trimEnd();
  return { titel: gueltigerName(zeilen[erste]), inhalt };
}
