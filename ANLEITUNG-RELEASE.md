# Updates veröffentlichen – Anleitung für Emre

Seit Version 2.2 kann Localist sich unter Windows selbst aktualisieren. So funktioniert es:

- In Localist unter **Einstellungen → „Über Localist“** gibt es den Knopf **„Nach Updates suchen“**. Erst nach diesem Klick fragt Localist bei GitHub nach, ob es eine neue Version gibt (Datei `latest.json` des neuesten Releases). Von selbst passiert das nie.
- Neue Versionen baut GitHub für dich: Sobald du einen Versions-Tag wie `v2.2.1` hochlädst, startet die GitHub Action `.github/workflows/release.yml`. Sie lässt alle Tests laufen, baut den Installer, unterschreibt ihn mit deinem Schlüssel und legt ein Release an.
- Die Unterschrift sorgt dafür, dass Localist nur Updates annimmt, die wirklich von dir kommen.

Schon erledigt (von Claude Code): Workflow, Release-Einstellungen (`src-tauri/tauri.release.conf.json`), Schlüsselpaar, öffentlicher Schlüssel in `src-tauri/tauri.conf.json`, Skript `scripts/version.mjs`, Version 2.2.0 mit dem Tag `v2.2.0` (nur auf deinem PC).

Was du **einmal** tun musst: Schritte 1 bis 3. Für jede neue Version danach: Schritt 4.

