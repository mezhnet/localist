# Auftrag: Localist Version 2.1 – Verbesserungen und neues Design

> Dieser Auftrag liegt auch im Projekt unter `docs/design/auftrag-version-2.1.md`. Er gilt für die Etappen 16–20.
> Lies ihn zu Beginn jeder dieser Etappen erneut, vor allem die Design-Vorlage und die Befunde bei der jeweiligen Etappe.

## Ausgangslage

Version 2.0 ist fertig (Etappen 0–15, siehe `FORTSCHRITT.md`). Ich habe neue Wünsche gesammelt und ein neues Design entworfen. Daraus werden fünf neue Etappen:

| Etappe | Inhalt |
|---|---|
| 16 | Der Projektordner heißt `Localist` statt `LocalProjekt` |
| 17 | Bedienung: Tab und Shift+Tab, „Im Explorer öffnen“, Code links oder rechts mit verschiebbarer Trennlinie, breitere Seite „Bausteine“ |
| 18 | Neues Design, Teil 1: Farben, Schrift, Modi Hell/Dunkel/Schwarz, Akzentfarbe, Fensterrahmen, Seitenleiste (links oder rechts, einklappbar) |
| 19 | Neues Design, Teil 2: Reiter, Startseite, Notiz, Tabellen in Notizen, alle übrigen Ansichten, Bausteine |
| 20 | Handy-Design und Version 2.1.0 |

## Was du jetzt tun sollst

1. Stand prüfen wie in Arbeitsregel 1.
2. Der Ordner `docs/design/` (Design-Vorlage und dieser Auftrag) ist neu und noch nicht im Git. Speichere ihn als eigenen Commit: `Design-Vorlage und Auftrag für Version 2.1`.
3. Ergänze `CLAUDE.md`. Das erlaube ich ausdrücklich, Arbeitsregel 10 gilt dafür nicht. Ändere nur diese Stellen:
   - „Versionen“: Version 2.0 als abgeschlossen markieren. Neue Zeile: Version 2.1 (Etappen 16–20) ist in Arbeit, mit Verweis auf `docs/design/auftrag-version-2.1.md`.
   - „Etappen und Fertig-Kriterien“: die Etappen 9–15 wie bei Version 1.0 zu einer Zeile „Version 2.0 – abgeschlossen“ zusammenfassen und die Etappen 16–20 aus diesem Auftrag wörtlich einfügen (Überschrift und Fertig-Kriterien; die Befunde bleiben hier im Auftrag).
   - „Design-Grundsätze“: Die Vorlage in `docs/design/` ist verbindlich. Die Akzentfarbe ist wählbar (Standard Orange), die Modi Hell, Dunkel und Schwarz sind gleichwertig.
   - Arbeitsregel 7: Untergrenze auf den Stand 2.0 anheben, also mindestens 297 Tests in `npm test` und 42 in `cargo test`. Die Klicklisten „Version 1.0“ und „Version 2.0“ bleiben in jeder Etappe abgehakt.
   - Commit: `CLAUDE.md um Version 2.1 ergänzt`.
4. `FORTSCHRITT.md` auf Etappe 16 umstellen und mit Etappe 16 beginnen (Arbeitsregeln 3–5). Danach wie gewohnt immer nur eine Etappe.

## Design-Vorlage (`docs/design/`)

| Datei | Zeigt |
|---|---|
| `01-desktop-startseite-hell.png` | PC, Startseite, Modus Hell |
| `02-desktop-notiz-schwarz.png` | PC, Notiz mit Eigenschaften, Callout, Tabelle, Checkliste und Baustein-Menü, Modus Schwarz |
| `03-handy-startseite-hell.png` | Handy, Startseite mit unterer Navigationsleiste, Modus Hell |
| `04-handy-notiz-schwarz.png` | Handy, Notiz beim Bearbeiten mit Leiste über der Tastatur, Modus Schwarz |
| `05-handy-darstellung-dunkel.png` | Handy, Einstellungen → Darstellung, Modus Dunkel |
| `Localist-Redesign.pdf` | Original (enthält nur Bilder, keine Schriftnamen und keine Farbwerte) |

Sieh dir die Bilder mit dem Read-Werkzeug genau an, bevor du gestaltest. Was die Vorlage nicht zeigt (Datenbank-Ansichten, HTML-Seiten mit Code-Editor, Notizbuch, Seite „Bausteine“, Dialoge), gestaltest du im selben Stil. Die Inhalte der Bilder („AP2 Lernen“, „RAID und Speicher“ usw.) sind nur Beispiele.

