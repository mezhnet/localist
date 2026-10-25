// Tabellenansicht einer Datenbank: eine Zeile pro Seite, eine Spalte pro Eigenschaft.
// Zellen schreiben direkt ins Frontmatter der jeweiligen Seite; Sortierung und Filter
// stehen in `_ansichten.yaml`.
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../lib/autosave";
import {
  applyView,
  NAME_COLUMN,
  operatorNeedsValue,
  operatorsFor,
  optionsFor,
  visibleColumns,
  type DatabaseConfig,
  type FilterOperator,
  type FilterRule,
  type Row,
  type SortRule,
  type ViewConfig,
} from "../lib/database";
import { normalizeValue, PROPERTY_TYPES, readProperties, setProperty, typeInfo, type PropertyType, type PropertyValue } from "../lib/properties";
import { pageTitle } from "../lib/tree";
import { readPage, writePage } from "../lib/vault-api";
import { joinFrontmatter, splitFrontmatter } from "../markdown/frontmatter";
import { groupableProperties, groupProperty } from "../lib/kanban";
import { calendarProperty, dateProperties } from "../lib/calendar";
import { CalendarView } from "./CalendarView";
import { KanbanBoard } from "./KanbanBoard";
import { AddPropertyForm } from "./PropertiesBar";
import { PropertyInput } from "./PropertyInput";

interface Props {
  folder: string;
  config: DatabaseConfig;
  /** Pfade der Seiten im Ordner (aus dem Ordnerbaum). */
  pagePaths: string[];
  /** Wird erhöht, wenn sich eine Seite im Ordner geändert hat. */
  version: number;
  onSaveConfig: (config: DatabaseConfig) => void;
  onOpenPage: (path: string) => void;
  onCreateRow: () => Promise<string | null>;
  onRenamePage: (path: string, newTitle: string) => Promise<boolean>;
  /** Ungespeicherte Eingaben der offenen Seite sichern, bevor eine Zelle die Datei ändert. */
  beforeWrite: () => Promise<void>;
  onError: (message: string) => void;
}

