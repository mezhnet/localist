// Scrollposition pro Reiter: Workspace merkt sich beim Verlassen eines Reiters, wie weit Inhaltsfläche,
// Code-Editor und Vorschau („Geteilt“) gescrollt waren, und stellt es beim Zurückkehren wieder her. Code-Editor und
// Vorschau melden ihre Position über diesen Kontext und lesen dort ihre Anfangsposition.
import { createContext } from "react";
import type { ReiterScroll } from "./reiter";

export interface ScrollGedaechtnis {
  /** Gemerkte Position des Reiters beim Öffnen der Ansicht (fehlt: oben anfangen). */
  anfang: ReiterScroll | undefined;
  merken: (teil: Omit<Partial<ReiterScroll>, "haupt">) => void;
}

export const ScrollGedaechtnisContext = createContext<ScrollGedaechtnis>({ anfang: undefined, merken: () => {} });

/** So lange wartet die Wiederherstellung höchstens darauf, dass der Inhalt hoch genug geladen ist. */
const WARTEN_MS = 2000;
/** Erreicht ist die Position erst, wenn sie so viele Bilder lang hält (der Inhalt wächst oft noch). */
const STABIL_BILDER = 8;

/**
 * Scrollt `element` auf `ziel`, sobald der Inhalt hoch genug ist (Seiten laden nach dem Öffnen nach). Scrollt der
 * Nutzer selbst, klickt oder tippt, hört es sofort auf. Liefert eine Funktion zum Abbrechen.
 */
export function scrollWiederherstellen(element: HTMLElement, ziel: number, wartenMs = WARTEN_MS): () => void {
  if (!(ziel > 0)) return () => {};
  let vorbei = false;
  let stabil = 0;
  const ende = Date.now() + wartenMs;
  const ereignisse = ["wheel", "pointerdown", "keydown", "touchstart"] as const;
  const abbrechen = () => {
    vorbei = true;
    for (const name of ereignisse) element.removeEventListener(name, abbrechen);
  };
  for (const name of ereignisse) element.addEventListener(name, abbrechen, { passive: true });
  const schritt = () => {
    if (vorbei) return;
    const moeglich = element.scrollHeight - element.clientHeight;
    if (Math.abs(element.scrollTop - Math.min(ziel, moeglich)) > 1) element.scrollTop = Math.min(ziel, moeglich);
    stabil = moeglich >= ziel - 1 ? stabil + 1 : 0;
    if (stabil >= STABIL_BILDER || Date.now() > ende) abbrechen();
    else requestAnimationFrame(schritt);
  };
  schritt();
  return abbrechen;
}
