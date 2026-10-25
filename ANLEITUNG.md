# Anleitung für Localist 1.0.0

Localist ist ein Notiz- und Projektmanager im Stil von Notion, der alle Seiten als Markdown-Dateien in einem Ordner
deiner Wahl speichert. Diese Anleitung erklärt, wie du Localist installierst, im Entwicklungsmodus startest, testest
und selbst baust.

## 0. Localist einfach nur benutzen

Wer nur die fertige App möchte, braucht keine der Entwicklerwerkzeuge unten:

1. `src-tauri\target\release\bundle\nsis\Localist_1.0.0_x64-setup.exe` doppelklicken (oder die MSI-Datei daneben).
2. Den Schritten des deutschen Installationsassistenten folgen. Danach steht **Localist** im Startmenü.
3. Beim ersten Start einen Vault-Ordner wählen (siehe Abschnitt 8).

Deinstallieren geht wie bei jedem Programm über Windows-Einstellungen → Apps. Deine Vault-Ordner bleiben dabei
unangetastet.

## Für Entwicklerinnen und Entwickler

Alle folgenden Befehle gibst du in einem Terminal (PowerShell oder Eingabeaufforderung) **im Projektordner** ein,
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

- Programm zum direkten Starten: `src-tauri\target\release\localist.exe`
- Installer (MSI, deutsch): `src-tauri\target\release\bundle\msi\Localist_1.0.0_x64_de-DE.msi`
- Installer (Setup-EXE, deutsch): `src-tauri\target\release\bundle\nsis\Localist_1.0.0_x64-setup.exe`

Beim allerersten Build lädt Tauri die Installer-Werkzeuge (WiX und NSIS) einmalig herunter, dafür ist eine
Internetverbindung nötig.

**Version und Icon ändern:** Die Versionsnummer steht in `package.json`, `src-tauri/Cargo.toml` und
`src-tauri/tauri.conf.json` (alle drei gleich halten). Das App-Icon entsteht aus `app-icon.svg`. Nach einer Änderung
erzeugt `npx tauri icon app-icon.svg` alle Größen in `src-tauri/icons/` neu.

## 5. Tests ausführen

```
npm test
```

Führt alle Tests der Oberfläche einmal mit Vitest aus und zeigt das Ergebnis an. Testdateien enden auf `.test.ts` oder
`.test.tsx` und liegen in `src/` neben dem Code, den sie prüfen. Die Datei `src/test-setup.ts` wird vor jeder
Testdatei geladen und räumt nach jedem Test das Test-DOM auf. Während des Entwickelns kann `npx vitest`
laufen, dann werden die Tests bei jeder Änderung automatisch wiederholt.

Die Tests der Rust-Seite (Ordnerbaum, sicheres Speichern, Umbenennen, Dateiwächter) laufen getrennt davon:

```
cargo test --manifest-path src-tauri/Cargo.toml
```

Sie legen nur temporäre Ordner im Temp-Verzeichnis von Windows an und löschen sie danach wieder.

## 6. TypeScript-Typen prüfen

```
npx tsc --noEmit
```

Prüft den gesamten Frontend-Code auf Typfehler, ohne Dateien zu erzeugen. Keine Ausgabe bedeutet: alles in Ordnung.

## 7. Nur die Oberfläche im Browser ansehen

```
npm run dev
```

Startet nur den Vite-Entwicklungsserver unter <http://localhost:1420>. Praktisch für reine Oberflächen-Arbeit.
Im Browser gibt es keinen Zugriff auf echte Dateien. Stattdessen arbeitet die Oberfläche mit einem
**simulierten Vault** im Arbeitsspeicher, der mit dem Inhalt von `beispiel-vault/` gefüllt ist
(`src/lib/dev-backend.ts`). Änderungen dort sind nach dem Neuladen der Seite weg, echte Dateien bleiben unberührt.

## 8. Erste Schritte in der App

1. Beim ersten Start auf **„Vault-Ordner öffnen …“** klicken und einen Ordner wählen. Zum Ausprobieren eignet sich eine
   **Kopie** von `beispiel-vault/` (nicht den Ordner im Projekt selbst, damit die Testdaten unverändert bleiben).
   Die App merkt sich den Ordner und öffnet ihn beim nächsten Start automatisch. „Wechseln“ oben in der Sidebar
   öffnet einen anderen Ordner.
2. **Sidebar:** Ein Klick auf einen Ordner klappt ihn auf, ein Klick auf eine Seite öffnet sie. Versteckte Ordner wie
   `.localist` und Dateien, die keine `.md`-Dateien sind, werden nicht angezeigt.
