package de.localist.desktop

import android.app.Activity
import androidx.core.view.WindowCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class StatusleisteArgs {
  var dunkel: Boolean = false
}

/**
 * Die Symbole der Status- und Navigationsleiste (Uhrzeit, WLAN, Akku, Knöpfe) richten sich nach dem Modus
 * von Localist statt nach dem System: Hell → dunkle Symbole, Dunkel und Schwarz → helle Symbole. Sonst wären
 * sie z. B. bei hellem Handy und Localist auf Schwarz dunkel auf dunklem Grund.
 * Aufgerufen nur über den Rust-Befehl `statusleiste_setzen` (src-tauri/src/statusleiste.rs), nicht direkt aus
 * der Oberfläche; dafür braucht es keine Capability.
 */
@TauriPlugin
class StatusleistePlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun setzen(invoke: Invoke) {
    val args = invoke.parseArgs(StatusleisteArgs::class.java)
    activity.runOnUiThread {
      val leisten = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
      leisten.isAppearanceLightStatusBars = !args.dunkel
      leisten.isAppearanceLightNavigationBars = !args.dunkel
      invoke.resolve()
    }
  }
}
