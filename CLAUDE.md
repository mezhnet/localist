# Projekt: Local-first Projektmanager (Arbeitstitel)

> Diese Datei ist die Projektbeschreibung für Claude Code und wird in jeder Sitzung automatisch gelesen.
> Ändere sie nicht, außer der Nutzer bittet ausdrücklich darum. Den Fortschritt dokumentierst du in `FORTSCHRITT.md` (siehe „Fortschrittsdatei“ unten).

## Ziel

Eine Desktop-App für Notizen und Projektmanagement:

- **Aussehen und Bedienung wie Notion:** Seiten mit Block-Editor, Datenbanken mit Tabelle, Kanban und Kalender.
- **Speicherung wie Obsidian:** Alles liegt als normale Dateien in einem Ordner („Vault“), den der Nutzer selbst wählt. Jede Datei bleibt auch ohne die App lesbar.
- **Local-first:** keine Accounts, kein Server, keine Telemetrie, funktioniert komplett offline.

Zuerst entsteht eine EXE für Windows, danach eine APK für Android.

## Kommunikation

- Mit dem Nutzer immer auf Deutsch kommunizieren: Erklärungen, Fragen, Zusammenfassungen, Fehlermeldungen in der App und die `ANLEITUNG.md`.
- Code, Befehle, Bezeichner, Dateiendungen und etablierte Fachbegriffe bleiben im Original.
- Der Nutzer ist Einsteiger in der Programmierung: kurz erklären, was passiert und warum.

## Technik-Stack

| Bereich | Wahl |
|---|---|
| App-Hülle | Tauri 2 (Rust) |
| Oberfläche | React + TypeScript, Vite |
| Editor | BlockNote (Notion-artiger Block-Editor) |
| Tests | Vitest für die Frontend-Logik, `cargo test` für Rust-Code falls nötig |
| Zielplattformen | Windows (EXE/Installer), später Android (APK) |

Erfüllt BlockNote eine Anforderung nachweislich nicht (vor allem den verlustfreien Markdown-Roundtrip), darf ein anderer Editor gewählt werden, z. B. TipTap. Die Entscheidung mit Begründung in `FORTSCHRITT.md` unter „Entscheidungen“ festhalten.

## Speicherformat

Markdown ist die Quelle der Wahrheit. Die App hat keine eigene Datenbank für Inhalte.

```
MeinVault/
├── .meinapp/              ← Einstellungen dieses Vaults (wie .obsidian)
│   └── settings.json
├── Projekte/              ← Ordner mit _ansichten.yaml = Datenbank
│   ├── _ansichten.yaml    ← Eigenschaftstypen und Ansichten (Tabelle, Kanban, Kalender, Filter, Sortierung)
│   ├── Website-Relaunch.md
│   └── Umzug.md
├── Notizen/
│   └── Ideen.md
├── Vorlagen/
│   └── Projekt.md
└── Anhänge/
    └── skizze.png
```

Regeln:

- **Eine Seite = eine `.md`-Datei.** Der Dateiname ist der Seitentitel.
- **Eigenschaften** stehen als YAML-Frontmatter am Anfang der Datei. Felder, die die App nicht kennt, bleiben beim Speichern unverändert erhalten.
- **Feste Felder:** `id` (eindeutige ID, z. B. UUID, wird beim Anlegen vergeben und nie geändert), optional `icon` (Emoji) und `cover` (Pfad zu einem Bild im Vault).
- **Datumsangaben** immer als `YYYY-MM-DD` oder `YYYY-MM-DDTHH:MM`.
- **Datenbank:** Ein Ordner wird zur Datenbank, sobald er eine `_ansichten.yaml` enthält. Jede `.md`-Datei darin ist ein Eintrag.
- **Obsidian-kompatibel bleiben:** Links als `[[Seitenname]]`, Callouts als `> [!info] Titel`, einklappbare Blöcke (Toggles) als `> [!note]- Titel`, Checklisten als `- [ ]`.
- **Versteckte Ordner** (Name beginnt mit `.`) werden in der Sidebar nicht angezeigt.
- **Caches und Suchindex** liegen nie im Vault, sondern im App-Datenordner des Systems, und lassen sich jederzeit neu aufbauen.
- **Sicher speichern:** Dateien atomar schreiben (erst in eine temporäre Datei, dann umbenennen), damit bei einem Absturz nichts kaputtgeht.

