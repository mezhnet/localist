// Updates über GitHub Releases (nur am PC, Etappe 21).
// Gefragt wird nur nach einem Klick auf „Nach Updates suchen“: nie beim Start, nie beim Öffnen der Einstellungen und
// nie im Hintergrund. Die Anfrage selbst stellt der Rust-Teil des Plugins `tauri-plugin-updater`, deshalb bleibt die
// CSP der Oberfläche unverändert (kein Netzwerk aus der WebView).
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { errorMessage } from "./autosave";

/** Releases-Seite für Android (dort gibt es keinen Updater). Platzhalter, siehe ANLEITUNG-RELEASE.md. */
export const RELEASES_SEITE = "https://github.com/EMRE_GITHUB_NAME/localist/releases";

/** Auf Android und iOS gibt es den Updater nicht, dort führt ein Knopf zur Releases-Seite. */
export function hatUpdater(platform: string): boolean {
  return platform !== "android" && platform !== "ios";
}

export type UpdateZustand =
  | { art: "bereit" }
  | { art: "sucht" }
  | { art: "aktuell"; version: string }
  | { art: "verfuegbar"; version: string; notizen: string; update: Update }
  | { art: "laedt"; prozent: number | null }
  | { art: "installiert" }
  | { art: "fehler"; meldung: string };

/** Versionsnummer zum Anzeigen, immer mit „v“ davor. */
export function mitV(version: string): string {
  return `v${version.replace(/^v/i, "")}`;
}

/** Die Meldung zu jedem Zustand (deutsch, für die Anzeige). */
export function updateText(zustand: UpdateZustand): string {
  switch (zustand.art) {
    case "bereit":
      return "";
    case "sucht":
      return "Suche nach Updates …";
    case "aktuell":
      return `Du bist auf dem neuesten Stand (${mitV(zustand.version)})`;
    case "verfuegbar":
      return `Update verfügbar: ${mitV(zustand.version)}`;
    case "laedt":
      return zustand.prozent === null ? "Wird heruntergeladen …" : `Wird heruntergeladen … ${zustand.prozent} %`;
    case "installiert":
      return "Wird installiert, Localist startet neu …";
    case "fehler":
      return zustand.meldung;
  }
}

export const KEINE_VERBINDUNG = "Keine Verbindung zu GitHub. Bitte später erneut versuchen.";

/** Kurze Ursache: erste Zeile, höchstens 140 Zeichen. */
export function kurzeUrsache(error: unknown): string {
  const text = errorMessage(error).split(/\r?\n/)[0].trim() || "unbekannter Fehler";
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}

/** Fragt GitHub Releases ab (nur nach dem Klick). Fehler werden zur Meldung, die App läuft weiter. */
export async function nachUpdatesSuchen(aktuelleVersion: string): Promise<UpdateZustand> {
  try {
    const update = await check();
    if (!update) return { art: "aktuell", version: aktuelleVersion };
    return { art: "verfuegbar", version: update.version, notizen: update.body ?? "", update };
  } catch {
    return { art: "fehler", meldung: KEINE_VERBINDUNG };
  }
}

/**
 * Installiert ein Update. Unter Windows beendet sich die App, sobald der Installer startet. Deshalb wird vorher alles
 * Ausstehende gespeichert (`speichern`); schlägt das fehl, wird nichts installiert. Danach startet Localist neu.
 * `melden` erhält jeden neuen Zustand (Fortschritt in Prozent, dann „Wird installiert …“ oder ein Fehler).
 */
export async function updateInstallieren(update: Update, speichern: () => Promise<void>, melden: (zustand: UpdateZustand) => void): Promise<void> {
  try {
    await speichern();
  } catch (error) {
    melden({ art: "fehler", meldung: `Update fehlgeschlagen: Deine Änderungen ließen sich nicht speichern (${kurzeUrsache(error)}). Es wurde nichts installiert.` });
    return;
  }
  let gesamt = 0;
  let geladen = 0;
  melden({ art: "laedt", prozent: null });
  try {
    await update.downloadAndInstall((ereignis: DownloadEvent) => {
      if (ereignis.event === "Started") {
        gesamt = ereignis.data.contentLength ?? 0;
        melden({ art: "laedt", prozent: gesamt > 0 ? 0 : null });
      } else if (ereignis.event === "Progress") {
        geladen += ereignis.data.chunkLength;
        melden({ art: "laedt", prozent: gesamt > 0 ? Math.min(100, Math.floor((geladen / gesamt) * 100)) : null });
      } else {
        melden({ art: "installiert" });
      }
    });
  } catch (error) {
    melden({ art: "fehler", meldung: `Update fehlgeschlagen: ${kurzeUrsache(error)}` });
    return;
  }
  melden({ art: "installiert" });
  try {
    await relaunch();
  } catch {
    melden({ art: "fehler", meldung: "Das Update ist installiert. Bitte Localist neu starten." });
  }
}
