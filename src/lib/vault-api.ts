// Schnittstelle zwischen Oberfläche und Rust-Seite (Tauri-Kommandos und Ereignisse).
// Alle Pfade außer dem Vault-Wurzelpfad sind relativ zum Vault und verwenden "/" als Trenner.
// Fehler kommen aus Rust als deutsche Meldungen (string) und werden als Promise-Rejection geliefert.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ask, open } from "@tauri-apps/plugin-dialog";

/** Geöffneter Vault: absoluter Pfad und Anzeigename (Ordnername). */
export interface VaultInfo {
  root: string;
  name: string;
}

export type TreeNodeKind = "folder" | "page";

/** Ein Eintrag im Ordnerbaum. `name` ist bei Seiten der Titel ohne Endung (".md" oder ".html"). */
export interface TreeNode {
  name: string;
  path: string;
  kind: TreeNodeKind;
  children?: TreeNode[];
  /** Ordner mit _ansichten.yaml (Datenbank). */
  database?: boolean;
  /** HTML-Seite (.html) statt Notiz (.md). */
  html?: boolean;
}

/** Seitentyp beim Anlegen. */
export type PageKind = "notiz" | "html";

export type VaultChangeKind = "created" | "modified" | "removed" | "renamed" | "rescan";

/** Ereignis des Dateiwächters. Bei "renamed" steht der neue Pfad in `newPath`. */
export interface VaultChange {
  kind: VaultChangeKind;
  path: string | null;
  newPath: string | null;
}

export const VAULT_CHANGED_EVENT = "vault-changed";

/** Zuletzt geöffneter Vault (absoluter Pfad) oder null, wenn noch keiner gemerkt ist. */
export function getLastVault(): Promise<string | null> {
  return invoke<string | null>("get_last_vault");
}

/** Öffnet den Vault, merkt ihn als zuletzt geöffnet und startet den Dateiwächter. */
export function openVault(path: string): Promise<VaultInfo> {
  return invoke<VaultInfo>("open_vault", { path });
}

/** Kompletter Ordnerbaum: Ordner zuerst, dann Seiten, alphabetisch; versteckte Einträge fehlen. */
export function listTree(): Promise<TreeNode[]> {
  return invoke<TreeNode[]>("list_tree");
}

export function readPage(path: string): Promise<string> {
  return invoke<string>("read_page", { path });
}

/** Schreibt atomar (temporäre Datei, dann umbenennen). */
export function writePage(path: string, content: string): Promise<void> {
  return invoke<void>("write_page", { path, content });
}

/**
 * Legt eine Notiz `<dir>/<title>.md` (Frontmatter mit id) oder eine HTML-Seite `<dir>/<title>.html`
 * (Speicherformat mit localist-id) an und liefert den relativen Pfad.
 */
export function createPage(dir: string, title: string, kind: PageKind = "notiz"): Promise<string> {
  return invoke<string>("create_page", { dir, title, kind });
}

/** Verschiebt eine Seite oder einen Ordner nach `targetDir` ("" = Vault-Wurzel). Liefert den neuen Pfad. */
export function moveEntry(path: string, targetDir: string): Promise<string> {
  return invoke<string>("move_entry", { path, targetDir });
}

export const PAGE_SCHEME = "localist-seite";

/** Nur bei `localist.exe --sicherheitstest`: Pfad des Test-Vaults, sonst null. */
export function securityTestVault(): Promise<string | null> {
  return invoke<string | null>("sicherheitstest_info");
}

/** Sicherheitstest: Hat ein Befehl aus der Testseite die App erreicht? (Das wäre eine Lücke.) */
export function securityProbeReached(): Promise<boolean> {
  return invoke<boolean>("sicherheitstest_probe_status");
}

/** Ergebnisse des Sicherheitstests an die Rust-Seite (Tabelle auf der Konsole, danach beendet sich die App). */
export function reportSecurityTest(ergebnisse: { pruefung: string; blockiert: boolean; detail: string; erwartet: string }[]): Promise<void> {
  return invoke<void>("sicherheitstest_bericht", { ergebnisse });
}

declare global {
  interface Window {
    /** Nur in der Browser-Vorschau: Adresse der Vite-Middleware statt des Schemas. */
    __localistSeitenBasis?: string;
  }
}

