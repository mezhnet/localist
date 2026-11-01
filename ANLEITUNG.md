# Anleitung für Localist 2.2.0

Localist ist ein Notiz- und Projektmanager im Stil von Notion, der alle Seiten als Markdown-Dateien in einem Ordner
deiner Wahl speichert. Neben Notizen gibt es interaktive HTML-Seiten mit Bausteinen wie Karteikarten, Quiz und
Diagrammen. Diese Anleitung erklärt, wie du Localist installierst, benutzt, im Entwicklungsmodus startest, testest
und selbst baust.

## Neu in Version 2.3.1

- **Updates auf dem Handy:** Auch auf Android steht unter **Einstellungen → „Über Localist“** jetzt **„Nach Updates
  suchen“**. Erst nach diesem Klick fragt Localist bei GitHub nach, nie von selbst. Gibt es eine neue Version,
  erscheint sofort **„Jetzt installieren“**: Localist speichert alles, lädt die neue APK (mit Prozentanzeige) und
  öffnet den Installer von Android. Dort auf **„Aktualisieren“** tippen. Beim ersten Mal fragt Android vorher, ob
  Localist Apps installieren darf: „Aus dieser Quelle zulassen“ einschalten und zurück.
- **Einmal neu installieren:** Ab 2.3.1 ist die APK mit einem festen Schlüssel signiert und viel kleiner (etwa 8 MB
  statt 300 MB). Über die alte 2.3.0 installiert Android sie deshalb nicht. Einmal die alte Localist-App
  deinstallieren, dann `Localist_2.3.1_android.apk` aus dem Release installieren und den Vault wieder öffnen. Ein
  Vault im internen Speicher (z. B. `Documents`) bleibt dabei erhalten; ein Vault im „App-Speicher“ würde mit
  gelöscht. Danach gehen alle Updates ohne Deinstallieren.
- **Automatisch gebaut:** Die APK baut GitHub jetzt bei jedem Release selbst, neben dem Windows-Installer.

## Neu in Version 2.3

- **Ziehen und Ablegen:** Seiten und Ordner lassen sich in der Seitenleiste in einen anderen Ordner ziehen – jetzt
  auch in der installierten App unter Windows und auf dem Handy. Am PC: Zeile mit gedrückter linker Maustaste greifen
  und auf den Zielordner ziehen. Auf dem Handy: etwa eine halbe Sekunde auf die Zeile drücken, ohne den Finger zu
  bewegen; die Zeile hebt sich an (das Handy vibriert kurz), dann mit dem Finger zum Ziel ziehen und loslassen.
  Kurz antippen öffnet wie bisher, Wischen scrollt wie bisher, und wer lange drückt und ohne Bewegung loslässt,
  bekommt wie bisher das Menü mit allen Aktionen.
- **Hilfen beim Ziehen:** Der Zielordner ist farbig markiert. Bleibst du kurz über einem zugeklappten Ordner, klappt
  er auf. Am oberen und unteren Rand scrollt die Liste von selbst weiter. Für die oberste Ebene des Vaults gibt es
  beim Ziehen unten die Fläche „In die oberste Ebene“. **Escape** bricht ab, dann wird nichts verschoben.
- **Sicher:** Liegt im Ziel schon eine Seite mit demselben Namen (auch als Notiz und HTML-Seite gemischt), wird nichts
  verschoben, und eine Meldung sagt warum. Nach dem Verschieben steht unten „„Ideen“ nach „Projekte“ verschoben“ mit
  dem Knopf **„Rückgängig“** (etwa 6 Sekunden lang). Links, Favoriten und offene Reiter folgen beim Verschieben und
  beim Rückgängigmachen.
- **Auch per Ziehen:** Kanban-Karten in eine andere Spalte und die Reihenfolge im Inhaltsverzeichnis eines
  Notizbuchs – mit Maus und Finger.
