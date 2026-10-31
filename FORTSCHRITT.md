# Fortschritt

## Aktueller Stand
- Etappe: 21 – Updates über GitHub Releases (Version 2.2, Auftrag `docs/auftrag-version-2.2.md`). Version 2.1 (Etappen 16–20) und der Nachtrag „Android-Statusleiste“ sind abgeschlossen, Nachweise in `archiv/FORTSCHRITT-bis-2.1.md`.
- Zuletzt aktualisiert: 2026-10-31 09:30
- Nächster Schritt: Phase 1 – Update-Funktion in der App (Plugins `tauri-plugin-updater`/`-process`, `capabilities/desktop.json`, „Über Localist“ in den Einstellungen, Simulation in `dev-backend.ts`, `scripts/version.mjs`).
- Hinweise für spätere Sitzungen: (a) Handy = schmaler Bildschirm unter 769 px (`useSchmal()` in `Reiterleiste.tsx`, Klasse `is-handy` am `.workspace`), Navigationsleiste `src/components/Navigationsleiste.tsx`, Leiste über der Tastatur `src/components/Tastaturleiste.tsx`, Handy-Einstellungen `HandyEinstellungen` in `Dialogs.tsx`. (b) Prüfskripte: `scripts/handy-pruefung.mjs` (360 × 740, Tippflächen ≥ 44 px, auch im iframe), `scripts/vorlage-vergleich.mjs … handy` (Vorlagen 03–05), `scripts/android-handy-pruefung.mjs` und `scripts/android-statusleiste-pruefung.mjs` (Emulator, nur mit `ANDROID_SERIAL`), `scripts/klickliste.mjs … 1.0|2.0|2.1`. (c) Fremden Emulator „Kartei_Test“ (`emulator-5554`) nie anfassen, eigenen „Medium_Phone_API_37.0“ auf Port 5556 starten. (d) Nach einem Versionswechsel `npm run build`, damit die gebündelten Bausteine die neue Version tragen. (e) Bash-Heredocs verschlucken `\\`: Umbau-Skripte mit dem Write-Werkzeug schreiben.

## Fertig-Kriterien der aktuellen Etappe
- [x] Phase 0 erledigt: `FORTSCHRITT.md` ist unter 20 KB, das Archiv liegt in `archiv/`, `CLAUDE.md` ist ergänzt und committet.
- [ ] „Über Localist“ mit Version und „Nach Updates suchen“ auf PC und Handy, alle Zustände umgesetzt und getestet, kein Netz ohne Klick, Speichern vor dem Installieren.
- [ ] `scripts/version.mjs` funktioniert. Die Version ist 2.2.0.
- [ ] `release.yml` ist gültig. Ein lokaler Release-Build erzeugt die `.sig`-Datei. Ein normales `npm run tauri build` läuft ohne Schlüssel.
- [ ] `ANLEITUNG-RELEASE.md` ist vorhanden. Kein privater Schlüssel und kein Token im Repo.
- [ ] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten abgehakt.
- [ ] `README.md`/`ANLEITUNG.md` haben „Neu in Version 2.2“ (kurz). In „Offene Probleme“ steht der Hinweis auf die Schritte für Emre aus `ANLEITUNG-RELEASE.md`.

