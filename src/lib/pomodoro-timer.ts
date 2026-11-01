// Der laufende Pomodoro-Timer für die ganze App (Etappe 23). Er lebt außerhalb jeder Ansicht: Seiten- und
// Reiterwechsel oder das Schließen der Ansicht „Pomodoro“ halten ihn nicht an. Die Logik steht in pomodoro.ts;
// hier kommen Speichern im App-Speicher (Neustart), Zeitgeber, Benachrichtigungen, Ton und Verlauf dazu.
// - Gerechnet wird mit dem Endzeitpunkt. Der Takt (250 ms) ist nur für die Anzeige und zum Nachsehen da; dazu kommt
//   ein einzelner Zeitgeber genau auf das Ende und ein Blick beim Zurückkehren in die App.
// - Die Benachrichtigung für das Ende wird beim Start einer Phase geplant. Pausieren, Überspringen und Zurücksetzen
//   brechen sie ab, Fortsetzen plant neu. Endet eine Phase regulär, bleibt sie stehen (sie kommt ja gerade).
// - Fokus-Sessions warten im App-Speicher, bis sie im Vault stehen; ein Schreibfehler verliert nichts.
import { useSyncExternalStore } from "react";
import * as benachrichtigungen from "./benachrichtigungen";
import {
  ablaufen,
  einstellungenAnwenden,
  endeText,
  neuerTimer,
  pausieren as pausierenLogik,
  STANDARD_EINSTELLUNGEN,
  starten as startenLogik,
  timerPruefen,
  ueberspringen as ueberspringenLogik,
  zuruecksetzen as zuruecksetzenLogik,
  type Phase,
  type PomodoroEinstellungen,
  type Schritt,
  type Session,
  type Timer,
} from "./pomodoro";
import { tonSpielen, tonVorbereiten } from "./ton";
import { jetzt as uhrJetzt } from "./uhr";

export const SPEICHER_SCHLUESSEL = "localist-pomodoro";
/** Feste ids der Benachrichtigungen: Fokus und Pausen wechseln sich ab, so stört eine neue Planung nie die alte. */
export const BENACHRICHTIGUNG_ID: Record<Phase, number> = { fokus: 2301, kurz: 2302, lang: 2302 };
/** Nur ein Ende, das höchstens so lange her ist, bekommt noch den Ton (nicht nach einem Neustart Stunden später). */
const FRISCH_MS = 2 * 60_000;
const TAKT_MS = 250;

export interface PomodoroStand {
  timer: Timer;
  einstellungen: PomodoroEinstellungen;
  jetzt: number;
  /** Steigt, wenn eine Session in den Vault geschrieben wurde („Heute“ neu laden). */
  verlauf: number;
}

interface OffeneSession {
  session: Session;
  /** Vault, in dem die Session entstand (null: der nächste, der sich anmeldet). */
  vault: string | null;
}

export interface Anmeldung {
  vault: string;
  einstellungen: PomodoroEinstellungen;
  /** Schreibt eine Session in den Verlauf des Vaults. */
  schreiben: (session: Session) => Promise<void>;
  /** Vor dem Start (z. B. Erlaubnis für Benachrichtigungen erfragen); Fehler halten den Timer nicht auf. */
  vorStart?: () => Promise<void>;
  onFehler?: (text: string) => void;
}

export interface Abhaengigkeiten {
  speicher?: Pick<Storage, "getItem" | "setItem">;
  uhr?: () => number;
  planen?: typeof benachrichtigungen.planen;
  abbrechen?: typeof benachrichtigungen.abbrechen;
  ton?: () => void;
}

export type PomodoroSpeicher = ReturnType<typeof pomodoroErzeugen>;

