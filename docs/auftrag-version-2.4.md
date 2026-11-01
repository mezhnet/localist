# Auftrag Version 2.4 – Pomodoro, Grundversion (Etappe 23)

> **Startprompt für Claude Code:** `Setze docs/auftrag-version-2.4.md um.`
> Erst starten, wenn Etappe 22 abgeschlossen ist.

Ziel: Localist bekommt einen lokalen Pomodoro-Timer als eigenes Werkzeug. Vorbild ist Emres Web-App „Pomodoro Team“, aber nur die Grundfunktionen: Fokus und Pausen, ein Timer, der überall weiterläuft, eine Benachrichtigung am Ende und ein Verlauf im Vault. Kein Konto, kein Firebase, kein Team, kein „Wald“.

Diese Grundversion soll klein, aber fertig sein: sauber getestet, auf PC und Handy, in Hell, Dunkel und Schwarz. Ausbau kommt später in eigenen Aufträgen.

Emre erlaubt mit diesem Auftrag ausdrücklich die Änderungen an `CLAUDE.md` aus Phase 0. Frag ihn nichts, außer etwas blockiert die Etappe wirklich (Arbeitsregel 11).

---

## Phase 0 – Etappe eintragen

1. Version 2.3 nach `archiv/` verschieben (wie in Phase 0 von Auftrag 2.3).
2. **`CLAUDE.md` ergänzen** (eigener Commit `CLAUDE.md aktualisiert`):
   - Unter „Versionen“: 2.3 auf „abgeschlossen“, neu: „**Version 2.4 (Etappe 23): in Arbeit.** Pomodoro, Grundversion. Auftrag: `docs/auftrag-version-2.4.md`.“
   - Unter „Speicherformat“ im Verzeichnisbaum `.localist/pomodoro/` ergänzen und einen kurzen Abschnitt „Pomodoro-Verlauf“ mit dem Format aus Anforderung 6 anlegen.
   - Neuer Abschnitt „Werkzeuge“ nach „Zwei Seitentypen“: „Werkzeuge sind Funktionen, die keine Seite sind (Pomodoro, später Kalender). Sie stehen am PC in der Seitenleiste im Bereich ‚Werkzeuge‘ und öffnen sich wie die Startseite in einem Reiter.“
   - Etappe 23 mit den Kriterien aus „Definition of Done“ unten.
3. Diesen Auftrag committen.

## Phase 1 – Benachrichtigungen (Grundlage, auch für den Kalender)

- **Plugin:** das offizielle `tauri-plugin-notification` (Rust und `@tauri-apps/plugin-notification`), auf Windows und Android. Rechte nur so viele wie nötig, in `capabilities/default.json` (falls es auf beiden Plattformen läuft) oder getrennt wie beim Updater.
- **Eine Stelle im Code:** `src/lib/benachrichtigungen.ts` mit `jetztZeigen(titel, text)`, `planen(id, zeitpunkt, titel, text)` und `abbrechen(id)`. Die Browser-Vorschau simuliert das in `src/lib/dev-backend.ts` (Meldung in der Oberfläche).
- **Geplante Benachrichtigungen:** In der Doku des Plugins prüfen, wo `schedule` wirklich funktioniert. Erwartet:
  - **Android:** Planen geht. Die Benachrichtigung kommt auch, wenn Localist im Hintergrund ist oder das Handy gesperrt ist.
  - **Windows:** Planen geht nicht. Dann löst die laufende App die Benachrichtigung zum Zeitpunkt selbst aus (Zeitgeber auf Basis des Endzeitpunkts, siehe Anforderung 3).
  - Was tatsächlich gilt, kommt unter „Entscheidungen“.
- **Berechtigung (Android 13 und neuer):** Erst fragen, wenn der erste Timer gestartet wird, mit einem Satz Erklärung vorher. Lehnt Emre ab, läuft der Timer trotzdem. Es erscheint einmal der Hinweis „Ohne Erlaubnis kommt keine Benachrichtigung, wenn die Zeit um ist.“ Falls genaue Zeitpunkte eine Berechtigung für exakte Alarme brauchen, das prüfen und notieren.
- **Kein Netz:** Benachrichtigungen laufen nur lokal. `localist.exe --sicherheitstest` bleibt bei 21/21.
  *Kriterium:* Vitest-Tests für `benachrichtigungen.ts` mit gemocktem Plugin (planen, abbrechen, Berechtigung abgelehnt). In der EXE und im Emulator je eine echte Benachrichtigung (Screenshot).

## Phase 2 – Pomodoro

### Anforderungen (jeweils mit Prüfkriterium)

