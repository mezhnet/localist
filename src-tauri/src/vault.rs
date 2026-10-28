//! Dateizugriff auf den Vault. Alle Pfade außer dem Vault-Wurzelpfad sind relativ zum Vault
//! und verwenden "/" als Trenner. Fehler werden als deutsche Meldungen zurückgegeben.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::thread;
use std::time::Duration;

/// Datei, die einen Ordner zur Datenbank macht.
pub const VIEWS_FILE: &str = "_ansichten.yaml";
/// Ein Ordner mit dieser Datei ist ein Notizbuch (außer er ist schon Datenbank).
pub const NOTEBOOK_FILE: &str = "_notizbuch.yaml";

/// Ordner mit den Einstellungen eines Vaults (wie `.obsidian`).
pub const SETTINGS_DIR: &str = ".localist";

/// Früherer Name des Einstellungsordners (Arbeitstitel). Wird beim Öffnen automatisch umbenannt.
pub const LEGACY_SETTINGS_DIRS: [&str; 1] = [".meinapp"];

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Folder,
    Page,
}

/// Art einer Seite: Notiz (`.md`) oder HTML-Seite (`.html`). Die Dateiendung bestimmt den Typ.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageType {
    Note,
    Html,
}

impl PageType {
    pub fn extension(self) -> &'static str {
        match self {
            PageType::Note => "md",
            PageType::Html => "html",
        }
    }

    /// Typ aus der Oberfläche: "notiz" (Standard) oder "html".
    pub fn parse(kind: Option<&str>) -> Result<PageType, String> {
        match kind.unwrap_or("notiz") {
            "notiz" => Ok(PageType::Note),
            "html" => Ok(PageType::Html),
            other => Err(format!("Unbekannter Seitentyp „{other}“.")),
        }
    }
}

const PAGE_TYPES: [PageType; 2] = [PageType::Note, PageType::Html];

/// Ein Eintrag im Ordnerbaum. `name` ist bei Seiten der Titel ohne Endung (".md" oder ".html").
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub kind: NodeKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TreeNode>>,
    /// Ordner mit `_ansichten.yaml`: eine Datenbank.
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub database: bool,
    /// Seite ist eine HTML-Seite (`.html`) statt einer Notiz (`.md`).
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub html: bool,
    /// Ordner mit `_notizbuch.yaml`. Hat er auch `_ansichten.yaml`, gilt er als Datenbank (die Oberfläche zeigt einen Hinweis).
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub notebook: bool,
}

/// Versteckte Einträge (Name beginnt mit ".") erscheinen nicht in der Sidebar.
pub fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

/// Titel und Typ einer Seite aus dem Dateinamen (".md" = Notiz, ".html" = HTML-Seite), sonst None.
pub fn page_file(file_name: &str) -> Option<(String, PageType)> {
    PAGE_TYPES.into_iter().find_map(|page_type| {
        let suffix = format!(".{}", page_type.extension());
        let len = file_name.len();
        let cut = len.checked_sub(suffix.len())?;
        (cut > 0 && file_name.is_char_boundary(cut) && file_name[cut..].eq_ignore_ascii_case(&suffix))
            .then(|| (file_name[..cut].to_string(), page_type))
    })
}

/// Seitentitel aus dem Dateinamen, falls es eine Seite (Notiz oder HTML-Seite) ist.
pub fn page_title(file_name: &str) -> Option<String> {
    page_file(file_name).map(|(title, _)| title)
}

/// Windows unterscheidet keine Groß-/Kleinschreibung: "ideen.md" und "Ideen.md" sind dieselbe Datei.
fn same_path(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
}

