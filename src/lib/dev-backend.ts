// Nur für die Entwicklung im normalen Browser (`npm run dev` ohne Tauri):
// simuliert die Rust-Kommandos mit einem Vault im Arbeitsspeicher, gefüllt aus `beispiel-vault/`.
// Änderungen gehen beim Neuladen der Seite verloren; echte Dateien werden nie verändert.
// In der gebauten App ist diese Datei nicht enthalten (siehe main.tsx).
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import bundledCss from "../../src-tauri/seite/localist.css?raw";
import bundledJs from "../../src-tauri/seite/localist.js?raw";
import tauriConf from "../../src-tauri/tauri.conf.json";
import { EIGENE_DIR, eigenerBausteinDatei, eigenerBausteinLesen, eigenerBausteinName } from "./eigene-bausteine";
import { newHtmlPage, resolveRelative } from "./html";
import { jetzt, vorspulen } from "./uhr";
import { VAULT_CHANGED_EVENT, type TreeNode, type VaultChange } from "./vault-api";

const ROOT = "beispiel-vault (Browser-Vorschau)";
const PREFIX = "../../beispiel-vault/";

const pageSeed = import.meta.glob(["../../beispiel-vault/**/*.md", "../../beispiel-vault/**/*.html", "../../beispiel-vault/**/*.yaml", "../../beispiel-vault/.localist/settings.json", "../../beispiel-vault/.localist/bausteine/eigene/*.html"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const assetSeed = import.meta.glob(["../../beispiel-vault/**/*", "!**/*.md", "!**/*.html", "!**/*.yaml"], { query: "?url", import: "default", eager: true });

const PAGE_FILE = /\.(md|html)$/i;

/** Kurze Pause für nachgestellte Abläufe (Updater); in Tests ohne Wartezeit. */
function warten(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === "test" ? 0 : ms));
}

/**
 * Meldet HTML-Seiten an die Vite-Middleware, damit die abgeschottete Anzeige auch in der Vorschau angelegte
 * oder geänderte Seiten zeigt (nur im Arbeitsspeicher des Servers, nie auf der Festplatte). In Tests nicht nötig.
 */
function syncPreview(path: string, content: string | null) {
  if (import.meta.env.MODE === "test" || !/\.html$/i.test(path)) return;
  const url = `/__localist-dev/datei?pfad=${encodeURIComponent(path)}`;
  void fetch(url, content === null ? { method: "DELETE" } : { method: "PUT", body: content }).catch(() => {});
}

interface DevVault {
  files: Map<string, string>;
  folders: Set<string>;
  /** Simuliert eine Änderung von außen (z. B. aus Obsidian). */
  externalWrite: (path: string, content: string) => void;
  /** Simuliert Löschen von außen. */
  externalDelete: (path: string) => void;
  /** Simuliert einen verschwundenen Vault-Ordner (z. B. abgezogener USB-Stick). */
  setMissing: (missing: boolean) => void;
  /** Simuliert einen Schreibfehler (z. B. Datenträger voll): Solange gesetzt, scheitert jedes Speichern mit diesem Text. */
  schreibfehler: string | null;
  /** Setzt die Änderungszeit einer Datei (für Screenshot-Skripte, z. B. „vor 7 Min.“ auf der Startseite). */
  setModified: (path: string, zeit: number) => void;
  /** Exportierte Dateien (Ziel → Inhalt) und fertig dargestellte Notizen (Pfad → HTML). */
  exporte: Map<string, string>;
  darstellungen: Map<string, string>;
  /** Pfade, für die „Im Explorer öffnen“ gewählt wurde ("" = Vault). */
  explorer: string[];
  /** Fensterbefehle der eigenen Fensterknöpfe und der Fensterleiste (z. B. "minimize"); in der Vorschau ohne Wirkung. */
  fenster: string[];
  /**
   * Simulierter Updater (Vorschau ohne Netz): Was „Nach Updates suchen“ findet, und welche Befehle des Updaters
   * kamen ("check", "download_and_install", "restart"). Startwert aus localStorage "dev-update".
   */
  update: { szenario: UpdateSzenario; befehle: string[] };
  /**
   * Simulierte Benachrichtigungen: gezeigte (Titel und Text) und geplante (id → Zeitpunkt). Erlaubnis aus
   * localStorage "dev-benachrichtigung" ("abgelehnt" oder "offen"), sonst erteilt.
   */
  benachrichtigungen: { gezeigt: { titel: string; text: string }[]; geplant: Map<number, { zeitpunkt: number; titel: string; text: string }> };
  /** Stellt die Uhr der App vor (src/lib/uhr.ts), z. B. damit ein Pomodoro sofort abläuft. */
  vorspulen: (ms: number) => void;
}