1. **Ort:**
   - **PC:** In der Seitenleiste gibt es den Bereich „Werkzeuge“ mit dem Eintrag „Pomodoro“ (Symbol aus `lucide-react`). Er öffnet die Ansicht „Pomodoro“ im aktuellen Reiter, Strg+Klick in einem neuen.
   - **Handy:** Schnellaktion „Pomodoro“ auf der Startseite und ein Eintrag oben in „Seiten“. Die Navigationsleiste bleibt in dieser Etappe unverändert.
   - Gestaltet im Stil der Vorlage `docs/design/`, nur mit Werten aus `tokens.css` und Komponenten aus `src/components/ui/`.
   *Kriterium:* Screenshots PC (Hell, Schwarz) und Handy 360 × 740.
2. **Timer:**
   - Phasen Fokus (Standard 25 Min.), kurze Pause (5 Min.) und lange Pause (15 Min.). Nach 4 Fokus-Runden kommt die lange Pause.
   - Alle Dauern und die Rundenzahl sind einstellbar (Fokus 1–120 Min.).
   - Knöpfe: Starten, Pausieren, Fortsetzen, Überspringen, Zurücksetzen.
   - Anzeige: großer Fortschrittsring, Restzeit in Monospace, aktuelle Phase, Runde „2 von 4“.
   - In der Ansicht startet und pausiert die Leertaste den Timer, aber nur, wenn kein Eingabefeld den Fokus hat.
   - Schalter „Pausen automatisch starten“ und „Fokus automatisch starten“, beide standardmäßig aus.
   *Kriterium:* Vitest-Tests für die Phasenfolge, die lange Pause nach N Runden, Überspringen und Zurücksetzen.
3. **Läuft überall weiter und rechnet richtig:**
   - Der Timer lebt außerhalb der Ansicht (globaler Zustand). Seitenwechsel, Reiterwechsel und das Schließen der Ansicht halten ihn nicht an.
   - Gerechnet wird mit dem **Endzeitpunkt**, nicht durch Zählen von Sekunden. Die Restzeit stimmt deshalb auch nach Minimieren, Ruhezustand oder wenn Android die App im Hintergrund anhält.
   - Der laufende Timer wird im App-Speicher gesichert. Nach einem Neustart von Localist läuft er weiter oder wird als „abgelaufen“ erkannt und richtig abgeschlossen.
   *Kriterium:* Tests mit falschen Zeitgebern: Zeit springt um 10 Minuten (Ruhezustand), Neustart mit gespeichertem Zustand vor und nach dem Endzeitpunkt.
4. **Mini-Timer:** Läuft ein Timer, zeigt ihn eine kleine Anzeige mit Restzeit und Pause-Knopf.
   - **PC:** unten in der Seitenleiste. Ist die Seitenleiste eingeklappt, steht er in der oberen Leiste.
   - **Handy:** als schmale Leiste über der Navigationsleiste.
   - Ein Klick öffnet die Ansicht „Pomodoro“.
   - Der Mini-Timer verdeckt nichts: nicht die Leiste über der Tastatur (`Tastaturleiste.tsx`), nicht `safe-area-inset-bottom`.
   *Kriterium:* Screenshots mit laufendem Timer auf einer Notiz (PC und Handy). `scripts/handy-pruefung.mjs` ist grün.
5. **Ende einer Phase:**
   - Ein kurzer, ruhiger Ton, per Web Audio erzeugt (keine Tondatei, also kein Lizenzthema). Er lässt sich in den Einstellungen abschalten.
   - Dazu eine Benachrichtigung über Phase 1, z. B. „Fokus geschafft – Zeit für 5 Minuten Pause“.
   - **Android:** Beim Start einer Phase wird die Benachrichtigung für den Endzeitpunkt geplant. Pausieren, Zurücksetzen oder Überspringen bricht sie ab, Fortsetzen plant sie neu.
   *Kriterium:* Tests für Planen und Abbrechen. Im Emulator: Timer mit 1 Min. starten, App in den Hintergrund (`adb shell input keyevent KEYCODE_HOME`), die Benachrichtigung kommt (`adb shell dumpsys notification` mit Ausgabe im Chat).
6. **Ziel, Seite und Verlauf:**
   - Optionales Feld „Woran arbeitest du?“.
   - Im „…“-Menü einer Seite gibt es „Pomodoro für diese Seite starten“. Die Session ist dann mit der Seite verknüpft, und die Ansicht zeigt einen Link zur Seite.
   - Jede beendete oder abgebrochene **Fokus**-Session wird gespeichert. Pausen werden nicht gespeichert.
   - Ort: `.localist/pomodoro/YYYY-MM.jsonl`, eine Zeile pro Session (Monatsdateien bleiben klein):
     ```json
     {"id":"…","start":"2026-11-03T09:00","ende":"2026-11-03T09:25","minuten":25,"ziel":"Subnetting üben","seite":"7c1e2b4a-0d3f-4a5e-9b8c-1f2e3d4c5b6a","abgebrochen":false}
     ```
   - `seite` ist die feste `id` der Seite (bei Notizen aus dem Frontmatter, bei HTML-Seiten `localist-id`), nicht der Pfad. Umbenennen und Verschieben machen die Verknüpfung deshalb nicht kaputt.
   - Atomar schreiben wie alle Dateien. Eine kaputte Zeile wird beim Lesen übersprungen, nicht gelöscht.
   - Die Ansicht zeigt „Heute“ (Anzahl, Minuten und eine Liste der Sessions mit Ziel und Seite) und „Diese Woche“ (Minuten gesamt).
   - Einstellungen (Dauern, Schalter, Ton) stehen in `.localist/settings.json` unter `pomodoro`.
   *Kriterium:* Tests für Schreiben, Lesen, kaputte Zeile, Monatswechsel, Verknüpfung nach Umbenennen.