export function pomodoroErzeugen(abh: Abhaengigkeiten = {}) {
  const speicher = abh.speicher ?? globalThis.localStorage;
  const uhr = abh.uhr ?? uhrJetzt;
  const planen = abh.planen ?? benachrichtigungen.planen;
  const abbrechen = abh.abbrechen ?? benachrichtigungen.abbrechen;
  const ton = abh.ton ?? tonSpielen;

  let einstellungen = STANDARD_EINSTELLUNGEN;
  let timer = neuerTimer(einstellungen);
  let offen: OffeneSession[] = [];
  let anmeldung: Anmeldung | null = null;
  /** Die Einstellungen eines Vaults sind bekannt (erste Anmeldung); vorher wird nichts abgeschlossen. */
  let eingestellt = false;
  let verlauf = 0;
  let stand: PomodoroStand;
  const hoerer = new Set<() => void>();
  let takt: ReturnType<typeof setInterval> | undefined;
  let endeZeitgeber: ReturnType<typeof setTimeout> | undefined;
  let schreibKette: Promise<void> = Promise.resolve();
  let startetGerade = false;

  // Gespeicherten Stand übernehmen (Neustart von Localist). Abgelaufenes wird erst mit der Anmeldung abgeschlossen,
  // wenn die Einstellungen des Vaults bekannt sind.
  try {
    const roh = JSON.parse(speicher?.getItem(SPEICHER_SCHLUESSEL) ?? "null") as { timer?: unknown; offen?: unknown } | null;
    timer = timerPruefen(roh?.timer) ?? timer;
    if (Array.isArray(roh?.offen)) {
      offen = roh.offen.filter(
        (o): o is OffeneSession => o !== null && typeof o === "object" && typeof o.session?.start === "string" && (typeof o.vault === "string" || o.vault === null),
      );
    }
  } catch {
    // unlesbar: neu anfangen
  }

  const schnappschuss = () => {
    stand = { timer, einstellungen, jetzt: uhr(), verlauf };
  };
  schnappschuss();

  const melden = () => {
    schnappschuss();
    for (const hoerer1 of [...hoerer]) hoerer1();
  };

  const speichern = () => {
    try {
      speicher?.setItem(SPEICHER_SCHLUESSEL, JSON.stringify({ timer, offen }));
    } catch {
      // ohne App-Speicher gilt der Timer bis zum Neustart
    }
  };

  const planeEnde = (t: Timer) => {
    if (t.lauf !== "laeuft" || t.ende === null) return;
    const { titel, text } = endeText(t, einstellungen);
    void planen(BENACHRICHTIGUNG_ID[t.phase], t.ende, titel, text);
  };

  const zeitgeberStellen = () => {
    clearTimeout(endeZeitgeber);
    endeZeitgeber = undefined;
    if (timer.lauf !== "laeuft" || timer.ende === null) {
      clearInterval(takt);
      takt = undefined;
      return;
    }
    takt ??= setInterval(() => {
      if (!pruefen()) melden();
    }, TAKT_MS);
    endeZeitgeber = setTimeout(() => pruefen(), Math.max(0, timer.ende - uhr()) + 5);
  };

  const schreibenVersuchen = () => {
    schreibKette = schreibKette.then(async () => {
      let geschrieben = false;
      while (anmeldung) {
        const aktuell = anmeldung;
        const naechste = offen.find((o) => o.vault === null || o.vault === aktuell.vault);
        if (!naechste) break;
        try {
          await aktuell.schreiben(naechste.session);
        } catch (error) {
          aktuell.onFehler?.(`Die Pomodoro-Session konnte nicht gespeichert werden und wird später erneut versucht: ${error instanceof Error ? error.message : String(error)}`);
          break;
        }
        offen = offen.filter((o) => o !== naechste);
        geschrieben = true;
        speichern();
      }
      if (geschrieben) {
        verlauf++;
        melden();
      }
    });
    return schreibKette;
  };

  /** Übernimmt einen Schritt der Logik: Sessions merken, Zustand speichern, Zeitgeber stellen, melden. */
  const uebernehmen = (schritt: Schritt) => {
    timer = schritt.timer;
    if (schritt.sessions.length > 0) {
      offen = [...offen, ...schritt.sessions.map((session) => ({ session, vault: anmeldung?.vault ?? null }))];
    }
    speichern();
    zeitgeberStellen();
    melden();
    if (schritt.sessions.length > 0) void schreibenVersuchen();
  };

  /** Schließt abgelaufene Phasen ab; `true`, wenn sich etwas geändert hat. */
  function pruefen(): boolean {
    // Vor der ersten Anmeldung gelten noch die Standardwerte: Phasenfolge und automatischer Start kämen sonst aus
    // ihnen statt aus dem Vault (z. B. beim ersten Fokus des Fensters nach einem Neustart).
    if (!eingestellt) return false;
    const jetzt = uhr();
    const schritt = ablaufen(timer, einstellungen, jetzt);
    if (schritt.beendet.length === 0) return false;
    uebernehmen(schritt);
    if (einstellungen.ton && schritt.beendet.some((b) => jetzt - b.ende < FRISCH_MS)) ton();
    // Automatisch gestartete Folgephase: ihr Ende planen.
    planeEnde(timer);
    return true;
  }

  const sichtbar = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (!pruefen()) melden();
  };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", sichtbar);
  if (typeof window !== "undefined") window.addEventListener("focus", sichtbar);

  const nutzerSchritt = (schritt: Schritt) => {
    const alt = timer;
    if (alt.lauf === "laeuft") void abbrechen(BENACHRICHTIGUNG_ID[alt.phase]);
    uebernehmen(schritt);
    planeEnde(timer);
  };

  return {
    stand: () => stand,
    abonnieren(hoerer1: () => void) {
      hoerer.add(hoerer1);
      return () => hoerer.delete(hoerer1);
    },

    /** Der Vault ist offen und seine Einstellungen sind gelesen: Abgelaufenes abschließen, Offenes schreiben. */
    anmelden(neu: Anmeldung) {
      anmeldung = neu;
      einstellungen = neu.einstellungen;
      eingestellt = true;
      timer = einstellungenAnwenden(timer, einstellungen);
      if (!pruefen()) {
        speichern();
        zeitgeberStellen();
        melden();
        // Nach einem Neustart am PC ist die geplante Benachrichtigung weg (der Thread lief in der alten App): neu planen.
        planeEnde(timer);
      }
      return schreibenVersuchen();
    },
    abmelden(vault: string) {
      if (anmeldung?.vault === vault) anmeldung = null;
    },
    einstellungenSetzen(neu: PomodoroEinstellungen) {
      if (JSON.stringify(neu) === JSON.stringify(einstellungen)) return;
      einstellungen = neu;
      timer = einstellungenAnwenden(timer, einstellungen);
      speichern();
      melden();
    },

    async starten() {
      if (timer.lauf === "laeuft" || startetGerade) return;
      tonVorbereiten();
      startetGerade = true;
      try {
        await anmeldung?.vorStart?.();
      } catch {
        // Der Timer läuft auch ohne Erlaubnis für Benachrichtigungen.
      } finally {
        startetGerade = false;
      }
      // Während der Frage kann der Timer schon gestartet worden sein (z. B. Leertaste und Klick).
      if ((timer as Timer).lauf === "laeuft") return;
      nutzerSchritt({ timer: startenLogik(timer, uhr()), sessions: [], beendet: [] });
    },
    pausieren() {
      if (pruefen() || timer.lauf !== "laeuft") return;
      nutzerSchritt({ timer: pausierenLogik(timer, uhr()), sessions: [], beendet: [] });
    },
    /** Leertaste und Knopf im Mini-Timer: starten, pausieren oder fortsetzen. */
    umschalten() {
      if (timer.lauf === "laeuft") this.pausieren();
      else void this.starten();
    },
    ueberspringen() {
      // Gerade abgelaufen (Anzeige 00:00, Takt noch nicht da): Das zählt als beendet, nicht auch noch überspringen.
      if (pruefen()) return;
      nutzerSchritt(ueberspringenLogik(timer, einstellungen, uhr()));
    },
    zuruecksetzen() {
      pruefen();
      nutzerSchritt(zuruecksetzenLogik(timer, einstellungen, uhr()));
    },
    zielSetzen(ziel: string) {
      timer = { ...timer, ziel };
      speichern();
      melden();
    },
    seiteSetzen(seite: string | null) {
      timer = { ...timer, seite };
      speichern();
      melden();
    },
    pruefen,
    /** Nur für Tests: Zeitgeber und Ereignisse abbauen. */
    beenden() {
      clearInterval(takt);
      clearTimeout(endeZeitgeber);
      takt = undefined;
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", sichtbar);
      if (typeof window !== "undefined") window.removeEventListener("focus", sichtbar);
      return schreibKette;
    },
  };
}

/** Der eine Timer der App. */
export let pomodoro = pomodoroErzeugen();

/** Nur für Tests: frischen Timer (z. B. nach localStorage.clear()). */
export function pomodoroNeu(abh?: Abhaengigkeiten): PomodoroSpeicher {
  void pomodoro.beenden();
  pomodoro = pomodoroErzeugen(abh);
  return pomodoro;
}

/** Ganzer Stand (Ansicht „Pomodoro“, Mini-Timer). Ändert sich im Takt, solange der Timer läuft. */
export function usePomodoro(): PomodoroStand {
  return useSyncExternalStore(
    (hoerer) => pomodoro.abonnieren(hoerer),
    () => pomodoro.stand(),
  );
}

/** Nur ein Ausschnitt, z. B. „läuft oder pausiert“: Die Komponente zeichnet nur neu, wenn er sich ändert. */
export function usePomodoroAuswahl<T>(auswahl: (stand: PomodoroStand) => T): T {
  return useSyncExternalStore(
    (hoerer) => pomodoro.abonnieren(hoerer),
    () => auswahl(pomodoro.stand()),
  );
}
