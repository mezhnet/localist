// scripts/version.mjs (Etappe 21): setzt die Version überall gleich, committet und legt den Tag an.
// Geprüft auf temporären Kopien der Versionsdateien in einem eigenen Git-Repository, nie im Projekt selbst.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SKRIPT = resolve("scripts/version.mjs");
const DATEIEN = ["package.json", "package-lock.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock"];
let ordner = "";

const git = (...args: string[]) => execFileSync("git", args, { cwd: ordner, encoding: "utf8" }).trim();
const skript = (...args: string[]) => spawnSync(process.execPath, [SKRIPT, ...args, "--root", ordner, "--ohne-build"], { encoding: "utf8" });
const lesen = (datei: string) => readFileSync(join(ordner, datei), "utf8");

function versionen() {
  const lock = JSON.parse(lesen("package-lock.json"));
  return [
    JSON.parse(lesen("package.json")).version,
    lock.version,
    lock.packages[""].version,
    JSON.parse(lesen("src-tauri/tauri.conf.json")).version,
    lesen("src-tauri/Cargo.toml").match(/^version = "([^"]*)"/m)?.[1],
    lesen("src-tauri/Cargo.lock").match(/^name = "localist"\r?\nversion = "([^"]*)"/m)?.[1],
  ];
}

beforeEach(() => {
  ordner = mkdtempSync(join(tmpdir(), "localist-version-"));
  mkdirSync(join(ordner, "src-tauri"));
  for (const datei of DATEIEN) copyFileSync(datei, join(ordner, datei));
  git("init", "-q");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  git("config", "core.autocrlf", "false");
  git("add", "-A");
  git("commit", "-q", "-m", "Start");
});

afterEach(() => rmSync(ordner, { recursive: true, force: true }));

describe("scripts/version.mjs", () => {
  it("setzt die Version in allen Dateien gleich, ändert nur die Versionszeilen, committet „Version X.Y.Z“ und legt den Tag vX.Y.Z an", () => {
    const ergebnis = skript("9.8.7");
    expect(ergebnis.status, ergebnis.stderr).toBe(0);
    expect(versionen()).toEqual(Array(6).fill("9.8.7"));
    expect(git("log", "-1", "--format=%s")).toBe("Version 9.8.7");
    // Mit Beschreibung („annotated“), damit `git push --follow-tags` den Tag mitschickt.
    expect(git("cat-file", "-t", "v9.8.7")).toBe("tag");
    expect(git("rev-parse", "v9.8.7^{commit}")).toBe(git("rev-parse", "HEAD"));
    expect(git("status", "--porcelain")).toBe("");
    const geaendert = git("diff", "--numstat", "HEAD~1", "HEAD").split("\n").sort();
    expect(geaendert).toEqual(["1\t1\tpackage.json", "1\t1\tsrc-tauri/Cargo.lock", "1\t1\tsrc-tauri/Cargo.toml", "1\t1\tsrc-tauri/tauri.conf.json", "2\t2\tpackage-lock.json"]);
  });

  it("bricht ab, wenn die Arbeitskopie nicht sauber ist, und ändert nichts", () => {
    writeFileSync(join(ordner, "package.json"), lesen("package.json") + "\n");
    const vorher = versionen();
    const ergebnis = skript("9.8.7");
    expect(ergebnis.status).not.toBe(0);
    expect(ergebnis.stderr).toContain("Die Arbeitskopie ist nicht sauber");
    expect(versionen()).toEqual(vorher);
    expect(git("tag", "--list")).toBe("");
    expect(git("log", "-1", "--format=%s")).toBe("Start");
  });

  it("bricht bei einer ungültigen Version oder einem vorhandenen Tag ab", () => {
    expect(skript("2.2").status).not.toBe(0);
    expect(skript("v2.2.0").status).not.toBe(0);
    git("tag", "v9.8.7");
    const ergebnis = skript("9.8.7");
    expect(ergebnis.status).not.toBe(0);
    expect(ergebnis.stderr).toContain("Den Tag v9.8.7 gibt es schon");
    expect(git("status", "--porcelain")).toBe("");
  });
});