Beispiel einer Seite `Projekte/Website-Relaunch.md`:

```markdown
---
id: 3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90
icon: 🚀
status: In Arbeit
fällig: 2026-11-15
priorität: hoch
---
- [ ] Domain prüfen
- [ ] Texte für die Startseite schreiben

> [!info] Hinweis
> Der Hosting-Vertrag läuft Ende November aus.

Siehe auch [[Ideen]].
```

## Arbeitsregeln für Claude Code

1. **Zuerst den Stand prüfen.** Zu Beginn jeder Sitzung `FORTSCHRITT.md` lesen (falls vorhanden) und `git status` sowie `git log --oneline -10` ausführen. Dann beim dort notierten nächsten Schritt weitermachen und nichts doppelt bauen.
2. **Immer nur die aktuelle Etappe umsetzen.** Keine Funktionen aus späteren Etappen vorziehen.
3. **Zu Beginn einer Etappe** ihre Fertig-Kriterien wörtlich im Chat auflisten und als Checkliste in `FORTSCHRITT.md` übernehmen.
4. **Nach jedem erledigten Kriterium** sofort `FORTSCHRITT.md` aktualisieren (Haken setzen, nächsten Schritt notieren) und einen Zwischen-Commit erstellen: `Etappe N: <was erledigt ist>`. So geht bei einem Abbruch nichts verloren.
5. **Zum Abschluss** jedes Kriterium einzeln im Chat nachweisen (Befehlsausgabe, Testergebnis oder Dateipfad), auch die schon früher erledigten. Danach einen Abschluss-Commit erstellen: `Etappe N abgeschlossen: <kurze Beschreibung>`.
6. **Jede Etappe besteht diese Prüfungen:** `npm test` ist grün, `npx tsc --noEmit` zeigt keine Fehler, `npm run tauri build` endet ohne Fehler.
7. **Nur im Projektordner arbeiten.** Zum Testen einen Beispiel-Vault im Projekt verwenden (`beispiel-vault/`), nie echte Nutzerdaten verändern.
8. **Diese Datei nicht überschreiben**, auch nicht beim Erzeugen des Tauri-Projekts. Verlangt ein Werkzeug einen leeren Ordner, das Projekt in einem Unterordner erzeugen und die Dateien danach in den Projektordner verschieben.
9. **Fehlt etwas, das der Nutzer selbst tun muss** (Programm installieren, Entscheidung treffen), genau sagen was und wie, es in `FORTSCHRITT.md` unter „Offene Probleme“ notieren und anhalten.

## Fortschrittsdatei

`FORTSCHRITT.md` im Projektordner ist das Gedächtnis zwischen den Sitzungen. Wer sie liest, muss ohne weiteren Kontext wissen, wo das Projekt steht und was als Nächstes kommt. Aufbau:

```markdown
# Fortschritt

## Aktueller Stand
- Etappe: 1 – Vault und Seiten
- Zuletzt aktualisiert: 2026-10-25 14:30
- Nächster Schritt: Seiten in der Sidebar umbenennen

## Fertig-Kriterien der aktuellen Etappe
- [x] Der Vault-Ordner lässt sich per Dialog auswählen …
- [ ] Seiten und Ordner lassen sich anlegen, umbenennen und löschen …

## Abgeschlossene Etappen
- Etappe 0 – Fundament (abgeschlossen am 2026-10-24)

## Offene Probleme
- keine

## Entscheidungen
- 2026-10-24: BlockNote als Editor, weil …
```

