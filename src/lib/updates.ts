// Updates über GitHub Releases (PC seit Etappe 21, Android seit Version 2.3.1).
// Gefragt wird nur nach einem Klick auf „Nach Updates suchen“: nie beim Start, nie beim Öffnen der Einstellungen und
// nie im Hintergrund. Die Anfrage selbst stellt am PC der Rust-Teil von `tauri-plugin-updater`, auf Android der
// Kotlin-Teil `AktualisierenPlugin.kt` (über src-tauri/src/android_update.rs). Deshalb bleibt die CSP der Oberfläche
// unverändert (kein Netzwerk aus der WebView).
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { errorMessage } from "./autosave";
import { androidUpdateInstallieren, androidUpdateSuchen } from "./vault-api";

/** Releases-Seite, passend zum Endpoint in tauri.conf.json. */
export const RELEASES_SEITE = "https://github.com/mezhnet/localist/releases";

/** Wie Localist sich aktualisiert: am PC mit tauri-plugin-updater, auf Android mit der APK vom Release, sonst gar nicht. */
export function updateWeg(platform: string): "pc" | "android" | null {
  if (platform === "android") return "android";
  return platform === "ios" ? null : "pc";
}

export type UpdateZustand =
  | { art: "bereit" }
  | { art: "sucht" }
  | { art: "aktuell"; version: string }
  /** `update` gibt es nur am PC; auf Android wird die APK zu `version` geladen. */
  | { art: "verfuegbar"; version: string; notizen: string; update: Update | null }
  | { art: "nochNicht"; version: string }
  | { art: "laedt"; prozent: number | null }
  | { art: "installiert" }
  | { art: "installer" }
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
    case "nochNicht":
      return `${mitV(zustand.version)} ist für Android noch nicht fertig. Bitte in einigen Minuten erneut versuchen.`;
    case "laedt":
      return zustand.prozent === null ? "Wird heruntergeladen …" : `Wird heruntergeladen … ${zustand.prozent} %`;
    case "installiert":
      return "Wird installiert, Localist startet neu …";
    case "installer":
      return "Android fragt jetzt, ob Localist aktualisiert werden soll: dort auf „Aktualisieren“ tippen. Beim ersten Mal fragt Android vorher, ob Localist Apps installieren darf. Ist das Fenster von Android wieder zu, noch einmal auf „Nach Updates suchen“ tippen.";
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

/** Android: fragt GitHub ab (nur nach dem Klick). Fehler werden zur Meldung, die App läuft weiter. */
export async function androidNachUpdatesSuchen(aktuelleVersion: string): Promise<UpdateZustand> {
  try {
    const antwort = await androidUpdateSuchen();
    if (antwort.art === "verfuegbar") return { art: "verfuegbar", version: antwort.version, notizen: "", update: null };
    if (antwort.art === "nochNicht") return { art: "nochNicht", version: antwort.version };
    return { art: "aktuell", version: aktuelleVersion };
  } catch {
    return { art: "fehler", meldung: KEINE_VERBINDUNG };
  }
}

/**
 * Android: speichert alles Ausstehende (scheitert das, wird nichts geladen), lädt die APK mit Fortschritt und öffnet
 * den Installer von Android. Die App läuft dabei weiter; Android beendet sie erst beim Installieren.
 */
export async function androidUpdateLaden(version: string, speichern: () => Promise<void>, melden: (zustand: UpdateZustand) => void): Promise<void> {
  try {
    await speichern();
  } catch (error) {
    melden({ art: "fehler", meldung: `Update fehlgeschlagen: Deine Änderungen ließen sich nicht speichern (${kurzeUrsache(error)}). Es wurde nichts installiert.` });
    return;
  }
  melden({ art: "laedt", prozent: null });
  try {
    await androidUpdateInstallieren(version, (geladen, gesamt) => {
      melden({ art: "laedt", prozent: gesamt > 0 ? Math.min(100, Math.floor((geladen / gesamt) * 100)) : null });
    });
  } catch (error) {
    melden({ art: "fehler", meldung: `Update fehlgeschlagen: ${kurzeUrsache(error)}` });
    return;
  }
  melden({ art: "installer" });
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
