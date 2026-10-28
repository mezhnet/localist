// Tab und Shift+Tab im Block-Editor. Eingerückt wird nur, was der Markdown-Konverter auch eingerückt speichert
// (serializeBlock in src/markdown/blocks.ts): Listenpunkte, Checklisten, nummerierte Listen und Absätze unter
// einem Listenpunkt. In allen anderen Fällen bleibt der Block stehen. Beide Tasten werden immer abgefangen,
// damit der Fokus den Editor nie verlässt (auch im ersten Block, ganz links und bei offener Formatierungsleiste).
import { createExtension } from "@blocknote/core";
import type { VaultEditor } from "./schema";

type EditorState = VaultEditor["prosemirrorState"];
type PMNode = EditorState["doc"];

export type Richtung = "ein" | "aus";

const LISTE = new Set(["bulletListItem", "numberedListItem", "checkListItem"]);
/** Diese Blöcke dürfen unter einen Listenpunkt rücken. */
const EINRUECKBAR = new Set([...LISTE, "paragraph"]);

/** Typ eines Blocks (`blockContainer`): sein erstes Kind ist der Inhalt, z. B. `paragraph`. */
const typ = (container: PMNode) => container.firstChild?.type.name ?? "";
const hatKinder = (container: PMNode) => container.childCount > 1;

/**
 * Die Geschwister, die BlockNote beim Ein- oder Ausrücken bewegt: derselbe Bereich wie `holdsItems` in
 * BlockNotes `nestBlock.ts` (die tiefste Blockgruppe, die alle markierten Blöcke enthält).
 */
function bereich(state: EditorState) {
  const { $from, $to } = state.selection;
  const item = state.schema.nodes.blockContainer;
  const range = $from.blockRange(
    $to,
    (node) => node.childCount > 0 && node.type.isInGroup("childContainer") && node.type.contentMatch.matchType(item) !== null,
  );
  if (!range) return null;
  const bewegt: PMNode[] = [];
  for (let i = range.startIndex; i < range.endIndex; i++) bewegt.push(range.parent.child(i));
  return { range, bewegt, eltern: $from.node(range.depth - 1) };
}

/** Ob Tab (`ein`) bzw. Shift+Tab (`aus`) den markierten Block so verschiebt, dass Markdown es speichern kann. */
export function darfEinruecken(state: EditorState, richtung: Richtung): boolean {
  const b = bereich(state);
  if (!b || b.bewegt.length === 0) return false;
  const { range, bewegt, eltern } = b;
  if (richtung === "ein") {
    if (range.startIndex === 0) return false;
    const vorher = range.parent.child(range.startIndex - 1);
    if (!LISTE.has(typ(vorher))) return false;
    if (!bewegt.every((block) => EINRUECKBAR.has(typ(block)))) return false;
    // Kinder eines Absatzes speichert Markdown nicht eingerückt.
    if (bewegt.some((block) => typ(block) === "paragraph" && hatKinder(block))) return false;
    // „- \n\n  Text“: Ein Absatz unter einem leeren Listenpunkt landet beim Lesen außerhalb der Liste.
    return !(typ(bewegt[0]) === "paragraph" && vorher.firstChild?.textContent === "" && !hatKinder(vorher));
  }
  if (eltern.type.name !== "blockContainer") return false; // schon ganz links
  // Beim Ausrücken werden die folgenden Geschwister Kinder des letzten bewegten Blocks;
  // das geht nur unter einem Listenpunkt gut.
  const folgende = range.parent.childCount - range.endIndex;
  return folgende === 0 || LISTE.has(typ(bewegt[bewegt.length - 1]));
}