7. **Einstellungen:** Abschnitt „Pomodoro“ in den Einstellungen (PC-Dialog und `HandyEinstellungen`) mit Dauern, Rundenzahl, den beiden Schaltern und dem Ton.

## Nicht Teil dieser Etappe
- Team, Live-Status, Wald, Bäume, Konto, Synchronisation.
- Statistik-Diagramme, Ziele pro Tag, Fächer und Lernthemen, Etappen innerhalb einer Session, Vollbild.
- Verknüpfung mit Kalender-Aufgaben (kommt mit dem Kalender).
- Benachrichtigungen am PC, wenn Localist geschlossen ist (bräuchte ein Symbol im Infobereich, späterer Auftrag).

---

## Tests (neu)
- Benachrichtigungen (Phase 1), Timer-Logik, Endzeitpunkt, Neustart, Verlauf (Anforderungen 2–6).
- Alle bestehenden Tests bleiben grün (Stand laut `FORTSCHRITT.md` nach Etappe 22).
- Neue **Klickliste „Version 2.4“**, automatisch über `scripts/klickliste.mjs … 2.4`:
  1. Pomodoro öffnen, Fokus auf 1 Min. stellen, starten, zu einer Notiz wechseln: Der Mini-Timer läuft weiter.
  2. Ablauf (Zeit in der Vorschau vorspulen): Meldung erscheint, die Session steht unter „Heute“.
  3. „Pomodoro für diese Seite starten“ im „…“-Menü von „Ideen“: Der Link zur Seite erscheint.
  4. Handy 360 × 740: Mini-Leiste über der Navigationsleiste, Klick öffnet die Ansicht.

## Prüfung
- Höchstens 3 Runden, Schluss nach der ersten Runde ohne Funde A/B.
- **Ein** lesender Sonnet-Agent in der Runde, die fertig aussieht, höchstens 40 Zeilen, nur A/B-Funde mit Beleg:
  1. Stimmt die Restzeit nach Ruhezustand und Neustart (Endzeitpunkt statt Zählen)?
  2. Werden geplante Benachrichtigungen beim Pausieren, Zurücksetzen und Überspringen abgebrochen?
  3. Kann der Verlauf Daten verlieren (atomar schreiben, kaputte Zeilen)?
  4. Bricht der Android-Build durch Plugin oder Rechte?
- Screenshots nur: Ansicht Pomodoro (PC Hell und Schwarz, Handy), Mini-Timer (PC und Handy), Benachrichtigung (EXE und Emulator). Sie kommen nach `docs/screenshots/etappe-23/`.

## Abschluss
- Version 2.4.0 mit `node scripts/version.mjs 2.4.0`. Pushen macht Emre.
- „Neu in Version 2.4“ in `README.md` und `ANLEITUNG.md`, mit dem Hinweis: „Am PC kommt die Benachrichtigung nur, solange Localist geöffnet ist (auch minimiert).“

## Definition of Done (auch als Fertig-Kriterien in `CLAUDE.md`)
- [ ] Phase 0 erledigt, `CLAUDE.md` ergänzt (Werkzeuge, Pomodoro-Verlauf) und committet.
- [ ] `src/lib/benachrichtigungen.ts` mit Plugin auf Windows und Android, Berechtigung mit Erklärung, getestet, je eine echte Benachrichtigung in EXE und Emulator.
- [ ] Pomodoro-Ansicht mit Phasen, einstellbaren Dauern, langer Pause nach N Runden, Leertaste und automatischem Start, getestet.
- [ ] Der Timer läuft überall weiter, rechnet mit dem Endzeitpunkt und übersteht Ruhezustand und Neustart (Tests). Mini-Timer auf PC und Handy.
- [ ] Ton und Benachrichtigung am Ende. Auf Android kommt sie auch bei App im Hintergrund (Nachweis mit `adb` im Chat).
- [ ] Ziel, „Pomodoro für diese Seite starten“ und Verlauf in `.localist/pomodoro/YYYY-MM.jsonl` mit „Heute“ und „Diese Woche“, getestet.
- [ ] Arbeitsregel 6 erfüllt, APK baut, Sicherheitstest 21/21, Klicklisten 1.0, 2.0, 2.1, 2.3 und 2.4 abgehakt.
- [ ] Version 2.4.0 gesetzt, „Neu in Version 2.4“ in `README.md` und `ANLEITUNG.md`.
