// Pomodoro-Logik (Etappe 23): Phasenfolge, lange Pause nach N Runden, Überspringen, Zurücksetzen, Endzeitpunkt
// statt Zählen (Ruhezustand), automatischer Start, Einstellungen und das Format des Verlaufs.
import { describe, expect, it } from "vitest";
import {
  ablaufen,
  einstellungenAnwenden,
  einstellungenLesen,
  endeText,
  lokaleZeit,
  mitEinstellungen,
  MINUTE,
  monatVon,
  neuerTimer,
  pausieren,
  restzeit,
  sessionZeile,
  STANDARD_EINSTELLUNGEN,
  starten,
  timerPruefen,
  uebersicht,
  ueberspringen,
  verlaufLesen,
  zeitText,
  zuLesendeMonate,
  zuruecksetzen,
  type PomodoroEinstellungen,
  type Session,
  type Timer,
} from "./pomodoro";
import { mitSeitenId, pfadZurId, seitenId } from "./seiten-id";

const E = STANDARD_EINSTELLUNGEN;
/** 3. November 2026, 9:00 Uhr (lokale Zeit). */
const T0 = new Date(2026, 10, 3, 9, 0).getTime();

/** Lässt die aktuelle Phase regulär zu Ende laufen (starten, Zeit bis zum Ende). */
function durchlaufen(timer: Timer, einstellungen: PomodoroEinstellungen, jetzt: number) {
  const laeuft = starten(timer, jetzt);
  return ablaufen(laeuft, einstellungen, laeuft.ende!);
}

describe("Phasenfolge", () => {
  it("Fokus, kurze Pause … nach 4 Runden die lange Pause, danach wieder Runde 1", () => {
    let timer = neuerTimer(E);
    let jetzt = T0;
    const folge: string[] = [];
    for (let i = 0; i < 8; i++) {
      folge.push(`${timer.phase}${timer.runde}`);
      const schritt = durchlaufen(timer, E, jetzt);
      jetzt = schritt.beendet[0].ende;
      timer = schritt.timer;
    }
    folge.push(`${timer.phase}${timer.runde}`);
    expect(folge).toEqual(["fokus1", "kurz1", "fokus2", "kurz2", "fokus3", "kurz3", "fokus4", "lang4", "fokus1"]);
    expect(timer.lauf).toBe("bereit");
    expect(timer.rest).toBe(25 * MINUTE);
  });

  it("lange Pause nach N Runden (hier 2) mit eigenen Dauern", () => {
    const e = { ...E, runden: 2, fokus: 50, kurz: 10, lang: 30 };
    let timer = neuerTimer(e);
    expect(timer.dauer).toBe(50 * MINUTE);
    const phasen: string[] = [];
    let jetzt = T0;
    for (let i = 0; i < 4; i++) {
      const schritt = durchlaufen(timer, e, jetzt);
      jetzt = schritt.beendet[0].ende;
      timer = schritt.timer;
      phasen.push(`${timer.phase}:${timer.dauer / MINUTE}`);
    }
    expect(phasen).toEqual(["kurz:10", "fokus:50", "lang:30", "fokus:50"]);
  });

  it("jede beendete Fokus-Phase wird eine Session, Pausen nicht", () => {
    const schritt = durchlaufen({ ...neuerTimer(E), ziel: " Subnetting üben ", seite: "abc" }, E, T0);
    expect(schritt.sessions).toEqual([
      { id: expect.any(String), start: "2026-11-03T09:00", ende: "2026-11-03T09:25", minuten: 25, ziel: "Subnetting üben", seite: "abc", abgebrochen: false },
    ]);
    expect(durchlaufen(schritt.timer, E, T0 + 25 * MINUTE).sessions).toEqual([]);
  });

  it("Texte für die Benachrichtigung am Ende", () => {
    expect(endeText({ phase: "fokus", runde: 1 }, E).text).toBe("Fokus geschafft – Zeit für 5 Minuten Pause");
    expect(endeText({ phase: "fokus", runde: 4 }, E).text).toBe("Fokus geschafft – Zeit für 15 Minuten lange Pause");
    expect(endeText({ phase: "kurz", runde: 1 }, E).text).toBe("Pause vorbei – weiter mit Runde 2 von 4");
    expect(endeText({ phase: "lang", runde: 4 }, E).text).toBe("Pause vorbei – weiter mit Runde 1 von 4");
  });
});

