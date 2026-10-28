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

  it("Callouts im Obsidian-Format", () => {
    const blocks = expectRoundtrip("> [!info] Hinweis\n> Der Hosting-Vertrag läuft Ende November aus.\n");
    expect(blocks[0].type).toBe("callout");
    expect(blocks[0].props).toEqual({ calloutType: "info", fold: "" });
    expect(blocks[0].content).toEqual([{ type: "text", text: "Hinweis", styles: {} }]);
    expect(blocks[0].children.map((b) => b.type)).toEqual(["paragraph"]);

    expectRoundtrip("> [!warning] **Achtung** mit [[Ideen]]\n> Zeile eins\n> Zeile zwei\n>\n> - Punkt\n> - [ ] Aufgabe\n");
    expectRoundtrip("> [!tip]\n> Ohne Titel\n");
    expectRoundtrip("> [!note] Nur ein Titel\n");
    expectRoundtrip("> [!example] Mit Code\n> ```js\n> let x = 1;\n> ```\n");
    expectRoundtrip("> [!quote] Außen\n> Text\n>\n> > [!info] Innen\n> > Verschachtelt\n");
  });

  it("Toggles: einklappbare Callouts mit - (zu) oder + (offen)", () => {
    const blocks = expectRoundtrip("> [!note]- Mehr anzeigen\n> Versteckter Inhalt\n");
    expect(blocks[0].type).toBe("callout");
    expect(blocks[0].props).toEqual({ calloutType: "note", fold: "-" });
    const open = expectRoundtrip("> [!faq]+ Häufige Frage\n> Antwort\n>\n> 1. Schritt\n");
    expect(open[0].props).toEqual({ calloutType: "faq", fold: "+" });
    expectRoundtrip("> [!note]- Leer\n");
  });

  it("Seitenlinks [[…]] werden zu Links im Editor", () => {
    const blocks = expectRoundtrip("Siehe [[Ideen]], [[Projekte/Umzug|den Umzug]] und [[Website-Relaunch#Hinweis]].\n");
    expect(blocks[0].content).toEqual([
      { type: "text", text: "Siehe ", styles: {} },
      { type: "wikilink", props: { target: "Ideen", alias: "" } },
      { type: "text", text: ", ", styles: {} },
      { type: "wikilink", props: { target: "Projekte/Umzug", alias: "den Umzug" } },
      { type: "text", text: " und ", styles: {} },
      { type: "wikilink", props: { target: "Website-Relaunch#Hinweis", alias: "" } },
      { type: "text", text: ".", styles: {} },
    ]);
    // Einbettungen, Code und formatierte Links bleiben Text.
    const other = expectRoundtrip("Bild ![[skizze.png]] und `[[kein Link]]` und **[[fett]]**\n");
    expect(JSON.stringify(other[0].content)).not.toContain('"wikilink"');
    expectRoundtrip("- [ ] Aufgabe für [[Ideen]]\n\n# Überschrift mit [[Link]]\n");
  });

  it("getippter Text [[Seite]] wird beim Speichern zum Link", () => {
    const markdown = blocksToMarkdown([{ type: "paragraph", content: "Neu: [[Ideen]]" } as never]);
    expect(markdown).toBe("Neu: [[Ideen]]\n");
    expect(markdownToBlocks(markdown)[0].content).toContainEqual({ type: "wikilink", props: { target: "Ideen", alias: "" } });
  });

  it("Unbekanntes Markdown (z. B. HTML, Fußnoten) bleibt wörtlich erhalten", () => {
    // Seit Etappe 19 sind Tabellen ein Editor-Block; eine unveränderte Tabelle bleibt trotzdem Zeichen für Zeichen gleich.
    const table = "| Spalte | Wert |\n| ------ | ---- |\n| a      | 1    |\n";
    const blocks = expectRoundtrip(`Vorher\n\n${table}\nNachher\n`);
    expect(blocks[1].type).toBe("table");
    expect(expectRoundtrip("<div>\nHTML-Block\n</div>\n")[0].type).toBe("rawMarkdown");
    expectRoundtrip("Fußnote[^1] im Text.\n\n[^1]: Die Fußnote.\n");
  });

  it("alle Dateien im Beispiel-Vault bleiben Zeichen für Zeichen gleich", () => {
    const files = import.meta.glob("../../beispiel-vault/**/*.md", { query: "?raw", import: "default", eager: true });
    const entries = Object.entries(files as Record<string, string>);
    expect(entries.length).toBeGreaterThanOrEqual(5);
    for (const [, text] of entries) {
      // Git kann die Dateien beim Auschecken mit "\r\n" anlegen; das Seiten-Modell behält das bei (page.test.ts).
      expectRoundtrip(splitFrontmatter(text.replace(/\r\n/g, "\n")).body);
    }
  });

  // Was Tab einrücken darf (src/editor/einruecken.ts), muss nach Speichern und Neuladen genauso eingerückt sein.
  it.each([
    ["Listenpunkte über drei Ebenen", "- a\n  - b\n    - c\n"],
    ["nummerierte Liste unter nummerierter Liste", "1. a\n   1. b\n2. c\n"],
    ["Checkliste unter Checkliste", "- [ ] a\n  - [x] b\n- [ ] c\n"],
    ["nummerierte Liste unter Checkliste", "- [ ] a\n  1. b\n"],
    ["Checkliste unter nummerierter Liste", "1. a\n   - [ ] b\n"],
    ["Absatz unter Checklistenpunkt", "- [ ] a\n\n  Absatz\n"],
    ["Absatz unter nummeriertem Punkt, danach der nächste Punkt", "1. a\n\n   Absatz\n2. b\n"],
    ["Absatz unter einem eingerückten Punkt", "- a\n  - b\n\n    Absatz\n"],
    ["eingerückte Liste in einem Callout", "> [!info] Titel\n> - a\n>   - b\n"],
  ])("Einrückung bleibt erhalten: %s", (_name, markdown) => {
    expectRoundtrip(markdown);
  });

  it("Kinder eines Absatzes speichert Markdown nicht eingerückt (deshalb rückt Tab keinen Block unter einen Absatz)", () => {
    const blocks: VaultBlock[] = [
      { id: "a", type: "paragraph", props: {}, content: [{ type: "text", text: "Absatz", styles: {} }], children: [
        { id: "b", type: "paragraph", props: {}, content: [{ type: "text", text: "Kind", styles: {} }], children: [] },
      ] } as unknown as VaultBlock,
    ];
    expect(blocksToMarkdown(blocks)).toBe("Absatz\n\nKind\n");
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

  describe("Tabellen (Etappe 19)", () => {
    /** Zellen einer Tabelle im Editor als Text (Zeile für Zeile). */
    const zellen = (block: VaultBlock) =>
      (block.content as { rows: { cells: { content: { text?: string }[] }[] }[] }).rows.map((row) => row.cells.map((cell) => cell.content.map((c) => c.text ?? "").join("")));
    const ausrichtung = (block: VaultBlock) =>
      (block.content as { rows: { cells: { props: { textAlignment: string } }[] }[] }).rows[0].cells.map((cell) => cell.props.textAlignment);

    /** Lädt Markdown, ändert eine Zelle im Editor und liest das Ergebnis als Markdown (die einheitliche Form). */
    function bearbeitet(markdown: string, zeile: number, spalte: number, text: string): string {
      const editor = createEditor();
      editor.replaceBlocks(editor.document, markdownToBlocks(markdown));
      const tabelle = editor.document.find((block) => block.type === "table")!;
      const content = structuredClone(tabelle.content) as { rows: { cells: { content: unknown[] }[] }[] };
      content.rows[zeile].cells[spalte].content = [{ type: "text", text, styles: {} }];
      editor.updateBlock(tabelle, { content } as never);
      return blocksToMarkdown(editor.document);
    }

    it("erscheint im Editor als Tabelle und bleibt unverändert Zeichen für Zeichen gleich", () => {
      const [block] = expectRoundtrip("| Level | Prinzip |\n| --- | --- |\n| RAID 0 | Striping |\n| RAID 1 | Spiegelung |\n");
      expect(block.type).toBe("table");
      expect(zellen(block)).toEqual([
        ["Level", "Prinzip"],
        ["RAID 0", "Striping"],
        ["RAID 1", "Spiegelung"],
      ]);
      // Ausgerichtete Spalten wie aus Obsidian bleiben so, solange niemand die Tabelle ändert.
      expectRoundtrip("| Name  | Wert |\n|-------|-----:|\n| Alpha |    1 |\n");
    });

    it("Ausrichtung: links, mittig, rechts; nach einer Änderung in der einheitlichen Form", () => {
      const markdown = "| L | M | R | ohne |\n| :--- | :---: | ---: | --- |\n| a | b | c | d |\n";
      const [block] = expectRoundtrip(markdown);
      expect(ausrichtung(block)).toEqual(["left", "center", "right", "left"]);
      expect(bearbeitet(markdown, 1, 0, "neu")).toBe("| L | M | R | ohne |\n| --- | :---: | ---: | --- |\n| neu | b | c | d |\n");
    });

    it("Formatierung in Zellen: fett, kursiv, Code, Link und [[Link]]", () => {
      const markdown = "| Art | Beispiel |\n| --- | --- |\n| fett | **RAID 10** |\n| kursiv | *n − 1* |\n| Code | `mdadm` |\n| Link | [Doku](https://example.com) |\n| Seite | [[Ideen]] |\n";
      const [block] = expectRoundtrip(markdown);
      expect(block.type).toBe("table");
      const zeilen = (block.content as { rows: { cells: { content: { type: string; styles?: Record<string, boolean> }[] }[] }[] }).rows;
      expect(zeilen[1].cells[1].content[0].styles).toEqual({ bold: true });
      expect(zeilen[2].cells[1].content[0].styles).toEqual({ italic: true });
      expect(zeilen[3].cells[1].content[0].styles).toEqual({ code: true });
      expect(zeilen[4].cells[1].content[0].type).toBe("link");
      expect(zeilen[5].cells[1].content[0].type).toBe("wikilink");
      expect(bearbeitet(markdown, 1, 0, "Fett")).toBe(markdown.replace("| fett |", "| Fett |"));
    });

    it("`\\|` in Zellen (auch in Code und in [[Link\\|Text]]) bleibt erhalten", () => {
      const markdown = "| Ausdruck | Bedeutung |\n| --- | --- |\n| a \\| b | oder |\n| `x \\| y` | Code |\n| [[Ideen\\|Gedanken]] | Link mit Text |\n";
      const [block] = expectRoundtrip(markdown);
      expect(block.type).toBe("table");
      expect(zellen(block)[1][0]).toBe("a | b");
      expect(zellen(block)[2][0]).toBe("x | y");
      // Nach einer Änderung: wieder mit \| geschrieben
      expect(bearbeitet(markdown, 1, 1, "oder auch")).toBe(markdown.replace("| oder |", "| oder auch |"));
      expect(bearbeitet(markdown, 1, 1, "a|b")).toContain("| a \\| b | a\\|b |\n");
    });

    it("leere Zellen, Umlaute und eine neue Zeile", () => {
      const markdown = "| Größe | Übermaß | Äußerung |\n| --- | --- | --- |\n|  | ß |  |\n| Öl |  | ü |\n";
      const [block] = expectRoundtrip(markdown);
      expect(zellen(block)).toEqual([
        ["Größe", "Übermaß", "Äußerung"],
        ["", "ß", ""],
        ["Öl", "", "ü"],
      ]);
      expect(bearbeitet(markdown, 2, 1, "Maß")).toBe("| Größe | Übermaß | Äußerung |\n| --- | --- | --- |\n|  | ß |  |\n| Öl | Maß | ü |\n");
    });

    it("Zeilen und Spalten hinzufügen und entfernen: gespeichert als normale Markdown-Tabelle", () => {
      const editor = createEditor();
      editor.replaceBlocks(editor.document, markdownToBlocks("| A | B |\n| --- | --- |\n| 1 | 2 |\n"));
      const tabelle = () => editor.document[0];
      const zelle = (text: string) => ({ type: "tableCell", props: { textAlignment: "left" }, content: text ? [{ type: "text", text, styles: {} }] : [] });
      // Zeile und Spalte hinzufügen
      editor.updateBlock(tabelle(), {
        content: { type: "tableContent", rows: [{ cells: [zelle("A"), zelle("B"), zelle("C")] }, { cells: [zelle("1"), zelle("2"), zelle("")] }, { cells: [zelle("3"), zelle(""), zelle("x")] }] },
      } as never);
      expect(blocksToMarkdown(editor.document)).toBe("| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |  |\n| 3 |  | x |\n");
      // Spalte B und die erste Datenzeile entfernen
      editor.updateBlock(tabelle(), {
        content: { type: "tableContent", rows: [{ cells: [zelle("A"), zelle("C")] }, { cells: [zelle("3"), zelle("x")] }] },
      } as never);
      expect(blocksToMarkdown(editor.document)).toBe("| A | C |\n| --- | --- |\n| 3 | x |\n");
      expect(markdownToBlocks(blocksToMarkdown(editor.document))[0].type).toBe("table");
    });

    it("Tabelle direkt nach Text (ohne Leerzeile) bleibt direkt darunter", () => {
      const markdown = "RAID-Level im Vergleich:\n| Level | Platten |\n| --- | --- |\n| RAID 5 | 3 |\n\nDanach.\n";
      const blocks = expectRoundtrip(markdown);
      expect(blocks.map((block) => block.type)).toEqual(["paragraph", "table", "paragraph"]);
    });

    it("was der Editor nicht verlustfrei abbilden kann, bleibt unveränderter Markdown-Text", () => {
      // ungleich viele Zellen, eine Tabelle in einer Liste, HTML mit Zeilenumbruch in einer Zelle bleibt bearbeitbar
      expect(expectRoundtrip("| a | b |\n| --- | --- |\n| 1 |\n")[0].type).toBe("rawMarkdown");
      expect(expectRoundtrip("| a | b |\n| --- | --- |\n| 1 | 2 | 3 |\n")[0].type).toBe("rawMarkdown");
      expect(expectRoundtrip("- Liste\n\n  | a | b |\n  | --- | --- |\n  | 1 | 2 |\n")[0].type).toBe("rawMarkdown");
      expect(expectRoundtrip("| a | b |\n| --- | --- |\n| Zeile<br>zwei | 2 |\n")[0].type).toBe("table");
    });
  });

  it("leere Seite ergibt leeren Text", () => {
    expect(blocksToMarkdown([])).toBe("");
    expect(viaEditor("").markdown).toBe("");
  });
});
