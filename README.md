# Localist

Localist ist eine App für Windows und Android für Notizen, Projekte und interaktive Lernseiten im Stil von Notion.
Alle Seiten liegen als normale Dateien in einem Ordner („Vault“), den du selbst wählst – wie bei Obsidian. Kein Konto,
kein Server, keine Telemetrie, alles funktioniert offline.

- Block-Editor für Notizen (`.md`) mit Slash-Menü, Callouts, Toggles und `[[Links]]`
- Eigenschaften im Frontmatter, Datenbanken mit Tabelle, Kanban und Kalender
- Volltextsuche, Schnellsuche (Strg+P), Vorlagen, Favoriten und Backlinks
- HTML-Seiten (`.html`) mit Code-Editor und Bausteinen wie Karteikarten, Quiz und Diagrammen
- Notizbücher: ein Ordner als kleine Website mit Inhaltsverzeichnis

## Neu in Version 2.3.1

- **Updates auf dem Handy:** „Nach Updates suchen“ gibt es jetzt auch auf Android (Einstellungen → „Über Localist“).
  Ist eine neue Version da, erscheint sofort **„Jetzt installieren“**; Localist lädt die APK und öffnet den Installer
  von Android. Gefragt wird nur nach dem Klick.
- **Signierte APK an jedem Release:** GitHub baut die APK bei jedem Release selbst (etwa 8 MB). Von 2.3.0 aus einmal
  die alte App deinstallieren und die neue installieren, danach gehen Updates direkt in der App.

## Neu in Version 2.3

- **Ziehen und Ablegen geht wieder – auch in der installierten App und auf dem Handy:** Seiten und Ordner in der
  Seitenleiste in einen anderen Ordner ziehen, Kanban-Karten in eine andere Spalte, Einträge im Notizbuch umsortieren.
  Am PC mit gedrückter Maustaste, auf dem Handy durch langes Drücken (die Zeile hebt sich an, dann ziehen).
- **Beim Ziehen:** Das Ziel ist farbig markiert, ein zugeklappter Ordner klappt nach kurzem Verweilen auf, die Liste
  scrollt am Rand mit, **Escape** bricht ab. Gibt es im Ziel schon eine Seite mit demselben Namen, wird nichts
  verschoben. Nach dem Verschieben erscheint eine Meldung mit **„Rückgängig“**; Links passen sich jeweils an.

## Neu in Version 2.2

- **Nach Updates suchen:** Unter Windows in den Einstellungen bei „Über Localist“. Erst nach dem Klick fragt Localist
  bei GitHub Releases nach einer neuen Version – nie von selbst, und außer dieser Anfrage wird nichts gesendet. Ein
  Update lässt sich direkt installieren; Localist speichert vorher alles und startet danach neu.
- **Auf dem Handy** öffnet „Neue Versionen auf GitHub ansehen“ die Releases-Seite im Browser.
- **Neue Versionen** baut eine GitHub Action, sobald ein Versions-Tag hochgeladen wird (`node scripts/version.mjs
  X.Y.Z`, dann `git push --follow-tags`). Einrichten Schritt für Schritt: [ANLEITUNG-RELEASE.md](ANLEITUNG-RELEASE.md).

## Neu in Version 2.1

- **Neues Aussehen:** ruhiges Design in den Modi **Hell, Dunkel und Schwarz** (echtes Schwarz für OLED-Displays) mit
  „Wie System“ und vier Akzentfarben (Orange, Blau, Grün, Lila), neue Schriften, eigener Fensterrahmen ohne
  Windows-Titelleiste. Die **Seitenleiste** steht links oder rechts und lässt sich mit `Strg+.` einklappen.
- **Reiter** wie im Browser: Strg+Klick oder Mittelklick öffnet eine Seite in einem neuen Reiter, `Strg+T`, `Strg+W`
  und `Strg+Tab` wie gewohnt. Die offenen Reiter merkt sich Localist.
- **Startseite** mit „Schnell notieren …“: Tippen und Enter drücken legt sofort eine Notiz an.
- **Seitenkopf** mit Pfad, Speicherstatus („gerade eben gespeichert“), Stern für Favoriten und „…“.
- **Tabellen in Notizen** lassen sich direkt bearbeiten (Zeilen und Spalten hinzufügen und entfernen); gespeichert
  wird weiterhin eine normale Markdown-Tabelle.
- **Tab und Umschalt+Tab** rücken Listen ein und aus, auch im Code-Editor der HTML-Seiten.
- **„Im Explorer öffnen“** im Rechtsklick-Menü zeigt die Datei im Windows-Explorer.
- **HTML-Seiten:** in „Geteilt“ Code links oder rechts und eine Trennlinie zum Verschieben.
- **Auf dem Handy:** unten eine Navigationsleiste (Start, Suchen, „+“, Seiten, Einstellungen), beim Schreiben eine
  Leiste über der Tastatur mit „Fertig“, große Tippflächen (mindestens 44 px) und eigene Einstellungsseiten.
- Der Projektordner heißt jetzt `Localist` (`C:\Users\emre\Documents\eigen_apps\Localist`).

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
