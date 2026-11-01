// Android: Updates über GitHub Releases. Den Updater von Tauri gibt es auf Android nicht. Deshalb fragt der
// Kotlin-Teil `AktualisierenPlugin.kt` nach einem Klick auf „Nach Updates suchen“ dieselbe latest.json ab wie der PC,
// prüft, ob die APK zu dieser Version schon am Release hängt, lädt sie auf Wunsch und öffnet den Installer von
// Android. Die Adressen stehen nur hier (fest auf mezhnet/localist); die Oberfläche gibt nur die Versionsnummer
// weiter, die vorher geprüft wird. Android installiert die APK nur über die vorhandene App, wenn sie mit demselben
// Schlüssel signiert ist. Am PC tun die Befehle nichts (dort gilt src/lib/updates.ts mit tauri-plugin-updater).
#![cfg_attr(not(target_os = "android"), allow(dead_code))]
use serde::Serialize;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Runtime};

/// Releases von Localist, passend zum Updater-Endpoint in tauri.conf.json.
pub const RELEASES: &str = "https://github.com/mezhnet/localist/releases";

#[cfg(target_os = "android")]
struct Aktualisieren<R: Runtime>(tauri::plugin::PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("aktualisieren")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let handle = _api.register_android_plugin("de.localist.desktop", "AktualisierenPlugin")?;
                _app.manage(Aktualisieren(handle));
            }
            Ok(())
        })
        .build()
}

/// Ergebnis der Suche für die Oberfläche.
#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "art", rename_all = "camelCase")]
pub enum Suche {
    /// Keine neuere Version.
    Aktuell,
    /// Neuere Version mit fertiger APK.
    Verfuegbar { version: String },
    /// Neuere Version, deren APK noch nicht am Release hängt (der Android-Bau läuft nach dem PC-Bau).
    NochNicht { version: String },
}

/// Nur eine Versionsnummer wie 2.3.1 (drei Zahlen, kein Pfad, kein Zusatz). Sie wird Teil einer Adresse.
pub fn gueltige_version(version: &str) -> bool {
    let teile: Vec<&str> = version.split('.').collect();
    teile.len() == 3 && teile.iter().all(|teil| !teil.is_empty() && teil.len() <= 5 && teil.bytes().all(|b| b.is_ascii_digit()))
}

fn zahlen(version: &str) -> Option<(u32, u32, u32)> {
    let version = version.trim().trim_start_matches(['v', 'V']);
    if !gueltige_version(version) {
        return None;
    }
    let mut teile = version.split('.').map(|teil| teil.parse::<u32>().ok());
    Some((teile.next()??, teile.next()??, teile.next()??))
}

/// Ist `angeboten` neuer als `aktuell`? Unlesbare Nummern zählen nie als neuer.
pub fn ist_neuer(aktuell: &str, angeboten: &str) -> bool {
    match (zahlen(aktuell), zahlen(angeboten)) {
        (Some(alt), Some(neu)) => neu > alt,
        _ => false,
    }
}

/// Adresse der latest.json (dieselbe wie am PC).
pub fn manifest_adresse(basis: &str) -> String {
    format!("{basis}/latest/download/latest.json")
}

/// Adresse der APK, die der Release-Workflow an jedes Release hängt.
pub fn apk_adresse(basis: &str, version: &str) -> String {
    format!("{basis}/download/v{version}/Localist_{version}_android.apk")
}

/// Die Versionsnummer aus der latest.json, nur wenn sie gültig ist.
pub fn version_aus_manifest(text: &str) -> Result<String, String> {
    let wert: serde_json::Value = serde_json::from_str(text).map_err(|_| "Die Antwort von GitHub ist unlesbar.".to_string())?;
    let version = wert
        .get("version")
        .and_then(|v| v.as_str())
        .map(|v| v.trim().trim_start_matches(['v', 'V']).to_string())
        .ok_or("In der Antwort von GitHub fehlt die Version.")?;
    if gueltige_version(&version) {
        Ok(version)
    } else {
        Err("Die Antwort von GitHub enthält keine gültige Version.".into())
    }
}

/// Basis der Adressen. Nur in Debug-Builds (Tests im Emulator) darf `update-test-adresse.txt` im App-Datenordner
/// eine andere Basis nennen, z. B. einen Server auf dem PC; Release-Builds fragen immer GitHub.
#[cfg(target_os = "android")]
fn basis<R: Runtime>(app: &AppHandle<R>) -> String {
    #[cfg(debug_assertions)]
    {
        use tauri::Manager;
        if let Ok(ordner) = app.path().app_data_dir() {
            if let Ok(text) = std::fs::read_to_string(ordner.join("update-test-adresse.txt")) {
                let text = text.trim().trim_end_matches('/');
                if !text.is_empty() {
                    return text.to_string();
                }
            }
        }
    }
    let _ = app;
    RELEASES.to_string()
}

