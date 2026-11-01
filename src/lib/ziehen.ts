// Gemeinsames Ziehen und Ablegen für Maus und Finger (Etappe 22) auf Basis von Pointer Events. Es ersetzt das
// HTML5-Drag-and-Drop von Seitenleiste, Kanban und Notizbuch, weil der Finger in der Android-WebView damit nicht
// zuverlässig zieht. Die Maus greift sofort (ab wenigen Pixeln Bewegung bei gedrückter Taste), der Finger erst nach
// langem Drücken ohne Bewegung; vorher scrollt Wischen wie gewohnt und kurzes Tippen öffnet. Eine Kopie des Elements
// folgt dem Zeiger, das Ziel unter dem Zeiger findet `document.elementFromPoint`. Escape bricht ab, am Rand des
// Scrollbereichs scrollt die Liste mit, Verweilen über demselben Ziel meldet `onVerweilen` (Ordner aufklappen).
// Loslassen ohne Bewegung nach dem Greifen meldet `onLangDruck` (z. B. Kontextmenü wie bisher beim langen Drücken).
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Finger: So lange ruhig drücken, bis eine Zeile gegriffen ist. */
export const GREIFEN_MS = 400;
/** Finger: So weit darf er sich vor dem Greifen bewegen (sonst scrollt der Browser); danach beginnt ab hier das Ziehen. */
export const RUHIG_PX = 8;
/** Maus: Ab dieser Bewegung bei gedrückter Taste beginnt das Ziehen (darunter bleibt es ein Klick). */
export const MAUS_START_PX = 4;
/** Verweilen über demselben Ziel, bis `onVerweilen` kommt (Ordner aufklappen). */
export const VERWEILEN_MS = 600;
/** Breite der Randzone, in der die Liste beim Ziehen mitscrollt, und die größte Geschwindigkeit pro Bild. */
export const RAND_PX = 40;
export const SCROLL_MAX_PX = 16;
/** Abstand der Kopie zum Zeiger (Maus: rechts darunter; Finger: das Dreifache darüber). */
export const GEIST_ABSTAND_PX = 8;

/**
 * Mit-Scrollen am Rand: Pixel pro Bild (negativ = nach oben bzw. links, 0 = nicht scrollen). Die Geschwindigkeit
 * steigt quadratisch: Wer eine Zeile nahe am Rand nur streift, scrollt kaum (sonst rutschte das Ziel unter dem Finger
 * weg); direkt an oder jenseits der Kante ist es am schnellsten. Die Randzone ist höchstens ein Viertel des Bereichs.
 */
export function randScroll(pos: number, anfang: number, ende: number, rand = RAND_PX, max = SCROLL_MAX_PX): number {
  const zone = Math.min(rand, (ende - anfang) / 4);
  if (zone <= 0) return 0;
  const tiefe = pos < anfang + zone ? pos - (anfang + zone) : pos > ende - zone ? pos - (ende - zone) : 0;
  const anteil = Math.min(1, Math.abs(tiefe) / zone);
  return Math.sign(tiefe) * Math.round(max * anteil * anteil) || 0;
}

/** Nächster Vorfahr, der sich scrollen lässt (für das Mit-Scrollen am Rand). */
export function scrollBereich(element: Element | null): HTMLElement | null {
  for (let e = element?.parentElement ?? null; e; e = e.parentElement) {
    const stil = getComputedStyle(e);
    if ((/(auto|scroll)/.test(stil.overflowY) && e.scrollHeight > e.clientHeight) || (/(auto|scroll)/.test(stil.overflowX) && e.scrollWidth > e.clientWidth)) return e;
  }
  return null;
}

/**
 * Fremde Dateien (z. B. ein Bild aus dem Explorer) werden nirgends abgelegt. Seit `dragDropEnabled: false` fängt
 * Tauri sie nicht mehr ab; ohne diesen Schutz würde die WebView eine fallengelassene Datei selbst öffnen und die App
 * wäre weg (ungespeicherte Änderungen inklusive). Der Zeiger zeigt „nicht erlaubt“. Ziehen innerhalb der Seite
 * (Ziehgriff im Block-Editor) bleibt unberührt. Liefert eine Funktion zum Entfernen.
 */
