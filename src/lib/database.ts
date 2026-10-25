// Datenbanken: Ein Ordner mit `_ansichten.yaml` ist eine Datenbank, jede .md-Datei darin ein Eintrag.
// Die Datei enthält die Eigenschaftstypen und die Ansichten (vorerst Tabelle) mit Sortierung und Filtern.
import { parse, stringify } from "yaml";
import { asList, DEFAULT_STATUS_OPTIONS, inferType, isPropertyType, RESERVED_FIELDS, type PropertyType } from "./properties";

export const VIEWS_FILE = "_ansichten.yaml";

/** Besondere Spalte für den Seitentitel (Dateiname). */
export const NAME_COLUMN = "Name";

export interface PropertyDef {
  typ: PropertyType;
  optionen?: string[];
}

export type SortDirection = "aufsteigend" | "absteigend";

export interface SortRule {
  eigenschaft: string;
  richtung: SortDirection;
}

export type FilterOperator =
  | "ist"
  | "ist nicht"
  | "enthält"
  | "enthält nicht"
  | "größer als"
  | "kleiner als"
  | "vor"
  | "nach"
  | "ist leer"
  | "ist nicht leer";

export interface FilterRule {
  eigenschaft: string;
  operator: FilterOperator;
  wert?: string | number | boolean;
}

export interface ViewConfig {
  name: string;
  typ: string;
  /** Sichtbare Spalten in dieser Reihenfolge; fehlt die Angabe, alle Eigenschaften. */
  spalten?: string[];
  sortierung: SortRule[];
  filter: FilterRule[];
  /** Weitere Angaben, die eine spätere Version der App schreibt, bleiben erhalten. */
  [key: string]: unknown;
}

export interface DatabaseConfig {
  eigenschaften: Record<string, PropertyDef>;
  ansichten: ViewConfig[];
  /** Unbekannte Felder der Datei bleiben beim Speichern erhalten. */
  weitere: Record<string, unknown>;
}

/** Ein Eintrag der Datenbank: eine Seite mit ihren Eigenschaften. */
export interface Row {
  path: string;
  title: string;
  values: Record<string, unknown>;
}

const OPERATORS: Record<PropertyType, FilterOperator[]> = {
  text: ["enthält", "enthält nicht", "ist", "ist nicht", "ist leer", "ist nicht leer"],
  url: ["enthält", "enthält nicht", "ist", "ist nicht", "ist leer", "ist nicht leer"],
  zahl: ["ist", "ist nicht", "größer als", "kleiner als", "ist leer", "ist nicht leer"],
  auswahl: ["ist", "ist nicht", "ist leer", "ist nicht leer"],
  status: ["ist", "ist nicht", "ist leer", "ist nicht leer"],
  mehrfachauswahl: ["enthält", "enthält nicht", "ist leer", "ist nicht leer"],
  datum: ["ist", "vor", "nach", "ist leer", "ist nicht leer"],
  checkbox: ["ist"],
};

export function operatorsFor(type: PropertyType): FilterOperator[] {
  return OPERATORS[type];
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== "ist leer" && operator !== "ist nicht leer";
}

// ---------------------------------------------------------------------------
// _ansichten.yaml

