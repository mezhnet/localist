// Benachrichtigungen des Systems (Etappe 23), die eine Stelle dafür in der App. Sie laufen nur lokal, nie über das Netz.
// - Android: tauri-plugin-notification plant selbst (AlarmManager, genaue Zeit dank USE_EXACT_ALARM). Die
//   Benachrichtigung kommt auch, wenn Localist im Hintergrund oder das Handy gesperrt ist.
// - PC: Das Plugin kann nicht planen. src-tauri/src/benachrichtigung.rs wartet auf den Zeitpunkt und zeigt sie
//   dann, solange Localist läuft (auch minimiert).
// - Browser-Vorschau: src/lib/dev-backend.ts zeigt stattdessen eine Meldung in der Oberfläche.
// Fehler werden nur protokolliert: Ein Timer läuft auch ohne Benachrichtigung weiter.
import { invoke } from "@tauri-apps/api/core";
import { appPlatform } from "./vault-api";

export type Erlaubnis = "erteilt" | "abgelehnt" | "offen";

/** Merkt sich im App-Speicher, dass Localist schon einmal gefragt bzw. den Hinweis gezeigt hat. */
export const GEFRAGT_SCHLUESSEL = "localist-benachrichtigung-gefragt";
export const HINWEIS_SCHLUESSEL = "localist-benachrichtigung-hinweis";
export const HINWEIS_OHNE_ERLAUBNIS = "Ohne Erlaubnis kommt keine Benachrichtigung, wenn die Zeit um ist.";
export const ERKLAERUNG =
  "Localist meldet sich mit einer Benachrichtigung, wenn eine Phase um ist – auch wenn die App gerade im Hintergrund ist.";

let plattform: Promise<string> | null = null;

function aufAndroid(): Promise<boolean> {
  plattform ??= appPlatform().catch(() => "unbekannt");
  return plattform.then((name) => name === "android");
}

/** Nur für Tests: Plattform neu abfragen. */
export function plattformVergessen(): void {
  plattform = null;
}

async function sicher(was: string, aktion: () => Promise<unknown>): Promise<boolean> {
  try {
    await aktion();
    return true;
  } catch (error) {
    console.warn(`Benachrichtigung (${was}) fehlgeschlagen:`, error);
    return false;
  }
}

/** Darf Localist Benachrichtigungen zeigen? Am PC immer „erteilt“, auf Android ab Version 13 erst nach der Frage. */
export async function erlaubnis(): Promise<Erlaubnis> {
  try {
    const erteilt = await invoke<boolean | null>("plugin:notification|is_permission_granted");
    return erteilt === null ? "offen" : erteilt ? "erteilt" : "abgelehnt";
  } catch {
    return "abgelehnt";
  }
}

/** Fragt das System (Android zeigt seinen Dialog, am PC kommt sofort „erteilt“). */
export async function erlaubnisAnfragen(): Promise<Erlaubnis> {
  try {
    const antwort = await invoke<string>("plugin:notification|request_permission");
    return antwort === "granted" ? "erteilt" : antwort === "denied" ? "abgelehnt" : "offen";
  } catch {
    return "abgelehnt";
  }
}

function merken(schluessel: string): boolean {
  try {
    if (localStorage.getItem(schluessel)) return false;
    localStorage.setItem(schluessel, "1");
  } catch {
    // Kein App-Speicher: dann eben jedes Mal.
  }
  return true;
}

/**
 * Vor dem ersten Timer: Fehlt die Erlaubnis und wurde noch nie gefragt, erst `erklaeren` (ein Satz, siehe
 * ERKLAERUNG), dann das System fragen. Danach wird nie wieder gefragt. Gibt `true` zurück, wenn jetzt einmalig
 * HINWEIS_OHNE_ERLAUBNIS gezeigt werden soll.
 */
export async function erlaubnisVorDemStart(erklaeren: () => Promise<void>): Promise<{ erlaubnis: Erlaubnis; hinweis: boolean }> {
  let stand = await erlaubnis();
  if (stand === "offen" && merken(GEFRAGT_SCHLUESSEL)) {
    await erklaeren();
    stand = await erlaubnisAnfragen();
  }
  if (stand === "erteilt") return { erlaubnis: stand, hinweis: false };
  return { erlaubnis: stand, hinweis: merken(HINWEIS_SCHLUESSEL) };
}

/** Zeigt sofort eine Benachrichtigung. */
export function jetztZeigen(titel: string, text: string): Promise<boolean> {
  return sicher("zeigen", () => invoke("plugin:notification|notify", { options: { title: titel, body: text } }));
}

/** Plant die Benachrichtigung `id` für `zeitpunkt` (Millisekunden seit 1970). Eine ältere mit derselben `id` ersetzt sie. */
export async function planen(id: number, zeitpunkt: number, titel: string, text: string): Promise<boolean> {
  if (await aufAndroid()) {
    const schedule = { at: { date: new Date(zeitpunkt).toISOString(), repeating: false, allowWhileIdle: true } };
    return sicher("planen", () => invoke("plugin:notification|notify", { options: { id, title: titel, body: text, schedule } }));
  }
  return sicher("planen", () => invoke("benachrichtigung_planen", { id, zeitpunkt: Math.round(zeitpunkt), titel, text }));
}

/** Bricht die geplante Benachrichtigung `id` ab (und entfernt sie auf Android, falls sie schon zu sehen ist). */
export async function abbrechen(id: number): Promise<boolean> {
  if (await aufAndroid()) return sicher("abbrechen", () => invoke("plugin:notification|cancel", { notifications: [id] }));
  return sicher("abbrechen", () => invoke("benachrichtigung_abbrechen", { id }));
}
