// Eigenschaften-Leiste oben auf einer Seite (wie bei Notion). Werte stehen im Frontmatter;
// die Typen kommen aus der Datenbank des Ordners oder aus den Vault-Einstellungen.
// Auf dem Handy (Vorlage 04) stehen die Werte kompakt als Chips in einer Zeile; ein Tipp klappt die Liste auf.
import { AlignLeft, CalendarDays, CheckSquare, ChevronDownCircle, ChevronUp, CircleDot, Hash, Link, Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  asList,
  formatValue,
  inferType,
  PROPERTY_TYPES,
  RESERVED_FIELDS,
  typeInfo,
  type PropertyType,
  type PropertyValue,
} from "../lib/properties";
import { PropertyInput } from "./PropertyInput";
import { useSchmal } from "./Reiterleiste";
import { Button, cx, IconButton, Input, Menu, MenuItem, MenuLabel, MenuSeparator, Select, type MenuAnchor } from "./ui";

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
  /** Handy: Liste aufgeklappt (sonst nur die Chips in einer Zeile). */
  const schmal = useSchmal();
  const [offen, setOffen] = useState(false);

  const names = [...new Set([...schema.always, ...Object.keys(values)])].filter(
    (name) => !RESERVED_FIELDS.has(name) && !isNested(values[name]),
  );
  const typeOf = (name: string) => schema.types[name] ?? inferType(name, values[name]);

  if (schmal && !offen) {
    return (
      <EigenschaftenKompakt
        names={names}
        values={values}
        typeOf={typeOf}
        onOeffnen={(hinzufuegen) => {
          setOffen(true);
          setAdding(hinzufuegen);
        }}
      />
    );
  }

  return (
    <div className={cx("properties", schmal && "is-offen")} aria-label="Eigenschaften">
      {schmal && (
        <IconButton size="sm" className="properties-zuklappen" label="Eigenschaften zuklappen" aria-expanded={true} onClick={() => setOffen(false)}>
          <ChevronUp />
        </IconButton>
      )}
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
                    icon={<EigenschaftSymbol type={info.type} />}
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

/**
 * Handy (Vorlage 04): alle Werte als Chips in einer Zeile – Mehrfachwerte einzeln (der erste in Akzentfarbe),
 * Datumswerte in Monospace ohne Rahmen, Häkchen als Name. Ein Tipp klappt die Liste zum Bearbeiten auf, „+“ fügt
 * gleich eine Eigenschaft hinzu.
 */
function EigenschaftenKompakt({
  names,
  values,
  typeOf,
  onOeffnen,
}: {
  names: string[];
  values: Record<string, unknown>;
  typeOf: (name: string) => PropertyType;
  onOeffnen: (hinzufuegen: boolean) => void;
}) {
  const chips: { text: string; art: "akzent" | "chip" | "datum" }[] = [];
  for (const name of names) {
    const type = typeOf(name);
    const value = values[name];
    if (type === "mehrfachauswahl") for (const wert of asList(value)) chips.push({ text: wert, art: chips.some((c) => c.art === "akzent") ? "chip" : "akzent" });
    else if (type === "datum") formatValue(type, value) && chips.push({ text: formatValue(type, value), art: "datum" });
    else if (type === "checkbox") value === true && chips.push({ text: name, art: "chip" });
    else if (formatValue(type, value)) chips.push({ text: formatValue(type, value), art: "chip" });
  }
  return (
    <div className="properties is-kompakt" aria-label="Eigenschaften">
      {chips.length > 0 && (
        <button type="button" className="properties-chips" aria-expanded={false} title="Eigenschaften bearbeiten" onClick={() => onOeffnen(false)}>
          <span className="visually-hidden">Eigenschaften bearbeiten: </span>
          {chips.map((chip, i) => (
            <span key={i} className={cx("properties-chip", `is-${chip.art}`)}>
              {chip.text}
            </span>
          ))}
        </button>
      )}
      {chips.length > 0 ? (
        <IconButton size="sm" className="properties-plus" label="Eigenschaft hinzufügen" onClick={() => onOeffnen(true)}>
          <Plus />
        </IconButton>
      ) : (
        <Button variant="ghost" size="sm" className="property-add" icon={<Plus />} onClick={() => onOeffnen(true)}>
          Eigenschaft hinzufügen
        </Button>
      )}
    </div>
  );
}

/** Linien-Symbol je Eigenschaftstyp (Vorlage 02: Schild für Tags, Kalender für Datumswerte …). */
export function EigenschaftSymbol({ type }: { type: PropertyType }) {
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
