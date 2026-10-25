# Localist – Projektbeschreibung für Claude Code

> Diese Datei ist die Projektbeschreibung für Claude Code und wird in jeder Sitzung automatisch gelesen.
> Ändere sie nicht, außer der Nutzer bittet ausdrücklich darum. Den Fortschritt dokumentierst du in `FORTSCHRITT.md` (siehe „Fortschrittsdatei“ unten).

## Ziel

Localist ist eine App für Windows (und Android) für Notizen, Projekte und interaktive Seiten. Sie verbindet:

- **Speicherung wie Obsidian:** Alles liegt als normale Dateien in einem Ordner („Vault“), den der Nutzer selbst wählt. Jede Datei lässt sich jederzeit auch ohne die App öffnen.
- **Aussehen inspiriert von Notion:** clean, ruhig, viel Weißraum. Notion ist Vorbild für den Stil, nicht für jede Funktion. Eigene Elemente sind ausdrücklich erwünscht, solange das Gesamtbild aufgeräumt bleibt. Keine Logos, Grafiken oder Texte von Notion übernehmen.
- **Lokale Website:** Neben normalen Notizen gibt es HTML-Seiten. Sie werden mit Bausteinen wie Karteikarten, Diagrammen und Tabellen gebaut und im Lesemodus als fertige, interaktive Seite angezeigt.
- **Local-first:** keine Accounts, kein Server, keine Telemetrie, funktioniert komplett offline.

## Versionen

- **Version 1.0 (Etappen 0–8): abgeschlossen.** Block-Editor für Markdown-Notizen, Eigenschaften, Datenbanken mit Tabelle, Kanban und Kalender, Suche, Strg+P, Vorlagen, Backlinks, Windows-Installer und Android-APK. Details, Nachweise und Entscheidungen stehen in `FORTSCHRITT.md`.
- **Version 2.0 (Etappen 9–15): in Arbeit.** Neues Design, zweiter Seitentyp „HTML-Seite“ mit Code-Editor und Lesemodus, Baustein-Bibliothek, Notizbücher.

## Kommunikation

- Mit dem Nutzer immer auf Deutsch kommunizieren: Erklärungen, Fragen, Zusammenfassungen, Texte und Fehlermeldungen in der App, `ANLEITUNG.md`.
- Code, Befehle, Bezeichner, Dateiendungen und etablierte Fachbegriffe bleiben im Original.
- Der Nutzer ist Einsteiger in der Programmierung: kurz erklären, was passiert und warum.

## Technik-Stack

| Bereich | Wahl |
|---|---|
| App-Hülle | Tauri 2 (Rust) |
| Oberfläche | React + TypeScript, Vite |
| Editor für Notizen | BlockNote mit eigenem Markdown-Konverter (`src/markdown/`, siehe `FORTSCHRITT.md`) |
| Editor für HTML-Seiten | CodeMirror 6 |
| Bausteine | Custom Elements in einfachem JavaScript und CSS, ohne Framework |
| Tests | Vitest für die Oberfläche und Logik, `cargo test` für Rust |
| Zielplattformen | Windows (EXE/Installer) und Android (APK) |

Neue Bibliotheken nur, wenn sie offline funktionieren, eine freie Lizenz haben (MIT, Apache, BSD, OFL o. ä.) und lokal mitgebündelt werden. Keine CDNs, keine Online-Schriften.

## Zwei Seitentypen

| | Notiz | HTML-Seite |
|---|---|---|
| Datei | `.md` | `.html` |
| Gedacht für | schnelle Notizen, Listen, Projekte, Datenbank-Einträge | Lernseiten, Übersichten, alles Interaktive |
| Bearbeiten | Block-Editor | Code-Editor mit Werkzeugleiste und Formularen für Bausteine |
| Anzeigen | direkt im Editor | Ansichten „Lesen“, „Code“ und „Geteilt“ |
| Eigenschaften | YAML-Frontmatter | `<meta>`-Tags im Kopfbereich |
| Obsidian | voll kompatibel | wird von Obsidian nicht als Notiz angezeigt |
| Datenbank-Eintrag | ja | nein (vorerst) |

Gemeinsame Regeln:

- Beide Typen liegen in denselben Ordnern. Die Dateiendung bestimmt den Typ, die Sidebar zeigt für jeden Typ ein eigenes Symbol.
- Der Dateiname ist der Titel. Ein Name darf pro Ordner nur einmal vorkommen, auch über beide Typen hinweg: `Ideen.md` und `Ideen.html` dürfen nicht im selben Ordner liegen.
- Jede Seite hat eine feste `id`, die beim Anlegen vergeben und nie geändert wird.
- Suche, Strg+P, Vorlagen, Favoriten, Links und Backlinks funktionieren für beide Typen.
- **Bestehende Vaults:** Die App benennt nie selbst etwas um. Liegen schon zwei gleichnamige Seiten in einem Ordner, markiert die Sidebar sie, und `[[Name]]` meint die `.md`. HTML-Seiten in einem Datenbank-Ordner erscheinen in der Sidebar, aber nicht in Tabelle, Kanban oder Kalender.