/** Zeigt eine simulierte Benachrichtigung als Meldung oben rechts (nur Browser-Vorschau, 8 Sekunden). */
function benachrichtigungZeigen(titel: string, text: string) {
  if (import.meta.env.MODE === "test") return;
  let liste = document.getElementById("dev-benachrichtigungen");
  if (!liste) {
    liste = document.createElement("div");
    liste.id = "dev-benachrichtigungen";
    liste.setAttribute("role", "status");
    liste.style.cssText =
      "position:fixed;top:48px;right:16px;z-index:10000;display:flex;flex-direction:column;gap:8px;max-width:320px;pointer-events:none";
    document.body.append(liste);
  }
  const karte = document.createElement("div");
  karte.className = "dev-benachrichtigung";
  karte.style.cssText =
    "background:var(--color-surface-raised);color:var(--color-text);border:1px solid var(--color-border);border-radius:10px;box-shadow:var(--shadow-md);padding:10px 14px;font:13px/1.4 var(--font-sans, sans-serif)";
  const kopf = document.createElement("strong");
  kopf.textContent = `Benachrichtigung (Vorschau): ${titel}`;
  const zeile = document.createElement("div");
  zeile.textContent = text;
  karte.append(kopf, zeile);
  liste.append(karte);
  setTimeout(() => karte.remove(), 8000);
}

export type UpdateSzenario = "verfuegbar" | "aktuell" | "fehler" | "installfehler";

declare global {
  interface Window {
    __devVault?: DevVault;
  }
}