export function fremdeDateienAbweisen(fenster: Window = window): () => void {
  const mitDateien = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const ueber = (event: DragEvent) => {
    if (!mitDateien(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
  };
  const ablegen = (event: DragEvent) => {
    if (mitDateien(event)) event.preventDefault();
  };
  fenster.addEventListener("dragover", ueber, true);
  fenster.addEventListener("drop", ablegen, true);
  return () => {
    fenster.removeEventListener("dragover", ueber, true);
    fenster.removeEventListener("drop", ablegen, true);
  };
}

export type ZiehPhase = "gegriffen" | "zieht";

export interface ZiehZustand<Q, Z> {
  quelle: Q;
  /** „gegriffen“: Finger hat lange gedrückt, noch ohne Bewegung; „zieht“: die Kopie folgt dem Zeiger. */
  phase: ZiehPhase;
  /** Gültiges Ziel unter dem Zeiger (null = keins, dann wird nichts hervorgehoben). */
  ziel: Z | null;
}

export interface ZiehOptionen<Q, Z> {
  /** Ziel zum Element unter dem Zeiger, nur wenn dort abgelegt werden darf; sonst null. */
  zielAn: (element: Element, x: number, y: number, quelle: Q) => Z | null;
  onAblegen: (quelle: Q, ziel: Z) => void;
  /** Finger: lange gedrückt und ohne Bewegung losgelassen. */
  onLangDruck?: (quelle: Q, x: number, y: number) => void;
  /** Etwa `VERWEILEN_MS` über demselben Ziel. */
  onVerweilen?: (ziel: Z, quelle: Q) => void;
}

interface Lauf {
  beenden: (schlucken: boolean) => void;
}

const gleich = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Der Klick, den der Browser direkt nach dem Loslassen schickt, gehört zum Ziehen und nicht zum Element darunter
 * (er käme im selben Durchlauf wie `pointerup`, danach ist der Filter wieder weg).
 */
function klickSchlucken() {
  const schlucken = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const weg = () => {
    window.removeEventListener("click", schlucken, true);
    window.removeEventListener("pointerdown", weg, true);
  };
  window.addEventListener("click", schlucken, true);
  // Spätestens die nächste Berührung oder der nächste Mausdruck klickt wieder normal.
  window.addEventListener("pointerdown", weg, true);
  setTimeout(weg, 0);
}

/** Kurzes Vibrieren beim Greifen (Android; braucht die Berechtigung VIBRATE, fehlt sie, passiert nichts). */
function vibrieren() {
  try {
    navigator.vibrate?.(15);
  } catch {
    // Ohne Vibration geht es auch.
  }
}

export function useZiehen<Q, Z>(optionen: ZiehOptionen<Q, Z>) {
  const opt = useRef(optionen);
  opt.current = optionen;
  const [zustand, setZustand] = useState<ZiehZustand<Q, Z> | null>(null);
  const lauf = useRef<Lauf | null>(null);

  // Verschwindet die Ansicht mitten im Ziehen, wird ohne Ablegen aufgeräumt.
  useEffect(() => () => lauf.current?.beenden(false), []);

  const starten = useCallback((event: ReactPointerEvent<HTMLElement>, quelle: Q) => {
    if (lauf.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    const element = event.currentTarget;
    const finger = event.pointerType === "touch" || event.pointerType === "pen";
    const id = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    let pos = start;
    let griffPunkt = start;
    let phase: "wartet" | ZiehPhase = "wartet";
    let ziel: Z | null = null;
    let geist: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let verweilen: ReturnType<typeof setTimeout> | undefined;
    let bild = 0;
    const scroller = scrollBereich(element);

    const melden = () => setZustand(phase === "wartet" ? null : { quelle, phase, ziel });

    const geistZeigen = () => {
      const r = element.getBoundingClientRect();
      geist = element.cloneNode(true) as HTMLElement;
      // Die Kopie ist nur Bild: ohne IDs, Titel und data-Attribute (sie ist kein Ziel und nicht doppelt auffindbar).
      for (const teil of [geist, ...geist.querySelectorAll("*")]) {
        for (const name of teil.getAttributeNames()) if (name === "id" || name === "title" || name.startsWith("data-")) teil.removeAttribute(name);
      }
      geist.setAttribute("aria-hidden", "true");
      geist.classList.add("ziehen-geist");
      Object.assign(geist.style, { left: "0px", top: "0px", width: `${r.width}px` });
      geist.style.setProperty("--depth", "0"); // Zeile der Seitenleiste: ohne Einzug

      document.body.append(geist);
    };
    // Die Kopie liegt neben dem Zeiger, nicht auf dem Ziel: bei der Maus rechts darunter, beim Finger darüber
    // (sonst verdeckte sie die Hervorhebung des Ziels bzw. der Finger die Kopie).
    const geistBewegen = () => {
      if (!geist) return;
      const r = geist.getBoundingClientRect();
      const x = finger ? pos.x - r.width / 2 : pos.x + GEIST_ABSTAND_PX;
      const y = finger ? pos.y - r.height - 3 * GEIST_ABSTAND_PX : pos.y + GEIST_ABSTAND_PX;
      geist.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };

    const zielSuchen = () => {
      const unter = document.elementFromPoint?.(pos.x, pos.y) ?? null;
      const neu = unter ? opt.current.zielAn(unter, pos.x, pos.y, quelle) : null;
      if (gleich(neu, ziel)) return;
      ziel = neu;
      clearTimeout(verweilen);
      if (neu !== null && opt.current.onVerweilen) verweilen = setTimeout(() => opt.current.onVerweilen?.(neu, quelle), VERWEILEN_MS);
      melden();
    };

    const scrollen = () => {
      bild = 0;
      if (phase !== "zieht" || !scroller) return;
      const r = scroller.getBoundingClientRect();
      const dy = scroller.scrollHeight > scroller.clientHeight ? randScroll(pos.y, r.top, r.bottom) : 0;
      const dx = scroller.scrollWidth > scroller.clientWidth ? randScroll(pos.x, r.left, r.right) : 0;
      if (dx === 0 && dy === 0) return;
      const vorher = [scroller.scrollLeft, scroller.scrollTop];
      scroller.scrollLeft += dx;
      scroller.scrollTop += dy;
      if (scroller.scrollLeft === vorher[0] && scroller.scrollTop === vorher[1]) return; // am Ende angekommen
      zielSuchen();
      bild = requestAnimationFrame(scrollen);
    };

    const ziehenBeginnen = () => {
      phase = "zieht";
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add("ist-ziehen");
      geistZeigen();
      melden();
    };

    const bewegen = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      pos = { x: e.clientX, y: e.clientY };
      if (phase === "wartet") {
        const weg = Math.hypot(pos.x - start.x, pos.y - start.y);
        if (finger) {
          // Finger vor dem Greifen bewegt: Das ist Wischen, der Browser scrollt.
          if (weg > RUHIG_PX) beenden(false);
          return;
        }
        if (weg < MAUS_START_PX) return;
        ziehenBeginnen();
      } else if (phase === "gegriffen") {
        if (Math.hypot(pos.x - griffPunkt.x, pos.y - griffPunkt.y) <= RUHIG_PX) return;
        ziehenBeginnen();
      }
      geistBewegen();
      zielSuchen();
      if (!bild) bild = requestAnimationFrame(scrollen);
    };

    const loslassen = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      pos = { x: e.clientX, y: e.clientY };
      const war = phase;
      const abgelegt = ziel;
      beenden(war !== "wartet");
      if (war === "zieht" && abgelegt !== null) opt.current.onAblegen(quelle, abgelegt);
      else if (war === "gegriffen") opt.current.onLangDruck?.(quelle, pos.x, pos.y);
    };
    const abbrechen = (e: PointerEvent) => e.pointerId === id && beenden(false);
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || phase === "wartet") return;
      e.preventDefault();
      e.stopPropagation();
      beenden(false);
      // Die Taste ist noch gedrückt: Der Klick beim späteren Loslassen gehört noch zum abgebrochenen Ziehen.
      window.addEventListener("pointerup", klickSchlucken, { capture: true, once: true });
    };
    // Nach dem Greifen scrollt der Finger nicht mehr (nur möglich, solange der Browser noch nicht scrollt).
    const fingerBewegt = (e: TouchEvent) => {
      if (phase !== "wartet" && e.cancelable) e.preventDefault();
    };
    // Langes Drücken mit dem Finger: kein Menü von Android und keins der App (das kommt beim Loslassen ohne Bewegung).
    const kontextmenue = (e: Event) => {
      if (!finger) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const auswahl = (e: Event) => e.preventDefault();

    const beenden = (schlucken: boolean) => {
      clearTimeout(timer);
      clearTimeout(verweilen);
      if (bild) cancelAnimationFrame(bild);
      window.removeEventListener("pointermove", bewegen);
      window.removeEventListener("pointerup", loslassen);
      window.removeEventListener("pointercancel", abbrechen);
      window.removeEventListener("keydown", taste, true);
      window.removeEventListener("touchmove", fingerBewegt);
      window.removeEventListener("contextmenu", kontextmenue, true);
      window.removeEventListener("selectstart", auswahl, true);
      geist?.remove();
      document.documentElement.classList.remove("ist-ziehen");
      if (schlucken) klickSchlucken();
      phase = "wartet";
      lauf.current = null;
      setZustand(null);
    };

    window.addEventListener("pointermove", bewegen);
    window.addEventListener("pointerup", loslassen);
    window.addEventListener("pointercancel", abbrechen);
    window.addEventListener("keydown", taste, true);
    window.addEventListener("touchmove", fingerBewegt, { passive: false });
    window.addEventListener("contextmenu", kontextmenue, true);
    window.addEventListener("selectstart", auswahl, true);
    if (finger) {
      timer = setTimeout(() => {
        phase = "gegriffen";
        griffPunkt = pos;
        vibrieren();
        melden();
      }, GREIFEN_MS);
    }
    lauf.current = { beenden };
  }, []);

  /** Props für ein Element, das sich greifen lässt. */
  const griff = useCallback((quelle: Q) => ({ onPointerDown: (event: ReactPointerEvent<HTMLElement>) => starten(event, quelle) }), [starten]);
  return { zustand, griff };
}
