// Kanban: Einträge einer Datenbank in Spalten nach einer Status- oder Auswahl-Eigenschaft.
// Eine Karte in eine andere Spalte zu ziehen setzt den Wert dieser Eigenschaft in der Datei.
import { applyView, optionsFor, type DatabaseConfig, type Row, type ViewConfig } from "./database";
import { setProperty, type PropertyType } from "./properties";

/** Eigenschaftstypen, nach denen ein Kanban gruppiert werden kann. */
export const GROUPABLE_TYPES: PropertyType[] = ["status", "auswahl"];

export interface KanbanColumn {
  /** Wert der Eigenschaft für diese Spalte; null = Spalte "Ohne …" für Einträge ohne Wert. */
  value: string | null;
  label: string;
  rows: Row[];
}

/** Eigenschaften, nach denen gruppiert werden kann (in der Reihenfolge der Datenbank). */
export function groupableProperties(config: DatabaseConfig): string[] {
  return Object.entries(config.eigenschaften)
    .filter(([, def]) => GROUPABLE_TYPES.includes(def.typ))
    .map(([name]) => name);
}

/** Nach welcher Eigenschaft eine Kanban-Ansicht gruppiert: Einstellung der Ansicht, sonst die erste passende. */
export function groupProperty(view: ViewConfig, config: DatabaseConfig): string | null {
  const candidates = groupableProperties(config);
  const chosen = typeof view.gruppierung === "string" ? view.gruppierung : null;
  return chosen && candidates.includes(chosen) ? chosen : (candidates[0] ?? null);
}

function cardValue(row: Row, property: string): string | null {
  const value = row.values[property];
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  return value === undefined || value === null || value === "" ? null : String(value);
}

/**
 * Bildet die Spalten: zuerst die hinterlegten Optionen in ihrer Reihenfolge, dann weitere Werte,
 * die in Einträgen vorkommen, und zuletzt "Ohne <Eigenschaft>" für Einträge ohne Wert.
 * Filter und Sortierung der Ansicht gelten innerhalb der Spalten.
 */
export function groupRows(rows: readonly Row[], view: ViewConfig, config: DatabaseConfig, property: string): KanbanColumn[] {
  const visible = applyView(rows, view, config.eigenschaften);
  const columns: KanbanColumn[] = [];
  for (const option of optionsFor(property, config.eigenschaften[property], rows)) {
    if (!columns.some((c) => c.value!.toLowerCase() === option.toLowerCase())) columns.push({ value: option, label: option, rows: [] });
  }
  const empty: KanbanColumn = { value: null, label: `Ohne ${property}`, rows: [] };

  for (const row of visible) {
    const value = cardValue(row, property);
    // Groß-/Kleinschreibung zählt nicht: "in arbeit" landet in "In Arbeit".
    const column = value === null ? empty : columns.find((c) => c.value!.toLowerCase() === value.toLowerCase());
    if (column) column.rows.push(row);
    else columns.push({ value, label: value!, rows: [row] });
  }
  return [...columns, empty];
}

/** Neues Frontmatter, nachdem eine Karte in die Spalte `value` gezogen wurde (null entfernt den Wert). */
export function moveCard(frontmatter: string | null, property: string, value: string | null): string | null {
  return setProperty(frontmatter, property, value);
}
