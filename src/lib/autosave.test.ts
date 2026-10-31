import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aktuellerSpeicherZustand, AUTOSAVE_DELAY_MS, AutoSaver, speicherZustandZuruecksetzen } from "./autosave";

describe("Speicherstatus für den Seitenkopf (Etappe 19)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("speichert … → gespeichert mit Uhrzeit; Fehler deutlich; ältere AutoSaver melden nichts mehr", async () => {
    vi.setSystemTime(new Date(2026, 9, 29, 10, 0));
    speicherZustandZuruecksetzen();
    expect(aktuellerSpeicherZustand()).toEqual({ art: "bereit" });
    let scheitern = false;
    const write = vi.fn(async () => {
      if (scheitern) throw new Error("Datenträger voll");
    });
    const alt = new AutoSaver("a", write);
    const saver = new AutoSaver("a", write);
    saver.schedule(() => "ab");
    expect(aktuellerSpeicherZustand()).toEqual({ art: "speichert" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(aktuellerSpeicherZustand()).toEqual({ art: "gespeichert", zeit: new Date(2026, 9, 29, 10, 0, 0, AUTOSAVE_DELAY_MS).getTime() });

    // Ein älterer AutoSaver (z. B. der Seite davor) ändert den Status nicht.
    alt.schedule(() => "x");
    await alt.flush();
    expect(aktuellerSpeicherZustand().art).toBe("gespeichert");

    scheitern = true;
    saver.schedule(() => "abc");
    await saver.flush();
    expect(aktuellerSpeicherZustand()).toEqual({ art: "fehler", meldung: "Speichern fehlgeschlagen: Datenträger voll" });

    // Nach dem Zurücksetzen (neue Ansicht) zählt nur noch ein neuer AutoSaver.
    speicherZustandZuruecksetzen();
    saver.schedule(() => "abcd");
    expect(aktuellerSpeicherZustand()).toEqual({ art: "bereit" });
  });
});

describe("AutoSaver (automatisches Speichern)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("speichert erst kurz nach der letzten Eingabe, und dann nur einmal", async () => {
    const write = vi.fn(async () => {});
    const saver = new AutoSaver("alt", write);
    saver.schedule(() => "a");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    saver.schedule(() => "ab");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    expect(write).not.toHaveBeenCalled();
    expect(saver.dirty).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("ab");
    expect(saver.lastSaved).toBe("ab");
    expect(saver.dirty).toBe(false);
  });

  it("sicherSpeichern (vor einem Update): schreibt sofort, scheitert bei einem Speicherfehler, danach wieder ok", async () => {
    let scheitern = true;
    const write = vi.fn(async () => {
      if (scheitern) throw new Error("Datenträger voll");
    });
    const onError = vi.fn();
    const saver = new AutoSaver("alt", write, onError);
    saver.schedule(() => "neu");
    await expect(saver.sicherSpeichern()).rejects.toThrow("Datenträger voll");
    expect(write).toHaveBeenCalledWith("neu");
    expect(onError).toHaveBeenCalledWith("Speichern fehlgeschlagen: Datenträger voll");
    // Auch ohne neue Eingabe bleibt der Fehler bestehen: In der Datei steht noch nicht der neueste Text.
    await expect(saver.sicherSpeichern()).rejects.toThrow("Datenträger voll");
    scheitern = false;
    saver.schedule(() => "neuer");
    await expect(saver.sicherSpeichern()).resolves.toBeUndefined();
    expect(saver.lastSaved).toBe("neuer");
  });

  it("schreibt nicht, wenn sich der Text nicht geändert hat", async () => {
    const write = vi.fn(async () => {});
    const saver = new AutoSaver("gleich", write);
    saver.schedule(() => "gleich");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(write).not.toHaveBeenCalled();
  });

  it("flush speichert sofort", async () => {
    const write = vi.fn(async () => {});
    const saver = new AutoSaver("", write);
    saver.schedule(() => "sofort");
    await saver.flush();
    expect(write).toHaveBeenCalledWith("sofort");
  });

  it("speichert nacheinander, eine ältere Fassung überholt nie eine neuere", async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    const write = vi.fn((text: string) => {
      order.push(`start ${text}`);
      return new Promise<void>((resolve) => {
        release = () => {
          order.push(`ende ${text}`);
          resolve();
        };
      });
    });
    const saver = new AutoSaver("", write);
    saver.schedule(() => "eins");
    const first = saver.flush();
    saver.schedule(() => "zwei");
    const second = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    release();
    await second;
    expect(order).toEqual(["start eins", "ende eins", "start zwei", "ende zwei"]);
    expect(saver.lastSaved).toBe("zwei");
  });

  it("meldet Fehler auf Deutsch und behält den alten Stand als gespeichert", async () => {
    const onError = vi.fn();
    const saver = new AutoSaver("alt", async () => Promise.reject("Zugriff verweigert"), onError);
    saver.schedule(() => "neu");
    await saver.flush();
    expect(onError).toHaveBeenCalledWith("Speichern fehlgeschlagen: Zugriff verweigert");
    expect(saver.lastSaved).toBe("alt");
  });

  it("erkennt eigene Speicherungen, auch die vorletzte", async () => {
    const saver = new AutoSaver("v0", async () => {});
    saver.schedule(() => "v1");
    await saver.flush();
    saver.schedule(() => "v2");
    await saver.flush();
    expect(saver.isOwnWrite("v2")).toBe(true);
    expect(saver.isOwnWrite("v1")).toBe(true);
    expect(saver.isOwnWrite("von außen")).toBe(false);
  });

  it("cancel verwirft vorgemerkte Änderungen", async () => {
    const write = vi.fn(async () => {});
    const saver = new AutoSaver("", write);
    saver.schedule(() => "weg");
    saver.cancel();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(write).not.toHaveBeenCalled();
    expect(saver.dirty).toBe(false);
  });
});
