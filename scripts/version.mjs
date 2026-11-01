// Eine Versionsquelle für Localist (Etappe 21).
//
//   node scripts/version.mjs 2.2.1
//
// Setzt die Version in package.json, package-lock.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml und
// src-tauri/Cargo.lock (nur die Versionszeilen, sonst bleibt jede Datei Zeichen für Zeichen gleich). Danach baut es die
// Oberfläche neu (`npm run build`, damit die gebündelten Bausteine die neue Version tragen), committet „Version X.Y.Z“
// und legt den Tag vX.Y.Z an (mit Beschreibung, damit `git push --follow-tags` ihn mitschickt).
// Es bricht ab, ohne etwas zu ändern, wenn versionierte Dateien geändert und nicht committet sind.
//
// Für Tests: --root <Ordner> (statt des Projektordners) und --ohne-build.
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const argumente = process.argv.slice(2);
let root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let bauen = true;
let version = null;
for (let i = 0; i < argumente.length; i++) {
  if (argumente[i] === "--root") root = resolve(argumente[++i] ?? "");
  else if (argumente[i] === "--ohne-build") bauen = false;
  else version = argumente[i];
}

function abbruch(text) {
  console.error(`version.mjs: ${text}`);
  process.exit(1);
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) abbruch("Bitte eine Version wie 2.2.1 angeben: node scripts/version.mjs 2.2.1");
// Unversionierte Dateien (z. B. Aufträge für später) zählen nicht: Committet wird ohnehin nur mit `git add -u`.
const status = git("status", "--porcelain", "--untracked-files=no");
if (status) abbruch(`Die Arbeitskopie ist nicht sauber. Bitte erst committen oder verwerfen:\n${status}`);
if (git("tag", "--list", `v${version}`)) abbruch(`Den Tag v${version} gibt es schon.`);

// Datei → Muster der Versionszeilen (Gruppe 1 = alles vor der Versionsnummer) und wie oft sie vorkommen müssen.
const STELLEN = [
  ["package.json", [/^( {2}"version": ")[^"]*"/m]],
  ["package-lock.json", [/^( {2}"version": ")[^"]*"/m, /^( {4}"": \{\r?\n {6}"name": "localist",\r?\n {6}"version": ")[^"]*"/m]],
  ["src-tauri/tauri.conf.json", [/^( {2}"version": ")[^"]*"/m]],
  ["src-tauri/Cargo.toml", [/^(\[package\]\r?\nname = "localist"\r?\nversion = ")[^"]*"/m]],
  ["src-tauri/Cargo.lock", [/^(\[\[package\]\]\r?\nname = "localist"\r?\nversion = ")[^"]*"/m]],
];

// Erst alles im Speicher ändern und prüfen, dann schreiben: So bleibt bei einem Fehler jede Datei unverändert.
const neu = STELLEN.map(([datei, muster]) => {
  let text = readFileSync(join(root, datei), "utf8");
  for (const m of muster) {
    if (!m.test(text)) abbruch(`In ${datei} wurde die Versionszeile nicht gefunden.`);
    text = text.replace(m, (_, vor) => `${vor}${version}"`);
  }
  return [datei, text];
});
const inhalt = Object.fromEntries(neu);
const lock = JSON.parse(inhalt["package-lock.json"]);
const gefunden = [
  JSON.parse(inhalt["package.json"]).version,
  lock.version,
  lock.packages[""].version,
  JSON.parse(inhalt["src-tauri/tauri.conf.json"]).version,
  inhalt["src-tauri/Cargo.toml"].match(/^version = "([^"]*)"/m)?.[1],
  inhalt["src-tauri/Cargo.lock"].match(/^name = "localist"\r?\nversion = "([^"]*)"/m)?.[1],
];
if (gefunden.some((wert) => wert !== version)) abbruch(`Die Versionen stimmen nach dem Ändern nicht überein: ${gefunden.join(", ")}`);
for (const [datei, text] of neu) writeFileSync(join(root, datei), text);
console.log(`Version ${version} gesetzt in: ${STELLEN.map(([datei]) => datei).join(", ")}`);

if (bauen) {
  console.log("npm run build …");
  execSync("npm run build", { cwd: root, stdio: "inherit" });
}

git("add", "-u");
git("commit", "-q", "-m", `Version ${version}`);
git("tag", "-a", `v${version}`, "-m", `Localist v${version}`);
console.log(`Commit „Version ${version}“ und Tag v${version} angelegt. Veröffentlichen mit: git push --follow-tags`);
