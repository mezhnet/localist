# Fortschritt

## Aktueller Stand
- Etappe: 0 – Fundament ist abgeschlossen; als Nächstes kommt Etappe 1 – Vault und Seiten
- Zuletzt aktualisiert: 2026-10-24 23:36
- Nächster Schritt: Etappe 1 beginnen. Zuerst ihre Fertig-Kriterien aus CLAUDE.md wörtlich im Chat auflisten und hier als Checkliste übernehmen, dann mit dem ersten Kriterium starten (Vault-Ordner per Dialog auswählen, zuletzt geöffneten Vault merken).

## Fertig-Kriterien der aktuellen Etappe
Etappe 0 ist abgeschlossen, alle Kriterien sind erfüllt. Die Checkliste für Etappe 1 wird zu Beginn der nächsten Sitzung angelegt.

- [x] Ein Tauri-2-Projekt mit React, TypeScript und Vite liegt im Projektordner, diese `CLAUDE.md` ist erhalten.
- [x] Die Startseite der App zeigt den Text „Hallo Vault“. (`src/App.tsx`; geprüft durch `src/App.test.tsx` und den Frontend-Build `npm run build`)
- [x] Vitest ist eingerichtet, mindestens ein Beispieltest läuft mit `npm test` grün. (Vitest 5.0.5 mit jsdom, 1 Testdatei, 2 Tests)
- [x] `npm run tauri build` endet ohne Fehler, der Pfad der erzeugten EXE bzw. des Installers ist genannt. Nachweis vom 2026-10-24: Rust-Kompilierung in 2 min 52 s, Exit-Code 0, erzeugt wurden `src-tauri\target\release\localprojekt.exe` (4,2 MB), `src-tauri\target\release\bundle\msi\localprojekt_0.1.0_x64_en-US.msi` (2,0 MB) und `src-tauri\target\release\bundle\nsis\localprojekt_0.1.0_x64-setup.exe` (1,4 MB).
- [x] Git ist eingerichtet, die `.gitignore` deckt u. a. `node_modules`, `target` und `dist` ab, `git status` ist nach dem Commit sauber.
- [x] Eine `ANLEITUNG.md` erklärt auf Deutsch: Voraussetzungen, App im Entwicklungsmodus starten (`npm run tauri dev`), EXE bauen, Tests ausführen.
- [x] `FORTSCHRITT.md` ist nach der Vorlage angelegt und auf dem aktuellen Stand.

Zusätzlich geprüft (Arbeitsregel 6): `npm test` grün (1 Datei, 2 Tests), `npx tsc --noEmit` ohne Fehler, `npm run tauri build` ohne Fehler.

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