export function defaultView(): ViewConfig {
  return { name: "Tabelle", typ: "tabelle", sortierung: [], filter: [] };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Liest `_ansichten.yaml` nachsichtig: Fehlendes wird ergänzt, Unbekanntes bleibt erhalten. */
export function parseDatabaseConfig(text: string): DatabaseConfig {
  let data: Record<string, unknown> = {};
  try {
    data = asRecord(parse(text));
  } catch {
    data = {};
  }
  const { eigenschaften, ansichten, ...weitere } = data;

  const props: Record<string, PropertyDef> = {};
  for (const [name, raw] of Object.entries(asRecord(eigenschaften))) {
    const def = typeof raw === "string" ? { typ: raw } : asRecord(raw);
    const typ = isPropertyType(def.typ) ? def.typ : "text";
    const optionen = Array.isArray(def.optionen) ? def.optionen.map(String) : undefined;
    props[name] = { ...def, typ, ...(optionen ? { optionen } : {}) } as PropertyDef;
  }

  const views: ViewConfig[] = (Array.isArray(ansichten) ? ansichten : []).map((raw, index) => {
    const view = asRecord(raw);
    return {
      ...view,
      name: typeof view.name === "string" ? view.name : `Ansicht ${index + 1}`,
      typ: typeof view.typ === "string" ? view.typ : "tabelle",
      ...(Array.isArray(view.spalten) ? { spalten: view.spalten.map(String) } : {}),
      sortierung: (Array.isArray(view.sortierung) ? view.sortierung : []).map(asRecord).filter((s) => typeof s.eigenschaft === "string").map((s) => ({
        eigenschaft: String(s.eigenschaft),
        richtung: s.richtung === "absteigend" ? "absteigend" : "aufsteigend",
      })),
      filter: (Array.isArray(view.filter) ? view.filter : []).map(asRecord).filter((f) => typeof f.eigenschaft === "string").map((f) => ({
        eigenschaft: String(f.eigenschaft),
        operator: (typeof f.operator === "string" ? f.operator : "ist") as FilterOperator,
        ...(f.wert !== undefined && f.wert !== null ? { wert: f.wert as string | number | boolean } : {}),
      })),
    };
  });

  return { eigenschaften: props, ansichten: views.length > 0 ? views : [defaultView()], weitere };
}

export function serializeDatabaseConfig(config: DatabaseConfig): string {
  const header = "# Datenbank-Einstellungen dieses Ordners (Eigenschaftstypen und Ansichten).\n# Jede .md-Datei in diesem Ordner ist ein Eintrag.\n";
  const body = stringify(
    { eigenschaften: config.eigenschaften, ansichten: config.ansichten, ...config.weitere },
    { lineWidth: 0 },
  );
  return header + body;
}

/** Neue Datenbank: Eigenschaften und ihre Typen aus den vorhandenen Seiten ableiten. */
export function createDatabaseConfig(rows: readonly Row[]): DatabaseConfig {
  const eigenschaften: Record<string, PropertyDef> = {};
  for (const row of rows) {
    for (const [name, value] of Object.entries(row.values)) {
      if (RESERVED_FIELDS.has(name) || (typeof value === "object" && value !== null && !Array.isArray(value))) continue;
      if (!eigenschaften[name]) eigenschaften[name] = { typ: inferType(name, value) };
    }
  }
  for (const [name, def] of Object.entries(eigenschaften)) {
    if (def.typ === "status" || def.typ === "mehrfachauswahl") {
      const seen = rows.flatMap((row) => asList(row.values[name]));
      const optionen = [...new Set(def.typ === "status" ? [...seen, ...DEFAULT_STATUS_OPTIONS] : seen)];
      if (optionen.length > 0) eigenschaften[name] = { ...def, optionen };
    }
  }
  return { eigenschaften, ansichten: [defaultView()], weitere: {} };
}

/** Optionen einer Auswahl: hinterlegte zuerst, dann alle weiteren, die in Einträgen vorkommen. */
export function optionsFor(name: string, def: PropertyDef | undefined, rows: readonly Row[]): string[] {
  return [...new Set([...(def?.optionen ?? []), ...rows.flatMap((row) => asList(row.values[name]))])];
}

// ---------------------------------------------------------------------------
// Sortieren und Filtern

function valueOf(row: Row, name: string): unknown {
  if (name === NAME_COLUMN && !(name in row.values)) return row.title;
  return row.values[name];
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

/** Vergleicht zwei Werte gleichen Typs; leere Werte kommen immer ans Ende. */
export function compareValues(a: unknown, b: unknown, type: PropertyType): number {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1;
  switch (type) {
    case "zahl":
      return Number(a) - Number(b);
    case "checkbox":
      return Number(a === true) - Number(b === true);
    case "datum":
      return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
    default:
      return collator.compare(asList(a).join(", "), asList(b).join(", "));
  }
}

function typeOf(name: string, schema: Record<string, PropertyDef>): PropertyType {
  return schema[name]?.typ ?? "text";
}

export function matchesFilter(row: Row, filter: FilterRule, schema: Record<string, PropertyDef>): boolean {
  const type = typeOf(filter.eigenschaft, schema);
  const value = valueOf(row, filter.eigenschaft);
  const wanted = filter.wert;
  const text = (v: unknown) => asList(v).join(", ").toLowerCase();
  switch (filter.operator) {
    case "ist leer":
      return isEmpty(value);
    case "ist nicht leer":
      return !isEmpty(value);
    case "ist":
      if (type === "checkbox") return (value === true) === (wanted === true || wanted === "true");
      if (type === "zahl") return !isEmpty(value) && Number(value) === Number(wanted);
      if (type === "datum") return typeof value === "string" && value.slice(0, 10) === String(wanted).slice(0, 10);
      if (type === "mehrfachauswahl") return asList(value).some((item) => item.toLowerCase() === String(wanted).toLowerCase());
      return text(value) === String(wanted ?? "").toLowerCase();
    case "ist nicht":
      return !matchesFilter(row, { ...filter, operator: "ist" }, schema);
    case "enthält":
      if (type === "mehrfachauswahl") return asList(value).some((item) => item.toLowerCase() === String(wanted).toLowerCase());
      return text(value).includes(String(wanted ?? "").toLowerCase());
    case "enthält nicht":
      return !matchesFilter(row, { ...filter, operator: "enthält" }, schema);
    case "größer als":
      return !isEmpty(value) && Number(value) > Number(wanted);
    case "kleiner als":
      return !isEmpty(value) && Number(value) < Number(wanted);
    case "vor":
      return typeof value === "string" && value.slice(0, 10) < String(wanted).slice(0, 10);
    case "nach":
      return typeof value === "string" && value.slice(0, 10) > String(wanted).slice(0, 10);
    default:
      return true;
  }
}

/** Filtert (alle Filter müssen zutreffen) und sortiert die Einträge für eine Ansicht. */
export function applyView(rows: readonly Row[], view: ViewConfig, schema: Record<string, PropertyDef>): Row[] {
  const filtered = rows.filter((row) => view.filter.every((filter) => matchesFilter(row, filter, schema)));
  const sorts = view.sortierung.length > 0 ? view.sortierung : [{ eigenschaft: NAME_COLUMN, richtung: "aufsteigend" as const }];
  return filtered.sort((a, b) => {
    for (const rule of sorts) {
      const type = rule.eigenschaft === NAME_COLUMN && !schema[NAME_COLUMN] ? "text" : typeOf(rule.eigenschaft, schema);
      const va = valueOf(a, rule.eigenschaft);
      const vb = valueOf(b, rule.eigenschaft);
      let result = compareValues(va, vb, type);
      // Leere Werte bleiben auch bei absteigender Sortierung am Ende.
      if (rule.richtung === "absteigend" && !isEmpty(va) && !isEmpty(vb)) result = -result;
      if (result !== 0) return result;
    }
    return collator.compare(a.title, b.title);
  });
}

/** Spalten einer Ansicht: hinterlegte Reihenfolge, sonst alle Eigenschaften. */
export function visibleColumns(view: ViewConfig, schema: Record<string, PropertyDef>): string[] {
  const all = Object.keys(schema);
  if (!view.spalten) return all;
  return [...view.spalten.filter((name) => name in schema), ...all.filter((name) => !view.spalten!.includes(name))];
}