- **Dateien aus dem Explorer** (z. B. ein Bild) lassen sich nicht in Localist fallen lassen; der Mauszeiger zeigt
  dann „nicht erlaubt“. So war es schon vorher, nur sicherer: Die App bleibt dabei unverändert offen.

## Neu in Version 2.2

- **Updates:** Unter **Einstellungen → „Über Localist“** steht die Versionsnummer und der Knopf **„Nach Updates
  suchen“**. Erst nach diesem Klick fragt Localist bei GitHub Releases nach – nie beim Start und nie im Hintergrund,
  und außer dieser Anfrage wird nichts gesendet. Gibt es eine neue Version, zeigt Localist „Update verfügbar“ mit den
  Neuigkeiten. **„Jetzt installieren“** speichert zuerst alle Änderungen, lädt das Update (mit Prozentanzeige),
  installiert es und startet Localist neu. Klappt etwas nicht (z. B. kein Internet), erscheint eine Meldung, und
  Localist läuft normal weiter.
- **Handy:** Auf Android gibt es kein automatisches Update. „Neue Versionen auf GitHub ansehen“ öffnet die
  Releases-Seite im Browser.
- **Neue Versionen veröffentlichen:** `node scripts/version.mjs 2.2.1` setzt die Versionsnummer überall gleich und legt
  den Tag an, `git push --follow-tags` startet auf GitHub den automatischen Build. Was du dafür einmal auf github.com
  einrichten musst (Repository, Schlüssel, Secrets), steht Schritt für Schritt in `ANLEITUNG-RELEASE.md`.

## Neu in Version 2.1

Version 2.1 bringt vor allem ein neues Aussehen und eine bessere Bedienung, auf dem PC und auf dem Handy. Deine
Seiten und Vaults bleiben, wie sie sind; es ändert sich nichts an den Dateien.

- **Hell, Dunkel und Schwarz:** Unten in der Seitenleiste stehen drei Knöpfe (Sonne = Hell, Mond = Dunkel, gefüllter
  Kreis = Schwarz). Schwarz nutzt echtes Schwarz statt Dunkelgrau; auf OLED-Displays bleiben diese Pixel aus. Unter
  **Einstellungen → Darstellung** wählst du zusätzlich **„Wie System“** (Localist folgt Windows bzw. Android) und eine
  von vier **Akzentfarben** (Orange, Blau, Grün, Lila). HTML-Seiten und Notizbücher übernehmen Modus und Farbe sofort.
- **Fenster und Seitenleiste:** Localist hat einen eigenen, schlichten Fensterrahmen. Ziehen an der oberen Leiste
  verschiebt das Fenster, ein Doppelklick maximiert es, `Win+Pfeiltasten` docken es an. Die Seitenleiste stellst du
  unter „Darstellung“ **links oder rechts**; mit dem Knopf oben oder **`Strg+.`** klappst du sie ein und aus.
- **Reiter:** Über dem Inhalt stehen Reiter wie im Browser. Ein Klick öffnet eine Seite im aktuellen Reiter,
  **Strg+Klick** oder ein Klick mit dem **Mausrad** in einem neuen. `Strg+T` öffnet einen neuen Reiter, `Strg+W`
  schließt ihn, `Strg+Tab` und `Strg+Umschalt+Tab` wechseln. Vor jedem Wechsel ist gespeichert, und beim nächsten
  Start sind deine Reiter wieder da.
- **Startseite mit „Schnell notieren …“:** Schreib einen Gedanken und drück **Enter**. Die erste Zeile wird zum Titel
  einer neuen Notiz in der Vault-Wurzel, der Rest zum Inhalt (`Umschalt+Enter` macht eine neue Zeile). Darunter stehen
  „Zuletzt bearbeitet“ (mit „Alle Seiten“) und deine Favoriten.
- **Seitenkopf:** Oben auf jeder Seite stehen der Pfad, ob gespeichert ist („gerade eben gespeichert“; ein Fehler
  erscheint rot), der **Stern** für Favoriten und **„…“** mit allen Aktionen.
