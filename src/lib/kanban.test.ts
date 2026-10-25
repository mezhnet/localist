import { describe, expect, it } from "vitest";
import { defaultView, type DatabaseConfig, type Row } from "./database";
import { groupableProperties, groupProperty, groupRows, moveCard } from "./kanban";
import { readProperties } from "./properties";

const config: DatabaseConfig = {
  eigenschaften: {
    status: { typ: "status", optionen: ["Geplant", "In Arbeit", "Erledigt"] },
    priorität: { typ: "auswahl", optionen: ["niedrig", "hoch"] },
    fällig: { typ: "datum" },
  },
  ansichten: [defaultView()],
  weitere: {},
};

const rows: Row[] = [
  { path: "P/A.md", title: "A", values: { status: "In Arbeit", fällig: "2026-12-01" } },
  { path: "P/B.md", title: "B", values: { status: "Geplant" } },
  { path: "P/C.md", title: "C", values: { status: "in arbeit", fällig: "2026-11-01" } },
  { path: "P/D.md", title: "D", values: {} },
  { path: "P/E.md", title: "E", values: { status: "Wartet" } },
];

const kanban = { ...defaultView(), name: "Board", typ: "kanban", gruppierung: "status" };

describe("Kanban gruppieren", () => {
  it("bildet Spalten aus den Optionen, weiteren Werten und „Ohne …“", () => {
    const columns = groupRows(rows, kanban, config, "status");
    expect(columns.map((c) => c.label)).toEqual(["Geplant", "In Arbeit", "Erledigt", "Wartet", "Ohne status"]);
    expect(columns.map((c) => c.rows.map((r) => r.title))).toEqual([["B"], ["A", "C"], [], ["E"], ["D"]]);
  });

  it("Sortierung und Filter der Ansicht gelten in den Spalten", () => {
    const sorted = { ...kanban, sortierung: [{ eigenschaft: "fällig", richtung: "aufsteigend" as const }] };
    expect(groupRows(rows, sorted, config, "status")[1].rows.map((r) => r.title)).toEqual(["C", "A"]);
    const filtered = { ...kanban, filter: [{ eigenschaft: "fällig", operator: "ist nicht leer" as const }] };
    // Die Spalten bleiben stehen (auch "Wartet"), nur die Karten werden gefiltert.
    expect(groupRows(rows, filtered, config, "status").map((c) => c.rows.length)).toEqual([0, 2, 0, 0, 0]);
  });

  it("wählt die Gruppierungs-Eigenschaft: eingestellt oder die erste Status-/Auswahl-Eigenschaft", () => {
    expect(groupableProperties(config)).toEqual(["status", "priorität"]);
    expect(groupProperty({ ...kanban, gruppierung: "priorität" }, config)).toBe("priorität");
    expect(groupProperty({ ...kanban, gruppierung: "fällig" }, config)).toBe("status");
    expect(groupProperty(defaultView(), { ...config, eigenschaften: { fällig: { typ: "datum" } } })).toBeNull();
  });
});

describe("Kanban: Karte verschieben ändert den Wert", () => {
  const fm = "---\nid: 1\nstatus: Geplant\nnotiz: bleibt # unverändert\n---\n";

  it("setzt den neuen Wert und lässt den Rest unverändert", () => {
    const moved = moveCard(fm, "status", "In Arbeit");
    expect(moved).toBe("---\nid: 1\nstatus: In Arbeit\nnotiz: bleibt # unverändert\n---\n");
    expect(readProperties(moved).status).toBe("In Arbeit");
  });

  it("in „Ohne …“ gezogen wird der Wert entfernt, aus „Ohne …“ heraus neu angelegt", () => {
    expect(moveCard(fm, "status", null)).toBe("---\nid: 1\nnotiz: bleibt # unverändert\n---\n");
    expect(moveCard("---\nid: 2\n---\n", "status", "Erledigt")).toBe("---\nid: 2\nstatus: Erledigt\n---\n");
  });
});
