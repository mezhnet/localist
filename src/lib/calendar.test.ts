import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOf,
  entriesByDay,
  isoWeek,
  makeDate,
  monthGrid,
  moveToDay,
  startOfWeek,
  timeOf,
  today,
  weekDays,
  weekTitle,
} from "./calendar";
import { defaultView, type DatabaseConfig, type Row } from "./database";

describe("Datumsformat", () => {
  it("liest YYYY-MM-DD und YYYY-MM-DDTHH:MM, alles andere zählt als „ohne Datum“", () => {
    expect(dayOf("2026-11-15")).toBe("2026-11-15");
    expect(dayOf("2026-11-15T09:30")).toBe("2026-11-15");
    expect(timeOf("2026-11-15T09:30")).toBe("09:30");
    expect(timeOf("2026-11-15")).toBeNull();
    expect(dayOf("15.11.2026")).toBeNull();
    expect(dayOf("2026-02-30")).toBeNull(); // Format stimmt, Tag gibt es nicht
    expect(dayOf("2028-02-29")).toBe("2028-02-29"); // Schaltjahr
    expect(dayOf(20261115)).toBeNull();
  });

  it("verschiebt auf einen anderen Tag und behält die Uhrzeit", () => {
    expect(moveToDay("2026-11-15", "2026-11-20")).toBe("2026-11-20");
    expect(moveToDay("2026-11-15T09:30", "2026-12-01")).toBe("2026-12-01T09:30");
    expect(moveToDay(undefined, "2026-12-01")).toBe("2026-12-01");
  });

  it("rechnet über Monats-, Jahres- und Sommerzeitgrenzen", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30"); // Umstellung auf Sommerzeit am 29.03.2026
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // Umstellung auf Winterzeit am 25.10.2026
    expect(makeDate(2026, 13, 1)).toBe("2027-01-01");
    expect(today(new Date(2026, 9, 25, 23, 59))).toBe("2026-10-25");
  });
});

describe("Wochengrenzen", () => {
  it("Wochen beginnen am Montag", () => {
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // Sonntag → Montag davor
    expect(startOfWeek("2026-11-16")).toBe("2026-11-16"); // Montag bleibt
    expect(weekDays("2027-01-01")).toEqual(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  });

  it("Kalenderwochen nach ISO 8601, auch am Jahreswechsel", () => {
    expect(isoWeek("2026-11-15")).toEqual({ year: 2026, week: 46 });
    expect(isoWeek("2026-12-31")).toEqual({ year: 2026, week: 53 }); // 2026 hat 53 Wochen
    expect(isoWeek("2027-01-03")).toEqual({ year: 2026, week: 53 });
    expect(isoWeek("2027-01-04")).toEqual({ year: 2027, week: 1 });
    expect(isoWeek("2025-12-29")).toEqual({ year: 2026, week: 1 }); // Montag gehört schon zu KW 1/2026
    expect(weekTitle("2026-12-31")).toBe("KW 53 · 28.12.2026–03.01.2027"); // über den Jahreswechsel: beide Jahre
    expect(weekTitle("2026-11-15")).toBe("KW 46 · 09.11.–15.11.2026");
  });
});

describe("Monatsgrenzen", () => {
  it("die Monatsansicht beginnt am Montag vor dem 1. und endet am Sonntag nach dem Letzten", () => {
    const november = monthGrid(2026, 11); // 1.11.2026 ist ein Sonntag
    expect(november).toHaveLength(6);
    expect(november[0][0]).toBe("2026-10-26");
    expect(november[0][6]).toBe("2026-11-01");
    expect(november[5][6]).toBe("2026-12-06");
    expect(november.every((week) => week.length === 7)).toBe(true);
  });

  it("Februar 2027 passt genau in vier Wochen, Schaltjahr-Februar 2028 nicht", () => {
    const feb2027 = monthGrid(2027, 2); // beginnt Montag, 28 Tage
    expect(feb2027).toHaveLength(4);
    expect(feb2027[0][0]).toBe("2027-02-01");
    expect(feb2027[3][6]).toBe("2027-02-28");
    const feb2028 = monthGrid(2028, 2);
    expect(feb2028.flat()).toContain("2028-02-29");
    expect(feb2028[feb2028.length - 1][6] >= "2028-02-29").toBe(true);
  });
});

describe("Einträge im Kalender", () => {
  const config: DatabaseConfig = { eigenschaften: { fällig: { typ: "datum" } }, ansichten: [defaultView()], weitere: {} };
  const rows: Row[] = [
    { path: "a.md", title: "Abends", values: { fällig: "2026-11-15T18:00" } },
    { path: "b.md", title: "Ganztägig", values: { fällig: "2026-11-15" } },
    { path: "c.md", title: "Morgens", values: { fällig: "2026-11-15T08:00" } },
    { path: "d.md", title: "Ohne", values: {} },
    { path: "e.md", title: "Kaputt", values: { fällig: "irgendwann" } },
  ];

  it("ordnet Einträge ihrem Tag zu (ganztägig zuerst, dann nach Uhrzeit), der Rest ist „ohne Datum“", () => {
    const { byDay, undated } = entriesByDay(rows, { ...defaultView(), typ: "kalender" }, config, "fällig");
    expect(byDay.get("2026-11-15")!.map((r) => r.title)).toEqual(["Ganztägig", "Morgens", "Abends"]);
    expect(undated.map((r) => r.title)).toEqual(["Kaputt", "Ohne"]);
  });
});
