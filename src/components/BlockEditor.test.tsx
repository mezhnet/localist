// Notiz nach der Vorlage 02 (Etappe 19): Menü „Baustein wählen …“ mit Filterzeile und Symbol-Kästchen.
import { SuggestionMenu } from "@blocknote/core/extensions";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultEditor } from "../editor/schema";
import { BlockEditor, WOERTERBUCH } from "./BlockEditor";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function editorMit(text: string) {
  let editor: VaultEditor | null = null;
  render(
    <BlockEditor
      initialBlocks={[{ type: "paragraph", content: text }]}
      onChange={() => {}}
      onReady={(fertig) => (editor = fertig)}
      resolveFileUrl={async (url) => url}
    />,
  );
  await waitFor(() => expect(editor).not.toBeNull());
  return editor!;
}

describe("Menü „Baustein wählen …“ (Etappe 19)", () => {
  it("„/“ öffnet das Menü mit Filterzeile, Symbol-Kästchen und ↵ am markierten Eintrag; Reihenfolge wie in der Vorlage", async () => {
    const editor = await editorMit("Hallo");
    // jsdom misst kein Layout; das Menü braucht für seine Lage nur ein Rechteck mit toJSON().
    const rechteck = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ ...rechteck, toJSON: () => rechteck } as DOMRect);
    act(() => {
      editor.setTextCursorPosition(editor.document[0], "end");
      editor.getExtension(SuggestionMenu)!.openSuggestionMenu("/");
    });
    // Das schwebende Menü ist in jsdom (ohne Layout) für Testing Library „versteckt“.
    const menu = await screen.findByRole("listbox", { name: "Baustein wählen", hidden: true });
    expect(menu.querySelector(".baustein-menu-filter")?.textContent).toBe("Bausteine filtern …");
    const eintraege = await within(menu).findAllByRole("option", { hidden: true });
    expect(eintraege.slice(0, 7).map((eintrag) => eintrag.querySelector(".baustein-menu-titel")?.textContent)).toEqual([
      "Text",
      "Überschrift",
      "Checkliste",
      "Callout",
      "Toggle",
      "Tabelle",
      "Bild",
    ]);
    // Jeder Eintrag hat ein Symbol-Kästchen mit Linien-Symbol, nur der markierte den Hinweis ↵.
    expect(eintraege.every((eintrag) => eintrag.querySelector(".baustein-menu-symbol svg"))).toBe(true);
    expect(eintraege[0].getAttribute("aria-selected")).toBe("true");
    expect(menu.querySelectorAll(".baustein-menu-enter")).toHaveLength(1);
    expect(eintraege[0].querySelector(".baustein-menu-enter")).toBeTruthy();
  });

  it("ein leerer Block zeigt „Baustein wählen …“", () => {
    expect(WOERTERBUCH.placeholders.default).toBe("Baustein wählen …");
    expect(WOERTERBUCH.placeholders.emptyDocument).toBe("Baustein wählen …");
  });
});
