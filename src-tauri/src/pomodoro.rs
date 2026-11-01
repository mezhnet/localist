// Pomodoro-Verlauf (Etappe 23): eine Zeile pro Fokus-Session in `.localist/pomodoro/YYYY-MM.jsonl`.
// Angehängt wird, indem die ganze Datei atomar neu geschrieben wird (erst temporäre Datei, dann umbenennen). Was
// schon in der Datei steht, bleibt Byte für Byte erhalten, auch kaputte Zeilen. Lässt sich die Datei nicht lesen,
// wird nichts geschrieben, damit nichts verloren geht. Gelesen wird über `read_page` (src/lib/pomodoro.ts).
use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::sync::Mutex;

use crate::vault;

/// Zwei Sessions, die gleichzeitig enden, dürfen sich beim Anhängen nicht gegenseitig überschreiben.
static SCHREIBEN: Mutex<()> = Mutex::new(());

fn gueltiger_monat(monat: &str) -> bool {
    let b = monat.as_bytes();
    b.len() == 7 && b[4] == b'-' && b.iter().enumerate().all(|(i, c)| i == 4 || c.is_ascii_digit()) && matches!(&monat[5..], "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12")
}

pub fn anhaengen(root: &Path, monat: &str, zeile: &str) -> Result<(), String> {
    if !gueltiger_monat(monat) {
        return Err(format!("Ungültiger Monat für den Pomodoro-Verlauf: {monat}"));
    }
    let objekt = serde_json::from_str::<serde_json::Value>(zeile).map(|wert| wert.is_object()).unwrap_or(false);
    if !objekt || zeile.contains(['\n', '\r']) {
        return Err("Ungültiger Eintrag für den Pomodoro-Verlauf.".into());
    }
    let _sperre = SCHREIBEN.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let ordner = root.join(".localist").join("pomodoro");
    fs::create_dir_all(&ordner).map_err(|e| format!("Der Ordner für den Pomodoro-Verlauf konnte nicht angelegt werden: {e}"))?;
    let datei = ordner.join(format!("{monat}.jsonl"));
    let mut inhalt = match fs::read(&datei) {
        Ok(inhalt) => inhalt,
        Err(e) if e.kind() == ErrorKind::NotFound => Vec::new(),
        Err(e) => return Err(format!("Der Pomodoro-Verlauf „{monat}.jsonl“ konnte nicht gelesen werden: {e}")),
    };
    // Zeilenende wie in der Datei (z. B. nach Bearbeiten im Editor von Windows).
    let ende: &[u8] = if inhalt.windows(2).any(|w| w == b"\r\n") { b"\r\n" } else { b"\n" };
    if !inhalt.is_empty() && !inhalt.ends_with(b"\n") {
        inhalt.extend_from_slice(ende);
    }
    inhalt.extend_from_slice(zeile.as_bytes());
    inhalt.extend_from_slice(ende);
    vault::write_atomic(&datei, &inhalt)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("localist-pomodoro-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    const ZEILE: &str = r#"{"id":"1","start":"2026-11-03T09:00","ende":"2026-11-03T09:25","minuten":25,"ziel":"Subnetting üben","seite":null,"abgebrochen":false}"#;

    #[test]
    fn legt_ordner_und_monatsdatei_an_und_haengt_an() {
        let root = vault();
        anhaengen(&root, "2026-11", ZEILE).unwrap();
        anhaengen(&root, "2026-11", r#"{"id":"2"}"#).unwrap();
        anhaengen(&root, "2026-12", r#"{"id":"3"}"#).unwrap();
        let datei = root.join(".localist/pomodoro/2026-11.jsonl");
        assert_eq!(fs::read_to_string(&datei).unwrap(), format!("{ZEILE}\n{{\"id\":\"2\"}}\n"));
        assert_eq!(fs::read_to_string(root.join(".localist/pomodoro/2026-12.jsonl")).unwrap(), "{\"id\":\"3\"}\n");
        // Keine temporären Dateien bleiben liegen.
        assert_eq!(fs::read_dir(root.join(".localist/pomodoro")).unwrap().count(), 2);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn kaputte_zeilen_und_fehlendes_zeilenende_bleiben_erhalten() {
        let root = vault();
        let ordner = root.join(".localist/pomodoro");
        fs::create_dir_all(&ordner).unwrap();
        fs::write(ordner.join("2026-11.jsonl"), "{\"id\":\"a\"}\r\nkaputt{\r\n{\"id\":\"b\"}").unwrap();
        anhaengen(&root, "2026-11", r#"{"id":"c"}"#).unwrap();
        assert_eq!(fs::read_to_string(ordner.join("2026-11.jsonl")).unwrap(), "{\"id\":\"a\"}\r\nkaputt{\r\n{\"id\":\"b\"}\r\n{\"id\":\"c\"}\r\n");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn prueft_monat_und_zeile() {
        let root = vault();
        for monat in ["2026-13", "2026-1", "../x", "2026_11", "abcd-11", "2026-11/.."] {
            assert!(anhaengen(&root, monat, ZEILE).is_err(), "{monat}");
        }
        for zeile in ["", "kein json", "[1]", "{\"a\":1}\n{\"b\":2}"] {
            assert!(anhaengen(&root, "2026-11", zeile).is_err(), "{zeile}");
        }
        assert!(!root.join(".localist/pomodoro/2026-11.jsonl").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
