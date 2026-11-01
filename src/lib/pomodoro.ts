// Pomodoro (Etappe 23): die Logik ohne Oberfläche und ohne Nebenwirkungen. Gerechnet wird immer mit dem
// Endzeitpunkt (`ende`, Millisekunden seit 1970), nie durch Zählen von Sekunden: So stimmt die Restzeit auch nach
// Minimieren, Ruhezustand oder wenn Android die App im Hintergrund anhält. Der Zustand mit Speichern, Zeitgebern,
// Benachrichtigungen und Ton steht in src/lib/pomodoro-timer.ts.
import type { VaultSettings } from "./settings";

export type Phase = "fokus" | "kurz" | "lang";
export type Lauf = "bereit" | "laeuft" | "pausiert";

/** Einstellungen in `.localist/settings.json` unter `pomodoro`; Dauern in Minuten. */
export interface PomodoroEinstellungen {
  fokus: number;
  kurz: number;
  lang: number;
  /** Nach so vielen Fokus-Runden kommt die lange Pause. */
  runden: number;
  pausenAuto: boolean;
  fokusAuto: boolean;
  ton: boolean;
}

export const STANDARD_EINSTELLUNGEN: PomodoroEinstellungen = { fokus: 25, kurz: 5, lang: 15, runden: 4, pausenAuto: false, fokusAuto: false, ton: true };

/** Erlaubte Werte (ganze Zahlen) für die Eingabefelder und beim Lesen der Datei. */
export const GRENZEN = { fokus: [1, 120], kurz: [1, 60], lang: [1, 60], runden: [1, 12] } as const;

export const EINSTELLUNGEN_SCHLUESSEL = "pomodoro";

export function begrenzen(feld: keyof typeof GRENZEN, wert: unknown): number {
  const [min, max] = GRENZEN[feld];
  const zahl = typeof wert === "number" ? wert : typeof wert === "string" ? Number(wert) : Number.NaN;
  if (!Number.isFinite(zahl)) return STANDARD_EINSTELLUNGEN[feld];
  return Math.min(max, Math.max(min, Math.round(zahl)));
}

export function einstellungenLesen(settings: VaultSettings): PomodoroEinstellungen {
  const roh = settings[EINSTELLUNGEN_SCHLUESSEL];
  const werte = roh !== null && typeof roh === "object" && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
  const schalter = (name: "pausenAuto" | "fokusAuto" | "ton") => (typeof werte[name] === "boolean" ? (werte[name] as boolean) : STANDARD_EINSTELLUNGEN[name]);
  return {
    fokus: werte.fokus === undefined ? STANDARD_EINSTELLUNGEN.fokus : begrenzen("fokus", werte.fokus),
    kurz: werte.kurz === undefined ? STANDARD_EINSTELLUNGEN.kurz : begrenzen("kurz", werte.kurz),
    lang: werte.lang === undefined ? STANDARD_EINSTELLUNGEN.lang : begrenzen("lang", werte.lang),
    runden: werte.runden === undefined ? STANDARD_EINSTELLUNGEN.runden : begrenzen("runden", werte.runden),
    pausenAuto: schalter("pausenAuto"),
    fokusAuto: schalter("fokusAuto"),
    ton: schalter("ton"),
  };
}

/** Schreibt die Einstellungen unter `pomodoro`; andere Felder dort bleiben erhalten. */
export function mitEinstellungen(settings: VaultSettings, einstellungen: PomodoroEinstellungen): VaultSettings {
  const roh = settings[EINSTELLUNGEN_SCHLUESSEL];
  const alt = roh !== null && typeof roh === "object" && !Array.isArray(roh) ? roh : {};
  return { ...settings, [EINSTELLUNGEN_SCHLUESSEL]: { ...alt, ...einstellungen } };
}

export interface Timer {
  phase: Phase;
  /** Laufende bzw. (in der Pause) zuletzt beendete Fokus-Runde, ab 1. */
  runde: number;
  lauf: Lauf;
  /** Endzeitpunkt, solange der Timer läuft. */
  ende: number | null;
  /** Restzeit in Millisekunden, solange er nicht läuft. */
  rest: number;
  /** Volle Dauer der Phase in Millisekunden (für den Ring). */
  dauer: number;
  /** Erster Start der Fokus-Phase (für den Verlauf), sonst null. */
  start: number | null;
  /** „Woran arbeitest du?“ */
  ziel: string;
  /** Feste id der verknüpften Seite (nicht der Pfad). */
  seite: string | null;
}

