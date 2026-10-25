import { describe, expect, it } from "vitest";
import { greeting, pageIcons, recentPages, relativeTime } from "./home";

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
