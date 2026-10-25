// Schnittstelle zwischen Oberfläche und Rust-Seite (Tauri-Kommandos und Ereignisse).
// Alle Pfade außer dem Vault-Wurzelpfad sind relativ zum Vault und verwenden "/" als Trenner.
// Fehler kommen aus Rust als deutsche Meldungen (string) und werden als Promise-Rejection geliefert.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ask, open } from "@tauri-apps/plugin-dialog";

/** Geöffneter Vault: absoluter Pfad und Anzeigename (Ordnername). */
export interface VaultInfo {
  root: string;
  name: string;
}

export type TreeNodeKind = "folder" | "page";

/** Ein Eintrag im Ordnerbaum. `name` ist bei Seiten der Titel ohne ".md". */
export interface TreeNode {
  name: string;
  path: string;
  kind: TreeNodeKind;
  children?: TreeNode[];
}

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

/** Legt `<dir>/<title>.md` mit Frontmatter (id) an und liefert den relativen Pfad. */
export function createPage(dir: string, title: string): Promise<string> {
  return invoke<string>("create_page", { dir, title });
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
