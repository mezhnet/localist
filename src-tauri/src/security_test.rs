//! Automatischer Sicherheitstest der abgeschotteten Anzeige: `localist.exe --sicherheitstest [<vault>]`.
//!
//! Die App öffnet eine Testseite über das Schema `localist-seite` (gleiche CSP und Brücke wie jede HTML-Seite),
//! die Seite versucht alles, was sie nicht darf, und meldet die Ergebnisse per postMessage. Die App gibt sie als
//! Tabelle auf der Konsole aus und beendet sich (Exit-Code 0 = alles blockiert, 1 = etwas kam durch).
//! Ohne `<vault>` legt der Test einen temporären Vault an und löscht ihn danach wieder.

use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

/// Testseite und Kontrollbild gibt es nur in diesem Modus, nie im Vault.
pub const TEST_PAGE: &str = "__sicherheitstest__.html";
pub const TEST_IMAGE: &str = "__sicherheitstest__.png";

/// Ein 1×1-Pixel-PNG (für die Kontrolle und die Datei außerhalb des Vaults).
pub const PNG: [u8; 70] = [
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65,
    84, 120, 218, 99, 100, 248, 207, 80, 15, 0, 3, 134, 1, 128, 90, 52, 125, 107, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
];

#[derive(Debug, Clone)]
pub struct SecurityTest {
    pub vault: PathBuf,
    /// Datei neben dem Vault, die die Seite nicht lesen dürfen soll.
    pub secret: PathBuf,
    /// Temporärer Ordner, der am Ende gelöscht wird (nur ohne `<vault>`-Angabe).
    pub temp_dir: Option<PathBuf>,
}

/// Liest `--sicherheitstest [<vault>]` aus den Argumenten. None, wenn der Modus nicht gewünscht ist.
pub fn from_args(args: &[String]) -> Option<Result<SecurityTest, String>> {
    let position = args.iter().position(|arg| arg == "--sicherheitstest")?;
    Some(prepare(args.get(position + 1).filter(|arg| !arg.starts_with("--")).map(PathBuf::from)))
}

fn prepare(vault: Option<PathBuf>) -> Result<SecurityTest, String> {
    let (vault, temp_dir) = match vault {
        Some(vault) => (vault, None),
        None => {
            let dir = std::env::temp_dir().join(format!("localist-sicherheitstest-{}", uuid::Uuid::new_v4().simple()));
            (dir.join("Vault"), Some(dir))
        }
    };
    fs::create_dir_all(&vault).map_err(|e| format!("Der Test-Vault konnte nicht angelegt werden: {e}"))?;
    let parent = vault.parent().ok_or("Der Vault braucht einen übergeordneten Ordner für die Testdatei.")?;
    let secret = parent.join(format!("localist-sicherheitstest-geheim-{}.png", uuid::Uuid::new_v4().simple()));
    fs::write(&secret, PNG).map_err(|e| format!("Die Testdatei außerhalb des Vaults konnte nicht angelegt werden: {e}"))?;
    Ok(SecurityTest { vault, secret, temp_dir })
}

impl SecurityTest {
    /// Testseite und Kontrollbild für das Schema (alle anderen Pfade kommen aus dem Vault).
    pub fn virtual_file(&self, rel: &str) -> Option<(Vec<u8>, &'static str)> {
        let secret = self.secret.file_name()?.to_string_lossy().into_owned();
        match rel {
            TEST_PAGE => Some((include_str!("../seite/sicherheitstest.html").replace("__GEHEIM__", &secret).into_bytes(), "text/html; charset=utf-8")),
            TEST_IMAGE => Some((PNG.to_vec(), "image/png")),
            _ => None,
        }
    }

    /// Räumt die Testdatei (und einen temporären Vault) wieder weg.
    pub fn cleanup(&self) {
        let _ = fs::remove_file(&self.secret);
        if let Some(dir) = &self.temp_dir {
            let _ = fs::remove_dir_all(dir);
        }
    }
}

/// Ergebnis einer Prüfung, wie es die Testseite meldet.
#[derive(Debug, Clone, Deserialize)]
pub struct Check {
    pub pruefung: String,
    pub blockiert: bool,
    pub detail: String,
    /// "blockiert" oder "erlaubt" (Kontrolle).
    pub erwartet: String,
}

