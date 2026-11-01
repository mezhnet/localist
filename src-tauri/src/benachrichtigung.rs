// Geplante Benachrichtigungen am PC (Etappe 23). `tauri-plugin-notification` kann am PC nicht planen: Die Zeitangabe
// wird dort ignoriert. Deshalb wartet hier ein eigener Thread auf den Zeitpunkt und zeigt die Benachrichtigung dann
// über das Plugin. Gerechnet wird mit der Uhrzeit des Systems, nicht mit einer festen Wartezeit: Nach Ruhezustand
// oder Energiesparmodus kommt die Benachrichtigung sofort, wenn der Zeitpunkt schon vorbei ist. Das klappt nur,
// solange Localist läuft (auch minimiert). Auf Android plant src/lib/benachrichtigungen.ts direkt mit dem Plugin.
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Runtime};

/// Längstes Warten am Stück: So oft schaut der Thread auf die Uhr.
const TAKT: Duration = Duration::from_secs(1);

/// Welche Planung je Benachrichtigung gilt. Neu planen oder abbrechen macht ältere Planungen ungültig.
#[derive(Default)]
struct Planungen {
    naechste: u64,
    aktuell: HashMap<i32, u64>,
}

impl Planungen {
    fn planen(&mut self, id: i32) -> u64 {
        self.naechste += 1;
        self.aktuell.insert(id, self.naechste);
        self.naechste
    }

    fn abbrechen(&mut self, id: i32) {
        self.aktuell.remove(&id);
    }

    fn gilt(&self, id: i32, planung: u64) -> bool {
        self.aktuell.get(&id) == Some(&planung)
    }

    /// Erledigt: Nur die eigene Planung wird entfernt, nie eine neuere.
    fn erledigt(&mut self, id: i32, planung: u64) {
        if self.gilt(id, planung) {
            self.aktuell.remove(&id);
        }
    }
}

static PLANUNGEN: LazyLock<Mutex<Planungen>> = LazyLock::new(Mutex::default);

fn planungen() -> std::sync::MutexGuard<'static, Planungen> {
    PLANUNGEN.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn jetzt_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// Wie lange bis zum nächsten Blick auf die Uhr; `None`, wenn der Zeitpunkt erreicht ist.
fn wartezeit(jetzt: i64, zeitpunkt: i64) -> Option<Duration> {
    let rest = zeitpunkt.saturating_sub(jetzt);
    if rest <= 0 {
        None
    } else {
        Some(Duration::from_millis(rest as u64).min(TAKT))
    }
}

/// Plant die Benachrichtigung `id` für `zeitpunkt` (Millisekunden seit 1970, UTC). Eine frühere Planung mit
/// derselben `id` gilt danach nicht mehr.
#[tauri::command]
pub fn benachrichtigung_planen<R: Runtime>(app: AppHandle<R>, id: i32, zeitpunkt: i64, titel: String, text: String) {
    let planung = planungen().planen(id);
    std::thread::spawn(move || {
        while let Some(warten) = wartezeit(jetzt_ms(), zeitpunkt) {
            if !planungen().gilt(id, planung) {
                return;
            }
            std::thread::sleep(warten);
        }
        let mut liste = planungen();
        if !liste.gilt(id, planung) {
            return;
        }
        liste.erledigt(id, planung);
        drop(liste);
        use tauri_plugin_notification::NotificationExt;
        let _ = app.notification().builder().title(titel).body(text).show();
    });
}

/// Bricht die geplante Benachrichtigung `id` ab (ohne Wirkung, wenn keine geplant ist).
#[tauri::command]
pub fn benachrichtigung_abbrechen(id: i32) {
    planungen().abbrechen(id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wartezeit_rechnet_mit_dem_zeitpunkt() {
        assert_eq!(wartezeit(1_000, 1_000), None);
        // Nach dem Ruhezustand ist der Zeitpunkt schon vorbei: sofort zeigen.
        assert_eq!(wartezeit(1_000 + 600_000, 1_000), None);
        assert_eq!(wartezeit(1_000, 1_300), Some(Duration::from_millis(300)));
        assert_eq!(wartezeit(0, 25 * 60_000), Some(TAKT));
    }

    #[test]
    fn neu_planen_und_abbrechen_machen_alte_planungen_ungueltig() {
        let mut liste = Planungen::default();
        let erste = liste.planen(7);
        assert!(liste.gilt(7, erste));
        let zweite = liste.planen(7);
        assert!(!liste.gilt(7, erste));
        assert!(liste.gilt(7, zweite));
        // Die alte Planung räumt die neue nicht weg.
        liste.erledigt(7, erste);
        assert!(liste.gilt(7, zweite));
        liste.abbrechen(7);
        assert!(!liste.gilt(7, zweite));
        let andere = liste.planen(8);
        liste.abbrechen(7);
        assert!(liste.gilt(8, andere));
    }
}
