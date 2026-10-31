# Auftrag Version 2.2 – Updates über GitHub Releases (Etappe 21)

Ziel: In den Einstellungen gibt es den Knopf **„Nach Updates suchen“**. Unter Windows fragt Localist dann GitHub Releases ab und zeigt „Update verfügbar“ oder „Du bist auf dem neuesten Stand“. Ein Update lässt sich direkt installieren, danach startet die App neu. Neue Versionen baut eine GitHub Action automatisch, sobald ein Versions-Tag gepusht wird.

Emre erlaubt mit diesem Auftrag ausdrücklich die Änderungen an `CLAUDE.md` aus Phase 0. Frag ihn nichts. Was er selbst tun muss (GitHub-Repo anlegen, Secrets eintragen), blockiert die Etappe nicht: Es kommt in `ANLEITUNG-RELEASE.md` und als Hinweis unter „Offene Probleme“, ohne dass du anhältst.

---

## Phase 0 – Aufräumen und Etappe eintragen

1. **`FORTSCHRITT.md` verkleinern** (heute 278 KB, Ziel unter 20 KB):
   - Die Abschnitte „Abgeschlossene Etappen“, „Nachtrag nach Version 2.1: Android-Statusleiste“, „Entscheidungen“ und alle erledigten Einträge aus „Offene Probleme“ kommen unverändert in den Ordner `archiv/`, und zwar in die Datei `archiv/FORTSCHRITT-bis-2.1.md`.
   - In `FORTSCHRITT.md` bleiben „Aktueller Stand“ (mit den Hinweisen a–e), die drei Klicklisten (nur Liste und letzter Stand, ohne alte Ausgaben), noch offene Probleme und ein neuer, leerer Abschnitt „Entscheidungen“ mit dem Verweis auf das Archiv.
2. **`CLAUDE.md` ergänzen.** Sonst bleibt alles unverändert, die Änderung kommt als eigener Commit `CLAUDE.md aktualisiert`:
   - Den Block „Sparsam arbeiten“ (siehe Ende dieses Auftrags) direkt nach „Arbeitsregeln für Claude Code“ einfügen.
   - Unter „Versionen“: Version 2.1 auf „abgeschlossen“ setzen und neu eintragen: „**Version 2.2 (Etappe 21): in Arbeit.** Updates über GitHub Releases. Auftrag: `docs/auftrag-version-2.2.md`.“
   - Unter „Ziel“ beim Punkt „Local-first“ und unter „Was die App nicht macht“ diese Ausnahme ergänzen: „Einzige Ausnahme: Nach Klick auf ‚Nach Updates suchen' fragt die App GitHub Releases ab. Das passiert nie automatisch, und außer der Anfrage selbst werden keine Daten gesendet.“
   - Unter „Etappen und Fertig-Kriterien“ den Abschnitt „Version 2.2“ mit „Etappe 21 – Updates über GitHub Releases“ und den Fertig-Kriterien aus „Definition of Done“ unten anlegen. Die Details stehen nur in diesem Auftrag.
3. Diesen Auftrag als `docs/auftrag-version-2.2.md` committen (falls er noch woanders liegt).

## Phase 1 – Update-Funktion in der App

### Technik (Tauri 2, nur Desktop)
- **Plugins:** `tauri-plugin-updater` und `tauri-plugin-process`.
  - In `Cargo.toml` stehen sie unter `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
  - Registriert werden sie in `src-tauri/src/lib.rs` im vorhandenen `#[cfg(desktop)]`-Teil, z. B. `app.handle().plugin(tauri_plugin_updater::Builder::new().build())`.
  - JS-Pakete: `@tauri-apps/plugin-updater` und `@tauri-apps/plugin-process`.
- **Rechte:** Neue Datei `src-tauri/capabilities/desktop.json` mit `"platforms": ["windows", "linux", "macOS"]` und den Rechten `updater:default` und `process:allow-restart`. `default.json` bleibt unverändert, damit der Android-Build nicht bricht.
- **`tauri.conf.json`:**
  - `plugins.updater.pubkey`: öffentlicher Schlüssel (Phase 2).
  - `plugins.updater.endpoints`: `["https://github.com/EMRE_GITHUB_NAME/localist/releases/latest/download/latest.json"]` mit diesem Platzhalter.
  - `plugins.updater.windows.installMode: "passive"`.
  - `bundle.createUpdaterArtifacts` bleibt hier **aus**. Es wird nur im Release-Build eingeschaltet (Phase 2), damit `npm run tauri build` (Arbeitsregel 6) ohne Signaturschlüssel weiter funktioniert.