## Speicherformat

Die Dateien im Vault sind die Quelle der Wahrheit. Die App hat keine eigene Datenbank für Inhalte.

```
MeinVault/
├── .localist/                 ← Einstellungen und Bausteine (in der Sidebar unsichtbar)
│   ├── settings.json
│   └── bausteine/
│       ├── localist.css       ← Aussehen der Bausteine, von der App verwaltet
│       ├── localist.js        ← Funktion der Bausteine, von der App verwaltet
│       └── eigene/            ← eigene Bausteine des Nutzers („Code-Speicher“)
│           └── Lernziel-Box.html
├── Projekte/                  ← Datenbank (enthält _ansichten.yaml)
│   ├── _ansichten.yaml
│   └── Website-Relaunch.md
├── Lernen/                    ← Notizbuch (enthält _notizbuch.yaml)
│   ├── _notizbuch.yaml
│   ├── DNS.html
│   └── Subnetting.md
├── Notizen/
│   └── Ideen.md
├── Vorlagen/
│   ├── Projekt.md
│   └── Lernseite.html
└── Anhänge/
    └── skizze.png
```

Allgemeine Regeln:

- **Versteckte Ordner** (Name beginnt mit `.`) werden in der Sidebar nicht angezeigt.
- **Caches und Suchindex** liegen nie im Vault, sondern im App-Datenordner des Systems, und lassen sich jederzeit neu aufbauen.
- **Sicher speichern:** Dateien atomar schreiben (erst in eine temporäre Datei, dann umbenennen).
- **Löschen** verschiebt in den Papierkorb (Windows) bzw. nach `.localist/Papierkorb/` (Android).
- **Datumsangaben** immer als `YYYY-MM-DD` oder `YYYY-MM-DDTHH:MM`.

### Notizen (`.md`)

Unverändert gegenüber Version 1.0:

- Eigenschaften stehen als YAML-Frontmatter am Anfang der Datei. Unbekannte Felder bleiben beim Speichern unverändert erhalten.
- Feste Felder: `id`, optional `icon` (Emoji) und `cover` (Pfad zu einem Bild im Vault).
- Ein Ordner wird zur **Datenbank**, sobald er eine `_ansichten.yaml` enthält. Jede `.md`-Datei darin ist ein Eintrag.
- Obsidian-kompatibel: Links als `[[Seitenname]]`, Callouts als `> [!info] Titel`, Toggles als `> [!note]- Titel`, Checklisten als `- [ ]`.
- Links wie in Obsidian: `[[Name]]` und `[[Ordner/Name]]` meinen nur `.md`-Dateien, `[[Name.html]]` meint eine HTML-Seite. Im Editor wird der Link ohne Endung angezeigt, beim Umbenennen bleibt die Endung erhalten.

### HTML-Seiten (`.html`)

Beispiel `Lernen/DNS.html`:

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DNS</title>
<meta name="localist-id" content="7c1e2b4a-0d3f-4a5e-9b8c-1f2e3d4c5b6a">
<meta name="localist-icon" content="🧠">
<link rel="stylesheet" href="../.localist/bausteine/localist.css">
<script src="../.localist/bausteine/localist.js" defer></script>
</head>
<body>
<main>
<l-callout typ="tipp">DNS übersetzt Namen wie example.com in IP-Adressen.</l-callout>

<l-kartenstapel>
  <l-karteikarte>
    <l-frage>Welchen Port nutzt DNS?</l-frage>
    <l-antwort>Port 53 (UDP und TCP)</l-antwort>
  </l-karteikarte>
</l-kartenstapel>

<l-diagramm typ="balken" titel="Anfragen pro Tag">
  <table>
    <tr><th>Tag</th><th>Anfragen</th></tr>
    <tr><td>Mo</td><td>120</td></tr>
    <tr><td>Di</td><td>95</td></tr>
  </table>
</l-diagramm>

<details>
  <summary>Mehr zu Resolvern</summary>
  <p>Ein Resolver fragt die Nameserver der Reihe nach ab …</p>
</details>