### Was die Vorlage festlegt

**Fenster (PC):** Seitenleiste und oberer Rand liegen auf dem Fensterhintergrund. Der Inhalt ist eine abgesetzte Fläche mit großem Radius und feiner Linie, ringsum ein schmaler Rand. Es gibt keine Windows-Titelleiste: Minimieren, Maximieren und Schließen sind schlichte Symbole oben rechts, der Vault-Umschalter steht oben links.

**Seitenleiste (PC), von oben nach unten:** Vault-Umschalter (Anfangsbuchstabe auf dunklem Quadrat, Name, Auf/Ab-Pfeil), „Suchen“ mit `Strg P`, „Volltextsuche“ mit `Strg ⇧ F`, „Startseite“, „Bausteine“, „Neue Seite“. Dann der Bereich „Favoriten“ und der Bereich „Seiten“ mit „+“ und dem Ordnerbaum. Unten „Darstellung“ mit drei Knöpfen (Sonne = Hell, Mond = Dunkel, gefüllter Kreis = Schwarz) und „Einstellungen“ mit der Versionsnummer. Der aktive Eintrag ist im Hellen eine weiße Karte mit feiner Linie, im Dunklen ein feiner Rahmen. Symbole sind Linien-Symbole (lucide), ohne Füllung.

**Reiter (PC):** Über dem Inhalt liegt eine Reiterleiste: ein fester Reiter „Startseite“ (Haus-Symbol, ohne ×), dann die offenen Seiten mit Typ-Symbol und ×, am Ende „+“. Der aktive Reiter ist unterstrichen.

**Startseite:** Datum in Monospace („Mo, 26.10.2026“) und eine große Begrüßung („Guten Morgen“). Darunter ein Eingabefeld „Schnell notieren …“ mit dem Hinweis „↵ als neue Notiz speichern“, zwei kleinen Symbol-Knöpfen (Datenbank, Vorlage) und dem Akzent-Knopf „+ Notiz“. Dann „Zuletzt bearbeitet“ als Tabelle (Name mit Typ-Symbol, Ort, Bearbeitet in Monospace: „gerade eben“, „vor 7 Min.“, „gestern“) mit dem Link „Alle Seiten“ in Akzentfarbe. Ganz unten „Favoriten“ als Chips mit Stern.

**Notiz:** Kopfzeile mit dem Pfad „Ordner / Seite“, rechts der Speicherstatus in Monospace („gerade eben gespeichert“), ein Stern (Favorit, gefüllt in Akzentfarbe) und „…“. Großer, fetter Titel mit enger Laufweite. Eigenschaften als Zeilen mit Symbol und Name; Mehrfachwerte (Tags) als Chips, Datumswerte in Monospace, darunter „+ Eigenschaft hinzufügen“. Callout mit getöntem Akzent-Hintergrund, Symbol und fettem Anfang. Tabelle mit abgerundetem Rahmen, gedämpfter Kopfzeile und feinen Zeilenlinien. Checkliste mit Häkchen in Akzentfarbe, Erledigtes durchgestrichen und gedämpft. Links neben dem aktuellen Block stehen „+“ und der Ziehgriff, der leere Block zeigt „Baustein wählen …“. Das Menü dazu hat ein Suchfeld „Bausteine filtern …“, Einträge mit Symbol-Kästchen (Text, Überschrift, Checkliste, Callout, Toggle, Tabelle, Bild …) und einen ↵-Hinweis am markierten Eintrag.

**Handy:** Die Startseite hat oben Vault-Umschalter, Knopf „Darstellung“ und Knopf „Einstellungen“, dann Datum, Begrüßung, „Schnell notieren …“ mit „+“, eine Karte „Zuletzt bearbeitet“ mit „Alle“ und die Favoriten-Chips. Unten eine Navigationsleiste „Start · Suchen · + · Seiten · Einstell.“, der mittlere Knopf ist dunkel hervorgehoben. Die Notiz hat oben einen Zurück-Pfeil mit dem Ordnernamen in Monospace, Stern und „…“; die Eigenschaften stehen kompakt als Chips in einer Zeile. Beim Schreiben steht über der Tastatur eine Leiste mit „+“, Checkliste, Callout, Toggle, Bild und dem Knopf „Fertig“. Einstellungen → Darstellung: drei Vorschaukarten Hell/Dunkel/Schwarz, Schalter „Wie System“, eine Erklärung zu Schwarz und vier Akzentfarben als Kreise.

### Gemessene Farben (Startwerte für `tokens.css`)

