// Roundtrip: Markdown → Editor-Format (echter BlockNote-Editor) → Markdown muss denselben Text liefern.
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { schema, type VaultBlock } from "../editor/schema";
import { blocksToMarkdown, markdownToBlocks } from "./blocks";
import { splitFrontmatter } from "./frontmatter";

function createEditor() {
  return BlockNoteEditor.create({ schema });
}

/** Lädt Markdown in einen Editor und liest das Ergebnis wieder als Markdown aus. */
function viaEditor(markdown: string): { markdown: string; blocks: VaultBlock[] } {
  const editor = createEditor();
  const blocks = markdownToBlocks(markdown);
  editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : [{ type: "paragraph" }]);
  return { markdown: blocksToMarkdown(editor.document), blocks: editor.document };
}

function expectRoundtrip(markdown: string): VaultBlock[] {
  const result = viaEditor(markdown);
  expect(result.markdown).toBe(markdown);
  return result.blocks;
}

describe("Roundtrip Markdown → Editor → Markdown", () => {
  it("Überschriften aller Ebenen", () => {
    const blocks = expectRoundtrip("# Eins\n\n## Zwei\n\n### Drei\n\n#### Vier\n\n##### Fünf\n\n###### Sechs\n");
    expect(blocks.map((b) => b.type)).toEqual(Array(6).fill("heading"));
    expect(blocks.map((b) => (b.props as { level: number }).level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("Absätze, auch mit Zeilenumbruch und Umlauten", () => {
    const blocks = expectRoundtrip("Erster Absatz.\n\nZweiter Absatz\nmit Zeilenumbruch: äöü ß.\n");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  });

  it("fett und kursiv, auch kombiniert und verschachtelt", () => {
    const blocks = expectRoundtrip("Text mit **fett**, *kursiv* und ***beidem***.\n\n**fett mit *kursiv* darin**\n");
    expect(blocks[0].content).toEqual([
      { type: "text", text: "Text mit ", styles: {} },
      { type: "text", text: "fett", styles: { bold: true } },
      { type: "text", text: ", ", styles: {} },
      { type: "text", text: "kursiv", styles: { italic: true } },
      { type: "text", text: " und ", styles: {} },
      { type: "text", text: "beidem", styles: { bold: true, italic: true } },
      { type: "text", text: ".", styles: {} },
    ]);
  });

  it("weitere Formatierungen: durchgestrichen, Code im Text, unterstrichen", () => {
    expectRoundtrip("~~durch~~ und `code` und <u>unter</u> sowie ``a ` b``\n");
  });

  it("Aufzählungen mit Einrückung", () => {
    const blocks = expectRoundtrip("- eins\n- zwei\n  - zwei a\n  - zwei b\n- drei\n");
    expect(blocks.map((b) => b.type)).toEqual(["bulletListItem", "bulletListItem", "bulletListItem"]);
    expect(blocks[1].children.map((b) => b.type)).toEqual(["bulletListItem", "bulletListItem"]);
  });

  it("nummerierte Listen, auch mit anderem Startwert und gemischt eingerückt", () => {
    expectRoundtrip("1. eins\n2. zwei\n3. drei\n");
    expectRoundtrip("3. drei\n4. vier\n");
    expectRoundtrip("1. Schritt\n   - Detail\n   - noch ein Detail\n2. Schritt\n");
  });

  it("Listen mit Absätzen und Code-Blöcken im Eintrag", () => {
    expectRoundtrip("- Punkt\n\n  Zweiter Absatz im Punkt\n- Nächster Punkt\n");
    expectRoundtrip("- Punkt mit Code\n  ```js\n  let x = 1;\n  ```\n");
  });

  it("Checklisten", () => {
    const blocks = expectRoundtrip("- [ ] offen\n- [x] erledigt\n  - [ ] Unteraufgabe\n");
    expect(blocks.map((b) => b.type)).toEqual(["checkListItem", "checkListItem"]);
    expect(blocks.map((b) => (b.props as { checked: boolean }).checked)).toEqual([false, true]);
    expect(blocks[1].children[0].type).toBe("checkListItem");
  });

  it("Checkliste und Aufzählung in einer Liste", () => {
    expectRoundtrip("- [ ] Aufgabe\n- normaler Punkt\n- [x] fertig\n");
  });

  it("Zitate, auch über mehrere Zeilen und mit Liste darin", () => {
    const blocks = expectRoundtrip("> Ein Zitat\n> über zwei Zeilen.\n");
    expect(blocks[0].type).toBe("quote");
    expectRoundtrip("> Zitat\n>\n> - mit Liste\n> - darin\n");
  });

  it("Code-Blöcke mit und ohne Sprache", () => {
    const blocks = expectRoundtrip("```ts\nconst antwort = 42;\nconsole.log(antwort);\n```\n");
    expect(blocks[0].type).toBe("codeBlock");
    expect((blocks[0].props as { language: string }).language).toBe("ts");
    expectRoundtrip("```\nohne Sprache\n```\n");
    expectRoundtrip("````md\n```\nverschachtelt\n```\n````\n");
    expectRoundtrip("```\n```\n");
  });

  it("Links, auch formatiert und als nackte Adresse", () => {
    const blocks = expectRoundtrip("Ein [Link](https://tauri.app) und https://example.com.\n");
    expect(blocks[0].content).toContainEqual({
      type: "link",
      href: "https://tauri.app",
      content: [{ type: "text", text: "Link", styles: {} }],
    });
    expectRoundtrip("[**fetter** Link](https://example.com/pfad?x=1)\n");
    expectRoundtrip("[Lokale Datei](<Notizen/Meine Ideen.md>)\n");
  });

  it("Bilder", () => {
    const blocks = expectRoundtrip("![Skizze](Anhänge/skizze.png)\n");
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].props).toMatchObject({ url: "Anhänge/skizze.png", caption: "Skizze" });
    expectRoundtrip("![](bild.png)\n");
    expectRoundtrip("![Mit Leerzeichen](<Anhänge/mein bild.png>)\n");
  });

  it("Trennlinie und mehrere Leerzeilen zwischen Blöcken", () => {
    expectRoundtrip("Text\n\n---\n\nmehr Text\n");
    expectRoundtrip("oben\n\n\n\nunten\n");
  });

  it("Obsidian-Schreibweisen bleiben unverändert", () => {
    expectRoundtrip("Siehe [[Ideen]] und [[Projekte/Umzug|Umzug]].\n");
    expectRoundtrip("> [!info] Hinweis\n> Der Vertrag läuft aus.\n");
    expectRoundtrip("snake_case_name und 2 * 3 = 6 und #tag\n");
  });

  it("Unbekanntes Markdown (z. B. Tabellen, HTML) bleibt wörtlich erhalten", () => {
    const table = "| Spalte | Wert |\n| ------ | ---- |\n| a      | 1    |\n";
    const blocks = expectRoundtrip(`Vorher\n\n${table}\nNachher\n`);
    expect(blocks[1].type).toBe("rawMarkdown");
    expectRoundtrip("<div>\nHTML-Block\n</div>\n");
    expectRoundtrip("Fußnote[^1] im Text.\n\n[^1]: Die Fußnote.\n");
  });

  it("alle Dateien im Beispiel-Vault bleiben Zeichen für Zeichen gleich", () => {
    const files = import.meta.glob("../../beispiel-vault/**/*.md", { query: "?raw", import: "default", eager: true });
    const entries = Object.entries(files as Record<string, string>);
    expect(entries.length).toBeGreaterThanOrEqual(5);
    for (const [, text] of entries) {
      expectRoundtrip(splitFrontmatter(text).body);
    }
  });
});

describe("Maskierung beim Speichern", () => {
  function save(content: string, type: "paragraph" | "heading" | "bulletListItem" = "paragraph"): string {
    return blocksToMarkdown([{ type, content } as never]);
  }

  it("maskiert nur, wenn Text sonst als Formatierung gelesen würde", () => {
    expect(save("*kein kursiv*")).toBe("\\*kein kursiv\\*\n");
    expect(save("# keine Überschrift")).toBe("\\# keine Überschrift\n");
    expect(save("1. keine Liste")).toBe("1\\. keine Liste\n");
    expect(save("normaler Text mit [[Link]]")).toBe("normaler Text mit [[Link]]\n");
  });

  it("maskierter Text liest sich wieder als derselbe Text", () => {
    for (const text of ["*kein kursiv*", "# keine Überschrift", "- kein Punkt", "a <b>kein html</b>", "`kein code`", "[x](y)"]) {
      const markdown = save(text);
      const [block] = markdownToBlocks(markdown);
      expect(block.content).toEqual([{ type: "text", text, styles: {} }]);
    }
  });

  it("Leerzeichen am Rand einer Formatierung stehen außerhalb der Markierung", () => {
    const markdown = blocksToMarkdown([
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Ein ", styles: {} },
          { type: "text", text: "fettes ", styles: { bold: true } },
          { type: "text", text: "Wort", styles: {} },
        ],
      },
    ]);
    expect(markdown).toBe("Ein **fettes** Wort\n");
  });

  it("andere Schreibweisen werden in die Standardform gebracht, der Inhalt bleibt gleich", () => {
    expect(viaEditor("* eins\n* zwei\n").markdown).toBe("- eins\n- zwei\n");
    expect(viaEditor("__fett__ und _kursiv_\n").markdown).toBe("**fett** und *kursiv*\n");
    expect(viaEditor("Titel\n=====\n").markdown).toBe("# Titel\n");
    expect(viaEditor("~~~\ncode\n~~~\n").markdown).toBe("```\ncode\n```\n");
  });

  it("leere Seite ergibt leeren Text", () => {
    expect(blocksToMarkdown([])).toBe("");
    expect(viaEditor("").markdown).toBe("");
  });
});
