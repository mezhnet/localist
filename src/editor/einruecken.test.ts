// Tab und Shift+Tab im Block-Editor (Etappe 17): Eingerückt wird nur, was Markdown speichern kann, der Fokus
// bleibt immer im Editor (Taste gilt als erledigt), und alles Eingerückte übersteht Speichern und Neuladen.
import { BlockNoteEditor } from "@blocknote/core";
import { FormattingToolbarExtension } from "@blocknote/core/extensions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blocksToMarkdown, markdownToBlocks } from "../markdown/blocks";
import { MarkdownEinruecken } from "./einruecken";
import { schema, type VaultBlock, type VaultEditor, type VaultPartialBlock } from "./schema";

let editor: VaultEditor | undefined;

afterEach(() => {
  editor?.unmount();
  editor = undefined;
});

function erstellen(inhalt: string | VaultPartialBlock[]): VaultEditor {
  const blocks = typeof inhalt === "string" ? markdownToBlocks(inhalt) : inhalt;
  const instanz = BlockNoteEditor.create({
    schema,
    trailingBlock: false,
    tabBehavior: "prefer-indent",
    extensions: [MarkdownEinruecken],
    initialContent: blocks,
  });
  instanz.mount(document.createElement("div"));
  editor = instanz;
  return instanz;
}

/** Sucht einen Block (auch verschachtelt) über den Anfang seines Texts. */
function block(instanz: VaultEditor, text: string): VaultBlock {
  const suche = (blocks: VaultBlock[]): VaultBlock | undefined => {
    for (const b of blocks) {
      const inhalt = Array.isArray(b.content) ? b.content.map((c) => ("text" in c ? c.text : "")).join("") : "";
      if (inhalt.startsWith(text)) return b;
      const kind = suche(b.children);
      if (kind) return kind;
    }
    return undefined;
  };
  const gefunden = suche(instanz.document);
  if (!gefunden) throw new Error(`Block „${text}“ nicht gefunden`);
  return gefunden;
}

/** Drückt Tab (bzw. Shift+Tab, Strg+Tab) wie die Tastatur; liefert, ob der Editor die Taste übernommen hat. */
function druecke(instanz: VaultEditor, taste: "Tab" | "Shift-Tab" | "Ctrl-Tab"): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: taste === "Shift-Tab",
    ctrlKey: taste === "Ctrl-Tab",
    bubbles: true,
    cancelable: true,
  });
  const view = instanz.prosemirrorView;
  return Boolean(view.someProp("handleKeyDown", (handler) => handler(view, event)));
}

/** Markiert Text innerhalb eines Blocks (Zeichen `von` bis `bis`). */
function markiere(instanz: VaultEditor, text: string, von: number, bis: number) {
  const id = block(instanz, text).id;
  let start = -1;
  instanz.prosemirrorState.doc.descendants((node, pos) => {
    if (start === -1 && node.type.name === "blockContainer" && node.attrs.id === id) start = pos + 2; // Anfang des Texts
    return start === -1;
  });
  instanz._tiptapEditor.commands.setTextSelection({ from: start + von, to: start + bis });
}

const markdown = (instanz: VaultEditor) => blocksToMarkdown(instanz.document);
/** Speichern und Neuladen: Das gespeicherte Markdown ergibt wieder dasselbe Markdown. */
const neuGeladen = (md: string) => blocksToMarkdown(markdownToBlocks(md));

