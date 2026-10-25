// Nachrichten zwischen der App und HTML-Seiten in der abgeschotteten Anzeige (Brücken-Skript:
// src-tauri/seite/bruecke.js). Das iframe hat keinen eigenen Ursprung (event.origin ist "null"). Die App
// prüft deshalb zuerst `event.source === iframe.contentWindow`, dann hier den Nachrichtentyp und die Felder,
// und bei Links, dass der Pfad im Vault liegt. An die Seite schickt die App nur das Farbschema.

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
  | { typ: "taste"; taste: "p" | "f"; umschalt: boolean }
  | { typ: "sicherheitstest"; ergebnisse: SecurityCheck[] };

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
    case "taste":
      if ((message.taste === "p" || message.taste === "f") && typeof message.umschalt === "boolean") {
        return { typ: "taste", taste: message.taste, umschalt: message.umschalt };
      }
      return null;
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

/** Nachricht an die Seite (nur das Farbschema, nie vertrauliche Daten). */
export function themeMessage(theme: "light" | "dark") {
  return { localist: 1, typ: "thema", wert: theme === "dark" ? "dunkel" : "hell" } as const;
}