3. **Anlegen:** „+ Neue Seite“ bzw. „+ Neuer Ordner“ oben, das „+“ neben einem Ordner oder ein Rechtsklick. Eine neue
   Seite bekommt sofort eine eindeutige `id` im Frontmatter. Den Titel tippst du gleich oben auf der Seite ein.
4. **Umbenennen:** großen Seitentitel ändern, in der Sidebar `F2` drücken oder Rechtsklick → „Umbenennen“.
5. **Löschen:** Rechtsklick bzw. „⋯“ → „Löschen …“ oder `Entf`. Nach einer Rückfrage landet der Eintrag im
   **Papierkorb** von Windows und lässt sich dort wiederherstellen.
6. **Speichern** passiert automatisch etwa eine halbe Sekunde nach der letzten Eingabe. Es gibt keinen Speichern-Knopf.
7. Ändert ein anderes Programm (z. B. Obsidian) eine geöffnete Seite, lädt die App sie neu. Wird sie dort gelöscht,
   verschwindet sie aus der Sidebar.
8. **Blöcke einfügen:** `/` tippen öffnet das Slash-Menü (Überschriften, Listen, Zitat, Callout, Toggle, Code, Bild …).
   Links neben jedem Block erscheinen beim Überfahren `+` und der Ziehgriff `⠿`: Mit dem Griff verschiebst du Blöcke,
   ein Klick darauf öffnet ein Menü zum Löschen.
9. **Callouts und Toggles** werden wie in Obsidian gespeichert: `> [!info] Titel`, ein Toggle als `> [!note]- Titel`.
   Ein Klick auf das Symbol im Callout wechselt den Typ (Info, Warnung, Tipp …).
10. **Links zwischen Seiten:** `[[` tippen und eine Seite aus den Vorschlägen wählen. Ein Klick auf den Link öffnet die
    Seite. Fehlt sie noch, wird sie angelegt. Benennst du eine Seite um, passt die App alle Links darauf im Vault an.
11. **Icon und Cover:** Beim Überfahren des Seitenkopfs erscheinen „Icon hinzufügen“ und „Cover hinzufügen“.
    Beides steht im Frontmatter (`icon`, `cover`). Bilder von außerhalb werden nach `Anhänge/` kopiert.
12. **Hell/Dunkel:** unten in der Sidebar unter „Darstellung“. „Wie System“ folgt der Windows-Einstellung.
13. **Eigenschaften:** Unter dem Seitentitel stehen die Eigenschaften der Seite (Text, Zahl, Auswahl, Mehrfachauswahl,
    Status, Datum, Checkbox, URL). „+ Eigenschaft hinzufügen“ legt eine neue an, ein Klick auf den Namen ändert den Typ.
    Gespeichert wird im Frontmatter, z. B. `fällig: 2026-11-15`. Andere Felder im Frontmatter bleiben unverändert.
14. **Datenbanken:** Rechtsklick auf einen Ordner → „In Datenbank umwandeln“. Die App legt darin `_ansichten.yaml` an
    (Eigenschaftstypen und Ansichten). Ein Klick auf die Datenbank (🗃️) zeigt die Tabelle: eine Zeile pro Seite, eine
    Spalte pro Eigenschaft. Werte änderst du direkt in der Zelle, „Filter“ und „Sortieren“ bzw. ein Klick auf eine
    Spaltenüberschrift stellen die Ansicht ein, „+ Neu“ legt eine neue Seite an.
15. **Kanban und mehrere Ansichten:** Über dem Inhalt einer Datenbank stehen Reiter. „+“ fügt eine Ansicht hinzu
    (Tabelle oder Kanban), ein Doppelklick auf einen Reiter benennt sie um. Das Kanban gruppiert nach einer Status- oder
    Auswahl-Eigenschaft („Gruppieren nach“). Zieh eine Karte in eine andere Spalte, um den Wert in der Datei zu ändern.
    „+ Neu“ unter einer Spalte legt eine Seite mit diesem Wert an, ein Klick auf eine Karte öffnet die Seite.
16. **Kalender:** „+“ bei den Reitern → „📅 Kalender“ (dafür braucht die Datenbank eine Datums-Eigenschaft). Oben
    wählst du Monat oder Woche und blätterst mit ‹ und ›. Ein Klick auf einen Tag legt eine Seite mit diesem Datum an,
    ein Eintrag lässt sich auf einen anderen Tag ziehen (eine Uhrzeit bleibt dabei erhalten). Einträge ohne Datum
    stehen rechts unter „Ohne Datum“ und lassen sich von dort in den Kalender ziehen.
