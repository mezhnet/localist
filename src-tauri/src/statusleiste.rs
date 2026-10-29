// Android: Die Symbole der Status- und Navigationsleiste (Uhrzeit, WLAN, Akku) richten sich nach dem Modus der App
// statt nach dem System-Modus, sonst wären sie z. B. bei hellem Handy und Localist auf Schwarz dunkel auf dunklem
// Grund. Die Oberfläche meldet jeden Wechsel (src/lib/theme.tsx), der Kotlin-Teil `StatusleistePlugin.kt` im
// Android-Projekt setzt dann `isAppearanceLightStatusBars`. Das Plugin hat keine Befehle für die Oberfläche (keine
// Capability), es wird nur von hier aus aufgerufen. Am PC tut es nichts.
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Runtime};

#[cfg(target_os = "android")]
struct Statusleiste<R: Runtime>(tauri::plugin::PluginHandle<R>);

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("statusleiste")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let handle = _api.register_android_plugin("de.localist.desktop", "StatusleistePlugin")?;
                _app.manage(Statusleiste(handle));
            }
            Ok(())
        })
        .build()
}

/// `dunkel` = Dunkel oder Schwarz (helle Symbole), sonst Hell (dunkle Symbole).
pub fn setzen<R: Runtime>(app: &AppHandle<R>, dunkel: bool) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        #[derive(serde::Serialize)]
        struct Args {
            dunkel: bool,
        }
        let leiste = app.try_state::<Statusleiste<R>>().ok_or("Die Statusleiste ist noch nicht bereit.")?;
        leiste
            .0
            .run_mobile_plugin::<()>("setzen", Args { dunkel })
            .map_err(|e| format!("Die Statusleiste konnte nicht angepasst werden: {e}"))
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, dunkel);
        Ok(())
    }
}