/** Rückt im Code-Block jede markierte Zeile um zwei Leerzeichen ein oder aus (wie im Code-Editor der HTML-Seiten). */
function codeZeilen(editor: VaultEditor, richtung: Richtung) {
  editor.transact((tr) => {
    const { $from, $to } = tr.selection;
    const text = $from.parent.textContent;
    const start = $from.start();
    const von = $from.parentOffset;
    const bis = $to.parentOffset;
    const anfaenge: number[] = [];
    for (let zeile = text.lastIndexOf("\n", von - 1) + 1; ; ) {
      anfaenge.push(zeile);
      const ende = text.indexOf("\n", zeile);
      // Eine Markierung, die genau am Anfang einer Zeile endet, umfasst diese Zeile nicht mehr.
      if (ende === -1 || ende + 1 > bis || (ende + 1 === bis && bis > von)) break;
      zeile = ende + 1;
    }
    for (const zeile of anfaenge.reverse()) {
      if (richtung === "ein") tr.insertText("  ", start + zeile);
      else {
        const leer = /^ {0,2}/.exec(text.slice(zeile))![0].length;
        if (leer > 0) tr.delete(start + zeile, start + zeile + leer);
      }
    }
  });
}

/** Dauer und Kurve des Übergangs aus tokens.css; null ohne Web Animations oder bei „Bewegung reduzieren“. */
function uebergang(el: HTMLElement): KeyframeAnimationOptions | null {
  if (typeof el.animate !== "function" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  const style = getComputedStyle(el);
  const dauer = style.getPropertyValue("--duration-indent").trim();
  const ms = dauer.endsWith("ms") ? parseFloat(dauer) : parseFloat(dauer) * 1000;
  return ms > 0 ? { duration: ms, easing: style.getPropertyValue("--ease-indent").trim() || "ease" } : null;
}

/**
 * Führt `aktion` aus und lässt die bewegten Blöcke von ihrer alten Stelle an die neue gleiten. BlockNotes eigene
 * Animation (data-prev-depth-change) startet nicht zuverlässig, weil BlockNote das Attribut schon nach
 * setTimeout(0) wieder entfernt, oft bevor der Browser es gezeichnet hat; page.css schaltet sie deshalb ab.
 */
function mitUebergang(editor: VaultEditor, ids: string[], aktion: () => void) {
  const finde = (id: string) =>
    [...(editor.domElement?.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]") ?? [])].find((el) => el.dataset.id === id);
  const vorher = new Map(ids.map((id) => [id, finde(id)?.getBoundingClientRect().left]));
  aktion();
  for (const id of ids) {
    const el = finde(id);
    const links = vorher.get(id);
    if (!el || links === undefined) continue;
    const optionen = uebergang(el);
    if (!optionen) return;
    const versatz = links - el.getBoundingClientRect().left;
    if (Math.abs(versatz) >= 0.5) el.animate([{ transform: `translateX(${versatz}px)` }, { transform: "none" }], optionen);
  }
}

/** Tab bzw. Shift+Tab: rückt ein oder aus, wenn es erlaubt ist, und meldet immer „erledigt“. */
export function einruecken(editor: VaultEditor, richtung: Richtung): boolean {
  if (!editor.isEditable) return false;
  const state = editor.prosemirrorState;
  const { $from, $to } = state.selection;
  if ($from.parent.type.name === "codeBlock" && $from.sameParent($to)) {
    codeZeilen(editor, richtung);
  } else if (darfEinruecken(state, richtung)) {
    const ids = bereich(state)!.bewegt.map((block) => String(block.attrs.id));
    mitUebergang(editor, ids, () => (richtung === "ein" ? editor.nestBlock() : editor.unnestBlock()));
  }
  return true;
}

/**
 * Tastenbelegung für den Editor. Sie läuft vor BlockNotes eigenem Tab (Priorität 50) und vor dem Tab im
 * Code-Block (`code-block-keyboard-shortcuts`, das eine Markierung durch zwei Leerzeichen ersetzen würde).
 */
export const MarkdownEinruecken = createExtension({
  key: "markdown-einruecken",
  runsBefore: ["code-block-keyboard-shortcuts"],
  keyboardShortcuts: {
    Tab: ({ editor }) => einruecken(editor as VaultEditor, "ein"),
    "Shift-Tab": ({ editor }) => einruecken(editor as VaultEditor, "aus"),
  },
});