- **Die App-CSP bleibt unverändert.** Die Abfrage läuft im Rust-Teil des Plugins, nicht in der Oberfläche. `localist.exe --sicherheitstest` bleibt bei 21 von 21.
- **Browser-Vorschau:** `src/lib/dev-backend.ts` simuliert die Update-Zustände, damit Oberfläche und Klickliste ohne Tauri laufen.

### Anforderungen (jeweils mit Prüfkriterium)
1. **Ort:** In den Einstellungen (PC-Dialog in `src/components/Dialogs.tsx`) gibt es einen Abschnitt „Über Localist“. Er zeigt die Versionsnummer (aus `getVersion()`) und den Knopf „Nach Updates suchen“. Stil und Komponenten aus `src/components/ui/`, Werte aus `tokens.css`.
   *Kriterium:* Die angezeigte Version ist gleich der in `tauri.conf.json`. Das prüft ein Vitest-Test.
2. **Kein Netz ohne Klick:** Beim Start, beim Öffnen der Einstellungen und im Hintergrund findet keine Abfrage statt.
   *Kriterium:* Ein Test belegt, dass `check()` erst nach dem Klick aufgerufen wird.
3. **Zustände** mit deutschen Meldungen:
   - „Suche nach Updates …“ (Knopf gesperrt)
   - „Du bist auf dem neuesten Stand (v2.2.0)“
   - „Update verfügbar: vX.Y.Z“ mit Release-Notizen (`update.body`, als reiner Text, kein HTML) und dem Knopf „Jetzt installieren“
   - „Wird heruntergeladen … NN %“
   - „Wird installiert, Localist startet neu …“
   - Fehler: „Keine Verbindung zu GitHub. Bitte später erneut versuchen.“ bzw. „Update fehlgeschlagen: <kurze Ursache>“
   - In jedem Fall läuft die App normal weiter.
   *Kriterium:* Jeder Zustand ist durch einen Test mit gemocktem Updater abgedeckt.
4. **Erst speichern, dann installieren:** Unter Windows beendet sich die App beim Start des Installers selbst. Deshalb werden alle ausstehenden Änderungen über den bestehenden `AutoSaver` (`src/lib/autosave.ts`) **vor** `downloadAndInstall()` gespeichert. Schlägt das Speichern fehl, wird nicht installiert, und die Fehlermeldung erscheint. Nach der Installation folgt `relaunch()`.
   *Kriterium:* Test für die Reihenfolge „speichern → installieren“ und für den Abbruch bei einem Speicherfehler.
5. **Android:** Dort gibt es keinen Updater. In den Handy-Einstellungen (`HandyEinstellungen`) zeigt „Über Localist“ die Version und den Knopf „Neue Versionen auf GitHub ansehen“. Er öffnet die Releases-Seite im Standardbrowser, über den vorhandenen Weg für externe Links (Opener). Es gibt keine eigene Netzabfrage.
   *Kriterium:* Vitest-Test für die Handy-Variante. `npx tauri android build --debug --apk --target aarch64 --target x86_64` baut weiter.