## Etappen und Fertig-Kriterien

### Etappe 0 – Fundament

- [ ] Ein Tauri-2-Projekt mit React, TypeScript und Vite liegt im Projektordner, diese `CLAUDE.md` ist erhalten.
- [ ] Die Startseite der App zeigt den Text „Hallo Vault“.
- [ ] Vitest ist eingerichtet, mindestens ein Beispieltest läuft mit `npm test` grün.
- [ ] `npm run tauri build` endet ohne Fehler, der Pfad der erzeugten EXE bzw. des Installers ist genannt.
- [ ] Git ist eingerichtet, die `.gitignore` deckt u. a. `node_modules`, `target` und `dist` ab, `git status` ist nach dem Commit sauber.
- [ ] Eine `ANLEITUNG.md` erklärt auf Deutsch: Voraussetzungen, App im Entwicklungsmodus starten (`npm run tauri dev`), EXE bauen, Tests ausführen.
- [ ] `FORTSCHRITT.md` ist nach der Vorlage angelegt und auf dem aktuellen Stand.

### Etappe 1 – Vault und Seiten

- [ ] Der Vault-Ordner lässt sich per Dialog auswählen, der zuletzt geöffnete Vault öffnet sich beim nächsten Start automatisch.
- [ ] Die Sidebar zeigt den Ordnerbaum mit Ordnern und `.md`-Dateien, versteckte Ordner sind ausgeblendet.
- [ ] Seiten und Ordner lassen sich anlegen, umbenennen und löschen (Löschen nur nach Bestätigung).
- [ ] Eine Seite öffnet sich im Block-Editor und wird kurz nach der letzten Eingabe automatisch als Markdown gespeichert.
- [ ] Wird eine Datei außerhalb der App geändert, lädt die App sie neu. Wird sie gelöscht, verschwindet sie aus der Sidebar.
- [ ] Roundtrip-Tests: Markdown → Editor-Format → Markdown liefert für Überschriften, Absätze, fett/kursiv, Listen, Checklisten, Zitate, Code-Blöcke, Links und Bilder denselben Inhalt.
- [ ] Frontmatter bleibt beim Bearbeiten im Editor unverändert erhalten (Test vorhanden).

### Etappe 2 – Notion-Feeling

- [ ] Slash-Menü (`/`) zum Einfügen von Blöcken.
- [ ] Blöcke lassen sich per Griff (Drag-Handle) verschieben.
- [ ] Callouts und Toggles im Obsidian-Format (siehe Speicherformat).
- [ ] Icon und Cover pro Seite, gespeichert im Frontmatter (`icon`, `cover`).
- [ ] Hell- und Dunkelmodus: folgt dem System, manuell umschaltbar.
- [ ] Links zwischen Seiten als `[[Seitenname]]` mit Vorschlägen beim Tippen, ein Klick öffnet die Seite. Beim Umbenennen einer Seite werden Links darauf im ganzen Vault angepasst.
- [ ] Die Roundtrip-Tests decken zusätzlich Callouts, Toggles und `[[Links]]` ab.

### Etappe 3 – Eigenschaften und Tabelle

- [ ] Oben auf jeder Seite gibt es eine Eigenschaften-Leiste mit den Typen Text, Zahl, Auswahl, Mehrfachauswahl, Status, Datum, Checkbox und URL, gespeichert im Frontmatter.
- [ ] Ein Ordner lässt sich in eine Datenbank umwandeln (legt `_ansichten.yaml` an, dort stehen auch die Eigenschaftstypen).
- [ ] Tabellenansicht: eine Zeile pro Seite, eine Spalte pro Eigenschaft, Werte direkt in der Zelle bearbeitbar.
- [ ] Sortieren und Filtern, die Einstellungen werden in `_ansichten.yaml` gespeichert.
- [ ] Eine neue Zeile legt eine neue `.md`-Datei mit `id` an.
- [ ] Tests für Frontmatter lesen und schreiben, inklusive Erhalt unbekannter Felder und Datumsformat.

