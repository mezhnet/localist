//! Tauri-Kommandos für die Oberfläche. Die eigentliche Dateiarbeit steckt in `vault.rs`,
//! der Dateiwächter in `watcher.rs`. Fehler gehen als deutsche Meldungen an die Oberfläche.

mod search_index;
mod vault;
mod watcher;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Zustand der laufenden App: geöffneter Vault und sein Dateiwächter.
#[derive(Default)]
struct AppState {
    root: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<watcher::VaultWatcher>>,
}

impl AppState {
    fn root(&self) -> Result<PathBuf, String> {
        lock(&self.root).clone().ok_or_else(|| "Es ist kein Vault geöffnet.".to_string())
    }
}

/// Sperrt einen Mutex. War ein anderer Zugriff mittendrin abgebrochen, wird trotzdem weitergearbeitet,
/// statt die ganze App zu beenden (die Daten darin sind einfache Pfade ohne halbfertigen Zustand).
fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Geöffneter Vault: absoluter Pfad und Anzeigename (Ordnername).
#[derive(Serialize)]
struct VaultInfo {
    root: String,
    name: String,
}

/// Was sich die App zwischen zwei Starts merkt. Liegt im App-Datenordner, nie im Vault.
#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Remembered {
    #[serde(default)]
    last_vault: Option<String>,
}

fn remembered_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Der App-Datenordner wurde nicht gefunden: {e}"))?;
    Ok(dir.join("zustand.json"))
}

/// Datenordner der App unter ihrem Arbeitstitel (bis Version 0.1.0).
const LEGACY_IDENTIFIER: &str = "de.localprojekt.desktop";

fn load_remembered(app: &AppHandle) -> Remembered {
    let read = |file: PathBuf| -> Option<Remembered> { serde_json::from_str(&std::fs::read_to_string(file).ok()?).ok() };
    let Ok(file) = remembered_file(app) else { return Remembered::default() };
    if let Some(remembered) = read(file.clone()) {
        return remembered;
    }
    // Nach der Umbenennung: zuletzt geöffneten Vault aus dem alten Datenordner übernehmen.
    let legacy = file.parent().and_then(Path::parent).map(|dir| dir.join(LEGACY_IDENTIFIER).join("zustand.json"));
    match legacy.and_then(read) {
        Some(remembered) => {
            let _ = save_remembered(app, &remembered);
            remembered
        }
        None => Remembered::default(),
    }
}

fn save_remembered(app: &AppHandle, remembered: &Remembered) -> Result<(), String> {
    let file = remembered_file(app)?;
    if let Some(dir) = file.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Der App-Datenordner konnte nicht angelegt werden: {e}"))?;
    }
    let json = serde_json::to_string_pretty(remembered).map_err(|e| e.to_string())?;
    vault::write_atomic(&file, json.as_bytes())
}

/// Zuletzt geöffneter Vault (absoluter Pfad) oder null, wenn noch keiner gemerkt ist.
#[tauri::command]
async fn get_last_vault(app: AppHandle) -> Result<Option<String>, String> {
    Ok(load_remembered(&app).last_vault)
}

/// Öffnet den Vault, merkt ihn als zuletzt geöffnet und startet den Dateiwächter.
#[tauri::command]
async fn open_vault(app: AppHandle, state: State<'_, AppState>, path: String) -> Result<VaultInfo, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Der Vault-Ordner „{path}“ wurde nicht gefunden."));
    }
    vault::ensure_settings(&root)?;

    // Alten Wächter zuerst beenden, dann den neuen starten.
    lock(&state.watcher).take();
    let new_watcher = watcher::start(app.clone(), root.clone())?;
    *lock(&state.watcher) = Some(new_watcher);
    *lock(&state.root) = Some(root.clone());

    // Bilder aus dem Vault dürfen im Editor angezeigt werden (Tauri-Asset-Protokoll).
    let _ = app.asset_protocol_scope().allow_directory(&root, true);

    save_remembered(&app, &Remembered { last_vault: Some(path.clone()) })?;
    let name = root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(path.clone());
    Ok(VaultInfo { root: path, name })
}

#[tauri::command]
async fn list_tree(state: State<'_, AppState>) -> Result<Vec<vault::TreeNode>, String> {
    vault::list_tree(&state.root()?)
}

#[tauri::command]
async fn read_page(state: State<'_, AppState>, path: String) -> Result<String, String> {
    vault::read_text(&vault::resolve(&state.root()?, &path)?)
}

#[tauri::command]
async fn write_page(state: State<'_, AppState>, path: String, content: String) -> Result<(), String> {
    vault::write_atomic(&vault::resolve(&state.root()?, &path)?, content.as_bytes())
}

#[tauri::command]
async fn create_page(state: State<'_, AppState>, dir: String, title: String) -> Result<String, String> {
    vault::create_page(&state.root()?, &dir, &title)
}

#[tauri::command]
async fn create_folder(state: State<'_, AppState>, dir: String, name: String) -> Result<String, String> {
    vault::create_folder(&state.root()?, &dir, &name)
}

#[tauri::command]
async fn rename_entry(state: State<'_, AppState>, path: String, new_name: String) -> Result<String, String> {
    vault::rename_entry(&state.root()?, &path, &new_name)
}

#[tauri::command]
async fn delete_entry(state: State<'_, AppState>, path: String) -> Result<(), String> {
    vault::delete_entry(&state.root()?, &path)
}

/// Absoluter Pfad eines Bildes, das in einer Seite verlinkt ist, oder null.
#[tauri::command]
async fn resolve_attachment(state: State<'_, AppState>, page: String, target: String) -> Result<Option<String>, String> {
    let root = state.root()?;
    Ok(vault::resolve_attachment(&root, &page, &target).map(|path| path_to_string(&path)))
}

/// Macht ein Bild (z. B. für das Cover) im Vault verfügbar und liefert den relativen Pfad.
#[tauri::command]
async fn import_attachment(state: State<'_, AppState>, source: String) -> Result<String, String> {
    vault::import_attachment(&state.root()?, Path::new(&source))
}

/// Suchindex aller Seiten (Titel, Inhalt). Liegt im Cache-Ordner der App, nicht im Vault.
#[tauri::command]
async fn vault_index(app: AppHandle, state: State<'_, AppState>) -> Result<Vec<search_index::IndexEntry>, String> {
    let root = state.root()?;
    let cache = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Der Cache-Ordner der App wurde nicht gefunden: {e}"))?;
    search_index::update_index(&root, &search_index::index_file_for(&cache, &root))
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_last_vault,
            open_vault,
            list_tree,
            read_page,
            write_page,
            create_page,
            create_folder,
            rename_entry,
            delete_entry,
            resolve_attachment,
            import_attachment,
            vault_index
        ])
        .run(tauri::generate_context!())
        .expect("Die App konnte nicht gestartet werden");
}
