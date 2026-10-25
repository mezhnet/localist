// Seite „Bibliothek“: zeigt alle eingebauten Bausteine mit Beispiel und die eigenen Bausteine des Vaults als
// fertige Vorschau. Die Vorlage (eingebaute Bausteine) entsteht beim Build aus dem Katalog in bausteine.ts
// (Vite-Plugin → src-tauri/seite/bibliothek.html); beim Ausliefern ersetzt das Schema die Marke durch die
// eigenen Bausteine (src-tauri/src/eigene.rs, gleiche Regeln wie `bibliothekSeite`). Die Seite liegt virtuell
// unter `.localist/bausteine/bibliothek.html` und läuft wie jede HTML-Seite in der abgeschotteten Anzeige.
import { BAUSTEINE, type BausteinInfo } from "./bausteine";
import type { EigenerBaustein } from "./eigene-bausteine";

export const BIBLIOTHEK_PFAD = ".localist/bausteine/bibliothek.html";
export const EIGENE_MARKE = "<!-- eigene-bausteine -->";

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Kleines Beispielbild als data:-Adresse (die Bibliothek hat keine Bilder im Vault). */
const BEISPIELBILD =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120"><rect width="320" height="120" rx="10" fill="#e8eefc"/><circle cx="70" cy="60" r="28" fill="#2f6be0"/><rect x="120" y="40" width="160" height="12" rx="6" fill="#9db8ef"/><rect x="120" y="66" width="110" height="12" rx="6" fill="#c5d6f6"/></svg>',
  );

/** Beispiel eines Bausteins für die Vorschau: Bild aus data:, Seitenlinks führen nirgendwohin. */
export function vorschauCode(info: BausteinInfo): string {
  return info.beispiel
    .join("\n")
    .replace(/src="[^"]*"/g, `src="${BEISPIELBILD}"`)
    .replace(/(class="l-seitenlink" href=)"[^"]*"/g, '$1"#"');
}

export function bibliothekVorlage(): string {
  const eintraege = BAUSTEINE.map((info) =>
    [`<section class="eintrag" id="baustein-${info.art}">`, `<h2>${esc(info.name)}</h2>`, `<p class="beschreibung">${esc(info.beschreibung)}</p>`, vorschauCode(info), "</section>"].join("\n"),
  );
  return [
    "<!doctype html>",
    '<html lang="de">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Bausteine</title>",
    '<link rel="stylesheet" href="localist.css">',
    '<script src="localist.js" defer></script>',
    "<style>",
    ".eintrag { padding: var(--space-4) 0 var(--space-6); border-bottom: var(--border-width) solid var(--color-border); scroll-margin-top: var(--space-4); }",
    ".eintrag > h2 { margin: 0; font-size: var(--font-size-xl); }",
    ".beschreibung { margin: var(--space-1) 0 var(--space-3); color: var(--color-text-muted); font-size: var(--font-size-sm); }",
    ".gruppe { margin: var(--space-8) 0 0; color: var(--color-text-muted); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); letter-spacing: 0.04em; text-transform: uppercase; }",
    ".gruppe:first-child { margin-top: 0; }",
    ".leer { color: var(--color-text-muted); }",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    '<h1 class="gruppe" id="eingebaut">Eingebaute Bausteine</h1>',
    ...eintraege,
    '<h1 class="gruppe" id="eigene">Eigene Bausteine</h1>',
    EIGENE_MARKE,
    "</main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** Setzt die eigenen Bausteine in die Vorlage ein (Name und Beschreibung maskiert, der Code wie gespeichert). */
export function bibliothekSeite(vorlage: string, eigene: EigenerBaustein[]): string {
  const teil =
    eigene.length === 0
      ? '<p class="leer">Noch keine eigenen Bausteine. Markiere im Code-Editor einen Abschnitt und wähle „Als Baustein speichern“.</p>'
      : eigene
          .map((baustein, i) =>
            [`<section class="eintrag" id="eigen-${i}">`, `<h2>${esc(baustein.name)}</h2>`, `<p class="beschreibung">${esc(baustein.beschreibung)}</p>`, baustein.code, "</section>"].join("\n"),
          )
          .join("\n");
  return vorlage.replace(EIGENE_MARKE, () => teil);
}