describe("Überspringen und Zurücksetzen", () => {
  it("Überspringen eines angefangenen Fokus: abgebrochene Session, weiter zur Pause (nicht gestartet)", () => {
    const laeuft = starten(neuerTimer(E, "Lesen"), T0);
    const schritt = ueberspringen(laeuft, E, T0 + 10 * MINUTE);
    expect(schritt.timer).toMatchObject({ phase: "kurz", runde: 1, lauf: "bereit", rest: 5 * MINUTE });
    expect(schritt.sessions).toEqual([expect.objectContaining({ start: "2026-11-03T09:00", ende: "2026-11-03T09:10", minuten: 10, ziel: "Lesen", abgebrochen: true })]);
  });

  it("Überspringen ohne Start speichert nichts; aus der Pause geht es zur nächsten Runde", () => {
    const pause = ueberspringen(neuerTimer(E), E, T0);
    expect(pause.sessions).toEqual([]);
    const fokus = ueberspringen(pause.timer, E, T0);
    expect(fokus.timer).toMatchObject({ phase: "fokus", runde: 2, lauf: "bereit" });
    expect(fokus.sessions).toEqual([]);
  });

  it("Überspringen startet die nächste Phase, wenn der passende Schalter an ist", () => {
    const e = { ...E, pausenAuto: true };
    const schritt = ueberspringen(neuerTimer(e), e, T0);
    expect(schritt.timer).toMatchObject({ phase: "kurz", lauf: "laeuft", ende: T0 + 5 * MINUTE });
  });

  it("Zurücksetzen: alles auf Anfang, Ziel und Seite bleiben, angefangener Fokus wird als abgebrochen gespeichert", () => {
    let timer = starten({ ...neuerTimer(E), ziel: "DNS", seite: "s1" }, T0);
    timer = pausieren(timer, T0 + 7 * MINUTE);
    const schritt = zuruecksetzen({ ...timer, runde: 3 }, E, T0 + 20 * MINUTE);
    expect(schritt.timer).toEqual({ ...neuerTimer(E), ziel: "DNS", seite: "s1" });
    expect(schritt.sessions).toEqual([expect.objectContaining({ minuten: 7, abgebrochen: true, ende: "2026-11-03T09:20" })]);
    expect(zuruecksetzen(schritt.timer, E, T0).sessions).toEqual([]);
  });
});

describe("Endzeitpunkt statt Zählen", () => {
  it("die Zeit springt um 10 Minuten (Ruhezustand): die Restzeit stimmt sofort", () => {
    const laeuft = starten(neuerTimer(E), T0);
    expect(restzeit(laeuft, T0 + 1000)).toBe(25 * MINUTE - 1000);
    expect(restzeit(laeuft, T0 + 10 * MINUTE)).toBe(15 * MINUTE);
    expect(ablaufen(laeuft, E, T0 + 10 * MINUTE).timer).toBe(laeuft);
  });

  it("Pausieren hält die Restzeit fest, Fortsetzen rechnet einen neuen Endzeitpunkt", () => {
    let timer = pausieren(starten(neuerTimer(E), T0), T0 + 5 * MINUTE);
    expect(timer).toMatchObject({ lauf: "pausiert", rest: 20 * MINUTE, ende: null });
    expect(restzeit(timer, T0 + 60 * MINUTE)).toBe(20 * MINUTE);
    timer = starten(timer, T0 + 60 * MINUTE);
    expect(timer.ende).toBe(T0 + 80 * MINUTE);
    expect(timer.start).toBe(T0);
  });

  it("über das Ende geschlafen: die Phase wird mit dem richtigen Endzeitpunkt abgeschlossen", () => {
    const schritt = ablaufen(starten(neuerTimer(E), T0), E, T0 + 40 * MINUTE);
    expect(schritt.beendet).toEqual([{ phase: "fokus", ende: T0 + 25 * MINUTE }]);
    expect(schritt.sessions[0]).toMatchObject({ ende: "2026-11-03T09:25", minuten: 25 });
    expect(schritt.timer).toMatchObject({ phase: "kurz", lauf: "bereit" });
  });

  it("mit automatischem Start beginnt die Folgephase am Ende der vorigen, nicht erst jetzt", () => {
    const e = { ...E, pausenAuto: true, fokusAuto: true };
    const schritt = ablaufen(starten(neuerTimer(e), T0), e, T0 + 40 * MINUTE);
    // 9:25 Pause bis 9:30, dann Fokus ab 9:30 bis 9:55 – um 9:40 sind noch 15 Minuten übrig.
    expect(schritt.beendet.map((b) => b.phase)).toEqual(["fokus", "kurz"]);
    expect(schritt.timer).toMatchObject({ phase: "fokus", runde: 2, lauf: "laeuft", ende: T0 + 55 * MINUTE, start: T0 + 30 * MINUTE });
    expect(restzeit(schritt.timer, T0 + 40 * MINUTE)).toBe(15 * MINUTE);
  });

  it("gespeicherter Timer übersteht den Neustart (JSON) und wird geprüft", () => {
    const laeuft = starten(neuerTimer(E, "Ziel", "s1"), T0);
    expect(timerPruefen(JSON.parse(JSON.stringify(laeuft)))).toEqual(laeuft);
    expect(timerPruefen({ ...laeuft, lauf: "laeuft", ende: "morgen" })).toBeNull();
    expect(timerPruefen({ phase: "egal" })).toBeNull();
    expect(timerPruefen(null)).toBeNull();
  });

  it("Zeitanzeige", () => {
    expect(zeitText(25 * MINUTE)).toBe("25:00");
    expect(zeitText(59_001)).toBe("01:00");
    expect(zeitText(0)).toBe("00:00");
    expect(zeitText(120 * MINUTE)).toBe("2:00:00");
  });
});