- **Tabellen in Notizen:** Über `/` → „Tabelle“ einfügen, Zellen direkt bearbeiten, mit „+“ am Rand Zeilen und Spalten
  hinzufügen. In der Datei steht weiterhin eine normale Markdown-Tabelle, die auch Obsidian anzeigt.
- **Ein- und Ausrücken:** `Tab` rückt Listenpunkte und Checklisten ein, `Umschalt+Tab` rückt sie aus. Im Code-Editor
  der HTML-Seiten rückt `Tab` die Zeile ein; mit `Esc` und danach `Tab` verlässt du den Editor.
- **„Im Explorer öffnen“:** Rechtsklick auf eine Seite oder einen Ordner (oder „…“ im Seitenkopf) zeigt sie im
  Windows-Explorer; im Vault-Menü oben gibt es „Vault im Explorer öffnen“.
- **HTML-Seiten in „Geteilt“:** Der Knopf „Seiten tauschen“ stellt den Code links oder rechts (auch unter
  Einstellungen). Die Trennlinie lässt sich mit Maus, Finger oder Pfeiltasten verschieben; ein Doppelklick setzt sie
  auf die Mitte zurück.
- **Seite „Bausteine“:** nutzt jetzt die ganze Fensterbreite; die Hilfe zeigt Erklärung und Beispielcode nebeneinander.
- **Auf dem Handy:** Unten steht eine **Navigationsleiste** mit **Start**, **Suchen**, **„+“** (neue Notiz,
  HTML-Seite, Ordner, Datenbank oder Vorlage), **Seiten** (Ordnerbaum mit Favoriten) und **Einstellungen**. Eine Seite
  hat oben einen **Zurück-Pfeil** mit dem Ordnernamen, die Eigenschaften stehen als kleine Chips in einer Zeile (antippen
  zum Bearbeiten). Beim Schreiben erscheint über der Tastatur eine Leiste mit **„+“** (Baustein wählen),
  **Checkliste**, **Callout**, **Toggle**, **Bild** und **„Fertig“** (schließt die Tastatur). Alle Knöpfe sind
  mindestens 44 px groß, damit sie sich gut mit dem Finger treffen lassen.
- **Neuer Ordnername:** Das Projekt liegt jetzt in `C:\Users\emre\Documents\eigen_apps\Localist`.

## Neu in Version 2.0

- **Neues Design:** ruhiger, aufgeräumter Look in Hell und Dunkel, Favoriten oben in der Sidebar, ein „Neu“-Menü für
  alles, eine Startseite mit zuletzt bearbeiteten Seiten und Schnellaktionen. Bedienbar ab 360 px Breite (Handy).
- **HTML-Seiten:** ein zweiter Seitentyp neben Notizen (`.html`). Gedacht für Lernseiten, Übersichten und alles
  Interaktive. Drei Ansichten: „Lesen“, „Code“ und „Geteilt“ (Code links, Vorschau rechts), umschalten mit `Strg+E`.
- **Bausteine:** Callout, Toggle, Tabelle, Checkliste, Spalten, Bild, Trennlinie, Code-Block, Seitenlink sowie
  Karteikarte, Kartenstapel mit Lernmodus, Quiz und Diagramm. Einfügen per Werkzeugleiste oder `/` im Code-Editor,
  bearbeiten ohne Code über das Stift-Symbol.
- **Eigene Bausteine („Code-Speicher“):** markierten Code als eigenen Baustein speichern und immer wieder einfügen.
  Der Bereich „Bausteine“ in der Sidebar zeigt die ganze Bibliothek mit Vorschau und eine Hilfe mit Beispielcode.
- **Notizbücher:** Ein Ordner wird zu einer kleinen Website mit Inhaltsverzeichnis, „Zurück“ und „Weiter“.
- **Umwandeln und Export:** eine Notiz in eine HTML-Seite umwandeln, jede Seite als eigenständige HTML-Datei
  exportieren (zum Weitergeben, funktioniert ohne Localist).