/// Liegt im Ordner schon eine Seite mit diesem Titel, egal welchen Typs? `except` ist die Seite selbst
/// (beim Umbenennen). Ein Name darf pro Ordner nur einmal vorkommen, auch über beide Typen hinweg.
fn page_name_taken(folder: &Path, title: &str, except: Option<&Path>) -> bool {
    PAGE_TYPES
        .iter()
        .map(|page_type| folder.join(format!("{title}.{}", page_type.extension())))
        .any(|path| path.exists() && !except.is_some_and(|own| same_path(own, &path)))
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// Inhalt einer neuen HTML-Seite nach dem Speicherformat. `depth` ist die Ordnertiefe der Seite,
/// damit die Verweise auf `.localist/bausteine/` relativ stimmen.
pub fn new_html_page(title: &str, id: &str, depth: usize) -> String {
    let up = "../".repeat(depth);
    format!(
        "<!doctype html>\n<html lang=\"de\">\n<head>\n<meta charset=\"utf-8\">\n\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>{}</title>\n\
         <meta name=\"localist-id\" content=\"{id}\">\n<link rel=\"stylesheet\" href=\"{up}{SETTINGS_DIR}/bausteine/localist.css\">\n\
         <script src=\"{up}{SETTINGS_DIR}/bausteine/localist.js\" defer></script>\n</head>\n<body>\n<main>\n</main>\n</body>\n</html>\n",
        escape_html(title)
    )
}

/// Wandelt einen relativen Vault-Pfad in einen absoluten um und verhindert, dass er den Vault verlässt.
pub fn resolve(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let mut path = root.to_path_buf();
    if rel.is_empty() {
        return Ok(path);
    }
    for part in rel.split('/') {
        if part.is_empty() || part == "." || part == ".." || part.contains(['\\', ':']) {
            return Err(format!("Ungültiger Pfad im Vault: „{rel}“"));
        }
        path.push(part);
    }
    Ok(path)
}

/// Relativer Vault-Pfad mit "/" als Trenner, oder None, wenn der Pfad außerhalb des Vaults liegt.
pub fn to_rel(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts = rel
        .components()
        .map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Option<Vec<_>>>()?;
    Some(parts.join("/"))
}

/// Was „Im Explorer öffnen“ zeigt: eine Datei markiert in ihrem Ordner oder einen Ordner selbst.
#[derive(Debug, PartialEq)]
pub enum ExplorerZiel {
    Datei(PathBuf),
    Ordner(PathBuf),
}

/// Ziel für „Im Explorer öffnen“ ("" = Vault). Der Pfad wird wie bei `resolve` geprüft und muss existieren.
/// Zusätzlich darf er auch über Verknüpfungen (Junctions, symbolische Links) nicht aus dem Vault führen.
pub fn explorer_ziel(root: &Path, rel: &str) -> Result<ExplorerZiel, String> {
    let path = resolve(root, rel)?;
    let echt = fs::canonicalize(&path).map_err(|_| "Der Eintrag existiert nicht mehr.".to_string())?;
    let echte_wurzel = fs::canonicalize(root).map_err(|e| format!("Vault nicht gefunden: {e}"))?;
    if !echt.starts_with(&echte_wurzel) {
        return Err(format!("Ungültiger Pfad im Vault: „{rel}“"));
    }
    if echt.is_dir() {
        Ok(ExplorerZiel::Ordner(path))
    } else if echt.is_file() {
        Ok(ExplorerZiel::Datei(path))
    } else {
        Err("Der Eintrag existiert nicht mehr.".into())
    }
}

/// Prüft einen Datei- oder Ordnernamen auf Zeichen und Namen, die Windows nicht erlaubt.
pub fn validate_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Der Name darf nicht leer sein.".into());
    }
    if name.starts_with('.') {
        return Err("Der Name darf nicht mit einem Punkt beginnen.".into());
    }
    if name.ends_with('.') {
        return Err("Der Name darf nicht mit einem Punkt enden.".into());
    }
    const FORBIDDEN: [char; 9] = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
    if name.chars().any(|c| FORBIDDEN.contains(&c) || c.is_control()) {
        return Err("Der Name darf diese Zeichen nicht enthalten: \\ / : * ? \" < > |".into());
    }
    let stem = name.split('.').next().unwrap_or_default().trim().to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit());
    if reserved {
        return Err(format!("„{name}“ ist unter Windows als Name nicht erlaubt."));
    }
    if name.chars().count() > 200 {
        return Err("Der Name ist zu lang (höchstens 200 Zeichen).".into());
    }
    Ok(name.to_string())
}

/// Kompletter Ordnerbaum: Ordner zuerst, dann Seiten, alphabetisch; versteckte Einträge fehlen.
pub fn list_tree(root: &Path) -> Result<Vec<TreeNode>, String> {
    if !root.is_dir() {
        return Err(format!("Der Vault-Ordner „{}“ wurde nicht gefunden.", root.display()));
    }
    Ok(list_dir(root, root))
}

fn list_dir(root: &Path, dir: &Path) -> Vec<TreeNode> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut folders = Vec::new();
    let mut pages = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_hidden(&name) {
            continue;
        }
        // file_type() folgt keinen Verknüpfungen: Symlinks werden übersprungen, damit keine Schleifen entstehen.
        let Ok(file_type) = entry.file_type() else { continue };
        let path = entry.path();
        let Some(rel) = to_rel(root, &path) else { continue };
        if file_type.is_dir() {
            let children = list_dir(root, &path);
            let database = path.join(VIEWS_FILE).is_file();
            let notebook = path.join(NOTEBOOK_FILE).is_file();
            folders.push(TreeNode { name, path: rel, kind: NodeKind::Folder, children: Some(children), database, html: false, notebook });
        } else if file_type.is_file() {
            if let Some((title, page_type)) = page_file(&name) {
                let html = page_type == PageType::Html;
                pages.push(TreeNode { name: title, path: rel, kind: NodeKind::Page, children: None, database: false, html, notebook: false });
            }
        }
    }
    folders.sort_by_key(|node| node.name.to_lowercase());
    pages.sort_by_key(|node| node.name.to_lowercase());
    folders.extend(pages);
    folders
}

pub(crate) fn display_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

pub fn read_text(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => format!("Die Datei „{}“ wurde nicht gefunden.", display_name(path)),
        _ => format!("Die Datei „{}“ konnte nicht gelesen werden: {e}", display_name(path)),
    })?;
    String::from_utf8(bytes)
        .map_err(|_| format!("Die Datei „{}“ ist keine gültige UTF-8-Textdatei.", display_name(path)))
}

/// Schreibt atomar: erst in eine versteckte temporäre Datei im selben Ordner, dann umbenennen.
/// So ist die Datei bei einem Absturz entweder ganz alt oder ganz neu, aber nie halb geschrieben.
pub fn write_atomic(path: &Path, content: &[u8]) -> Result<(), String> {
    let error = |e: std::io::Error| format!("„{}“ konnte nicht gespeichert werden: {e}", display_name(path));
    let dir = path.parent().ok_or_else(|| format!("Ungültiger Speicherort: {}", path.display()))?;
    if !dir.is_dir() {
        return Err(format!("Der Ordner für „{}“ existiert nicht mehr.", display_name(path)));
    }
    let tmp = dir.join(format!(".{}.{}.tmp", display_name(path), uuid::Uuid::new_v4().simple()));

    let written = (|| {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(content)?;
        file.sync_all()
    })();
    if let Err(e) = written {
        let _ = fs::remove_file(&tmp);
        return Err(error(e));
    }

    // Unter Windows kann das Umbenennen kurz scheitern, wenn ein anderes Programm (z. B. ein
    // Virenscanner) die Zieldatei gerade geöffnet hat. Deshalb einige Male wiederholen.
    let mut attempt = 0;
    loop {
        match fs::rename(&tmp, path) {
            Ok(()) => return Ok(()),
            Err(_) if attempt < 10 => {
                attempt += 1;
                thread::sleep(Duration::from_millis(30));
            }
            Err(e) => {
                let _ = fs::remove_file(&tmp);
                return Err(error(e));
            }
        }
    }
}