describe("Einstellungen", () => {
  it("liest `pomodoro` aus settings.json mit Grenzen (Fokus 1–120) und Standardwerten", () => {
    expect(einstellungenLesen({})).toEqual(E);
    expect(einstellungenLesen({ pomodoro: { fokus: 500, kurz: 0, lang: "20", runden: 2.4, pausenAuto: true, ton: "ja" } })).toEqual({
      ...E,
      fokus: 120,
      kurz: 1,
      lang: 20,
      runden: 2,
      pausenAuto: true,
    });
    expect(einstellungenLesen({ pomodoro: [] })).toEqual(E);
  });

  it("schreibt unter `pomodoro`, andere Felder bleiben", () => {
    const neu = mitEinstellungen({ favoriten: ["a.md"], pomodoro: { eigenes: 1 } }, { ...E, fokus: 30 });
    expect(neu).toEqual({ favoriten: ["a.md"], pomodoro: { eigenes: 1, ...E, fokus: 30 } });
  });

  it("eine noch nicht gestartete Phase bekommt die neue Dauer, eine laufende nicht", () => {
    expect(einstellungenAnwenden(neuerTimer(E), { ...E, fokus: 1 })).toMatchObject({ rest: MINUTE, dauer: MINUTE });
    const laeuft = starten(neuerTimer(E), T0);
    expect(einstellungenAnwenden(laeuft, { ...E, fokus: 1 })).toBe(laeuft);
  });
});

