//! Eigene Bausteine („Code-Speicher“): HTML-Schnipsel in `.localist/bausteine/eigene/<Name>.html`.
//! Die erste Zeile ist ein Kommentar mit der Beschreibung, z. B. `<!-- beschreibung: Box für Lernziele -->`,
//! der Dateiname ohne `.html` ist der Name. Gleiches Format wie `src/lib/eigene-bausteine.ts`.

use crate::vault::{is_hidden, move_to_trash, read_text, validate_name, write_atomic};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub const DIR: &str = ".localist/bausteine/eigene";
/// Vorlage der Bibliotheksseite (eingebaute Bausteine), beim Build aus dem Katalog erzeugt.
pub const BIBLIOTHEK: &str = include_str!("../seite/bibliothek.html");
const EIGENE_MARKE: &str = "<!-- eigene-bausteine -->";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct EigenerBaustein {
    pub name: String,
    pub beschreibung: String,
    pub code: String,
}

/// Inhalt der Datei: Beschreibung als Kommentar in der ersten Zeile, dann der Code (Zeilenende "\n").
pub fn datei(beschreibung: &str, code: &str) -> String {
    let beschreibung = beschreibung.replace(['\r', '\n'], " ").replace("--", "–");
    let code = code.replace("\r\n", "\n").replace('\r', "\n");
    format!("<!-- beschreibung: {} -->\n{}\n", beschreibung.trim(), code.trim_end_matches('\n'))
}

/// Liest Beschreibung und Code; ohne Beschreibungs-Kommentar ist alles Code.
pub fn lesen(text: &str) -> (String, String) {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n").replace('\r', "\n");
    let (first, rest) = text.split_once('\n').unwrap_or((text.as_str(), ""));
    let beschreibung = first
        .trim()
        .strip_prefix("<!--")
        .and_then(|inner| inner.strip_suffix("-->"))
        .and_then(|inner| inner.trim_start().strip_prefix("beschreibung:"));
    match beschreibung {
        Some(beschreibung) => (beschreibung.trim().to_string(), rest.trim_end_matches('\n').to_string()),
        None => (String::new(), text.trim_end_matches('\n').to_string()),
    }
}

fn pfad(root: &Path, name: &str) -> PathBuf {
    root.join(DIR).join(format!("{name}.html"))
}

/// Alle eigenen Bausteine, nach Namen sortiert. Nicht lesbare Dateien werden übersprungen.
pub fn liste(root: &Path) -> Result<Vec<EigenerBaustein>, String> {
    let dir = root.join(DIR);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(&dir).map_err(|e| format!("Die eigenen Bausteine konnten nicht gelesen werden: {e}"))?;
    let mut bausteine = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().into_owned();
        let Some(name) = file_name.strip_suffix(".html").or_else(|| file_name.strip_suffix(".HTML")) else { continue };
        if !path.is_file() || is_hidden(&file_name) || name.is_empty() {
            continue;
        }
        if let Ok(text) = read_text(&path) {
            let (beschreibung, code) = lesen(&text);
            bausteine.push(EigenerBaustein { name: name.to_string(), beschreibung, code });
        }
    }
    bausteine.sort_by_key(|baustein| baustein.name.to_lowercase());
    Ok(bausteine)
}

/// Speichert einen eigenen Baustein. Mit `alter_name` wird ein vorhandener geändert und ggf. umbenannt.
/// Liefert den (bereinigten) Namen.
pub fn speichern(root: &Path, alter_name: Option<&str>, name: &str, beschreibung: &str, code: &str) -> Result<String, String> {
    let name = validate_name(name)?;
    let alter_name = alter_name.map(validate_name).transpose()?;
    let gleicher = |andere: &str| alter_name.as_deref().is_some_and(|alt| alt.to_lowercase() == andere.to_lowercase());
    if liste(root)?.iter().any(|baustein| baustein.name.to_lowercase() == name.to_lowercase() && !gleicher(&baustein.name)) {
        return Err(format!("Es gibt schon einen eigenen Baustein „{name}“."));
    }
    let dir = root.join(DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("Der Ordner für eigene Bausteine konnte nicht angelegt werden: {e}"))?;
    let neu = pfad(root, &name);
    if let Some(alt) = alter_name.as_deref() {
        let alt_pfad = pfad(root, alt);
        if !alt_pfad.is_file() {
            return Err(format!("Den eigenen Baustein „{alt}“ gibt es nicht mehr."));
        }
        // Umbenennen (auch nur Groß-/Kleinschreibung) zuerst, dann den Inhalt schreiben.
        if alt != name {
            fs::rename(&alt_pfad, &neu).map_err(|e| format!("„{alt}“ konnte nicht in „{name}“ umbenannt werden: {e}"))?;
        }
    }
    write_atomic(&neu, datei(beschreibung, code).as_bytes())?;
    Ok(name)
}

/// Verschiebt einen eigenen Baustein in den Papierkorb.
pub fn loeschen(root: &Path, name: &str) -> Result<(), String> {
    let name = validate_name(name)?;
    let path = pfad(root, &name);
    if !path.is_file() {
        return Err(format!("Den eigenen Baustein „{name}“ gibt es nicht mehr."));
    }
    move_to_trash(root, &path)
}