describe("Tab rückt ein, was Markdown speichern kann", () => {
  it.each([
    ["Listenpunkt", "- a\n- b\n", "- a\n  - b\n"],
    ["Checklistenpunkt", "- [ ] a\n- [ ] b\n", "- [ ] a\n  - [ ] b\n"],
    ["nummerierter Punkt", "1. a\n2. b\n", "1. a\n   1. b\n"],
    ["Checklistenpunkt unter Listenpunkt", "- a\n- [ ] b\n", "- a\n  - [ ] b\n"],
    ["Absatz unter einem Listenpunkt", "- a\n\nb\n", "- a\n\n  b\n"],
  ])("%s", (_name, vorher, nachher) => {
    const e = erstellen(vorher);
    e.setTextCursorPosition(block(e, "b").id, "end");
    expect(druecke(e, "Tab")).toBe(true);
    expect(markdown(e)).toBe(nachher);
    expect(neuGeladen(nachher)).toBe(nachher);
  });

  it("mehrere markierte Listenpunkte rücken zusammen ein", () => {
    const e = erstellen("- a\n- b\n- c\n");
    e.setSelection(block(e, "b").id, block(e, "c").id);
    expect(druecke(e, "Tab")).toBe(true);
    expect(markdown(e)).toBe("- a\n  - b\n  - c\n");
  });

  it("auch bei offener Formatierungsleiste, Markierung und Cursor bleiben an derselben Textstelle", () => {
    const e = erstellen("- eins\n- zwei drei\n");
    markiere(e, "zwei", 1, 4);
    expect(e.getExtension(FormattingToolbarExtension)?.store.state).toBe(true);
    const vorher = e.prosemirrorState.selection;
    expect(druecke(e, "Tab")).toBe(true);
    expect(markdown(e)).toBe("- eins\n  - zwei drei\n");
    const nachher = e.prosemirrorState.selection;
    expect([nachher.$from.parentOffset, nachher.$to.parentOffset]).toEqual([vorher.$from.parentOffset, vorher.$to.parentOffset]);
    expect(e.getTextCursorPosition().block.id).toBe(block(e, "zwei").id);
  });
});

describe("Tab lässt alles andere ruhig stehen, der Fokus bleibt im Editor", () => {
  it.each<[string, string | VaultPartialBlock[], string]>([
    ["erster Block", "Text\n", "Text"],
    ["Absatz nach Absatz", "Eins\n\nZwei\n", "Zwei"],
    ["Überschrift nach Listenpunkt", "- a\n\n## Titel\n", "Titel"],
    ["Callout nach Listenpunkt", "- a\n\n> [!info] Hinweis\n", "Hinweis"],
    ["Toggle nach Callout", "> [!info] Hinweis\n\n> [!note]- Mehr\n> Inhalt\n", "Mehr"],
    ["Absatz nach Toggle", "> [!note]- Mehr\n> Inhalt\n\nDanach\n", "Danach"],
    ["Zitat nach Listenpunkt", "- a\n\n> Zitat\n", "Zitat"],
    ["erster Listenpunkt", "- a\n- b\n", "a"],
    ["Absatz unter einem leeren Listenpunkt", [{ type: "bulletListItem" }, { type: "paragraph", content: "Text" }], "Text"],
    ["Markierung über Listenpunkt und Überschrift", "- a\n- b\n\n## Titel\n", "b"],
  ])("%s", (name, inhalt, text) => {
    const e = erstellen(inhalt);
    if (name.startsWith("Markierung")) e.setSelection(block(e, "b").id, block(e, "Titel").id);
    else e.setTextCursorPosition(block(e, text).id, "end");
    const vorher = JSON.stringify(e.document);
    expect(druecke(e, "Tab")).toBe(true);
    expect(JSON.stringify(e.document)).toBe(vorher);
  });
});

describe("Shift+Tab rückt aus", () => {
  it("Listenpunkt; folgende Punkte werden seine Kinder und bleiben gespeichert", () => {
    const e = erstellen("- a\n  - b\n  - c\n");
    e.setTextCursorPosition(block(e, "b").id, "end");
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(markdown(e)).toBe("- a\n- b\n  - c\n");
    expect(neuGeladen(markdown(e))).toBe(markdown(e));
  });

  it("Absatz unter einem Listenpunkt", () => {
    const e = erstellen("- a\n\n  b\n");
    e.setTextCursorPosition(block(e, "b").id, "end");
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(markdown(e)).toBe("- a\n\nb\n");
  });

  it("den letzten Absatz aus einem Callout heraus", () => {
    const e = erstellen("> [!info] Hinweis\n> Inhalt\n");
    e.setTextCursorPosition(block(e, "Inhalt").id, "end");
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(markdown(e)).toBe("> [!info] Hinweis\n\nInhalt\n");
  });

  it.each([
    ["ganz links", "- a\n", "a"],
    ["Absatz, nach dem noch ein Punkt folgt (der Punkt käme unter den Absatz)", "- a\n\n  Text\n\n  - b\n", "Text"],
  ])("bleibt stehen: %s", (_name, md, text) => {
    const e = erstellen(md);
    e.setTextCursorPosition(block(e, text).id, "end");
    const vorher = JSON.stringify(e.document);
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(JSON.stringify(e.document)).toBe(vorher);
  });
});