6. **Eine Versionsquelle:** Neues Skript `scripts/version.mjs X.Y.Z`. Es setzt die Version in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json` und `src-tauri/Cargo.toml` (und aktualisiert `Cargo.lock`). Dann führt es `npm run build` aus (Hinweis d in `FORTSCHRITT.md`), committet `Version X.Y.Z` und legt den Tag `vX.Y.Z` an. Es bricht ab, wenn die Arbeitskopie nicht sauber ist.
   *Kriterium:* Vitest-Test mit temporären Kopien der Dateien. Danach sind alle Versionsangaben gleich.
7. **Version 2.2.0:** Am Ende der Etappe mit dem Skript gesetzt.

## Phase 2 – Release-Pipeline

- **Signaturschlüssel:**
  - Erzeugen ohne Rückfrage mit `npx tauri signer generate --ci -w "%USERPROFILE%\.tauri\localist.key"`.
  - Der öffentliche Schlüssel kommt in `tauri.conf.json`.
  - Der private Schlüssel liegt **nur** in `%USERPROFILE%\.tauri\` und nie im Repo. Ergänze `.gitignore` vorsorglich um `*.key`.
- **Release-Konfiguration:** `src-tauri/tauri.release.conf.json` mit `{"bundle": {"createUpdaterArtifacts": true}}`.
  *Kriterium:* Ein lokaler Build mit `npm run tauri build -- --config src-tauri/tauri.release.conf.json` und gesetztem `TAURI_SIGNING_PRIVATE_KEY` (nur für diesen Befehl) erzeugt neben `Localist_2.2.0_x64-setup.exe` eine `.sig`-Datei. Ein normales `npm run tauri build` ohne Schlüssel endet weiter ohne Fehler.
- **Workflow `.github/workflows/release.yml`:**
  - Auslöser ist ein Tag `v*`. Er läuft auf `windows-latest`.
  - Ablauf: Node und Rust einrichten, `npm ci`, `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`. Schlägt ein Test fehl, entsteht kein Release.
  - Danach `tauri-apps/tauri-action` mit `args: --config src-tauri/tauri.release.conf.json`, `tagName: v__VERSION__`, `releaseName: "Localist v__VERSION__"`, `releaseDraft: false`, `includeUpdaterJson: true`.
  - Secrets: `TAURI_SIGNING_PRIVATE_KEY` (und `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` nur, falls gesetzt). `permissions: contents: write`.
  - **Release-Ziel umschaltbar:** Sind die Repository-Variablen `RELEASE_OWNER` und `RELEASE_REPO` gesetzt, geht das Release dorthin (Eingaben `owner`/`repo` der tauri-action, Token aus dem Secret `RELEASES_TOKEN`). Sonst geht es ins eigene Repo mit `GITHUB_TOKEN`.
  *Kriterium:* `actionlint` (falls verfügbar, sonst YAML-Prüfung) meldet nichts. Die Endpoint-URL in `tauri.conf.json` passt zum Dateinamen `latest.json` des Releases.
- **`ANLEITUNG-RELEASE.md` für Emre** (Einsteiger-Sprache, Schritt für Schritt, mit Klickpfaden auf github.com):
  1. **Repo anlegen.** Zwei Wege, beide erklärt:
     - **(a) Ein öffentliches Repo:** am einfachsten, aber der Code ist für alle sichtbar.
     - **(b) Code privat**, dazu ein zweites, öffentliches Repo `localist-releases` nur für die Installer. Dafür die Variablen `RELEASE_OWNER`/`RELEASE_REPO` setzen und einen Fine-grained Token mit „Contents: Read and write“ nur für dieses Repo als `RELEASES_TOKEN` eintragen.
     - Bei privatem Code kann die App die Releases nicht lesen. Deshalb gibt es Weg (b).
     - Danach `git remote add origin …` und `git push -u origin main`.
  2. **Platzhalter ersetzen:** `EMRE_GITHUB_NAME/localist` in `tauri.conf.json` und beim Android-Knopf (genaue Stellen nennen).
  3. **Schlüssel:** Den Inhalt von `localist.key` als Secret `TAURI_SIGNING_PRIVATE_KEY` eintragen. Die Datei **sichern** (z. B. auf einem USB-Stick). Ohne sie nehmen installierte Apps keine Updates mehr an.
  4. **Version veröffentlichen:** `node scripts/version.mjs 2.2.1`, dann `git push --follow-tags`. Unter „Actions“ warten, bis der Lauf grün ist.
  5. **Erster echter Test:** 2.2.0 aus dem Release installieren, 2.2.1 veröffentlichen, in der App „Nach Updates suchen“ → „Jetzt installieren“.
  6. **Hinweis:** Ohne gekaufte Code-Signatur warnt Windows SmartScreen bei der **Erstinstallation** („Weitere Informationen“ → „Trotzdem ausführen“). Updates über die App laufen ohne diese Warnung.
  7. **Handy:** Die APK lässt sich vorerst von Hand ans Release hängen (`gh release upload vX.Y.Z <apk>`). Eine Debug-APK lässt sich aber nur über eine Debug-APK vom selben PC installieren.

## Nicht Teil dieser Etappe
- Signierte Release-APK mit eigenem Keystore, APK-Build in der Action und ein Android-Update aus der App heraus. Das wird ein späterer Auftrag.
- Automatische Prüfung beim Start, bezahlte Code-Signatur, macOS.

---

## Tests (neu)
- Update-Zustände, kein `check()` ohne Klick, Speichern vor dem Installieren und Abbruch bei einem Speicherfehler, Versionsanzeige, Handy-Variante (Anforderungen 1–5).
- `scripts/version.mjs` (Anforderung 6).
- Alle bestehenden Tests bleiben grün (Stand 2.1: 460 in `npm test`, 44 in `cargo test`).
- Klickliste „Version 2.1“ um den Punkt 9 „Nach Updates suchen (Vorschau-Simulation): Update verfügbar → installieren“ ergänzen. Alle drei Klicklisten laufen automatisch über `scripts/klickliste.mjs`.

## Prüfung
- Höchstens 3 Runden. Schluss ist nach der ersten Runde ohne Funde der Klassen A und B.
- Die unabhängige Prüfung macht **ein** lesender Sonnet-Agent, nur in der Runde, die fertig aussieht. Antwort höchstens 40 Zeilen, nur A/B-Funde mit Beleg. Er prüft:
  1. Liegt ein privater Schlüssel oder Token im Repo oder in der Git-Historie?
  2. Gibt es Netzzugriff ohne Klick?
  3. Speichert die App vor dem Installieren?
  4. Bricht der Android-Build durch Updater-Code oder -Rechte?
  5. Passen die Endpoint-URL und die Workflow-Ausgabe zusammen?
- Screenshots nur vom Abschnitt „Über Localist“ (PC: „Aktuell“, „Update verfügbar“ mit Fortschritt, „Fehler“; Handy: 360 × 740), jeweils in Hell und Schwarz. Sie kommen nach `docs/screenshots/etappe-21/`.

## Definition of Done (auch als Fertig-Kriterien in `CLAUDE.md`)
- [ ] Phase 0 erledigt: `FORTSCHRITT.md` ist unter 20 KB, das Archiv liegt in `archiv/`, `CLAUDE.md` ist ergänzt und committet.
- [ ] „Über Localist“ mit Version und „Nach Updates suchen“ auf PC und Handy, alle Zustände umgesetzt und getestet, kein Netz ohne Klick, Speichern vor dem Installieren.
- [ ] `scripts/version.mjs` funktioniert. Die Version ist 2.2.0.
- [ ] `release.yml` ist gültig. Ein lokaler Release-Build erzeugt die `.sig`-Datei. Ein normales `npm run tauri build` läuft ohne Schlüssel.
- [ ] `ANLEITUNG-RELEASE.md` ist vorhanden. Kein privater Schlüssel und kein Token im Repo.
- [ ] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten abgehakt.
- [ ] `README.md`/`ANLEITUNG.md` haben „Neu in Version 2.2“ (kurz). In „Offene Probleme“ steht der Hinweis auf die Schritte für Emre aus `ANLEITUNG-RELEASE.md`.

---

## Block „Sparsam arbeiten“ für CLAUDE.md

```
## Sparsam arbeiten (Vorrang vor allen Aufträgen und vor den Arbeitsregeln oben)

