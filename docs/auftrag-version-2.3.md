# Auftrag Version 2.3 – Ziehen und Ablegen auf PC und Handy (Etappe 22)

> **Startprompt für Claude Code:** `Setze docs/auftrag-version-2.3.md um.`

Ziel: Seiten (Notizen und HTML-Seiten) und Ordner lassen sich in der Seitenleiste greifen und in einen anderen Ordner ziehen. Am PC geht das mit gedrückter linker Maustaste, auf dem Handy durch langes Drücken mit dem Finger. Es funktioniert in der **installierten `localist.exe`** und in der **Android-App**, nicht nur in der Browser-Vorschau.

Emre erlaubt mit diesem Auftrag ausdrücklich die Änderungen an `CLAUDE.md` aus Phase 0. Frag ihn nichts, außer etwas blockiert die Etappe wirklich (Arbeitsregel 11).

## Ausgangslage (in Phase 1 bestätigen oder widerlegen)

- Drag & Drop gibt es seit Etappe 10 in `src/components/Sidebar.tsx` (HTML5-Drag-and-Drop mit `draggable`, `onDragOver`, `onDrop`). Kanban (`KanbanBoard.tsx`), der Ziehgriff im Block-Editor (BlockNote) und die Reihenfolge im Notizbuch nutzen ebenfalls HTML5-Drag-and-Drop.
- Geprüft wurde das bisher nur in der Browser-Vorschau (Edge, `scripts/klickliste.mjs`).
- **Vermutete Ursache am PC:** In `src-tauri/tauri.conf.json` fehlt beim Fenster `"dragDropEnabled": false`. Unter Windows fängt Tauri standardmäßig alle Ziehvorgänge ab, um Dateien aus dem Explorer entgegenzunehmen. Dann kommen `dragover` und `drop` in der Oberfläche nicht an, der Mauszeiger zeigt „Verboten“. Laut Tauri-Doku muss man das abschalten, um HTML5-Drag-and-Drop unter Windows zu nutzen.
- **Vermutete Ursache am Handy:** HTML5-Drag-and-Drop reagiert in der Android-WebView nicht zuverlässig auf Finger. Es gibt dort heute keinen Weg, per Touch zu ziehen.

---

## Phase 0 – Aufräumen und Etappe eintragen

1. **Version 2.2 archivieren:** Kriterien, Nachweise und Entscheidungen von Etappe 21 kommen unverändert nach `archiv/FORTSCHRITT-2.2.md`. In `FORTSCHRITT.md` bleiben „Aktueller Stand“ (mit den Hinweisen a–e), die Klicklisten (nur Liste und letzter Stand), noch offene Probleme und ein leerer Abschnitt „Entscheidungen“ mit Verweis auf das Archiv.
2. **`CLAUDE.md` ergänzen** (eigener Commit `CLAUDE.md aktualisiert`, sonst bleibt alles unverändert):
   - Unter „Versionen“: Version 2.2 auf „abgeschlossen“ setzen und neu eintragen: „**Version 2.3 (Etappe 22): in Arbeit.** Ziehen und Ablegen auf PC und Handy. Auftrag: `docs/auftrag-version-2.3.md`.“
   - Unter „Etappen und Fertig-Kriterien“ den Abschnitt „Version 2.3“ mit „Etappe 22 – Ziehen und Ablegen auf PC und Handy“ und den Kriterien aus „Definition of Done“ unten anlegen. Die Details stehen nur in diesem Auftrag.
3. Diesen Auftrag committen (falls noch nicht geschehen).

## Phase 1 – Nachstellen, bevor etwas geändert wird

1. Mit dem Stand von 2.2.1 in der **gebauten `localist.exe`** mit **echter Maus** prüfen: Ein Skript erzeugt echte Windows-Mauseingaben (z. B. PowerShell mit `SendInput` oder `mouse_event`). Playwright über CDP reicht hier nicht, weil künstliche Ereignisse das eigentliche Problem umgehen können.
2. Im **Android-Emulator** (eigener Emulator auf Port 5556, Hinweis c) mit `adb shell input motionevent DOWN …`, kurzer Pause, `MOVE …` und `UP …` (oder `input draganddrop`) prüfen.
3. Geprüft werden jeweils: Seite in einen Ordner, Ordner in einen Ordner, Seite in die Vault-Wurzel, Kanban-Karte in eine andere Spalte, Ziehgriff im Block-Editor, Reihenfolge im Notizbuch-Inhaltsverzeichnis.
4. Prüfen, ob die App irgendwo das native Ablegen von Dateien nutzt (`onDragDropEvent`, `tauri://drag-drop`), z. B. ein Bild aus dem Explorer in eine Notiz ziehen. Ergebnis notieren.
5. Ergebnis als Tabelle in `FORTSCHRITT.md` (Ort × PC/Handy: geht / geht nicht / Ursache).

