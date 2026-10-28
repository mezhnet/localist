import { describe, expect, it } from "vitest";
import { allePagesNachZeit, greeting, gueltigerName, kurzesDatum, pageIcons, recentPages, relativeTime, schnellNotiz } from "./home";

describe("Startseite nach der Vorlage (Etappe 19)", () => {
  it("Datum wie „Mo, 26.10.2026“", () => {
    expect(kurzesDatum(new Date(2026, 9, 26, 8))).toBe("Mo, 26.10.2026");
    expect(kurzesDatum(new Date(2027, 0, 3))).toBe("So, 03.01.2027");
  });

  it("„Alle Seiten“: alle Seiten nach Änderungszeit, auch Vorlagen", () => {
    const entries = [entry("A.md", 100), entry("Vorlagen/Projekt.md", 999), entry("C.md", 200)];
    expect(allePagesNachZeit(entries).map((e) => e.path)).toEqual(["Vorlagen/Projekt.md", "C.md", "A.md"]);
  });

  it("Schnell notieren: erste Zeile = Titel, Rest = Inhalt; ein leeres Feld ergibt nichts", () => {
    expect(schnellNotiz("Einkaufen\nMilch\nBrot\n")).toEqual({ titel: "Einkaufen", inhalt: "Milch\nBrot" });
    expect(schnellNotiz("\n\n  Idee: Wochenplan?  \r\n\r\n- Montag\r\n- Dienstag  \n\n")).toEqual({ titel: "Idee Wochenplan", inhalt: "- Montag\n- Dienstag" });
    expect(schnellNotiz("Nur ein Titel")).toEqual({ titel: "Nur ein Titel", inhalt: "" });
    expect(schnellNotiz("")).toBeNull();
    expect(schnellNotiz("   \n \n")).toBeNull();
  });

  it("gültige Dateinamen: keine verbotenen Zeichen, kein Punkt am Anfang oder Ende, keine reservierten Namen", () => {
    expect(gueltigerName('a<b>c:d"e/f\\g|h?i*j')).toBe("a b c d e f g h i j");
    expect(gueltigerName("# Überschrift [[Link]] ^block")).toBe("Überschrift Link block");
    expect(gueltigerName("...versteckt")).toBe("versteckt");
    expect(gueltigerName("Ende. . ")).toBe("Ende");
    expect(gueltigerName("CON")).toBe("CON (Notiz)");
    expect(gueltigerName("lpt1")).toBe("lpt1 (Notiz)");
    expect(gueltigerName("?*:")).toBe("Unbenannt");
    expect(gueltigerName("x".repeat(150))).toHaveLength(100);
    expect(gueltigerName("Tab\tund\u0007Glocke")).toBe("Tab und Glocke");
    expect(gueltigerName("Größe & Maße – 2026")).toBe("Größe & Maße – 2026");
  });
});

const entry = (path: string, modified: number, content = "") => ({ path, title: path.replace(/^.*\//, "").replace(/\.md$/, ""), content, modified });

describe("Startseite", () => {
  it("zeigt die zuletzt bearbeiteten Seiten zuerst, ohne Vorlagen", () => {
    const entries = [entry("A.md", 100), entry("Notizen/B.md", 300), entry("Vorlagen/Projekt.md", 999), entry("C.md", 200)];
    expect(recentPages(entries).map((e) => e.path)).toEqual(["Notizen/B.md", "C.md", "A.md"]);
    expect(recentPages(entries, 2).map((e) => e.path)).toEqual(["Notizen/B.md", "C.md"]);
  });

  it("liest Icons aus dem Frontmatter", () => {
    const icons = pageIcons([entry("A.md", 1, "---\nid: 1\nicon: 💡\n---\nText"), entry("B.md", 1, "# Ohne Icon"), entry("C.md", 1, "﻿---\nicon: 🚀\n---\n")]);
    expect([...icons]).toEqual([
      ["A.md", "💡"],
      ["C.md", "🚀"],
    ]);
  });

  it("begrüßt passend zur Tageszeit", () => {
    expect(greeting(new Date(2026, 9, 25, 7))).toBe("Guten Morgen");
    expect(greeting(new Date(2026, 9, 25, 14))).toBe("Guten Tag");
    expect(greeting(new Date(2026, 9, 25, 20))).toBe("Guten Abend");
    expect(greeting(new Date(2026, 9, 25, 2))).toBe("Gute Nacht");
  });

  it("nennt Zeitabstände in Worten", () => {
    const now = new Date(2026, 9, 25, 15, 0).getTime();
    expect(relativeTime(now - 20_000, now)).toBe("gerade eben");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("vor 5 Min.");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("vor 3 Std.");
    expect(relativeTime(new Date(2026, 9, 24, 23, 0).getTime(), now)).toBe("gestern");
    expect(relativeTime(new Date(2026, 9, 21, 9, 0).getTime(), now)).toBe("vor 4 Tagen");
    expect(relativeTime(new Date(2026, 8, 1, 9, 0).getTime(), now)).toBe("01.09.2026");
  });
});