> **Stand 2026-10-31:** Schritt 1 bis 3 sind erledigt. Das öffentliche Repository [mezhnet/localist](https://github.com/mezhnet/localist) (Weg a) ist angelegt, der Code ist hochgeladen, die Update-Adresse zeigt auf `mezhnet/localist`, und das Secret `TAURI_SIGNING_PRIVATE_KEY` ist eingetragen. Das erste Release ist [Localist v2.2.1](https://github.com/mezhnet/localist/releases/tag/v2.2.1). Zu `v2.2.0` gibt es kein Release: Der Lauf scheiterte an den Zeilenenden auf GitHubs Windows-Rechner, die Korrektur kam erst danach. **Offen für dich:** den Schlüssel sichern (Schritt 3, „Sichern“) und der erste echte Test (Schritt 5, mit 2.2.1 → 2.2.2).

Befehle tippst du in ein Terminal im Projektordner `C:\Users\emre\Documents\eigen_apps\Localist` (z. B. in VS Code über „Terminal → Neues Terminal“).

---

## 1. Repository auf GitHub anlegen

Du brauchst ein Konto auf [github.com](https://github.com). Es gibt zwei Wege. Wähle einen.

### Weg (a): ein öffentliches Repository – am einfachsten

Dein Code ist dann für alle sichtbar (lesen, nicht ändern).

1. Auf github.com oben rechts auf **„+“ → „New repository“** klicken.
2. **Repository name:** `localist`. **Public** wählen.
3. Nichts weiter ankreuzen (kein README, keine .gitignore, keine Lizenz – das Projekt hat schon alles).
4. **„Create repository“** klicken.

### Weg (b): Code privat, Installer öffentlich

Bei einem privaten Repository kann Localist die Releases nicht lesen (die App meldet sich nirgends an). Deshalb gibt es bei diesem Weg zwei Repositories: `localist` (privat, dein Code) und `localist-releases` (öffentlich, nur die Installer).

1. **Code-Repository:** **„+“ → „New repository“**, Name `localist`, **Private**, nichts ankreuzen, **„Create repository“**.
2. **Release-Repository:** **„+“ → „New repository“**, Name `localist-releases`, **Public**, **„Add a README file“ ankreuzen** (wichtig: Dadurch hat es einen Branch `main`, auf dem die Release-Tags entstehen), **„Create repository“**.
3. **Token erzeugen,** damit die Action in `localist-releases` schreiben darf:
   1. Oben rechts auf dein Profilbild → **„Settings“** → links ganz unten **„Developer settings“** → **„Personal access tokens“** → **„Fine-grained tokens“** → **„Generate new token“**.
   2. **Token name:** `Localist Releases`. **Expiration:** z. B. 1 Jahr (trag dir einen Termin ein; danach schlägt das Release fehl, bis du einen neuen Token einträgst).
   3. **Repository access:** **„Only select repositories“** → `localist-releases` auswählen.
   4. **Permissions → Repository permissions → „Contents“:** **„Read and write“**.
   5. **„Generate token“** klicken und den Token kopieren. Er wird nur dieses eine Mal angezeigt.
4. **Token eintragen:** Im Repository `localist` → **„Settings“** → links **„Secrets and variables“ → „Actions“** → Reiter **„Secrets“** → **„New repository secret“**. Name `RELEASES_TOKEN`, bei „Secret“ den Token einfügen, **„Add secret“**.
5. **Ziel eintragen:** Auf derselben Seite den Reiter **„Variables“** → **„New repository variable“**:
   - Name `RELEASE_OWNER`, Wert: dein GitHub-Name.
   - Noch einmal: Name `RELEASE_REPO`, Wert: `localist-releases`.

   Sind beide Variablen gesetzt, legt die Action das Release in `localist-releases` an. Fehlen sie, landet es im Repository `localist` selbst (Weg a).

### Code hochladen (beide Wege)

Ersetze `DEIN_NAME` durch deinen GitHub-Namen:

```
git remote add origin https://github.com/DEIN_NAME/localist.git
git push -u origin main
```

Beim ersten Mal öffnet sich ein Fenster zum Anmelden bei GitHub. Damit ist nur der Code oben, noch kein Tag; es startet also noch kein Release.

Hinweis: Für öffentliche Repositories sind GitHub Actions kostenlos. Bei einem privaten Repository (Weg b) gibt es ein kostenloses Monatskontingent an Minuten; Windows-Minuten zählen doppelt. Ein Release-Lauf dauert etwa 15–25 Minuten.

---

## 2. Platzhalter ersetzen

**Erledigt für `mezhnet/localist`.** Diesen Schritt brauchst du nur noch, wenn sich das Repository ändert (z. B. Wechsel zu Weg b: dann `mezhnet/localist-releases`). Die Adresse steht an zwei Stellen:

| Datei | Stelle | heute |
|---|---|---|
| `src-tauri/tauri.conf.json` | Zeile 92, unter `"plugins"` → `"updater"` → `"endpoints"` | `https://github.com/mezhnet/localist/releases/latest/download/latest.json` |
| `src/lib/updates.ts` | Zeile 10, `RELEASES_SEITE` (Knopf „Neue Versionen auf GitHub ansehen“ auf dem Handy) | `https://github.com/mezhnet/localist/releases` |

Nach einer Änderung prüfen und speichern:

```
npm test
git commit -am "Update-Adresse auf GitHub gesetzt"
git tag -f -a v2.2.0 -m "Localist v2.2.0"
```

Der letzte Befehl setzt den Tag `v2.2.0` auf diesen neuen Stand, damit die Version 2.2.0 mit der richtigen Adresse gebaut wird. Das geht nur, solange `v2.2.0` noch nicht hochgeladen ist; danach die Änderung mit der nächsten Version veröffentlichen (Schritt 4).

---

## 3. Schlüssel eintragen und sichern

Der Signaturschlüssel liegt nur auf deinem PC in `C:\Users\emre\.tauri\`:

- `localist.key` – der **private** Schlüssel. Geheim halten, nie ins Repository, nie verschicken.
- `localist.key.pub` – der öffentliche Schlüssel. Er steht schon in `src-tauri/tauri.conf.json`.

**Eintragen:**

1. Datei öffnen: `notepad %USERPROFILE%\.tauri\localist.key` (in der Eingabeaufforderung oder über Win+R).
2. Alles markieren (Strg+A) und kopieren (Strg+C). Notepad ohne Speichern schließen.
3. Im Repository `localist` auf github.com → **„Settings“ → „Secrets and variables“ → „Actions“** → Reiter **„Secrets“** → **„New repository secret“**.
4. Name `TAURI_SIGNING_PRIVATE_KEY`, bei „Secret“ einfügen, **„Add secret“**.

Ein Passwort hat der Schlüssel nicht; das Secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` brauchst du deshalb nicht.

**Sichern:** Kopiere den Ordner `C:\Users\emre\.tauri` auf einen USB-Stick oder in deinen Passwort-Manager. **Ohne diese Datei nehmen installierte Localist-Apps keine Updates mehr an.** Ein neuer Schlüssel hilft dann nicht: Jede installierte App kennt nur den alten öffentlichen Schlüssel und müsste von Hand neu installiert werden.

Jetzt die Version 2.2.0 veröffentlichen:

```
git push --follow-tags
```

Unter **„Actions“** im Repository `localist` siehst du den Lauf „Release“. Warte, bis er grün ist. Danach steht unter **„Releases“** (rechte Spalte auf der Startseite des Repositorys, bei Weg b im Repository `localist-releases`) das Release „Localist v2.2.0“ mit `Localist_2.2.0_x64-setup.exe`, der `.msi`, je einer `.sig`-Datei und `latest.json`.

Ist der Lauf rot, auf den Lauf und dann auf den roten Schritt klicken; dort steht die Ursache (z. B. fehlendes Secret oder ein fehlgeschlagener Test).

---

## 4. Eine neue Version veröffentlichen

Für jede neue Version, z. B. 2.2.1:

```
node scripts/version.mjs 2.2.1
git push --follow-tags
```

- `scripts/version.mjs` setzt die Versionsnummer überall gleich (`package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `Cargo.lock`), baut die Oberfläche neu, committet „Version 2.2.1“ und legt den Tag `v2.2.1` an. Hast du noch ungespeicherte Änderungen (nicht committet), bricht es ab und ändert nichts.
- `git push --follow-tags` lädt Commit und Tag hoch. Der Tag startet die Action.
- Unter **„Actions“** warten, bis der Lauf grün ist. Erst dann finden die Apps das Update.
- Die Android-APK baut derselbe Lauf danach selbst und hängt sie an dasselbe Release (Schritt 7).

---

## 5. Erster echter Test

Das erste Release ist 2.2.1, der Test geht deshalb von 2.2.1 auf 2.2.2:

1. Im Release **„Localist v2.2.1“** die Datei `Localist_2.2.1_x64-setup.exe` herunterladen und installieren (zur Warnung von Windows siehe Schritt 6).
2. Localist starten: **Einstellungen → „Über Localist“** zeigt Version 2.2.1. **„Nach Updates suchen“** → „Du bist auf dem neuesten Stand (v2.2.1)“.
3. Version 2.2.2 veröffentlichen (Schritt 4, also `node scripts/version.mjs 2.2.2` und `git push --follow-tags`) und warten, bis der Lauf grün ist.
4. In Localist erneut **„Nach Updates suchen“** → „Update verfügbar: v2.2.2“ → **„Jetzt installieren“**. Localist speichert alles, lädt das Update („Wird heruntergeladen … NN %“), installiert es und startet neu.
5. **Einstellungen → „Über Localist“** zeigt jetzt 2.2.2.

---

## 6. Hinweis: Warnung von Windows bei der Erstinstallation

Localist hat keine gekaufte Code-Signatur. Deshalb zeigt Windows SmartScreen bei der **ersten** Installation „Der Computer wurde durch Windows geschützt“. Dann auf **„Weitere Informationen“** und **„Trotzdem ausführen“** klicken. Updates über „Jetzt installieren“ laufen ohne diese Warnung.

---

## 7. Handy (Android)

Auch auf Android sucht **„Nach Updates suchen“** (Einstellungen → „Über Localist“) nach einer neuen Version. Ist eine da, lädt **„Jetzt installieren“** die APK vom Release und öffnet den Installer von Android.

Die APK baut derselbe Release-Lauf selbst: Nach dem Windows-Installer baut der Job **„Android-APK bauen und anhängen“** die APK und hängt sie als `Localist_X.Y.Z_android.apk` an dasselbe Release. Sie ist mit einem eigenen Schlüssel signiert. Android installiert ein Update nur, wenn es mit **demselben** Schlüssel signiert ist wie die installierte App.

**Schlüssel einmal eintragen.** Der Schlüssel liegt nur auf deinem PC in `C:\Users\emre\.localist-android\`:

- `localist-android.jks` – der Schlüssel selbst. Geheim halten, nie ins Repository, nie verschicken.
- `passwort.txt` – sein Passwort.
- `github-secrets.env` – beides fertig zum Eintragen bei GitHub.

Im Projektordner einmal ausführen:

```
gh secret set -f C:\Users\emre\.localist-android\github-secrets.env
gh secret list
```

Der erste Befehl legt die Secrets `ANDROID_KEYSTORE_BASE64` und `ANDROID_KEYSTORE_PASSWORD` an, der zweite zeigt sie (nur die Namen). Danach die Datei `github-secrets.env` löschen; `localist-android.jks` und `passwort.txt` bleiben.

**Sichern:** Den Ordner `C:\Users\emre\.localist-android` genauso wie `C:\Users\emre\.tauri` auf einen USB-Stick oder in deinen Passwort-Manager kopieren. **Ohne diesen Schlüssel nimmt Localist auf dem Handy keine Updates mehr an.** Mit einem neuen Schlüssel müsste die App auf jedem Handy einmal deinstalliert werden.

Fehlen die Secrets, wird der Android-Job rot („Die Secrets … fehlen“). Der Windows-Installer ist dann trotzdem veröffentlicht; nach dem Eintragen den Lauf unter „Actions“ mit **„Re-run failed jobs“** wiederholen.

**Umstieg von 2.3.0:** Bis 2.3.0 hing eine Debug-APK am Release (`…_android-debug.apk`, signiert mit dem Debug-Schlüssel deines PCs). Über sie installiert Android die neue APK nicht. Deshalb einmal die alte App deinstallieren und die neue installieren (siehe `ANLEITUNG.md`, „Neu in Version 2.3.1“). Danach gehen Updates wieder ohne Deinstallieren.

Eine signierte APK am PC bauen (nur zum Testen): `src-tauri\gen\android\keystore.properties` mit den Zeilen `storeFile=C:/Users/emre/.localist-android/localist-android.jks`, `keyAlias=localist` und `password=` plus dem Passwort aus `passwort.txt` anlegen (Git ignoriert die Datei), dann `npx tauri android build --apk --target aarch64`. Danach die Datei wieder löschen.
