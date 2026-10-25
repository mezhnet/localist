// Frontmatter muss beim Bearbeiten im Editor Zeichen für Zeichen erhalten bleiben.
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";
import { schema, type VaultEditor } from "../editor/schema";
import { parsePage, serializePage } from "./page";

const WEBSITE_RELAUNCH = `---
id: 3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90
icon: 🚀
status: In Arbeit
fällig: 2026-11-15
priorität: hoch
---
- [ ] Domain prüfen
- [ ] Texte für die Startseite schreiben

> [!info] Hinweis
> Der Hosting-Vertrag läuft Ende November aus.

Siehe auch [[Ideen]].
`;

/** Öffnet die Seite in einem echten Editor, wendet `edit` an und speichert wieder. */
function editPage(text: string, edit: (editor: VaultEditor) => void): string {
  const page = parsePage(text);
  const editor: VaultEditor = BlockNoteEditor.create({ schema });
  editor.replaceBlocks(editor.document, page.blocks.length > 0 ? page.blocks : [{ type: "paragraph" }]);
  edit(editor);
  return serializePage(page.format, editor.document);
}

function frontmatterOf(text: string): string {
  return text.slice(0, text.indexOf("\n---\n") + 5);
}

describe("Frontmatter beim Bearbeiten im Editor", () => {
  it("bleibt unverändert, wenn ein Haken gesetzt und ein Absatz ergänzt wird", () => {
    const saved = editPage(WEBSITE_RELAUNCH, (editor) => {
      const [first] = editor.document;
      editor.updateBlock(first, { props: { checked: true } } as never);
      editor.insertBlocks([{ type: "paragraph", content: "Neuer Absatz" }], editor.document[editor.document.length - 1], "after");
    });

    expect(frontmatterOf(saved)).toBe(frontmatterOf(WEBSITE_RELAUNCH));
    expect(saved).toContain("- [x] Domain prüfen\n");
    expect(saved.endsWith("Siehe auch [[Ideen]].\n\nNeuer Absatz\n")).toBe(true);
  });

  it("bleibt unverändert, wenn der gesamte Inhalt gelöscht wird", () => {
    const saved = editPage(WEBSITE_RELAUNCH, (editor) => {
      editor.replaceBlocks(editor.document, [{ type: "paragraph" }]);
    });
    expect(saved).toBe(frontmatterOf(WEBSITE_RELAUNCH));
  });

  it("unbekannte Felder, Kommentare und eigenwillige Formatierung bleiben Zeichen für Zeichen erhalten", () => {
    const frontmatter = [
      "---",
      "id:   abc   # Kommentar mit Leerzeichen",
      "tags: [arbeit,  privat]",
      "verschachtelt:",
      "    tief: 'ja'",
      "",
      "leer:",
      "datum: 2026-10-25T14:30",
      "---",
      "",
    ].join("\n");
    const text = `${frontmatter}\n# Titel\n\nText\n`;
    const saved = editPage(text, (editor) => {
      const heading = editor.document[0];
      editor.updateBlock(heading, { content: "Neuer Titel" } as never);
    });
    expect(saved).toBe(`${frontmatter}\n# Neuer Titel\n\nText\n`);
  });

  it("Windows-Zeilenenden und Byte-Order-Mark bleiben erhalten", () => {
    const text = "﻿---\r\nid: 1\r\n---\r\n# Titel\r\n\r\nText\r\n";
    const saved = editPage(text, (editor) => {
      editor.updateBlock(editor.document[1], { content: "Anderer Text" } as never);
    });
    expect(saved).toBe("﻿---\r\nid: 1\r\n---\r\n# Titel\r\n\r\nAnderer Text\r\n");
  });

  it("ohne Änderung entsteht exakt der ursprüngliche Dateiinhalt", () => {
    const files = import.meta.glob("../../beispiel-vault/**/*.md", { query: "?raw", import: "default", eager: true });
    for (const text of Object.values(files as Record<string, string>)) {
      expect(editPage(text, () => {})).toBe(text);
    }
  });
});