#[cfg(target_os = "android")]
fn plugin<R: Runtime>(app: &AppHandle<R>) -> Result<tauri::plugin::PluginHandle<R>, String> {
    use tauri::Manager;
    app.try_state::<Aktualisieren<R>>().map(|p| p.0.clone()).ok_or_else(|| "Die Update-Suche ist noch nicht bereit.".to_string())
}

#[cfg(target_os = "android")]
#[derive(serde::Deserialize)]
struct Antwort {
    status: u16,
    #[serde(default)]
    text: String,
}

#[cfg(target_os = "android")]
async fn abrufen<R: Runtime>(handle: &tauri::plugin::PluginHandle<R>, url: &str, nur_kopf: bool) -> Result<Antwort, String> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Args<'a> {
        url: &'a str,
        nur_kopf: bool,
    }
    handle
        .run_mobile_plugin_async::<Antwort>("abrufen", Args { url, nur_kopf })
        .await
        .map_err(|e| e.to_string())
}

/// Fragt GitHub nach einer neueren Version (nur nach dem Klick).
pub async fn suchen<R: Runtime>(app: &AppHandle<R>) -> Result<Suche, String> {
    #[cfg(target_os = "android")]
    {
        let handle = plugin(app)?;
        let basis = basis(app);
        let manifest = abrufen(&handle, &manifest_adresse(&basis), false).await?;
        if manifest.status != 200 {
            return Err(format!("GitHub antwortet mit {}.", manifest.status));
        }
        let version = version_aus_manifest(&manifest.text)?;
        if !ist_neuer(&app.package_info().version.to_string(), &version) {
            return Ok(Suche::Aktuell);
        }
        let apk = abrufen(&handle, &apk_adresse(&basis, &version), true).await?;
        Ok(if apk.status == 200 { Suche::Verfuegbar { version } } else { Suche::NochNicht { version } })
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Nur auf Android.".into())
    }
}

/// Lädt die APK zu `version` und öffnet den Installer von Android. `fortschritt` erhält { geladen, gesamt }.
pub async fn installieren<R: Runtime>(app: &AppHandle<R>, version: &str, fortschritt: tauri::ipc::Channel<serde_json::Value>) -> Result<(), String> {
    if !gueltige_version(version) {
        return Err("Ungültige Versionsnummer.".into());
    }
    #[cfg(target_os = "android")]
    {
        #[derive(Serialize)]
        struct Args {
            url: String,
            version: String,
            fortschritt: tauri::ipc::Channel<serde_json::Value>,
        }
        let handle = plugin(app)?;
        let url = apk_adresse(&basis(app), version);
        handle
            .run_mobile_plugin_async::<serde_json::Value>("installieren", Args { url, version: version.to_string(), fortschritt })
            .await
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, fortschritt);
        Err("Nur auf Android.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nur_echte_versionsnummern_werden_teil_der_adresse() {
        for gut in ["2.3.1", "10.0.0", "0.0.1"] {
            assert!(gueltige_version(gut), "{gut}");
        }
        for schlecht in ["", "2.3", "2.3.1.4", "v2.3.1", "2.3.1-beta", "2.3.x", "../2.3.1", "2.3.1/../../x", "2..1", "2.3.1 ", "123456.0.0"] {
            assert!(!gueltige_version(schlecht), "{schlecht}");
        }
    }

    #[test]
    fn neuer_wird_zahlenweise_verglichen() {
        assert!(ist_neuer("2.3.0", "2.3.1"));
        assert!(ist_neuer("2.3.9", "2.10.0"));
        assert!(ist_neuer("2.3.0", "v3.0.0"));
        assert!(!ist_neuer("2.3.1", "2.3.1"));
        assert!(!ist_neuer("2.10.0", "2.9.9"));
        assert!(!ist_neuer("2.3.0", "kaputt"));
        assert!(!ist_neuer("kaputt", "9.9.9"));
    }

    #[test]
    fn adressen_zeigen_auf_die_releases_von_localist() {
        assert_eq!(manifest_adresse(RELEASES), "https://github.com/mezhnet/localist/releases/latest/download/latest.json");
        assert_eq!(apk_adresse(RELEASES, "2.3.1"), "https://github.com/mezhnet/localist/releases/download/v2.3.1/Localist_2.3.1_android.apk");
        let konfiguration: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(konfiguration["plugins"]["updater"]["endpoints"][0].as_str().unwrap(), manifest_adresse(RELEASES));
    }

    #[test]
    fn version_kommt_nur_gueltig_aus_der_latest_json() {
        assert_eq!(version_aus_manifest(r#"{"version":"2.3.1","platforms":{}}"#), Ok("2.3.1".to_string()));
        assert_eq!(version_aus_manifest(r#"{"version":"v2.4.0"}"#), Ok("2.4.0".to_string()));
        assert!(version_aus_manifest(r#"{"version":"2.3.1/../../böse"}"#).is_err());
        assert!(version_aus_manifest(r#"{"notes":"ohne Version"}"#).is_err());
        assert!(version_aus_manifest("<html>").is_err());
    }
}
