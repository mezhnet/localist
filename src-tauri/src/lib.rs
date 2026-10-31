//! Tauri-Kommandos für die Oberfläche. Die eigentliche Dateiarbeit steckt in `vault.rs`,
//! der Dateiwächter in `watcher.rs`. Fehler gehen als deutsche Meldungen an die Oberfläche.

mod bausteine;
mod eigene;
mod export;
mod page_scheme;
mod search_index;
mod security_test;
mod statusleiste;
mod vault;
mod watcher;

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Zustand der laufenden App: geöffneter Vault und sein Dateiwächter.
#[derive(Default)]
struct AppState {
    root: Mutex<Option<PathBuf>>,
    watcher: Mutex<Option<watcher::VaultWatcher>>,
    /// Gesetzt bei `localist.exe --sicherheitstest`.
    security_test: Mutex<Option<security_test::SecurityTest>>,
    /// `localist.exe --vault <pfad>`: öffnet diesen Vault nur für diesen Start, ohne ihn zu merken (z. B. für Tests).
    start_vault: Mutex<Option<String>>,
    /// Sicherheitstest: Hat ein Befehl aus der Testseite die App erreicht? (Das wäre eine Lücke.)
    probe_reached: std::sync::atomic::AtomicBool,
    /// Fertig dargestellte Notizen für die Notizbuch-Ansicht (liefert das Schema unter dem Pfad der Notiz aus).
    darstellungen: Mutex<export::Darstellungen>,
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
async fn get_last_vault(app: AppHandle, state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Some(vault) = lock(&state.start_vault).clone() {
        return Ok(Some(vault));
    }
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
    // localist.css/localist.js im Vault aktuell halten (für HTML-Seiten im Browser). Ein schreibgeschützter
    // Vault ist kein Grund, ihn nicht zu öffnen: In der App liefert das Schema ohnehin die gebündelte Fassung.
    if let Err(message) = bausteine::ensure(&root) {
        eprintln!("Bausteine nicht geschrieben: {message}");
    }

    // Alten Wächter zuerst beenden, dann den neuen starten.
    lock(&state.watcher).take();
    let new_watcher = watcher::start(app.clone(), root.clone())?;
    *lock(&state.watcher) = Some(new_watcher);
    *lock(&state.root) = Some(root.clone());
    lock(&state.darstellungen).leeren();

    // Bilder aus dem Vault dürfen im Editor angezeigt werden (Tauri-Asset-Protokoll).
    let _ = app.asset_protocol_scope().allow_directory(&root, true);

    // Sicherheitstest und --vault sollen nicht den zuletzt geöffneten Vault des Nutzers ersetzen.
    let temporary = lock(&state.security_test).is_some() || lock(&state.start_vault).as_deref() == Some(path.as_str());
    if !temporary {
        save_remembered(&app, &Remembered { last_vault: Some(path.clone()) })?;
    }
    let name = root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(path.clone());
    Ok(VaultInfo { root: path, name })
}

/// Vault-Pfad eines Bildes aus einer Seite (relativ zur Seite oder zum Vault) oder None.
#[tauri::command]
async fn anhang_pfad(state: State<'_, AppState>, page: String, target: String) -> Result<Option<String>, String> {
    let root = state.root()?;
    Ok(vault::resolve_attachment(&root, &page, &target).and_then(|path| vault::to_rel(&root, &path)))
}

/// Inhalt einer Datei im Vault als Base64 (Bilder für den Export).
#[tauri::command]
async fn datei_base64(state: State<'_, AppState>, path: String) -> Result<String, String> {
    export::datei_base64(&vault::resolve(&state.root()?, &path)?)
}

/// Schreibt eine exportierte Seite an den im Speichern-Dialog gewählten Ort (außerhalb des Vaults erlaubt).
#[tauri::command]
async fn export_schreiben(ziel: String, inhalt: String) -> Result<(), String> {
    export::export_schreiben(Path::new(&ziel), &inhalt)
}

/// Legt die fertig dargestellte Fassung einer Notiz für die abgeschottete Anzeige ab (Notizbuch).
#[tauri::command]
async fn notiz_darstellung_setzen(state: State<'_, AppState>, pfad: String, html: String) -> Result<(), String> {
    let root = state.root()?;
    vault::resolve(&root, &pfad)?;
    if !pfad.to_lowercase().ends_with(".md") {
        return Err("Nur Notizen (.md) werden so dargestellt.".into());
    }
    lock(&state.darstellungen).setzen(&pfad, html);
    Ok(())
}

/// Eigene Bausteine des Vaults („Code-Speicher“), nach Namen sortiert.
#[tauri::command]
async fn eigene_bausteine(state: State<'_, AppState>) -> Result<Vec<eigene::EigenerBaustein>, String> {
    eigene::liste(&state.root()?)
}

/// Speichert einen eigenen Baustein (mit `alter_name`: ändert und benennt ggf. um). Liefert den Namen.
#[tauri::command]
async fn eigenen_baustein_speichern(state: State<'_, AppState>, alter_name: Option<String>, name: String, beschreibung: String, code: String) -> Result<String, String> {
    eigene::speichern(&state.root()?, alter_name.as_deref(), &name, &beschreibung, &code)
}

/// Verschiebt einen eigenen Baustein in den Papierkorb.
#[tauri::command]
async fn eigenen_baustein_loeschen(state: State<'_, AppState>, name: String) -> Result<(), String> {
    eigene::loeschen(&state.root()?, &name)
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

/// Legt eine Notiz (`kind` fehlt oder "notiz") oder eine HTML-Seite (`kind` = "html") an.
#[tauri::command]
async fn create_page(state: State<'_, AppState>, dir: String, title: String, kind: Option<String>) -> Result<String, String> {
    vault::create_page(&state.root()?, &dir, &title, vault::PageType::parse(kind.as_deref())?)
}

#[tauri::command]
async fn create_folder(state: State<'_, AppState>, dir: String, name: String) -> Result<String, String> {
    vault::create_folder(&state.root()?, &dir, &name)
}

#[tauri::command]
async fn rename_entry(state: State<'_, AppState>, path: String, new_name: String) -> Result<String, String> {
    vault::rename_entry(&state.root()?, &path, &new_name)
}

/// Verschiebt eine Seite oder einen Ordner in einen anderen Ordner ("" = Vault-Wurzel).
#[tauri::command]
async fn move_entry(state: State<'_, AppState>, path: String, target_dir: String) -> Result<String, String> {
    vault::move_entry(&state.root()?, &path, &target_dir)
}

#[tauri::command]
async fn delete_entry(state: State<'_, AppState>, path: String) -> Result<(), String> {
    vault::delete_entry(&state.root()?, &path)
}

/// „Im Explorer öffnen“: zeigt eine Seite markiert in ihrem Ordner bzw. öffnet einen Ordner ("" = Vault).
/// Nur Pfade im geöffneten Vault (`vault::explorer_ziel`). Dateien gehen nur an `reveal_item_in_dir`, nie an
/// `open_path`, sonst würde Windows sie mit ihrem Programm starten.
#[tauri::command]
async fn im_explorer_zeigen(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let ziel = vault::explorer_ziel(&state.root()?, &path)?;
    #[cfg(desktop)]
    {
        // Der Explorer-Aufruf blockiert (COM), deshalb in einem eigenen Thread.
        tauri::async_runtime::spawn_blocking(move || match ziel {
            vault::ExplorerZiel::Datei(datei) => tauri_plugin_opener::reveal_item_in_dir(datei),
            vault::ExplorerZiel::Ordner(ordner) => tauri_plugin_opener::open_path(ordner, None::<&str>),
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Der Explorer konnte nicht geöffnet werden: {e}"))
    }
    #[cfg(mobile)]
    {
        let _ = ziel;
        Err("Auf dem Handy gibt es keinen Explorer.".into())
    }
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

/// Betriebssystem ("windows", "android", …), damit die Oberfläche sich anpassen kann.
#[tauri::command]
fn app_platform() -> &'static str {
    std::env::consts::OS
}

/// Android: Symbole der Statusleiste passend zum Modus der App (siehe statusleiste.rs). Am PC ohne Wirkung.
#[tauri::command]
async fn statusleiste_setzen(app: AppHandle, dunkel: bool) -> Result<(), String> {
    statusleiste::setzen(&app, dunkel)
}

/// Startpunkte für die eigene Ordnerauswahl auf dem Handy.
#[tauri::command]
async fn storage_locations(app: AppHandle) -> Result<Vec<vault::FolderEntry>, String> {
    let mut locations = Vec::new();
    if cfg!(target_os = "android") {
        locations.push(vault::FolderEntry { name: "Interner Speicher".into(), path: "/storage/emulated/0".into() });
    } else if let Ok(home) = app.path().home_dir() {
        locations.push(vault::FolderEntry { name: "Benutzerordner".into(), path: path_to_string(&home) });
    }
    // Immer erreichbar, auch ohne Speicher-Berechtigung (wird mit der App gelöscht).
    if let Ok(dir) = app.path().app_data_dir() {
        let vaults = dir.join("Vaults");
        let _ = std::fs::create_dir_all(&vaults);
        locations.push(vault::FolderEntry { name: "App-Speicher".into(), path: path_to_string(&vaults) });
    }
    Ok(locations)
}

#[tauri::command]
async fn list_folders(path: String) -> Result<Vec<vault::FolderEntry>, String> {
    vault::list_folders(Path::new(&path))
}

#[tauri::command]
async fn create_folder_at(parent: String, name: String) -> Result<String, String> {
    vault::create_folder_at(Path::new(&parent), &name)
}

/// Im Modus `--sicherheitstest`: der zu öffnende Test-Vault, sonst null.
#[tauri::command]
async fn sicherheitstest_info(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(lock(&state.security_test).as_ref().map(|test| path_to_string(&test.vault)))
}

/// Sicherheitstest: Diesen Befehl ruft die Testseite aus der abgeschotteten Anzeige auf. Kommt er hier an,
/// könnte eine Seite Tauri-Befehle nutzen – der Test zählt das als Lücke.
#[tauri::command]
async fn sicherheitstest_probe(state: State<'_, AppState>) -> Result<String, String> {
    if lock(&state.security_test).is_some() {
        state.probe_reached.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    Ok("erreicht".into())
}

/// Sicherheitstest: Hat die Testseite `sicherheitstest_probe` erreicht?
#[tauri::command]
async fn sicherheitstest_probe_status(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.probe_reached.load(std::sync::atomic::Ordering::SeqCst))
}

/// Ergebnisse des Sicherheitstests: Tabelle auf der Konsole, aufräumen, App mit Exit-Code beenden.
#[tauri::command]
async fn sicherheitstest_bericht(app: AppHandle, state: State<'_, AppState>, ergebnisse: Vec<security_test::Check>) -> Result<(), String> {
    let test = lock(&state.security_test).clone().ok_or("Es läuft kein Sicherheitstest.")?;
    let (text, passed) = security_test::report(&test.vault, &ergebnisse);
    print!("{text}");
    let _ = std::io::stdout().flush();
    test.cleanup();
    app.exit(if passed { 0 } else { 1 });
    Ok(())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();
    let args: Vec<String> = std::env::args().collect();
    if let Some(position) = args.iter().position(|arg| arg == "--vault") {
        *lock(&state.start_vault) = args.get(position + 1).cloned();
    }
    match security_test::from_args(&args) {
        None => {}
        Some(Ok(test)) => {
            security_test::attach_console();
            *lock(&state.security_test) = Some(test);
        }
        Some(Err(message)) => {
            security_test::attach_console();
            eprintln!("Sicherheitstest: {message}");
            std::process::exit(2);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(statusleiste::init())
        .manage(state)
        // HTML-Seiten für die abgeschottete Anzeige (siehe page_scheme.rs).
        .register_asynchronous_uri_scheme_protocol(page_scheme::SCHEME, |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let path = request.uri().path().to_string();
            std::thread::spawn(move || {
                let state = app.state::<AppState>();
                let root = lock(&state.root).clone();
                let test = lock(&state.security_test).clone();
                let answer = page_scheme::answer(root.as_deref(), &path, "/", |rel| {
                    test.as_ref().and_then(|test| test.virtual_file(rel)).or_else(|| {
                        // Notiz im Notizbuch: die fertig dargestellte Fassung statt des Markdown-Texts
                        lock(&state.darstellungen).holen(rel).map(|html| (html.clone().into_bytes(), "text/html; charset=utf-8"))
                    })
                });
                let mut response = tauri::http::Response::builder().status(answer.status).header("Content-Type", answer.content_type);
                for (name, value) in page_scheme::headers() {
                    response = response.header(name, value);
                }
                match response.body(answer.body) {
                    Ok(response) => responder.respond(response),
                    Err(_) => responder.respond(tauri::http::Response::new(Vec::new())),
                }
            });
        })
        .setup(|app| {
            // Das Fenster startet unsichtbar und erscheint, sobald die Oberfläche Modus und Farben gesetzt hat
            // (src/main.tsx), damit beim Start nichts hell aufblitzt. Zur Sicherheit spätestens nach 3 Sekunden.
            #[cfg(desktop)]
            {
                if let Some(fenster) = app.get_webview_window("main") {
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(3));
                        let _ = fenster.show();
                    });
                }
                // Updates über GitHub Releases (nur am PC). Das Plugin fragt nur, wenn die Oberfläche
                // nach dem Klick auf „Nach Updates suchen“ `check()` aufruft, nie von selbst.
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            // Sicherheitstest: Kommt nach 60 Sekunden kein Ergebnis, gilt er als nicht bestanden.
            if let Some(test) = lock(&app.state::<AppState>().security_test).clone() {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                    println!("Localist – Sicherheitstest: Zeitüberschreitung, die Testseite hat keine Ergebnisse gemeldet. NICHT bestanden.");
                    let _ = std::io::stdout().flush();
                    test.cleanup();
                    handle.exit(2);
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_last_vault,
            open_vault,
            list_tree,
            read_page,
            write_page,
            create_page,
            create_folder,
            rename_entry,
            move_entry,
            delete_entry,
            im_explorer_zeigen,
            resolve_attachment,
            import_attachment,
            vault_index,
            app_platform,
            statusleiste_setzen,
            storage_locations,
            list_folders,
            create_folder_at,
            sicherheitstest_info,
            sicherheitstest_probe,
            sicherheitstest_probe_status,
            sicherheitstest_bericht,
            eigene_bausteine,
            eigenen_baustein_speichern,
            eigenen_baustein_loeschen,
            anhang_pfad,
            datei_base64,
            export_schreiben,
            notiz_darstellung_setzen
        ])
        .run(tauri::generate_context!())
        .expect("Die App konnte nicht gestartet werden");
}
