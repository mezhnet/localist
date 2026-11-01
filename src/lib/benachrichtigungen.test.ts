// Benachrichtigungen (Etappe 23) mit nachgestelltem Plugin: Android plant mit tauri-plugin-notification,
// der PC mit dem eigenen Befehl aus src-tauri/src/benachrichtigung.rs. Abgelehnte Erlaubnis hält nichts auf.
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abbrechen,
  erlaubnis,
  erlaubnisVorDemStart,
  GEFRAGT_SCHLUESSEL,
  jetztZeigen,
  planen,
  plattformVergessen,
} from "./benachrichtigungen";

let aufrufe: { cmd: string; args: Record<string, unknown> }[] = [];
let plattform = "windows";
/** Antwort von is_permission_granted: true, false oder null (noch nie gefragt). */
let erteilt: boolean | null = true;
let antwortAufFrage = "granted";
let fehler: string | null = null;

beforeEach(() => {
  localStorage.clear();
  aufrufe = [];
  plattform = "windows";
  erteilt = true;
  antwortAufFrage = "granted";
  fehler = null;
  plattformVergessen();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mockIPC((cmd, args) => {
    if (cmd === "app_platform") return plattform;
    aufrufe.push({ cmd, args: (args ?? {}) as Record<string, unknown> });
    if (fehler && cmd !== "plugin:notification|is_permission_granted") throw fehler;
    if (cmd === "plugin:notification|is_permission_granted") return erteilt;
    if (cmd === "plugin:notification|request_permission") return antwortAufFrage;
    return null;
  });
});

afterEach(() => {
  clearMocks();
  vi.restoreAllMocks();
});

const ZEIT = Date.UTC(2026, 10, 3, 9, 25);

describe("Benachrichtigungen planen und abbrechen", () => {
  it("Android plant mit dem Plugin für den genauen Zeitpunkt, auch im Ruhemodus", async () => {
    plattform = "android";
    expect(await planen(2401, ZEIT, "Fokus geschafft", "Zeit für 5 Minuten Pause")).toBe(true);
    expect(aufrufe).toEqual([
      {
        cmd: "plugin:notification|notify",
        args: {
          options: {
            id: 2401,
            title: "Fokus geschafft",
            body: "Zeit für 5 Minuten Pause",
            schedule: { at: { date: "2026-11-03T09:25:00.000Z", repeating: false, allowWhileIdle: true } },
          },
        },
      },
    ]);
  });

  it("Android bricht mit dem Plugin ab", async () => {
    plattform = "android";
    expect(await abbrechen(2401)).toBe(true);
    expect(aufrufe).toEqual([{ cmd: "plugin:notification|cancel", args: { notifications: [2401] } }]);
  });

  it("am PC plant und bricht der eigene Befehl ab (das Plugin kann dort nicht planen)", async () => {
    await planen(2401, ZEIT + 0.4, "Pause vorbei", "Weiter mit Fokus");
    await abbrechen(2401);
    expect(aufrufe).toEqual([
      { cmd: "benachrichtigung_planen", args: { id: 2401, zeitpunkt: ZEIT, titel: "Pause vorbei", text: "Weiter mit Fokus" } },
      { cmd: "benachrichtigung_abbrechen", args: { id: 2401 } },
    ]);
  });

  it("zeigt sofort eine Benachrichtigung ohne Zeitplan", async () => {
    await jetztZeigen("Fokus geschafft", "Zeit für 5 Minuten Pause");
    expect(aufrufe).toEqual([
      { cmd: "plugin:notification|notify", args: { options: { title: "Fokus geschafft", body: "Zeit für 5 Minuten Pause" } } },
    ]);
  });

  it("Fehler des Plugins werden zu false, nichts wirft", async () => {
    fehler = "Plugin fehlt";
    plattform = "android";
    expect(await planen(1, ZEIT, "a", "b")).toBe(false);
    expect(await abbrechen(1)).toBe(false);
    expect(await jetztZeigen("a", "b")).toBe(false);
  });
});

describe("Erlaubnis (Android 13 und neuer)", () => {
  it("am PC ist sie erteilt: keine Erklärung, keine Frage, kein Hinweis", async () => {
    const erklaeren = vi.fn(async () => {});
    expect(await erlaubnisVorDemStart(erklaeren)).toEqual({ erlaubnis: "erteilt", hinweis: false });
    expect(erklaeren).not.toHaveBeenCalled();
    expect(aufrufe.map((a) => a.cmd)).toEqual(["plugin:notification|is_permission_granted"]);
  });

  it("erst die Erklärung, dann die Frage – und nur beim ersten Mal", async () => {
    erteilt = null;
    const reihenfolge: string[] = [];
    const erklaeren = vi.fn(async () => {
      reihenfolge.push("erklärt");
    });
    expect(await erlaubnisVorDemStart(erklaeren)).toEqual({ erlaubnis: "erteilt", hinweis: false });
    reihenfolge.push(...aufrufe.map((a) => a.cmd));
    expect(reihenfolge).toEqual(["erklärt", "plugin:notification|is_permission_granted", "plugin:notification|request_permission"]);
    expect(localStorage.getItem(GEFRAGT_SCHLUESSEL)).toBe("1");
  });

  it("abgelehnt: der Timer darf trotzdem starten, der Hinweis kommt genau einmal, gefragt wird nicht wieder", async () => {
    erteilt = null;
    antwortAufFrage = "denied";
    const erklaeren = vi.fn(async () => {});
    expect(await erlaubnisVorDemStart(erklaeren)).toEqual({ erlaubnis: "abgelehnt", hinweis: true });
    // Android meldet danach „noch offen“ (darf erneut fragen) – Localist fragt trotzdem nicht noch einmal.
    expect(await erlaubnisVorDemStart(erklaeren)).toEqual({ erlaubnis: "offen", hinweis: false });
    erteilt = false;
    expect(await erlaubnisVorDemStart(erklaeren)).toEqual({ erlaubnis: "abgelehnt", hinweis: false });
    expect(erklaeren).toHaveBeenCalledTimes(1);
    expect(aufrufe.filter((a) => a.cmd === "plugin:notification|request_permission")).toHaveLength(1);
  });

  it("liest die Erlaubnis aus dem Plugin", async () => {
    erteilt = false;
    expect(await erlaubnis()).toBe("abgelehnt");
    erteilt = null;
    expect(await erlaubnis()).toBe("offen");
  });
});