/// Legt den Einstellungsordner an, falls er fehlt (macht den Ordner zum Vault).
/// Gibt es nur den Ordner unter altem Namen, wird er umbenannt: bestehende Vaults werden übernommen.
pub fn ensure_settings(root: &Path) -> Result<(), String> {
    let dir = root.join(SETTINGS_DIR);
    if !dir.exists() {
        if let Some(legacy) = LEGACY_SETTINGS_DIRS.iter().map(|name| root.join(name)).find(|path| path.is_dir()) {
            fs::rename(&legacy, &dir).map_err(|e| {
                format!("Der Einstellungsordner „{}“ konnte nicht in „{SETTINGS_DIR}“ umbenannt werden: {e}", display_name(&legacy))
            })?;
        }
    }
    let file = dir.join("settings.json");
    if file.exists() {
        return Ok(());
    }
    fs::create_dir_all(&dir).map_err(|e| format!("Der Einstellungsordner konnte nicht angelegt werden: {e}"))?;
    write_atomic(&file, b"{\n  \"version\": 1\n}\n")
}

/// Legt eine neue Seite an: `<dir>/<title>.md` mit Frontmatter (id) oder `<dir>/<title>.html` nach dem
/// Speicherformat (mit `localist-id`). Liefert den relativen Pfad.
pub fn create_page(root: &Path, dir: &str, title: &str, page_type: PageType) -> Result<String, String> {
    let title = validate_name(title)?;
    let folder = resolve(root, dir)?;
    if !folder.is_dir() {
        return Err("Der Zielordner existiert nicht.".into());
    }
    if page_name_taken(&folder, &title, None) {
        return Err(format!("Hier gibt es schon eine Seite „{title}“."));
    }
    let path = folder.join(format!("{title}.{}", page_type.extension()));
    let id = uuid::Uuid::new_v4().to_string();
    let content = match page_type {
        PageType::Note => format!("---\nid: {id}\n---\n"),
        PageType::Html => new_html_page(&title, &id, dir.split('/').filter(|part| !part.is_empty()).count()),
    };
    write_atomic(&path, content.as_bytes())?;
    to_rel(root, &path).ok_or_else(|| "Ungültiger Pfad.".into())
}

/// Legt `<dir>/<name>` an und liefert den relativen Pfad. `dir` = "" für die Vault-Wurzel.
pub fn create_folder(root: &Path, dir: &str, name: &str) -> Result<String, String> {
    let name = validate_name(name)?;
    let parent = resolve(root, dir)?;
    if !parent.is_dir() {
        return Err("Der Zielordner existiert nicht.".into());
    }
    let path = parent.join(&name);
    if path.exists() {
        return Err(format!("Hier gibt es schon einen Ordner oder eine Datei „{name}“."));
    }
    fs::create_dir(&path).map_err(|e| format!("Der Ordner „{name}“ konnte nicht angelegt werden: {e}"))?;
    to_rel(root, &path).ok_or_else(|| "Ungültiger Pfad.".into())
}

/// Benennt um (Seiten: neuer Titel ohne Endung, die Endung bleibt). Liefert den neuen relativen Pfad.
pub fn rename_entry(root: &Path, rel: &str, new_name: &str) -> Result<String, String> {
    if rel.is_empty() {
        return Err("Der Vault selbst kann hier nicht umbenannt werden.".into());
    }
    let source = resolve(root, rel)?;
    if !source.exists() {
        return Err("Der Eintrag existiert nicht mehr.".into());
    }
    let name = validate_name(new_name)?;
    let page_type = if source.is_dir() { None } else { page_file(&display_name(&source)).map(|(_, page_type)| page_type) };
    let file_name = match page_type {
        Some(page_type) => format!("{name}.{}", page_type.extension()),
        None => name.clone(),
    };
    let target = source.with_file_name(&file_name);
    let folder = source.parent().ok_or("Ungültiger Pfad.")?;
    // Nur Groß-/Kleinschreibung ändern ("ideen" → "Ideen") ist derselbe Eintrag und erlaubt.
    let taken = match page_type {
        Some(_) => page_name_taken(folder, &name, Some(&source)),
        None => target.exists() && !same_path(&source, &target),
    };
    if taken {
        return Err(format!("Hier gibt es schon einen Eintrag „{name}“."));
    }
    fs::rename(&source, &target).map_err(|e| format!("Umbenennen fehlgeschlagen: {e}"))?;
    to_rel(root, &target).ok_or_else(|| "Ungültiger Pfad.".into())
}

/// Verschiebt eine Seite oder einen Ordner in einen anderen Ordner (`target_dir` = "" für die Vault-Wurzel).
/// Liefert den neuen relativen Pfad. Links passt danach die Oberfläche an.
pub fn move_entry(root: &Path, rel: &str, target_dir: &str) -> Result<String, String> {
    if rel.is_empty() {
        return Err("Der Vault selbst kann nicht verschoben werden.".into());
    }
    let source = resolve(root, rel)?;
    if !source.exists() {
        return Err("Der Eintrag existiert nicht mehr.".into());
    }
    if target_dir.split('/').any(is_hidden) {
        return Err("In versteckte Ordner kann nicht verschoben werden.".into());
    }
    let folder = resolve(root, target_dir)?;
    if !folder.is_dir() {
        return Err("Der Zielordner existiert nicht.".into());
    }
    let (rel_lower, target_lower) = (rel.to_lowercase(), target_dir.to_lowercase());
    if target_lower == rel_lower || target_lower.starts_with(&format!("{rel_lower}/")) {
        return Err("Ein Ordner kann nicht in sich selbst verschoben werden.".into());
    }
    let name = display_name(&source);
    let target = folder.join(&name);
    if same_path(&source, &target) {
        return Ok(rel.to_string());
    }
    let taken = match page_file(&name) {
        Some((title, _)) if source.is_file() => page_name_taken(&folder, &title, None),
        _ => target.exists(),
    };
    if taken {
        let shown = page_title(&name).filter(|_| source.is_file()).unwrap_or(name.clone());
        return Err(format!("Im Zielordner gibt es schon einen Eintrag „{shown}“."));
    }
    fs::rename(&source, &target).map_err(|e| format!("Verschieben fehlgeschlagen: {e}"))?;
    to_rel(root, &target).ok_or_else(|| "Ungültiger Pfad.".into())
}

