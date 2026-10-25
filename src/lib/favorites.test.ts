import { describe, expect, it } from "vitest";
import { readFavorites, removeFromFavorites, renameInFavorites, toggleFavorite, withFavorites } from "./favorites";

describe("Favoriten", () => {
  it("liest die Liste aus den Einstellungen und überspringt Ungültiges", () => {
    expect(readFavorites({})).toEqual([]);
    expect(readFavorites({ favoriten: "Ideen.md" })).toEqual([]);
    expect(readFavorites({ favoriten: ["Notizen/Ideen.md", 3, "", "Notizen/Ideen.md", "Projekte"] })).toEqual(["Notizen/Ideen.md", "Projekte"]);
  });

  it("schreibt die Liste zurück, andere Einstellungen bleiben erhalten", () => {
    expect(withFavorites({ version: 1, eigenschaften: { fällig: "datum" } }, ["A.md"])).toEqual({
      version: 1,
      eigenschaften: { fällig: "datum" },
      favoriten: ["A.md"],
    });
  });

  it("heftet an (ans Ende) und löst wieder", () => {
    const list = toggleFavorite(["A.md"], "Notizen/B.md");
    expect(list).toEqual(["A.md", "Notizen/B.md"]);
    expect(toggleFavorite(list, "A.md")).toEqual(["Notizen/B.md"]);
  });

  it("zieht Pfade nach dem Umbenennen von Seiten und Ordnern nach", () => {
    const list = ["Notizen/Ideen.md", "Notizen/Unterordner/Plan.md", "Notizen-Archiv/Alt.md", "Projekte"];
    expect(renameInFavorites(list, "Notizen/Ideen.md", "Notizen/Gedanken.md")).toEqual([
      "Notizen/Gedanken.md",
      "Notizen/Unterordner/Plan.md",
      "Notizen-Archiv/Alt.md",
      "Projekte",
    ]);
    expect(renameInFavorites(list, "Notizen", "Texte")).toEqual(["Texte/Ideen.md", "Texte/Unterordner/Plan.md", "Notizen-Archiv/Alt.md", "Projekte"]);
  });

  it("entfernt gelöschte Seiten und alles aus gelöschten Ordnern", () => {
    const list = ["Notizen/Ideen.md", "Notizen/Unterordner/Plan.md", "Notizen-Archiv/Alt.md"];
    expect(removeFromFavorites(list, "Notizen")).toEqual(["Notizen-Archiv/Alt.md"]);
    expect(removeFromFavorites(list, "Notizen/Ideen.md")).toEqual(["Notizen/Unterordner/Plan.md", "Notizen-Archiv/Alt.md"]);
  });
});
