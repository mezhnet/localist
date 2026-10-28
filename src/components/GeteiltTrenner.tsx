// Trennlinie zwischen Code-Editor und Vorschau in der Ansicht „Geteilt“ (Etappe 17): mit Maus, Finger und
// Tastatur verschiebbar, Doppelklick setzt auf 50 : 50 zurück, das Verhältnis wird gemerkt.
// Damit beim Ziehen nichts ruckelt, rendert dabei nur diese Komponente neu: Die Breiten setzt sie als
// CSS-Variablen direkt an der Fläche (`--html-links`, `--html-rechts`), Editor und Vorschau bleiben unberührt.
// Während des Ziehens trägt die Fläche `is-ziehen`: Die iframes der Vorschau bekommen dann keine Mausereignisse
// (sonst gingen die Bewegungen über der Vorschau verloren), und es wird kein Text markiert.
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { anteilAusZeiger, anteilNachTaste, begrenzeAnteil, GETEILT_STANDARD, storeAnteil, storedAnteil, type CodeSeite } from "../lib/html-editor";

interface Props {
  /** Die Fläche mit Code-Editor, Trennlinie und Vorschau (`.html-workspace`). */
  flaeche: RefObject<HTMLDivElement | null>;
  seite: CodeSeite;
  /** id des Code-Bereichs (für aria-controls). */
  codeId: string;
}

interface Ziehen {
  links: number;
  breite: number;
  dicke: number;
  x: number;
  /** Abstand des Zeigers zur Mitte der Linie beim Anfassen: Ein bloßer Klick verschiebt nichts. */
  versatz: number;
  bild: number;
}

export function GeteiltTrenner({ flaeche, seite, codeId }: Props) {
  /** Anteil des Code-Editors an der Breite (0 … 1), unabhängig davon, auf welcher Seite er steht. */
  const [anteil, setAnteilState] = useState(storedAnteil);
  const anteilRef = useRef(anteil);
  const trenner = useRef<HTMLDivElement>(null);
  const ziehen = useRef<Ziehen | null>(null);

  const setAnteil = (wert: number) => {
    anteilRef.current = wert;
    setAnteilState(wert);
  };

  /** Lage der Fläche und Dicke der Trennlinie (in jsdom alles 0). */
  const masse = () => {
    const box = flaeche.current?.getBoundingClientRect();
    return { links: box?.left ?? 0, breite: box?.width ?? 0, dicke: trenner.current?.getBoundingClientRect().width ?? 0 };
  };

  // Spalten von links nach rechts; steht der Code rechts, ist die linke Spalte die Vorschau.
  useLayoutEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const links = seite === "links" ? anteil : 1 - anteil;
    // In Hundertsteln, damit die Summe der fr-Werte sicher ≥ 1 ist (sonst bliebe Platz frei).
    el.style.setProperty("--html-links", `${(links * 100).toFixed(2)}fr`);
    el.style.setProperty("--html-rechts", `${((1 - links) * 100).toFixed(2)}fr`);
  }, [anteil, seite, flaeche]);

  useEffect(() => {
    const el = flaeche.current;
    return () => {
      if (ziehen.current) cancelAnimationFrame(ziehen.current.bild);
      el?.classList.remove("is-ziehen");
      el?.style.removeProperty("--html-links");
      el?.style.removeProperty("--html-rechts");
    };
  }, [flaeche]);

  const ausZeiger = (z: Ziehen) => begrenzeAnteil(anteilAusZeiger(z.x - z.versatz, z.links, z.breite, z.dicke, seite), z.breite - z.dicke);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || ziehen.current) return;
    event.preventDefault(); // keine Textauswahl, kein Fokuswechsel
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const linie = event.currentTarget.getBoundingClientRect();
    const versatz = linie.width > 0 ? event.clientX - (linie.left + linie.width / 2) : 0;
    ziehen.current = { ...masse(), x: event.clientX, versatz, bild: 0 };
    flaeche.current?.classList.add("is-ziehen");
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const z = ziehen.current;
    if (!z) return;
    z.x = event.clientX;
    // Höchstens einmal je Bild neu berechnen.
    if (z.bild) return;
    z.bild = requestAnimationFrame(() => {
      z.bild = 0;
      if (ziehen.current === z) setAnteil(ausZeiger(z));
    });
  };

  const beenden = () => {
    const z = ziehen.current;
    if (!z) return;
    cancelAnimationFrame(z.bild);
    ziehen.current = null;
    flaeche.current?.classList.remove("is-ziehen");
    const wert = z.breite > 0 ? ausZeiger(z) : anteilRef.current;
    setAnteil(wert);
    storeAnteil(wert);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const neu = anteilNachTaste(anteilRef.current, event.key, event.shiftKey, seite);
    if (neu === null) return;
    event.preventDefault();
    const { breite, dicke } = masse();
    const wert = begrenzeAnteil(neu, breite - dicke);
    setAnteil(wert);
    storeAnteil(wert);
  };

  const prozent = Math.round(anteil * 100);
  return (
    <div
      ref={trenner}
      className="html-trenner"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Trennlinie zwischen Code-Editor und Vorschau"
      aria-controls={codeId}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={prozent}
      aria-valuetext={`Code-Editor ${prozent} %, Vorschau ${100 - prozent} %`}
      title="Ziehen ändert die Breite, Doppelklick setzt auf 50 : 50 zurück (auch mit Pfeiltasten und Enter)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={beenden}
      onPointerCancel={beenden}
      onLostPointerCapture={beenden}
      onDoubleClick={() => {
        setAnteil(GETEILT_STANDARD);
        storeAnteil(GETEILT_STANDARD);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