/// Verschiebt eine Seite oder einen Ordner in den Papierkorb des Systems.
pub fn delete_entry(root: &Path, rel: &str) -> Result<(), String> {
    if rel.is_empty() {
        return Err("Der Vault selbst kann hier nicht gelöscht werden.".into());
    }
    let path = resolve(root, rel)?;
    if !path.exists() {
        return Err("Der Eintrag existiert nicht mehr.".into());
    }
    move_to_trash(root, &path)
}

#[cfg(not(target_os = "android"))]
pub(crate) fn move_to_trash(_root: &Path, path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|e| format!("„{}“ konnte nicht in den Papierkorb verschoben werden: {e}", display_name(path)))
}

#[cfg(target_os = "android")]
pub(crate) fn move_to_trash(root: &Path, path: &Path) -> Result<(), String> {
    vault_trash(root, path).map(|_| ())
}

/// Papierkorb im Vault (für Android, das keinen System-Papierkorb hat): verschiebt den Eintrag nach
/// `.localist/Papierkorb/`. Von dort lässt er sich mit jedem Dateimanager zurückholen.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn vault_trash(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let bin = root.join(SETTINGS_DIR).join("Papierkorb");
    fs::create_dir_all(&bin).map_err(|e| format!("Der Papierkorb im Vault konnte nicht angelegt werden: {e}"))?;
    let name = display_name(path);
    let mut target = bin.join(&name);
    let mut number = 2;
    while target.exists() {
        target = bin.join(format!("{name} ({number})"));
        number += 1;
    }
    fs::rename(path, &target).map_err(|e| format!("„{name}“ konnte nicht in den Papierkorb verschoben werden: {e}"))?;
    Ok(target)
}

/// Ein Ordner für die Ordnerauswahl auf dem Handy.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FolderEntry {
    pub name: String,
    pub path: String,
}

/// Unterordner (ohne versteckte) eines absoluten Pfads, alphabetisch – für die eigene Ordnerauswahl auf
/// Android, wo der System-Dialog keine normalen Dateipfade liefert.
pub fn list_folders(dir: &Path) -> Result<Vec<FolderEntry>, String> {
    let entries = fs::read_dir(dir).map_err(|e| match e.kind() {
        std::io::ErrorKind::PermissionDenied => "Kein Zugriff auf diesen Ordner. Erlaube Localist in den Android-Einstellungen den „Zugriff auf alle Dateien“.".to_string(),
        std::io::ErrorKind::NotFound => format!("Der Ordner „{}“ wurde nicht gefunden.", dir.display()),
        _ => format!("Der Ordner „{}“ konnte nicht gelesen werden: {e}", dir.display()),
    })?;
    let mut folders: Vec<FolderEntry> = entries
        .flatten()
        .filter(|entry| entry.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|entry| FolderEntry { name: entry.file_name().to_string_lossy().into_owned(), path: entry.path().to_string_lossy().into_owned() })
        .filter(|folder| !is_hidden(&folder.name))
        .collect();
    folders.sort_by_key(|folder| folder.name.to_lowercase());
    Ok(folders)
}

