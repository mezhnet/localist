//! Schema `localist-seite`: liefert HTML-Seiten und ihre Dateien (Bilder, Bausteine) aus dem geöffneten Vault
//! an die abgeschottete Anzeige (iframe mit `sandbox="allow-scripts"`). Unter Windows und Android lautet die
//! Adresse `http://localist-seite.localhost/<Pfad im Vault>`.
//!
//! Regeln: nur Dateien aus dem Vault (Prüfung wie `vault::resolve`, auch gegen `%2e%2e`, `%2f` und `\`),
//! versteckte Ordner nur für `.localist/bausteine/`, dafür immer die mit der App gebündelte Fassung
//! (`bausteine::CSS` und `bausteine::JS`). Jede Antwort trägt die CSP der Seiten. In ausgelieferte HTML-Seiten
//! (nie in die Datei) kommt das Brücken-Skript.

use crate::bausteine::{self, DIR as BAUSTEINE_DIR};
use crate::eigene;
use crate::vault::{is_hidden, read_text, resolve};
use std::fs;
use std::path::Path;

pub const SCHEME: &str = "localist-seite";

/// CSP der Seiten: kein Netzwerk, Skripte, Styles und Bilder nur vom Schema selbst, inline und `data:`.
pub fn csp() -> &'static str {
    include_str!("../seite/csp.txt").trim()
}

const BRIDGE: &str = include_str!("../seite/bruecke.js");

/// Eine Antwort des Schemas.
#[derive(Debug, PartialEq, Eq)]
pub struct Answer {
    pub status: u16,
    pub content_type: &'static str,
    pub body: Vec<u8>,
}

impl Answer {
    fn text(status: u16, message: &str) -> Self {
        Answer { status, content_type: "text/plain; charset=utf-8", body: message.as_bytes().to_vec() }
    }
}

/// Kopfzeilen jeder Antwort (auch bei Fehlern).
pub fn headers() -> [(&'static str, &'static str); 4] {
    [
        ("Content-Security-Policy", csp()),
        ("X-Content-Type-Options", "nosniff"),
        ("Cache-Control", "no-store"),
        ("Referrer-Policy", "no-referrer"),
    ]
}

/// Wandelt den Pfad einer Anfrage (z. B. "/Notizen/DNS%20Kurs.html") in einen relativen Vault-Pfad um.
/// Abgelehnt wird alles, was den Vault verlassen oder Einstellungen lesen könnte.
pub fn request_to_rel(request_path: &str) -> Result<String, String> {
    let decoded = percent_decode(request_path.strip_prefix('/').unwrap_or(request_path))?;
    let parts: Vec<&str> = decoded.split('/').collect();
    let invalid = |part: &str| part.is_empty() || part == "." || part == ".." || part.contains(['\\', ':', '\0']);
    if parts.iter().any(|part| invalid(part)) {
        return Err(format!("Ungültiger Pfad: {request_path}"));
    }
    let rel = parts.join("/");
    let in_bausteine = rel.to_lowercase().starts_with(&format!("{BAUSTEINE_DIR}/")) && parts.len() == 3 && !is_hidden(parts[2]);
    if parts.iter().any(|part| is_hidden(part)) && !in_bausteine {
        return Err(format!("Versteckte Dateien werden nicht ausgeliefert: {request_path}"));
    }
    Ok(rel)
}