Aus den PNGs gemessen, also nur auf etwa ±2 pro Farbkanal genau. Fehlende Werte leitest du stimmig ab.

| Rolle | Hell | Dunkel | Schwarz |
|---|---|---|---|
| Fensterhintergrund (Seitenleiste, Rand) | `#f0f0ee` | `#131313` | `#000000` |
| Inhaltsfläche | `#ffffff` | ableiten | `#0a0a0a` |
| Flächen (Eingabefeld, Tabellenkopf, Menü, Karten) | `#f5f5f3` | `#1c1c1a` | `#141414` |
| Linien | `#ebebe9` | ableiten | `#1b1b1b` |
| Markierter Menüeintrag | ableiten | ableiten | `#262626` |
| Text | `#131311` | ableiten | `#f4f4f4` |
| Text gedämpft | `#5d5d5b` | ableiten | ableiten |
| Callout-Hintergrund (Akzent Orange) | ableiten | ableiten | `#25120b` |
| Akzent-Chip, Hintergrund / Text | ableiten | ableiten | `#59311f` / `#d99782` |

Akzentfarben: Orange `#c2410c` (Standard), Blau etwa `#2a65db`, Grün etwa `#1d6a58`, Lila etwa `#6a4ed7`.

### Schrift

Die Vorlage nennt keine Schrift. Zu sehen sind eine geometrische Grotesk (Überschriften fett mit enger Laufweite, einstöckiges „g“) und eine Monospace mit Punkt in der Null. Wähle freie Schriften (Lizenz OFL), die möglichst nah herankommen, und binde sie lokal über `@fontsource` ein. Kandidaten für Text: „Plus Jakarta Sans“, „Manrope“ oder „Figtree“; für Monospace: „JetBrains Mono“. Vergleiche per Screenshot mit `02-desktop-notiz-schwarz.png` und notiere die Wahl unter „Entscheidungen“.

Monospace gibt es nur für: Datum oben auf der Startseite, Tastenkürzel, Zeitangaben, Speicherstatus, Versionsnummer, Datumswerte in Eigenschaften und den Ordnernamen oben auf dem Handy.

## Hinweise für alle Etappen

- Bedien-Einstellungen dieses Geräts (Seitenleiste links/rechts und eingeklappt, Code links/rechts, Teilungsverhältnis, Modus, Akzentfarbe, offene Reiter) speicherst du wie die bisherigen Werte `theme` (`src/lib/theme.tsx`) und `html-ansicht` (`src/lib/html-editor.ts`) im App-Speicher (`localStorage`, mit try/catch), nicht im Vault. Bereits gespeicherte Werte werden übernommen.
- Alle Farben, Abstände, Radien, Schatten und Dauern stehen nur als Variablen in `tokens.css`. Der Farbtest aus Etappe 9 bleibt grün.
- Neue Bibliotheken nur nach den Regeln in `CLAUDE.md`. Die Sicherheitsregeln gelten unverändert. Neue Rust-Befehle prüfen Pfade wie `vault::resolve`.
- Jede Etappe besteht Arbeitsregel 6 und 7. Bestehende Tests, die wegen des neuen Designs nur andere Selektoren brauchen, darfst du anpassen. Notiere die Begründung unter „Entscheidungen“ und lösche keinen Test.
- Screenshots (Hell, Dunkel und ab Etappe 18 auch Schwarz; PC 1280 × 800 und Handy 360 × 740) legst du unter `docs/screenshots/etappe-N/` ab.
- Für Vergleiche mit der Vorlage darf das Screenshot-Skript einen eigenen Vault mit den Beispielinhalten der Vorlage anlegen. `beispiel-vault/` ergänzt du nur, wenn es nötig ist, damit die bestehenden Tests stabil bleiben.

---

## Etappe 16 – Ordnername „Localist“

Die App heißt Localist, der Projektordner heißt aber noch `C:\Users\emre\Documents\eigen_apps\LocalProjekt`. Er soll `C:\Users\emre\Documents\eigen_apps\Localist` heißen.

Befunde:
- Der alte Name steht in `ANLEITUNG.md` (etwa Zeile 40 als Pfad zum Projekt, etwa Zeile 425 in der Fehlerhilfe zur doppelten Kopie `LocalProjekt/`).
- `LEGACY_IDENTIFIER = "de.localprojekt.desktop"` in `src-tauri/src/lib.rs` und `.meinapp` in `src-tauri/src/vault.rs` sind Absicht: Damit übernimmt die App Daten älterer Fassungen. Nicht ändern.
- Historische Einträge in `FORTSCHRITT.md` bleiben, wie sie sind.
- In `src-tauri/target/` liegen alte Build-Reste mit dem Namen `localprojekt` (nicht im Git).
- Claude Code kann den Ordner, in dem es selbst läuft, nicht umbenennen. Das muss ich tun (Arbeitsregel 11).