/// Legt einen neuen Ordner (z. B. für einen neuen Vault) in einem absoluten Pfad an.
pub fn create_folder_at(parent: &Path, name: &str) -> Result<String, String> {
    let name = validate_name(name)?;
    let path = parent.join(&name);
    if path.exists() {
        return Err(format!("Hier gibt es schon einen Ordner „{name}“."));
    }
    fs::create_dir_all(&path).map_err(|e| format!("Der Ordner „{name}“ konnte nicht angelegt werden: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Ordner für Bilder, die von außerhalb in den Vault übernommen werden.
pub const ATTACHMENTS_DIR: &str = "Anhänge";

/// Macht ein Bild im Vault verfügbar und liefert seinen relativen Pfad. Liegt es schon im Vault,
/// bleibt es, wo es ist. Sonst wird es nach "Anhänge/" kopiert (bei Namensgleichheit mit Nummer).
pub fn import_attachment(root: &Path, source: &Path) -> Result<String, String> {
    if !source.is_file() {
        return Err(format!("Die Datei „{}“ wurde nicht gefunden.", display_name(source)));
    }
    if let Some(rel) = to_rel(root, source).filter(|rel| !rel.is_empty()) {
        return Ok(rel);
    }
    let dir = root.join(ATTACHMENTS_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("Der Ordner „{ATTACHMENTS_DIR}“ konnte nicht angelegt werden: {e}"))?;
    let name = display_name(source);
    let (stem, ext) = match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => (stem.to_string(), format!(".{ext}")),
        _ => (name.clone(), String::new()),
    };
    let mut target = dir.join(&name);
    let mut number = 2;
    while target.exists() {
        target = dir.join(format!("{stem} {number}{ext}"));
        number += 1;
    }
    fs::copy(source, &target).map_err(|e| format!("„{name}“ konnte nicht in den Vault kopiert werden: {e}"))?;
    to_rel(root, &target).ok_or_else(|| "Ungültiger Pfad.".into())
}

/// Löst ein Bild aus einer Seite zu einem absoluten Pfad auf: erst relativ zur Seite,
/// dann relativ zur Vault-Wurzel (so macht es Obsidian). None, wenn nichts gefunden wurde.
pub fn resolve_attachment(root: &Path, page: &str, target: &str) -> Option<PathBuf> {
    let target = percent_decode(target.split(['#', '?']).next().unwrap_or_default());
    let target = target.trim_start_matches("./");
    if target.is_empty() || target.contains("://") || target.starts_with('/') {
        return None;
    }
    let page_dir = page.rsplit_once('/').map(|(dir, _)| dir).unwrap_or("");
    let mut candidates = Vec::new();
    if !page_dir.is_empty() {
        candidates.push(format!("{page_dir}/{target}"));
    }
    candidates.push(target.to_string());
    candidates
        .into_iter()
        .filter_map(|rel| normalize_rel(&rel))
        .filter_map(|rel| resolve(root, &rel).ok())
        .find(|path| path.is_file())
}

/// Löst "../" in einem relativen Pfad auf. None, wenn der Pfad den Vault verlassen würde.
fn normalize_rel(rel: &str) -> Option<String> {
    let mut parts: Vec<&str> = Vec::new();
    for part in rel.split(['/', '\\']) {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            other => parts.push(other),
        }
    }
    Some(parts.join("/"))
}

fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(high * 16 + low);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| text.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Temporärer Test-Vault, der am Ende wieder gelöscht wird.
    struct TestVault(PathBuf);

    impl TestVault {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!("localist-test-{}", uuid::Uuid::new_v4().simple()));
            fs::create_dir_all(&dir).unwrap();
            TestVault(dir)
        }
        fn file(&self, rel: &str, content: &str) {
            let path = self.0.join(rel);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, content).unwrap();
        }
    }

    impl Drop for TestVault {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn ordnerbaum_zeigt_ordner_und_seiten_ohne_versteckte_eintraege() {
        let vault = TestVault::new();
        vault.file(".localist/settings.json", "{}");
        vault.file(".git/config", "");
        vault.file("Notizen/Ideen.md", "# Ideen");
        vault.file("Notizen/.versteckt.md", "");
        vault.file("Projekte/_ansichten.yaml", "");
        vault.file("Projekte/Umzug.md", "");
        vault.file("Anhänge/skizze.png", "");
        vault.file("aufgaben.MD", "");
        vault.file("zettel.txt", "");

        let tree = list_tree(&vault.0).unwrap();
        let names: Vec<_> = tree.iter().map(|n| (n.name.as_str(), n.kind)).collect();
        assert_eq!(
            names,
            vec![
                ("Anhänge", NodeKind::Folder),
                ("Notizen", NodeKind::Folder),
                ("Projekte", NodeKind::Folder),
                ("aufgaben", NodeKind::Page),
            ]
        );
        assert_eq!(tree[0].children.as_ref().unwrap().len(), 0);
        let notizen = tree[1].children.as_ref().unwrap();
        assert_eq!(notizen.len(), 1);
        assert_eq!(notizen[0].path, "Notizen/Ideen.md");
        assert_eq!(tree[2].children.as_ref().unwrap()[0].name, "Umzug");
        assert!(tree[2].database, "Projekte hat _ansichten.yaml und ist eine Datenbank");
        assert!(!tree[2].notebook && !tree[1].notebook, "ohne _notizbuch.yaml kein Notizbuch");
        assert!(!tree[1].database);
    }

    #[test]
    fn ordner_mit_notizbuch_datei_ist_ein_notizbuch() {
        let vault = TestVault::new();
        vault.file("Lernen/_notizbuch.yaml", "titel: Lernen\nseiten:\n  - DNS.html\n");
        vault.file("Lernen/DNS.html", "<!doctype html>");
        vault.file("Lernen/Subnetting.md", "# Subnetting");

        let tree = list_tree(&vault.0).unwrap();
        assert!(tree[0].notebook && !tree[0].database);
        // _notizbuch.yaml ist keine Seite und erscheint nicht im Baum
        let seiten: Vec<_> = tree[0].children.as_ref().unwrap().iter().map(|n| n.path.as_str()).collect();
        assert_eq!(seiten, vec!["Lernen/DNS.html", "Lernen/Subnetting.md"]);
        assert!(serde_json::to_string(&tree[0]).unwrap().contains("\"notebook\":true"));
    }

    #[test]
    fn pfade_duerfen_den_vault_nicht_verlassen() {
        let root = Path::new("C:/vault");
        assert!(resolve(root, "../geheim.md").is_err());
        assert!(resolve(root, "a/../../b.md").is_err());
        assert!(resolve(root, "C:/Windows").is_err());
        assert!(resolve(root, "a\\b.md").is_err());
        assert_eq!(resolve(root, "Notizen/Ideen.md").unwrap(), root.join("Notizen").join("Ideen.md"));
        assert_eq!(resolve(root, "").unwrap(), root.to_path_buf());
    }

    #[test]
    fn im_explorer_nur_eintraege_im_vault() {
        let vault = TestVault::new();
        vault.file("Notizen/Ideen.md", "# Ideen");
        vault.file("Notizen/DNS.html", "<main></main>");
        let root = &vault.0;
        assert_eq!(explorer_ziel(root, "Notizen/Ideen.md").unwrap(), ExplorerZiel::Datei(root.join("Notizen").join("Ideen.md")));
        assert_eq!(explorer_ziel(root, "Notizen/DNS.html").unwrap(), ExplorerZiel::Datei(root.join("Notizen").join("DNS.html")));
        assert_eq!(explorer_ziel(root, "Notizen").unwrap(), ExplorerZiel::Ordner(root.join("Notizen")));
        assert_eq!(explorer_ziel(root, "").unwrap(), ExplorerZiel::Ordner(root.clone()));
        for falsch in ["../geheim.md", "Notizen/../../x", "C:/Windows", "C:\\Windows", "Notizen\\Ideen.md", "/Windows", "./Notizen", "Notizen//Ideen.md"] {
            assert!(explorer_ziel(root, falsch).unwrap_err().starts_with("Ungültiger Pfad"), "{falsch}");
        }
        assert_eq!(explorer_ziel(root, "Notizen/Fehlt.md").unwrap_err(), "Der Eintrag existiert nicht mehr.");
    }

    #[cfg(windows)]
    #[test]
    fn im_explorer_keine_verknuepfung_aus_dem_vault_heraus() {
        let vault = TestVault::new();
        let draussen = TestVault::new();
        draussen.file("geheim.md", "");
        // Eine Junction braucht unter Windows keine besonderen Rechte (anders als ein symbolischer Link).
        let status = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(vault.0.join("Ausgang"))
            .arg(&draussen.0)
            .output()
            .unwrap();
        assert!(status.status.success(), "{}", String::from_utf8_lossy(&status.stderr));
        assert!(explorer_ziel(&vault.0, "Ausgang").unwrap_err().starts_with("Ungültiger Pfad"));
        assert!(explorer_ziel(&vault.0, "Ausgang/geheim.md").unwrap_err().starts_with("Ungültiger Pfad"));
    }

    #[test]
    fn namen_werden_geprueft() {
        assert_eq!(validate_name("  Ideen  ").unwrap(), "Ideen");
        assert!(validate_name("").is_err());
        assert!(validate_name(".versteckt").is_err());
        assert!(validate_name("a/b").is_err());
        assert!(validate_name("Frage?").is_err());
        assert!(validate_name("CON").is_err());
        assert!(validate_name("com1.txt").is_err());
        assert!(validate_name("Ende.").is_err());
        assert!(validate_name("Größe & Maße (2026)").is_ok());
    }

    #[test]
    fn atomares_schreiben_ersetzt_den_inhalt_ohne_temporaere_dateien() {
        let vault = TestVault::new();
        let path = vault.0.join("Seite.md");
        write_atomic(&path, "alt".as_bytes()).unwrap();
        write_atomic(&path, "neu – mit Umlauten äöü".as_bytes()).unwrap();
        assert_eq!(read_text(&path).unwrap(), "neu – mit Umlauten äöü");
        let entries: Vec<_> = fs::read_dir(&vault.0).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(entries.len(), 1, "keine temporären Dateien übrig: {entries:?}");
    }

    #[test]
    fn seite_anlegen_umbenennen_und_ordner_anlegen() {
        let vault = TestVault::new();
        let folder = create_folder(&vault.0, "", "Projekte").unwrap();
        assert_eq!(folder, "Projekte");
        assert!(create_folder(&vault.0, "", "Projekte").is_err());

        let page = create_page(&vault.0, "Projekte", "Umzug", PageType::Note).unwrap();
        assert_eq!(page, "Projekte/Umzug.md");
        let content = read_text(&vault.0.join("Projekte/Umzug.md")).unwrap();
        assert!(content.starts_with("---\nid: "), "Frontmatter mit id: {content}");
        assert_eq!(content.lines().nth(1).unwrap().len(), "id: ".len() + 36);
        assert!(create_page(&vault.0, "Projekte", "Umzug", PageType::Note).is_err());

        let renamed = rename_entry(&vault.0, "Projekte/Umzug.md", "Umzug 2027").unwrap();
        assert_eq!(renamed, "Projekte/Umzug 2027.md");
        assert_eq!(read_text(&vault.0.join("Projekte/Umzug 2027.md")).unwrap(), content);

        // Nur Groß-/Kleinschreibung ändern ist erlaubt.
        assert_eq!(rename_entry(&vault.0, "Projekte/Umzug 2027.md", "umzug 2027").unwrap(), "Projekte/umzug 2027.md");

        create_page(&vault.0, "Projekte", "Andere", PageType::Note).unwrap();
        assert!(rename_entry(&vault.0, "Projekte/Andere.md", "umzug 2027").is_err());

        let renamed_folder = rename_entry(&vault.0, "Projekte", "Archiv").unwrap();
        assert_eq!(renamed_folder, "Archiv");
        assert!(vault.0.join("Archiv/Andere.md").is_file());
    }

    #[test]
    fn einstellungsordner_wird_angelegt() {
        let vault = TestVault::new();
        ensure_settings(&vault.0).unwrap();
        assert!(vault.0.join(".localist/settings.json").is_file());
        // Vorhandene Einstellungen bleiben unverändert.
        fs::write(vault.0.join(".localist/settings.json"), "{\"version\":1,\"eigenes\":true}").unwrap();
        ensure_settings(&vault.0).unwrap();
        assert_eq!(read_text(&vault.0.join(".localist/settings.json")).unwrap(), "{\"version\":1,\"eigenes\":true}");
    }

    #[test]
    fn alter_einstellungsordner_meinapp_wird_uebernommen() {
        let vault = TestVault::new();
        vault.file(".meinapp/settings.json", "{\"version\":1,\"eigenschaften\":{\"fällig\":\"datum\"}}");
        vault.file(".meinapp/weitere-datei.json", "bleibt");
        ensure_settings(&vault.0).unwrap();
        assert!(!vault.0.join(".meinapp").exists(), "alter Ordner ist umbenannt");
        assert_eq!(read_text(&vault.0.join(".localist/settings.json")).unwrap(), "{\"version\":1,\"eigenschaften\":{\"fällig\":\"datum\"}}");
        assert_eq!(read_text(&vault.0.join(".localist/weitere-datei.json")).unwrap(), "bleibt");

        // Gibt es schon beide Ordner, bleibt alles, wie es ist.
        let both = TestVault::new();
        both.file(".meinapp/settings.json", "alt");
        both.file(".localist/settings.json", "neu");
        ensure_settings(&both.0).unwrap();
        assert_eq!(read_text(&both.0.join(".localist/settings.json")).unwrap(), "neu");
        assert!(both.0.join(".meinapp/settings.json").is_file());
    }

    #[test]
    fn bilder_werden_relativ_zur_seite_oder_zum_vault_gefunden() {
        let vault = TestVault::new();
        vault.file("Anhänge/skizze.png", "png");
        vault.file("Notizen/bild 1.png", "png");
        assert_eq!(
            resolve_attachment(&vault.0, "Notizen/Formatierung.md", "Anhänge/skizze.png"),
            Some(vault.0.join("Anhänge").join("skizze.png"))
        );
        assert_eq!(
            resolve_attachment(&vault.0, "Notizen/Formatierung.md", "bild%201.png"),
            Some(vault.0.join("Notizen").join("bild 1.png"))
        );
        assert_eq!(
            resolve_attachment(&vault.0, "Notizen/Formatierung.md", "../Anhänge/skizze.png"),
            Some(vault.0.join("Anhänge").join("skizze.png"))
        );
        assert_eq!(resolve_attachment(&vault.0, "Notizen/A.md", "../../aussen.png"), None);
        assert_eq!(resolve_attachment(&vault.0, "Notizen/A.md", "https://example.com/a.png"), None);
        assert_eq!(resolve_attachment(&vault.0, "Notizen/A.md", "fehlt.png"), None);
    }

    #[test]
    fn bilder_von_aussen_werden_nach_anhaenge_kopiert() {
        let vault = TestVault::new();
        let outside = TestVault::new();
        outside.file("Urlaub.jpg", "jpg");
        vault.file("Anhänge/Urlaub.jpg", "alt");
        vault.file("Bilder/drin.png", "png");

        // Schon im Vault: nur der Pfad, keine Kopie.
        assert_eq!(import_attachment(&vault.0, &vault.0.join("Bilder/drin.png")).unwrap(), "Bilder/drin.png");
        // Von außen: Kopie mit freiem Namen, das vorhandene Bild bleibt unverändert.
        assert_eq!(import_attachment(&vault.0, &outside.0.join("Urlaub.jpg")).unwrap(), "Anhänge/Urlaub 2.jpg");
        assert_eq!(read_text(&vault.0.join("Anhänge/Urlaub 2.jpg")).unwrap(), "jpg");
        assert_eq!(read_text(&vault.0.join("Anhänge/Urlaub.jpg")).unwrap(), "alt");
        assert!(import_attachment(&vault.0, &outside.0.join("fehlt.png")).is_err());
    }

    #[test]
    fn verstaendliche_fehlermeldungen_auf_deutsch() {
        let vault = TestVault::new();
        fs::write(vault.0.join("Binär.md"), [0xff, 0xfe, 0x00, 0x41]).unwrap();
        assert_eq!(read_text(&vault.0.join("Binär.md")).unwrap_err(), "Die Datei „Binär.md“ ist keine gültige UTF-8-Textdatei.");
        assert_eq!(read_text(&vault.0.join("Fehlt.md")).unwrap_err(), "Die Datei „Fehlt.md“ wurde nicht gefunden.");
        let missing = vault.0.join("weg");
        assert!(list_tree(&missing).unwrap_err().starts_with("Der Vault-Ordner"));
        assert_eq!(write_atomic(&missing.join("A.md"), b"x").unwrap_err(), "Der Ordner für „A.md“ existiert nicht mehr.");
        assert!(delete_entry(&vault.0, "").unwrap_err().contains("Vault selbst"));
    }

    #[test]
    fn papierkorb_im_vault_fuer_android() {
        let vault = TestVault::new();
        vault.file("Notizen/Ideen.md", "eins");
        let first = vault_trash(&vault.0, &vault.0.join("Notizen/Ideen.md")).unwrap();
        assert_eq!(first, vault.0.join(".localist").join("Papierkorb").join("Ideen.md"));
        vault.file("Notizen/Ideen.md", "zwei");
        let second = vault_trash(&vault.0, &vault.0.join("Notizen/Ideen.md")).unwrap();
        assert_eq!(second.file_name().unwrap().to_string_lossy(), "Ideen.md (2)");
        assert_eq!(read_text(&first).unwrap(), "eins");
        assert!(!vault.0.join("Notizen/Ideen.md").exists());
        // Der Papierkorb ist versteckt und taucht nicht in der Sidebar auf.
        assert_eq!(list_tree(&vault.0).unwrap().len(), 1);
    }

    #[test]
    fn ordnerauswahl_listet_unterordner_und_legt_neue_an() {
        let vault = TestVault::new();
        vault.file("Documents/a.md", "");
        vault.file("Download/b.txt", "");
        vault.file(".versteckt/c", "");
        vault.file("datei.txt", "");
        let names: Vec<_> = list_folders(&vault.0).unwrap().into_iter().map(|f| f.name).collect();
        assert_eq!(names, vec!["Documents", "Download"]);
        let created = create_folder_at(&vault.0.join("Documents"), "Mein Vault").unwrap();
        assert!(Path::new(&created).is_dir());
        assert!(create_folder_at(&vault.0.join("Documents"), "Mein Vault").is_err());
        assert!(list_folders(&vault.0.join("fehlt")).unwrap_err().contains("nicht gefunden"));
    }

    #[test]
    fn seitentitel_aus_dateinamen() {
        assert_eq!(page_title("Ideen.md"), Some("Ideen".into()));
        assert_eq!(page_title("Notiz.MD"), Some("Notiz".into()));
        assert_eq!(page_title("Bild.png"), None);
        assert_eq!(page_title(".md"), None);
        assert_eq!(page_title("Äpfel.md"), Some("Äpfel".into()));
    }

    #[test]
    fn seitentyp_aus_dateinamen() {
        assert_eq!(page_file("DNS.html"), Some(("DNS".into(), PageType::Html)));
        assert_eq!(page_file("Übersicht.HTML"), Some(("Übersicht".into(), PageType::Html)));
        assert_eq!(page_file("Ideen.md"), Some(("Ideen".into(), PageType::Note)));
        assert_eq!(page_file("Version 1.2.md"), Some(("Version 1.2".into(), PageType::Note)));
        assert_eq!(page_file("alt.htm"), None);
        assert_eq!(page_file(".html"), None);
        assert_eq!(page_title("DNS.html"), Some("DNS".into()));
    }

    #[test]
    fn html_seiten_erscheinen_im_ordnerbaum() {
        let vault = TestVault::new();
        vault.file("Lernen/DNS.html", "<!doctype html>");
        vault.file("Lernen/Subnetting.md", "");
        vault.file("Lernen/alt.htm", "");
        let tree = list_tree(&vault.0).unwrap();
        let pages = tree[0].children.as_ref().unwrap();
        assert_eq!(pages.iter().map(|n| (n.name.as_str(), n.path.as_str(), n.html)).collect::<Vec<_>>(), vec![
            ("DNS", "Lernen/DNS.html", true),
            ("Subnetting", "Lernen/Subnetting.md", false),
        ]);
        let json = serde_json::to_string(&pages[0]).unwrap();
        assert!(json.contains("\"html\":true"), "{json}");
        assert!(!serde_json::to_string(&pages[1]).unwrap().contains("html"));
    }

    #[test]
    fn html_seite_wird_nach_dem_speicherformat_angelegt() {
        let vault = TestVault::new();
        fs::create_dir_all(vault.0.join("Lernen/Netze")).unwrap();
        let path = create_page(&vault.0, "Lernen/Netze", "DNS & Ports", PageType::Html).unwrap();
        assert_eq!(path, "Lernen/Netze/DNS & Ports.html");
        let content = read_text(&vault.0.join(&path)).unwrap();
        let id_line = content.lines().find(|line| line.starts_with("<meta name=\"localist-id\"")).unwrap();
        let id = id_line.trim_start_matches("<meta name=\"localist-id\" content=\"").trim_end_matches("\">");
        assert_eq!(id.len(), 36, "{id_line}");
        assert_eq!(content, new_html_page("DNS & Ports", id, 2));
        assert!(content.contains("<title>DNS &amp; Ports</title>"));
        assert!(new_html_page("a<b>", "x", 0).contains("<title>a&lt;b&gt;</title>"));
        assert!(content.contains("<link rel=\"stylesheet\" href=\"../../.localist/bausteine/localist.css\">"));
        assert!(content.contains("<script src=\"../../.localist/bausteine/localist.js\" defer></script>"));
        assert!(content.contains("<main>\n</main>"));
        // In der Vault-Wurzel ohne "../"
        let root_page = create_page(&vault.0, "", "Start", PageType::Html).unwrap();
        assert!(read_text(&vault.0.join(root_page)).unwrap().contains("href=\".localist/bausteine/localist.css\""));
    }

    #[test]
    fn ein_name_gilt_pro_ordner_fuer_beide_typen() {
        let vault = TestVault::new();
        create_page(&vault.0, "", "Ideen", PageType::Note).unwrap();
        assert!(create_page(&vault.0, "", "Ideen", PageType::Html).unwrap_err().contains("schon eine Seite"));
        assert!(create_page(&vault.0, "", "ideen", PageType::Html).is_err());
        create_page(&vault.0, "", "DNS", PageType::Html).unwrap();
        assert!(create_page(&vault.0, "", "DNS", PageType::Note).is_err());
        // Umbenennen: Endung bleibt, Name darf nicht schon als anderer Typ vorkommen.
        assert!(rename_entry(&vault.0, "Ideen.md", "DNS").is_err());
        assert!(rename_entry(&vault.0, "DNS.html", "ideen").is_err());
        assert_eq!(rename_entry(&vault.0, "DNS.html", "Namensauflösung").unwrap(), "Namensauflösung.html");
        assert_eq!(rename_entry(&vault.0, "Namensauflösung.html", "namensauflösung").unwrap(), "namensauflösung.html");
    }

    #[test]
    fn seiten_und_ordner_lassen_sich_verschieben() {
        let vault = TestVault::new();
        vault.file("Notizen/Ideen.md", "a");
        vault.file("Notizen/DNS.html", "b");
        vault.file("Archiv/Ideen.html", "c");
        vault.file("Archiv/Alt/Plan.md", "d");
        assert_eq!(move_entry(&vault.0, "Notizen/DNS.html", "Archiv").unwrap(), "Archiv/DNS.html");
        assert_eq!(read_text(&vault.0.join("Archiv/DNS.html")).unwrap(), "b");
        // Gleicher Name als anderer Typ im Ziel: nicht erlaubt.
        assert!(move_entry(&vault.0, "Notizen/Ideen.md", "Archiv").unwrap_err().contains("„Ideen“"));
        assert_eq!(move_entry(&vault.0, "Notizen/Ideen.md", "").unwrap(), "Ideen.md");
        // Ordner samt Inhalt, aber nicht in sich selbst.
        assert!(move_entry(&vault.0, "Archiv", "Archiv/Alt").is_err());
        assert!(move_entry(&vault.0, "Archiv", "Archiv").is_err());
        assert_eq!(move_entry(&vault.0, "Archiv/Alt", "Notizen").unwrap(), "Notizen/Alt");
        assert!(vault.0.join("Notizen/Alt/Plan.md").is_file());
        assert!(move_entry(&vault.0, "Notizen", ".localist").is_err());
        assert!(move_entry(&vault.0, "Notizen", "Fehlt").unwrap_err().contains("Zielordner"));
        assert!(move_entry(&vault.0, "Notizen", "../draußen").is_err());
    }
}