## Klickliste „Version 1.0“
Feste Liste aus Arbeitsregel 7, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 1.0` (echte Tastatur und Maus in Microsoft Edge).

Letzter Stand: 2026-10-29 02:10, Etappe 20 (Version 2.1.0), alle 12 Punkte bestanden.
- [x] Notiz bearbeiten: Seite „Notizen/Ideen“ öffnen, Text tippen, nach kurzer Zeit ist er gespeichert.
- [x] Callout: Über das „/“-Menü einen Callout einfügen; er wird als `> [!info]` gespeichert.
- [x] Link: `[[` tippen, eine Seite aus den Vorschlägen wählen, Klick auf den Link öffnet sie.
- [x] Eigenschaft: In der Eigenschaften-Leiste eine Eigenschaft hinzufügen und einen Wert setzen.
- [x] Tabelle: Datenbank „Projekte“ öffnen, eine Zelle ändern, sortieren und filtern.
- [x] Kanban: Kanban-Ansicht öffnen, eine Karte in eine andere Spalte ziehen.
- [x] Kalender: Kalender-Ansicht öffnen, Monat/Woche umschalten, ein Klick auf einen Tag legt einen Eintrag an.
- [x] Suche: Volltextsuche nach „Wochenplanung“ findet „Ideen“ mit markiertem Treffer.
- [x] Strg+P: Schnellsuche öffnet eine Seite per Enter.
- [x] Vorlage: Neue Seite aus der Vorlage „Projekt“ übernimmt Eigenschaften und Inhalt.
- [x] Backlinks: Unter „Ideen“ steht „Website-Relaunch“ unter „Verlinkt von“.
- [x] Hell/Dunkel: Umschalten wirkt sofort und bleibt nach dem Neuladen erhalten.

## Klickliste „Version 2.0“
Feste Liste für Version 2.0, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.0`.

Letzter Stand: 2026-10-29 02:10, Etappe 20 (Version 2.1.0), alle 7 Punkte bestanden.
- [x] HTML-Seite anlegen: „Neu“ → „HTML-Seite“ legt `Unbenannt.html` nach dem Speicherformat an (mit `localist-id`) und öffnet sie in „Geteilt“.
- [x] Code bearbeiten: Im Code-Editor tippen; gespeichert wird nur die geänderte Stelle, die Vorschau zeigt den neuen Text.
- [x] Jeder Baustein: alle 13 Bausteine über die Werkzeugleiste einfügen (Bild und Seitenlink mit Auswahl), in „Lesen“ dargestellt, Karteikarte per Klick umdrehen.
- [x] Eigener Baustein: markierten Code „Als Baustein speichern“, er erscheint in der Werkzeugleiste und lässt sich einfügen.
- [x] Notizbuch: Ordner „Notizen“ in ein Notizbuch umwandeln, Inhaltsverzeichnis, „Weiter“.
- [x] Umwandeln: „Ideen“ nach Rückfrage in eine HTML-Seite umwandeln, Links und Notizbuch-Eintrag werden angepasst.
- [x] Export: „DNS“ als eigenständige HTML-Datei exportieren (CSS und Skript eingebettet).

## Klickliste „Version 2.1“
Feste Liste für Version 2.1, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.1` (1280 × 800).

Letzter Stand: 2026-10-29 02:10, Etappe 20 (Version 2.1.0), Punkte 1–8 bestanden; Punkt 9 kommt mit Etappe 21 dazu.
- [x] Tab/Shift+Tab in Liste und Code: In „Ideen“ einen Listenpunkt mit Tab einrücken und mit Umschalt+Tab ausrücken (gespeichert, Fokus bleibt im Editor); im Code-Editor von „DNS“ eine Zeile mit dem Cursor mitten darin ein- und ausrücken.
- [x] „Im Explorer öffnen“ in der Vorschau-Simulation: Rechtsklick auf eine Seite → „Im Explorer öffnen“ zeigt die Meldung der Vorschau mit dem Pfad.
- [x] Seitenleiste rechts und eingeklappt: Einstellungen → Darstellung → „Rechts“, dann Strg+. ein- und wieder ausklappen; beides wird gemerkt.
- [x] Code rechts und Trennlinie ziehen: In „Geteilt“ „Seiten tauschen“, die Trennlinie mit der Maus ziehen; Seite und Verhältnis werden gemerkt.
- [x] Reiter öffnen/wechseln/schließen: Strg+Klick öffnet einen neuen Reiter, Strg+Tab und Strg+Umschalt+Tab wechseln, Strg+W und Mittelklick schließen.
- [x] Schnell notieren: Auf der Startseite zwei Zeilen tippen (Umschalt+Enter), Enter legt die Notiz an.
- [x] Modus Schwarz mit Akzent Blau: Knopf „Schwarz“ unten in der Seitenleiste, Akzent „Blau“ in den Einstellungen; wirkt sofort und bleibt nach dem Neuladen.
- [x] Tabelle in einer Notiz bearbeiten: In „Subnetting“ eine Zelle ändern und über „+“ eine Zeile anfügen; gespeichert als Markdown-Tabelle.
- [ ] Nach Updates suchen (Vorschau-Simulation): Update verfügbar → installieren.

## Abgeschlossene Etappen
- Etappen 0–20 und der Nachtrag „Android-Statusleiste“: `archiv/FORTSCHRITT-bis-2.1.md`.

## Offene Probleme
- keine (erledigte Einträge bis Version 2.1 stehen im Archiv)

## Entscheidungen
Entscheidungen bis Version 2.1: `archiv/FORTSCHRITT-bis-2.1.md`, Abschnitt „Entscheidungen“.
