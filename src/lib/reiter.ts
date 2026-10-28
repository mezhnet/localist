// Reiter (PC): ein fester Reiter „Startseite“ und beliebig viele weitere mit je einer Seite, Datenbank, einem
// Notizbuch, der Seite „Bausteine“ oder einer Startseite (Strg+T). Hier steht nur die Logik ohne Oberfläche:
// öffnen, schließen, wechseln, Pfaden folgen (Umbenennen, Verschieben, Umwandeln, Löschen) und das Merken der
// offenen Reiter pro Vault im App-Speicher (Schlüssel „reiter:<Vault-Pfad>“, nicht im Vault).
import { isInside, movePath } from "./tree";

export type ReiterInhalt =
  | { art: "start" }
  | { art: "seite"; pfad: string }
  | { art: "datenbank"; pfad: string }
  | { art: "notizbuch"; pfad: string }
  | { art: "bausteine" };

/** Scrollposition eines Reiters: Inhaltsfläche, Code-Editor und Vorschau in „Geteilt“ (Pixel). */
export interface ReiterScroll {
  haupt: number;
  code?: number;
  vorschau?: number;
}

export interface Reiter {
  /** Bleibt für den Reiter gleich; 0 ist der feste Reiter „Startseite“. */
  id: number;
  inhalt: ReiterInhalt;
  /** Wechselt bei jedem neuen Inhalt (Schlüssel der Ansicht), bleibt beim Umbenennen gleich. */
  ansicht: number;
  /** Gerade angelegte Seite (Titel zum Eintippen markieren); gilt nur beim ersten Anzeigen. */
  neu?: boolean;
  /** Gemerkte Scrollposition, solange ein anderer Reiter aktiv ist. */
  scroll?: ReiterScroll;
}

export interface ReiterStand {
  reiter: Reiter[];
  /** id des aktiven Reiters */
  aktiv: number;
}

export const START_REITER = 0;

let naechsteId = 1;
let naechsteAnsicht = 1;

export function startStand(): ReiterStand {
  return { reiter: [{ id: START_REITER, inhalt: { art: "start" }, ansicht: 0 }], aktiv: START_REITER };
}

export function aktiverReiter(stand: ReiterStand): Reiter {
  return stand.reiter.find((reiter) => reiter.id === stand.aktiv) ?? stand.reiter[0];
}

export function istFest(reiter: Reiter): boolean {
  return reiter.id === START_REITER;
}

export function gleicherInhalt(a: ReiterInhalt, b: ReiterInhalt): boolean {
  return a.art === b.art && ("pfad" in a ? a.pfad : "") === ("pfad" in b ? b.pfad : "");
}

function neuerReiter(inhalt: ReiterInhalt, neu = false): Reiter {
  return { id: naechsteId++, inhalt, ansicht: naechsteAnsicht++, ...(neu ? { neu } : {}) };
}

export interface OeffnenOptionen {
  /** Strg+Klick oder Mittelklick: immer in einem neuen Reiter. */
  neuerReiter?: boolean;
  /** Ohne Reiterleiste (Handy): vom festen Reiter aus wird der zuletzt offene Reiter wiederverwendet. */
  ohneLeiste?: boolean;
  /** Gerade angelegte Seite. */
  neu?: boolean;
}

/**
 * Öffnet einen Inhalt. Normal im aktuellen Reiter; der feste Reiter „Startseite“ bleibt aber immer die
 * Startseite: Von dort aus wechselt ein Klick zu einem Reiter, der den Inhalt schon zeigt, oder öffnet einen neuen.
 */
export function oeffnen(stand: ReiterStand, inhalt: ReiterInhalt, optionen: OeffnenOptionen = {}): ReiterStand {
  const aktiv = aktiverReiter(stand);
  const index = stand.reiter.indexOf(aktiv);
  if (optionen.neuerReiter) {
    const reiter = neuerReiter(inhalt, optionen.neu);
    return { reiter: [...stand.reiter.slice(0, index + 1), reiter, ...stand.reiter.slice(index + 1)], aktiv: reiter.id };
  }
  if (istFest(aktiv)) {
    if (inhalt.art === "start") return stand;
    const vorhanden = stand.reiter.find((reiter) => !istFest(reiter) && gleicherInhalt(reiter.inhalt, inhalt));
    if (vorhanden && !optionen.neu) return { ...stand, aktiv: vorhanden.id };
    const letzter = stand.reiter[stand.reiter.length - 1];
    if (optionen.ohneLeiste && !istFest(letzter)) return ersetzen({ ...stand, aktiv: letzter.id }, letzter, inhalt, optionen.neu);
    const reiter = neuerReiter(inhalt, optionen.neu);
    return { reiter: [...stand.reiter, reiter], aktiv: reiter.id };
  }
  if (gleicherInhalt(aktiv.inhalt, inhalt) && !optionen.neu) return stand;
  return ersetzen(stand, aktiv, inhalt, optionen.neu);
}

function ersetzen(stand: ReiterStand, alt: Reiter, inhalt: ReiterInhalt, neu = false): ReiterStand {
  const reiter: Reiter = { id: alt.id, inhalt, ansicht: naechsteAnsicht++, ...(neu ? { neu } : {}) };
  return { ...stand, reiter: stand.reiter.map((r) => (r === alt ? reiter : r)) };
}

