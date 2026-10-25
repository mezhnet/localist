import { describe, expect, it } from "vitest";
import { joinFrontmatter, splitFrontmatter } from "./frontmatter";

describe("splitFrontmatter / joinFrontmatter", () => {
  it("trennt Frontmatter inklusive Begrenzer vom Inhalt", () => {
    const text = "---\nid: 1\nstatus: In Arbeit\n---\n# Titel\n";
    expect(splitFrontmatter(text)).toEqual({ frontmatter: "---\nid: 1\nstatus: In Arbeit\n---\n", body: "# Titel\n" });
  });

  it("ohne Frontmatter bleibt alles Inhalt", () => {
    expect(splitFrontmatter("# Titel\n")).toEqual({ frontmatter: null, body: "# Titel\n" });
    expect(splitFrontmatter("")).toEqual({ frontmatter: null, body: "" });
  });

  it("ohne schließendes --- ist es kein Frontmatter (sondern z. B. eine Trennlinie)", () => {
    const text = "---\nkein Frontmatter\n";
    expect(splitFrontmatter(text)).toEqual({ frontmatter: null, body: text });
  });

  it("erkennt leeres Frontmatter, Windows-Zeilenenden und das Ende mit ...", () => {
    expect(splitFrontmatter("---\n---\nText")).toEqual({ frontmatter: "---\n---\n", body: "Text" });
    expect(splitFrontmatter("---\r\nid: 1\r\n---\r\nText\r\n")).toEqual({
      frontmatter: "---\r\nid: 1\r\n---\r\n",
      body: "Text\r\n",
    });
    expect(splitFrontmatter("---\nid: 1\n...\nText")).toEqual({ frontmatter: "---\nid: 1\n...\n", body: "Text" });
  });

  it("Frontmatter am Dateiende ohne Zeilenumbruch", () => {
    expect(splitFrontmatter("---\nid: 1\n---")).toEqual({ frontmatter: "---\nid: 1\n---", body: "" });
    expect(joinFrontmatter("---\nid: 1\n---", "Text\n")).toBe("---\nid: 1\n---\nText\n");
  });

  it("joinFrontmatter ist die Umkehrung von splitFrontmatter", () => {
    for (const text of ["---\na: 1\n---\nInhalt\n", "Nur Inhalt\n", "---\n# Kommentar\nb: [x, y]\n---\n\n\nText"]) {
      const { frontmatter, body } = splitFrontmatter(text);
      expect(joinFrontmatter(frontmatter, body)).toBe(text);
    }
  });
});
