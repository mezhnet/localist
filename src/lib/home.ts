// Hilfsfunktionen für die Startseite: zuletzt bearbeitete Seiten, Icons aus dem Suchindex,
// Begrüßung und verständliche Zeitangaben ("vor 5 Min.").
import { getFrontmatterField, splitFrontmatter } from "../markdown/frontmatter";
import { TEMPLATES_DIR, type IndexEntry } from "./search";
import { isInside } from "./tree";

/** Die zuletzt geänderten Seiten, neueste zuerst. Vorlagen zählen nicht dazu. */
export function recentPages(entries: readonly IndexEntry[], limit = 8): IndexEntry[] {
  return entries
    .filter((entry) => !isInside(entry.path, TEMPLATES_DIR))
    .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0) || a.title.localeCompare(b.title, "de"))
    .slice(0, limit);
}

/** Icon (Emoji) jeder Seite aus dem Frontmatter, z. B. für Sidebar und Startseite. */
export function pageIcons(entries: readonly IndexEntry[]): Map<string, string> {
  const icons = new Map<string, string>();
  for (const entry of entries) {
    const icon = getFrontmatterField(splitFrontmatter(entry.content.replace(/^﻿/, "")).frontmatter, "icon");
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
