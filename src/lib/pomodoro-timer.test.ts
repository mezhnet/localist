// Der globale Pomodoro-Timer (Etappe 23) mit falschen Zeitgebern: Ruhezustand (Zeit springt), Neustart mit
// gespeichertem Zustand vor und nach dem Endzeitpunkt, Planen und Abbrechen der Benachrichtigung, Ton und Verlauf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINUTE, restzeit, STANDARD_EINSTELLUNGEN, type Session } from "./pomodoro";
import { BENACHRICHTIGUNG_ID, pomodoroErzeugen, SPEICHER_SCHLUESSEL, type PomodoroSpeicher } from "./pomodoro-timer";

const T0 = new Date(2026, 10, 3, 9, 0).getTime();

let speicher: Map<string, string>;
let geschrieben: Session[];
let planen: ReturnType<typeof vi.fn>;
let abbrechen: ReturnType<typeof vi.fn>;
let ton: ReturnType<typeof vi.fn>;
const offen: PomodoroSpeicher[] = [];

function neu(): PomodoroSpeicher {
  const store = pomodoroErzeugen({
    speicher: { getItem: (k) => speicher.get(k) ?? null, setItem: (k, v) => void speicher.set(k, v) },
    planen: planen as never,
    abbrechen: abbrechen as never,
    ton: ton as never,
  });
  offen.push(store);
  return store;
}

function anmelden(store: PomodoroSpeicher, einstellungen = STANDARD_EINSTELLUNGEN, schreiben?: (s: Session) => Promise<void>) {
  return store.anmelden({
    vault: "C:/Vault",
    einstellungen,
    schreiben:
      schreiben ??
      (async (s) => {
        geschrieben.push(s);
      }),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  speicher = new Map();
  geschrieben = [];
  planen = vi.fn(async () => true);
  abbrechen = vi.fn(async () => true);
  ton = vi.fn();
});

afterEach(async () => {
  for (const store of offen.splice(0)) await store.beenden();
  vi.useRealTimers();
});

const rest = (store: PomodoroSpeicher) => restzeit(store.stand().timer, store.stand().jetzt);

describe("läuft weiter und rechnet mit dem Endzeitpunkt", () => {
  it("Ruhezustand: Die Uhr springt um 10 Minuten, ohne dass ein Zeitgeber lief – die Restzeit stimmt beim nächsten Takt", async () => {
    const store = neu();
    await anmelden(store);
    await store.starten();
    vi.setSystemTime(T0 + 10 * MINUTE);
    vi.advanceTimersByTime(250);
    expect(rest(store)).toBe(15 * MINUTE - 250);
    expect(store.stand().timer.lauf).toBe("laeuft");
  });

  it("Ruhezustand über das Ende hinaus: Beim Zurückkehren wird die Phase abgeschlossen, ohne Ton für ein altes Ende", async () => {
    const store = neu();
    await anmelden(store);
    await store.starten();
    vi.setSystemTime(T0 + 40 * MINUTE);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(geschrieben).toHaveLength(1));
    expect(geschrieben[0]).toMatchObject({ start: "2026-11-03T09:00", ende: "2026-11-03T09:25", minuten: 25, abgebrochen: false });
    expect(store.stand().timer).toMatchObject({ phase: "kurz", lauf: "bereit" });
    expect(ton).not.toHaveBeenCalled();
  });

  it("Neustart vor dem Endzeitpunkt: Der Timer läuft weiter, die Benachrichtigung wird neu geplant", async () => {
    const vorher = neu();
    await anmelden(vorher);
    await vorher.starten();
    await vorher.beenden();
    vi.setSystemTime(T0 + 10 * MINUTE);
    planen.mockClear();
    const nachher = neu();
    await anmelden(nachher);
    expect(nachher.stand().timer).toMatchObject({ phase: "fokus", lauf: "laeuft", ende: T0 + 25 * MINUTE });
    expect(rest(nachher)).toBe(15 * MINUTE);
    expect(planen).toHaveBeenCalledWith(BENACHRICHTIGUNG_ID.fokus, T0 + 25 * MINUTE, "Pomodoro", "Fokus geschafft – Zeit für 5 Minuten Pause");
    expect(geschrieben).toEqual([]);
  });

  it("Neustart nach dem Endzeitpunkt: als abgelaufen erkannt und richtig abgeschlossen", async () => {
    const vorher = neu();
    await anmelden(vorher);
    await vorher.starten();
    vorher.zielSetzen("Subnetting üben");
    await vorher.beenden();
    vi.setSystemTime(T0 + 3 * 60 * MINUTE);
    const nachher = neu();
    await anmelden(nachher);
    expect(nachher.stand().timer).toMatchObject({ phase: "kurz", runde: 1, lauf: "bereit", rest: 5 * MINUTE });
    expect(geschrieben).toEqual([expect.objectContaining({ ende: "2026-11-03T09:25", minuten: 25, ziel: "Subnetting üben" })]);
    expect(ton).not.toHaveBeenCalled();
    // Gespeichert ist der neue Stand, nichts wartet mehr.
    expect(JSON.parse(speicher.get(SPEICHER_SCHLUESSEL)!)).toMatchObject({ timer: { phase: "kurz" }, offen: [] });
  });

  it("reguläres Ende: Ton, Session im Verlauf, die Benachrichtigung wird nicht abgebrochen", async () => {
    const store = neu();
    await anmelden(store);
    await store.starten();
    vi.advanceTimersByTime(25 * MINUTE + 10);
    await vi.waitFor(() => expect(geschrieben).toHaveLength(1));
    expect(ton).toHaveBeenCalledTimes(1);
    expect(abbrechen).not.toHaveBeenCalled();
    expect(store.stand().verlauf).toBe(1);
  });

  it("Ton abgeschaltet: kein Ton", async () => {
    const store = neu();
    await anmelden(store, { ...STANDARD_EINSTELLUNGEN, ton: false });
    await store.starten();
    vi.advanceTimersByTime(25 * MINUTE + 10);
    expect(ton).not.toHaveBeenCalled();
  });
});

