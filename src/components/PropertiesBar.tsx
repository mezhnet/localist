// Eigenschaften-Leiste oben auf einer Seite (wie bei Notion). Werte stehen im Frontmatter;
// die Typen kommen aus der Datenbank des Ordners oder aus den Vault-Einstellungen.
import { useState } from "react";
import {
  inferType,
  PROPERTY_TYPES,
  RESERVED_FIELDS,
  typeInfo,
  type PropertyType,
  type PropertyValue,
} from "../lib/properties";
import { PropertyInput } from "./PropertyInput";

export interface PropertySchema {
  /** Typen bekannter Eigenschaften (Datenbank oder Vault-Einstellungen). */
  types: Record<string, PropertyType>;
  /** Vorschläge für Auswahl-Werte. */
  options: Record<string, string[]>;
  /** Eigenschaften, die in jeder Seite angezeigt werden, auch wenn sie leer sind (Datenbank). */
  always: string[];
}

interface Props {
  values: Record<string, unknown>;
  schema: PropertySchema;
  onSetValue: (name: string, value: PropertyValue | null) => void;
  onSetType: (name: string, type: PropertyType) => void;
  onRemove: (name: string) => void;
}

export function PropertiesBar({ values, schema, onSetValue, onSetType, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const names = [...new Set([...schema.always, ...Object.keys(values)])].filter(
    (name) => !RESERVED_FIELDS.has(name) && !isNested(values[name]),
  );
  const typeOf = (name: string) => schema.types[name] ?? inferType(name, values[name]);

  return (
    <div className="properties" aria-label="Eigenschaften">
      {names.map((name) => {
        const type = typeOf(name);
        return (
          <div key={name} className="property-row">
            <button
              type="button"
              className="property-name"
              title={`${typeInfo(type).label} – klicken für Optionen`}
              onClick={() => setMenuFor(menuFor === name ? null : name)}
            >
              <span className="property-icon" aria-hidden="true">
                {typeInfo(type).icon}
              </span>
              {name}
            </button>
            <div className="property-value">
              <PropertyInput
                type={type}
                value={values[name]}
                options={schema.options[name]}
                label={name}
                onChange={(value) => onSetValue(name, value)}
              />
            </div>
            {menuFor === name && (
              <div className="property-menu" role="menu">
                <label>
                  Typ{" "}
                  <select
                    aria-label={`Typ von „${name}“`}
                    value={type}
                    onChange={(event) => {
                      onSetType(name, event.target.value as PropertyType);
                      setMenuFor(null);
                    }}
                  >
                    {PROPERTY_TYPES.map((info) => (
                      <option key={info.type} value={info.type}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setMenuFor(null);
                    onRemove(name);
                  }}
                >
                  Eigenschaft entfernen
                </button>
              </div>
            )}
          </div>
        );
      })}
      {adding ? (
        <AddPropertyForm
          existing={names}
          onAdd={(name, type) => {
            setAdding(false);
            onSetType(name, type);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="property-add" onClick={() => setAdding(true)}>
          + Eigenschaft hinzufügen
        </button>
      )}
    </div>
  );
}

function isNested(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function AddPropertyForm({
  existing,
  onAdd,
  onCancel,
}: {
  existing: string[];
  onAdd: (name: string, type: PropertyType) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("text");
  const trimmed = name.trim();
  const error =
    trimmed === ""
      ? null
      : existing.some((n) => n.toLowerCase() === trimmed.toLowerCase())
        ? "Diese Eigenschaft gibt es schon."
        : RESERVED_FIELDS.has(trimmed) || !/^[^\s:#[\]{},"'][^:#[\]{},"']*$/.test(trimmed)
          ? "Bitte einen anderen Namen wählen (ohne : # [ ] { } , und Anführungszeichen)."
          : null;
  return (
    <form
      className="property-add-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed && !error) onAdd(trimmed, type);
      }}
    >
      <input autoFocus aria-label="Name der Eigenschaft" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <select aria-label="Typ der neuen Eigenschaft" value={type} onChange={(event) => setType(event.target.value as PropertyType)}>
        {PROPERTY_TYPES.map((info) => (
          <option key={info.type} value={info.type}>
            {info.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!trimmed || !!error}>
        Hinzufügen
      </button>
      <button type="button" onClick={onCancel}>
        Abbrechen
      </button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}