- **Verschieben** von Seiten und Ordnern per Drag & Drop oder „Verschieben nach …“. Links im Vault werden angepasst.
- **Sicherheit:** HTML-Seiten laufen in einer abgeschotteten Anzeige ohne Internet und ohne Zugriff auf deine Dateien
  oder die App. Ein eingebauter Selbsttest prüft das (`localist.exe --sicherheitstest`).

## 0. Localist einfach nur benutzen

Wer nur die fertige App möchte, braucht keine der Entwicklerwerkzeuge unten:

1. `src-tauri\target\release\bundle\nsis\Localist_2.2.0_x64-setup.exe` doppelklicken (oder die MSI-Datei daneben).
2. Den Schritten des deutschen Installationsassistenten folgen. Danach steht **Localist** im Startmenü.
3. Beim ersten Start einen Vault-Ordner wählen (siehe Abschnitt 8, für HTML-Seiten Abschnitt 9).

Deinstallieren geht wie bei jedem Programm über Windows-Einstellungen → Apps. Deine Vault-Ordner bleiben dabei
unangetastet.

## Für Entwicklerinnen und Entwickler

Alle folgenden Befehle gibst du in einem Terminal (PowerShell oder Eingabeaufforderung) **im Projektordner** ein,
also in `C:\Users\emre\Documents\eigen_apps\Localist`.

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
- Installer (MSI, deutsch): `src-tauri\target\release\bundle\msi\Localist_2.2.0_x64_de-DE.msi`
- Installer (Setup-EXE, deutsch): `src-tauri\target\release\bundle\nsis\Localist_2.2.0_x64-setup.exe`

Beim allerersten Build lädt Tauri die Installer-Werkzeuge (WiX und NSIS) einmalig herunter, dafür ist eine
Internetverbindung nötig.

**Version und Icon ändern:** Die Versionsnummer steht in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`
und `src-tauri/tauri.conf.json` (alle gleich halten; `Cargo.lock` zieht `cargo` beim nächsten Bauen selbst nach). Das App-Icon entsteht aus `app-icon.svg`. Nach einer Änderung
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

Weitere Prüfungen (optional, die gebaute App und Microsoft Edge müssen vorhanden sein):

- `src-tauri\target\release\localist.exe --sicherheitstest` prüft, dass HTML-Seiten keinen Zugriff auf App,
  Dateien außerhalb des Vaults oder Internet haben, und gibt eine Tabelle aus (Exit-Code 0 = bestanden).
- `node scripts/klickliste.mjs http://localhost:1420 "Test"` klickt bei laufendem `npm run dev` die wichtigsten
  Funktionen der Version 1.0 in einem unsichtbaren Edge-Fenster durch.
- `npm run screenshots -- http://localhost:1420 <Ordner> <etappe9|…|etappe14>` speichert Screenshots der Oberfläche.

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
HTML-Seiten liefert dabei eine kleine Erweiterung von Vite aus `beispiel-vault/` aus, mit denselben Regeln wie in
der App (abgeschottete Anzeige, kein Internet).

## 8. Erste Schritte in der App

1. Beim ersten Start auf **„Vault-Ordner öffnen …“** klicken und einen Ordner wählen. Zum Ausprobieren eignet sich eine
   **Kopie** von `beispiel-vault/` (nicht den Ordner im Projekt selbst, damit die Testdaten unverändert bleiben).
   Die App merkt sich den Ordner und öffnet ihn beim nächsten Start automatisch. Ein Klick auf den Vault-Namen oben
   in der Sidebar öffnet einen anderen Ordner.