describe("Benachrichtigung planen und abbrechen", () => {
  it("Start plant, Pausieren bricht ab, Fortsetzen plant neu", async () => {
    const store = neu();
    await anmelden(store);
    await store.starten();
    expect(planen).toHaveBeenLastCalledWith(2301, T0 + 25 * MINUTE, "Pomodoro", "Fokus geschafft – Zeit für 5 Minuten Pause");
    vi.setSystemTime(T0 + 5 * MINUTE);
    store.pausieren();
    expect(abbrechen).toHaveBeenLastCalledWith(2301);
    vi.setSystemTime(T0 + 20 * MINUTE);
    await store.starten();
    expect(planen).toHaveBeenLastCalledWith(2301, T0 + 40 * MINUTE, "Pomodoro", "Fokus geschafft – Zeit für 5 Minuten Pause");
    expect(planen).toHaveBeenCalledTimes(2);
  });

  it("Überspringen und Zurücksetzen brechen ab; ein abgebrochener Fokus kommt in den Verlauf", async () => {
    const store = neu();
    await anmelden(store);
    await store.starten();
    vi.setSystemTime(T0 + 12 * MINUTE);
    store.ueberspringen();
    expect(abbrechen).toHaveBeenLastCalledWith(2301);
    expect(store.stand().timer).toMatchObject({ phase: "kurz", lauf: "bereit" });
    await vi.waitFor(() => expect(geschrieben).toEqual([expect.objectContaining({ minuten: 12, abgebrochen: true })]));
    // vi.waitFor stellt die falsche Uhr ein wenig weiter.
    vi.setSystemTime(T0 + 12 * MINUTE);
    await store.starten();
    expect(planen).toHaveBeenLastCalledWith(2302, T0 + 17 * MINUTE, "Pomodoro", "Pause vorbei – weiter mit Runde 2 von 4");
    store.zuruecksetzen();
    expect(abbrechen).toHaveBeenLastCalledWith(2302);
    expect(store.stand().timer).toMatchObject({ phase: "fokus", runde: 1, lauf: "bereit" });
    expect(geschrieben).toHaveLength(1);
  });

  it("Pausen automatisch: Nach dem Fokus läuft die Pause sofort und ihr Ende ist geplant", async () => {
    const store = neu();
    await anmelden(store, { ...STANDARD_EINSTELLUNGEN, pausenAuto: true });
    await store.starten();
    vi.advanceTimersByTime(25 * MINUTE + 10);
    expect(store.stand().timer).toMatchObject({ phase: "kurz", lauf: "laeuft", ende: T0 + 30 * MINUTE });
    expect(planen).toHaveBeenLastCalledWith(2302, T0 + 30 * MINUTE, "Pomodoro", "Pause vorbei – weiter mit Runde 2 von 4");
  });

  it("vor dem Start wird gefragt; ein Fehler dabei hält den Timer nicht auf", async () => {
    const store = neu();
    const vorStart = vi.fn(async () => {
      throw new Error("abgelehnt");
    });
    await store.anmelden({ vault: "C:/Vault", einstellungen: STANDARD_EINSTELLUNGEN, schreiben: async () => {}, vorStart });
    await store.starten();
    expect(vorStart).toHaveBeenCalledTimes(1);
    expect(store.stand().timer.lauf).toBe("laeuft");
  });
});

describe("Verlauf verliert nichts", () => {
  it("Schreibfehler: Meldung, die Session wartet im App-Speicher und wird beim nächsten Mal geschrieben", async () => {
    const fehler = vi.fn();
    const store = neu();
    await store.anmelden({
      vault: "C:/Vault",
      einstellungen: STANDARD_EINSTELLUNGEN,
      schreiben: async () => {
        throw new Error("Datenträger voll");
      },
      onFehler: fehler,
    });
    await store.starten();
    vi.advanceTimersByTime(25 * MINUTE + 10);
    await vi.waitFor(() => expect(fehler).toHaveBeenCalledWith(expect.stringContaining("Datenträger voll")));
    expect(JSON.parse(speicher.get(SPEICHER_SCHLUESSEL)!).offen).toHaveLength(1);
    await store.beenden();
    const spaeter = neu();
    await anmelden(spaeter);
    expect(geschrieben).toEqual([expect.objectContaining({ minuten: 25 })]);
    expect(JSON.parse(speicher.get(SPEICHER_SCHLUESSEL)!).offen).toEqual([]);
  });

  it("ein kaputter gespeicherter Zustand ergibt einen frischen Timer", () => {
    speicher.set(SPEICHER_SCHLUESSEL, "{kaputt");
    expect(neu().stand().timer).toMatchObject({ phase: "fokus", runde: 1, lauf: "bereit" });
  });
});
