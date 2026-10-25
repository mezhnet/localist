//! Export und Darstellung (Etappe 14): Dateien aus dem Vault als Base64 (für Bilder in einer eigenständigen
//! HTML-Datei), das Schreiben der exportierten Datei an einen Ort außerhalb des Vaults (vom Nutzer im
//! Speichern-Dialog gewählt) und die fertig dargestellten Notizen für die Notizbuch-Ansicht.

use crate::vault::{display_name, write_atomic};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Größte Datei, die eingebettet wird (Bilder in exportierten Seiten).
pub const MAX_EINBETTEN: u64 = 30 * 1024 * 1024;

/// Base64 nach RFC 4648 (mit „=“ aufgefüllt).
pub fn base64(daten: &[u8]) -> String {
    const ZEICHEN: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(daten.len().div_ceil(3) * 4);
    for block in daten.chunks(3) {
        let b = [block[0], *block.get(1).unwrap_or(&0), *block.get(2).unwrap_or(&0)];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        for i in 0..4 {
            if i <= block.len() {
                out.push(ZEICHEN[((n >> (18 - 6 * i)) & 63) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// Liest eine Datei (z. B. ein Bild) als Base64. Zu große Dateien werden abgelehnt.
pub fn datei_base64(path: &Path) -> Result<String, String> {
    let groesse = fs::metadata(path).map_err(|_| format!("„{}“ wurde nicht gefunden.", display_name(path)))?.len();
    if groesse > MAX_EINBETTEN {
        return Err(format!("„{}“ ist zu groß zum Einbetten (mehr als 30 MB).", display_name(path)));
    }
    let daten = fs::read(path).map_err(|e| format!("„{}“ konnte nicht gelesen werden: {e}", display_name(path)))?;
    Ok(base64(&daten))
}

/// Schreibt die exportierte Seite an den im Speichern-Dialog gewählten Ort. Nur `.html`/`.htm`, damit nie
/// versehentlich eine andere Art von Datei überschrieben wird.
pub fn export_schreiben(ziel: &Path, inhalt: &str) -> Result<(), String> {
    let endung = ziel.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if endung != "html" && endung != "htm" {
        return Err("Exportiert wird nur als .html-Datei.".into());
    }
    write_atomic(ziel, inhalt.as_bytes())
}

/// Fertig dargestellte Notizen (HTML) für die abgeschottete Anzeige im Notizbuch, nach Pfad im Vault.
/// Nur im Arbeitsspeicher; das Schema liefert sie unter dem Pfad der Notiz aus.
#[derive(Default)]
pub struct Darstellungen {
    seiten: HashMap<String, String>,
    reihenfolge: Vec<String>,
}

impl Darstellungen {
    const MAX: usize = 64;

    pub fn setzen(&mut self, pfad: &str, html: String) {
        if self.seiten.insert(pfad.to_string(), html).is_none() {
            self.reihenfolge.push(pfad.to_string());
            if self.reihenfolge.len() > Self::MAX {
                let alt = self.reihenfolge.remove(0);
                self.seiten.remove(&alt);
            }
        }
    }

    pub fn holen(&self, pfad: &str) -> Option<&String> {
        self.seiten.get(pfad)
    }

    pub fn leeren(&mut self) {
        self.seiten.clear();
        self.reihenfolge.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_wie_im_standard() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64(&[0x89, b'P', b'N', b'G', 0xff]), "iVBOR/8=");
    }

    #[test]
    fn export_schreibt_nur_html_dateien() {
        let dir = std::env::temp_dir().join(format!("localist-export-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        export_schreiben(&dir.join("Seite.html"), "<p>ok</p>").unwrap();
        assert_eq!(fs::read_to_string(dir.join("Seite.html")).unwrap(), "<p>ok</p>");
        assert!(export_schreiben(&dir.join("autoexec.bat"), "x").is_err());
        assert!(export_schreiben(&dir.join("ohne_endung"), "x").is_err());
        fs::write(dir.join("bild.png"), [1u8, 2, 3]).unwrap();
        assert_eq!(datei_base64(&dir.join("bild.png")).unwrap(), "AQID");
        assert!(datei_base64(&dir.join("fehlt.png")).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn darstellungen_behalten_hoechstens_die_letzten_seiten() {
        let mut darstellungen = Darstellungen::default();
        for i in 0..70 {
            darstellungen.setzen(&format!("Notiz {i}.md"), format!("<p>{i}</p>"));
        }
        assert!(darstellungen.holen("Notiz 0.md").is_none());
        assert_eq!(darstellungen.holen("Notiz 69.md").map(String::as_str), Some("<p>69</p>"));
        darstellungen.setzen("Notiz 69.md", "<p>neu</p>".into());
        assert_eq!(darstellungen.holen("Notiz 69.md").map(String::as_str), Some("<p>neu</p>"));
        darstellungen.leeren();
        assert!(darstellungen.holen("Notiz 69.md").is_none());
    }
}
