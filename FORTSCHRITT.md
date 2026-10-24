# Fortschritt

## Aktueller Stand
- Etappe: 1 – Vault und Seiten
- Zuletzt aktualisiert: 2026-10-24 23:59
- Nächster Schritt: Abhängigkeiten installieren (BlockNote, remark, Tauri-Dialog-Plugin, notify), Beispiel-Vault anlegen, Schnittstellen festlegen; dann Vault-Auswahl per Dialog und Merken des zuletzt geöffneten Vaults umsetzen.

## Fertig-Kriterien der aktuellen Etappe
- [ ] Der Vault-Ordner lässt sich per Dialog auswählen, der zuletzt geöffnete Vault öffnet sich beim nächsten Start automatisch.
- [ ] Die Sidebar zeigt den Ordnerbaum mit Ordnern und `.md`-Dateien, versteckte Ordner sind ausgeblendet.
- [ ] Seiten und Ordner lassen sich anlegen, umbenennen und löschen (Löschen nur nach Bestätigung).
- [ ] Eine Seite öffnet sich im Block-Editor und wird kurz nach der letzten Eingabe automatisch als Markdown gespeichert.
- [ ] Wird eine Datei außerhalb der App geändert, lädt die App sie neu. Wird sie gelöscht, verschwindet sie aus der Sidebar.
- [ ] Roundtrip-Tests: Markdown → Editor-Format → Markdown liefert für Überschriften, Absätze, fett/kursiv, Listen, Checklisten, Zitate, Code-Blöcke, Links und Bilder denselben Inhalt.
- [ ] Frontmatter bleibt beim Bearbeiten im Editor unverändert erhalten (Test vorhanden).

## Abgeschlossene Etappen
- Etappe 0 – Fundament (abgeschlossen am 2026-10-24)

## Offene Probleme
- keine. Gelöst am 2026-10-24: Die Microsoft C++ Build Tools fehlten. Auf Wunsch des Nutzers wurden sie aus der Sitzung per `winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` installiert (Build Tools 2022 Version 17.14.42, MSVC 14.44.35207, Windows 11 SDK). Rust fand den Linker ohne Neustart.

## Entscheidungen
- 2026-10-24: Projekt mit `create-tauri-app` (Vorlage `react-ts`, Paketmanager npm) erzeugt. Arbeitstitel und Paketname `localprojekt`, App-Identifier `de.localprojekt.desktop`. Der endgültige App-Name wird erst in Etappe 7 festgelegt.
- 2026-10-24: Tests mit Vitest 5 in der jsdom-Umgebung, React-Komponenten werden mit `@testing-library/react` gerendert. Die Vitest-Einstellungen stehen in `vite.config.ts` (Import aus `vitest/config`), damit Vite und Vitest dieselbe Konfiguration nutzen. `src/test-setup.ts` ruft nach jedem Test `cleanup()` auf (über `test.setupFiles`), weil Vitest ohne `globals: true` kein globales `afterEach` bereitstellt und Testing Library sonst nicht aufräumt.
- 2026-10-24: Node.js mindestens 22.22 (jsdom 30 nutzt `Promise.withResolvers`, das es erst ab Node 22 gibt), empfohlen wird die aktuelle LTS 24.
- 2026-10-24: In der Anleitung werden die Visual Studio Build Tools 2022 empfohlen (winget-ID `Microsoft.VisualStudio.2022.BuildTools`, Direktlink geprüft), weil Tauri und rustup damit erprobt sind. Die Build Tools 2026 funktionieren ebenfalls und werden als Alternative genannt.
- 2026-10-24: Fehlende Werkzeuge werden dem Nutzer per Rückfrage zur Installation aus der Sitzung angeboten (winget, der Nutzer bestätigt die Administrator-Abfrage), statt nur anzuhalten. So geschehen bei den C++ Build Tools.
- 2026-10-24: Das Rust-Beispielkommando `greet` aus der Vorlage bleibt bis Etappe 1 stehen; es wird dort durch echte Kommandos ersetzt.
