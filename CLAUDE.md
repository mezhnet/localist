# Localist – Projektbeschreibung für Claude Code

> Diese Datei ist die Projektbeschreibung für Claude Code und wird in jeder Sitzung automatisch gelesen.
> Ändere sie nicht, außer der Nutzer bittet ausdrücklich darum. Den Fortschritt dokumentierst du in `FORTSCHRITT.md` (siehe „Fortschrittsdatei“ unten).

## Ziel

Localist ist eine App für Windows (und Android) für Notizen, Projekte und interaktive Seiten. Sie verbindet:

- **Speicherung wie Obsidian:** Alles liegt als normale Dateien in einem Ordner („Vault“), den der Nutzer selbst wählt. Jede Datei lässt sich jederzeit auch ohne die App öffnen.
- **Aussehen inspiriert von Notion:** clean, ruhig, viel Weißraum. Notion ist Vorbild für den Stil, nicht für jede Funktion. Eigene Elemente sind ausdrücklich erwünscht, solange das Gesamtbild aufgeräumt bleibt. Keine Logos, Grafiken oder Texte von Notion übernehmen.
- **Lokale Website:** Neben normalen Notizen gibt es HTML-Seiten. Sie werden mit Bausteinen wie Karteikarten, Diagrammen und Tabellen gebaut und im Lesemodus als fertige, interaktive Seite angezeigt.
- **Local-first:** keine Accounts, kein Server, keine Telemetrie, funktioniert komplett offline. Einzige Ausnahme: Nach Klick auf ‚Nach Updates suchen' fragt die App GitHub Releases ab. Das passiert nie automatisch, und außer der Anfrage selbst werden keine Daten gesendet.

## Versionen

- **Version 1.0 (Etappen 0–8): abgeschlossen.** Block-Editor für Markdown-Notizen, Eigenschaften, Datenbanken mit Tabelle, Kanban und Kalender, Suche, Strg+P, Vorlagen, Backlinks, Windows-Installer und Android-APK. Details, Nachweise und Entscheidungen stehen in `FORTSCHRITT.md`.
- **Version 2.0 (Etappen 9–15): abgeschlossen.** Neues Design, zweiter Seitentyp „HTML-Seite“ mit Code-Editor und Lesemodus, Baustein-Bibliothek, Notizbücher.
- **Version 2.1 (Etappen 16–20): abgeschlossen.** Ordnername „Localist“, bessere Bedienung, neues Design nach der Vorlage in `docs/design/`, Handy-Design. Auftrag mit Design-Vorlage und Befunden: `docs/design/auftrag-version-2.1.md`.
- **Version 2.2 (Etappe 21): abgeschlossen.** Updates über GitHub Releases. Auftrag: `docs/auftrag-version-2.2.md`.
- **Version 2.3 (Etappe 22): in Arbeit.** Ziehen und Ablegen auf PC und Handy. Auftrag: `docs/auftrag-version-2.3.md`.

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