describe("Verlauf (.localist/pomodoro/YYYY-MM.jsonl)", () => {
  const s = (start: string, ende: string, minuten = 25, extra: Partial<Session> = {}): Session => ({
    id: `${start}`,
    start,
    ende,
    minuten,
    ziel: "",
    seite: null,
    abgebrochen: false,
    ...extra,
  });

  it("Schreiben und Lesen: eine Zeile pro Session im Format des Auftrags", () => {
    const session = s("2026-11-03T09:00", "2026-11-03T09:25", 25, { id: "1", ziel: "Subnetting üben", seite: "7c1e" });
    expect(sessionZeile(session)).toBe(
      '{"id":"1","start":"2026-11-03T09:00","ende":"2026-11-03T09:25","minuten":25,"ziel":"Subnetting üben","seite":"7c1e","abgebrochen":false}',
    );
    expect(verlaufLesen(`${sessionZeile(session)}\n`)).toEqual([session]);
  });

  it("eine kaputte Zeile wird übersprungen, die übrigen bleiben", () => {
    const gut = sessionZeile(s("2026-11-03T09:00", "2026-11-03T09:25"));
    const text = [gut, '{"id":"x","start":"2026-11-03T10:00","ende":', "kein json", "[1,2]", '{"start":"gestern","ende":"heute","minuten":5}', "", gut.replace('"id":"2026-11-03T09:00"', '"id":"b"')].join("\r\n");
    expect(verlaufLesen(text).map((x) => x.id)).toEqual(["2026-11-03T09:00", "b"]);
  });

  it("Monatswechsel: eine Session von 23:50 bis 0:15 liegt im Monat ihres Starts und zählt am neuen Tag", () => {
    const start = new Date(2026, 9, 31, 23, 50).getTime();
    const laeuft = starten(neuerTimer(E), start);
    const session = ablaufen(laeuft, E, laeuft.ende!).sessions[0];
    expect(session).toMatchObject({ start: "2026-10-31T23:50", ende: "2026-11-01T00:15" });
    expect(monatVon(session.start)).toBe("2026-10");
    const jetzt = new Date(2026, 10, 1, 8, 0).getTime();
    expect(zuLesendeMonate(jetzt)).toEqual(["2026-10", "2026-11"]);
    expect(uebersicht([session], jetzt)).toMatchObject({ heute: [session], heuteMinuten: 25 });
  });

  it("„Heute“ und „Diese Woche“ (ab Montag), doppelte ids zählen einmal", () => {
    // Dienstag, 3. November 2026; die Woche beginnt am Montag, dem 2. November.
    const jetzt = new Date(2026, 10, 3, 18, 0).getTime();
    const liste = [
      s("2026-11-03T09:00", "2026-11-03T09:25"),
      s("2026-11-03T09:00", "2026-11-03T09:25"),
      s("2026-11-03T10:00", "2026-11-03T10:10", 10, { abgebrochen: true }),
      s("2026-11-02T08:00", "2026-11-02T08:25"),
      s("2026-11-01T08:00", "2026-11-01T08:25"),
    ];
    const u = uebersicht(liste, jetzt);
    expect(u.heute.map((x) => x.minuten)).toEqual([25, 10]);
    expect(u.heuteMinuten).toBe(35);
    expect(u.wocheMinuten).toBe(60);
    expect(lokaleZeit(jetzt)).toBe("2026-11-03T18:00");
  });
});

describe("Verknüpfung mit der Seite über die feste id", () => {
  const notiz = "---\nid: 7c1e\ntags: [a]\n---\n# Text\n";
  const html = '<!doctype html><html><head><title>DNS</title><meta name="localist-id" content="h-1"></head><body><main></main></body></html>';

  it("liest die id aus Frontmatter und Kopfbereich", () => {
    expect(seitenId("Notizen/Ideen.md", notiz)).toBe("7c1e");
    expect(seitenId("Lernen/DNS.html", html)).toBe("h-1");
    expect(seitenId("Notizen/Ohne.md", "# nur Text")).toBeNull();
  });

  it("nach Umbenennen und Verschieben zeigt die id auf den neuen Pfad", () => {
    const vorher = [{ path: "Notizen/Ideen.md", content: notiz }, { path: "Lernen/DNS.html", content: html }];
    expect(pfadZurId(vorher, "7c1e")).toBe("Notizen/Ideen.md");
    const nachher = [{ path: "Archiv/Neue Ideen.md", content: notiz }, { path: "Lernen/DNS.html", content: html }];
    expect(pfadZurId(nachher, "7c1e")).toBe("Archiv/Neue Ideen.md");
    expect(pfadZurId(nachher, "fehlt")).toBeNull();
  });

  it("eine fehlende id wird ergänzt, eine vorhandene nie geändert", () => {
    expect(mitSeitenId("a.md", "# Text\n", "neu")).toBe("---\nid: neu\n---\n# Text\n");
    expect(mitSeitenId("a.md", "---\ntags: [a]\n---\nText", "neu")).toBe("---\ntags: [a]\nid: neu\n---\nText");
    expect(mitSeitenId("a.md", notiz, "neu")).toBe(notiz);
    const ohne = html.replace('<meta name="localist-id" content="h-1">', "");
    expect(seitenId("x.html", mitSeitenId("x.html", ohne, "neu"))).toBe("neu");
    expect(mitSeitenId("x.html", html, "neu")).toBe(html);
  });
});
