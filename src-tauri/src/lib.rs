//! Tauri-Kommandos für die Oberfläche. Die eigentliche Dateiarbeit steckt in `vault.rs`,
//! der Dateiwächter in `watcher.rs`. Fehler gehen als deutsche Meldungen an die Oberfläche.

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
        self.root.lock().unwrap().clone().ok_or_else(|| "Es ist kein Vault geöffnet.".to_string())
    }
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

fn load_remembered(app: &AppHandle) -> Remembered {
    remembered_file(app)
        .ok()
        .and_then(|file| std::fs::read_to_string(file).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
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
    state.watcher.lock().unwrap().take();
    let new_watcher = watcher::start(app.clone(), root.clone())?;
    *state.watcher.lock().unwrap() = Some(new_watcher);
    *state.root.lock().unwrap() = Some(root.clone());

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
            import_attachment
        ])
        .run(tauri::generate_context!())
        .expect("Die App konnte nicht gestartet werden");
}