<p>Siehe auch <a href="../Notizen/Ideen.md">Ideen</a>.</p>
</main>
</body>
</html>
```

Regeln:

- **Aufbau:** ein vollständiges HTML-Dokument, der Inhalt steht in `<main>`.
- **Kopfbereich verwaltet die App:** `<title>` (gleich dem Dateinamen), `localist-id`, `localist-icon`, `localist-cover` (Bildpfad relativ zur Seite), weitere Eigenschaften als `<meta name="localist-prop-<name>" content="…">` und die Verweise auf `.localist/bausteine/`. Den Kopf schreibt die App nur beim Anlegen, Umbenennen, Verschieben und Ändern von Icon, Cover oder Eigenschaften.
- **Der Code des Nutzers bleibt unangetastet:** Den Inhalt von `<main>` ändert die App nur, wenn der Nutzer es auslöst (Tippen, Werkzeug, Formular, Häkchen), und dann nur genau die betroffene Stelle. Einzige Ausnahme: Beim Umbenennen, Verschieben und Umwandeln passt sie relative `href`- und `src`-Werte an, die auf die betroffene Seite zeigen, und zwar nur den Attributwert. Kein automatisches Umformatieren.
- **Technisch:** Änderungen werden über Quellpositionen ersetzt (z. B. mit parse5 und `sourceCodeLocationInfo`), nie durch Neu-Serialisieren des DOM. Zeilenenden (CRLF/LF) und ein vorhandenes BOM bleiben erhalten.
- **Bausteine** sind Custom Elements mit dem Präfix `l-`, z. B. `<l-karteikarte>`. Wo HTML schon ein passendes Element hat, wird es genutzt: `<details>` für Toggles, `<table>` für Tabellen, `<ul>`/`<ol>` für Listen, `<figure>`/`<img>` für Bilder, `<pre><code>` für Code.
- **Ohne Localist lesbar:** Der Text jedes Bausteins steht als normaler Inhalt in der Datei, nicht in Attributen oder JSON. Ohne Skript erscheint er schlicht formatiert, mit Skript interaktiv. Ein Diagramm liest seine Daten aus einer `<table>`, die ohne Skript als Tabelle sichtbar bleibt.
- **Im normalen Browser:** Per Doppelklick in Edge oder Chrome geöffnet sieht der Inhalt von `<main>` aus wie im Lesemodus und ist interaktiv. Die Schrift darf abweichen; Seitenkopf (Icon, Cover) und Bearbeiten-Symbole gibt es nur in der App. `localist.js` ist ein klassisches Skript (kein `type="module"`), damit es auch über `file://` lädt.
- **Eigene Skripte und Styles** (`<script>`, `<style>`) sind erlaubt. Sie laufen nur in der abgeschotteten Anzeige (siehe „Sicherheit“).
- **Links** auf andere Seiten sind relative `<a href>`-Links, Leerzeichen als `%20`, z. B. `<a href="../Notizen/Ideen.md">`. Ein Klick öffnet die Seite in der App. In HTML-Seiten zählen nur `<a href>` als Links (für Backlinks und Umbenennen).
- **Vorlagen:** Eine Seite aus einer HTML-Vorlage bekommt eine neue `localist-id`, die Pfade zu `.localist/bausteine/` werden für den Zielordner neu berechnet, `{{title}}`, `{{date}}` und `{{time}}` werden ersetzt.

Markup der Bausteine (verbindlich, damit Werkzeuge, Formulare und Tests dieselbe Form erwarten):

| Baustein | Markup |
|---|---|
| Callout | `<l-callout typ="info\|tipp\|warnung\|fehler">Text</l-callout>` |
| Toggle | `<details><summary>Titel</summary>…</details>` |
| Tabelle | `<table>` mit `<tr>`, `<th>`, `<td>` |
| Checkliste | `<ul class="l-checkliste"><li><input type="checkbox" checked> Text</li></ul>` |
| Spalten | `<l-spalten><l-spalte>…</l-spalte><l-spalte>…</l-spalte></l-spalten>` |
| Bild | `<figure><img src="../Anhänge/skizze.png" alt="…"><figcaption>…</figcaption></figure>` |
| Trennlinie | `<hr>` |
| Code-Block | `<pre><code class="language-…">…</code></pre>` |
| Seitenlink | `<a class="l-seitenlink" href="../Notizen/Ideen.md">Ideen</a>` |
| Karteikarte | `<l-karteikarte><l-frage>…</l-frage><l-antwort>…</l-antwort></l-karteikarte>` |
| Kartenstapel | `<l-kartenstapel>` mit mehreren `<l-karteikarte>` |
| Quiz | `<l-quiz><l-quizfrage><l-frage>…</l-frage><ul><li>falsch</li><li data-richtig>richtig</li></ul></l-quizfrage></l-quiz>` |
| Diagramm | `<l-diagramm typ="balken\|linie\|kreis" titel="…"><table>…</table></l-diagramm>` (erste Spalte = Beschriftung, weitere Spalten = Werte) |

### Notizbücher (`_notizbuch.yaml`)

```yaml
titel: Lernen für die Prüfung
seiten:
  - DNS.html
  - Subnetting.md
```

- Ein Ordner mit `_notizbuch.yaml` ist ein Notizbuch. Er wird wie eine kleine Website angezeigt.
- Seiten, die in der Liste fehlen, erscheinen alphabetisch am Ende.
- Ein Ordner ist entweder Datenbank oder Notizbuch, nicht beides. Liegen in einem bestehenden Ordner schon beide Dateien, gilt er als Datenbank, und die App zeigt einen Hinweis.