## Phase 2 – PC

1. **Windows-Fix:** `"dragDropEnabled": false` beim Fenster in `tauri.conf.json`. Hat Phase 1 gezeigt, dass natives Datei-Ablegen genutzt wird: auf HTML5 umstellen (`dataTransfer.files`), damit z. B. ein Bild aus dem Explorer weiterhin in einer Notiz landet.
   *Kriterium:* In der gebauten `localist.exe` mit echter Maus: Seite in Ordner ziehen, danach liegt die Datei im Zielordner (Skriptausgabe und Pfad im Chat). Kanban, Ziehgriff und Notizbuch-Reihenfolge funktionieren ebenso. Bild aus dem Explorer in eine Notiz ziehen geht (oder ging schon vorher nicht, dann notieren).
2. **Besseres Ziehen in der Seitenleiste** (PC und Handy gleich):
   - Das Ziel ist deutlich hervorgehoben (vorhandene Klasse `drop-target`, Werte aus `tokens.css`). Ungültige Ziele (Ordner in sich selbst, gleicher Ordner) zeigen keine Markierung.
   - Wer kurz (ca. 600 ms) über einem zugeklappten Ordner verweilt, klappt ihn damit auf.
   - Am oberen und unteren Rand der Seitenleiste scrollt die Liste beim Ziehen automatisch.
   - Escape bricht das Ziehen ab, nichts wird verschoben.
   - Gibt es im Ziel schon eine Seite mit diesem Namen (auch über beide Typen), wird nicht verschoben, und es erscheint eine verständliche Meldung.
   - Nach dem Verschieben erscheint eine Meldung: „„Ideen“ nach „Projekte“ verschoben“ mit dem Knopf **„Rückgängig“** (ca. 6 Sekunden). Rückgängig verschiebt zurück, Links im Vault werden wieder angepasst.
   - Offene Reiter, Favoriten und Links folgen wie bisher.
   *Kriterium:* Vitest-Tests für die Regeln (gültige Ziele, Namenskonflikt, Aufklappen nach Verweilen, Rückgängig inklusive Links).

## Phase 3 – Handy

1. **Greifen durch langes Drücken:** Ca. 400 ms auf eine Zeile drücken, ohne den Finger zu bewegen, greift sie. Die Zeile hebt sich sichtbar an, eine Kopie folgt dem Finger, dazu ein kurzes Vibrieren (falls dafür eine Berechtigung nötig ist: `VIBRATE` ist erlaubt, Entscheidung notieren).
2. **Nichts anderes geht kaputt:**
   - Wischen ohne langes Drücken scrollt die Liste wie bisher.
   - Kurzes Tippen öffnet wie bisher.
   - Öffnet langes Drücken heute das Kontextmenü, bleibt das so: Loslassen ohne Bewegung zeigt das Menü. Erst eine Bewegung nach dem Greifen startet das Ziehen, dann erscheint kein Menü.
   - Kein Markieren von Text, kein Systemmenü von Android, keine Lupe (`user-select`, `-webkit-touch-callout`, `touch-action` gezielt nur auf den Zeilen).
3. Es gelten dieselben Regeln wie am PC (Hervorhebung, Aufklappen, Auto-Scroll, Namenskonflikt, Rückgängig).
4. **Gleicher Mechanismus überall:** Kanban-Karten und die Reihenfolge im Notizbuch-Inhaltsverzeichnis lassen sich auf dem Handy genauso ziehen. Beim Ziehgriff im Block-Editor (BlockNote) auf dem Handy nur das Verhalten prüfen und notieren. Ist ein Umbau aufwendig, kommt er unter „Offene Probleme“.
5. **Technik:** eine gemeinsame Lösung auf Basis von Pointer Events für Maus und Finger, z. B. `@dnd-kit/core` (MIT; Maus sofort, Finger mit Verzögerung) oder ein eigener kleiner Hook `src/lib/ziehen.ts`. Die Abwägung kommt unter „Entscheidungen“. Wird die gemeinsame Lösung auch am PC eingesetzt, darf sie das HTML5-Drag-and-Drop von Seitenleiste, Kanban und Notizbuch ersetzen. Das Verhalten am PC bleibt dabei gleich. `dragDropEnabled: false` bleibt trotzdem gesetzt, weil BlockNote HTML5 nutzt.
6. Tippflächen bleiben mindestens 44 px groß (`scripts/handy-pruefung.mjs`).
   *Kriterium:* Im Emulator per `adb` (Befehle samt Ausgabe im Chat): Seite lange drücken, in einen Ordner ziehen, loslassen, danach liegt die Datei dort. Screenshot während des Ziehens per `adb exec-out screencap` in `docs/screenshots/etappe-22/`. Vitest-Tests mit falschen Zeitgebern: unter 400 ms kein Greifen, Bewegung vor 400 ms scrollt, Loslassen ohne Bewegung öffnet das Menü.