/** Strg+T und „+“: neuer Reiter mit der Startseite am Ende. */
export function neuerStartReiter(stand: ReiterStand): ReiterStand {
  const reiter = neuerReiter({ art: "start" });
  return { reiter: [...stand.reiter, reiter], aktiv: reiter.id };
}

export function aktivieren(stand: ReiterStand, id: number): ReiterStand {
  return stand.reiter.some((reiter) => reiter.id === id) ? { ...stand, aktiv: id } : stand;
}

/** Schließt einen Reiter (nie den festen). War er aktiv, wird der rechte Nachbar aktiv, am Ende der linke. */
export function schliessen(stand: ReiterStand, id: number): ReiterStand {
  const index = stand.reiter.findIndex((reiter) => reiter.id === id);
  if (index < 0 || istFest(stand.reiter[index])) return stand;
  const reiter = stand.reiter.filter((r) => r.id !== id);
  if (stand.aktiv !== id) return { ...stand, reiter };
  return { reiter, aktiv: (reiter[index] ?? reiter[index - 1]).id };
}

/** Strg+Tab (+1) und Strg+Umschalt+Tab (−1): reihum, auch über den festen Reiter. */
export function wechseln(stand: ReiterStand, richtung: 1 | -1): ReiterStand {
  const index = stand.reiter.indexOf(aktiverReiter(stand));
  const ziel = stand.reiter[(index + richtung + stand.reiter.length) % stand.reiter.length];
  return { ...stand, aktiv: ziel.id };
}

/** Umbenennen, Verschieben und Umwandeln: Reiter mit dem Pfad (oder darin) zeigen danach auf den neuen Pfad. */
export function pfadeFolgen(stand: ReiterStand, alt: string, neu: string): ReiterStand {
  let geaendert = false;
  const reiter = stand.reiter.map((r) => {
    if (!("pfad" in r.inhalt) || !isInside(r.inhalt.pfad, alt)) return r;
    geaendert = true;
    return { ...r, inhalt: { ...r.inhalt, pfad: movePath(r.inhalt.pfad, alt, neu) } };
  });
  return geaendert ? { ...stand, reiter } : stand;
}

/** Schließt alle Reiter, deren Inhalt `weg` meldet (z. B. gelöscht). Der feste Reiter bleibt immer. */
export function entfernen(stand: ReiterStand, weg: (inhalt: ReiterInhalt) => boolean): ReiterStand {
  let neu = stand;
  for (const reiter of stand.reiter) if (!istFest(reiter) && weg(reiter.inhalt)) neu = schliessen(neu, reiter.id);
  return neu;
}

/** Merkt die Scrollposition eines Reiters bzw. nimmt die Markierung „neu“ weg (nach dem ersten Anzeigen). */
export function verlassen(stand: ReiterStand, id: number, scroll: ReiterScroll): ReiterStand {
  return { ...stand, reiter: stand.reiter.map((r) => (r.id === id ? { id: r.id, inhalt: r.inhalt, ansicht: r.ansicht, scroll } : r)) };
}

// ---------- Merken pro Vault ----------

const SCHLUESSEL = "reiter:";
const MAX_REITER = 50;

interface Gemerkt {
  reiter: ReiterInhalt[];
  /** Index des aktiven Reiters in `reiter`, −1 = fester Reiter „Startseite“ */
  aktiv: number;
}

function gueltigerInhalt(wert: unknown): ReiterInhalt | null {
  if (wert === null || typeof wert !== "object") return null;
  const inhalt = wert as Record<string, unknown>;
  if (inhalt.art === "start" || inhalt.art === "bausteine") return { art: inhalt.art };
  if ((inhalt.art === "seite" || inhalt.art === "datenbank" || inhalt.art === "notizbuch") && typeof inhalt.pfad === "string" && inhalt.pfad !== "") {
    return { art: inhalt.art, pfad: inhalt.pfad };
  }
  return null;
}

export function reiterLaden(vault: string): ReiterStand {
  const stand = startStand();
  let gemerkt: Gemerkt;
  try {
    gemerkt = JSON.parse(localStorage.getItem(SCHLUESSEL + vault) ?? "null") as Gemerkt;
  } catch {
    return stand;
  }
  if (!gemerkt || !Array.isArray(gemerkt.reiter)) return stand;
  for (const wert of gemerkt.reiter.slice(0, MAX_REITER)) {
    const inhalt = gueltigerInhalt(wert);
    if (inhalt) stand.reiter.push(neuerReiter(inhalt));
    else stand.reiter.push({ id: -1, inhalt: { art: "start" }, ansicht: -1 }); // Platzhalter, damit der Index stimmt
  }
  const aktiv = typeof gemerkt.aktiv === "number" ? stand.reiter[gemerkt.aktiv + 1] : undefined;
  return { reiter: stand.reiter.filter((r) => r.id !== -1), aktiv: aktiv && aktiv.id !== -1 ? aktiv.id : START_REITER };
}

export function reiterMerken(vault: string, stand: ReiterStand): void {
  const offen = stand.reiter.filter((reiter) => !istFest(reiter));
  const gemerkt: Gemerkt = { reiter: offen.map((reiter) => reiter.inhalt), aktiv: offen.findIndex((reiter) => reiter.id === stand.aktiv) };
  try {
    localStorage.setItem(SCHLUESSEL + vault, JSON.stringify(gemerkt));
  } catch {
    // ohne App-Speicher gelten die Reiter bis zum Neustart
  }
}
