// Datumslogik für die Kalenderansicht. Gerechnet wird nur mit Kalendertagen (UTC), nie mit der
// lokalen Uhrzeit, damit die Sommerzeit keinen Tag verschiebt. Wochen beginnen am Montag (ISO 8601).
import { applyView, type DatabaseConfig, type Row, type ViewConfig } from "./database";
import { isDateValue } from "./properties";

const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** "YYYY-MM-DD" aus Jahr, Monat (1–12) und Tag; Überläufe (z. B. Tag 32) werden korrekt umgerechnet. */
export function makeDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** Tagesteil eines gespeicherten Datums ("2026-11-15T09:30" → "2026-11-15"), sonst null. */
export function dayOf(value: unknown): string | null {
  if (!isDateValue(value)) return null;
  const day = value.slice(0, 10);
  // 2026-02-30 hat das richtige Format, ist aber kein Kalendertag.
  return makeDate(Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))) === day ? day : null;
}

/** Uhrzeit eines gespeicherten Datums ("09:30") oder null. */
export function timeOf(value: unknown): string | null {
  return isDateValue(value) && value.includes("T") ? value.slice(11, 16) : null;
}

function toTime(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

export function addDays(day: string, days: number): string {
  return new Date(toTime(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Wochentag 0 = Montag … 6 = Sonntag. */
export function weekdayIndex(day: string): number {
  return (new Date(toTime(day)).getUTCDay() + 6) % 7;
}

/** Montag der Woche, in der `day` liegt. */
export function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** Die sieben Tage (Montag bis Sonntag) der Woche, in der `day` liegt. */
export function weekDays(day: string): string[] {
  const monday = startOfWeek(day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Kalenderwoche nach ISO 8601 (die Woche mit dem ersten Donnerstag des Jahres ist KW 1). */
export function isoWeek(day: string): { year: number; week: number } {
  const thursday = addDays(startOfWeek(day), 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursday = addDays(startOfWeek(makeDate(year, 1, 4)), 3);
  return { year, week: 1 + Math.round((toTime(thursday) - toTime(firstThursday)) / (7 * DAY_MS)) };
}

/**
 * Wochen eines Monats für die Monatsansicht: vom Montag der ersten bis zum Sonntag der letzten Woche.
 * Je nach Monat sind das 4 bis 6 Wochen zu je 7 Tagen.
 */
export function monthGrid(year: number, month: number): string[][] {
  const first = makeDate(year, month, 1);
  const last = makeDate(year, month + 1, 0);
  const weeks: string[][] = [];
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return weeks;
}

/** Neuer gespeicherter Wert, wenn ein Eintrag auf `day` verschoben wird; eine Uhrzeit bleibt erhalten. */
export function moveToDay(value: unknown, day: string): string {
  const time = timeOf(value);
  return time ? `${day}T${time}` : day;
}

/** Überschrift: "November 2026" bzw. "KW 47 · 16.–22.11.2026". */
export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

export function weekTitle(day: string): string {
  const days = weekDays(day);
  const fmt = (d: string, withYear: boolean) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${withYear ? d.slice(0, 4) : ""}`;
  return `KW ${isoWeek(day).week} · ${fmt(days[0], days[0].slice(0, 4) !== days[6].slice(0, 4))}–${fmt(days[6], true)}`;
}

/** Datums-Eigenschaften einer Datenbank. */
export function dateProperties(config: DatabaseConfig): string[] {
  return Object.entries(config.eigenschaften)
    .filter(([, def]) => def.typ === "datum")
    .map(([name]) => name);
}

/** Datums-Eigenschaft einer Kalender-Ansicht: Einstellung der Ansicht, sonst die erste passende. */
export function calendarProperty(view: ViewConfig, config: DatabaseConfig): string | null {
  const candidates = dateProperties(config);
  const chosen = typeof view.datum === "string" ? view.datum : null;
  return chosen && candidates.includes(chosen) ? chosen : (candidates[0] ?? null);
}

export interface CalendarEntries {
  /** Einträge je Tag ("YYYY-MM-DD"), innerhalb eines Tages nach Uhrzeit (ganztägige zuerst). */
  byDay: Map<string, Row[]>;
  /** Einträge ohne (gültiges) Datum. */
  undated: Row[];
}

/** Ordnet die Einträge einer Ansicht (Filter und Sortierung gelten) ihren Tagen zu. */
export function entriesByDay(rows: readonly Row[], view: ViewConfig, config: DatabaseConfig, property: string): CalendarEntries {
  const byDay = new Map<string, Row[]>();
  const undated: Row[] = [];
  for (const row of applyView(rows, view, config.eigenschaften)) {
    const day = dayOf(row.values[property]);
    if (day === null) undated.push(row);
    else byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (timeOf(a.values[property]) ?? "").localeCompare(timeOf(b.values[property]) ?? ""));
  }
  return { byDay, undated };
}

/** Heutiges Datum nach lokaler Uhr als "YYYY-MM-DD". */
export function today(now = new Date()): string {
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
