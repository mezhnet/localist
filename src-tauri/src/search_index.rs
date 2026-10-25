//! Suchindex: Titel, Inhalt und Änderungszeit aller Seiten eines Vaults.
//! Er liegt im Cache-Ordner der App (nie im Vault) und lässt sich jederzeit löschen:
//! Beim nächsten Abruf wird er neu aufgebaut. Unveränderte Dateien werden nicht erneut gelesen.

use crate::vault::{is_hidden, page_title, read_text, to_rel, write_atomic};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const INDEX_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexEntry {
    pub path: String,
    pub title: String,
    /// Änderungszeit der Datei in Millisekunden seit 1970.
    pub modified: u64,
    pub content: String,
}

#[derive(Default, Serialize, Deserialize)]
struct IndexFile {
    version: u32,
    vault: String,
    entries: Vec<IndexEntry>,
}

/// Ort der Indexdatei für einen Vault: eigener Dateiname je Vault-Pfad, damit sich Vaults nicht mischen.
pub fn index_file_for(cache_dir: &Path, root: &Path) -> PathBuf {
    let mut hasher = DefaultHasher::new();
    root.to_string_lossy().to_lowercase().hash(&mut hasher);
    cache_dir.join("suchindex").join(format!("{:016x}.json", hasher.finish()))
}

fn collect_pages(root: &Path, dir: &Path, out: &mut Vec<(String, PathBuf)>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_hidden(&name) {
            continue;
        }
        let Ok(file_type) = entry.file_type() else { continue };
        let path = entry.path();
        if file_type.is_dir() {
            collect_pages(root, &path, out);
        } else if file_type.is_file() && page_title(&name).is_some() {
            if let Some(rel) = to_rel(root, &path) {
                out.push((rel, path));
            }
        }
    }
}

fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Bringt den Index auf den aktuellen Stand und speichert ihn in `index_file`.
pub fn update_index(root: &Path, index_file: &Path) -> Result<Vec<IndexEntry>, String> {
    let vault = root.to_string_lossy().into_owned();
    let previous: HashMap<String, IndexEntry> = fs::read_to_string(index_file)
        .ok()
        .and_then(|text| serde_json::from_str::<IndexFile>(&text).ok())
        .filter(|file| file.version == INDEX_VERSION && file.vault == vault)
        .map(|file| file.entries.into_iter().map(|e| (e.path.clone(), e)).collect())
        .unwrap_or_default();

    let mut pages = Vec::new();
    collect_pages(root, root, &mut pages);
    pages.sort();

    let mut changed = previous.len() != pages.len();
    let mut entries = Vec::with_capacity(pages.len());
    for (rel, path) in pages {
        let modified = modified_ms(&path);
        match previous.get(&rel) {
            Some(entry) if entry.modified == modified && modified != 0 => entries.push(entry.clone()),
            _ => {
                // Nicht lesbare Dateien (z. B. kein UTF-8) werden ohne Inhalt aufgenommen.
                let content = read_text(&path).unwrap_or_default();
                let title = page_title(&rel.rsplit('/').next().unwrap_or(&rel)).unwrap_or_default();
                entries.push(IndexEntry { path: rel, title, modified, content });
                changed = true;
            }
        }
    }

    if changed || !index_file.exists() {
        if let Some(dir) = index_file.parent() {
            fs::create_dir_all(dir).map_err(|e| format!("Der Ordner für den Suchindex konnte nicht angelegt werden: {e}"))?;
        }
        let file = IndexFile { version: INDEX_VERSION, vault, entries: entries.clone() };
        let json = serde_json::to_string(&file).map_err(|e| e.to_string())?;
        write_atomic(index_file, json.as_bytes())?;
    }
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("localist-{name}-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn index_liegt_im_cache_ordner_und_nicht_im_vault() {
        let vault = temp_dir("vault");
        let cache = temp_dir("cache");
        fs::create_dir_all(vault.join("Notizen")).unwrap();
        fs::write(vault.join("Notizen/Ideen.md"), "# Ideen\nKanban planen").unwrap();
        fs::write(vault.join(".localist-versteckt.md"), "geheim").unwrap();

        let file = index_file_for(&cache, &vault);
        let entries = update_index(&vault, &file).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "Notizen/Ideen.md");
        assert_eq!(entries[0].title, "Ideen");
        assert!(entries[0].content.contains("Kanban"));

        assert!(file.starts_with(&cache), "Index im Cache-Ordner: {}", file.display());
        assert!(file.is_file());
        // Im Vault ist außer den Seiten nichts dazugekommen.
        let mut in_vault: Vec<_> = fs::read_dir(&vault).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        in_vault.sort();
        assert_eq!(in_vault, vec![".localist-versteckt.md", "Notizen"]);

        let _ = fs::remove_dir_all(&vault);
        let _ = fs::remove_dir_all(&cache);
    }

    #[test]
    fn index_wird_aktualisiert_und_laesst_sich_neu_aufbauen() {
        let vault = temp_dir("vault");
        let cache = temp_dir("cache");
        fs::write(vault.join("A.md"), "alt").unwrap();
        let file = index_file_for(&cache, &vault);
        update_index(&vault, &file).unwrap();

        // Änderung, neue Datei und gelöschte Datei werden übernommen.
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(vault.join("A.md"), "neu").unwrap();
        fs::write(vault.join("B.md"), "zweite").unwrap();
        let entries = update_index(&vault, &file).unwrap();
        assert_eq!(entries.iter().map(|e| (e.path.as_str(), e.content.as_str())).collect::<Vec<_>>(), vec![("A.md", "neu"), ("B.md", "zweite")]);
        fs::remove_file(vault.join("B.md")).unwrap();
        assert_eq!(update_index(&vault, &file).unwrap().len(), 1);

        // Index gelöscht oder kaputt: wird einfach neu aufgebaut.
        fs::write(&file, "kaputt").unwrap();
        assert_eq!(update_index(&vault, &file).unwrap()[0].content, "neu");
        fs::remove_file(&file).unwrap();
        assert_eq!(update_index(&vault, &file).unwrap().len(), 1);

        let _ = fs::remove_dir_all(&vault);
        let _ = fs::remove_dir_all(&cache);
    }

    #[test]
    fn verschiedene_vaults_haben_eigene_indexdateien() {
        let cache = Path::new("C:/cache");
        assert_ne!(index_file_for(cache, Path::new("C:/A")), index_file_for(cache, Path::new("C:/B")));
    }
}