- **Die Design-Vorlage in `docs/design/` ist verbindlich** (Bilder für PC und Handy, Erklärung in `docs/design/auftrag-version-2.1.md`). Was sie nicht zeigt, wird im selben Stil gestaltet.
- Ruhig und aufgeräumt: viel Weißraum, zurückhaltende Farben, eine Akzentfarbe, dezente Linien statt schwerer Kästen.
- Die Akzentfarbe ist wählbar (Orange, Blau, Grün, Lila), Standard ist Orange.
- Ein Design-System: Farben, Abstände, Schriftgrößen, Radien und Schatten sind CSS-Variablen in `src/styles/tokens.css`. Komponenten nutzen nur diese Variablen.
- Die Modi Hell, Dunkel und Schwarz sind gleichwertig.
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
7. **Nichts kaputt machen.** Alle Funktionen der Versionen 1.0 und 2.0 bleiben erhalten. Das heißt: mindestens 297 Tests in `npm test` und 42 in `cargo test` laufen weiter grün (Stand 2.0), keiner wird gelöscht, und die festen Klicklisten „Version 1.0“ (Notiz bearbeiten, Callout, Link, Eigenschaft, Tabelle, Kanban, Kalender, Suche, Strg+P, Vorlage, Backlinks, Hell/Dunkel) und „Version 2.0“ (HTML-Seite anlegen, Code bearbeiten, jeder Baustein, eigener Baustein, Notizbuch, Umwandeln, Export) in `FORTSCHRITT.md` sind in jeder Etappe in der Browser-Vorschau abgehakt. Bestehende Tests nur ändern, wenn sich das gewünschte Verhalten bewusst ändert, und die Begründung in `FORTSCHRITT.md` notieren.
8. **Oberfläche ansehen.** Neue oder geänderte Oberflächen in der Browser-Vorschau prüfen (`npm run dev`, nutzt `src/lib/dev-backend.ts`). Für HTML-Seiten liefert eine Vite-Middleware `beispiel-vault/` mit denselben Regeln und Headern aus wie das Schema `localist-seite`. Screenshots unter `docs/screenshots/etappe-N/` ablegen, damit der Nutzer das Ergebnis sehen kann. Ist ein Screenshot technisch nicht möglich, das in `FORTSCHRITT.md` vermerken.
9. **Nur im Projektordner arbeiten.** Zum Testen den Beispiel-Vault im Projekt verwenden (`beispiel-vault/`) und ihn um Beispiele für neue Funktionen ergänzen. Nie echte Nutzerdaten verändern.
10. **Diese Datei nicht überschreiben.**
11. **Fehlt etwas, das der Nutzer selbst tun muss** (Programm installieren, Systemeinstellung, Geschmacksentscheidung), genau sagen was und wie, es in `FORTSCHRITT.md` unter „Offene Probleme“ notieren und anhalten. Fehlende Werkzeuge dürfen nach Rückfrage per `winget` installiert werden.

## Sparsam arbeiten (Vorrang vor allen Aufträgen und vor den Arbeitsregeln oben)

- Umsetzen in der Hauptsitzung, ohne Workflows und ohne Arbeitsagenten in eigenen Arbeitskopien. Funde behebt die Hauptsitzung selbst.
- Unteragenten nur für die unabhängige Prüfung: höchstens 2, nur lesend, Sonnet, einmal pro Auftrag in der Runde, die fertig aussieht.
- Prüfrunden: höchstens 3, Schluss bei der ersten Runde ohne Funde A/B. Regression über automatische Tests und scripts/klickliste.mjs, keine alten Prüflisten von Hand.
- Lesen zu Beginn und nach Komprimierung: nur CLAUDE.md, der aktuelle Auftrag und die Stand-Zeile plus Hinweise aus FORTSCHRITT.md. Archiv, ANLEITUNG.md und Design-Dokumente nur gezielt per grep und offset/limit.
- Tests während der Arbeit nur für betroffene Dateien. Voller Lauf einmal pro Phase und pro Runde. Ausgaben in Datei, nur tail -20 lesen.
- Screenshots nur von etwa 10 Kernbildschirmen ansehen. Design-Regeln automatisch testen.
- Neue Sitzung nach jeder Phase, spätestens ab etwa 150.000 Tokens Kontext.
- FORTSCHRITT.md unter 20 KB halten: Einträge ein bis drei Zeilen, Commit-Hash statt Dateilisten. Abgeschlossene Versionen beim Start eines neuen Auftrags nach archiv/ verschieben.

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

### Version 2.0 – abgeschlossen

Etappe 9 Neues Design · 10 HTML-Seiten: Grundlage und sichere Anzeige · 11 HTML-Seiten: Code-Editor · 12 Baustein-Bibliothek: Grundbausteine · 13 Lernen, Diagramme und eigene Bausteine · 14 Notizbücher, Umwandeln und Export · 15 Version 2.0. Kriterien und Nachweise stehen in `FORTSCHRITT.md`.

### Version 2.1 – abgeschlossen

Auftrag, Design-Vorlage und Befunde zu jeder Etappe: `docs/design/auftrag-version-2.1.md`. Zu Beginn jeder dieser Etappen erneut lesen.

### Etappe 16 – Ordnername „Localist“

