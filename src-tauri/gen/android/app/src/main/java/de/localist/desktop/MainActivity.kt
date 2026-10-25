package de.localist.desktop

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    askForStorageAccessOnce()
  }

  /**
   * Localist arbeitet mit normalen Dateien in einem Ordner auf dem Gerät. Dafür braucht die App
   * ab Android 11 "Zugriff auf alle Dateien". Beim ersten Start öffnet sich einmal die passende
   * Einstellungsseite; ohne Erlaubnis bleibt ein Vault im App-Speicher möglich.
   */
  private fun askForStorageAccessOnce() {
    val prefs = getSharedPreferences("localist", MODE_PRIVATE)
    if (prefs.getBoolean("storage_access_asked", false)) return
    prefs.edit().putBoolean("storage_access_asked", true).apply()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      if (Environment.isExternalStorageManager()) return
      try {
        startActivity(
          Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:$packageName"))
        )
      } catch (e: Exception) {
        startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
      }
    } else {
      requestPermissions(
        arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE),
        1
      )
    }
  }
}
