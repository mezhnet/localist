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

/// Ordner mit den Einstellungen eines Vaults (wie `.obsidian`).
pub const SETTINGS_DIR: &str = ".meinapp";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Folder,
    Page,
}

/// Ein Eintrag im Ordnerbaum. `name` ist bei Seiten der Titel ohne ".md".
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
}

/// Versteckte Einträge (Name beginnt mit ".") erscheinen nicht in der Sidebar.
pub fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

/// Seitentitel aus dem Dateinamen, falls es eine Markdown-Datei ist.
pub fn page_title(file_name: &str) -> Option<String> {
    let len = file_name.len();
    if len > 3 && file_name.is_char_boundary(len - 3) && file_name[len - 3..].eq_ignore_ascii_case(".md") {
        Some(file_name[..len - 3].to_string())
    } else {
        None
    }
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
            folders.push(TreeNode { name, path: rel, kind: NodeKind::Folder, children: Some(children), database });
        } else if file_type.is_file() {
            if let Some(title) = page_title(&name) {
                pages.push(TreeNode { name: title, path: rel, kind: NodeKind::Page, children: None, database: false });
            }
        }
    }
    folders.sort_by_key(|node| node.name.to_lowercase());
    pages.sort_by_key(|node| node.name.to_lowercase());
    folders.extend(pages);
    folders
}

fn display_name(path: &Path) -> String {
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
pub fn ensure_settings(root: &Path) -> Result<(), String> {
    let dir = root.join(SETTINGS_DIR);
    let file = dir.join("settings.json");
    if file.exists() {
        return Ok(());
    }
    fs::create_dir_all(&dir).map_err(|e| format!("Der Einstellungsordner konnte nicht angelegt werden: {e}"))?;
    write_atomic(&file, b"{\n  \"version\": 1\n}\n")
}

/// Legt `<dir>/<title>.md` mit Frontmatter (id) an und liefert den relativen Pfad.
pub fn create_page(root: &Path, dir: &str, title: &str) -> Result<String, String> {
    let title = validate_name(title)?;
    let folder = resolve(root, dir)?;
    if !folder.is_dir() {
        return Err("Der Zielordner existiert nicht.".into());
    }
    let path = folder.join(format!("{title}.md"));
    if path.exists() {
        return Err(format!("Hier gibt es schon eine Seite „{title}“."));
    }
    let content = format!("---\nid: {}\n---\n", uuid::Uuid::new_v4());
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

/// Benennt um (Seiten: neuer Titel ohne ".md"). Liefert den neuen relativen Pfad.
pub fn rename_entry(root: &Path, rel: &str, new_name: &str) -> Result<String, String> {
    if rel.is_empty() {
        return Err("Der Vault selbst kann hier nicht umbenannt werden.".into());
    }
    let source = resolve(root, rel)?;
    if !source.exists() {
        return Err("Der Eintrag existiert nicht mehr.".into());
    }
    let name = validate_name(new_name)?;
    let file_name = if source.is_dir() { name.clone() } else { format!("{name}.md") };
    let target = source.with_file_name(&file_name);
    // Windows unterscheidet keine Groß-/Kleinschreibung: "ideen" → "Ideen" ist derselbe Eintrag.
    let same_entry = source.to_string_lossy().to_lowercase() == target.to_string_lossy().to_lowercase();
    if target.exists() && !same_entry {
        return Err(format!("Hier gibt es schon einen Eintrag „{name}“."));
    }
    fs::rename(&source, &target).map_err(|e| format!("Umbenennen fehlgeschlagen: {e}"))?;
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
    trash::delete(&path).map_err(|e| format!("„{}“ konnte nicht in den Papierkorb verschoben werden: {e}", display_name(&path)))
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
            let dir = std::env::temp_dir().join(format!("localprojekt-test-{}", uuid::Uuid::new_v4().simple()));
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
        vault.file(".meinapp/settings.json", "{}");
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
        assert!(!tree[1].database);
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

        let page = create_page(&vault.0, "Projekte", "Umzug").unwrap();
        assert_eq!(page, "Projekte/Umzug.md");
        let content = read_text(&vault.0.join("Projekte/Umzug.md")).unwrap();
        assert!(content.starts_with("---\nid: "), "Frontmatter mit id: {content}");
        assert_eq!(content.lines().nth(1).unwrap().len(), "id: ".len() + 36);
        assert!(create_page(&vault.0, "Projekte", "Umzug").is_err());

        let renamed = rename_entry(&vault.0, "Projekte/Umzug.md", "Umzug 2027").unwrap();
        assert_eq!(renamed, "Projekte/Umzug 2027.md");
        assert_eq!(read_text(&vault.0.join("Projekte/Umzug 2027.md")).unwrap(), content);

        // Nur Groß-/Kleinschreibung ändern ist erlaubt.
        assert_eq!(rename_entry(&vault.0, "Projekte/Umzug 2027.md", "umzug 2027").unwrap(), "Projekte/umzug 2027.md");

        create_page(&vault.0, "Projekte", "Andere").unwrap();
        assert!(rename_entry(&vault.0, "Projekte/Andere.md", "umzug 2027").is_err());

        let renamed_folder = rename_entry(&vault.0, "Projekte", "Archiv").unwrap();
        assert_eq!(renamed_folder, "Archiv");
        assert!(vault.0.join("Archiv/Andere.md").is_file());
    }

    #[test]
    fn einstellungsordner_wird_angelegt() {
        let vault = TestVault::new();
        ensure_settings(&vault.0).unwrap();
        assert!(vault.0.join(".meinapp/settings.json").is_file());
        // Vorhandene Einstellungen bleiben unverändert.
        fs::write(vault.0.join(".meinapp/settings.json"), "{\"version\":1,\"eigenes\":true}").unwrap();
        ensure_settings(&vault.0).unwrap();
        assert_eq!(read_text(&vault.0.join(".meinapp/settings.json")).unwrap(), "{\"version\":1,\"eigenes\":true}");
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
    fn seitentitel_aus_dateinamen() {
        assert_eq!(page_title("Ideen.md"), Some("Ideen".into()));
        assert_eq!(page_title("Notiz.MD"), Some("Notiz".into()));
        assert_eq!(page_title("Bild.png"), None);
        assert_eq!(page_title(".md"), None);
        assert_eq!(page_title("Äpfel.md"), Some("Äpfel".into()));
    }
}
