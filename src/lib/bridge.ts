// Nachrichten zwischen der App und HTML-Seiten in der abgeschotteten Anzeige (Brücken-Skript:
// src-tauri/seite/bruecke.js). Das iframe hat keinen eigenen Ursprung (event.origin ist "null"). Die App
// prüft deshalb zuerst `event.source === iframe.contentWindow`, dann hier den Nachrichtentyp und die Felder,
// und bei Links, dass der Pfad im Vault liegt. An die Seite schickt die App nur Farbschema, Scrollposition und
// ob Bausteine bearbeitet werden dürfen.
import type { Akzent, Modus } from "./theme";
import { BAUSTEINE, type BausteinArt } from "./bausteine";

export interface SecurityCheck {
  pruefung: string;
  /** Wurde der Zugriff verhindert? */
  blockiert: boolean;
  detail: string;
  /** Kontrollen müssen klappen (z. B. ein Bild aus dem Vault), alles andere muss blockiert sein. */
  erwartet: "blockiert" | "erlaubt";
}

export type BridgeMessage =
  | { typ: "bereit" }
  | { typ: "groesse"; hoehe: number }
  | { typ: "link"; pfad: string; anker: string }
  | { typ: "extern"; url: string }
  | { typ: "taste"; taste: "p" | "f" | "e"; umschalt: boolean }
  | { typ: "position"; y: number }
  /** Stift-Symbol eines Bausteins geklickt (Nummer und Anzahl wie im iframe gezählt). */
  | { typ: "bearbeiten"; index: number; art: BausteinArt; anzahl: number }
  /** Häkchen in einer Checkliste gesetzt oder entfernt. */
  | { typ: "haekchen"; index: number; an: boolean }
  | { typ: "sicherheitstest"; ergebnisse: SecurityCheck[] };

const isIndex = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000;

const MAX_TEXT = 2000;

function isText(value: unknown, max = MAX_TEXT): value is string {
  return typeof value === "string" && value.length <= max;
}

/** Prüft eine Nachricht aus einer Seite. Alles Unbekannte oder falsch Geformte ergibt null. */
export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  if (data === null || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.localist !== 1) return null;
  switch (message.typ) {
    case "bereit":
      return { typ: "bereit" };
    case "groesse":
      return typeof message.hoehe === "number" && Number.isFinite(message.hoehe) && message.hoehe >= 0
        ? { typ: "groesse", hoehe: Math.min(Math.round(message.hoehe), 1_000_000) }
        : null;
    case "link": {
      const anker = message.anker === undefined ? "" : message.anker;
      if (!isText(message.pfad) || !isText(anker, 500)) return null;
      const pfad = normalizeVaultPath(message.pfad);
      return pfad === null ? null : { typ: "link", pfad, anker };
    }
    case "extern":
      return isText(message.url) && isExternalUrl(message.url) ? { typ: "extern", url: message.url } : null;
    case "position":
      return typeof message.y === "number" && Number.isFinite(message.y) && message.y >= 0
        ? { typ: "position", y: Math.min(Math.round(message.y), 10_000_000) }
        : null;
    case "taste":
      if ((message.taste === "p" || message.taste === "f" || message.taste === "e") && typeof message.umschalt === "boolean") {
        return { typ: "taste", taste: message.taste, umschalt: message.umschalt };
      }
      return null;
    case "bearbeiten": {
      const art = BAUSTEINE.find((info) => info.art === message.art)?.art;
      return art && isIndex(message.index) && isIndex(message.anzahl) && message.index < message.anzahl
        ? { typ: "bearbeiten", index: message.index, art, anzahl: message.anzahl }
        : null;
    }
    case "haekchen":
      return isIndex(message.index) && typeof message.an === "boolean" ? { typ: "haekchen", index: message.index, an: message.an } : null;
    case "sicherheitstest": {
      if (!Array.isArray(message.ergebnisse) || message.ergebnisse.length > 50) return null;
      const ergebnisse: SecurityCheck[] = [];
      for (const item of message.ergebnisse as unknown[]) {
        if (item === null || typeof item !== "object") return null;
        const check = item as Record<string, unknown>;
        if (!isText(check.pruefung, 200) || typeof check.blockiert !== "boolean" || !isText(check.detail, 500)) return null;
        if (check.erwartet !== "blockiert" && check.erwartet !== "erlaubt") return null;
        ergebnisse.push({ pruefung: check.pruefung, blockiert: check.blockiert, detail: check.detail, erwartet: check.erwartet });
      }
      return { typ: "sicherheitstest", ergebnisse };
    }
    default:
      return null;
  }
}

/**
 * Relativer Vault-Pfad aus einer Seite, oder null: keine "..", ".", leeren Teile, Backslashes,
 * Laufwerksbuchstaben und keine versteckten Dateien.
 */
export function normalizeVaultPath(path: string): string | null {
  if (path === "" || path.startsWith("/")) return null;
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === ".." || part.startsWith(".") || /[\\:\0]/.test(part))) return null;
  return parts.join("/");
}

/** Externe Adressen öffnet der Standardbrowser: nur http, https und mailto. */
export function isExternalUrl(url: string): boolean {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Nachrichten an die Seite: nur Modus, Akzentfarbe und Scrollposition, nie vertrauliche Daten. */
export function themeMessage(modus: Modus, akzent: Akzent = "orange") {
  const wert = modus === "black" ? "schwarz" : modus === "dark" ? "dunkel" : "hell";
  return { localist: 1, typ: "thema", wert, akzent } as const;
}

export function scrollMessage(y: number) {
  return { localist: 1, typ: "scrollen", y: Math.max(0, Math.round(y)) } as const;
}

/** Zu einem Abschnitt der Seite scrollen (Bibliothek). Nur einfache ids. */
export function ankerMessage(id: string) {
  return { localist: 1, typ: "anker", id: /^[\w-]{1,100}$/.test(id) ? id : "" } as const;
}

/** Stift-Symbole und Häkchen-Meldungen in der Seite an- oder ausschalten. */
export function editMessage(an: boolean) {
  return { localist: 1, typ: "stifte", an } as const;
}

/**
 * Hat der Nutzer gerade etwas getan (Klick, Taste)? Ein Klick im iframe zählt auch für die App (HTML-Standard:
 * Nutzeraktivierung gilt für alle übergeordneten Fenster). So kann ein Skript der Seite ohne Zutun des
 * Nutzers weder Häkchen in die Datei schreiben noch Formulare öffnen. Ohne diese Browser-Funktion (Tests): ja.
 */
export function userIsActive(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return activation ? activation.isActive : true;
}