### Etappe 4 – Kanban

- [ ] Kanban-Ansicht einer Datenbank, gruppiert nach einer Status- oder Auswahl-Eigenschaft.
- [ ] Eine Karte per Drag & Drop in eine andere Spalte zu ziehen ändert den Wert in der Datei.
- [ ] Neue Karten lassen sich direkt in einer Spalte anlegen, ein Klick auf eine Karte öffnet die Seite.
- [ ] Mehrere Ansichten pro Datenbank (z. B. Tabelle und Kanban), umschaltbar per Reiter, gespeichert in `_ansichten.yaml`.
- [ ] Tests für die Kanban-Logik (Gruppieren, Wert ändern).

### Etappe 5 – Kalender

- [ ] Kalenderansicht einer Datenbank mit Monats- und Wochenansicht, basierend auf einer Datums-Eigenschaft.
- [ ] Einen Eintrag per Drag & Drop zu verschieben ändert das Datum in der Datei.
- [ ] Ein Klick auf einen Tag legt einen neuen Eintrag mit diesem Datum an.
- [ ] Einträge ohne Datum erscheinen in einer Liste „Ohne Datum“.
- [ ] Tests für die Datumslogik (Format, Wochen- und Monatsgrenzen).

### Etappe 6 – Komfort

- [ ] Volltextsuche über alle Seiten des Vaults.
- [ ] Schnellsuche mit Strg+P zum Öffnen von Seiten.
- [ ] Vorlagen: Seiten aus dem Ordner `Vorlagen/` lassen sich als Grundlage für neue Seiten nutzen.
- [ ] Backlinks: Unten auf jeder Seite steht, welche Seiten auf sie verlinken.
- [ ] Der Suchindex liegt im App-Datenordner, nicht im Vault.
- [ ] Tests für Suche und Backlinks.

### Etappe 7 – Version 1.0 für den PC

- [ ] Endgültiger App-Name und App-Icon (den Namen vorher beim Nutzer erfragen). Wird der Einstellungsordner `.meinapp/` umbenannt, werden bestehende Vaults automatisch übernommen.
- [ ] Ein Windows-Installer wird gebaut, die Version ist 1.0.0.
- [ ] Verständliche deutsche Fehlermeldungen statt Abstürzen (z. B. Datei nicht lesbar, Vault-Ordner fehlt).
- [ ] Keine Fehler bei `npx tsc --noEmit`, keine offenen TODOs aus früheren Etappen.
- [ ] Die `ANLEITUNG.md` ist auf dem aktuellen Stand.

### Etappe 8 – Android-APK

- [ ] Der Android-Build mit Tauri ist eingerichtet. Die nötigen Werkzeuge (Android Studio, SDK, NDK) hat der Nutzer nach Anleitung selbst installiert.
- [ ] Ein Android-Build erzeugt eine APK, der Pfad ist genannt.
- [ ] Der Vault-Ordner lässt sich auf dem Handy auswählen, Seiten lassen sich lesen und bearbeiten.
- [ ] Die Oberfläche ist für Handy-Bildschirme angepasst (Sidebar als ausklappbares Menü).
- [ ] Der Windows-Build funktioniert weiterhin.

## Zukunft (noch nicht umsetzen)

- Anbindung an den Google Kalender über die Google Calendar API: zuerst Google-Termine im Projektkalender anzeigen, später in beide Richtungen. Deshalb gelten schon jetzt das einheitliche Datumsformat und die feste `id` pro Eintrag.

## Was die App nicht macht

- Keine Accounts, kein eigener Server, keine Telemetrie.
- Keine Inhalte in einer eigenen Datenbank, nur Dateien im Vault.

## Aktueller Stand

Steht in `FORTSCHRITT.md`. Gibt es die Datei noch nicht, beginnt das Projekt bei Etappe 0.
