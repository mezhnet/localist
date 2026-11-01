# Fortschritt – Archiv Version 2.2

Am 2026-11-01 (Etappe 22, Phase 0) aus `FORTSCHRITT.md` verschoben. Die Abschnitte stehen unverändert so, wie sie am Ende von Version 2.2 in `FORTSCHRITT.md` standen (Commit 223dad4). Version 2.1 und früher: `archiv/FORTSCHRITT-bis-2.1.md`.

## Etappe 21 – Updates über GitHub Releases

Stand am Ende: Etappe 21 – Updates über GitHub Releases (abgeschlossen am 2026-10-31). Version 2.2 ist fertig. Auftrag: `docs/auftrag-version-2.2.md`.

### Fertig-Kriterien
- [x] Phase 0 erledigt: `FORTSCHRITT.md` ist unter 20 KB, das Archiv liegt in `archiv/`, `CLAUDE.md` ist ergänzt und committet.
- [x] „Über Localist“ mit Version und „Nach Updates suchen“ auf PC und Handy, alle Zustände umgesetzt und getestet, kein Netz ohne Klick, Speichern vor dem Installieren. (`src/components/UeberLocalist.tsx`, Tests `UeberLocalist.test.tsx` 12, `App.test.tsx` „Updates über GitHub Releases“, `autosave.test.ts` „sicherSpeichern“; ea0d930, 3d3a049)
- [x] `scripts/version.mjs` funktioniert. Die Version ist 2.2.0. (Test `scripts/version.test.mjs` 3; `node scripts/version.mjs 2.2.0` → 1453dee „Version 2.2.0“, Tag `v2.2.0` mit Beschreibung)
- [x] `release.yml` ist gültig. Ein lokaler Release-Build erzeugt die `.sig`-Datei. Ein normales `npm run tauri build` läuft ohne Schlüssel. (`src/lib/release-workflow.test.ts` 7, actionlint nicht installiert; Release-Build → `Localist_2.2.0_x64-setup.exe.sig`, Schlüssel-ID 6BEE31F67A3C789E wie `tauri.conf.json`; normaler Build EXIT=0 ohne `.sig`)
- [x] `ANLEITUNG-RELEASE.md` ist vorhanden. Kein privater Schlüssel und kein Token im Repo. (`git log -p --all`: 0 Treffer; keine `*.key`/`*.sig` versioniert; unabhängige Prüfung ohne Funde A/B)
- [x] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten abgehakt. (`npm test` 42 Dateien/484 Tests, `cargo test` 44, `tsc` ohne Fehler, `npm run tauri build` EXIT=0, APK EXIT=0, Sicherheitstest 21/21, Klicklisten 12/12, 7/7, 9/9)
- [x] `README.md`/`ANLEITUNG.md` haben „Neu in Version 2.2“ (kurz). In „Offene Probleme“ steht der Hinweis auf die Schritte für Emre aus `ANLEITUNG-RELEASE.md`.

### Nachweise (aus „Abgeschlossene Etappen“)
- Etappe 21 – Updates über GitHub Releases (abgeschlossen am 2026-10-31): Phase 0 6c17a73, a9c78f1; Phase 1 ea0d930, 23f251b, a66a877, 3d3a049; Phase 2 bec972e; Doku 3120431; Version 2.2.0 1453dee (Tag `v2.2.0`); Screenshots 2261070 (`docs/screenshots/etappe-21/`, 10 Bilder). Prüfrunde 1: unabhängige Prüfung (Sonnet, lesend) ohne Funde A/B.
- Klicklisten am Ende von Version 2.2: 2026-10-31 10:22, Etappe 21 (Version 2.2.0): „Version 1.0“ 12 von 12, „Version 2.0“ 7 von 7, „Version 2.1“ 9 von 9 bestanden.

### Entscheidungen
- 2026-10-31: Erstes Release als 2.2.1 statt 2.2.0: Der Lauf für `v2.2.0` scheiterte an CRLF (behoben in e45b1d2, LF vor dem Auschecken); den schon hochgeladenen Tag zu verschieben hätte einen Force-Push gebraucht. `v2.2.0` bleibt ohne Release stehen.
- 2026-10-31: „Neue Sitzung nach jeder Phase“ ging nicht: Der Auto-Modus hat das Starten einer neuen Sitzung abgelehnt. Etappe 21 läuft deshalb in einer Sitzung, die Phasen sind getrennt committet.
- 2026-10-31: Die Browser-Vorschau dieser Sitzung startet Vite aus dem alten Ordner `LocalProjekt` (bekannt seit Etappe 16). Vite läuft deshalb aus `Localist` auf Port 1431 (`npm run dev -- --port 1431 --strictPort`), geprüft an der Befehlszeile des Prozesses.
- 2026-10-31: Updater: Die Abfrage stellt der Rust-Teil des Plugins, die App-CSP bleibt unverändert. Ob es den Updater gibt, entscheidet `app_platform` (Android/iOS nein), nicht die Bildschirmbreite: Ein schmales PC-Fenster zeigt den Updater, ein breites Android-Gerät den GitHub-Knopf.
- 2026-10-31: Jeder Fehler von `check()` (kein Netz, 404, ungültige `latest.json`) zeigt „Keine Verbindung zu GitHub …“; Fehler beim Speichern, Laden oder Installieren zeigen „Update fehlgeschlagen: …“. Ab „Jetzt installieren“ bleiben die Einstellungen offen, damit nach dem Speichern nichts Neues ungespeichert ist, wenn sich die App für den Installer beendet.
- 2026-10-31: `scripts/version.mjs` legt einen Tag mit Beschreibung an (`git tag -a`), weil `git push --follow-tags` nur solche Tags mitschickt. Es ändert nur die Versionszeilen (Textersetzung statt JSON neu schreiben).
- 2026-10-31: `release.yml` nutzt zwei tauri-action-Schritte mit gegensätzlicher `if`-Bedingung statt leerer `owner`/`repo`-Eingaben; für das fremde Repository `releaseCommitish: main` (den Commit gibt es dort nicht), `updaterJsonPreferNsis: true`. `actionlint` ist nicht installiert, deshalb prüft `src/lib/release-workflow.test.ts` die YAML-Datei.
- 2026-10-31: Test „Seitenkopf (Etappe 19)“ geändert, ohne gewünschtes Verhalten zu ändern: Er erwartete „gestern gespeichert“, die Beispiel-Dateien sind aber nur „jetzt minus N × 47 Min.“ alt und gelten vormittags als „heute“ geändert. Der Test setzt die Änderungszeit jetzt auf genau einen Tag vorher.