## Nicht Teil dieser Etappe
- Eigene Reihenfolge in der Seitenleiste. Sie bleibt alphabetisch, Ordner zuerst.
- Mehrere Elemente gleichzeitig ziehen.
- Seite aus der Seitenleiste in eine Notiz ziehen, um einen Link einzufügen.
- Auf „Favoriten“ ziehen, um anzuheften.

---

## Tests (neu)
- Regeln für Ziele, Namenskonflikt, Aufklappen, Auto-Scroll-Grenzen, Rückgängig (Phase 2).
- Langes Drücken, Scrollen, Tippen und Kontextmenü auf dem Handy (Phase 3).
- Alle bestehenden Tests bleiben grün (Stand 2.2: 484 in `npm test`, 44 in `cargo test`).
- Neue **Klickliste „Version 2.3“** in `FORTSCHRITT.md`, automatisch über `scripts/klickliste.mjs … 2.3`:
  1. Seite in einen Ordner ziehen, danach „Rückgängig“.
  2. Ordner in einen anderen Ordner ziehen; ein Link auf eine Seite darin funktioniert danach noch.
  3. Handy-Ansicht 360 × 740 mit Touch (Playwright `hasTouch`): lange drücken, ziehen, ablegen.
  4. Kanban-Karte auf dem Handy in eine andere Spalte ziehen.

## Prüfung
- Höchstens 3 Runden. Schluss ist nach der ersten Runde ohne Funde der Klassen A und B.
- Die unabhängige Prüfung macht **ein** lesender Sonnet-Agent, nur in der Runde, die fertig aussieht. Antwort höchstens 40 Zeilen, nur A/B-Funde mit Beleg. Er prüft:
  1. Ist `dragDropEnabled: false` gesetzt, und geht das Ablegen von Dateien aus dem Explorer noch (falls es vorher ging)?
  2. Kann Ziehen Dateien verlieren oder überschreiben (Namenskonflikt, Abbruch, Rückgängig)?
  3. Werden Links beim Verschieben und beim Rückgängigmachen richtig angepasst?
  4. Scrollen und Tippen auf dem Handy funktionieren wie vorher?
- Screenshots nur: PC-Seitenleiste beim Ziehen (Hell und Schwarz), Handy beim Ziehen (360 × 740), Meldung „Rückgängig“. Sie kommen nach `docs/screenshots/etappe-22/`.

## Abschluss
- Version 2.3.0 mit `node scripts/version.mjs 2.3.0` setzen. Pushen (`git push --follow-tags`) macht Emre.
- `README.md` und `ANLEITUNG.md`: kurzer Abschnitt „Neu in Version 2.3“.

## Definition of Done (auch als Fertig-Kriterien in `CLAUDE.md`)
- [ ] Phase 0 erledigt: Version 2.2 liegt im Archiv, `CLAUDE.md` ist ergänzt und committet.
- [ ] Phase 1: Die Tabelle „Ziehen vorher“ (PC-EXE und Android) steht in `FORTSCHRITT.md`.
- [ ] Am PC funktioniert Ziehen in der gebauten `localist.exe` mit echter Maus: Seitenleiste, Kanban, Ziehgriff, Notizbuch-Reihenfolge (Nachweis im Chat).
- [ ] Ziehen in der Seitenleiste mit Hervorhebung, Aufklappen beim Verweilen, Auto-Scroll, Escape, Namenskonflikt-Meldung und „Rückgängig“, getestet.
- [ ] Auf dem Handy greift langes Drücken eine Zeile und lässt sich ablegen. Scrollen, Tippen und Kontextmenü funktionieren wie vorher. Kanban und Notizbuch-Reihenfolge gehen auch per Finger. Nachweis mit `adb` im Chat.
- [ ] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten 1.0, 2.0, 2.1 und 2.3 abgehakt.
- [ ] Version 2.3.0 gesetzt, „Neu in Version 2.3“ in `README.md` und `ANLEITUNG.md`.