/**
 * Adresse einer Datei im Schema `localist-seite` für die abgeschottete Anzeige, z. B.
 * "http://localist-seite.localhost/Notizen/DNS%20Kurs.html". `version` umgeht den Zwischenspeicher nach Änderungen.
 */
export function pageUrl(path: string, version = 0): string {
  const base = window.__localistSeitenBasis ?? convertFileSrc("", PAGE_SCHEME);
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base.endsWith("/") ? base : `${base}/`}${encoded}${version > 0 ? `?v=${version}` : ""}`;
}

/** Legt `<dir>/<name>` an und liefert den relativen Pfad. `dir` = "" für die Vault-Wurzel. */
export function createFolder(dir: string, name: string): Promise<string> {
  return invoke<string>("create_folder", { dir, name });
}

/** Benennt um (Seiten: neuer Titel ohne ".md"). Liefert den neuen relativen Pfad. */
export function renameEntry(path: string, newName: string): Promise<string> {
  return invoke<string>("rename_entry", { path, newName });
}

/** Verschiebt in den Papierkorb des Systems. Die Bestätigung holt vorher die Oberfläche ein. */
export function deleteEntry(path: string): Promise<void> {
  return invoke<void>("delete_entry", { path });
}

/** Absoluter Pfad eines Bildes, das in einer Seite verlinkt ist (relativ zur Seite oder zum Vault), oder null. */
export function resolveAttachment(page: string, target: string): Promise<string | null> {
  return invoke<string | null>("resolve_attachment", { page, target });
}

/** Macht ein Bild im Vault verfügbar (kopiert es bei Bedarf nach "Anhänge/") und liefert den relativen Pfad. */
export function importAttachment(source: string): Promise<string> {
  return invoke<string>("import_attachment", { source });
}

/** Systemdialog zur Auswahl eines Bildes. null, wenn der Nutzer abbricht. */
export async function pickImage(): Promise<string | null> {
  const result = await open({
    multiple: false,
    title: "Bild auswählen",
    filters: [{ name: "Bilder", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"] }],
  });
  return typeof result === "string" ? result : null;
}

/** Suchindex aller Seiten (Titel, Inhalt, Änderungszeit). Die Rust-Seite hält ihn im Cache-Ordner der App aktuell. */
export function vaultIndex(): Promise<{ path: string; title: string; content: string; modified?: number }[]> {
  return invoke("vault_index");
}

export interface FolderEntry {
  name: string;
  path: string;
}

/** Betriebssystem, auf dem die App läuft ("windows", "android", …). */
export function appPlatform(): Promise<string> {
  return invoke<string>("app_platform");
}

/** Startpunkte für die eigene Ordnerauswahl (Android: interner Speicher und App-Speicher). */
export function storageLocations(): Promise<FolderEntry[]> {
  return invoke<FolderEntry[]>("storage_locations");
}

/** Unterordner eines absoluten Pfads (ohne versteckte). */
export function listFolders(path: string): Promise<FolderEntry[]> {
  return invoke<FolderEntry[]>("list_folders", { path });
}

/** Legt einen Ordner in einem absoluten Pfad an und liefert seinen Pfad. */
export function createFolderAt(parent: string, name: string): Promise<string> {
  return invoke<string>("create_folder_at", { parent, name });
}

/** Abonniert Änderungen im Vault (auch von außen). Liefert die Funktion zum Abbestellen. */
export function onVaultChanged(handler: (change: VaultChange) => void): Promise<UnlistenFn> {
  return listen<VaultChange>(VAULT_CHANGED_EVENT, (event) => handler(event.payload));
}

/** Systemdialog zur Ordnerwahl. null, wenn der Nutzer abbricht. */
export async function pickVaultFolder(): Promise<string | null> {
  const result = await open({ directory: true, multiple: false, title: "Vault-Ordner auswählen" });
  return typeof result === "string" ? result : null;
}

/** Ja/Abbrechen-Dialog, z. B. vor dem Löschen. */
export function confirmAction(message: string, title = "Bestätigung"): Promise<boolean> {
  return ask(message, { title, kind: "warning", okLabel: "Ja", cancelLabel: "Abbrechen" });
}