/** Liest die Eigenschaften aller Seiten eines Ordners. */
export async function loadRows(paths: readonly string[]): Promise<Row[]> {
  const rows = await Promise.all(
    paths.map(async (path) => {
      try {
        const text = await readPage(path);
        return { path, title: pageTitle(path), values: readProperties(splitFrontmatter(text.replace(/^﻿/, "")).frontmatter) };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((row): row is Row => row !== null);
}

/** Ändert eine Eigenschaft direkt in der Datei einer Seite (null entfernt sie). */
export async function writeRowValue(path: string, name: string, value: PropertyValue | null): Promise<void> {
  const text = await readPage(path);
  const bom = text.startsWith("﻿") ? "﻿" : "";
  const { frontmatter, body } = splitFrontmatter(text.slice(bom.length));
  await writePage(path, bom + joinFrontmatter(setProperty(frontmatter, name, value), body));
}

export function DatabaseView(props: Props) {
  const { folder, config, pagePaths, version } = props;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<"sort" | "filter" | "add" | "views" | null>(null);
  const [columnMenu, setColumnMenu] = useState<string | null>(null);
  const [active, setActiveState] = useState(() => readActiveView(folder));
  const viewIndex = Math.min(active, config.ansichten.length - 1);
  const view = config.ansichten[viewIndex];
  const schema = config.eigenschaften;
  const setActive = (index: number) => {
    setActiveState(index);
    setPanel(null);
    try {
      localStorage.setItem(`ansicht:${folder}`, String(index));
    } catch {
      // Ohne Speicher startet die Datenbank mit der ersten Ansicht.
    }
  };

  // Nur neu laden, wenn sich die Seiten im Ordner oder ihre Dateien wirklich geändert haben
  // (pagePaths ist bei jedem Neuzeichnen ein neues Array).
  const pathsKey = pagePaths.join("\n");
  useEffect(() => {
    let cancelled = false;
    void loadRows(pathsKey ? pathsKey.split("\n") : []).then((loaded) => {
      if (cancelled) return;
      setRows(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pathsKey, version]);

  const shown = useMemo(() => applyView(rows, view, schema), [rows, view, schema]);
  const columns = visibleColumns(view, schema);
  const groupBy = view.typ === "kanban" ? groupProperty(view, config) : null;
  const dateBy = view.typ === "kalender" ? calendarProperty(view, config) : null;

  const saveView = (changes: Partial<typeof view>) => {
    props.onSaveConfig({ ...config, ansichten: replaceAt(config.ansichten, viewIndex, { ...view, ...changes }) });
  };

  const addView = (typ: "tabelle" | "kanban" | "kalender") => {
    const base =
      typ === "kanban"
        ? { name: "Kanban", typ, gruppierung: groupableProperties(config)[0] }
        : typ === "kalender"
          ? { name: "Kalender", typ, datum: dateProperties(config)[0], modus: "monat" }
          : { name: "Tabelle", typ };
    const names = config.ansichten.map((v) => v.name);
    let name = base.name;
    for (let i = 2; names.includes(name); i++) name = `${base.name} ${i}`;
    props.onSaveConfig({ ...config, ansichten: [...config.ansichten, { ...base, name, sortierung: [], filter: [] }] });
    setActive(config.ansichten.length);
  };

  const removeView = () => {
    if (config.ansichten.length <= 1) return;
    props.onSaveConfig({ ...config, ansichten: config.ansichten.filter((_, i) => i !== viewIndex) });
    setActive(Math.max(0, viewIndex - 1));
  };

  const createCard = async (value: string | null, property: string) => {
    const path = await props.onCreateRow();
    if (!path) return;
    try {
      if (value !== null) await writeRowValue(path, property, value);
    } catch (error) {
      props.onError(errorMessage(error));
    }
    setRows(await loadRows([...pagePaths.filter((p) => p !== path), path]));
  };

  const setCell = async (row: Row, name: string, value: PropertyValue | null) => {
    setRows((current) =>
      current.map((r) => (r.path === row.path ? { ...r, values: withValue(r.values, name, value) } : r)),
    );
    try {
      await props.beforeWrite();
      await writeRowValue(row.path, name, value);
    } catch (error) {
      props.onError(`„${row.title}“ konnte nicht gespeichert werden: ${errorMessage(error)}`);
    }
  };

  const setType = (name: string, type: PropertyType) => {
    const previous = schema[name];
    const optionen = type === "auswahl" || type === "status" || type === "mehrfachauswahl" ? optionsFor(name, previous, rows) : undefined;
    props.onSaveConfig({
      ...config,
      eigenschaften: { ...schema, [name]: { ...previous, typ: type, ...(optionen && optionen.length > 0 ? { optionen } : {}) } },
    });
  };

  const removeProperty = (name: string) => {
    const rest = { ...schema };
    delete rest[name];
    props.onSaveConfig({
      ...config,
      eigenschaften: rest,
      ansichten: config.ansichten.map((v) => ({
        ...v,
        sortierung: v.sortierung.filter((s) => s.eigenschaft !== name),
        filter: v.filter.filter((f) => f.eigenschaft !== name),
        ...(v.spalten ? { spalten: v.spalten.filter((s) => s !== name) } : {}),
      })),
    });
  };

  const sortBy = (name: string, richtung: SortRule["richtung"]) => {
    saveView({ sortierung: [{ eigenschaft: name, richtung }, ...view.sortierung.filter((s) => s.eigenschaft !== name)] });
  };

  const filterable = [NAME_COLUMN, ...Object.keys(schema)];
  const typeOf = (name: string): PropertyType => schema[name]?.typ ?? "text";

  return (
    <div className="database">
      <div className="database-header">
        <h1>
          <span aria-hidden="true">🗃️</span> {folder.slice(folder.lastIndexOf("/") + 1)}
        </h1>
        <div className="database-toolbar">
          {view.typ === "kalender" && dateBy && (
            <label className="group-select">
              Datum aus{" "}
              <select aria-label="Datum aus" value={dateBy} onChange={(event) => saveView({ datum: event.target.value })}>
                {dateProperties(config).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          {view.typ === "kanban" && groupBy && (
            <label className="group-select">
              Gruppieren nach{" "}
              <select aria-label="Gruppieren nach" value={groupBy} onChange={(event) => saveView({ gruppierung: event.target.value })}>
                {groupableProperties(config).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className={view.filter.length > 0 ? "active" : ""} onClick={() => setPanel(panel === "filter" ? null : "filter")}>
            Filter{view.filter.length > 0 ? ` (${view.filter.length})` : ""}
          </button>
          <button type="button" className={view.sortierung.length > 0 ? "active" : ""} onClick={() => setPanel(panel === "sort" ? null : "sort")}>
            Sortieren{view.sortierung.length > 0 ? ` (${view.sortierung.length})` : ""}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => void createCard(null, groupBy ?? dateBy ?? "")}
          >
            + Neu
          </button>
        </div>
      </div>

      <div className="view-tabs" role="tablist" aria-label="Ansichten">
        {config.ansichten.map((v, index) => (
          <ViewTab
            key={index}
            view={v}
            selected={index === viewIndex}
            onSelect={() => setActive(index)}
            onRename={(name) => props.onSaveConfig({ ...config, ansichten: replaceAt(config.ansichten, index, { ...v, name }) })}
          />
        ))}
        <button type="button" className="view-add" aria-label="Ansicht hinzufügen" title="Ansicht hinzufügen" onClick={() => setPanel(panel === "views" ? null : "views")}>
          +
        </button>
        {config.ansichten.length > 1 && (
          <button type="button" className="view-remove" title="Diese Ansicht entfernen (die Seiten bleiben erhalten)" onClick={removeView}>
            Ansicht entfernen
          </button>
        )}
      </div>

      {panel === "views" && (
        <div className="database-panel" aria-label="Neue Ansicht">
          <button type="button" onClick={() => addView("tabelle")}>
            ▦ Tabelle
          </button>
          <button
            type="button"
            disabled={groupableProperties(config).length === 0}
            title={groupableProperties(config).length === 0 ? "Dafür braucht die Datenbank eine Status- oder Auswahl-Eigenschaft." : undefined}
            onClick={() => addView("kanban")}
          >
            ▥ Kanban
          </button>
          <button
            type="button"
            disabled={dateProperties(config).length === 0}
            title={dateProperties(config).length === 0 ? "Dafür braucht die Datenbank eine Datums-Eigenschaft." : undefined}
            onClick={() => addView("kalender")}
          >
            📅 Kalender
          </button>
          {groupableProperties(config).length === 0 && (
            <p className="muted-small">Für ein Kanban braucht die Datenbank eine Eigenschaft vom Typ Status oder Auswahl.</p>
          )}
          {dateProperties(config).length === 0 && <p className="muted-small">Für einen Kalender braucht die Datenbank eine Eigenschaft vom Typ Datum.</p>}
        </div>
      )}

      {panel === "sort" && (
        <div className="database-panel" aria-label="Sortierung">
          {view.sortierung.length === 0 && <p className="muted-small">Ohne Sortierung stehen die Einträge alphabetisch nach Name.</p>}
          {view.sortierung.map((rule, index) => (
            <div key={index} className="panel-row">
              <select
                aria-label="Sortieren nach"
                value={rule.eigenschaft}
                onChange={(event) => saveView({ sortierung: replaceAt(view.sortierung, index, { ...rule, eigenschaft: event.target.value }) })}
              >
                {filterable.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <select
                aria-label="Richtung"
                value={rule.richtung}
                onChange={(event) =>
                  saveView({ sortierung: replaceAt(view.sortierung, index, { ...rule, richtung: event.target.value as SortRule["richtung"] }) })
                }
              >
                <option value="aufsteigend">aufsteigend</option>
                <option value="absteigend">absteigend</option>
              </select>
              <button type="button" aria-label="Sortierung entfernen" onClick={() => saveView({ sortierung: view.sortierung.filter((_, i) => i !== index) })}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="link-button" onClick={() => saveView({ sortierung: [...view.sortierung, { eigenschaft: filterable[1] ?? NAME_COLUMN, richtung: "aufsteigend" }] })}>
            + Sortierung hinzufügen
          </button>
        </div>
      )}

      {panel === "filter" && (
        <div className="database-panel" aria-label="Filter">
          {view.filter.length === 0 && <p className="muted-small">Kein Filter: Alle Einträge werden angezeigt.</p>}
          {view.filter.map((rule, index) => (
            <FilterEditor
              key={index}
              rule={rule}
              names={filterable}
              type={rule.eigenschaft === NAME_COLUMN ? "text" : typeOf(rule.eigenschaft)}
              options={optionsFor(rule.eigenschaft, schema[rule.eigenschaft], rows)}
              typeOf={(name) => (name === NAME_COLUMN ? "text" : typeOf(name))}
              onChange={(next) => saveView({ filter: replaceAt(view.filter, index, next) })}
              onRemove={() => saveView({ filter: view.filter.filter((_, i) => i !== index) })}
            />
          ))}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              const name = filterable[1] ?? NAME_COLUMN;
              const type = name === NAME_COLUMN ? "text" : typeOf(name);
              saveView({ filter: [...view.filter, { eigenschaft: name, operator: operatorsFor(type)[0] }] });
            }}
          >
            + Filter hinzufügen
          </button>
        </div>
      )}

      {view.typ === "kalender" ? (
        dateBy ? (
          <CalendarView
            rows={rows}
            view={view}
            config={config}
            property={dateBy}
            onOpen={props.onOpenPage}
            onMove={(row, value) => void setCell(row, dateBy, value)}
            onCreate={(day) => void createCard(day, dateBy)}
            onSaveView={saveView}
          />
        ) : (
          <p className="muted-small">Für einen Kalender braucht die Datenbank eine Eigenschaft vom Typ Datum.</p>
        )
      ) : view.typ === "kanban" ? (
        groupBy ? (
          <KanbanBoard
            rows={rows}
            view={view}
            config={config}
            property={groupBy}
            onOpen={props.onOpenPage}
            onMove={(row, value) => void setCell(row, groupBy, value)}
            onCreate={(value) => void createCard(value, groupBy)}
          />
        ) : (
          <p className="muted-small">Für ein Kanban braucht die Datenbank eine Eigenschaft vom Typ Status oder Auswahl.</p>
        )
      ) : (
      <>
      <div className="table-wrapper">
        <table className="database-table">
          <thead>
            <tr>
              <th className="col-name">Aa {NAME_COLUMN}</th>
              {columns.map((name) => (
                <th key={name}>
                  <button type="button" className="column-header" onClick={() => setColumnMenu(columnMenu === name ? null : name)}>
                    <span aria-hidden="true">{typeInfo(typeOf(name)).icon}</span> {name}
                    {view.sortierung[0]?.eigenschaft === name && (view.sortierung[0].richtung === "aufsteigend" ? " ↑" : " ↓")}
                  </button>
                  {columnMenu === name && (
                    <div className="property-menu column-menu" role="menu">
                      <button type="button" onClick={() => (sortBy(name, "aufsteigend"), setColumnMenu(null))}>
                        Aufsteigend sortieren
                      </button>
                      <button type="button" onClick={() => (sortBy(name, "absteigend"), setColumnMenu(null))}>
                        Absteigend sortieren
                      </button>
                      <label>
                        Typ{" "}
                        <select
                          aria-label={`Typ von „${name}“`}
                          value={typeOf(name)}
                          onChange={(event) => {
                            setType(name, event.target.value as PropertyType);
                            setColumnMenu(null);
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
                        title="Die Werte bleiben in den Seiten stehen."
                        onClick={() => {
                          setColumnMenu(null);
                          removeProperty(name);
                        }}
                      >
                        Aus der Datenbank entfernen
                      </button>
                    </div>
                  )}
                </th>
              ))}
              <th className="col-add">
                <button type="button" aria-label="Eigenschaft hinzufügen" title="Eigenschaft hinzufügen" onClick={() => setPanel(panel === "add" ? null : "add")}>
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.path}>
                <td className="col-name">
                  <NameCell row={row} onOpen={() => props.onOpenPage(row.path)} onRename={(title) => props.onRenamePage(row.path, title)} />
                </td>
                {columns.map((name) => (
                  <td key={name}>
                    <PropertyInput
                      type={typeOf(name)}
                      value={row.values[name]}
                      options={optionsFor(name, schema[name], rows)}
                      label={`${name} von „${row.title}“`}
                      onChange={(value) => void setCell(row, name, value)}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="muted-small">
                  {rows.length === 0 ? "Noch keine Einträge. „+ Neu“ legt eine Seite an." : "Kein Eintrag passt zu den Filtern."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {panel === "add" && (
        <div className="database-panel">
          <AddPropertyForm
            existing={[NAME_COLUMN, ...Object.keys(schema)]}
            onAdd={(name, type) => {
              setPanel(null);
              setType(name, type);
            }}
            onCancel={() => setPanel(null)}
          />
        </div>
      )}
      </>
      )}
      <p className="muted-small database-count">
        {shown.length} von {rows.length} {rows.length === 1 ? "Eintrag" : "Einträgen"}
      </p>
    </div>
  );
}

/** Zuletzt gewählte Ansicht dieser Datenbank (nur Bedienkomfort, nicht im Vault gespeichert). */
function readActiveView(folder: string): number {
  try {
    return Math.max(0, Number(localStorage.getItem(`ansicht:${folder}`)) || 0);
  } catch {
    return 0;
  }
}

/** Reiter einer Ansicht; Doppelklick benennt sie um. */
function ViewTab({ view, selected, onSelect, onRename }: { view: ViewConfig; selected: boolean; onSelect: () => void; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const icon = view.typ === "kanban" ? "▥" : view.typ === "kalender" ? "📅" : "▦";
  if (editing) {
    return (
      <input
        autoFocus
        className="view-tab-input"
        aria-label="Name der Ansicht"
        defaultValue={view.name}
        onBlur={(event) => {
          setEditing(false);
          const name = event.currentTarget.value.trim();
          if (name && name !== view.name) onRename(name);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`view-tab${selected ? " selected" : ""}`}
      title="Doppelklick zum Umbenennen"
      onClick={onSelect}
      onDoubleClick={() => setEditing(true)}
    >
      {icon} {view.name}
    </button>
  );
}

function withValue(values: Record<string, unknown>, name: string, value: PropertyValue | null): Record<string, unknown> {
  const next = { ...values };
  if (value === null) delete next[name];
  else next[name] = value;
  return next;
}

function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((existing, i) => (i === index ? item : existing));
}

function NameCell({ row, onOpen, onRename }: { row: Row; onOpen: () => void; onRename: (title: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState(row.title);
  useEffect(() => setDraft(row.title), [row.title]);
  return (
    <span className="name-cell">
      <span aria-hidden="true">{typeof row.values.icon === "string" ? row.values.icon : "📄"}</span>
      <input
        className="prop-input name-input"
        aria-label={`Name von „${row.title}“`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={async () => {
          if (draft.trim() && draft.trim() !== row.title && !(await onRename(draft.trim()))) setDraft(row.title);
        }}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      />
      <button type="button" className="open-button" onClick={onOpen}>
        Öffnen
      </button>
    </span>
  );
}

function FilterEditor(props: {
  rule: FilterRule;
  names: string[];
  type: PropertyType;
  options: string[];
  typeOf: (name: string) => PropertyType;
  onChange: (rule: FilterRule) => void;
  onRemove: () => void;
}) {
  const { rule, type } = props;
  const operators = operatorsFor(type);
  return (
    <div className="panel-row">
      <select
        aria-label="Filter-Eigenschaft"
        value={rule.eigenschaft}
        onChange={(event) => props.onChange({ eigenschaft: event.target.value, operator: operatorsFor(props.typeOf(event.target.value))[0] })}
      >
        {props.names.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
      <select
        aria-label="Bedingung"
        value={operators.includes(rule.operator) ? rule.operator : operators[0]}
        onChange={(event) => props.onChange({ ...rule, operator: event.target.value as FilterOperator })}
      >
        {operators.map((op) => (
          <option key={op}>{op}</option>
        ))}
      </select>
      {operatorNeedsValue(rule.operator) && (
        <PropertyInput
          type={type === "mehrfachauswahl" ? "auswahl" : type}
          value={rule.wert}
          options={props.options}
          label="Filterwert"
          onChange={(value) => {
            const next = { ...rule };
            const normalized = value === null ? null : normalizeValue(type === "mehrfachauswahl" ? "auswahl" : type, value);
            if (normalized === null || Array.isArray(normalized)) delete next.wert;
            else next.wert = normalized;
            props.onChange(next);
          }}
        />
      )}
      <button type="button" aria-label="Filter entfernen" onClick={props.onRemove}>
        ×
      </button>
    </div>
  );
}
