package de.localist.desktop

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

@InvokeArg
class AbrufenArgs {
  lateinit var url: String
  var nurKopf: Boolean = false
}

@InvokeArg
class InstallierenArgs {
  lateinit var url: String
  lateinit var version: String
  var fortschritt: Channel? = null
}

/**
 * Updates auf dem Handy, nur nach einem Klick auf „Nach Updates suchen“. Aufgerufen nur über die Rust-Befehle in
 * src-tauri/src/android_update.rs, die auch die Adressen festlegen (keine Capability, die Oberfläche kommt nicht
 * direkt hierher). Hier wird nur geladen und der Installer von Android geöffnet. Android installiert die neue APK
 * nur über die vorhandene App, wenn Paketname und Signaturschlüssel gleich sind.
 */
@TauriPlugin
class AktualisierenPlugin(private val activity: Activity) : Plugin(activity) {
  /** GET (Text, höchstens 1 MB) oder nur den Status einer Adresse (nurKopf, für „hängt die APK schon dran?“). */
  @Command
  fun abrufen(invoke: Invoke) {
    val args = invoke.parseArgs(AbrufenArgs::class.java)
    Thread {
      try {
        val verbindung = verbinden(args.url, if (args.nurKopf) "HEAD" else "GET")
        val status = verbindung.responseCode
        val antwort = JSObject()
        antwort.put("status", status)
        if (!args.nurKopf && status == 200) {
          val bytes = verbindung.inputStream.use { it.readBytes() }
          if (bytes.size > 1024 * 1024) throw Exception("Die Antwort von GitHub ist zu groß.")
          antwort.put("text", String(bytes, Charsets.UTF_8))
        }
        verbindung.disconnect()
        invoke.resolve(antwort)
      } catch (e: Exception) {
        invoke.reject(e.message ?: e.javaClass.simpleName)
      }
    }.start()
  }

  /** Lädt die APK in den Cache, prüft Paketname und Version und öffnet dann den Installer von Android. */
  @Command
  fun installieren(invoke: Invoke) {
    val args = invoke.parseArgs(InstallierenArgs::class.java)
    Thread {
      try {
        val ordner = File(activity.cacheDir, "update")
        ordner.deleteRecursively()
        ordner.mkdirs()
        val datei = File(ordner, "Localist-${args.version}.apk")
        val verbindung = verbinden(args.url, "GET")
        if (verbindung.responseCode != 200) throw Exception("GitHub antwortet mit ${verbindung.responseCode}.")
        val gesamt = verbindung.contentLengthLong
        var geladen = 0L
        var gemeldet = -1L
        melden(args.fortschritt, 0L, gesamt)
        verbindung.inputStream.use { ein ->
          datei.outputStream().use { aus ->
            val puffer = ByteArray(64 * 1024)
            while (true) {
              val anzahl = ein.read(puffer)
              if (anzahl < 0) break
              aus.write(puffer, 0, anzahl)
              geladen += anzahl
              // Höchstens einmal pro Prozent melden, sonst einmal pro MB (wenn die Größe fehlt).
              val stufe = if (gesamt > 0) geladen * 100 / gesamt else geladen / (1024 * 1024)
              if (stufe != gemeldet) {
                gemeldet = stufe
                melden(args.fortschritt, geladen, gesamt)
              }
            }
          }
        }
        verbindung.disconnect()
        if (gesamt > 0 && geladen != gesamt) throw Exception("Der Download ist unvollständig.")

        @Suppress("DEPRECATION")
        val info = activity.packageManager.getPackageArchiveInfo(datei.path, 0)
          ?: throw Exception("Die geladene Datei ist keine gültige APK.")
        if (info.packageName != activity.packageName || info.versionName != args.version) {
          throw Exception("Die geladene APK passt nicht zu Localist ${args.version}.")
        }

        val adresse = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", datei)
        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(adresse, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.runOnUiThread {
          try {
            activity.startActivity(intent)
            invoke.resolve()
          } catch (e: Exception) {
            invoke.reject("Der Installer von Android ließ sich nicht öffnen: ${e.message ?: e.javaClass.simpleName}")
          }
        }
      } catch (e: Exception) {
        invoke.reject(e.message ?: e.javaClass.simpleName)
      }
    }.start()
  }

  private fun melden(kanal: Channel?, geladen: Long, gesamt: Long) {
    val daten = JSObject()
    daten.put("geladen", geladen)
    daten.put("gesamt", gesamt)
    kanal?.send(daten)
  }

  private fun verbinden(adresse: String, methode: String): HttpURLConnection {
    // Release-Builds sprechen nur mit GitHub über HTTPS; nur Debug-Builds dürfen einen Testserver nutzen.
    if (!BuildConfig.DEBUG && !adresse.startsWith("https://github.com/")) {
      throw Exception("Unerwartete Adresse.")
    }
    @Suppress("DEPRECATION")
    val verbindung = URL(adresse).openConnection() as HttpURLConnection
    verbindung.requestMethod = methode
    verbindung.connectTimeout = 15_000
    verbindung.readTimeout = 30_000
    verbindung.instanceFollowRedirects = true
    verbindung.setRequestProperty("User-Agent", "Localist")
    return verbindung
  }
}