export function installDevBackend(): void {
  const files = new Map<string, string>();
  const folders = new Set<string>();
  const assets = new Map<string, string>();
  /** Änderungszeit je Datei (für „Zuletzt bearbeitet“ auf der Startseite). */
  const modified = new Map<string, number>();
  const touch = (path: string) => modified.set(path, Date.now());

  const addParents = (path: string) => {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  };
  // Beispielseiten bekommen gestaffelte Änderungszeiten, damit die Startseite eine Reihenfolge zeigt.
  Object.entries(pageSeed).forEach(([key, text], index) => {
    const rel = key.slice(PREFIX.length);
    files.set(rel, text as string);
    modified.set(rel, Date.now() - (index + 1) * 47 * 60_000);
    addParents(rel);
  });
  for (const [key, url] of Object.entries(assetSeed)) {
    const rel = key.slice(PREFIX.length);
    assets.set(rel, url as string);
    addParents(rel);
  }

  const notify = (change: Partial<VaultChange> & { kind: VaultChange["kind"] }) =>
    void emit(VAULT_CHANGED_EVENT, { path: null, newPath: null, ...change });

  const hidden = (path: string) => path.split("/").some((part) => part.startsWith("."));
  const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);
  const exists = (path: string) =>
    files.has(path) || folders.has(path) || [...files.keys()].some((f) => f.toLowerCase() === path.toLowerCase());

  const validate = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw "Der Name darf nicht leer sein.";
    if (/[\\/:*?"<>|]/.test(trimmed)) throw 'Der Name darf diese Zeichen nicht enthalten: \\ / : * ? " < > |';
    if (trimmed.startsWith(".")) throw "Der Name darf nicht mit einem Punkt beginnen.";
    return trimmed;
  };

  const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
  const listDir = (dir: string): TreeNode[] => {
    const nodes: TreeNode[] = [];
    for (const folder of folders) {
      if (parentOf(folder) === dir && !hidden(folder)) {
        const database = files.has(`${folder}/_ansichten.yaml`);
        const notebook = files.has(`${folder}/_notizbuch.yaml`);
        nodes.push({ name: nameOf(folder), path: folder, kind: "folder", children: listDir(folder), ...(database ? { database } : {}), ...(notebook ? { notebook } : {}) });
      }
    }
    for (const file of files.keys()) {
      if (parentOf(file) === dir && !hidden(file) && PAGE_FILE.test(file)) {
        const html = /\.html$/i.test(file);
        nodes.push({ name: nameOf(file).replace(PAGE_FILE, ""), path: file, kind: "page", ...(html ? { html } : {}) });
      }
    }
    return nodes;
  };

  /** Gibt es im Ordner schon eine Seite mit diesem Titel (Notiz oder HTML-Seite)? */
  const pageNameTaken = (dir: string, title: string, except?: string) =>
    ["md", "html"].some((ext) => {
      const candidate = join(dir, `${title}.${ext}`).toLowerCase();
      return [...files.keys()].some((file) => file.toLowerCase() === candidate && file.toLowerCase() !== except?.toLowerCase());
    });

  const movePrefix = (from: string, to: string) => {
    for (const [path, text] of [...files]) {
      if (path === from || path.startsWith(`${from}/`)) {
        files.delete(path);
        files.set(to + path.slice(from.length), text);
        syncPreview(path, null);
        syncPreview(to + path.slice(from.length), text);
        modified.set(to + path.slice(from.length), modified.get(path) ?? Date.now());
        modified.delete(path);
      }
    }
    for (const folder of [...folders]) {
      if (folder === from || folder.startsWith(`${from}/`)) {
        folders.delete(folder);
        folders.add(to + folder.slice(from.length));
      }
    }
  };

  const remove = (path: string) => {
    for (const file of [...files.keys()]) {
      if (file === path || file.startsWith(`${path}/`)) {
        files.delete(file);
        syncPreview(file, null);
      }
    }
    for (const folder of [...folders]) if (folder === path || folder.startsWith(`${path}/`)) folders.delete(folder);
  };

  /** Eigene Bausteine aus `.localist/bausteine/eigene/`, nach Namen sortiert. */
  const eigeneListe = () =>
    [...files]
      .filter(([pfad]) => pfad.startsWith(`${EIGENE_DIR}/`) && pfad.endsWith(".html"))
      .map(([pfad, inhalt]) => ({ name: pfad.slice(EIGENE_DIR.length + 1, -".html".length), ...eigenerBausteinLesen(inhalt) }))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  /** Exportierte Dateien (nur Vorschau) und fertig dargestellte Notizen für das Notizbuch. */
  const exporte = new Map<string, string>();
  const darstellungen = new Map<string, string>();
  const explorer: string[] = [];
  const fenster: string[] = [];
  let maximiert = false;
  const gespeichertesSzenario = localStorage.getItem("dev-update");
  const update: DevVault["update"] = {
    szenario: (["verfuegbar", "aktuell", "fehler", "installfehler"] as const).find((s) => s === gespeichertesSzenario) ?? "verfuegbar",
    befehle: [],
  };

  const benachrichtigungen: DevVault["benachrichtigungen"] = { gezeigt: [], geplant: new Map() };
  const zeigen = (titel: string, text: string) => {
    benachrichtigungen.gezeigt.push({ titel, text });
    benachrichtigungZeigen(titel, text);
  };
  // Geplante Benachrichtigungen: wie in benachrichtigung.rs ein Blick auf die Uhr pro Takt (hier 250 ms).
  if (import.meta.env.MODE !== "test") {
    setInterval(() => {
      for (const [id, plan] of [...benachrichtigungen.geplant]) {
        if (jetzt() < plan.zeitpunkt) continue;
        benachrichtigungen.geplant.delete(id);
        zeigen(plan.titel, plan.text);
      }
    }, 250);
  }
  const erlaubnisStand = () => localStorage.getItem("dev-benachrichtigung");

  let missing = false;
  // Simulierter Gerätespeicher für die Ordnerauswahl auf Android (localStorage "dev-platform" = "android").
  const deviceFolders = new Map<string, string[]>([
    ["/storage/emulated/0", ["Documents", "Download", "Pictures"]],
    ["/storage/emulated/0/Documents", ["Beispiel-Vault"]],
    ["/storage/emulated/0/Documents/Beispiel-Vault", []],
    ["/storage/emulated/0/Download", []],
    ["/storage/emulated/0/Pictures", []],
    ["/data/app/Vaults", []],
  ]);
  mockIPC(
    async (cmd, args) => {
      const a = (args ?? {}) as Record<string, any>;
      if (missing && !cmd.startsWith("plugin:") && cmd !== "get_last_vault") {
        throw `Der Vault-Ordner „${ROOT}“ wurde nicht gefunden.`;
      }
      switch (cmd) {
        case "get_last_vault":
          return localStorage.getItem("dev-last-vault");
        case "open_vault":
          localStorage.setItem("dev-last-vault", a.path);
          // Wie bausteine::ensure in Rust: gebündelte Bausteine in den Vault, wenn sie fehlen oder abweichen.
          for (const [name, text] of [
            ["localist.css", bundledCss],
            ["localist.js", bundledJs],
          ]) {
            if (files.get(`.localist/bausteine/${name}`) !== text) files.set(`.localist/bausteine/${name}`, text);
          }
          return { root: a.path, name: String(a.path).split("/").pop() || a.path };
        case "list_tree":
          return listDir("");
        case "read_page": {
          const text = files.get(a.path);
          if (text === undefined) throw `Die Datei „${nameOf(a.path)}“ wurde nicht gefunden.`;
          return text;
        }
        case "write_page":
          if (window.__devVault?.schreibfehler) throw window.__devVault.schreibfehler;
          files.set(a.path, a.content);
          touch(a.path);
          syncPreview(a.path, a.content);
          setTimeout(() => notify({ kind: "modified", path: a.path }), 250);
          return null;
        case "create_page": {
          const title = validate(a.title);
          const html = a.kind === "html";
          const path = join(a.dir, `${title}.${html ? "html" : "md"}`);
          if (pageNameTaken(a.dir, title)) throw `Hier gibt es schon eine Seite „${title}“.`;
          const content = html ? newHtmlPage(title, crypto.randomUUID(), path) : `---\nid: ${crypto.randomUUID()}\n---\n`;
          files.set(path, content);
          touch(path);
          syncPreview(path, content);
          notify({ kind: "created", path });
          return path;
        }
        case "create_folder": {
          const path = join(a.dir, validate(a.name));
          if (exists(path)) throw `Hier gibt es schon einen Ordner oder eine Datei „${a.name}“.`;
          folders.add(path);
          notify({ kind: "created", path });
          return path;
        }
        case "rename_entry": {
          const isFolder = folders.has(a.path);
          const name = validate(a.newName);
          const parent = parentOf(a.path);
          const ext = /\.html$/i.test(a.path) ? "html" : "md";
          const target = join(parent, isFolder ? name : `${name}.${ext}`);
          const taken = isFolder ? target.toLowerCase() !== a.path.toLowerCase() && exists(target) : pageNameTaken(parent, name, a.path);
          if (taken) throw `Hier gibt es schon einen Eintrag „${name}“.`;
          movePrefix(a.path, target);
          notify({ kind: "renamed", path: a.path, newPath: target });
          return target;
        }
        case "move_entry": {
          const dir = String(a.targetDir);
          if (!files.has(a.path) && !folders.has(a.path)) throw "Der Eintrag existiert nicht mehr.";
          if (dir !== "" && !folders.has(dir)) throw "Der Zielordner existiert nicht.";
          if (dir.toLowerCase() === a.path.toLowerCase() || dir.toLowerCase().startsWith(`${a.path.toLowerCase()}/`)) {
            throw "Ein Ordner kann nicht in sich selbst verschoben werden.";
          }
          const target = join(dir, nameOf(a.path));
          if (target === a.path) return target;
          const isPage = files.has(a.path) && PAGE_FILE.test(a.path);
          const taken = isPage ? pageNameTaken(dir, nameOf(a.path).replace(PAGE_FILE, "")) : exists(target);
          if (taken) throw `Im Zielordner gibt es schon einen Eintrag „${nameOf(a.path).replace(PAGE_FILE, "")}“.`;
          movePrefix(a.path, target);
          notify({ kind: "renamed", path: a.path, newPath: target });
          return target;
        }
        case "delete_entry":
          remove(a.path);
          notify({ kind: "removed", path: a.path });
          return null;
        // Export und Notizbuch (wie src-tauri/src/export.rs)
        case "anhang_pfad": {
          const ziel = decodeURIComponent(String(a.target).split(/[?#]/)[0]).replace(/^\.\//, "");
          for (const kandidat of [resolveRelative(parentOf(a.page), ziel), resolveRelative("", ziel)]) {
            if (kandidat !== null && (assets.has(kandidat) || files.has(kandidat))) return kandidat;
          }
          return null;
        }
        case "datei_base64": {
          const url = assets.get(a.path);
          if (url === undefined) throw `„${nameOf(a.path)}“ wurde nicht gefunden.`;
          const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
          let binaer = "";
          for (const byte of bytes) binaer += String.fromCharCode(byte);
          return btoa(binaer);
        }
        case "export_schreiben":
          if (!/\.html?$/i.test(a.ziel)) throw "Exportiert wird nur als .html-Datei.";
          exporte.set(a.ziel, a.inhalt);
          return null;
        case "notiz_darstellung_setzen":
          if (!/\.md$/i.test(a.pfad)) throw "Nur Notizen (.md) werden so dargestellt.";
          darstellungen.set(a.pfad, a.html);
          if (import.meta.env.MODE !== "test") {
            await fetch(`/__localist-dev/darstellung?pfad=${encodeURIComponent(a.pfad)}`, { method: "PUT", body: a.html }).catch(() => {});
          }
          return null;
        case "plugin:dialog|save":
          return `C:/Export/${a.options?.defaultPath ?? "Seite.html"}`;
        // Eigene Bausteine (wie src-tauri/src/eigene.rs)
        case "eigene_bausteine":
          return eigeneListe();
        case "eigenen_baustein_speichern": {
          const name = eigenerBausteinName(a.name);
          const alt = a.alterName ? eigenerBausteinName(a.alterName) : null;
          if (eigeneListe().some((b) => b.name.toLowerCase() === name.toLowerCase() && b.name.toLowerCase() !== alt?.toLowerCase())) {
            throw `Es gibt schon einen eigenen Baustein „${name}“.`;
          }
          if (alt !== null) {
            if (!files.has(`${EIGENE_DIR}/${alt}.html`)) throw `Den eigenen Baustein „${alt}“ gibt es nicht mehr.`;
            files.delete(`${EIGENE_DIR}/${alt}.html`);
            syncPreview(`${EIGENE_DIR}/${alt}.html`, null);
          }
          const inhalt = eigenerBausteinDatei(a.beschreibung, a.code);
          files.set(`${EIGENE_DIR}/${name}.html`, inhalt);
          syncPreview(`${EIGENE_DIR}/${name}.html`, inhalt);
          return name;
        }
        case "eigenen_baustein_loeschen": {
          const pfad = `${EIGENE_DIR}/${eigenerBausteinName(a.name)}.html`;
          if (!files.has(pfad)) throw `Den eigenen Baustein „${a.name}“ gibt es nicht mehr.`;
          files.delete(pfad);
          syncPreview(pfad, null);
          return null;
        }
        case "im_explorer_zeigen": {
          // Wie in Rust: nur vorhandene Einträge im Vault. Statt des Explorers ein Hinweis für die Vorschau.
          const pfad = String(a.path);
          if (pfad !== "" && !files.has(pfad) && !folders.has(pfad)) throw "Der Eintrag existiert nicht mehr.";
          explorer.push(pfad);
          const was = pfad === "" ? "den Vault-Ordner" : folders.has(pfad) ? `den Ordner „${pfad}“` : `„${pfad}“ markiert in seinem Ordner`;
          return `Browser-Vorschau: Hier gibt es keinen Explorer. In der App öffnet sich jetzt der Windows-Explorer und zeigt ${was}.`;
        }
        // Android-Statusleiste: Ein Browser-Tab hat keine, wie am PC passiert nichts.
        case "statusleiste_setzen":
          return null;
        // Updates auf Android: Die Vorschau fragt nie bei GitHub und installiert nichts.
        case "android_update_suchen":
          return { art: "aktuell" };
        case "android_update_installieren":
          throw "Browser-Vorschau: Hier wird nichts installiert.";
        // Eigener Fensterrahmen: Die Vorschau merkt sich nur die Befehle (ein Browser-Tab hat kein eigenes Fenster).
        case "plugin:window|minimize":
        case "plugin:window|close":
        case "plugin:window|start_dragging":
          fenster.push(cmd.slice("plugin:window|".length));
          return null;
        case "plugin:window|toggle_maximize":
        case "plugin:window|internal_toggle_maximize":
          fenster.push(cmd.slice("plugin:window|".length));
          maximiert = !maximiert;
          return null;
        case "plugin:window|is_maximized":
          return maximiert;
        case "sicherheitstest_info":
          return null;
        // Benachrichtigungen (src/lib/benachrichtigungen.ts): statt des Systems eine Meldung in der Oberfläche.
        case "plugin:notification|is_permission_granted": {
          const stand = erlaubnisStand();
          return stand === "abgelehnt" ? false : stand === "offen" ? null : true;
        }
        case "plugin:notification|request_permission": {
          const stand = erlaubnisStand();
          if (stand === "offen") localStorage.setItem("dev-benachrichtigung", "abgelehnt");
          return stand === "offen" || stand === "abgelehnt" ? "denied" : "granted";
        }
        case "plugin:notification|notify": {
          const o = a.options as { id?: number; title: string; body?: string; schedule?: { at: { date: string } } };
          if (o.schedule) benachrichtigungen.geplant.set(o.id ?? 0, { zeitpunkt: Date.parse(o.schedule.at.date), titel: o.title, text: o.body ?? "" });
          else zeigen(o.title, o.body ?? "");
          return null;
        }
        case "plugin:notification|cancel":
          for (const id of a.notifications as number[]) benachrichtigungen.geplant.delete(id);
          return null;
        case "benachrichtigung_planen":
          benachrichtigungen.geplant.set(a.id, { zeitpunkt: a.zeitpunkt, titel: a.titel, text: a.text });
          return null;
        case "benachrichtigung_abbrechen":
          benachrichtigungen.geplant.delete(a.id);
          return null;
        // Versionsnummer wie in der App aus tauri.conf.json.
        case "plugin:app|version":
          return tauriConf.version;
        // Updater: In der Vorschau gibt es kein Netz; die Zustände werden nur nachgestellt.
        case "plugin:updater|check": {
          update.befehle.push("check");
          await warten(400);
          if (update.szenario === "fehler") throw "error sending request for url (https://github.com/…/latest.json)";
          if (update.szenario === "aktuell") return null;
          const [major, minor, patch] = tauriConf.version.split(".").map(Number);
          return {
            rid: 1,
            currentVersion: tauriConf.version,
            version: `${major}.${minor}.${patch + 1}`,
            date: "2026-11-02T10:00:00Z",
            body: "Neu in dieser Version:\n- Kleine Verbesserungen und Fehlerbehebungen\n- Simuliertes Update der Browser-Vorschau",
            rawJson: {},
          };
        }
        case "plugin:updater|download_and_install": {
          update.befehle.push("download_and_install");
          const kanal = a.onEvent as { onmessage: (ereignis: unknown) => void };
          const gesamt = 4_200_000;
          kanal.onmessage({ event: "Started", data: { contentLength: gesamt } });
          for (let i = 1; i <= 10; i++) {
            await warten(150);
            if (update.szenario === "installfehler" && i === 6) throw "Die Signatur des Updates ist ungültig.";
            kanal.onmessage({ event: "Progress", data: { chunkLength: gesamt / 10 } });
          }
          kanal.onmessage({ event: "Finished" });
          return null;
        }
        case "plugin:process|restart":
          update.befehle.push("restart");
          return null;
        case "plugin:resources|close":
          return null;
        case "app_platform":
          return localStorage.getItem("dev-platform") ?? "browser";
        case "storage_locations":
          return [
            { name: "Interner Speicher", path: "/storage/emulated/0" },
            { name: "App-Speicher", path: "/data/app/Vaults" },
          ];
        case "list_folders": {
          const children = deviceFolders.get(a.path);
          if (!children) throw `Der Ordner „${a.path}“ wurde nicht gefunden.`;
          return children.map((name) => ({ name, path: `${a.path}/${name}` }));
        }
        case "create_folder_at": {
          const name = validate(a.name);
          const children = deviceFolders.get(a.parent) ?? [];
          if (children.includes(name)) throw `Hier gibt es schon einen Ordner „${name}“.`;
          deviceFolders.set(a.parent, [...children, name]);
          deviceFolders.set(`${a.parent}/${name}`, []);
          return `${a.parent}/${name}`;
        }
        case "vault_index":
          return [...files]
            .filter(([path]) => PAGE_FILE.test(path) && !hidden(path))
            .map(([path, content]) => ({ path, title: nameOf(path).replace(PAGE_FILE, ""), content, modified: modified.get(path) ?? 0 }));
        case "resolve_attachment": {
          const dir = parentOf(a.page);
          const target = decodeURIComponent(a.target);
          return assets.get(join(dir, target)) ?? assets.get(target) ?? null;
        }
        case "plugin:dialog|open":
          // Ordnerwahl liefert den simulierten Vault, Bildwahl das Beispielbild.
          return a.options?.directory ? ROOT : `${ROOT}/Anhänge/skizze.png`;
        case "import_attachment":
          return String(a.source).startsWith(`${ROOT}/`) ? String(a.source).slice(ROOT.length + 1) : "Anhänge/skizze.png";
        case "plugin:dialog|message": {
          // ask() übergibt die Knöpfe als { OkCancelCustom: [ok, abbrechen] } und vergleicht mit dem ok-Text.
          const [ok, cancel] = a.buttons?.OkCancelCustom ?? ["Yes", "No"];
          return window.confirm(a.message) ? ok : cancel;
        }
        default:
          throw `Unbekanntes Kommando in der Browser-Vorschau: ${cmd}`;
      }
    },
    { shouldMockEvents: true },
  );
  // Ein Fenster „main“ wie in der App, damit getCurrentWindow() funktioniert.
  mockWindows("main");

  // Bilder: Die Browser-Vorschau liefert schon fertige Adressen des Vite-Servers.
  (window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__.convertFileSrc = (
    path: string,
  ) => path;

  // HTML-Seiten zeigt die Vite-Middleware (vite.config.ts) statt des Schemas localist-seite.
  window.__localistSeitenBasis = `${location.origin}/__localist-seite/`;

  window.__devVault = {
    files,
    folders,
    exporte,
    darstellungen,
    explorer,
    fenster,
    update,
    benachrichtigungen,
    vorspulen,
    externalWrite(path, content) {
      const isNew = !files.has(path);
      files.set(path, content);
      touch(path);
      syncPreview(path, content);
      addParents(path);
      notify({ kind: isNew ? "created" : "modified", path });
    },
    externalDelete(path) {
      remove(path);
      notify({ kind: "removed", path });
    },
    setMissing(value) {
      missing = value;
      notify({ kind: "rescan" });
    },
    schreibfehler: null,
    setModified(path, zeit) {
      modified.set(path, zeit);
    },
  };
}