/** Eine beendete oder abgebrochene Fokus-Session, wie sie im Verlauf steht. */
export interface Session {
  id: string;
  /** Lokale Zeit `YYYY-MM-DDTHH:MM`. */
  start: string;
  ende: string;
  minuten: number;
  ziel: string;
  seite: string | null;
  abgebrochen: boolean;
}

export const MINUTE = 60_000;

export const PHASEN_NAME: Record<Phase, string> = { fokus: "Fokus", kurz: "Kurze Pause", lang: "Lange Pause" };

export function dauerVon(phase: Phase, einstellungen: PomodoroEinstellungen): number {
  return einstellungen[phase] * MINUTE;
}

export function neuerTimer(einstellungen: PomodoroEinstellungen, ziel = "", seite: string | null = null): Timer {
  const dauer = dauerVon("fokus", einstellungen);
  return { phase: "fokus", runde: 1, lauf: "bereit", ende: null, rest: dauer, dauer, start: null, ziel, seite };
}

export function restzeit(timer: Timer, jetzt: number): number {
  return timer.lauf === "laeuft" && timer.ende !== null ? Math.max(0, timer.ende - jetzt) : timer.rest;
}

/** „24:59“ bzw. „1:05:00“ ab einer Stunde; angefangene Sekunden zählen voll. */
export function zeitText(ms: number): string {
  const sekunden = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = sekunden % 60;
  const zwei = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${zwei(m)}:${zwei(s)}` : `${zwei(m)}:${zwei(s)}`;
}

/** Was nach einer Phase kommt: nach dem Fokus eine Pause (lang nach `runden` Runden), nach einer Pause der nächste Fokus. */
export function naechstePhase(timer: Pick<Timer, "phase" | "runde">, einstellungen: PomodoroEinstellungen): { phase: Phase; runde: number } {
  if (timer.phase === "fokus") return { phase: timer.runde >= einstellungen.runden ? "lang" : "kurz", runde: timer.runde };
  return { phase: "fokus", runde: timer.phase === "lang" ? 1 : timer.runde + 1 };
}

/** Text der Benachrichtigung am Ende von `timer` (wird beim Start der Phase geplant). */
export function endeText(timer: Pick<Timer, "phase" | "runde">, einstellungen: PomodoroEinstellungen): { titel: string; text: string } {
  const weiter = naechstePhase(timer, einstellungen);
  if (timer.phase === "fokus") {
    const pause = weiter.phase === "lang" ? `${einstellungen.lang} Minuten lange Pause` : `${einstellungen.kurz} Minuten Pause`;
    return { titel: "Pomodoro", text: `Fokus geschafft – Zeit für ${pause}` };
  }
  return { titel: "Pomodoro", text: `Pause vorbei – weiter mit Runde ${weiter.runde} von ${einstellungen.runden}` };
}

export function starten(timer: Timer, jetzt: number): Timer {
  if (timer.lauf === "laeuft") return timer;
  return { ...timer, lauf: "laeuft", ende: jetzt + timer.rest, start: timer.phase === "fokus" ? (timer.start ?? jetzt) : null };
}

export function pausieren(timer: Timer, jetzt: number): Timer {
  if (timer.lauf !== "laeuft") return timer;
  return { ...timer, lauf: "pausiert", rest: restzeit(timer, jetzt), ende: null };
}

/** Ergebnis eines Schritts: neuer Timer, zu speichernde Sessions und die Phasen, die gerade regulär zu Ende gingen. */
export interface Schritt {
  timer: Timer;
  sessions: Session[];
  beendet: { phase: Phase; ende: number }[];
}

/** Lokale Zeit als `YYYY-MM-DDTHH:MM`. */
export function lokaleZeit(ms: number): string {
  const d = new Date(ms);
  const zwei = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

function neueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function session(timer: Timer, ende: number, verbraucht: number, abgebrochen: boolean): Session {
  return {
    id: neueId(),
    start: lokaleZeit(timer.start ?? ende - verbraucht),
    ende: lokaleZeit(ende),
    minuten: Math.round(verbraucht / MINUTE),
    ziel: timer.ziel.trim(),
    seite: timer.seite,
    abgebrochen,
  };
}

/** Wechselt zur Phase nach `timer`; sie startet bei `ab` von selbst, wenn der passende Schalter an ist. */
function weiter(timer: Timer, einstellungen: PomodoroEinstellungen, ab: number): Timer {
  const next = naechstePhase(timer, einstellungen);
  const dauer = dauerVon(next.phase, einstellungen);
  const auto = next.phase === "fokus" ? einstellungen.fokusAuto : einstellungen.pausenAuto;
  const basis: Timer = { ...timer, phase: next.phase, runde: next.runde, lauf: "bereit", ende: null, rest: dauer, dauer, start: null };
  return auto ? starten(basis, ab) : basis;
}

/** Höchstens so viele Phasen holt `ablaufen` auf einmal nach (z. B. nach langem Ruhezustand mit automatischem Start). */
const MAX_NACHHOLEN = 48;

/**
 * Schließt alle Phasen ab, deren Endzeitpunkt erreicht ist. Eine automatisch gestartete Folgephase beginnt genau
 * am Ende der vorigen, nicht erst jetzt – so stimmt die Zeit auch, wenn Localist gerade erst wieder läuft.
 */
export function ablaufen(timer: Timer, einstellungen: PomodoroEinstellungen, jetzt: number): Schritt {
  const sessions: Session[] = [];
  const beendet: Schritt["beendet"] = [];
  let t = timer;
  for (let i = 0; i < MAX_NACHHOLEN && t.lauf === "laeuft" && t.ende !== null && t.ende <= jetzt; i++) {
    const ende = t.ende;
    if (t.phase === "fokus") sessions.push(session(t, ende, t.dauer, false));
    beendet.push({ phase: t.phase, ende });
    t = weiter(t, einstellungen, ende);
  }
  return { timer: t, sessions, beendet };
}

/** Eine angefangene Fokus-Phase wird als abgebrochen gespeichert. */
function abbruch(timer: Timer, jetzt: number): Session[] {
  if (timer.phase !== "fokus" || timer.start === null) return [];
  return [session(timer, jetzt, timer.dauer - restzeit(timer, jetzt), true)];
}

/** Überspringen: zur nächsten Phase (startet nur, wenn der passende Schalter an ist). */
export function ueberspringen(timer: Timer, einstellungen: PomodoroEinstellungen, jetzt: number): Schritt {
  return { timer: weiter(timer, einstellungen, jetzt), sessions: abbruch(timer, jetzt), beendet: [] };
}

/** Zurücksetzen: alles auf Anfang (Fokus, Runde 1, nicht gestartet); Ziel und Seite bleiben. */
export function zuruecksetzen(timer: Timer, einstellungen: PomodoroEinstellungen, jetzt: number): Schritt {
  return { timer: neuerTimer(einstellungen, timer.ziel, timer.seite), sessions: abbruch(timer, jetzt), beendet: [] };
}

/** Neue Einstellungen: Eine noch nicht gestartete Phase bekommt sofort die neue Dauer, eine laufende behält ihre. */
export function einstellungenAnwenden(timer: Timer, einstellungen: PomodoroEinstellungen): Timer {
  if (timer.lauf !== "bereit") return timer;
  const dauer = dauerVon(timer.phase, einstellungen);
  return timer.rest === dauer && timer.dauer === dauer ? timer : { ...timer, rest: dauer, dauer };
}

/** Liest einen gespeicherten Timer (App-Speicher); Unbrauchbares ergibt null. */
export function timerPruefen(wert: unknown): Timer | null {
  if (wert === null || typeof wert !== "object") return null;
  const t = wert as Record<string, unknown>;
  const zahl = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (t.phase !== "fokus" && t.phase !== "kurz" && t.phase !== "lang") return null;
  if (t.lauf !== "bereit" && t.lauf !== "laeuft" && t.lauf !== "pausiert") return null;
  if (!zahl(t.runde) || !zahl(t.rest) || !zahl(t.dauer) || (t.runde as number) < 1) return null;
  if (t.lauf === "laeuft" && !zahl(t.ende)) return null;
  return {
    phase: t.phase,
    runde: Math.round(t.runde as number),
    lauf: t.lauf,
    ende: t.lauf === "laeuft" ? (t.ende as number) : null,
    rest: Math.max(0, t.rest as number),
    dauer: Math.max(1, t.dauer as number),
    start: zahl(t.start) ? (t.start as number) : null,
    ziel: typeof t.ziel === "string" ? t.ziel : "",
    seite: typeof t.seite === "string" && t.seite !== "" ? t.seite : null,
  };
}

// ---------- Verlauf in `.localist/pomodoro/YYYY-MM.jsonl` ----------

export const VERLAUF_ORDNER = ".localist/pomodoro";

/** Monat einer Session (`YYYY-MM`, nach ihrem Start). */
export function monatVon(lokal: string): string {
  return lokal.slice(0, 7);
}

export function verlaufDatei(monat: string): string {
  return `${VERLAUF_ORDNER}/${monat}.jsonl`;
}

/** Eine Zeile der Datei, Felder in fester Reihenfolge. */
export function sessionZeile(s: Session): string {
  return JSON.stringify({ id: s.id, start: s.start, ende: s.ende, minuten: s.minuten, ziel: s.ziel, seite: s.seite, abgebrochen: s.abgebrochen });
}

const LOKAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Liest eine Monatsdatei. Kaputte Zeilen werden übersprungen (die Datei bleibt, wie sie ist). */
export function verlaufLesen(text: string): Session[] {
  const sessions: Session[] = [];
  for (const zeile of text.split(/\r?\n/)) {
    if (!zeile.trim()) continue;
    let wert: unknown;
    try {
      wert = JSON.parse(zeile);
    } catch {
      continue;
    }
    if (wert === null || typeof wert !== "object" || Array.isArray(wert)) continue;
    const s = wert as Record<string, unknown>;
    if (typeof s.start !== "string" || !LOKAL.test(s.start) || typeof s.ende !== "string" || !LOKAL.test(s.ende)) continue;
    if (typeof s.minuten !== "number" || !Number.isFinite(s.minuten) || s.minuten < 0) continue;
    sessions.push({
      id: typeof s.id === "string" ? s.id : `${s.start}/${s.ende}`,
      start: s.start,
      ende: s.ende,
      minuten: s.minuten,
      ziel: typeof s.ziel === "string" ? s.ziel : "",
      seite: typeof s.seite === "string" && s.seite !== "" ? s.seite : null,
      abgebrochen: s.abgebrochen === true,
    });
  }
  return sessions;
}

/** Beginn der Woche (Montag 00:00, lokale Zeit) als `YYYY-MM-DD`. */
export function wochenanfang(jetzt: number): string {
  const d = new Date(jetzt);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return lokaleZeit(d.getTime()).slice(0, 10);
}

/** Welche Monatsdateien „Heute“ und „Diese Woche“ brauchen (eine Session liegt im Monat ihres Starts). */
export function zuLesendeMonate(jetzt: number): string[] {
  const monate = new Set([wochenanfang(jetzt).slice(0, 7), lokaleZeit(jetzt - 3 * 60 * MINUTE).slice(0, 7), lokaleZeit(jetzt).slice(0, 7)]);
  return [...monate].sort();
}

export interface Uebersicht {
  heute: Session[];
  heuteMinuten: number;
  wocheMinuten: number;
}

/** „Heute“ (nach dem Ende der Session) und „Diese Woche“ (ab Montag); doppelte ids zählen einmal. */
export function uebersicht(sessions: readonly Session[], jetzt: number): Uebersicht {
  const tag = lokaleZeit(jetzt).slice(0, 10);
  const woche = wochenanfang(jetzt);
  const gesehen = new Set<string>();
  const eindeutig = sessions.filter((s) => !gesehen.has(s.id) && gesehen.add(s.id));
  const heute = eindeutig.filter((s) => s.ende.slice(0, 10) === tag).sort((a, b) => a.ende.localeCompare(b.ende));
  const summe = (liste: readonly Session[]) => liste.reduce((n, s) => n + s.minuten, 0);
  return { heute, heuteMinuten: summe(heute), wocheMinuten: summe(eindeutig.filter((s) => s.ende.slice(0, 10) >= woche && s.ende.slice(0, 10) <= tag)) };
}