Fertig-Kriterien:
- [ ] `git grep -n -i "localprojekt"` ist geprüft, die Ausgabe steht im Chat. Jede Stelle, die den Ordner- oder Projektnamen meint, sagt jetzt „Localist“. Übrig sind nur die Übernahme-Kennungen und historische Einträge in `FORTSCHRITT.md`, jeweils begründet.
- [ ] Keine versionierte Datei und keine Datei unter `src-tauri/gen/android/` (außer Build-Ausgaben) enthält einen absoluten Pfad mit `LocalProjekt`.
- [ ] Die Vorbereitung ist committet. Danach hältst du an und erklärst mir Schritt für Schritt, was ich tun muss: alles schließen, was den Ordner benutzt (Claude Code, VS Code, Terminals, `npm run dev`, Localist, Android-Emulator), den Ordner im Explorer umbenennen, den Ordner in der Claude-App neu verbinden und Claude Code im neuen Ordner starten. Notiere das unter „Offene Probleme“.
- [ ] Nach dem Umbenennen läuft alles im neuen Ordner: `npm test`, `cargo test`, `npx tsc --noEmit`, `npm run tauri build` (Rust baut einmal komplett neu, weil sich die Pfade geändert haben), die Android-APK baut wie in Etappe 15, und `npm run dev` startet. Die alten Build-Reste `localprojekt*` sind entfernt (`cargo clean` ist erlaubt).

## Etappe 17 – Bedienung verbessern

### Tab und Shift+Tab

Mein Eindruck: Wenn Tab eine Zeile nach rechts schiebt, fühlt sich das nicht smooth an. Shift+Tab soll nach links schieben.

Befunde:
- Notizen: BlockNote läuft mit der Standard-Einstellung `tabBehavior: "prefer-navigate-ui"`. Ist Text markiert und die Formatierungsleiste offen, springt Tab in die Leiste, statt einzurücken. Die Option ist in `node_modules/@blocknote/core/src/editor/BlockNoteEditor.ts` beschrieben, der Editor wird in `src/components/BlockEditor.tsx` angelegt.
- Notizen: BlockNote rückt jeden Block ein, auch normale Absätze und Überschriften. Markdown kann Einrückung aber nur in Listen speichern. `serializeBlock` → `appendSiblings` in `src/markdown/blocks.ts` schreibt eingerückte Kinder von Absätzen, Überschriften, Code, Bildern usw. als normale Blöcke darunter. Nach dem Neuladen ist die Einrückung also weg.
- Notizen: Der Einzug ist in BlockNote fest 24 px (`.bn-block-group .bn-block-group` in `Block.css`), der Block springt ohne Übergang.
- HTML-Seiten: Der Code-Editor hat bereits `indentWithTab` (`src/components/CodeEditor.tsx`). Prüfe trotzdem, ob es sich dort gut anfühlt.

Fertig-Kriterien:
- [ ] Zuerst nachgestellt (Browser-Vorschau, echte Tastatur): Was passiert heute bei Tab und Shift+Tab in Absatz, Überschrift, Liste, Checkliste, nummerierter Liste, Callout und Toggle, mit und ohne Markierung, im ersten Block und im Code-Editor? Das Ergebnis steht als Tabelle in `FORTSCHRITT.md`.
- [ ] Notizen: Tab rückt den aktuellen bzw. alle markierten Blöcke ein, Shift+Tab rückt aus, auch bei offener Formatierungsleiste. Der Fokus verlässt den Editor nie (auch nicht im ersten Block oder ganz links). Cursor und Markierung bleiben an derselben Textstelle, die Seite scrollt nicht.
- [ ] Notizen: Eingerückt wird nur, was Markdown auch speichern kann (Listenpunkte, Checklisten, nummerierte Listen und Absätze unter einem Listenpunkt). In allen anderen Fällen bleibt der Block ruhig stehen, ohne Sprung und ohne Fokusverlust. Alles Eingerückte ist nach Speichern und Neuladen genauso eingerückt. Dafür gibt es Roundtrip-Tests.
- [ ] Notizen: Ein- und Ausrücken hat einen kurzen, ruhigen Übergang (höchstens 150 ms, Werte aus `tokens.css`, aus bei `prefers-reduced-motion`). Einzug und Führungslinie kommen aus `tokens.css`.
- [ ] HTML-Seiten: Tab rückt die Zeile bzw. alle markierten Zeilen um eine Stufe ein (dieselbe Einrückung wie bei eingefügten Bausteinen), Shift+Tab rückt aus, auch wenn der Cursor mitten in der Zeile steht. Escape und danach Tab verlässt den Editor, wie es CodeMirror für die Tastaturbedienung vorsieht.
- [ ] Tests für beide Editoren.

