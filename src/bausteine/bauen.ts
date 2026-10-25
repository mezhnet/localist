// Baut `localist.css` und `localist.js` für HTML-Seiten aus tokens.css und den Quellen in src/bausteine/.
// Aufgerufen vom Vite-Plugin in vite.config.ts (beim Build und in der Vorschau). Das Ergebnis liegt in
// src-tauri/seite/ (von dort bündelt es die App) und in beispiel-vault/.localist/bausteine/.
// Ein Test prüft, dass die erzeugten Dateien zum Quellcode passen.

export interface BausteinQuellen {
  /** Version der App aus package.json. */
  appVersion: string;
  tokens: string;
  /** Dateiname → Inhalt, z. B. "callout.css". */
  css: Record<string, string>;
  js: Record<string, string>;
}

export interface GebauteBausteine {
  /** App-Version plus Prüfsumme des Inhalts, z. B. "1.0.0+3fa2c91b". Steht in beiden Dateien. */
  version: string;
  css: string;
  js: string;
}

/** Zeilenenden vereinheitlichen, damit das Ergebnis nicht vom Auschecken (CRLF/LF) abhängt. */
const lf = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");

/** "basis" zuerst (Grundgerüst und gemeinsame Hilfen), dann alphabetisch. */
function ordered(files: Record<string, string>): [string, string][] {
  const name = (file: string) => file.replace(/^.*[\\/]/, "");
  return Object.entries(files)
    .map(([file, text]) => [name(file), lf(text)] as [string, string])
    .sort(([a], [b]) => (a.startsWith("basis.") ? -1 : b.startsWith("basis.") ? 1 : a.localeCompare(b)));
}

/** Kurze Prüfsumme (FNV-1a, 32 Bit) – unterscheidet Fassungen, keine Sicherheitsfunktion. */
function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function header(version: string, kind: string, file: string, sources: string): string {
  return [
    `/*! Localist-Bausteine ${version} – ${kind} (${file})`,
    `    Diese Datei verwaltet Localist. Sie entsteht aus ${sources} und wird beim Öffnen des Vaults`,
    "    erneuert, wenn sie fehlt oder abweicht – eigene Änderungen hier gehen dabei verloren. */",
    "",
  ].join("\n");
}

export function bausteineBauen(quellen: BausteinQuellen): GebauteBausteine {
  const cssBody = [["tokens.css", lf(quellen.tokens)] as [string, string], ...ordered(quellen.css)]
    .map(([name, text]) => `/* ---- ${name} ---- */\n${text}`)
    .join("\n");
  const jsBody = ordered(quellen.js)
    .map(([name, text]) => `// ---- ${name} ----\n${text}`)
    .join("\n");
  const version = `${quellen.appVersion}+${checksum(cssBody + "\u0000" + jsBody)}`;
  return {
    version,
    css: `${header(version, "Aussehen", "localist.css", "src/styles/tokens.css und src/bausteine/*.css")}\n${cssBody}`,
    js:
      `${header(version, "Funktion", "localist.js", "src/bausteine/*.js")}\n` +
      // Klassisches Skript (kein Modul), damit es auch per Doppelklick über file:// lädt.
      `(function () {\n"use strict";\nvar VERSION = ${JSON.stringify(version)};\n\n${jsBody}})();\n`,
  };
}

/** Liest die Version aus der ersten Zeile einer erzeugten Datei (oder null). */
export function bausteinVersion(text: string): string | null {
  return /^\/\*! Localist-Bausteine (\S+) /.exec(text)?.[1] ?? null;
}
