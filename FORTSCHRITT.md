# Fortschritt

## Aktueller Stand
- Etappe: 2 – Notion-Feeling
- Zuletzt aktualisiert: 2026-10-25 12:04
- Nächster Schritt: Editor-Oberfläche: Slash-Menü mit Callout/Toggle, Ziehgriff, [[-Vorschläge und Klick auf Links, danach Links beim Umbenennen anpassen, Dunkelmodus, Icon und Cover.

## Fertig-Kriterien der aktuellen Etappe
- [ ] Slash-Menü (`/`) zum Einfügen von Blöcken.
- [ ] Blöcke lassen sich per Griff (Drag-Handle) verschieben.
- [ ] Callouts und Toggles im Obsidian-Format (siehe Speicherformat).
- [ ] Icon und Cover pro Seite, gespeichert im Frontmatter (`icon`, `cover`).
- [ ] Hell- und Dunkelmodus: folgt dem System, manuell umschaltbar.
- [ ] Links zwischen Seiten als `[[Seitenname]]` mit Vorschlägen beim Tippen, ein Klick öffnet die Seite. Beim Umbenennen einer Seite werden Links darauf im ganzen Vault angepasst.
- [x] Die Roundtrip-Tests decken zusätzlich Callouts, Toggles und `[[Links]]` ab.

## Abgeschlossene Etappen
- Etappe 1 – Vault und Seiten (abgeschlossen am 2026-10-25). Nachweise: `npm test` 56 von 56 Tests grün (6 Testdateien), `cargo test --manifest-path src-tauri/Cargo.toml` 12 von 12 grün, `npx tsc --noEmit` ohne Fehler, `npm run tauri build` ohne Fehler (EXE `src-tauri\target\release\localprojekt.exe`, Installer `src-tauri\target\release\bundle\msi\localprojekt_0.1.0_x64_en-US.msi` und `src-tauri\target\release\bundle\nsis\localprojekt_0.1.0_x64-setup.exe`). Zusätzlich in der Browser-Vorschau durchgeklickt: Vault öffnen und nach Neuladen automatisch wieder öffnen, Seite öffnen, Tippen und automatisch speichern, Änderung und Löschen von außen, Anlegen, Umbenennen, Löschen mit Rückfrage.
  - [x] Der Vault-Ordner lässt sich per Dialog auswählen, der zuletzt geöffnete Vault öffnet sich beim nächsten Start automatisch.
  - [x] Die Sidebar zeigt den Ordnerbaum mit Ordnern und `.md`-Dateien, versteckte Ordner sind ausgeblendet.
  - [x] Seiten und Ordner lassen sich anlegen, umbenennen und löschen (Löschen nur nach Bestätigung).
  - [x] Eine Seite öffnet sich im Block-Editor und wird kurz nach der letzten Eingabe automatisch als Markdown gespeichert.
  - [x] Wird eine Datei außerhalb der App geändert, lädt die App sie neu. Wird sie gelöscht, verschwindet sie aus der Sidebar.
  - [x] Roundtrip-Tests: Markdown → Editor-Format → Markdown liefert für Überschriften, Absätze, fett/kursiv, Listen, Checklisten, Zitate, Code-Blöcke, Links und Bilder denselben Inhalt.
  - [x] Frontmatter bleibt beim Bearbeiten im Editor unverändert erhalten (Test vorhanden).
- Etappe 0 – Fundament (abgeschlossen am 2026-10-24). Am 2026-10-25 auf dem Stand `09838e1` erneut nachgeprüft: `npm test` 2 von 2 Tests grün, `npx tsc --noEmit` ohne Fehler, `npm run tauri build` ohne Fehler und Warnungen (EXE `src-tauri\target\release\localprojekt.exe`, Installer `src-tauri\target\release\bundle\msi\localprojekt_0.1.0_x64_en-US.msi` und `src-tauri\target\release\bundle\nsis\localprojekt_0.1.0_x64-setup.exe`). Zweite Nachprüfung am 2026-10-25 um 10:57 bestanden, nachdem drei Probleme gelöst waren (siehe „Offene Probleme“): `npm test` 2 von 2 Tests grün, `npx tsc --noEmit` ohne Fehler, `npm run tauri build` ohne Fehler und Warnungen (Rust-Teil in 1 min 56 s, EXE und beide Installer neu erzeugt, Pfade wie oben), „Hallo Vault“ in `src/App.tsx` und im Build `dist/assets/`, `git status` sauber, `CLAUDE.md` unverändert (Hash `f4a432f…` gleich in Arbeitskopie und Commit).

## Offene Probleme
- keine.
- Gelöst am 2026-10-25: Rust war nicht mehr installiert (`npm run tauri build` brach mit `cargo metadata … program not found` ab, `%USERPROFILE%\.cargo` und `%USERPROFILE%\.rustup` fehlten). Auf Wunsch des Nutzers per `winget install --id Rustlang.Rustup --exact` neu installiert (rustup 1.29.1, `cargo 1.99.1`, `rustc 1.99.1`, Toolchain `stable-x86_64-pc-windows-msvc`). Der Installer trägt `%USERPROFILE%\.cargo\bin` in den Benutzer-PATH ein. Ein Terminal, das schon vorher offen war, kennt den neuen Pfad erst nach einem Neustart.
- Gelöst am 2026-10-25: Die Microsoft C++ Build Tools fehlten wieder (kein `vswhere.exe`, kein MSVC-Ordner). Auf Wunsch des Nutzers mit demselben winget-Befehl wie am 2026-10-24 neu installiert (Build Tools 2022, Version 17.14.37806.7, MSVC 14.44.35207).
- Gelöst am 2026-10-25: Im Projektordner lag eine vollständige Kopie des Projekts im Unterordner `LocalProjekt/` (2,1 GB, eigenes `.git` auf demselben Commit `805e19d`, angelegt am 2026-10-25 um 10:00). Sie enthielt keine eigenen Dateien. Folgen waren `?? LocalProjekt/` in `git status` und ein roter `npm test`: Vitest führte auch `LocalProjekt/src/App.test.tsx` aus, der mit den Bibliotheken der Kopie nicht aufgeräumt wurde. Auf Wunsch des Nutzers nach `C:\Users\emre\Documents\eigen_apps\LocalProjekt-Kopie` verschoben, von dort kann der Nutzer sie selbst löschen. Danach `git status` sauber und `npm test` 2 von 2 grün.
- Gelöst am 2026-10-24: Die Microsoft C++ Build Tools fehlten. Auf Wunsch des Nutzers wurden sie aus der Sitzung per `winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` installiert (Build Tools 2022 Version 17.14.42, MSVC 14.44.35207, Windows 11 SDK). Rust fand den Linker ohne Neustart.

## Entscheidungen
- 2026-10-25: Der zuletzt geöffnete Vault wird in `zustand.json` im App-Datenordner gemerkt (Windows: `%APPDATA%de.localprojekt.desktop`), nicht im Vault. Beim Öffnen legt die App `.meinapp/settings.json` an, falls es fehlt.
- 2026-10-25: Löschen verschiebt Seiten und Ordner in den Papierkorb des Systems (Rust-Paket `trash`), damit nichts endgültig verloren geht.
- 2026-10-25: Für die Entwicklung im Browser simuliert `src/lib/dev-backend.ts` die Rust-Kommandos mit einem Vault im Arbeitsspeicher (Inhalt aus `beispiel-vault/`). Die Oberflächen-Tests (`src/App.test.tsx`) nutzen dieselbe Simulation. In der gebauten App ist sie nicht enthalten.
- 2026-10-25: Slash-Menü und Ziehgriff von BlockNote sind in Etappe 1 abgeschaltet (`slashMenu={false}`, `sideMenu={false}`), weil sie zu Etappe 2 gehören. Ebenso gibt es vorerst nur den hellen Modus.
- 2026-10-25: Eigener Markdown-Konverter (`src/markdown/`) auf Basis von remark (mdast) statt der eingebauten Markdown-Funktionen von BlockNote. Diese gehen über HTML und sind laut BlockNote selbst verlustbehaftet (`blocksToMarkdownLossy`). Der Konverter erzeugt beim Speichern zuerst unmaskiertes Markdown und liest es zur Kontrolle wieder ein. Nur wenn das Ergebnis abweicht, wird maskiert (z. B. `*`). So bleiben Obsidian-Schreibweisen wie `[[Seite]]` oder `> [!info]` unverändert. Markdown, für das es keinen Editor-Block gibt (Tabellen, HTML, Fußnoten), bleibt als Block `rawMarkdown` bzw. Formatierung `raw` wörtlich erhalten. BlockNote bleibt der Editor.
- 2026-10-25: Das Editor-Schema (`src/editor/schema.ts`) enthält nur Blöcke und Formatierungen mit Markdown-Entsprechung. Unterstreichen wird als `<u>…</u>` gespeichert (wie in Obsidian). Textfarben, Ausrichtung, Tabellen, Audio/Video und Toggle-Überschriften sind nicht enthalten.
- 2026-10-24: Projekt mit `create-tauri-app` (Vorlage `react-ts`, Paketmanager npm) erzeugt. Arbeitstitel und Paketname `localprojekt`, App-Identifier `de.localprojekt.desktop`. Der endgültige App-Name wird erst in Etappe 7 festgelegt.
- 2026-10-24: Tests mit Vitest 5 in der jsdom-Umgebung, React-Komponenten werden mit `@testing-library/react` gerendert. Die Vitest-Einstellungen stehen in `vite.config.ts` (Import aus `vitest/config`), damit Vite und Vitest dieselbe Konfiguration nutzen. `src/test-setup.ts` ruft nach jedem Test `cleanup()` auf (über `test.setupFiles`), weil Vitest ohne `globals: true` kein globales `afterEach` bereitstellt und Testing Library sonst nicht aufräumt.
- 2026-10-24: Node.js mindestens 22.22 (jsdom 30 nutzt `Promise.withResolvers`, das es erst ab Node 22 gibt), empfohlen wird die aktuelle LTS 24.
- 2026-10-24: In der Anleitung werden die Visual Studio Build Tools 2022 empfohlen (winget-ID `Microsoft.VisualStudio.2022.BuildTools`, Direktlink geprüft), weil Tauri und rustup damit erprobt sind. Die Build Tools 2026 funktionieren ebenfalls und werden als Alternative genannt.
- 2026-10-24: Fehlende Werkzeuge werden dem Nutzer per Rückfrage zur Installation aus der Sitzung angeboten (winget, der Nutzer bestätigt die Administrator-Abfrage), statt nur anzuhalten. So geschehen bei den C++ Build Tools.
- 2026-10-24: Das Rust-Beispielkommando `greet` aus der Vorlage bleibt bis Etappe 1 stehen; es wird dort durch echte Kommandos ersetzt.