2. **Sidebar:** Oben stehen „Suchen“, „Volltextsuche“, „Startseite“, „Bausteine“, „Neue Seite“ und deine **Favoriten**
   (Stern im Seitenkopf oder „⋯“ → „Zu Favoriten hinzufügen“), darunter unter „Seiten“ alle Seiten. Ein Klick auf einen Ordner klappt ihn auf, ein Klick auf
   eine Seite öffnet sie. Notizen (`.md`) und HTML-Seiten (`.html`) haben verschiedene Symbole. Versteckte Ordner wie
   `.localist` und andere Dateien werden nicht angezeigt.
3. **Anlegen:** „Neue Seite“ in der Sidebar (Notiz, HTML-Seite, Ordner, Datenbank, Notiz aus Vorlage), das „+“ neben einem
   Ordner oder ein Rechtsklick. Eine neue Seite bekommt sofort eine eindeutige `id`. Den Titel tippst du gleich oben
   auf der Seite ein. **Verschieben:** Seiten und Ordner in der Sidebar auf einen anderen Ordner ziehen oder „⋯“ →
   „Verschieben nach …“; Links im Vault werden dabei angepasst.
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
12. **Hell, Dunkel, Schwarz:** die drei Knöpfe unten in der Sidebar oder „Einstellungen“ → „Darstellung“ (dort auch
    „Wie System“, das der Windows-Einstellung folgt, und die Akzentfarbe).
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
18. **Vorlagen:** Jede Seite im Ordner `Vorlagen/` ist eine Vorlage, auch HTML-Seiten. „Neu“ → „Notiz aus Vorlage …“
    (oder Rechtsklick auf einen Ordner) legt eine neue Seite mit Eigenschaften und Inhalt der Vorlage an.
    `{{title}}`, `{{date}}` und `{{time}}` werden dabei ersetzt.
19. **Backlinks:** Unten auf jeder Seite steht unter „Verlinkt von“, welche Seiten mit `[[…]]` auf sie verweisen.

## 9. HTML-Seiten, Bausteine und Notizbücher – kurze Einführung

Notizen (`.md`) sind für schnelles Schreiben gedacht. **HTML-Seiten** (`.html`) sind für Seiten, die mehr können
sollen: Karteikarten zum Lernen, ein Quiz, Diagramme, Spalten. Du brauchst dafür keine Vorkenntnisse – die meisten
Dinge gehen per Klick. Wer mag, lernt nebenbei ein bisschen HTML.

**Was ist HTML?** HTML ist die Sprache, in der Webseiten geschrieben sind. Text steht zwischen *Tags* in spitzen
Klammern: `<h2>Überschrift</h2>`, `<p>Ein Absatz</p>`. Ein Tag wird geöffnet (`<p>`) und mit Schrägstrich wieder
geschlossen (`</p>`). Alles, was du schreibst, steht in der Datei zwischen `<main>` und `</main>`; den Rest der Datei
(Kopfbereich mit Titel, Icon und Verweisen) verwaltet Localist.

**Eine HTML-Seite anlegen:** „Neu“ in der Sidebar → **HTML-Seite**. Die Seite öffnet sich in der Ansicht **„Geteilt“**:
links der Code, rechts die fertige Seite. Die Vorschau aktualisiert sich kurz nach dem Tippen. Mit den Knöpfen oben
rechts oder `Strg+E` wechselst du zwischen **Lesen**, **Code** und **Geteilt**. Der Code-Editor zeigt nur den Inhalt
von `<main>`; der Schalter **„Ganze Datei“** zeigt alles. Gespeichert wird automatisch, und Localist ändert nur die
Stelle, die du bearbeitet hast – Einrückungen und Zeilenumbrüche bleiben, wie du sie geschrieben hast.

**Bausteine einfügen:** Über dem Code-Editor steht eine Werkzeugleiste (auf dem Handy seitlich scrollbar). Ein Klick
auf einen Baustein fügt ihn sauber eingerückt an der Cursorposition ein. Im Code-Editor öffnet `/` am Zeilenanfang
dasselbe Menü zum Tippen. Bausteine sind ganz normale HTML-Tags, die mit `l-` beginnen:

