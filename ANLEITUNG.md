# Anleitung

Diese Anleitung erklärt, wie du die App auf deinem Windows-PC startest, testest und als EXE baust.
Alle Befehle gibst du in einem Terminal (PowerShell oder Eingabeaufforderung) **im Projektordner** ein,
also in `C:\Users\emre\Documents\eigen_apps\LocalProjekt`.

## 1. Voraussetzungen

Die App besteht aus zwei Teilen: der Oberfläche in React/TypeScript (läuft mit Node.js) und einer
Hülle in Rust (Tauri), die daraus ein echtes Windows-Programm macht. Deshalb brauchst du beide Welten.

| Werkzeug | Wozu | Prüfen mit |
|---|---|---|
| Node.js (LTS, ab Version 20) inklusive npm | Oberfläche bauen, Tests ausführen | `node --version` und `npm --version` |
| Rust über `rustup` (Toolchain `stable-x86_64-pc-windows-msvc`) | Tauri-Hülle kompilieren | `cargo --version` und `rustc --version` |
| Microsoft C++ Build Tools (Visual Studio Build Tools 2022 mit Arbeitslast „Desktopentwicklung mit C++“) | Linker, den Rust unter Windows braucht | Startmenü → „Visual Studio Installer“ zeigt die Build Tools mit angekreuzter Arbeitslast „Desktopentwicklung mit C++“ |
| Microsoft Edge WebView2 Runtime | zeigt die Oberfläche im App-Fenster an | auf Windows 10/11 in der Regel schon vorhanden (Einstellungen → Apps → nach „WebView2“ suchen) |
| Git | Versionsverwaltung | `git --version` |

### Installation, falls etwas fehlt

**Node.js:** <https://nodejs.org> öffnen, die LTS-Version herunterladen und mit Standardeinstellungen installieren.
Alternativ im Terminal:

```
winget install OpenJS.NodeJS.LTS
```

**Rust:** <https://rustup.rs> öffnen, `rustup-init.exe` herunterladen, ausführen und die Standardinstallation
(Option 1) wählen. Alternativ im Terminal:

```
winget install Rustlang.Rustup
```

**Microsoft C++ Build Tools:** <https://visualstudio.microsoft.com/de/visual-cpp-build-tools/> öffnen,
„Build Tools herunterladen“ klicken und den Installer starten. Im Reiter **Workloads** die Arbeitslast
**„Desktopentwicklung mit C++“** ankreuzen (die rechts vorausgewählten Komponenten „MSVC v143“ und
„Windows 11 SDK“ einfach so lassen) und auf „Installieren“ klicken. Die Installation braucht
Administratorrechte und etwa 6 bis 7 GB Speicherplatz. Alternativ im Terminal (es erscheint eine
Administrator-Abfrage):

```
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

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
`.test.tsx` und liegen in `src/` neben dem Code, den sie prüfen. Während des Entwickelns kann
`npx vitest` laufen, dann werden die Tests bei jeder Änderung automatisch wiederholt.

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
- **`cargo: command not found`** oder **`'cargo' is not recognized`**: Rust ist nicht installiert oder das
  Terminal wurde nach der Installation nicht neu gestartet.
- **`Port 1420 is already in use`**: Ein anderer Entwicklungsserver läuft noch. Das andere Terminal mit
  `npm run dev` oder `npm run tauri dev` beenden.
- **`npm install` schlägt fehl**: Node.js-Version prüfen (`node --version`, mindestens 20) und den Befehl
  erneut ausführen.
