# Localist

Localist ist eine App für Windows und Android für Notizen, Projekte und interaktive Lernseiten im Stil von Notion.
Alle Seiten liegen als normale Dateien in einem Ordner („Vault“), den du selbst wählst – wie bei Obsidian. Kein Konto,
kein Server, keine Telemetrie, alles funktioniert offline.

- Block-Editor für Notizen (`.md`) mit Slash-Menü, Callouts, Toggles und `[[Links]]`
- Eigenschaften im Frontmatter, Datenbanken mit Tabelle, Kanban und Kalender
- Volltextsuche, Schnellsuche (Strg+P), Vorlagen, Favoriten und Backlinks
- HTML-Seiten (`.html`) mit Code-Editor und Bausteinen wie Karteikarten, Quiz und Diagrammen
- Notizbücher: ein Ordner als kleine Website mit Inhaltsverzeichnis

## Neu in Version 2.0

- **Neues Design** in Hell und Dunkel mit Startseite, Favoriten und „Neu“-Menü, bedienbar ab Handy-Breite.
- **HTML-Seiten** als zweiter Seitentyp: Ansichten „Lesen“, „Code“ und „Geteilt“ (Strg+E), Code-Editor mit
  Syntaxhervorhebung, Suchen und Ersetzen. Localist ändert im Code nur, was du bearbeitest.
- **Bausteine:** Callout, Toggle, Tabelle, Checkliste, Spalten, Bild, Trennlinie, Code-Block, Seitenlink,
  Karteikarte, Kartenstapel mit Lernmodus, Quiz und Diagramm. Einfügen per Werkzeugleiste oder `/`, bearbeiten ohne
  Code über das Stift-Symbol. Eigene Bausteine lassen sich speichern und wiederverwenden.
- **Notizbücher** mit Inhaltsverzeichnis, „Zurück“ und „Weiter“, Reihenfolge per Drag & Drop.
- **Umwandeln und Export:** Notizen in HTML-Seiten umwandeln, Seiten als eigenständige HTML-Datei exportieren.
- **Verschieben** von Seiten und Ordnern per Drag & Drop, Links werden angepasst.
- **Abgeschottete Anzeige:** HTML-Seiten haben keinen Zugriff auf Internet, Dateien oder die App.

## HTML-Seiten in einer Minute

Eine HTML-Seite besteht aus ganz normalem HTML. Bausteine sind Tags, die mit `l-` beginnen, und der Text steht direkt
in der Datei – auch ohne Localist bleibt alles lesbar:

```html
<l-callout typ="tipp">DNS übersetzt Namen wie example.com in IP-Adressen.</l-callout>
<l-karteikarte>
  <l-frage>Welchen Port nutzt DNS?</l-frage>
  <l-antwort>Port 53</l-antwort>
</l-karteikarte>
```

In Localist wird daraus ein farbiger Hinweis und eine Karteikarte, die sich per Klick umdreht. Per Doppelklick im
Explorer geöffnet, funktioniert die Seite auch in Edge oder Chrome. Mehr dazu in Abschnitt 9 der
[ANLEITUNG.md](ANLEITUNG.md).

Installation, Bedienung, Entwicklung, Tests und Build stehen in [ANLEITUNG.md](ANLEITUNG.md), der Projektstand in
[FORTSCHRITT.md](FORTSCHRITT.md).
