// Eigenschaften-Leiste oben auf einer Seite (wie bei Notion). Werte stehen im Frontmatter;
// die Typen kommen aus der Datenbank des Ordners oder aus den Vault-Einstellungen.
import { AlignLeft, CalendarDays, CheckSquare, ChevronDownCircle, CircleDot, Hash, Link, Plus, Tag, Trash2 } from "lucide-react";
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
import { Button, Input, Menu, MenuItem, MenuLabel, MenuSeparator, Select, type MenuAnchor } from "./ui";

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
  const [menu, setMenu] = useState<{ name: string; anchor: MenuAnchor } | null>(null);

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
              aria-haspopup="menu"
              title={`${typeInfo(type).label} – klicken für Optionen`}
              onClick={(event) => {
                const element = event.currentTarget;
                setMenu((current) => (current?.name === name ? null : { name, anchor: { element } }));
              }}
            >
              <span className="property-icon" aria-hidden="true">
                <EigenschaftSymbol type={type} />
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
            {menu?.name === name && (
              <Menu anchor={menu.anchor} label={`Eigenschaft „${name}“`} onClose={() => setMenu(null)}>
                <MenuLabel>Typ</MenuLabel>
                {PROPERTY_TYPES.map((info) => (
                  <MenuItem
                    key={info.type}
                    icon={<span className="column-type">{info.icon}</span>}
                    checked={type === info.type}
                    onSelect={() => onSetType(name, info.type)}
                  >
                    {info.label}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={() => onRemove(name)}>
                  Eigenschaft entfernen
                </MenuItem>
              </Menu>
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
        <Button variant="ghost" size="sm" className="property-add" icon={<Plus />} onClick={() => setAdding(true)}>
          Eigenschaft hinzufügen
        </Button>
      )}
    </div>
  );
}

/** Linien-Symbol je Eigenschaftstyp (Vorlage 02: Schild für Tags, Kalender für Datumswerte …). */
function EigenschaftSymbol({ type }: { type: PropertyType }) {
  switch (type) {
    case "zahl":
      return <Hash />;
    case "auswahl":
      return <ChevronDownCircle />;
    case "mehrfachauswahl":
      return <Tag />;
    case "status":
      return <CircleDot />;
    case "datum":
      return <CalendarDays />;
    case "checkbox":
      return <CheckSquare />;
    case "url":
      return <Link />;
    default:
      return <AlignLeft />;
  }
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
      <Input autoFocus inputSize="sm" aria-label="Name der Eigenschaft" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
      <Select inputSize="sm" aria-label="Typ der neuen Eigenschaft" value={type} onChange={(event) => setType(event.target.value as PropertyType)}>
        {PROPERTY_TYPES.map((info) => (
          <option key={info.type} value={info.type}>
            {info.label}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="primary" size="sm" disabled={!trimmed || !!error}>
        Hinzufügen
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Abbrechen
      </Button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}