fn esc(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// Bibliotheksseite: Vorlage mit den eingebauten Bausteinen plus die eigenen (gleich wie `bibliothekSeite` in TS).
pub fn bibliothek_seite(vorlage: &str, eigene: &[EigenerBaustein]) -> String {
    let teil = if eigene.is_empty() {
        "<p class=\"leer\">Noch keine eigenen Bausteine. Markiere im Code-Editor einen Abschnitt und wähle „Als Baustein speichern“.</p>".to_string()
    } else {
        eigene
            .iter()
            .enumerate()
            .map(|(i, baustein)| {
                format!(
                    "<section class=\"eintrag\" id=\"eigen-{i}\">\n<h2>{}</h2>\n<p class=\"beschreibung\">{}</p>\n{}\n</section>",
                    esc(&baustein.name),
                    esc(&baustein.beschreibung),
                    baustein.code
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };
    vorlage.replacen(EIGENE_MARKE, &teil, 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_vault() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("localist-eigene-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn dateiformat_mit_beschreibung_in_der_ersten_zeile() {
        let text = datei("Box für Lernziele", "<l-callout typ=\"tipp\">\r\n  Lernziel\r\n</l-callout>\r\n\r\n");
        assert_eq!(text, "<!-- beschreibung: Box für Lernziele -->\n<l-callout typ=\"tipp\">\n  Lernziel\n</l-callout>\n");
        assert_eq!(lesen(&text), ("Box für Lernziele".to_string(), "<l-callout typ=\"tipp\">\n  Lernziel\n</l-callout>".to_string()));
        // Kommentarzeichen und Zeilenumbrüche in der Beschreibung können den Kommentar nicht beenden.
        assert_eq!(datei("a --> b\nc", "x"), "<!-- beschreibung: a –> b c -->\nx\n");
        // Ohne Beschreibung ist alles Code; ein BOM stört nicht.
        assert_eq!(lesen("\u{feff}<p>Nur Code</p>\n"), (String::new(), "<p>Nur Code</p>".to_string()));
        assert_eq!(lesen("<!--beschreibung:kurz-->"), ("kurz".to_string(), String::new()));
    }

    #[test]
    fn speichern_laden_umbenennen_und_loeschen() {
        let root = temp_vault();
        assert!(liste(&root).unwrap().is_empty());
        assert_eq!(speichern(&root, None, " Lernziel-Box ", "Box für Lernziele", "<l-callout>Ziel</l-callout>").unwrap(), "Lernziel-Box");
        speichern(&root, None, "Ampel", "Drei Farben", "<p>rot</p>").unwrap();
        assert_eq!(
            fs::read_to_string(root.join(".localist/bausteine/eigene/Lernziel-Box.html")).unwrap(),
            "<!-- beschreibung: Box für Lernziele -->\n<l-callout>Ziel</l-callout>\n"
        );
        let namen: Vec<_> = liste(&root).unwrap().into_iter().map(|b| b.name).collect();
        assert_eq!(namen, vec!["Ampel", "Lernziel-Box"]);

        // Doppelter Name (auch in anderer Schreibweise) wird abgelehnt.
        assert!(speichern(&root, None, "ampel", "", "<p></p>").unwrap_err().contains("schon einen eigenen Baustein"));
        // Ungültige Namen und Pfade aus dem Ordner heraus.
        assert!(speichern(&root, None, "../Ausbruch", "", "x").is_err());
        assert!(speichern(&root, Some("../Ampel"), "Neu", "", "x").is_err());

        // Bearbeiten und Umbenennen
        speichern(&root, Some("Ampel"), "Verkehrsampel", "Rot, Gelb, Grün", "<p>grün</p>").unwrap();
        assert!(!root.join(".localist/bausteine/eigene/Ampel.html").exists());
        assert_eq!(
            liste(&root).unwrap()[1],
            EigenerBaustein { name: "Verkehrsampel".into(), beschreibung: "Rot, Gelb, Grün".into(), code: "<p>grün</p>".into() }
        );
        // Nur Groß-/Kleinschreibung ändern
        speichern(&root, Some("Verkehrsampel"), "verkehrsampel", "Rot, Gelb, Grün", "<p>grün</p>").unwrap();
        assert_eq!(liste(&root).unwrap()[1].name, "verkehrsampel");

        // Löschen (Papierkorb); danach ist er weg
        let rest = root.join(".localist/bausteine/eigene");
        assert!(loeschen(&root, "Gibt es nicht").is_err());
        #[cfg(not(target_os = "android"))]
        {
            loeschen(&root, "verkehrsampel").unwrap();
            assert!(!rest.join("verkehrsampel.html").exists());
        }
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn bibliothek_zeigt_eingebaute_und_eigene_bausteine() {
        assert!(BIBLIOTHEK.contains("id=\"baustein-callout\""));
        assert!(BIBLIOTHEK.contains("id=\"baustein-diagramm\""));
        assert!(BIBLIOTHEK.contains(EIGENE_MARKE));
        let leer = bibliothek_seite(BIBLIOTHEK, &[]);
        assert!(leer.contains("Noch keine eigenen Bausteine."));
        let seite = bibliothek_seite(
            "<main>\n<!-- eigene-bausteine -->\n</main>",
            &[EigenerBaustein { name: "A <b>".into(), beschreibung: "x & y".into(), code: "<p>Code</p>".into() }],
        );
        assert_eq!(seite, "<main>\n<section class=\"eintrag\" id=\"eigen-0\">\n<h2>A &lt;b&gt;</h2>\n<p class=\"beschreibung\">x &amp; y</p>\n<p>Code</p>\n</section>\n</main>");
    }
}
