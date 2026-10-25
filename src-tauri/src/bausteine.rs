//! Bausteine für HTML-Seiten: `localist.css` und `localist.js` entstehen beim Build aus `src/bausteine/` und
//! `src/styles/tokens.css` (Vite-Plugin in `vite.config.ts`) und sind hier mit der App gebündelt.
//! Beim Öffnen eines Vaults werden sie nach `.localist/bausteine/` geschrieben, wenn sie fehlen oder abweichen
//! (die erste Zeile jeder Datei nennt die Version). So funktionieren HTML-Seiten auch per Doppelklick im Browser.
//! Das Schema `localist-seite` liefert immer diese gebündelte Fassung aus, egal was im Vault liegt.

use crate::vault::write_atomic;
use std::fs;
use std::path::Path;

pub const CSS: &str = include_str!("../seite/localist.css");
pub const JS: &str = include_str!("../seite/localist.js");
pub const DIR: &str = ".localist/bausteine";

/// Version der gebündelten Bausteine (aus der ersten Zeile, z. B. "1.0.0+3fa2c91b").
pub fn version() -> &'static str {
    CSS.strip_prefix("/*! Localist-Bausteine ").and_then(|rest| rest.split_whitespace().next()).unwrap_or("unbekannt")
}

/// Schreibt `localist.css` und `localist.js` nach `.localist/bausteine/`, wenn sie fehlen oder abweichen.
/// Eigene Bausteine (`eigene/`) bleiben unberührt. Liefert die Namen der geschriebenen Dateien.
pub fn ensure(root: &Path) -> Result<Vec<&'static str>, String> {
    let dir = root.join(DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("Der Ordner für die Bausteine konnte nicht angelegt werden: {e}"))?;
    let mut written = Vec::new();
    for (name, content) in [("localist.css", CSS), ("localist.js", JS)] {
        let path = dir.join(name);
        if fs::read(&path).ok().as_deref() != Some(content.as_bytes()) {
            write_atomic(&path, content.as_bytes())?;
            written.push(name);
        }
    }
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gebuendelte_bausteine_tragen_eine_version() {
        assert!(CSS.starts_with("/*! Localist-Bausteine "), "erste Zeile von localist.css");
        assert!(JS.starts_with("/*! Localist-Bausteine "), "erste Zeile von localist.js");
        assert!(version().starts_with(env!("CARGO_PKG_VERSION")), "Version {} passt zur App", version());
        assert!(JS.contains(&format!("var VERSION = \"{}\";", version())), "localist.js trägt dieselbe Version");
        assert!(CSS.contains("l-callout"), "die Grundbausteine sind enthalten");
    }

    #[test]
    fn bausteine_werden_beim_oeffnen_geschrieben_wenn_sie_fehlen_oder_abweichen() {
        let root = std::env::temp_dir().join(format!("localist-bausteine-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(root.join(".localist/bausteine/eigene")).unwrap();
        fs::write(root.join(".localist/bausteine/eigene/Box.html"), "<!-- beschreibung: eigene Box -->").unwrap();

        // Fehlen: beide werden geschrieben.
        assert_eq!(ensure(&root).unwrap(), vec!["localist.css", "localist.js"]);
        assert_eq!(fs::read_to_string(root.join(".localist/bausteine/localist.css")).unwrap(), CSS);
        assert_eq!(fs::read_to_string(root.join(".localist/bausteine/localist.js")).unwrap(), JS);

        // Gleich: nichts wird geschrieben.
        assert!(ensure(&root).unwrap().is_empty());

        // Alte Version oder geänderter Inhalt: wird erneuert.
        fs::write(root.join(".localist/bausteine/localist.css"), "/*! Localist-Bausteine 0.9.0+00000000 – alt */").unwrap();
        fs::write(root.join(".localist/bausteine/localist.js"), format!("{JS}// eigene Änderung")).unwrap();
        assert_eq!(ensure(&root).unwrap(), vec!["localist.css", "localist.js"]);
        assert_eq!(fs::read_to_string(root.join(".localist/bausteine/localist.css")).unwrap(), CSS);
        assert_eq!(fs::read_to_string(root.join(".localist/bausteine/localist.js")).unwrap(), JS);

        // Eigene Bausteine bleiben unberührt.
        assert_eq!(fs::read_to_string(root.join(".localist/bausteine/eigene/Box.html")).unwrap(), "<!-- beschreibung: eigene Box -->");
        let _ = fs::remove_dir_all(&root);
    }
}
