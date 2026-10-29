// Leiste über der Tastatur (Handy, Vorlage 04-handy-notiz-schwarz.png): „+“ (Baustein wählen), Checkliste, Callout,
// Toggle, Bild und „Fertig“ (schließt die Tastatur). Sie erscheint, solange im Block-Editor geschrieben wird, und
// ersetzt dann die Navigationsleiste. Sie sitzt über der Bildschirmtastatur (visualViewport) und schiebt den Text so,
// dass sie den Cursor nie verdeckt. Tippen auf einen Knopf nimmt dem Editor den Fokus nicht (die Tastatur bleibt).
import { insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { SuggestionMenu } from "@blocknote/core/extensions";
import { CheckSquare, Image, Info, ListIndentIncrease, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { markToggleOpen } from "../editor/callout";
import type { VaultEditor } from "../editor/schema";

/** Abstand zwischen Cursor und Leiste, unter dem der Text weitergeschoben wird. */
const CURSOR_ABSTAND = 12;

/** Wie weit die Bildschirmtastatur den unteren Rand der Seite überdeckt (0, wenn die Seite selbst kleiner wird). */
export function tastaturUeberdeckung(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

/** Schreibt im Block-Editor gerade jemand? (Fokus im Editor; Knöpfe der Leiste nehmen ihn nicht weg.) */
export function useSchreibt(editor: VaultEditor): boolean {
  const [schreibt, setSchreibt] = useState(false);
  useEffect(() => {
    const imEditor = () => {
      const dom = editor.domElement;
      return !!dom && dom.contains(document.activeElement);
    };
    const pruefen = () => setSchreibt(imEditor());
    // Nach focusout steht das neue Ziel erst einen Augenblick später fest.
    const spaeter = () => window.setTimeout(pruefen, 0);
    document.addEventListener("focusin", pruefen);
    document.addEventListener("focusout", spaeter);
    pruefen();
    return () => {
      document.removeEventListener("focusin", pruefen);
      document.removeEventListener("focusout", spaeter);
    };
  }, [editor]);
  return schreibt;
}

/** Nächster Vorfahr, der senkrecht scrollt (auf dem Handy `.main-scroll`). */
function scrollBereich(element: Element | null): HTMLElement | null {
  for (let e = element?.parentElement ?? null; e; e = e.parentElement) {
    const { overflowY } = getComputedStyle(e);
    if ((overflowY === "auto" || overflowY === "scroll") && e.scrollHeight > e.clientHeight) return e;
  }
  return null;
}

/** Lage des Cursors (bei leerer Zeile der Block, in dem er steht). */
function cursorRechteck(): DOMRect | null {
  const auswahl = window.getSelection();
  if (!auswahl || auswahl.rangeCount === 0) return null;
  const bereich = auswahl.getRangeAt(0).cloneRange();
  bereich.collapse(false);
  const rechteck = bereich.getBoundingClientRect();
  if (rechteck.height > 0 || rechteck.top > 0) return rechteck;
  const knoten = auswahl.focusNode;
  const element = knoten instanceof Element ? knoten : knoten?.parentElement;
  return element?.getBoundingClientRect() ?? null;
}

interface Props {
  editor: VaultEditor;
  /** Eintrag „Bild“ des Menüs „Baustein wählen …“ (dasselbe wie dort). */
  onBild: () => void;
}

export function Tastaturleiste({ editor, onBild }: Props) {
  const leiste = useRef<HTMLDivElement>(null);
  const [ueberdeckt, setUeberdeckt] = useState(() => tastaturUeberdeckung());

  // Über der Bildschirmtastatur bleiben; die Seite bekommt unten so viel Platz, dass der Text darüber passt.
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    const melden = () => setUeberdeckt(tastaturUeberdeckung());
    vv?.addEventListener("resize", melden);
    vv?.addEventListener("scroll", melden);
    window.addEventListener("resize", melden);
    return () => {
      vv?.removeEventListener("resize", melden);
      vv?.removeEventListener("scroll", melden);
      window.removeEventListener("resize", melden);
    };
  }, []);
  useLayoutEffect(() => {
    const wurzel = document.documentElement.style;
    wurzel.setProperty("--tastatur-ueberdeckung", `${ueberdeckt}px`);
    return () => {
      wurzel.removeProperty("--tastatur-ueberdeckung");
    };
  }, [ueberdeckt]);

  // Der Cursor bleibt immer über der Leiste: nach jeder Bewegung, Eingabe und Änderung der Tastaturhöhe prüfen.
  useEffect(() => {
    let rahmen = 0;
    const pruefen = () => {
      cancelAnimationFrame(rahmen);
      rahmen = requestAnimationFrame(() => {
        const cursor = cursorRechteck();
        const oben = leiste.current?.getBoundingClientRect().top;
        if (!cursor || oben === undefined || oben <= 0) return;
        const zuTief = cursor.bottom + CURSOR_ABSTAND - oben;
        if (zuTief <= 0) return;
        const bereich = scrollBereich(editor.domElement ?? null);
        if (bereich) bereich.scrollTop += zuTief;
        else window.scrollBy(0, zuTief);
      });
    };
    const ab = editor.onSelectionChange(pruefen);
    const abAenderung = editor.onChange(pruefen);
    pruefen();
    return () => {
      cancelAnimationFrame(rahmen);
      ab?.();
      abAenderung?.();
    };
  }, [editor, ueberdeckt]);

  /** Knöpfe nehmen dem Editor den Fokus nicht weg, damit die Tastatur offen bleibt. */
  const behalten = (event: ReactMouseEvent) => event.preventDefault();
  const knopf = (label: string, symbol: ReactNode, aktion: () => void, className?: string) => (
    <button type="button" className={className ?? "tastaturleiste-knopf"} aria-label={label} title={label} onPointerDown={behalten} onMouseDown={behalten} onClick={aktion}>
      {symbol}
    </button>
  );

  /** „+“: wie das „+“ neben dem Block – leerer Block → Menü dort, sonst neue Zeile darunter mit Menü. */
  const bausteinWaehlen = () => {
    const block = editor.getTextCursorPosition().block;
    const leer = Array.isArray(block.content) && block.content.length === 0;
    if (!leer) {
      const [neu] = editor.insertBlocks([{ type: "paragraph" }], block, "after");
      editor.setTextCursorPosition(neu);
    }
    editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/");
  };

  return createPortal(
    <div ref={leiste} className="tastaturleiste" role="toolbar" aria-label="Schreiben" data-ueberdeckt={ueberdeckt > 0 ? "" : undefined}>
      <div className="tastaturleiste-knoepfe">
        {knopf("Baustein wählen", <Plus aria-hidden="true" />, bausteinWaehlen, "tastaturleiste-knopf is-plus")}
        {knopf("Checkliste", <CheckSquare aria-hidden="true" />, () => insertOrUpdateBlockForSlashMenu(editor, { type: "checkListItem" }))}
        {knopf("Callout", <Info aria-hidden="true" />, () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { calloutType: "info", fold: "" } }))}
        {knopf("Toggle", <ListIndentIncrease aria-hidden="true" />, () => {
          // Wie im Menü: Ein neuer Toggle ist zum Weiterschreiben offen, in der Datei startet er zugeklappt ("-").
          markToggleOpen(editor.getTextCursorPosition().block.id);
          insertOrUpdateBlockForSlashMenu(editor, { type: "callout", props: { calloutType: "note", fold: "-" } });
        })}
        {knopf("Bild", <Image aria-hidden="true" />, onBild)}
      </div>
      <button
        type="button"
        className="tastaturleiste-fertig"
        onPointerDown={behalten}
        onMouseDown={behalten}
        onClick={() => {
          // Fokus weg = Tastatur zu; die Leiste verschwindet mit dem Fokus.
          (document.activeElement as HTMLElement | null)?.blur();
          editor.domElement?.blur();
        }}
      >
        Fertig
      </button>
    </div>,
    document.body,
  );
}
