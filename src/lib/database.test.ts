import { describe, expect, it } from "vitest";
import {
  applyView,
  createDatabaseConfig,
  defaultView,
  parseDatabaseConfig,
  serializeDatabaseConfig,
  type PropertyDef,
  type Row,
} from "./database";

const rows: Row[] = [
  { path: "P/Umzug.md", title: "Umzug", values: { id: "1", status: "Geplant", fällig: "2027-03-01", aufwand: 8, tags: ["Privat"] } },
  { path: "P/Website.md", title: "Website", values: { id: "2", status: "In Arbeit", fällig: "2026-11-15", aufwand: 3, tags: ["Arbeit", "Web"] } },
  { path: "P/Steuer.md", title: "Steuer", values: { id: "3", status: "Erledigt", aufwand: 5, erledigt: true } },
];

const schema: Record<string, PropertyDef> = {
  status: { typ: "status" },
  fällig: { typ: "datum" },
  aufwand: { typ: "zahl" },
  tags: { typ: "mehrfachauswahl" },
  erledigt: { typ: "checkbox" },
};

describe("Datenbank anlegen", () => {
  it("leitet Eigenschaften und Typen aus den Seiten ab (ohne id, icon, cover)", () => {
    const config = createDatabaseConfig(rows);
    expect(config.eigenschaften).toEqual({
      status: { typ: "status", optionen: ["Geplant", "In Arbeit", "Erledigt", "Nicht begonnen"] },
      fällig: { typ: "datum" },
      aufwand: { typ: "zahl" },
      tags: { typ: "mehrfachauswahl", optionen: ["Privat", "Arbeit", "Web"] },
      erledigt: { typ: "checkbox" },
    });
    expect(config.ansichten).toEqual([defaultView()]);
  });

  it("_ansichten.yaml: schreiben und wieder lesen ergibt dasselbe, Unbekanntes bleibt erhalten", () => {
    const config = createDatabaseConfig(rows);
    config.ansichten[0].sortierung = [{ eigenschaft: "fällig", richtung: "absteigend" }];
    config.ansichten[0].filter = [{ eigenschaft: "status", operator: "ist nicht", wert: "Erledigt" }];
    config.weitere = { version: 1 };
    config.ansichten[0].zukunft = "bleibt";
    const text = serializeDatabaseConfig(config);
    expect(text).toContain("eigenschaften:\n  status:\n    typ: status\n");
    expect(text).toContain("        richtung: absteigend\n");
    expect(parseDatabaseConfig(text)).toEqual(config);
  });

  it("liest auch unvollständige oder kaputte Dateien", () => {
    expect(parseDatabaseConfig("")).toEqual({ eigenschaften: {}, ansichten: [defaultView()], weitere: {} });
    expect(parseDatabaseConfig("eigenschaften:\n  x: zahl\n  y:\n    typ: gibtsnicht\n").eigenschaften).toEqual({
      x: { typ: "zahl" },
      y: { typ: "text" },
    });
    expect(parseDatabaseConfig("::: kaputt").ansichten).toHaveLength(1);
  });
});

describe("Sortieren und Filtern", () => {
  const titles = (list: Row[]) => list.map((row) => row.title);

  it("ohne Einstellung nach Name sortiert", () => {
    expect(titles(applyView(rows, defaultView(), schema))).toEqual(["Steuer", "Umzug", "Website"]);
  });

  it("sortiert nach Datum und Zahl, leere Werte kommen immer ans Ende", () => {
    expect(titles(applyView(rows, { ...defaultView(), sortierung: [{ eigenschaft: "fällig", richtung: "aufsteigend" }] }, schema))).toEqual([
      "Website",
      "Umzug",
      "Steuer",
    ]);
    expect(titles(applyView(rows, { ...defaultView(), sortierung: [{ eigenschaft: "fällig", richtung: "absteigend" }] }, schema))).toEqual([
      "Umzug",
      "Website",
      "Steuer",
    ]);
    expect(titles(applyView(rows, { ...defaultView(), sortierung: [{ eigenschaft: "aufwand", richtung: "absteigend" }] }, schema))).toEqual([
      "Umzug",
      "Steuer",
      "Website",
    ]);
  });

  it("filtert je Typ, mehrere Filter müssen alle zutreffen", () => {
    const view = (filter: ReturnType<typeof defaultView>["filter"]) => ({ ...defaultView(), filter });
    expect(titles(applyView(rows, view([{ eigenschaft: "status", operator: "ist", wert: "in arbeit" }]), schema))).toEqual(["Website"]);
    expect(titles(applyView(rows, view([{ eigenschaft: "status", operator: "ist nicht", wert: "Erledigt" }]), schema))).toEqual(["Umzug", "Website"]);
    expect(titles(applyView(rows, view([{ eigenschaft: "tags", operator: "enthält", wert: "Web" }]), schema))).toEqual(["Website"]);
    expect(titles(applyView(rows, view([{ eigenschaft: "aufwand", operator: "größer als", wert: 4 }]), schema))).toEqual(["Steuer", "Umzug"]);
    expect(titles(applyView(rows, view([{ eigenschaft: "fällig", operator: "vor", wert: "2027-01-01" }]), schema))).toEqual(["Website"]);
    expect(titles(applyView(rows, view([{ eigenschaft: "fällig", operator: "ist leer" }]), schema))).toEqual(["Steuer"]);
    expect(titles(applyView(rows, view([{ eigenschaft: "erledigt", operator: "ist", wert: false }]), schema))).toEqual(["Umzug", "Website"]);
    expect(
      titles(
        applyView(
          rows,
          view([
            { eigenschaft: "aufwand", operator: "größer als", wert: 2 },
            { eigenschaft: "Name", operator: "enthält", wert: "u" },
          ]),
          schema,
        ),
      ),
    ).toEqual(["Steuer", "Umzug"]);
  });
});
