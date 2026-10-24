# Fortschritt

## Aktueller Stand
- Etappe: 0 – Fundament
- Zuletzt aktualisiert: 2026-10-24 22:46
- Nächster Schritt: Der Nutzer installiert die Microsoft C++ Build Tools (siehe „Offene Probleme“). Danach `npm run tauri build` ausführen, die Pfade von EXE und Installer bestätigen (und in `ANLEITUNG.md`, Abschnitt 4 korrigieren, falls sie abweichen), alle Kriterien im Chat nachweisen und die Etappe mit dem Abschluss-Commit beenden.

## Fertig-Kriterien der aktuellen Etappe
- [x] Ein Tauri-2-Projekt mit React, TypeScript und Vite liegt im Projektordner, diese `CLAUDE.md` ist erhalten.
- [x] Die Startseite der App zeigt den Text „Hallo Vault“. (`src/App.tsx`; geprüft durch `src/App.test.tsx` und den Frontend-Build `npm run build`)
- [x] Vitest ist eingerichtet, mindestens ein Beispieltest läuft mit `npm test` grün. (Vitest 5.0.5 mit jsdom, 1 Testdatei, 2 Tests)
- [ ] `npm run tauri build` endet ohne Fehler, der Pfad der erzeugten EXE bzw. des Installers ist genannt. **Blockiert:** Microsoft C++ Build Tools fehlen, siehe „Offene Probleme“.
- [x] Git ist eingerichtet, die `.gitignore` deckt u. a. `node_modules`, `target` und `dist` ab, `git status` ist nach dem Commit sauber.
- [x] Eine `ANLEITUNG.md` erklärt auf Deutsch: Voraussetzungen, App im Entwicklungsmodus starten (`npm run tauri dev`), EXE bauen, Tests ausführen.
- [x] `FORTSCHRITT.md` ist nach der Vorlage angelegt und auf dem aktuellen Stand.

Zusätzlich geprüft (Arbeitsregel 6): `npx tsc --noEmit` meldet keine Fehler. `npm run build` (Frontend) läuft durch, `dist/` enthält „Hallo Vault“.

## Abgeschlossene Etappen
- noch keine

## Offene Probleme
- **Microsoft C++ Build Tools fehlen (blockiert Kriterium 4).** Rust ist installiert (stable, MSVC-Toolchain, cargo 1.99.1), aber ohne den C++-Linker `link.exe` kann weder `npm run tauri build` noch `npm run tauri dev` eine EXE erzeugen (ein Testprogramm scheitert mit „linker `link.exe` not found“). **Zu tun (Nutzer):** „Visual Studio Build Tools 2022“ mit der Arbeitslast „Desktopentwicklung mit C++“ installieren, Schritt für Schritt beschrieben in `ANLEITUNG.md`, Abschnitt 1. Kurzform im Terminal (eine Administrator-Abfrage erscheint):
  `winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`
  Danach Terminal bzw. Claude Code neu starten, damit der PATH (inklusive `C:\Users\emre\.cargo\bin`) neu geladen wird.
  Nachweis (2026-10-24 22:46): `npm run tauri build` scheitert schon bei den ersten Rust-Build-Skripten (`serde`, `typeid`, `thiserror`) mit „linking with `link.exe` failed“. Aus Git Bash heraus wird dabei irrtümlich das `link.exe` von Git (ein Coreutils-Werkzeug für Hardlinks) gefunden, deshalb lautet die Meldung dort „link: extra operand“; in PowerShell lautet sie „linker `link.exe` not found“. Beides hat dieselbe Ursache. Die Rust-Abhängigkeiten sind mit `cargo fetch` bereits heruntergeladen, der erste Build nach der Installation geht dadurch schneller.
- Die in `ANLEITUNG.md` genannten Pfade von EXE und Installern sind aus den Tauri-Standardnamen abgeleitet und müssen nach dem ersten erfolgreichen Build bestätigt werden.

## Entscheidungen
- 2026-10-24: Projekt mit `create-tauri-app` (Vorlage `react-ts`, Paketmanager npm) erzeugt. Arbeitstitel und Paketname `localprojekt`, App-Identifier `de.localprojekt.desktop`. Der endgültige App-Name wird erst in Etappe 7 festgelegt.
- 2026-10-24: Tests mit Vitest 5 in der jsdom-Umgebung, React-Komponenten werden mit `@testing-library/react` gerendert. Die Vitest-Einstellungen stehen in `vite.config.ts` (Import aus `vitest/config`), damit Vite und Vitest dieselbe Konfiguration nutzen. `src/test-setup.ts` ruft nach jedem Test `cleanup()` auf (über `test.setupFiles`), weil Vitest ohne `globals: true` kein globales `afterEach` bereitstellt und Testing Library sonst nicht aufräumt.
- 2026-10-24: Node.js mindestens 22.22 (jsdom 30 nutzt `Promise.withResolvers`, das es erst ab Node 22 gibt), empfohlen wird die aktuelle LTS 24.
- 2026-10-24: In der Anleitung werden die Visual Studio Build Tools 2022 empfohlen (winget-ID `Microsoft.VisualStudio.2022.BuildTools`, Direktlink geprüft), weil Tauri und rustup damit erprobt sind. Die Build Tools 2026 funktionieren ebenfalls und werden als Alternative genannt.
- 2026-10-24: Das Rust-Beispielkommando `greet` aus der Vorlage bleibt bis Etappe 1 stehen, weil Rust-Änderungen ohne Build-Tools derzeit nicht kompiliert und geprüft werden können.