- [ ] `git grep -n -i "localprojekt"` ist geprüft, die Ausgabe steht im Chat. Jede Stelle, die den Ordner- oder Projektnamen meint, sagt jetzt „Localist“. Übrig sind nur die Übernahme-Kennungen und historische Einträge in `FORTSCHRITT.md`, jeweils begründet.
- [ ] Keine versionierte Datei und keine Datei unter `src-tauri/gen/android/` (außer Build-Ausgaben) enthält einen absoluten Pfad mit `LocalProjekt`.
- [ ] Die Vorbereitung ist committet. Danach hältst du an und erklärst mir Schritt für Schritt, was ich tun muss: alles schließen, was den Ordner benutzt (Claude Code, VS Code, Terminals, `npm run dev`, Localist, Android-Emulator), den Ordner im Explorer umbenennen, den Ordner in der Claude-App neu verbinden und Claude Code im neuen Ordner starten. Notiere das unter „Offene Probleme“.
- [ ] Nach dem Umbenennen läuft alles im neuen Ordner: `npm test`, `cargo test`, `npx tsc --noEmit`, `npm run tauri build` (Rust baut einmal komplett neu, weil sich die Pfade geändert haben), die Android-APK baut wie in Etappe 15, und `npm run dev` startet. Die alten Build-Reste `localprojekt*` sind entfernt (`cargo clean` ist erlaubt).

### Etappe 17 – Bedienung verbessern

#### Tab und Shift+Tab

- [ ] Zuerst nachgestellt (Browser-Vorschau, echte Tastatur): Was passiert heute bei Tab und Shift+Tab in Absatz, Überschrift, Liste, Checkliste, nummerierter Liste, Callout und Toggle, mit und ohne Markierung, im ersten Block und im Code-Editor? Das Ergebnis steht als Tabelle in `FORTSCHRITT.md`.
- [ ] Notizen: Tab rückt den aktuellen bzw. alle markierten Blöcke ein, Shift+Tab rückt aus, auch bei offener Formatierungsleiste. Der Fokus verlässt den Editor nie (auch nicht im ersten Block oder ganz links). Cursor und Markierung bleiben an derselben Textstelle, die Seite scrollt nicht.
- [ ] Notizen: Eingerückt wird nur, was Markdown auch speichern kann (Listenpunkte, Checklisten, nummerierte Listen und Absätze unter einem Listenpunkt). In allen anderen Fällen bleibt der Block ruhig stehen, ohne Sprung und ohne Fokusverlust. Alles Eingerückte ist nach Speichern und Neuladen genauso eingerückt. Dafür gibt es Roundtrip-Tests.
- [ ] Notizen: Ein- und Ausrücken hat einen kurzen, ruhigen Übergang (höchstens 150 ms, Werte aus `tokens.css`, aus bei `prefers-reduced-motion`). Einzug und Führungslinie kommen aus `tokens.css`.
- [ ] HTML-Seiten: Tab rückt die Zeile bzw. alle markierten Zeilen um eine Stufe ein (dieselbe Einrückung wie bei eingefügten Bausteinen), Shift+Tab rückt aus, auch wenn der Cursor mitten in der Zeile steht. Escape und danach Tab verlässt den Editor, wie es CodeMirror für die Tastaturbedienung vorsieht.
- [ ] Tests für beide Editoren.

#### „Im Explorer öffnen“

- [ ] Rechtsklick auf eine Seite (Notiz oder HTML-Seite) → „Im Explorer öffnen“: Der Windows-Explorer zeigt den Ordner und markiert die Datei. Auf einem Ordner öffnet derselbe Eintrag den Ordner selbst. Im Menü „Vault“ gibt es „Vault im Explorer öffnen“.
- [ ] Umgesetzt über einen neuen Rust-Befehl, der den Pfad wie `vault::resolve` prüft (nur Pfade im geöffneten Vault) und dann den Explorer öffnet. Die Capabilities werden dafür nicht erweitert. `cargo test` prüft die Pfadprüfung.
- [ ] Auf Android ist der Eintrag ausgeblendet. In der Browser-Vorschau zeigt `src/lib/dev-backend.ts` stattdessen eine Meldung. Ein Vitest-Test prüft den Menüeintrag.
- [ ] In der gebauten `localist.exe` geprüft: Ein Explorer-Fenster mit markierter Datei öffnet sich (Nachweis z. B. über den Fenstertitel aus einem Skript).

