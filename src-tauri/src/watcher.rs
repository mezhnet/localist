//! Dateiwächter: meldet der Oberfläche Änderungen im Vault, auch wenn sie von außen kommen
//! (z. B. aus Obsidian oder dem Explorer). Versteckte Dateien und Ordner werden ignoriert.

use crate::vault::{is_hidden, to_rel};
use notify::event::{ModifyKind, RenameMode};
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const VAULT_CHANGED_EVENT: &str = "vault-changed";

pub type VaultWatcher = Debouncer<RecommendedWatcher, RecommendedCache>;

/// Ereignis für die Oberfläche. Bei "renamed" steht der neue Pfad in `newPath`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultChange {
    pub kind: &'static str,
    pub path: Option<String>,
    pub new_path: Option<String>,
}

impl VaultChange {
    fn new(kind: &'static str, path: String) -> Self {
        VaultChange { kind, path: Some(path), new_path: None }
    }
}

/// Startet den Wächter für den Vault. Er läuft, bis der zurückgegebene Wert verworfen wird.
pub fn start(app: AppHandle, root: PathBuf) -> Result<VaultWatcher, String> {
    let handler_root = root.clone();
    let mut debouncer = new_debouncer(Duration::from_millis(250), None, move |result: DebounceEventResult| {
        let changes = match result {
            Ok(events) => events.iter().flat_map(|event| classify(&handler_root, event)).collect(),
            Err(_) => vec![VaultChange { kind: "rescan", path: None, new_path: None }],
        };
        for change in changes {
            let _ = app.emit(VAULT_CHANGED_EVENT, change);
        }
    })
    .map_err(|e| format!("Der Dateiwächter konnte nicht gestartet werden: {e}"))?;
    debouncer
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| format!("Der Vault-Ordner kann nicht überwacht werden: {e}"))?;
    Ok(debouncer)
}

/// Relativer Pfad, falls er im Vault liegt und kein Teil davon versteckt ist.
fn visible_rel(root: &Path, path: &Path) -> Option<String> {
    to_rel(root, path).filter(|rel| !rel.is_empty() && !rel.split('/').any(is_hidden))
}

/// Übersetzt ein Ereignis des Betriebssystems in Änderungen für die Oberfläche.
pub fn classify(root: &Path, event: &Event) -> Vec<VaultChange> {
    if event.need_rescan() {
        return vec![VaultChange { kind: "rescan", path: None, new_path: None }];
    }
    let each = |kind: &'static str| -> Vec<VaultChange> {
        event.paths.iter().filter_map(|p| visible_rel(root, p)).map(|p| VaultChange::new(kind, p)).collect()
    };
    match &event.kind {
        EventKind::Access(_) => Vec::new(),
        EventKind::Create(_) => each("created"),
        EventKind::Remove(_) => each("removed"),
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) if event.paths.len() == 2 => {
            match (visible_rel(root, &event.paths[0]), visible_rel(root, &event.paths[1])) {
                (Some(from), Some(to)) => vec![VaultChange { kind: "renamed", path: Some(from), new_path: Some(to) }],
                // Atomares Speichern: versteckte temporäre Datei wird zur eigentlichen Datei.
                (None, Some(to)) => vec![VaultChange::new("modified", to)],
                (Some(from), None) => vec![VaultChange::new("removed", from)],
                (None, None) => Vec::new(),
            }
        }
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => each("removed"),
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => each("created"),
        EventKind::Modify(ModifyKind::Name(_)) => event
            .paths
            .iter()
            .filter_map(|p| visible_rel(root, p).map(|rel| (p, rel)))
            .map(|(p, rel)| VaultChange::new(if p.exists() { "created" } else { "removed" }, rel))
            .collect(),
        _ => each("modified"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, DataChange, RemoveKind};

    fn event(kind: EventKind, paths: &[&str]) -> Event {
        let mut event = Event::new(kind);
        for path in paths {
            event = event.add_path(Path::new("C:/vault").join(path));
        }
        event
    }

    fn classify_test(event: Event) -> Vec<VaultChange> {
        classify(Path::new("C:/vault"), &event)
    }

    #[test]
    fn aenderungen_von_aussen_werden_gemeldet() {
        assert_eq!(
            classify_test(event(EventKind::Modify(ModifyKind::Data(DataChange::Content)), &["Notizen/Ideen.md"])),
            vec![VaultChange::new("modified", "Notizen/Ideen.md".into())]
        );
        assert_eq!(
            classify_test(event(EventKind::Remove(RemoveKind::File), &["Notizen/Ideen.md"])),
            vec![VaultChange::new("removed", "Notizen/Ideen.md".into())]
        );
        assert_eq!(
            classify_test(event(EventKind::Create(CreateKind::File), &["Neu.md"])),
            vec![VaultChange::new("created", "Neu.md".into())]
        );
    }

    #[test]
    fn umbenennen_liefert_alten_und_neuen_pfad() {
        assert_eq!(
            classify_test(event(EventKind::Modify(ModifyKind::Name(RenameMode::Both)), &["A.md", "B.md"])),
            vec![VaultChange { kind: "renamed", path: Some("A.md".into()), new_path: Some("B.md".into()) }]
        );
    }

    #[test]
    fn atomares_speichern_gilt_als_aenderung_der_zieldatei() {
        assert_eq!(
            classify_test(event(
                EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
                &["Notizen/.Ideen.md.123.tmp", "Notizen/Ideen.md"]
            )),
            vec![VaultChange::new("modified", "Notizen/Ideen.md".into())]
        );
    }

    #[test]
    fn versteckte_dateien_und_lesezugriffe_werden_ignoriert() {
        assert!(classify_test(event(EventKind::Create(CreateKind::File), &[".meinapp/settings.json"])).is_empty());
        assert!(classify_test(event(EventKind::Create(CreateKind::File), &["Notizen/.Ideen.md.1.tmp"])).is_empty());
        assert!(classify_test(event(EventKind::Access(notify::event::AccessKind::Any), &["Ideen.md"])).is_empty());
    }
}
