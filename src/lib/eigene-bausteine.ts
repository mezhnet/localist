// Eigene Bausteine („Code-Speicher“): HTML-Schnipsel in `.localist/bausteine/eigene/<Name>.html`. Die erste
// Zeile ist ein Kommentar mit der Beschreibung, z. B. `<!-- beschreibung: Box für Lernziele -->`.
// Gleiches Format wie src-tauri/src/eigene.rs (dort lesen und schreiben in der App; hier für die
// Browser-Vorschau, die Bibliotheksseite und Tests).

export const EIGENE_DIR = ".localist/bausteine/eigene";

export interface EigenerBaustein {
  name: string;
  beschreibung: string;
  code: string;
}

/** Inhalt der Datei: Beschreibung als Kommentar in der ersten Zeile, dann der Code (Zeilenende "\n"). */
export function eigenerBausteinDatei(beschreibung: string, code: string): string {
  const text = beschreibung.replace(/[\r\n]+/g, " ").replace(/--/g, "–").trim();
  return `<!-- beschreibung: ${text} -->\n${code.replace(/\r\n?/g, "\n").replace(/\n+$/, "")}\n`;
}

/** Liest Beschreibung und Code; ohne Beschreibungs-Kommentar ist alles Code. */
export function eigenerBausteinLesen(datei: string): { beschreibung: string; code: string } {
  const text = datei.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const newline = text.indexOf("\n");
  const first = newline === -1 ? text : text.slice(0, newline);
  const match = /^\s*<!--\s*beschreibung:([\s\S]*?)-->\s*$/.exec(first);
  if (!match) return { beschreibung: "", code: text.replace(/\n+$/, "") };
  return { beschreibung: match[1].trim(), code: (newline === -1 ? "" : text.slice(newline + 1)).replace(/\n+$/, "") };
}

/** Name prüfen wie `vault::validate_name` (wird zum Dateinamen). */
export function eigenerBausteinName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw "Der Name darf nicht leer sein.";
  if (/[\\/:*?"<>|]/.test(trimmed)) throw 'Der Name darf diese Zeichen nicht enthalten: \\ / : * ? " < > |';
  if (trimmed.startsWith(".")) throw "Der Name darf nicht mit einem Punkt beginnen.";
  return trimmed;
}

/** Zeilen zum Einfügen (die Einrückung der Zielzeile kommt beim Einfügen dazu). */
export function eigenerBausteinZeilen(code: string): string[] {
  return code.replace(/\r\n?/g, "\n").split("\n");
}