#### HTML-Seiten: Code links oder rechts, verschiebbare Trennlinie

- [ ] Einstellung „Code-Editor links / rechts“ in den Einstellungen und als kleiner Knopf „Seiten tauschen“ in der Ansicht „Geteilt“. Sie wirkt sofort und wird gemerkt. Auf schmalen Bildschirmen (untereinander) bedeutet links „oben“ und rechts „unten“.
- [ ] In „Geteilt“ lässt sich die Trennlinie mit Maus und Finger verschieben. Jede Seite bleibt mindestens etwa 280 px breit, ein Doppelklick setzt auf 50 : 50 zurück. Mit der Tastatur bedienbar (Fokus, Pfeiltasten, `role="separator"` mit `aria-valuenow`). Das Verhältnis wird gemerkt.
- [ ] Beim Ziehen ruckelt nichts, es wird kein Text markiert, und die Vorschau behält ihre Scrollposition.
- [ ] Tests für Einstellung, Begrenzung und Speicherung des Verhältnisses und die Tastatur, dazu ein Prüfskript mit echter Maus wie `scripts/vorschau-scroll-pruefung.mjs`.

#### Seite „Bausteine“ breiter

- [ ] Auf dem PC nutzt die Seite „Bausteine“ (Bibliothek und Hilfe) die verfügbare Breite: Liste links, die Vorschau füllt den Rest und die Fensterhöhe. Eine Höchstbreite greift erst bei sehr breiten Fenstern. Die Hilfe stellt Erklärung und Beispielcode nebeneinander, wenn Platz ist.
- [ ] Screenshots bei 1280 × 800, 1920 × 1080 und 360 × 740.
- [ ] Android im Emulator geprüft (`adb`-Befehle mit Ausgabe, Screenshots per `adb exec-out screencap`): Bibliothek und Hilfe sind lesbar, Liste und Vorschau bedienbar, nichts ist abgeschnitten oder verrutscht. Gefundene Fehler sind behoben.

### Etappe 18 – Neues Design, Teil 1: Grundlagen, Fenster und Seitenleiste

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

### Etappe 19 – Neues Design, Teil 2: Reiter und Inhalte

