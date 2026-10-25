import { describe, expect, it } from "vitest";
import { getFrontmatterField, joinFrontmatter, setFrontmatterField, splitFrontmatter } from "./frontmatter";

describe("Einzelne Felder (icon, cover)", () => {
  const fm = "---\nid: 3f2a\nicon: 🚀\ncover: \"Anhänge/mein bild.png\" # Kommentar\ntags:\n  - a\n  - b\n---\n";

  it("liest Felder mit und ohne Anführungszeichen", () => {
    expect(getFrontmatterField(fm, "icon")).toBe("🚀");
    expect(getFrontmatterField(fm, "cover")).toBe("Anhänge/mein bild.png");
    expect(getFrontmatterField(fm, "fehlt")).toBeNull();
    expect(getFrontmatterField(null, "icon")).toBeNull();
  });

  it("ändert nur die betroffene Zeile", () => {
    expect(setFrontmatterField(fm, "icon", "📦")).toBe(fm.replace("icon: 🚀", "icon: 📦"));
    expect(setFrontmatterField(fm, "icon", null)).toBe(fm.replace("icon: 🚀\n", ""));
    expect(setFrontmatterField(fm, "tags", null)).toBe(fm.replace("tags:\n  - a\n  - b\n", ""));
  });

  it("ergänzt fehlende Felder am Ende und legt Frontmatter bei Bedarf an", () => {
    expect(setFrontmatterField("---\nid: 1\n---\n", "cover", "Anhänge/skizze.png")).toBe("---\nid: 1\ncover: Anhänge/skizze.png\n---\n");
    expect(setFrontmatterField(null, "icon", "💡")).toBe("---\nicon: 💡\n---\n");
    expect(setFrontmatterField("---\r\nid: 1\r\n---\r\n", "icon", "💡")).toBe("---\r\nid: 1\r\nicon: 💡\r\n---\r\n");
  });

  it("setzt Anführungszeichen, wo YAML sie braucht", () => {
    expect(setFrontmatterField(null, "cover", "a: b.png")).toBe('---\ncover: "a: b.png"\n---\n');
    expect(setFrontmatterField(null, "icon", "#")).toBe('---\nicon: "#"\n---\n');
    expect(getFrontmatterField(setFrontmatterField(null, "cover", "a: b.png"), "cover")).toBe("a: b.png");
  });
});

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