### „Im Explorer öffnen“

Befunde:
- Das Kontextmenü steht in `src/components/Sidebar.tsx` (`NodeItems` und das Menü „Vault“).
- `tauri-plugin-opener` ist schon eingebunden (`src-tauri/src/lib.rs`, Capability `opener:default`). Es kann eine Datei im Explorer markiert anzeigen (`reveal_item_in_dir`) und einen Ordner öffnen.
- Bezeichnung: Ich hatte „Öffne im Explorer…“ geschrieben. Passend zu den übrigen Menüpunkten heißt er „Im Explorer öffnen“, ohne „…“, weil kein Dialog folgt.

Fertig-Kriterien:
- [ ] Rechtsklick auf eine Seite (Notiz oder HTML-Seite) → „Im Explorer öffnen“: Der Windows-Explorer zeigt den Ordner und markiert die Datei. Auf einem Ordner öffnet derselbe Eintrag den Ordner selbst. Im Menü „Vault“ gibt es „Vault im Explorer öffnen“.
- [ ] Umgesetzt über einen neuen Rust-Befehl, der den Pfad wie `vault::resolve` prüft (nur Pfade im geöffneten Vault) und dann den Explorer öffnet. Die Capabilities werden dafür nicht erweitert. `cargo test` prüft die Pfadprüfung.
- [ ] Auf Android ist der Eintrag ausgeblendet. In der Browser-Vorschau zeigt `src/lib/dev-backend.ts` stattdessen eine Meldung. Ein Vitest-Test prüft den Menüeintrag.
- [ ] In der gebauten `localist.exe` geprüft: Ein Explorer-Fenster mit markierter Datei öffnet sich (Nachweis z. B. über den Fenstertitel aus einem Skript).

### HTML-Seiten: Code links oder rechts, verschiebbare Trennlinie

Befunde:
- „Geteilt“ ist heute ein festes Raster 50 : 50 (`.html-workspace.is-geteilt` in `src/styles/page.css`), der Code steht immer links.
- Die zuletzt gewählte Ansicht steht im App-Speicher (`src/lib/html-editor.ts`, Schlüssel `html-ansicht`).
- Vorsicht beim Ziehen: Die Vorschau ist ein iframe, während des Neuladens sogar zwei (`src/components/PagePreview.tsx`). Sobald die Maus darüber kommt, bekommt die App keine Mausereignisse mehr. Lösung: Pointer Capture auf der Trennlinie und während des Ziehens `pointer-events: none` auf den iframes.

Fertig-Kriterien:
- [ ] Einstellung „Code-Editor links / rechts“ in den Einstellungen und als kleiner Knopf „Seiten tauschen“ in der Ansicht „Geteilt“. Sie wirkt sofort und wird gemerkt. Auf schmalen Bildschirmen (untereinander) bedeutet links „oben“ und rechts „unten“.
- [ ] In „Geteilt“ lässt sich die Trennlinie mit Maus und Finger verschieben. Jede Seite bleibt mindestens etwa 280 px breit, ein Doppelklick setzt auf 50 : 50 zurück. Mit der Tastatur bedienbar (Fokus, Pfeiltasten, `role="separator"` mit `aria-valuenow`). Das Verhältnis wird gemerkt.
- [ ] Beim Ziehen ruckelt nichts, es wird kein Text markiert, und die Vorschau behält ihre Scrollposition.
- [ ] Tests für Einstellung, Begrenzung und Speicherung des Verhältnisses und die Tastatur, dazu ein Prüfskript mit echter Maus wie `scripts/vorschau-scroll-pruefung.mjs`.

### Seite „Bausteine“ breiter

Befund: Auf dem PC sind Liste und Vorschau der Bibliothek zusammen nur etwa 660 px breit, rechts bleibt viel Platz leer (`docs/screenshots/etappe-15/app/app-bibliothek.png`). Die Seite steht in `src/components/BausteinBibliothek.tsx`, die Stile `.bibliothek…` in `src/styles/page.css`.

