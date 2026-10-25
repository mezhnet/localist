// Eigenschaften einer Seite: Werte stehen im Frontmatter, die Typen in der Datenbank (_ansichten.yaml)
// oder – außerhalb von Datenbanken – in den Vault-Einstellungen. Fehlt ein Typ, wird er am Wert erkannt.
import { parse, stringify } from "yaml";
import { frontmatterInner, replaceFrontmatterEntry } from "../markdown/frontmatter";

export type PropertyType = "text" | "zahl" | "auswahl" | "mehrfachauswahl" | "status" | "datum" | "checkbox" | "url";

export interface PropertyTypeInfo {
  type: PropertyType;
  label: string;
  icon: string;
}

export const PROPERTY_TYPES: PropertyTypeInfo[] = [
  { type: "text", label: "Text", icon: "≡" },
  { type: "zahl", label: "Zahl", icon: "#" },
  { type: "auswahl", label: "Auswahl", icon: "▾" },
  { type: "mehrfachauswahl", label: "Mehrfachauswahl", icon: "☰" },
  { type: "status", label: "Status", icon: "◐" },
  { type: "datum", label: "Datum", icon: "📅" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "url", label: "URL", icon: "🔗" },
];

export function isPropertyType(value: unknown): value is PropertyType {
  return PROPERTY_TYPES.some((info) => info.type === value);
}

export function typeInfo(type: PropertyType): PropertyTypeInfo {
  return PROPERTY_TYPES.find((info) => info.type === type)!;
}

/** Felder mit fester Bedeutung, die nicht in der Eigenschaften-Leiste erscheinen. */
export const RESERVED_FIELDS = new Set(["id", "icon", "cover"]);

/** Vorgabe für neue Status-Eigenschaften (wie bei Notion). */
export const DEFAULT_STATUS_OPTIONS = ["Nicht begonnen", "In Arbeit", "Erledigt"];

export type PropertyValue = string | number | boolean | string[];

// Datumsangaben immer als YYYY-MM-DD oder YYYY-MM-DDTHH:MM (siehe CLAUDE.md).
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATE_TIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;

export function isDateValue(value: unknown): value is string {
  return typeof value === "string" && (DATE.test(value) || DATE_TIME.test(value)) && !Number.isNaN(Date.parse(value.slice(0, 10)));
}

/** Liest alle Felder des Frontmatters. Datumsangaben bleiben Text ("2026-11-15"), nichts wird umgewandelt. */
export function readProperties(frontmatter: string | null): Record<string, unknown> {
  const inner = frontmatterInner(frontmatter);
  if (inner.trim() === "") return {};
  try {
    const data = parse(inner); // YAML 1.2 (Core-Schema): Datumswerte sind normale Texte
    return data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** YAML-Zeilen für ein Feld, z. B. ["tags:", "  - a", "  - b"]. */
export function yamlEntry(key: string, value: PropertyValue): string[] {
  return stringify({ [key]: value }, { lineWidth: 0 }).replace(/\n$/, "").split("\n");
}

/** Setzt eine Eigenschaft (null entfernt sie). Nur die Zeilen dieses Feldes ändern sich. */
export function setProperty(frontmatter: string | null, key: string, value: PropertyValue | null): string | null {
  return replaceFrontmatterEntry(frontmatter, key, value === null ? null : yamlEntry(key, value));
}

/** Erkennt den Typ an Name und Wert, wenn nirgends ein Typ hinterlegt ist. */
export function inferType(key: string, value: unknown): PropertyType {
  if (key.toLowerCase() === "status") return "status";
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "zahl";
  if (Array.isArray(value)) return "mehrfachauswahl";
  if (isDateValue(value)) return "datum";
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return "url";
  return "text";
}

/**
 * Bringt eine Eingabe aus der Oberfläche in die Form, die gespeichert wird.
 * null bedeutet "Feld entfernen" (leere Eingabe oder ungültiger Wert).
 */
export function normalizeValue(type: PropertyType, input: unknown): PropertyValue | null {
  switch (type) {
    case "checkbox":
      return input === true || input === "true";
    case "zahl": {
      if (typeof input === "number") return Number.isFinite(input) ? input : null;
      const text = String(input ?? "").trim().replace(",", ".");
      const number = Number(text);
      return text === "" || !Number.isFinite(number) ? null : number;
    }
    case "mehrfachauswahl": {
      const list = Array.isArray(input) ? input : String(input ?? "").split(",");
      const cleaned = [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
      return cleaned.length > 0 ? cleaned : null;
    }
    case "datum": {
      // <input type="datetime-local"> kann Sekunden liefern; gespeichert wird bis zur Minute.
      const text = String(input ?? "").trim().slice(0, 16);
      return isDateValue(text) ? text : null;
    }
    default: {
      const text = Array.isArray(input) ? input.join(", ") : String(input ?? "").trim();
      return text === "" ? null : text;
    }
  }
}

/** Wert für die Anzeige, z. B. "15.11.2026" oder "15.11.2026, 14:30". */
export function formatValue(type: PropertyType, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (type === "datum" && isDateValue(value)) {
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-");
    return `${day}.${month}.${year}${time ? `, ${time}` : ""}`;
  }
  if (type === "checkbox") return value === true ? "Ja" : "Nein";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Wert als Liste (für Mehrfachauswahl), auch wenn im Frontmatter nur ein einzelner Text steht. */
export function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === "") return [];
  return [String(value)];
}
