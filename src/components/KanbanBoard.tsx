// Kanban-Ansicht: eine Spalte pro Wert einer Status- oder Auswahl-Eigenschaft.
// Karten lassen sich in eine andere Spalte ziehen (src/lib/ziehen.ts: Maus sofort, Finger nach langem Drücken);
// das ändert den Wert in der Datei.
import { FileText, Plus } from "lucide-react";
import { useRef } from "react";
import type { DatabaseConfig, Row, ViewConfig } from "../lib/database";
import { groupRows } from "../lib/kanban";
import { formatValue, RESERVED_FIELDS } from "../lib/properties";
import { useZiehen } from "../lib/ziehen";
import { Badge, Button } from "./ui";

interface Props {
  rows: Row[];
  view: ViewConfig;
  config: DatabaseConfig;
  property: string;
  /** Emoji-Icons der Seiten (aus dem Suchindex). */
  icons: ReadonlyMap<string, string>;
  onOpen: (path: string) => void;
  /** Karte in die Spalte `value` verschieben (null = "Ohne …"). */
  onMove: (row: Row, value: string | null) => void;
  /** Neue Karte direkt in einer Spalte anlegen. */
  onCreate: (value: string | null) => void;
}

export function KanbanBoard({ rows, view, config, property, icons, onOpen, onMove, onCreate }: Props) {
  const columns = groupRows(rows, view, config, property);
  const board = useRef<HTMLDivElement>(null);

  const drop = (row: Row, value: string | null) => {
    const current = row.values[property];
    const currentValue = current === undefined || current === null || current === "" ? null : String(current);
    if ((currentValue ?? "").toLowerCase() !== (value ?? "").toLowerCase()) onMove(row, value);
  };

  /** Ziel ist die Spalte unter dem Zeiger (`data-spalte`, "" = „Ohne …“). */
  const ziehen = useZiehen<Row, { wert: string | null }>({
    zielAn: (element) => {
      const spalte = element.closest<HTMLElement>("[data-spalte]");
      if (!spalte || !board.current?.contains(spalte)) return null;
      return { wert: spalte.dataset.spalte || null };
    },
    onAblegen: (row, ziel) => drop(row, ziel.wert),
  });
  /** Spalte, in die gerade abgelegt würde (null = „Ohne …“, undefined = keine). */
  const over = ziehen.zustand?.ziel ? ziehen.zustand.ziel.wert : undefined;
  const gezogen = ziehen.zustand;

  return (
    <div className="kanban" role="list" aria-label={`Kanban nach ${property}`} ref={board}>
      {columns.map((column) => (
        <section
          key={column.value ?? "\0ohne"}
          role="listitem"
          aria-label={`Spalte ${column.label}`}
          className={`kanban-column${over === column.value ? " drop-target" : ""}${column.value === null ? " empty-column" : ""}`}
          data-spalte={column.value ?? ""}
        >
          <header className="kanban-column-header">
            <span className={`kanban-label status-${(column.value ?? "ohne").toLowerCase().replace(/\s+/g, "-")}`}>{column.label}</span>
            <Badge>{column.rows.length}</Badge>
          </header>
          {column.rows.map((row) => (
            <article
              key={row.path}
              className={`kanban-card${gezogen?.quelle.path === row.path ? (gezogen.phase === "gegriffen" ? " is-gegriffen" : " is-gezogen") : ""}`}
              aria-label={row.title}
              {...ziehen.griff(row)}
              onClick={() => onOpen(row.path)}
              onKeyDown={(event) => event.key === "Enter" && onOpen(row.path)}
              tabIndex={0}
            >
              <div className="kanban-card-title">
                <span className="kanban-card-icon" aria-hidden="true">
                  {typeof row.values.icon === "string" ? row.values.icon : (icons.get(row.path) ?? <FileText />)}
                </span>
                <span>{row.title}</span>
              </div>
              <CardDetails row={row} config={config} property={property} />
            </article>
          ))}
          <Button variant="ghost" size="sm" className="kanban-add" icon={<Plus />} onClick={() => onCreate(column.value)}>
            Neu
          </Button>
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