| Baustein | So sieht er im Code aus | Was er macht |
|---|---|---|
| Callout | `<l-callout typ="tipp">Text</l-callout>` | farbiger Hinweis (`info`, `tipp`, `warnung`, `fehler`) |
| Toggle | `<details><summary>Titel</summary>…</details>` | Inhalt zum Auf- und Zuklappen |
| Tabelle | `<table>` mit `<tr>`, `<th>`, `<td>` | Tabelle, auch Grundlage für Diagramme |
| Checkliste | `<ul class="l-checkliste"><li><input type="checkbox"> Aufgabe</li></ul>` | Häkchen lassen sich in „Lesen“ setzen und werden gespeichert |
| Spalten | `<l-spalten><l-spalte>…</l-spalte><l-spalte>…</l-spalte></l-spalten>` | Inhalt nebeneinander (auf dem Handy untereinander) |
| Bild | `<figure><img src="../Anhänge/bild.png" alt="…"><figcaption>…</figcaption></figure>` | Bild mit Bildunterschrift |
| Karteikarte | `<l-karteikarte><l-frage>…</l-frage><l-antwort>…</l-antwort></l-karteikarte>` | Klick, Fingertipp oder Leertaste dreht sie um |
| Kartenstapel | `<l-kartenstapel>` mit mehreren Karteikarten | Lernmodus mit „Gewusst“ und „Nochmal“, am Ende eine Auswertung |
| Quiz | `<l-quiz><l-quizfrage><l-frage>…</l-frage><ul><li>falsch</li><li data-richtig>richtig</li></ul></l-quizfrage></l-quiz>` | Multiple Choice mit sofortiger Rückmeldung und Punktzahl |
| Diagramm | `<l-diagramm typ="balken" titel="…"><table>…</table></l-diagramm>` | zeichnet Balken, Linie oder Kreis aus der Tabelle darin |

Dazu kommen Trennlinie (`<hr>`), Code-Block (`<pre><code>`) und Seitenlink (`<a class="l-seitenlink" href="…">`).
Eine kleine Lernseite sieht zum Beispiel so aus:

```html
<h2>DNS</h2>
<l-callout typ="tipp">DNS übersetzt Namen wie example.com in IP-Adressen.</l-callout>
<l-karteikarte>
  <l-frage>Welchen Port nutzt DNS?</l-frage>
  <l-antwort>Port 53</l-antwort>
</l-karteikarte>
```

**Bearbeiten ohne Code:** In „Lesen“ und „Geteilt“ erscheint beim Überfahren eines Bausteins ein **Stift-Symbol**.
Es öffnet ein Formular (bei Tabellen und Diagrammen einen Tabellen-Editor zum Hinzufügen und Entfernen von Zeilen und
Spalten). „Speichern“ ändert nur diesen einen Baustein im Code.

**Hilfe und eigene Bausteine:** Der Bereich **„Bausteine“** in der Sidebar zeigt unter „Bibliothek“ alle Bausteine mit
Vorschau und unter „Hilfe“ eine kurze Erklärung mit Beispielcode zum Kopieren. Hast du dir etwas gebaut, das du öfter
brauchst, markiere den Code und wähle in der Werkzeugleiste **„Als Baustein speichern“**. Er landet in
`<Vault>/.localist/bausteine/eigene/` und erscheint danach in Werkzeugleiste und `/`-Menü.

**Links:** In HTML-Seiten verlinkst du mit `<a href="../Notizen/Ideen.md">Ideen</a>` (Pfad relativ zur Seite,
Leerzeichen als `%20`). In Notizen verlinkst du eine HTML-Seite mit `[[Name.html]]`. Ein Klick öffnet die Seite in
Localist, Links ins Internet (`https://…`) öffnen im Standardbrowser.

**Sicher und offline:** HTML-Seiten werden in einer abgeschotteten Anzeige gezeigt. Eigene `<script>`- und
`<style>`-Abschnitte sind erlaubt, haben dort aber keinen Zugriff aufs Internet, auf deine Dateien oder auf Localist.