impl Check {
    pub fn passed(&self) -> bool {
        self.blockiert == (self.erwartet == "blockiert")
    }
}

/// Tabelle für die Konsole und ob alles bestanden ist.
pub fn report(vault: &Path, checks: &[Check]) -> (String, bool) {
    let width = checks.iter().map(|c| c.pruefung.chars().count()).max().unwrap_or(10).max("Prüfung".len());
    let pad = |text: &str, width: usize| format!("{text}{}", " ".repeat(width.saturating_sub(text.chars().count())));
    let mut out = String::new();
    out.push_str("Localist – Sicherheitstest der abgeschotteten Anzeige\n");
    out.push_str(&format!("Vault: {}\n\n", vault.display()));
    out.push_str(&format!("{} | Erwartet  | Ergebnis   | OK   | Detail\n", pad("Prüfung", width)));
    out.push_str(&format!("{}-+-----------+------------+------+-{}\n", "-".repeat(width), "-".repeat(30)));
    for check in checks {
        let result = if check.blockiert { "blockiert" } else { "erlaubt" };
        let ok = if check.passed() { "ja" } else { "NEIN" };
        out.push_str(&format!("{} | {} | {} | {} | {}\n", pad(&check.pruefung, width), pad(&check.erwartet, 9), pad(result, 10), pad(ok, 4), check.detail));
    }
    let passed = checks.iter().filter(|c| c.passed()).count();
    let all = !checks.is_empty() && passed == checks.len();
    out.push_str(&format!(
        "\nErgebnis: {passed} von {} Prüfungen bestanden – {}\n",
        checks.len(),
        if all { "die Seite hat keinen Zugriff auf App, Dateien außerhalb des Vaults oder Netzwerk." } else { "NICHT bestanden." }
    ));
    (out, all)
}

/// Unter Windows hat eine Fenster-App keine Konsole: an die Konsole des Aufrufers anhängen,
/// damit die Tabelle im Terminal erscheint (bei Umleitung in eine Datei oder Pipe geht es auch ohne).
#[cfg(windows)]
pub fn attach_console() {
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn AttachConsole(process_id: u32) -> i32;
    }
    const ATTACH_PARENT_PROCESS: u32 = u32::MAX;
    // Sicher: Systemaufruf ohne Zeiger; schlägt er fehl (keine Konsole), passiert nichts.
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
pub fn attach_console() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modus_aus_den_argumenten() {
        assert!(from_args(&["localist.exe".into()]).is_none());
        let test = from_args(&["localist.exe".into(), "--sicherheitstest".into()]).unwrap().unwrap();
        assert!(test.vault.is_dir());
        assert!(test.secret.is_file());
        assert!(!test.secret.starts_with(&test.vault), "Die Testdatei liegt außerhalb des Vaults.");
        let page = String::from_utf8(test.virtual_file(TEST_PAGE).unwrap().0).unwrap();
        assert!(page.contains(&format!("../{}", test.secret.file_name().unwrap().to_string_lossy())));
        assert!(test.virtual_file("Notizen/Ideen.md").is_none());
        test.cleanup();
        assert!(!test.secret.exists());
        assert!(!test.temp_dir.as_ref().unwrap().exists());
    }

    #[test]
    fn tabelle_und_bewertung() {
        let check = |pruefung: &str, blockiert: bool, erwartet: &str| Check { pruefung: pruefung.into(), blockiert, detail: "x".into(), erwartet: erwartet.into() };
        let (text, ok) = report(Path::new("C:/Vault"), &[check("window.__TAURI__", true, "blockiert"), check("Kontrolle", false, "erlaubt")]);
        assert!(ok, "{text}");
        assert!(text.contains("window.__TAURI__ | blockiert | blockiert  | ja"), "{text}");
        assert!(text.contains("2 von 2 Prüfungen bestanden"));
        let (text, ok) = report(Path::new("C:/Vault"), &[check("fetch ins Netzwerk", false, "blockiert")]);
        assert!(!ok);
        assert!(text.contains("NEIN") && text.contains("NICHT bestanden"));
        assert!(!report(Path::new("C:/Vault"), &[]).1, "ohne Ergebnisse nie bestanden");
    }
}