describe("Tab im Code-Block einer Notiz", () => {
  const code = (e: VaultEditor) => markdown(e).split("\n").slice(1, -2).join("\n");

  it("rückt die Zeile am Cursor um zwei Leerzeichen ein und wieder aus", () => {
    const e = erstellen("```\neins\nzwei\n```\n");
    e.setTextCursorPosition(e.document[0].id, "end");
    expect(druecke(e, "Tab")).toBe(true);
    expect(code(e)).toBe("eins\n  zwei");
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(code(e)).toBe("eins\nzwei");
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(code(e)).toBe("eins\nzwei");
  });

  it("rückt alle markierten Zeilen ein, ohne Text zu ersetzen", () => {
    const e = erstellen("```\neins\nzwei\n```\n");
    markiere(e, "eins", 1, 7);
    expect(druecke(e, "Tab")).toBe(true);
    expect(code(e)).toBe("  eins\n  zwei");
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(code(e)).toBe("eins\nzwei");
  });
});

it("Strg+Tab bleibt frei (für spätere Reiter)", () => {
  const e = erstellen("- a\n- b\n");
  e.setTextCursorPosition(block(e, "b").id, "end");
  expect(druecke(e, "Ctrl-Tab")).toBe(false);
  expect(markdown(e)).toBe("- a\n- b\n");
});

describe("Übergang beim Ein- und Ausrücken", () => {
  // jsdom misst nichts und kennt keine Web Animations: Die linke Kante eines Blocks ergibt sich hier aus seiner
  // Tiefe (24 px je Ebene), Dauer und Kurve kommen wie aus tokens.css, animate() wird mitgeschrieben.
  const animate = vi.fn();
  let reduziert = false;
  beforeEach(() => {
    animate.mockClear();
    reduziert = false;
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true, writable: true });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      let gruppen = 0;
      for (let el = this.parentElement; el; el = el.parentElement) if (el.classList.contains("bn-block-group")) gruppen++;
      const left = 24 * Math.max(0, gruppen - 1);
      return { left, x: left, right: left, top: 0, y: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
    });
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const style = original(el, pseudo);
      const werte: Record<string, string> = { "--duration-indent": " 140ms", "--ease-indent": " cubic-bezier(0.25, 0.1, 0.25, 1)" };
      return new Proxy(style, { get: (ziel, name) => (name === "getPropertyValue" ? (n: string) => werte[n] ?? ziel.getPropertyValue(n) : Reflect.get(ziel, name)) });
    });
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: reduziert && query.includes("reduce") }) as MediaQueryList);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  const animiert = (e: VaultEditor, text: string) =>
    animate.mock.contexts.map((el) => (el as HTMLElement).dataset.id).filter((id) => id === block(e, text).id).length;

  it("Tab: der Block gleitet von der alten Stelle an die neue (140 ms, gleichmäßige Kurve)", () => {
    const e = erstellen("- a\n- b\n");
    e.setTextCursorPosition(block(e, "b").id, "end");
    expect(druecke(e, "Tab")).toBe(true);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith([{ transform: "translateX(-24px)" }, { transform: "none" }], { duration: 140, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" });
    expect(animiert(e, "b")).toBe(1);
  });

  it("Shift+Tab: der Block gleitet nach links, mehrere markierte Blöcke gleiten zusammen", () => {
    const e = erstellen("- a\n  - b\n  - c\n");
    e.setSelection(block(e, "b").id, block(e, "c").id);
    expect(druecke(e, "Shift-Tab")).toBe(true);
    expect(markdown(e)).toBe("- a\n- b\n- c\n");
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls.map(([frames]) => frames[0].transform)).toEqual(["translateX(24px)", "translateX(24px)"]);
  });

  it("was stehen bleibt, bewegt sich nicht; bei „Bewegung reduzieren“ springt der Block ohne Übergang", () => {
    const e = erstellen("Eins\n\nZwei\n\n- a\n- b\n");
    e.setTextCursorPosition(block(e, "Zwei").id, "end");
    druecke(e, "Tab");
    expect(animate).not.toHaveBeenCalled();

    reduziert = true;
    e.setTextCursorPosition(block(e, "b").id, "end");
    druecke(e, "Tab");
    expect(markdown(e)).toBe("Eins\n\nZwei\n\n- a\n  - b\n");
    expect(animate).not.toHaveBeenCalled();
  });
});