**Auch ohne Localist lesbar:** Eine HTML-Seite aus dem Vault kannst du im Explorer doppelklicken. Sie öffnet sich in
Edge oder Chrome, sieht aus wie in „Lesen“ und ist interaktiv (Karteikarten, Quiz, Diagramme).

**Notizbücher:** „⋯“ an einem Ordner (oder Rechtsklick darauf) → **„In Notizbuch umwandeln“**. Localist legt darin
`_notizbuch.yaml` an. Ein Klick auf das Notizbuch zeigt es wie eine kleine Website: links das Inhaltsverzeichnis,
rechts die Seite, unten „Zurück“ und „Weiter“. Notizen erscheinen dort fertig dargestellt. „Bearbeiten“ öffnet die
Seite im passenden Editor. Die Reihenfolge änderst du, indem du Einträge im Inhaltsverzeichnis ziehst (oder mit
`Alt+↑`/`Alt+↓`); neue Seiten erscheinen automatisch am Ende. Ein Ordner ist entweder Datenbank oder Notizbuch.

**Notiz in HTML-Seite umwandeln:** „⋯“ an einer Notiz → **„In HTML-Seite umwandeln …“**. Nach einer Rückfrage
entsteht eine HTML-Seite mit demselben Inhalt (Überschriften, Listen, Checklisten, Tabellen, Callouts, Toggles, Links
…), dieselbe `id`, Icon und Cover; weitere Eigenschaften stehen danach im Kopfbereich. Die Notiz kommt in den
Papierkorb, Links im Vault zeigen auf die neue Seite. Liegt die Notiz in einer Datenbank, verschwindet sie danach aus
Tabelle, Kanban und Kalender – darauf weist die Rückfrage hin.

**Als HTML-Datei exportieren:** „⋯“ an einer Seite → **„Als HTML-Datei exportieren …“** und einen Speicherort
wählen. Die Datei enthält Aussehen, Funktion und Bilder und funktioniert allein, z. B. als E-Mail-Anhang. Links auf
andere Seiten deines Vaults funktionieren in der exportierten Datei nicht.

## 10. Android-App (APK)

Localist läuft auch auf Android-Handys und -Tablets. Die Oberfläche passt sich an: Unten steht eine
Navigationsleiste (Start, Suchen, „+“, Seiten, Einstellungen), „Seiten“ zeigt den Ordnerbaum mit den Favoriten. Beim
Schreiben erscheint über der Tastatur eine Leiste mit Bausteinen und „Fertig“.

### Einmalige Einrichtung am PC