Fertig-Kriterien:
- [ ] Auf dem PC nutzt die Seite „Bausteine“ (Bibliothek und Hilfe) die verfügbare Breite: Liste links, die Vorschau füllt den Rest und die Fensterhöhe. Eine Höchstbreite greift erst bei sehr breiten Fenstern. Die Hilfe stellt Erklärung und Beispielcode nebeneinander, wenn Platz ist.
- [ ] Screenshots bei 1280 × 800, 1920 × 1080 und 360 × 740.
- [ ] Android im Emulator geprüft (`adb`-Befehle mit Ausgabe, Screenshots per `adb exec-out screencap`): Bibliothek und Hilfe sind lesbar, Liste und Vorschau bedienbar, nichts ist abgeschnitten oder verrutscht. Gefundene Fehler sind behoben.

## Etappe 18 – Neues Design, Teil 1: Grundlagen, Fenster und Seitenleiste

Befunde:
- Hell/Dunkel steht in `src/lib/theme.tsx` (Werte `system`, `light`, `dark` im App-Speicher, Schlüssel `theme`). Die HTML-Seiten bekommen den Modus über die Brücke (`themeMessage` in `src/lib/bridge.ts`, Typ `thema` mit `hell`/`dunkel`; Empfänger in `src-tauri/seite/bruecke.js`).
- Die Einstellungen sind ein Dialog (`SettingsDialog` in `src/components/Dialogs.tsx`).
- Inter ist in der App (`src/main.tsx`) und als `data:`-Adresse in `localist.css` eingebunden (gebaut von `src/bausteine/bauen.ts`).
- Die Seitenleiste ist auf dem PC fest links (`.sidebar` in `src/styles/layout.css`), auf dem Handy eine Schublade.
- Das Fenster nutzt die Windows-Titelleiste (`src-tauri/tauri.conf.json`). Für das Fenster ist bisher nur `core:window:allow-destroy` zusätzlich erlaubt (`src-tauri/capabilities/default.json`).

Fertig-Kriterien:
- [ ] `tokens.css` nach der Vorlage, mit allen Farben für Hell, Dunkel und Schwarz und den vier Akzentfarben (je mit abgeleiteten Tönen für Flächen, Chips, Callouts und Text auf Akzent). Text und Bedienelemente erreichen in allen Kombinationen mindestens WCAG AA; ein Test rechnet die Kontraste nach. Der Farbtest aus Etappe 9 bleibt grün.
- [ ] Schriften nach der Vorlage (siehe „Schrift“), lokal eingebunden, mit Lizenztexten. Sie ersetzen Inter in der App und in `localist.css`. In `localist.css` nur die Zeichensätze und Schnitte, die die Seiten brauchen; die Dateigröße steht in `FORTSCHRITT.md`.
- [ ] Modi Hell, Dunkel und Schwarz plus „Wie System“: Ist das System hell, gilt Hell; ist es dunkel, gilt der zuletzt gewählte dunkle Modus (Dunkel oder Schwarz). Umschalter unten in der Seitenleiste (drei Knöpfe; ein Klick schaltet „Wie System“ aus) und Einstellungen → „Darstellung“ wie in `05-handy-darstellung-dunkel.png` (Vorschaukarten, Schalter „Wie System“, Erklärung zu Schwarz, Akzentfarbe). Alte gespeicherte Werte werden übernommen. Der Wechsel wirkt sofort und ohne Flackern, auch beim Start.
- [ ] HTML-Seiten, Notizbuch und Vorschauen folgen Modus und Akzentfarbe sofort. Die Brücke ist um Schwarz und Akzent erweitert, die Prüfung der `postMessage`-Nachrichten und ihre Tests sind angepasst. Ohne App (Doppelklick im Browser) gilt `prefers-color-scheme` mit Orange.
- [ ] Fensterrahmen wie in der Vorlage: keine Windows-Titelleiste (`decorations: false`), eigene Knöpfe für Minimieren, Maximieren/Wiederherstellen und Schließen oben rechts. Ziehen an freien Stellen der oberen Leiste verschiebt das Fenster, Doppelklick maximiert, die Fenstergröße lässt sich am Rand ändern, Andocken mit Win+Pfeiltasten geht. In `capabilities/default.json` kommen nur die dafür nötigen Rechte dazu. Geprüft in der gebauten `localist.exe`. Lässt sich etwas davon nicht zuverlässig umsetzen, bleibt die Windows-Titelleiste; dann notierst du die Abwägung unter „Entscheidungen“ und sagst es mir.
- [ ] Der Inhalt ist eine abgesetzte Fläche (Radius, feine Linie, schmaler Rand ringsum) wie in der Vorlage.
- [ ] Seitenleiste neu nach der Vorlage (Aufbau siehe „Was die Vorlage festlegt“). „Neue Seite“ öffnet das bisherige „Neu“-Menü. Alles aus Version 2.0 bleibt erhalten: Drag & Drop, Umbenennen, Kontextmenü, Markierung gleichnamiger Seiten, Emoji-Icons, Symbole für Datenbank und Notizbuch.
- [ ] Seitenleiste links oder rechts: Einstellung unter „Darstellung“, wirkt sofort, wird gemerkt. Rechts ist alles gespiegelt (Rahmenlinie, Einklapp-Knopf, Menüs bleiben im Fenster). Die Fensterknöpfe bleiben immer oben rechts.
- [ ] Seitenleiste ein- und ausklappbar: ein Knopf mit Seitenleisten-Symbol in der oberen Leiste und ein Tastenkürzel, das auf deutscher Tastatur ohne AltGr geht und kein Kürzel von BlockNote oder CodeMirror überschreibt (im Tooltip angezeigt). Eingeklappt nutzt der Inhalt die volle Breite. Kurzer Übergang (aus bei `prefers-reduced-motion`), der Zustand wird gemerkt.
- [ ] Screenshots in Hell, Dunkel und Schwarz (Seitenleiste links, rechts und eingeklappt; Einstellungen → Darstellung) in `docs/screenshots/etappe-18/`.

