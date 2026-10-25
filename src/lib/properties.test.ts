// Frontmatter lesen und schreiben: unbekannte Felder bleiben erhalten, Datumsangaben im festen Format.
import { describe, expect, it } from "vitest";
import { formatValue, inferType, isDateValue, normalizeValue, readProperties, setProperty } from "./properties";

const PAGE = `---
id: 3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90
icon: 🚀
status: In Arbeit
fällig: 2026-11-15
termin: 2026-11-15T09:30
priorität: hoch
aliases: [Relaunch, Website]   # Obsidian-Feld, das die App nicht kennt
unbekannt:
  verschachtelt: ja
---
`;

describe("Eigenschaften lesen", () => {
  it("liest alle Felder, Datumswerte bleiben Text im Originalformat", () => {
    const props = readProperties(PAGE);
    expect(props.status).toBe("In Arbeit");
    expect(props["fällig"]).toBe("2026-11-15");
    expect(props.termin).toBe("2026-11-15T09:30");
    expect(props.aliases).toEqual(["Relaunch", "Website"]);
    expect(props.unbekannt).toEqual({ verschachtelt: "ja" });
  });

  it("ohne oder mit kaputtem Frontmatter gibt es keine Eigenschaften statt eines Absturzes", () => {
    expect(readProperties(null)).toEqual({});
    expect(readProperties("---\n---\n")).toEqual({});
    expect(readProperties("---\n: [kaputt\n---\n")).toEqual({});
  });

  it("erkennt Typen am Wert", () => {
    expect(inferType("fällig", "2026-11-15")).toBe("datum");
    expect(inferType("termin", "2026-11-15T09:30")).toBe("datum");
    expect(inferType("status", "In Arbeit")).toBe("status");
    expect(inferType("tags", ["a"])).toBe("mehrfachauswahl");
    expect(inferType("erledigt", true)).toBe("checkbox");
    expect(inferType("aufwand", 3)).toBe("zahl");
    expect(inferType("link", "https://tauri.app")).toBe("url");
    expect(inferType("priorität", "hoch")).toBe("text");
  });
});

describe("Eigenschaften schreiben", () => {
  it("ändert nur die betroffenen Zeilen, unbekannte Felder bleiben Zeichen für Zeichen erhalten", () => {
    const changed = setProperty(PAGE, "status", "Erledigt");
    expect(changed).toBe(PAGE.replace("status: In Arbeit", "status: Erledigt"));
    expect(changed).toContain("aliases: [Relaunch, Website]   # Obsidian-Feld, das die App nicht kennt\n");
    expect(changed).toContain("unbekannt:\n  verschachtelt: ja\n");
  });

  it("schreibt alle Typen in gültigem YAML und liest sie gleich zurück", () => {
    let fm: string | null = "---\nid: 1\n---\n";
    const values = {
      text: "Hallo: Welt",
      zahl: 42.5,
      auswahl: "hoch",
      tags: ["Arbeit", "Privat"],
      status: "In Arbeit",
      datum: "2026-11-15",
      zeitpunkt: "2026-11-15T14:30",
      erledigt: false,
      url: "https://example.com/a?b=c",
      nummer_als_text: "007",
    };
    for (const [key, value] of Object.entries(values)) fm = setProperty(fm, key, value);
    expect(fm).toContain("datum: 2026-11-15\n");
    expect(fm).toContain("zeitpunkt: 2026-11-15T14:30\n");
    expect(fm).toContain("tags:\n  - Arbeit\n  - Privat\n");
    expect(readProperties(fm)).toEqual({ id: 1, ...values });
  });

  it("ersetzt und entfernt mehrzeilige Felder vollständig", () => {
    const fm = "---\ntags:\n  - a\n  - b\nnach: x\n---\n";
    expect(setProperty(fm, "tags", ["c"])).toBe("---\ntags:\n  - c\nnach: x\n---\n");
    expect(setProperty(fm, "tags", null)).toBe("---\nnach: x\n---\n");
    // Listen ohne Einrückung (auch gültiges YAML) gehören ebenfalls zum Feld.
    expect(setProperty("---\ntags:\n- a\n- b\nnach: x\n---\n", "tags", null)).toBe("---\nnach: x\n---\n");
  });

  it("legt Frontmatter an, wenn eine Seite noch keins hat", () => {
    expect(setProperty(null, "status", "Geplant")).toBe("---\nstatus: Geplant\n---\n");
  });
});

describe("Eingaben und Datumsformat", () => {
  it("speichert Datumsangaben nur als YYYY-MM-DD oder YYYY-MM-DDTHH:MM", () => {
    expect(normalizeValue("datum", "2026-11-15")).toBe("2026-11-15");
    expect(normalizeValue("datum", "2026-11-15T14:30:59")).toBe("2026-11-15T14:30");
    expect(normalizeValue("datum", "15.11.2026")).toBeNull();
    expect(normalizeValue("datum", "2026-13-01")).toBeNull();
    expect(isDateValue("2026-02-30")).toBe(true); // Format stimmt; der Kalender prüft den Tag später
    expect(formatValue("datum", "2026-11-15")).toBe("15.11.2026");
    expect(formatValue("datum", "2026-11-15T14:30")).toBe("15.11.2026, 14:30");
  });

  it("wandelt Eingaben je Typ um, leere Eingaben entfernen das Feld", () => {
    expect(normalizeValue("zahl", "3,5")).toBe(3.5);
    expect(normalizeValue("zahl", "abc")).toBeNull();
    expect(normalizeValue("mehrfachauswahl", "a, b, a")).toEqual(["a", "b"]);
    expect(normalizeValue("mehrfachauswahl", [])).toBeNull();
    expect(normalizeValue("checkbox", false)).toBe(false);
    expect(normalizeValue("text", "  ")).toBeNull();
  });
});
