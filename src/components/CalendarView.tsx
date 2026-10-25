// Kalenderansicht einer Datenbank (Monat oder Woche) nach einer Datums-Eigenschaft.
// Einträge lassen sich auf andere Tage ziehen, ein Klick auf einen Tag legt einen Eintrag an,
// Einträge ohne Datum stehen in der Liste "Ohne Datum".
import { useRef, useState, type DragEvent } from "react";
import {
  addDays,
  entriesByDay,
  makeDate,
  monthGrid,
  monthTitle,
  moveToDay,
  timeOf,
  today,
  WEEKDAYS,
  weekDays,
  weekTitle,
} from "../lib/calendar";
import type { DatabaseConfig, Row, ViewConfig } from "../lib/database";

interface Props {
  rows: Row[];
  view: ViewConfig;
  config: DatabaseConfig;
  property: string;
  onOpen: (path: string) => void;
  /** Neues Datum für einen Eintrag (null = Datum entfernen). */
  onMove: (row: Row, value: string | null) => void;
  onCreate: (day: string) => void;
  onSaveView: (changes: Partial<ViewConfig>) => void;
}

function formatDay(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
}

export function CalendarView({ rows, view, config, property, onOpen, onMove, onCreate, onSaveView }: Props) {
  const mode = view.modus === "woche" ? "woche" : "monat";
  const [anchor, setAnchor] = useState(today);
  const [over, setOver] = useState<string | null>(null);
  const dragged = useRef<string | null>(null);
  const { byDay, undated } = entriesByDay(rows, view, config, property);

  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const weeks = mode === "monat" ? monthGrid(year, month) : [weekDays(anchor)];
  const step = (direction: number) =>
    setAnchor(mode === "monat" ? makeDate(year, month + direction, 1) : addDays(anchor, 7 * direction));

  const dragProps = (row: Row) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      dragged.current = row.path;
      event.dataTransfer?.setData("text/plain", row.path);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    },
    onDragEnd: () => setOver(null),
  });

  const dropProps = (target: string) => ({
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setOver(target);
    },
    onDragLeave: () => setOver(null),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setOver(null);
      const path = event.dataTransfer?.getData("text/plain") || dragged.current;
      dragged.current = null;
      const row = rows.find((r) => r.path === path);
      if (!row) return;
      const value = target === "ohne" ? null : moveToDay(row.values[property], target);
      if (value !== (row.values[property] ?? null)) onMove(row, value);
    },
  });

  const entry = (row: Row) => {
    const time = timeOf(row.values[property]);
    return (
      <button
        key={row.path}
        type="button"
        className="calendar-entry"
        aria-label={row.title}
        title={`${row.title} – ziehen zum Verschieben, klicken zum Öffnen`}
        {...dragProps(row)}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(row.path);
        }}
      >
        {time && <span className="calendar-time">{time}</span>}
        {typeof row.values.icon === "string" ? `${row.values.icon} ` : ""}
        {row.title}
      </button>
    );
  };

  const now = today();
  return (
    <div className="calendar-layout">
      <div className="calendar">
        <div className="calendar-toolbar">
          <button type="button" aria-label={mode === "monat" ? "Vorheriger Monat" : "Vorherige Woche"} onClick={() => step(-1)}>
            ‹
          </button>
          <button type="button" onClick={() => setAnchor(today())}>
            Heute
          </button>
          <button type="button" aria-label={mode === "monat" ? "Nächster Monat" : "Nächste Woche"} onClick={() => step(1)}>
            ›
          </button>
          <h2 className="calendar-title">{mode === "monat" ? monthTitle(year, month) : weekTitle(anchor)}</h2>
          <div className="calendar-mode" role="group" aria-label="Zeitraum">
            <button type="button" aria-pressed={mode === "monat"} onClick={() => onSaveView({ modus: "monat" })}>
              Monat
            </button>
            <button type="button" aria-pressed={mode === "woche"} onClick={() => onSaveView({ modus: "woche" })}>
              Woche
            </button>
          </div>
        </div>
        <div className={`calendar-grid ${mode}`} role="grid" aria-label={`Kalender nach ${property}`}>
          <div className="calendar-row calendar-head" role="row">
            {WEEKDAYS.map((name) => (
              <div key={name} role="columnheader">
                {name}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]} className="calendar-row" role="row">
              {week.map((day) => (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={formatDay(day)}
                  className={[
                    "calendar-day",
                    mode === "monat" && Number(day.slice(5, 7)) !== month ? "outside" : "",
                    day === now ? "today" : "",
                    over === day ? "drop-target" : "",
                  ].join(" ")}
                  title="Klicken legt einen Eintrag an diesem Tag an"
                  onClick={() => onCreate(day)}
                  {...dropProps(day)}
                >
                  <span className="calendar-day-number">{mode === "woche" ? `${WEEKDAYS[weekDays(day).indexOf(day)]} ${day.slice(8, 10)}.` : Number(day.slice(8, 10))}</span>
                  {(byDay.get(day) ?? []).map(entry)}
                  <span className="calendar-add" aria-hidden="true">
                    +
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <aside className={`calendar-undated${over === "ohne" ? " drop-target" : ""}`} aria-label="Ohne Datum" {...dropProps("ohne")}>
        <h3>
          Ohne Datum <span className="kanban-count">{undated.length}</span>
        </h3>
        {undated.length === 0 ? <p className="muted-small">Alle Einträge haben ein Datum.</p> : undated.map(entry)}
      </aside>
    </div>
  );
}