### Eigene Bausteine (`.localist/bausteine/eigene/`)

- Jede Datei ist ein HTML-Schnipsel. Die erste Zeile ist ein Kommentar mit der Beschreibung, z. B. `<!-- beschreibung: Box für Lernziele -->`.
- Der Dateiname ohne `.html` ist der Name des Bausteins.

## Sicherheit (verbindlich)

- **Abgeschottete Anzeige:** HTML-Seiten werden nur in einem `<iframe sandbox="allow-scripts">` **ohne** `allow-same-origin` angezeigt. Seiteninhalte, auch eigene Skripte, haben keinen Zugriff auf Tauri-Befehle, das Dateisystem, die App-Oberfläche, den Speicher der App oder das Netzwerk.
- **Eigenes URI-Schema `localist-seite`:** Es liefert die Seiten an das iframe aus (unter Windows und Android als `http://localist-seite.localhost/<Pfad im Vault>`), damit relative Pfade zu Bildern und Bausteinen funktionieren. Es liefert nur Dateien aus dem geöffneten Vault (Prüfung wie `vault::resolve`, auch gegen `%2e%2e` und `\`). Für `.localist/bausteine/localist.js` und `localist.css` liefert es immer die mit der App gebündelte Fassung. In die ausgelieferte Kopie, nie in die Datei, fügt die App ein kleines Brücken-Skript ein (Links, Tastenkürzel, Hell/Dunkel, Häkchen, Stift-Symbole).
- **CSP der Seiten** kommt als HTTP-Header des Schemas: kein Netzwerk (`connect-src 'none'`), Skripte, Styles und Bilder nur vom Schema selbst, inline und `data:`, keine Formularziele, keine Navigation nach außen.
- **App-weite CSP:** In `tauri.conf.json` wird eine CSP gesetzt (in Version 1.0 steht dort `null`): kein Code von außen, iframes nur vom Schema `localist-seite`, Netzwerk nur für die Tauri-IPC. Den genauen Wert (inklusive dem, was BlockNote und Mantine für Styles brauchen) legt Claude Code fest und notiert ihn in `FORTSCHRITT.md`. Geprüft wird in der gebauten `localist.exe`, nicht nur in `tauri dev` oder der Browser-Vorschau.
- **Nachrichten:** Seite und App sprechen nur über `postMessage` mit festen Nachrichtentypen miteinander (z. B. Link öffnen, Tastenkürzel, Baustein bearbeiten, Häkchen gesetzt). Weil das iframe keinen eigenen Ursprung hat (`event.origin` ist `"null"`), prüft die App `event.source === iframe.contentWindow`, dann den Nachrichtentyp und dass jeder Pfad im Vault liegt. An das iframe schickt die App nie vertrauliche Daten.
- **Externe Links** (`https://…`) öffnen im Standardbrowser, nie in der App.
- **Notizen in fremder Darstellung:** Wo Notizen fertig dargestellt werden (Notizbuch, Vorschauen), laufen sie ebenfalls durch die abgeschottete Anzeige. Roh-HTML aus Markdown kommt nie direkt in die App-Oberfläche.
- Im Zweifel die sicherere Lösung wählen und die Abwägung in `FORTSCHRITT.md` unter „Entscheidungen“ notieren.

## Design-Grundsätze

- Ruhig und aufgeräumt: viel Weißraum, zurückhaltende Farben, eine Akzentfarbe, dezente Linien statt schwerer Kästen.
- Ein Design-System: Farben, Abstände, Schriftgrößen, Radien und Schatten sind CSS-Variablen in `src/styles/tokens.css`. Komponenten nutzen nur diese Variablen.
- Hell- und Dunkelmodus sind gleichwertig.
- `localist.css` wird beim Build aus `tokens.css` und `src/bausteine/*.css` erzeugt, damit HTML-Seiten und App wie aus einem Guss aussehen und die Datei trotzdem allein funktioniert.
- Schrift lokal eingebunden (z. B. Inter über `@fontsource`).
- Wiederverwendbare UI-Komponenten (Schaltfläche, Menü, Dialog, Eingabefeld, Reiter) liegen unter `src/components/ui/`.
- Bedienbar von 360 px Breite (Handy) bis Vollbild.

## Arbeitsregeln für Claude Code

1. **Zuerst den Stand prüfen.** Zu Beginn jeder Sitzung `FORTSCHRITT.md` lesen und `git status` sowie `git log --oneline -10` ausführen. Dann beim dort notierten nächsten Schritt weitermachen und nichts doppelt bauen. Hat der Nutzer diese `CLAUDE.md` geändert, die Änderung zuerst als eigenen Commit speichern: `CLAUDE.md aktualisiert`.
2. **Immer nur die aktuelle Etappe umsetzen.** Keine Funktionen aus späteren Etappen vorziehen.
3. **Zu Beginn einer Etappe** ihre Fertig-Kriterien wörtlich im Chat auflisten und als Checkliste in `FORTSCHRITT.md` übernehmen.
4. **Nach jedem erledigten Kriterium** sofort `FORTSCHRITT.md` aktualisieren (Haken setzen, nächsten Schritt notieren) und einen Zwischen-Commit erstellen: `Etappe N: <was erledigt ist>`.
5. **Zum Abschluss** jedes Kriterium einzeln im Chat nachweisen, auch die schon früher erledigten. Der `/goal`-Prüfer sieht nur den Chat, deshalb stehen Nachweise immer als Text dort: Befehlsausgaben, Namen der passenden Tests, Dateipfade, die Auflistung der Screenshot-Ordner, bei Android die `adb`-Befehle mit Ausgabe. Danach einen Abschluss-Commit erstellen: `Etappe N abgeschlossen: <kurze Beschreibung>`.
6. **Jede Etappe besteht diese Prüfungen:** `npm test` ist grün, `cargo test --manifest-path src-tauri/Cargo.toml` ist grün, `npx tsc --noEmit` zeigt keine Fehler, `npm run tauri build` endet ohne Fehler.
7. **Nichts kaputt machen.** Alle Funktionen der Version 1.0 bleiben erhalten. Das heißt: mindestens 128 Tests in `npm test` und 20 in `cargo test` laufen weiter grün (Stand 1.0), keiner wird gelöscht, und die feste Klickliste „Version 1.0“ in `FORTSCHRITT.md` (in Etappe 9 anlegen: Notiz bearbeiten, Callout, Link, Eigenschaft, Tabelle, Kanban, Kalender, Suche, Strg+P, Vorlage, Backlinks, Hell/Dunkel) ist in der Browser-Vorschau abgehakt. Bestehende Tests nur ändern, wenn sich das gewünschte Verhalten bewusst ändert, und die Begründung in `FORTSCHRITT.md` notieren.
8. **Oberfläche ansehen.** Neue oder geänderte Oberflächen in der Browser-Vorschau prüfen (`npm run dev`, nutzt `src/lib/dev-backend.ts`). Für HTML-Seiten liefert eine Vite-Middleware `beispiel-vault/` mit denselben Regeln und Headern aus wie das Schema `localist-seite`. Screenshots unter `docs/screenshots/etappe-N/` ablegen, damit der Nutzer das Ergebnis sehen kann. Ist ein Screenshot technisch nicht möglich, das in `FORTSCHRITT.md` vermerken.
9. **Nur im Projektordner arbeiten.** Zum Testen den Beispiel-Vault im Projekt verwenden (`beispiel-vault/`) und ihn um Beispiele für neue Funktionen ergänzen. Nie echte Nutzerdaten verändern.
10. **Diese Datei nicht überschreiben.**
11. **Fehlt etwas, das der Nutzer selbst tun muss** (Programm installieren, Systemeinstellung, Geschmacksentscheidung), genau sagen was und wie, es in `FORTSCHRITT.md` unter „Offene Probleme“ notieren und anhalten. Fehlende Werkzeuge dürfen nach Rückfrage per `winget` installiert werden.

## Fortschrittsdatei

`FORTSCHRITT.md` im Projektordner ist das Gedächtnis zwischen den Sitzungen. Wer sie liest, muss ohne weiteren Kontext wissen, wo das Projekt steht und was als Nächstes kommt. Aufbau:

```markdown
# Fortschritt

## Aktueller Stand
- Etappe: 10 – HTML-Seiten: Grundlage und sichere Anzeige
- Zuletzt aktualisiert: 2026-10-26 14:30
- Nächster Schritt: Links aus HTML-Seiten in der App öffnen

## Fertig-Kriterien der aktuellen Etappe
- [x] `.html`-Dateien erscheinen in Sidebar, Strg+P und Suche …
- [ ] Anlegen, Umbenennen, Verschieben, Löschen …

## Abgeschlossene Etappen
- Etappe 9 – Neues Design (abgeschlossen am 2026-10-26) …

## Offene Probleme
- keine

## Entscheidungen
- 2026-10-26: CodeMirror 6 als Code-Editor, weil …
```

## Etappen und Fertig-Kriterien

### Version 1.0 – abgeschlossen

Etappe 0 Fundament · 1 Vault und Seiten · 2 Notion-Feeling · 3 Eigenschaften und Tabelle · 4 Kanban · 5 Kalender · 6 Komfort · 7 Version 1.0 für den PC · 8 Android-APK. Kriterien und Nachweise stehen in `FORTSCHRITT.md`.

### Etappe 9 – Neues Design

- [ ] Alle Farben, Abstände, Schriftgrößen, Radien und Schatten stehen als CSS-Variablen in `src/styles/tokens.css` (hell und dunkel). Ein Test prüft alle `.css`-Dateien unter `src/` außer `tokens.css` und stellt sicher, dass dort keine festen Farbwerte (`#…`, `rgb(…)`, `rgba(…)`, `hsl(…)`, `hsla(…)`) stehen.
- [ ] Die Klickliste „Version 1.0“ (siehe Arbeitsregel 7) steht in `FORTSCHRITT.md`.
- [ ] Wiederverwendbare UI-Komponenten unter `src/components/ui/` (Schaltfläche, Menü, Dialog, Eingabefeld, Reiter) ersetzen die bisherigen Einzellösungen in Sidebar, Dialogen, Eigenschaften-Leiste und Datenbank-Ansichten.
- [ ] Die Schrift ist lokal eingebunden, die App lädt nichts aus dem Internet.
- [ ] Überarbeitete Sidebar: oben ein Bereich „Favoriten“ (Seiten anheften und lösen, gespeichert in `.localist/settings.json`), darunter der Ordnerbaum. Ein „Neu“-Menü fasst Notiz, Ordner und Datenbank zusammen.
- [ ] Startseite, wenn keine Seite offen ist: zuletzt bearbeitete Seiten, Favoriten, Schnellaktionen und ein Suchfeld.
- [ ] Notizen, Datenbank-Ansichten (Tabelle, Kanban, Kalender), Dialoge und Einstellungen nutzen das neue Design, hell und dunkel, und sind ab 360 px Breite bedienbar.
- [ ] Screenshots (hell und dunkel) von Startseite, Notiz, Tabelle, Kanban und Kalender liegen in `docs/screenshots/etappe-9/` und sind in `FORTSCHRITT.md` verlinkt.
- [ ] Alle Funktionen der Version 1.0 funktionieren weiterhin (siehe Arbeitsregel 7).

### Etappe 10 – HTML-Seiten: Grundlage und sichere Anzeige

- [ ] `.html`-Dateien erscheinen in Sidebar, Strg+P und Suche mit eigenem Symbol. Das „Neu“-Menü legt eine HTML-Seite nach dem Speicherformat an (mit `localist-id`). Vorlagen aus `Vorlagen/` funktionieren auch für HTML-Seiten (siehe Speicherformat).
- [ ] Anlegen, Umbenennen und Löschen funktionieren für HTML-Seiten wie für Notizen. Ein neuer oder umbenannter Name darf pro Ordner über beide Typen nur einmal vorkommen. Beim Umbenennen wird `<title>` angepasst.
- [ ] Neu für beide Typen und Ordner: **Verschieben** per Drag & Drop in der Sidebar und über „Verschieben nach…“. Dabei werden Links im Vault angepasst und bei HTML-Seiten die relativen Pfade (Bausteine, Bilder, Links) neu berechnet.
- [ ] Das Schema `localist-seite` mit eigener CSP und Brücken-Skript ist umgesetzt (siehe „Sicherheit“). Bis Etappe 12 liefert es für `localist.js` und `localist.css` leere Platzhalter. Die Ansicht „Lesen“ zeigt die Seite darüber in der abgeschotteten Anzeige. Bilder aus dem Vault werden angezeigt, Icon und Cover aus den `<meta>`-Tags erscheinen im Seitenkopf wie bei Notizen. Die Tastenkürzel der App (z. B. Strg+P) wirken auch, wenn die Seite den Fokus hat.
- [ ] Die App-weite CSP ist gesetzt, der Wert steht in `FORTSCHRITT.md`, und die gebaute `localist.exe` funktioniert damit (Notiz, Datenbank, HTML-Seite geöffnet).
- [ ] Automatischer Sicherheitstest in der echten App: z. B. `localist.exe --sicherheitstest <vault>` öffnet eine Testseite in der abgeschotteten Anzeige, sammelt die Ergebnisse per `postMessage` und gibt sie als Tabelle auf der Konsole aus. Geprüft wird: `window.__TAURI__`, `window.__TAURI_INTERNALS__`, `parent.document`, `localStorage`, `fetch` ins Netzwerk, `fetch` an die Tauri-IPC (`http://ipc.localhost/…`), ein Bild von `https://…`, `location.href` nach außen und eine Datei außerhalb des Vaults (`../`, `%2e%2e`). Alles schlägt fehl. Die Konsolenausgabe steht im Chat und in `FORTSCHRITT.md`.
- [ ] Links: Ein Klick auf einen Link zu einer Notiz oder HTML-Seite öffnet sie in der App, externe Links öffnen im Standardbrowser. Notizen können HTML-Seiten verlinken (`[[Name.html]]`, mit Vorschlägen beim Tippen). Backlinks und das Anpassen von Links beim Umbenennen und Verschieben gelten für beide Typen. Dafür werden `src/lib/links.ts`, `src-tauri/src/vault.rs`, der Suchindex und `src/lib/dev-backend.ts` auf beide Endungen erweitert.
- [ ] Suche und Backlinks werten den sichtbaren Text von HTML-Seiten aus (ohne Tags, Skripte und Styles).
- [ ] Wird eine HTML-Seite außerhalb der App geändert, lädt die Anzeige neu.
- [ ] Die Browser-Vorschau zeigt HTML-Seiten über die Vite-Middleware (Arbeitsregel 8).
- [ ] Tests für Anlegen, Umbenennen und Verschieben (Kopfbereich, relative Pfade), Pfadprüfung des Schemas, Textauszug für die Suche, Links in beide Richtungen und die Prüfung der `postMessage`-Nachrichten.

### Etappe 11 – HTML-Seiten: Code-Editor

- [ ] Drei Ansichten: „Lesen“, „Code“ und „Geteilt“ (Code links, Vorschau rechts, auf schmalen Bildschirmen untereinander). Umschalten per Schaltflächen und Strg+E. Die zuletzt gewählte Ansicht wird gemerkt, eine neue HTML-Seite öffnet in „Geteilt“.
- [ ] Code-Editor mit CodeMirror 6: Syntaxhervorhebung (hell und dunkel), Zeilennummern, Einklappen, Suchen und Ersetzen, Autovervollständigung für HTML-Tags.
- [ ] Vereinfachte Ansicht: Der Editor zeigt nur den Inhalt von `<main>`. Ein Schalter „Ganze Datei“ zeigt alles. Fehlt `<main>`, wird immer die ganze Datei angezeigt.
- [ ] In „Geteilt“ aktualisiert sich die Vorschau kurz nach dem Tippen, ohne dass die Scrollposition springt.
- [ ] Automatisches Speichern wie bei Notizen. Tests belegen: Unveränderte Teile der Datei bleiben Zeichen für Zeichen gleich, auch in einer Datei mit CRLF-Zeilenenden und BOM. Die App ändert nur, was der Nutzer bearbeitet hat.
- [ ] Fehlerhaftes HTML (z. B. nicht geschlossene Tags) führt nie zu Datenverlust. Die Vorschau zeigt, was der Browser daraus macht.

### Etappe 12 – Baustein-Bibliothek: Grundbausteine

- [ ] `localist.css` und `localist.js` entstehen beim Build aus dem Quellcode der App (`src/bausteine/` und `tokens.css`). Beim Öffnen eines Vaults werden sie nach `.localist/bausteine/` geschrieben, wenn sie fehlen oder Version bzw. Inhalt abweichen (Versionsnummer in der Datei). Das Schema `localist-seite` liefert dieselbe gebündelte Fassung aus.
- [ ] Grundbausteine mit dem Markup aus der Tabelle im Speicherformat: Callout, Toggle, Tabelle, Checkliste, Spalten, Bild, Trennlinie, Code-Block und Seitenlink.
- [ ] Werkzeugleiste über dem Code-Editor und „/“-Menü im Code-Editor: Ein Klick fügt den Baustein sauber eingerückt an der Cursorposition ein. Die Autovervollständigung kennt alle Bausteine.
- [ ] Bearbeiten ohne Code: In „Lesen“ und „Geteilt“ zeigt jeder Baustein beim Überfahren ein Stift-Symbol. Es öffnet ein Formular, bei Tabellen einen Tabellen-Editor zum Hinzufügen und Entfernen von Zeilen und Spalten. Speichern ändert nur diesen Baustein im Code.
- [ ] Häkchen in Checklisten lassen sich in „Lesen“ setzen und werden in der Datei gespeichert.
- [ ] Die Beispielseite `beispiel-vault/Lernen/Bausteine.html` zeigt alle Bausteine. Per Doppelklick in Edge oder Chrome geöffnet sieht der Inhalt aus wie in „Lesen“ und ist interaktiv (Screenshots beider Fälle in `docs/screenshots/etappe-12/`).
- [ ] Tests: Einfügen erzeugt den erwarteten Code, Formulare ändern nur den betroffenen Baustein, der Text jedes Bausteins steht ohne Skript lesbar in der Datei.

### Etappe 13 – Lernen, Diagramme und eigene Bausteine

- [ ] Karteikarte: umdrehen per Klick, Fingertipp oder Leertaste.
- [ ] Kartenstapel: Lernmodus mit einer Karte nach der anderen und den Knöpfen „Gewusst“ und „Nochmal“. Nicht gewusste Karten kommen erneut dran, am Ende gibt es eine Auswertung.
- [ ] Quiz: Multiple-Choice-Fragen mit sofortiger Rückmeldung und Punktzahl.
- [ ] Diagramm: liest die Daten aus der enthaltenen `<table>`, wird als SVG gezeichnet, passt sich an hell und dunkel an und braucht keine Online-Bibliothek. Das Formular enthält einen Daten-Editor.
- [ ] Alle vier nutzen das Markup aus der Tabelle im Speicherformat und haben Formulare zum Bearbeiten ohne Code.
- [ ] Eigene Bausteine („Code-Speicher“): Markierten Code als eigenen Baustein speichern (Name und Beschreibung), siehe Speicherformat. Eigene Bausteine erscheinen in Werkzeugleiste und „/“-Menü. Ein Bereich „Bausteine“ in der Sidebar zeigt die ganze Bibliothek (eingebaute und eigene) mit Vorschau. Eigene Bausteine lassen sich bearbeiten, umbenennen und löschen.
- [ ] Hilfe-Ansicht in der App: alle eingebauten Bausteine mit kurzer Erklärung und Beispielcode zum Kopieren.
- [ ] Die Beispielseite `Bausteine.html` enthält auch die neuen Bausteine.
- [ ] Tests für die Lernlogik (Reihenfolge, Wiederholung, Auswertung), die Diagramm-Daten aus Tabellen und das Speichern und Laden eigener Bausteine.

### Etappe 14 – Notizbücher, Umwandeln und Export

- [ ] Ein Ordner lässt sich in ein Notizbuch umwandeln (legt `_notizbuch.yaml` an). Ein Ordner, der schon Datenbank ist, kann kein Notizbuch werden und umgekehrt.
- [ ] Die Notizbuch-Ansicht wirkt wie eine kleine Website: Inhaltsverzeichnis links, Seite rechts, „Zurück“ und „Weiter“ unten. Notizen erscheinen dort fertig dargestellt, wie HTML-Seiten in der abgeschotteten Anzeige. „Bearbeiten“ öffnet die Seite im passenden Editor.
- [ ] Die Reihenfolge lässt sich im Inhaltsverzeichnis per Drag & Drop ändern und wird in `_notizbuch.yaml` gespeichert. Neue Seiten erscheinen automatisch am Ende.
- [ ] „In HTML-Seite umwandeln“ (nach Rückfrage): wandelt eine Notiz um, auf Basis des mdast aus `src/markdown/` (nicht über das verlustbehaftete HTML von BlockNote). Überschriften, Absätze, Formatierungen, Listen, Checklisten, Zitate, Code, Bilder, Tabellen, Callouts (→ `<l-callout>`), Toggles (→ `<details>`) und `[[Links]]` (→ `<a>`) werden übernommen. `id`, Icon und Cover werden übernommen, alle weiteren Frontmatter-Felder werden zu `<meta name="localist-prop-<name>">`. Die `.md` kommt in den Papierkorb, Links im Vault werden auf die neue Datei angepasst. Eine Notiz in einem Datenbank-Ordner lässt sich nur nach Hinweis umwandeln, dass sie dann aus Tabelle, Kanban und Kalender verschwindet.
- [ ] „Als eigenständige HTML-Datei exportieren“: Speichern-Dialog. Die exportierte Datei enthält CSS, Skript und Bilder eingebettet und funktioniert ohne Vault.
- [ ] Tests für `_notizbuch.yaml`, die Umwandlung (je Element) und den Export.

### Etappe 15 – Version 2.0

- [ ] Version 2.0.0 in `package.json`, `tauri.conf.json` und `Cargo.toml`. Die Windows-Installer werden gebaut, die Pfade sind genannt.
- [ ] Android: Die APK wird gebaut. Im Emulator geprüft und mit `adb`-Befehlen samt Ausgabe belegt (Installation, Screenshots per `adb exec-out screencap`): HTML-Seiten und Notizbücher lassen sich lesen, Karteikarten und Quiz per Fingertipp bedienen, die Code-Ansicht ist nutzbar (Werkzeugleiste scrollbar).
- [ ] Die Klickliste „Version 1.0“ und eine Klickliste „Version 2.0“ (HTML-Seite anlegen, Code bearbeiten, jeder Baustein, eigener Baustein, Notizbuch, Umwandeln, Export) sind in `FORTSCHRITT.md` abgehakt.
- [ ] Keine Fehler bei `npx tsc --noEmit`. `git grep -nE "TODO|FIXME" -- src src-tauri/src` liefert nichts.
- [ ] `README.md` und `ANLEITUNG.md` sind aktualisiert, mit einem Abschnitt „Neu in Version 2.0“ und einer kurzen Einführung in HTML-Seiten und Bausteine für Einsteiger.

## Zukunft (noch nicht umsetzen)

- Anbindung an den Google Kalender über die Google Calendar API: zuerst Google-Termine im Kalender anzeigen, später in beide Richtungen. Deshalb gelten das einheitliche Datumsformat und die feste `id` pro Eintrag.
- HTML-Seiten als Datenbank-Einträge.
- Lernfortschritt von Kartenstapeln speichern (Wiederholung nach Zeitplan).
- Netzwerkzugriff für einzelne HTML-Seiten (z. B. eingebettete Videos), nur nach ausdrücklicher Freigabe pro Seite.

## Was die App nicht macht

- Keine Accounts, kein eigener Server, keine Telemetrie.
- Keine Inhalte in einer eigenen Datenbank, nur Dateien im Vault.
- Keine Inhalte, Logos oder Grafiken von Notion.

## Aktueller Stand

Steht in `FORTSCHRITT.md`.