## Etappe 19 – Neues Design, Teil 2: Reiter und Inhalte

Befunde:
- `src/components/Workspace.tsx` zeigt heute genau eine Seite (`page`). Gespeichert wird automatisch (`src/lib/autosave.ts`).
- Die Startseite (`src/components/HomePage.tsx`) nutzt die Änderungszeit aus dem Suchindex.
- Tabellen in Notizen sind heute kein Editor-Block: Sie erscheinen als unveränderter Markdown-Text (`rawMarkdown` in `src/editor/schema.ts`, Entscheidung aus Etappe 1). Die Vorlage zeigt sie als echte Tabelle.
- Die Bausteine der HTML-Seiten bekommen ihr Aussehen aus `src/bausteine/*.css`.

Fertig-Kriterien:
- [ ] Reiter wie in der Vorlage. Ein Klick in der Seitenleiste, auf der Startseite, in Strg+P oder auf einen Link öffnet die Seite im aktuellen Reiter. Strg+Klick oder Mittelklick öffnet einen neuen Reiter. Strg+T öffnet einen neuen Reiter mit der Startseite, Strg+W schließt, Strg+Tab und Strg+Umschalt+Tab wechseln, Mittelklick auf einen Reiter schließt ihn. Reiter folgen Umbenennen, Verschieben, Umwandeln und Löschen. Jeder Reiter merkt sich seine Scrollposition. Vor jedem Wechsel ist gespeichert, es geht nichts verloren. Die offenen Reiter werden pro Vault im App-Speicher gemerkt. Auf dem Handy gibt es keine Reiterleiste.
- [ ] Startseite nach `01-desktop-startseite-hell.png`: Datum, Begrüßung nach Tageszeit, „Schnell notieren …“ (Enter legt eine Notiz in der Vault-Wurzel an: erste Zeile = Titel, Rest = Inhalt, Name eindeutig und ohne ungültige Zeichen; Umschalt+Enter macht eine neue Zeile; ein leeres Feld macht nichts), Knöpfe für Datenbank, Vorlage und „+ Notiz“, „Zuletzt bearbeitet“ als Tabelle mit relativer Zeit, „Alle Seiten“ (alle Seiten nach Änderungszeit) und Favoriten als Chips.
- [ ] Seitenkopf: Pfad, Speicherstatus („Speichert …“, „gerade eben gespeichert“, „vor 3 Min. gespeichert“, Fehler deutlich sichtbar), Stern für Favorit und „…“ mit denselben Aktionen wie das Kontextmenü, inklusive „Im Explorer öffnen“.
- [ ] Notiz nach `02-desktop-notiz-schwarz.png`: Titel, Eigenschaften (Chips für Mehrfachwerte, Datumswerte in Monospace, „+ Eigenschaft hinzufügen“), Callout, Toggle, Zitat, Code, Checkliste und Tabelle im Stil der Vorlage. „+“ und Ziehgriff neben dem Block; „/“ und „+“ öffnen das Menü „Baustein wählen …“ mit Filterfeld und Symbol-Kästchen.
- [ ] Tabellen in Notizen: Markdown-Tabellen erscheinen im Editor als Tabelle und lassen sich bearbeiten (Zellen, Zeilen und Spalten hinzufügen und entfernen); „Tabelle“ steht im Menü. Gespeichert wird weiterhin eine normale Markdown-Tabelle, die Obsidian anzeigt. Was der Editor nicht verlustfrei abbilden kann, bleibt wie bisher unveränderter Markdown-Text. Roundtrip-Tests für Ausrichtung, Formatierung in Zellen, `\|` in Zellen, leere Zellen, Tabelle direkt nach Text und Umlaute.
- [ ] Im neuen Stil, in allen drei Modi: HTML-Seiten (Lesen, Code, Geteilt, Werkzeugleiste, Formulare, Stift-Symbol), Datenbank-Ansichten (Tabelle, Kanban, Kalender), Notizbuch, Seite „Bausteine“, Strg+P, Volltextsuche, Vorlagen-Auswahl, Dialoge, Menüs, Meldungen und Einstellungen.
- [ ] Die Bausteine in `localist.css` sehen aus wie die Elemente der Notiz in der Vorlage (Callout, Tabelle, Checkliste usw.), damit Notizen und HTML-Seiten gleich wirken. Per Doppelklick im Browser bleibt alles lesbar und interaktiv (wie in Etappe 12 geprüft).
- [ ] Vergleich mit der Vorlage: Screenshots von Startseite und Notiz mit den Inhalten der Vorlage (eigener Vault für das Screenshot-Skript, gleiche Fenstergröße) liegen in `docs/screenshots/etappe-19/`. Anordnung, Abstände, Größen und Farben stimmen mit `01-…` und `02-…` überein, Abweichungen sind in `FORTSCHRITT.md` begründet. Dazu Screenshots aller übrigen Ansichten in Hell, Dunkel und Schwarz.