- [ ] Reiter wie in der Vorlage. Ein Klick in der Seitenleiste, auf der Startseite, in Strg+P oder auf einen Link öffnet die Seite im aktuellen Reiter. Strg+Klick oder Mittelklick öffnet einen neuen Reiter. Strg+T öffnet einen neuen Reiter mit der Startseite, Strg+W schließt, Strg+Tab und Strg+Umschalt+Tab wechseln, Mittelklick auf einen Reiter schließt ihn. Reiter folgen Umbenennen, Verschieben, Umwandeln und Löschen. Jeder Reiter merkt sich seine Scrollposition. Vor jedem Wechsel ist gespeichert, es geht nichts verloren. Die offenen Reiter werden pro Vault im App-Speicher gemerkt. Auf dem Handy gibt es keine Reiterleiste.
- [ ] Startseite nach `01-desktop-startseite-hell.png`: Datum, Begrüßung nach Tageszeit, „Schnell notieren …“ (Enter legt eine Notiz in der Vault-Wurzel an: erste Zeile = Titel, Rest = Inhalt, Name eindeutig und ohne ungültige Zeichen; Umschalt+Enter macht eine neue Zeile; ein leeres Feld macht nichts), Knöpfe für Datenbank, Vorlage und „+ Notiz“, „Zuletzt bearbeitet“ als Tabelle mit relativer Zeit, „Alle Seiten“ (alle Seiten nach Änderungszeit) und Favoriten als Chips.
- [ ] Seitenkopf: Pfad, Speicherstatus („Speichert …“, „gerade eben gespeichert“, „vor 3 Min. gespeichert“, Fehler deutlich sichtbar), Stern für Favorit und „…“ mit denselben Aktionen wie das Kontextmenü, inklusive „Im Explorer öffnen“.
- [ ] Notiz nach `02-desktop-notiz-schwarz.png`: Titel, Eigenschaften (Chips für Mehrfachwerte, Datumswerte in Monospace, „+ Eigenschaft hinzufügen“), Callout, Toggle, Zitat, Code, Checkliste und Tabelle im Stil der Vorlage. „+“ und Ziehgriff neben dem Block; „/“ und „+“ öffnen das Menü „Baustein wählen …“ mit Filterfeld und Symbol-Kästchen.
- [ ] Tabellen in Notizen: Markdown-Tabellen erscheinen im Editor als Tabelle und lassen sich bearbeiten (Zellen, Zeilen und Spalten hinzufügen und entfernen); „Tabelle“ steht im Menü. Gespeichert wird weiterhin eine normale Markdown-Tabelle, die Obsidian anzeigt. Was der Editor nicht verlustfrei abbilden kann, bleibt wie bisher unveränderter Markdown-Text. Roundtrip-Tests für Ausrichtung, Formatierung in Zellen, `\|` in Zellen, leere Zellen, Tabelle direkt nach Text und Umlaute.
- [ ] Im neuen Stil, in allen drei Modi: HTML-Seiten (Lesen, Code, Geteilt, Werkzeugleiste, Formulare, Stift-Symbol), Datenbank-Ansichten (Tabelle, Kanban, Kalender), Notizbuch, Seite „Bausteine“, Strg+P, Volltextsuche, Vorlagen-Auswahl, Dialoge, Menüs, Meldungen und Einstellungen.
- [ ] Die Bausteine in `localist.css` sehen aus wie die Elemente der Notiz in der Vorlage (Callout, Tabelle, Checkliste usw.), damit Notizen und HTML-Seiten gleich wirken. Per Doppelklick im Browser bleibt alles lesbar und interaktiv (wie in Etappe 12 geprüft).
- [ ] Vergleich mit der Vorlage: Screenshots von Startseite und Notiz mit den Inhalten der Vorlage (eigener Vault für das Screenshot-Skript, gleiche Fenstergröße) liegen in `docs/screenshots/etappe-19/`. Anordnung, Abstände, Größen und Farben stimmen mit `01-…` und `02-…` überein, Abweichungen sind in `FORTSCHRITT.md` begründet. Dazu Screenshots aller übrigen Ansichten in Hell, Dunkel und Schwarz.

### Etappe 20 – Handy und Version 2.1

