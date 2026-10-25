// Kanban-Ansicht: eine Spalte pro Wert einer Status- oder Auswahl-Eigenschaft.
// Karten lassen sich per Drag & Drop in eine andere Spalte ziehen; das ändert den Wert in der Datei.
import { useRef, useState } from "react";
import type { DatabaseConfig, Row, ViewConfig } from "../lib/database";
import { groupRows } from "../lib/kanban";
import { formatValue, RESERVED_FIELDS } from "../lib/properties";

interface Props {
  rows: Row[];
  view: ViewConfig;
  config: DatabaseConfig;
  property: string;
  onOpen: (path: string) => void;
  /** Karte in die Spalte `value` verschieben (null = "Ohne …"). */
  onMove: (row: Row, value: string | null) => void;
  /** Neue Karte direkt in einer Spalte anlegen. */
  onCreate: (value: string | null) => void;
}

export function KanbanBoard({ rows, view, config, property, onOpen, onMove, onCreate }: Props) {
  const columns = groupRows(rows, view, config, property);
  const dragged = useRef<string | null>(null);
  const [over, setOver] = useState<string | null | undefined>(undefined);

  const drop = (value: string | null, path: string | undefined) => {
    setOver(undefined);
    const row = rows.find((r) => r.path === (path || dragged.current));
    dragged.current = null;
    if (!row) return;
    const current = row.values[property];
    const currentValue = current === undefined || current === null || current === "" ? null : String(current);
    if ((currentValue ?? "").toLowerCase() !== (value ?? "").toLowerCase()) onMove(row, value);
  };

  return (
    <div className="kanban" role="list" aria-label={`Kanban nach ${property}`}>
      {columns.map((column) => (
        <section
          key={column.value ?? "\0ohne"}
          role="listitem"
          aria-label={`Spalte ${column.label}`}
          className={`kanban-column${over === column.value ? " drop-target" : ""}${column.value === null ? " empty-column" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            setOver(column.value);
          }}
          onDragLeave={() => setOver(undefined)}
          onDrop={(event) => {
            event.preventDefault();
            drop(column.value, event.dataTransfer?.getData("text/plain"));
          }}
        >
          <header className="kanban-column-header">
            <span className={`kanban-label status-${(column.value ?? "ohne").toLowerCase().replace(/\s+/g, "-")}`}>{column.label}</span>
            <span className="kanban-count">{column.rows.length}</span>
          </header>
          {column.rows.map((row) => (
            <article
              key={row.path}
              className="kanban-card"
              draggable
              aria-label={row.title}
              onDragStart={(event) => {
                dragged.current = row.path;
                event.dataTransfer?.setData("text/plain", row.path);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setOver(undefined)}
              onClick={() => onOpen(row.path)}
              onKeyDown={(event) => event.key === "Enter" && onOpen(row.path)}
              tabIndex={0}
            >
              <div className="kanban-card-title">
                <span aria-hidden="true">{typeof row.values.icon === "string" ? row.values.icon : "📄"}</span> {row.title}
              </div>
              <CardDetails row={row} config={config} property={property} />
            </article>
          ))}
          <button type="button" className="kanban-add" onClick={() => onCreate(column.value)}>
            + Neu
          </button>
        </section>
      ))}
    </div>
  );
}

/** Bis zu drei weitere Eigenschaften klein auf der Karte (z. B. Fälligkeit). */
function CardDetails({ row, config, property }: { row: Row; config: DatabaseConfig; property: string }) {
  const details = Object.entries(config.eigenschaften)
    .filter(([name]) => name !== property && !RESERVED_FIELDS.has(name))
    .map(([name, def]) => [name, formatValue(def.typ, row.values[name])] as const)
    .filter(([, text]) => text !== "")
    .slice(0, 3);
  if (details.length === 0) return null;
  return (
    <div className="kanban-card-details">
      {details.map(([name, text]) => (
        <span key={name} title={name}>
          {text}
        </span>
      ))}
    </div>
  );
}