- Umsetzen in der Hauptsitzung, ohne Workflows und ohne Arbeitsagenten in eigenen Arbeitskopien. Funde behebt die Hauptsitzung selbst.
- Unteragenten nur für die unabhängige Prüfung: höchstens 2, nur lesend, Sonnet, einmal pro Auftrag in der Runde, die fertig aussieht.
- Prüfrunden: höchstens 3, Schluss bei der ersten Runde ohne Funde A/B. Regression über automatische Tests und scripts/klickliste.mjs, keine alten Prüflisten von Hand.
- Lesen zu Beginn und nach Komprimierung: nur CLAUDE.md, der aktuelle Auftrag und die Stand-Zeile plus Hinweise aus FORTSCHRITT.md. Archiv, ANLEITUNG.md und Design-Dokumente nur gezielt per grep und offset/limit.
- Tests während der Arbeit nur für betroffene Dateien. Voller Lauf einmal pro Phase und pro Runde. Ausgaben in Datei, nur tail -20 lesen.
- Screenshots nur von etwa 10 Kernbildschirmen ansehen. Design-Regeln automatisch testen.
- Neue Sitzung nach jeder Phase, spätestens ab etwa 150.000 Tokens Kontext.
- FORTSCHRITT.md unter 20 KB halten: Einträge ein bis drei Zeilen, Commit-Hash statt Dateilisten. Abgeschlossene Versionen beim Start eines neuen Auftrags nach archiv/ verschieben.
```