- [ ] Untere Navigationsleiste nach `03-handy-startseite-hell.png`: Start, Suchen, „+“ (Neu-Menü), Seiten (Ordnerbaum mit Favoriten) und Einstellungen. Sie berücksichtigt `safe-area-inset-bottom` und ersetzt den Menü-Knopf oben. Die Handy-Startseite sieht aus wie in der Vorlage.
- [ ] Handy-Notiz nach `04-handy-notiz-schwarz.png`: Kopf mit Zurück-Pfeil und Ordnername, Stern und „…“; Eigenschaften als Chips in einer Zeile. Beim Schreiben steht über der Tastatur eine Leiste mit „+“ (Baustein wählen), Checkliste, Callout, Toggle, Bild und „Fertig“ (schließt die Tastatur). Die Leiste verdeckt nie den Cursor.
- [ ] Handy-Einstellungen → Darstellung nach `05-handy-darstellung-dunkel.png`.
- [ ] Ab 360 px Breite ist alles bedienbar, Tippflächen sind mindestens 44 px groß.
- [ ] Version 2.1.0 in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json` und `src-tauri/Cargo.toml`. Windows-Installer und APK sind gebaut, die Pfade stehen im Chat.
- [ ] Android im Emulator mit `adb`-Befehlen samt Ausgabe und Screenshots geprüft: Startseite, Navigationsleiste, Notiz bearbeiten mit Leiste und „Fertig“, Darstellung (alle drei Modi und eine andere Akzentfarbe), Seite „Bausteine“, HTML-Seite in „Lesen“ und „Code“.
- [ ] Neue Klickliste „Version 2.1“ in `FORTSCHRITT.md` (Tab/Shift+Tab in Liste und Code, „Im Explorer öffnen“ in der Vorschau-Simulation, Seitenleiste rechts und eingeklappt, Code rechts und Trennlinie ziehen, Reiter öffnen/wechseln/schließen, Schnell notieren, Modus Schwarz mit Akzent Blau, Tabelle in einer Notiz bearbeiten) ist abgehakt, ebenso „Version 1.0“ und „Version 2.0“, möglichst automatisch mit `scripts/klickliste.mjs` (neues Argument `2.1`).
- [ ] `README.md` und `ANLEITUNG.md` haben einen Abschnitt „Neu in Version 2.1“ für Einsteiger, die Pfade zeigen auf `Localist`. `git grep -nE "TODO|FIXME" -- src src-tauri/src` liefert nichts.

### Version 2.2 – abgeschlossen

Auftrag mit allen Details: `docs/auftrag-version-2.2.md`.

### Etappe 21 – Updates über GitHub Releases

- [ ] Phase 0 erledigt: `FORTSCHRITT.md` ist unter 20 KB, das Archiv liegt in `archiv/`, `CLAUDE.md` ist ergänzt und committet.
- [ ] „Über Localist“ mit Version und „Nach Updates suchen“ auf PC und Handy, alle Zustände umgesetzt und getestet, kein Netz ohne Klick, Speichern vor dem Installieren.
- [ ] `scripts/version.mjs` funktioniert. Die Version ist 2.2.0.
- [ ] `release.yml` ist gültig. Ein lokaler Release-Build erzeugt die `.sig`-Datei. Ein normales `npm run tauri build` läuft ohne Schlüssel.
- [ ] `ANLEITUNG-RELEASE.md` ist vorhanden. Kein privater Schlüssel und kein Token im Repo.
- [ ] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten abgehakt.
- [ ] `README.md`/`ANLEITUNG.md` haben „Neu in Version 2.2“ (kurz). In „Offene Probleme“ steht der Hinweis auf die Schritte für Emre aus `ANLEITUNG-RELEASE.md`.

### Version 2.3 – in Arbeit

Auftrag mit allen Details: `docs/auftrag-version-2.3.md`.

### Etappe 22 – Ziehen und Ablegen auf PC und Handy

- [ ] Phase 0 erledigt: Version 2.2 liegt im Archiv, `CLAUDE.md` ist ergänzt und committet.
- [ ] Phase 1: Die Tabelle „Ziehen vorher“ (PC-EXE und Android) steht in `FORTSCHRITT.md`.
- [ ] Am PC funktioniert Ziehen in der gebauten `localist.exe` mit echter Maus: Seitenleiste, Kanban, Ziehgriff, Notizbuch-Reihenfolge (Nachweis im Chat).
- [ ] Ziehen in der Seitenleiste mit Hervorhebung, Aufklappen beim Verweilen, Auto-Scroll, Escape, Namenskonflikt-Meldung und „Rückgängig“, getestet.
- [ ] Auf dem Handy greift langes Drücken eine Zeile und lässt sich ablegen. Scrollen, Tippen und Kontextmenü funktionieren wie vorher. Kanban und Notizbuch-Reihenfolge gehen auch per Finger. Nachweis mit `adb` im Chat.
- [ ] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten 1.0, 2.0, 2.1 und 2.3 abgehakt.
- [ ] Version 2.3.0 gesetzt, „Neu in Version 2.3“ in `README.md` und `ANLEITUNG.md`.

## Zukunft (noch nicht umsetzen)

- Anbindung an den Google Kalender über die Google Calendar API: zuerst Google-Termine im Kalender anzeigen, später in beide Richtungen. Deshalb gelten das einheitliche Datumsformat und die feste `id` pro Eintrag.
- HTML-Seiten als Datenbank-Einträge.
- Lernfortschritt von Kartenstapeln speichern (Wiederholung nach Zeitplan).
- Netzwerkzugriff für einzelne HTML-Seiten (z. B. eingebettete Videos), nur nach ausdrücklicher Freigabe pro Seite.

## Was die App nicht macht

- Keine Accounts, kein eigener Server, keine Telemetrie. Einzige Ausnahme: Nach Klick auf ‚Nach Updates suchen' fragt die App GitHub Releases ab. Das passiert nie automatisch, und außer der Anfrage selbst werden keine Daten gesendet.
- Keine Inhalte in einer eigenen Datenbank, nur Dateien im Vault.
- Keine Inhalte, Logos oder Grafiken von Notion.

## Aktueller Stand

Steht in `FORTSCHRITT.md`.