/// Prozent-Dekodierung; ungültiges UTF-8 ist ein Fehler.
fn percent_decode(text: &str) -> Result<String, String> {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        if bytes[i] == b'%' {
            match (bytes.get(i + 1).copied().and_then(hex), bytes.get(i + 2).copied().and_then(hex)) {
                (Some(high), Some(low)) => {
                    out.push(high * 16 + low);
                    i += 3;
                    continue;
                }
                _ => return Err(format!("Ungültige Kodierung: {text}")),
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).map_err(|_| format!("Ungültige Kodierung: {text}"))
}

/// Inhaltstyp nach Dateiendung.
pub fn content_type(rel: &str) -> &'static str {
    let ext = rel.rsplit_once('.').map(|(_, ext)| ext.to_ascii_lowercase()).unwrap_or_default();
    match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "md" | "txt" | "csv" => "text/plain; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}

/// Fügt das Brücken-Skript direkt nach `<head>` ein (sonst nach `<html>` bzw. `<!doctype>`, sonst am Anfang).
/// Das betrifft nur die ausgelieferte Kopie, nie die Datei.
pub fn inject_bridge(html: &str, basis: &str) -> String {
    let script = format!("<script>{}</script>", BRIDGE.replace("__LOCALIST_BASIS__", basis));
    let lower = html.to_ascii_lowercase();
    let after_tag = |tag: &str| -> Option<usize> {
        let mut from = 0;
        while let Some(found) = lower[from..].find(tag) {
            let start = from + found;
            let next = lower.as_bytes().get(start + tag.len()).copied();
            if matches!(next, Some(b'>') | Some(b' ') | Some(b'\t') | Some(b'\n') | Some(b'\r')) {
                return lower[start..].find('>').map(|end| start + end + 1);
            }
            from = start + tag.len();
        }
        None
    };
    let at = after_tag("<head")
        .or_else(|| after_tag("<html"))
        .or_else(|| after_tag("<!doctype"))
        .unwrap_or(if html.starts_with('\u{feff}') { '\u{feff}'.len_utf8() } else { 0 });
    format!("{}{}{}", &html[..at], script, &html[at..])
}

/// Beantwortet eine Anfrage. `extra` liefert zusätzliche, nicht im Vault liegende Dateien (Sicherheitstest).
pub fn answer(root: Option<&Path>, request_path: &str, basis: &str, extra: impl Fn(&str) -> Option<(Vec<u8>, &'static str)>) -> Answer {
    let rel = match request_to_rel(request_path) {
        Ok(rel) => rel,
        Err(message) => return Answer::text(403, &message),
    };
    let lower = rel.to_lowercase();
    if lower == format!("{BAUSTEINE_DIR}/localist.css") {
        return Answer { status: 200, content_type: content_type(&rel), body: bausteine::CSS.as_bytes().to_vec() };
    }
    if lower == format!("{BAUSTEINE_DIR}/localist.js") {
        return Answer { status: 200, content_type: content_type(&rel), body: bausteine::JS.as_bytes().to_vec() };
    }
    if lower == format!("{BAUSTEINE_DIR}/bibliothek.html") {
        // Bibliothek: eingebaute Bausteine (Vorlage aus dem Build) plus die eigenen Bausteine dieses Vaults
        let eigene = root.map(|root| eigene::liste(root).unwrap_or_default()).unwrap_or_default();
        let seite = eigene::bibliothek_seite(eigene::BIBLIOTHEK, &eigene);
        return Answer { status: 200, content_type: content_type(&rel), body: inject_bridge(&seite, basis).into_bytes() };
    }
    if let Some((body, content_type)) = extra(&rel) {
        let body = if content_type.starts_with("text/html") { inject_bridge(&String::from_utf8_lossy(&body), basis).into_bytes() } else { body };
        return Answer { status: 200, content_type, body };
    }
    let Some(root) = root else { return Answer::text(404, "Es ist kein Vault geöffnet.") };
    let Ok(path) = resolve(root, &rel) else { return Answer::text(403, "Ungültiger Pfad.") };
    if !path.is_file() {
        return Answer::text(404, "Nicht gefunden.");
    }
    let kind = content_type(&rel);
    if kind.starts_with("text/html") {
        return match read_text(&path) {
            Ok(html) => Answer { status: 200, content_type: kind, body: inject_bridge(&html, basis).into_bytes() },
            Err(message) => Answer::text(500, &message),
        };
    }
    match fs::read(&path) {
        Ok(body) => Answer { status: 200, content_type: kind, body },
        Err(e) => Answer::text(500, &format!("Die Datei konnte nicht gelesen werden: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_vault() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("localist-schema-{}", uuid::Uuid::new_v4().simple()));
        fs::create_dir_all(dir.join("Notizen")).unwrap();
        fs::create_dir_all(dir.join(".localist/bausteine")).unwrap();
        dir
    }

    #[test]
    fn pfade_der_anfragen_werden_geprueft() {
        assert_eq!(request_to_rel("/Notizen/DNS.html").unwrap(), "Notizen/DNS.html");
        assert_eq!(request_to_rel("/Notizen/DNS%20Kurs.html").unwrap(), "Notizen/DNS Kurs.html");
        assert_eq!(request_to_rel("/Anh%C3%A4nge/skizze.png").unwrap(), "Anhänge/skizze.png");
        assert_eq!(request_to_rel("/.localist/bausteine/localist.css").unwrap(), ".localist/bausteine/localist.css");
        for bad in [
            "/",
            "/../geheim.png",
            "/%2e%2e/geheim.png",
            "/%2E%2E/geheim.png",
            "/..%2fgeheim.png",
            "/..%5cgeheim.png",
            "/Notizen/..%2F..%2Fgeheim.png",
            "/a//b.html",
            "/./a.html",
            "/C:/Windows/win.ini",
            "/%43%3a/Windows/win.ini",
            "/Notizen/%00.html",
            "/%ff.html",
            "/%zz.html",
            "/.localist/settings.json",
            "/.localist/bausteine/eigene/Box.html",
            "/.localist/bausteine/.versteckt.js",
            "/.git/config",
            "/Notizen/.Ideen.md.123.tmp",
        ] {
            assert!(request_to_rel(bad).is_err(), "sollte abgelehnt werden: {bad}");
        }
    }

    #[test]
    fn liefert_nur_dateien_aus_dem_vault_mit_csp_und_bruecke() {
        let vault = temp_vault();
        let page = "<!doctype html>\r\n<html>\r\n<head>\r\n<title>DNS</title>\r\n</head>\r\n<body><main>Port 53</main></body>\r\n</html>\r\n";
        fs::write(vault.join("Notizen/DNS.html"), page).unwrap();
        fs::write(vault.join("Notizen/bild.png"), [137, 80, 78, 71]).unwrap();
        fs::write(vault.parent().unwrap().join("localist-schema-geheim.txt"), "geheim").unwrap();
        let none = |_: &str| None;

        let html = answer(Some(&vault), "/Notizen/DNS.html", "/", none);
        assert_eq!((html.status, html.content_type), (200, "text/html; charset=utf-8"));
        let body = String::from_utf8(html.body).unwrap();
        assert!(body.starts_with("<!doctype html>\r\n<html>\r\n<head><script>"), "{body}");
        assert!(body.contains("var BASIS = \"/\";"));
        assert!(body.ends_with("</script>\r\n<title>DNS</title>\r\n</head>\r\n<body><main>Port 53</main></body>\r\n</html>\r\n"));
        // Die Datei selbst bleibt unverändert.
        assert_eq!(fs::read_to_string(vault.join("Notizen/DNS.html")).unwrap(), page);

        let image = answer(Some(&vault), "/Notizen/bild.png", "/", none);
        assert_eq!((image.status, image.content_type, image.body), (200, "image/png", vec![137, 80, 78, 71]));
        assert_eq!(answer(Some(&vault), "/Notizen/fehlt.png", "/", none).status, 404);
        assert_eq!(answer(Some(&vault), "/..%2flocalist-schema-geheim.txt", "/", none).status, 403);
        assert_eq!(answer(Some(&vault), "/%2e%2e/localist-schema-geheim.txt", "/", none).status, 403);
        assert_eq!(answer(None, "/Notizen/DNS.html", "/", none).status, 404);

        // Bausteine: immer die gebündelte Fassung, auch wenn im Vault etwas anderes liegt.
        fs::write(vault.join(".localist/bausteine/localist.css"), "body { color: red }").unwrap();
        let css = answer(Some(&vault), "/.localist/bausteine/localist.css", "/", none);
        assert_eq!(css.body, bausteine::CSS.as_bytes());
        assert_eq!(css.content_type, "text/css; charset=utf-8");
        assert_eq!(answer(Some(&vault), "/.localist/bausteine/localist.js", "/", none).body, bausteine::JS.as_bytes());

        // Bibliothek: virtuelle Seite mit den eingebauten und den eigenen Bausteinen des Vaults (mit Brücke)
        eigene::speichern(&vault, None, "Lernziel-Box", "Box für Lernziele", "<l-callout>Ziel</l-callout>").unwrap();
        let bibliothek = String::from_utf8(answer(Some(&vault), "/.localist/bausteine/bibliothek.html", "/", none).body).unwrap();
        assert!(bibliothek.contains("id=\"baustein-karteikarte\""));
        assert!(bibliothek.contains("<h2>Lernziel-Box</h2>
<p class=\"beschreibung\">Box für Lernziele</p>
<l-callout>Ziel</l-callout>"));
        assert!(bibliothek.contains("var BASIS = \"/\";"));
        // Die Dateien der eigenen Bausteine selbst liefert das Schema nicht aus.
        assert_eq!(answer(Some(&vault), "/.localist/bausteine/eigene/Lernziel-Box.html", "/", none).status, 403);

        let _ = fs::remove_dir_all(&vault);
        let _ = fs::remove_file(vault.parent().unwrap().join("localist-schema-geheim.txt"));
    }

    #[test]
    fn csp_verbietet_netzwerk_und_fremde_quellen() {
        let csp = csp();
        assert!(csp.contains("connect-src 'none'"));
        assert!(csp.contains("default-src 'none'"));
        assert!(csp.contains("img-src 'self' data: blob:"));
        assert!(csp.contains("form-action 'none'"));
        assert!(!csp.contains("http"), "keine fremden Adressen: {csp}");
        let names: Vec<_> = headers().iter().map(|(name, _)| *name).collect();
        assert_eq!(names, vec!["Content-Security-Policy", "X-Content-Type-Options", "Cache-Control", "Referrer-Policy"]);
    }

    #[test]
    fn bruecke_kommt_an_die_richtige_stelle() {
        let with_bom = "\u{feff}<p>ohne Kopf</p>";
        assert!(inject_bridge(with_bom, "/").starts_with("\u{feff}<script>"));
        assert!(inject_bridge("<!DOCTYPE html><HTML lang=de><HEAD data-x=1><title>x</title>", "/").starts_with("<!DOCTYPE html><HTML lang=de><HEAD data-x=1><script>"));
        assert!(inject_bridge("<!doctype html><body>x", "/").starts_with("<!doctype html><script>"));
        assert!(inject_bridge("<header>x</header>", "/").starts_with("<script>"), "<header> ist nicht <head>");
        assert!(!BRIDGE.contains("</script"), "Die Brücke darf den Skript-Block nicht beenden.");
    }

    #[test]
    fn inhaltstypen() {
        assert_eq!(content_type("a/DNS.HTML"), "text/html; charset=utf-8");
        assert_eq!(content_type("skizze.svg"), "image/svg+xml");
        assert_eq!(content_type("ohne_endung"), "application/octet-stream");
    }
}