## Etappe 20 – Handy und Version 2.1

Befunde:
- Auf dem Handy öffnet heute ein Menü-Knopf oben die Seitenleiste als Schublade (`.topbar-menu` und `.sidebar-shell` in `src/styles/layout.css`).
- Die Android-Prüfung läuft mit `scripts/android-pruefung.mjs` (siehe Entscheidungen zu Etappe 15).

Fertig-Kriterien:
- [ ] Untere Navigationsleiste nach `03-handy-startseite-hell.png`: Start, Suchen, „+“ (Neu-Menü), Seiten (Ordnerbaum mit Favoriten) und Einstellungen. Sie berücksichtigt `safe-area-inset-bottom` und ersetzt den Menü-Knopf oben. Die Handy-Startseite sieht aus wie in der Vorlage.
- [ ] Handy-Notiz nach `04-handy-notiz-schwarz.png`: Kopf mit Zurück-Pfeil und Ordnername, Stern und „…“; Eigenschaften als Chips in einer Zeile. Beim Schreiben steht über der Tastatur eine Leiste mit „+“ (Baustein wählen), Checkliste, Callout, Toggle, Bild und „Fertig“ (schließt die Tastatur). Die Leiste verdeckt nie den Cursor.
- [ ] Handy-Einstellungen → Darstellung nach `05-handy-darstellung-dunkel.png`.
- [ ] Ab 360 px Breite ist alles bedienbar, Tippflächen sind mindestens 44 px groß.
- [ ] Version 2.1.0 in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json` und `src-tauri/Cargo.toml`. Windows-Installer und APK sind gebaut, die Pfade stehen im Chat.
- [ ] Android im Emulator mit `adb`-Befehlen samt Ausgabe und Screenshots geprüft: Startseite, Navigationsleiste, Notiz bearbeiten mit Leiste und „Fertig“, Darstellung (alle drei Modi und eine andere Akzentfarbe), Seite „Bausteine“, HTML-Seite in „Lesen“ und „Code“.
- [ ] Neue Klickliste „Version 2.1“ in `FORTSCHRITT.md` (Tab/Shift+Tab in Liste und Code, „Im Explorer öffnen“ in der Vorschau-Simulation, Seitenleiste rechts und eingeklappt, Code rechts und Trennlinie ziehen, Reiter öffnen/wechseln/schließen, Schnell notieren, Modus Schwarz mit Akzent Blau, Tabelle in einer Notiz bearbeiten) ist abgehakt, ebenso „Version 1.0“ und „Version 2.0“, möglichst automatisch mit `scripts/klickliste.mjs` (neues Argument `2.1`).
- [ ] `README.md` und `ANLEITUNG.md` haben einen Abschnitt „Neu in Version 2.1“ für Einsteiger, die Pfade zeigen auf `Localist`. `git grep -nE "TODO|FIXME" -- src src-tauri/src` liefert nichts.
