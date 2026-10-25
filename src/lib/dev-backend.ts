// Nur für die Entwicklung im normalen Browser (`npm run dev` ohne Tauri):
// simuliert die Rust-Kommandos mit einem Vault im Arbeitsspeicher, gefüllt aus `beispiel-vault/`.
// Änderungen gehen beim Neuladen der Seite verloren; echte Dateien werden nie verändert.
// In der gebauten App ist diese Datei nicht enthalten (siehe main.tsx).
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { newHtmlPage } from "./html";
import { VAULT_CHANGED_EVENT, type TreeNode, type VaultChange } from "./vault-api";

const ROOT = "beispiel-vault (Browser-Vorschau)";
const PREFIX = "../../beispiel-vault/";

const pageSeed = import.meta.glob(["../../beispiel-vault/**/*.md", "../../beispiel-vault/**/*.html", "../../beispiel-vault/**/*.yaml", "../../beispiel-vault/.localist/settings.json"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const assetSeed = import.meta.glob(["../../beispiel-vault/**/*", "!**/*.md", "!**/*.html", "!**/*.yaml"], { query: "?url", import: "default", eager: true });

const PAGE_FILE = /\.(md|html)$/i;

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
}

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
        nodes.push({ name: nameOf(folder), path: folder, kind: "folder", children: listDir(folder), ...(database ? { database } : {}) });
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
    (cmd, args) => {
      const a = (args ?? {}) as Record<string, any>;
      if (missing && !cmd.startsWith("plugin:") && cmd !== "get_last_vault") {
        throw `Der Vault-Ordner „${ROOT}“ wurde nicht gefunden.`;
      }
      switch (cmd) {
        case "get_last_vault":
          return localStorage.getItem("dev-last-vault");
        case "open_vault":
          localStorage.setItem("dev-last-vault", a.path);
          return { root: a.path, name: String(a.path).split("/").pop() || a.path };
        case "list_tree":
          return listDir("");
        case "read_page": {
          const text = files.get(a.path);
          if (text === undefined) throw `Die Datei „${nameOf(a.path)}“ wurde nicht gefunden.`;
          return text;
        }
        case "write_page":
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

  // Bilder: Die Browser-Vorschau liefert schon fertige Adressen des Vite-Servers.
  (window as unknown as { __TAURI_INTERNALS__: Record<string, unknown> }).__TAURI_INTERNALS__.convertFileSrc = (
    path: string,
  ) => path;

  // HTML-Seiten zeigt die Vite-Middleware (vite.config.ts) statt des Schemas localist-seite.
  window.__localistSeitenBasis = `${location.origin}/__localist-seite/`;

  window.__devVault = {
    files,
    folders,
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
  };
}
