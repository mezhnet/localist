# Fortschritt

## Aktueller Stand
- Etappe: 0 – Fundament
- Zuletzt aktualisiert: 2026-10-24 22:10
- Nächster Schritt: Startseite auf „Hallo Vault“ umstellen, dann Vitest einrichten

## Fertig-Kriterien der aktuellen Etappe
- [x] Ein Tauri-2-Projekt mit React, TypeScript und Vite liegt im Projektordner, diese `CLAUDE.md` ist erhalten.
- [ ] Die Startseite der App zeigt den Text „Hallo Vault“.
- [ ] Vitest ist eingerichtet, mindestens ein Beispieltest läuft mit `npm test` grün.
- [ ] `npm run tauri build` endet ohne Fehler, der Pfad der erzeugten EXE bzw. des Installers ist genannt.
- [ ] Git ist eingerichtet, die `.gitignore` deckt u. a. `node_modules`, `target` und `dist` ab, `git status` ist nach dem Commit sauber.
- [ ] Eine `ANLEITUNG.md` erklärt auf Deutsch: Voraussetzungen, App im Entwicklungsmodus starten (`npm run tauri dev`), EXE bauen, Tests ausführen.
- [ ] `FORTSCHRITT.md` ist nach der Vorlage angelegt und auf dem aktuellen Stand.

## Abgeschlossene Etappen
- noch keine

## Offene Probleme
- **Microsoft C++ Build Tools fehlen.** Rust ist installiert (stable, MSVC-Toolchain, cargo 1.99.1), aber ohne den C++-Linker `link.exe` kann `npm run tauri build` (und `npm run tauri dev`) keine EXE erzeugen. Der Nutzer muss die „Visual Studio Build Tools 2022“ mit der Arbeitslast „Desktopentwicklung mit C++“ installieren (Schritt-für-Schritt in `ANLEITUNG.md`, Abschnitt 1). Danach Terminal bzw. Claude Code neu starten, damit der PATH neu geladen wird.

## Entscheidungen
- 2026-10-24: Projekt mit `create-tauri-app` (Vorlage `react-ts`, Paketmanager npm) erzeugt. Arbeitstitel und Paketname `localprojekt`, App-Identifier `de.localprojekt.desktop`. Der endgültige App-Name wird erst in Etappe 7 festgelegt.
- 2026-10-24: Das Rust-Beispielkommando `greet` aus der Vorlage bleibt bis Etappe 1 stehen, weil Rust-Änderungen ohne Build-Tools derzeit nicht kompiliert und geprüft werden können.