17. **Suchen:** `Strg+P` öffnet die Schnellsuche nach Seitentiteln (auch Abkürzungen wie „wsr“ für „Website-Relaunch“).
    `Strg+Umschalt+F` durchsucht den Text aller Seiten. Mit ↑/↓ auswählen, Enter öffnet, Esc schließt.
    Der Suchindex liegt im Cache-Ordner der App (`%LOCALAPPDATA%\de.localist.desktop\suchindex\`), nicht im Vault.
    Du kannst ihn jederzeit löschen, er wird automatisch neu aufgebaut.
18. **Vorlagen:** Jede Seite im Ordner `Vorlagen/` ist eine Vorlage. „+ Seite aus Vorlage“ (oder Rechtsklick auf einen
    Ordner) legt eine neue Seite mit Eigenschaften und Inhalt der Vorlage an. `{{title}}`, `{{date}}` und `{{time}}`
    werden dabei ersetzt.
19. **Backlinks:** Unten auf jeder Seite steht unter „Verlinkt von“, welche Seiten mit `[[…]]` auf sie verweisen.

## Was Localist wo speichert

| Was | Wo |
|---|---|
| Deine Seiten, Eigenschaften, Datenbanken (`_ansichten.yaml`) | im Vault-Ordner, als normale Dateien |
| Einstellungen des Vaults (z. B. Eigenschaftstypen) | `<Vault>\.localist\settings.json` |
| Zuletzt geöffneter Vault | `%APPDATA%\de.localist.desktop\zustand.json` |
| Suchindex (jederzeit löschbar) | `%LOCALAPPDATA%\de.localist.desktop\suchindex\` |
| Hell/Dunkel, zuletzt gewählte Ansicht einer Datenbank | im Browser-Speicher der App (WebView2) |

Vaults aus der Vorabversion mit dem Einstellungsordner `.meinapp` werden beim ersten Öffnen automatisch übernommen:
Localist benennt den Ordner in `.localist` um. Auch der zuletzt geöffnete Vault wird aus der Vorabversion übernommen.

## Häufige Probleme

### In der App

- **„Der Vault-Ordner ist nicht erreichbar“**: Der Ordner wurde verschoben, umbenannt oder das Laufwerk (z. B. ein
  USB-Stick) ist nicht angeschlossen. Sobald er wieder da ist, lädt Localist ihn von selbst. Sonst „Anderen Vault
  öffnen …“ wählen.
- **„Die Datei … ist keine gültige UTF-8-Textdatei“**: Die Datei endet auf `.md`, ist aber keine Textdatei (oder in
  einer alten Zeichenkodierung gespeichert). In einem Texteditor als UTF-8 speichern.
- **„Speichern fehlgeschlagen: …“**: Meist ist die Datei schreibgeschützt oder ein anderes Programm sperrt sie.
  Die Eingaben bleiben im Editor erhalten und werden bei der nächsten Änderung erneut gespeichert.
- **„Da ist etwas schiefgegangen“**: Ein unerwarteter Fehler in der Oberfläche. „App neu laden“ klicken. Gespeicherte
  Seiten sind davon nicht betroffen.

### Beim Entwickeln und Bauen

- **`linker 'link.exe' not found`** beim Bauen: Die Microsoft C++ Build Tools fehlen, siehe Abschnitt 1.
- **`link: extra operand`** und **`Try 'link --help'`** beim Bauen aus Git Bash: dieselbe Ursache. Git Bash bringt ein eigenes `link.exe` mit (ein Werkzeug für Hardlinks), das Rust irrtümlich benutzt, solange die Build Tools fehlen.
- **`cargo: command not found`** oder **`'cargo' is not recognized`**: Rust ist nicht installiert oder das
  Terminal wurde nach der Installation nicht neu gestartet.
- **`npm install` warnt mit `EBADENGINE`** oder **`npm test` bricht mit `Promise.withResolvers is not a function`
  ab**: Node.js ist zu alt. `node --version` prüfen, es muss mindestens 22.22 sein (empfohlen: Version 24), siehe Abschnitt 1.
- **`Port 1420 is already in use`**: Ein anderer Entwicklungsserver läuft noch. Das andere Terminal mit
  `npm run dev` oder `npm run tauri dev` beenden.
- **`npm install` schlägt fehl**: Internetverbindung prüfen und den Befehl erneut ausführen.
- **`npm test` zeigt Testdateien doppelt** (zum Beispiel `LocalProjekt/src/App.test.tsx` zusätzlich zu `src/App.test.tsx`)
  **oder `git status` zeigt einen unbekannten Unterordner**: Im Projektordner liegt eine Kopie des Projekts. Vitest
  findet deren Tests mit, und diese schlagen fehl. Die Kopie aus dem Projektordner heraus verschieben.
