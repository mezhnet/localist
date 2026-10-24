# Anleitung

Diese Anleitung erklärt, wie du die App auf deinem Windows-PC startest, testest und als EXE baust.
Alle Befehle gibst du in einem Terminal (PowerShell oder Eingabeaufforderung) **im Projektordner** ein,
also in `C:\Users\emre\Documents\eigen_apps\LocalProjekt`.

## 1. Voraussetzungen

Die App besteht aus zwei Teilen: der Oberfläche in React/TypeScript (läuft mit Node.js) und einer
Hülle in Rust (Tauri), die daraus ein echtes Windows-Programm macht. Deshalb brauchst du beide Welten.

| Werkzeug | Wozu | Prüfen mit |
|---|---|---|
| Node.js LTS inklusive npm (Version 24 empfohlen, mindestens 22.22) | Oberfläche bauen, Tests ausführen | `node --version` und `npm --version` |
| Microsoft C++ Build Tools (Visual Studio Build Tools mit Arbeitslast „Desktopentwicklung mit C++“) | Linker, den Rust unter Windows braucht | Startmenü → „Visual Studio Installer“ zeigt die Build Tools mit angekreuzter Arbeitslast „Desktopentwicklung mit C++“ |
| Rust über `rustup` (Toolchain `stable-x86_64-pc-windows-msvc`) | Tauri-Hülle kompilieren | `cargo --version` und `rustc --version` |
| Microsoft Edge WebView2 Runtime | zeigt die Oberfläche im App-Fenster an | auf Windows 10/11 in der Regel schon vorhanden (Einstellungen → Apps → nach „WebView2“ suchen) |
| Git | Versionsverwaltung | `git --version` |

### Installation, falls etwas fehlt

Die Reihenfolge ist wichtig: **erst die C++ Build Tools, dann Rust.** Sonst bietet das
Rust-Installationsprogramm an, stattdessen das viel größere Visual Studio Community zu installieren.

**Node.js:** <https://nodejs.org> öffnen, die LTS-Version herunterladen und mit Standardeinstellungen
installieren. Alternativ im Terminal:

```
winget install OpenJS.NodeJS.LTS
```

**Microsoft C++ Build Tools:** Am einfachsten im Terminal. Es erscheint eine Administrator-Abfrage, die du
bestätigst. Die Installation braucht etwa 6 bis 7 GB Speicherplatz und je nach Internetverbindung 10 bis 30 Minuten:

```
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Alternativ von Hand: Den Installer der Build Tools für Visual Studio 2022 von
<https://aka.ms/vs/17/release/vs_BuildTools.exe> herunterladen und starten. Im Reiter **Workloads** die
Arbeitslast **„Desktopentwicklung mit C++“** ankreuzen, die rechts vorausgewählten Komponenten
(MSVC-Buildtools und Windows 11 SDK) so lassen und auf „Installieren“ klicken. Auch die neueren
Build Tools 2026 von <https://visualstudio.microsoft.com/de/visual-cpp-build-tools/> funktionieren,
die Arbeitslast heißt dort genauso.

**Rust:** <https://rustup.rs> öffnen, `rustup-init.exe` herunterladen und ausführen. Es erscheint die Frage
„1) Proceed with standard installation“, die du mit `1` und Enter bestätigst. Alternativ im Terminal:

```
winget install Rustlang.Rustup
```

Fragt `rustup-init` stattdessen nach den „Visual C++ prerequisites“ und bietet an, Visual Studio Community
zu installieren, dann hat es die Build Tools nicht gefunden. In dem Fall das Fenster schließen, zuerst die
Build Tools wie oben installieren, ein neues Terminal öffnen und `rustup-init` erneut starten.

**Wichtig:** Nach jeder Installation das Terminal (und VS Code bzw. Claude Code) schließen und neu öffnen.
Erst dann kennen die Programme die neuen Pfade.

## 2. Abhängigkeiten installieren

Einmalig nach dem Herunterladen des Projekts und immer dann, wenn sich `package.json` geändert hat:

```
npm install
```

## 3. App im Entwicklungsmodus starten

```
npm run tauri dev
```

Beim ersten Start kompiliert Rust alle Abhängigkeiten, das dauert einige Minuten. Danach öffnet sich das
App-Fenster. Änderungen an Dateien in `src/` erscheinen sofort im Fenster (Hot Reload). Beenden mit
`Strg+C` im Terminal oder durch Schließen des Fensters.

## 4. EXE und Installer bauen

```
npm run tauri build
```

Der Befehl prüft zuerst die TypeScript-Typen, baut dann die Oberfläche und kompiliert zum Schluss die
Rust-Hülle im Release-Modus. Ergebnis (Pfade relativ zum Projektordner):

- Programm zum direkten Starten: `src-tauri\target\release\localprojekt.exe`
- Installer (MSI): `src-tauri\target\release\bundle\msi\localprojekt_0.1.0_x64_en-US.msi`
- Installer (Setup-EXE): `src-tauri\target\release\bundle\nsis\localprojekt_0.1.0_x64-setup.exe`

Beim allerersten Build lädt Tauri die Installer-Werkzeuge (WiX und NSIS) einmalig herunter, dafür ist eine
Internetverbindung nötig.

## 5. Tests ausführen

```
npm test
```

Führt alle Tests einmal mit Vitest aus und zeigt das Ergebnis an. Testdateien enden auf `.test.ts` oder
`.test.tsx` und liegen in `src/` neben dem Code, den sie prüfen. Die Datei `src/test-setup.ts` wird vor jeder
Testdatei geladen und räumt nach jedem Test das Test-DOM auf. Während des Entwickelns kann `npx vitest`
laufen, dann werden die Tests bei jeder Änderung automatisch wiederholt.

## 6. TypeScript-Typen prüfen

```
npx tsc --noEmit
```

Prüft den gesamten Frontend-Code auf Typfehler, ohne Dateien zu erzeugen. Keine Ausgabe bedeutet: alles in Ordnung.

## 7. Nur die Oberfläche im Browser ansehen

```
npm run dev
```

Startet nur den Vite-Entwicklungsserver unter <http://localhost:1420>. Praktisch für reine Oberflächen-Arbeit,
aber alles, was Tauri braucht (zum Beispiel Dateizugriff), funktioniert dort nicht.

## Häufige Probleme

- **`linker 'link.exe' not found`** beim Bauen: Die Microsoft C++ Build Tools fehlen, siehe Abschnitt 1.
- **`link: extra operand`** und **`Try 'link --help'`** beim Bauen aus Git Bash: dieselbe Ursache. Git Bash bringt ein eigenes `link.exe` mit (ein Werkzeug für Hardlinks), das Rust irrtümlich benutzt, solange die Build Tools fehlen.
- **`cargo: command not found`** oder **`'cargo' is not recognized`**: Rust ist nicht installiert oder das
  Terminal wurde nach der Installation nicht neu gestartet.
- **`npm install` warnt mit `EBADENGINE`** oder **`npm test` bricht mit `Promise.withResolvers is not a function`
  ab**: Node.js ist zu alt. `node --version` prüfen, es muss mindestens 22.22 sein (empfohlen: Version 24), siehe Abschnitt 1.
- **`Port 1420 is already in use`**: Ein anderer Entwicklungsserver läuft noch. Das andere Terminal mit
  `npm run dev` oder `npm run tauri dev` beenden.
- **`npm install` schlägt fehl**: Internetverbindung prüfen und den Befehl erneut ausführen.