1. **Android Studio** installieren (<https://developer.android.com/studio>) und einmal starten. Im SDK Manager
   (More Actions → SDK Manager) unter „SDK Tools“ zusätzlich **NDK (Side by side)** und
   **Android SDK Command-line Tools** ankreuzen und installieren.
2. **Umgebungsvariablen** setzen (PowerShell, kein Administrator nötig; die NDK-Versionsnummer an den Ordner unter
   `%LOCALAPPDATA%\Android\Sdk\ndk` anpassen):

   ```
   [System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LOCALAPPDATA\Android\Sdk\ndk\28.2.13676358", "User")
   ```
3. **Rust für Android:**

   ```
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```
4. **Windows-Entwicklermodus** einschalten: Einstellungen → System → Für Entwickler → „Entwicklermodus“ an.
   Tauri legt beim Android-Build symbolische Verknüpfungen an, das erlaubt Windows nur in diesem Modus.
5. Terminal (und VS Code bzw. Claude Code) neu starten.

Das Android-Projekt selbst liegt schon im Repository (`src-tauri/gen/android`), `npx tauri android init` ist nicht
mehr nötig.

### APK bauen

```
npx tauri android build --debug --apk --target aarch64 --target x86_64
```

Ergebnis: `src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk`
(für echte Handys mit ARM-Prozessor und für den Emulator am PC). Der erste Build lädt Gradle und Bibliotheken
herunter und dauert einige Minuten.

Die Debug-APK ist automatisch signiert und lässt sich direkt installieren, aber nur zum Testen am PC. Die APK für
das Handy kommt fertig signiert aus jedem Release (`Localist_X.Y.Z_android.apk`, siehe `ANLEITUNG-RELEASE.md`,
Schritt 7); Updates danach gehen über „Nach Updates suchen“.

### Auf das Handy bringen

- **Per Datei:** Die APK aufs Handy kopieren (USB, Cloud, E-Mail) und dort antippen. Android fragt einmal, ob
  Installationen aus dieser Quelle erlaubt sind.
- **Per USB-Kabel:** Auf dem Handy die Entwickleroptionen und „USB-Debugging“ einschalten, dann am PC:

  ```
  adb install -r src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk
  ```
- **Im Emulator** (ohne Handy): In Android Studio unter „Device Manager“ ein virtuelles Gerät starten und die APK
  per Drag & Drop auf das Emulatorfenster ziehen.

### Erster Start auf dem Handy

1. Localist öffnet einmal die Android-Einstellung **„Zugriff auf alle Dateien“**. Erlaube sie, damit Localist mit
   normalen Ordnern im Gerätespeicher arbeiten kann (z. B. `Documents/Mein Vault`). Ohne diese Erlaubnis
   kannst du einen Vault im „App-Speicher“ anlegen. Der wird aber beim Deinstallieren gelöscht.
2. „Vault-Ordner öffnen …“ zeigt die Ordnerauswahl von Localist: Speicherort wählen, in den Ordner tippen (oder mit
   „Anlegen“ einen neuen erstellen), dann „Diesen Ordner als Vault verwenden“.
3. Den Vault mit dem PC abgleichen kannst du z. B. mit Syncthing oder einem Cloud-Ordner. Localist lädt Seiten neu,
   wenn sie von außen geändert werden.

Auf Android gibt es keinen System-Papierkorb: Gelöschte Seiten landen in `<Vault>/.localist/Papierkorb/`. Von dort
holst du sie mit jedem Dateimanager zurück.

## Was Localist wo speichert

| Was | Wo |
|---|---|
| Deine Seiten (`.md` und `.html`), Eigenschaften, Datenbanken (`_ansichten.yaml`), Notizbücher (`_notizbuch.yaml`) | im Vault-Ordner, als normale Dateien |
| Einstellungen des Vaults (z. B. Eigenschaftstypen, Favoriten) | `<Vault>\.localist\settings.json` |
| Aussehen und Funktion der Bausteine (verwaltet Localist, nicht von Hand ändern) | `<Vault>\.localist\bausteine\localist.css` und `localist.js` |
| Deine eigenen Bausteine | `<Vault>\.localist\bausteine\eigene\` (eine `.html`-Datei pro Baustein) |
| Zuletzt geöffneter Vault | `%APPDATA%\de.localist.desktop\zustand.json` |
| Suchindex (jederzeit löschbar) | `%LOCALAPPDATA%\de.localist.desktop\suchindex\` |
| Modus und Akzentfarbe, Seitenleiste (links/rechts, eingeklappt), offene Reiter, Code links/rechts und Teilung in „Geteilt“, zuletzt gewählte Ansicht einer Datenbank oder HTML-Seite | im Browser-Speicher der App (WebView2), nicht im Vault |
| Gelöschte Seiten | Windows: Papierkorb des Systems; Android: `<Vault>\.localist\Papierkorb\` |

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
- **`npm test` zeigt Testdateien doppelt** (zum Beispiel `Localist/src/App.test.tsx` zusätzlich zu `src/App.test.tsx`)
  **oder `git status` zeigt einen unbekannten Unterordner**: Im Projektordner liegt eine Kopie des Projekts. Vitest
  findet deren Tests mit, und diese schlagen fehl. Die Kopie aus dem Projektordner heraus verschieben.
