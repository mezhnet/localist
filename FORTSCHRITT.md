# Fortschritt

## Aktueller Stand
- Etappe: 23 – Pomodoro, Grundversion (in Arbeit). Auftrag: `docs/auftrag-version-2.4.md`. Version 2.3: `archiv/FORTSCHRITT-2.3.md`, 2.2: `archiv/FORTSCHRITT-2.2.md`, bis 2.1: `archiv/FORTSCHRITT-bis-2.1.md`.
- Zuletzt aktualisiert: 2026-11-01 14:25
- Nächster Schritt: Echte Benachrichtigungen belegt (EXE: `scripts/benachrichtigung-pruefung.mjs`, Emulator 5556: `scripts/android-benachrichtigung-pruefung.mjs`, Fotos in `docs/screenshots/etappe-23/`). Offen: Befund der Prüfrunde (Sonnet) abarbeiten, Klicklisten 1.0/2.0/2.1/2.3, `cargo test`, `node scripts/version.mjs 2.4.0`, danach EXE und APK mit 2.4.0 bauen, Sicherheitstest 21/21, voller `npm test`, Abschluss mit Nachweisen im Chat.
- Hinweise für spätere Sitzungen: (a) Handy = schmaler Bildschirm unter 769 px (`useSchmal()` in `Reiterleiste.tsx`, Klasse `is-handy` am `.workspace`), Navigationsleiste `src/components/Navigationsleiste.tsx`, Leiste über der Tastatur `src/components/Tastaturleiste.tsx`, Handy-Einstellungen `HandyEinstellungen` in `Dialogs.tsx`. (b) Prüfskripte: `scripts/handy-pruefung.mjs` (360 × 740, Tippflächen ≥ 44 px, auch im iframe), `scripts/vorlage-vergleich.mjs … handy` (Vorlagen 03–05), `scripts/android-handy-pruefung.mjs` und `scripts/android-statusleiste-pruefung.mjs` (Emulator, nur mit `ANDROID_SERIAL`), `scripts/klickliste.mjs … 1.0|2.0|2.1|2.3`. (c) Fremden Emulator „Kartei_Test“ (`emulator-5554`) nie anfassen, eigenen „Medium_Phone_API_37.0“ auf Port 5556 starten. (d) Nach einem Versionswechsel `npm run build`, damit die gebündelten Bausteine die neue Version tragen. (e) Bash-Heredocs verschlucken `\\`: Umbau-Skripte mit dem Write-Werkzeug schreiben.

## Fertig-Kriterien der aktuellen Etappe
- [x] Phase 0 erledigt, `CLAUDE.md` ergänzt (Werkzeuge, Pomodoro-Verlauf) und committet. (a6db38a „CLAUDE.md aktualisiert“, 2b1e925; Archiv `archiv/FORTSCHRITT-2.3.md`)
- [x] `src/lib/benachrichtigungen.ts` mit Plugin auf Windows und Android, Berechtigung mit Erklärung, getestet, je eine echte Benachrichtigung in EXE und Emulator. (`benachrichtigungen.test.ts`; EXE 14:15:51 im Benachrichtigungsverlauf von Windows, `benachrichtigung-exe.png`; Emulator 5556 mit Erklärung und Erlaubnis, `android-*.png`)
- [x] Pomodoro-Ansicht mit Phasen, einstellbaren Dauern, langer Pause nach N Runden, Leertaste und automatischem Start, getestet. (`pomodoro.test.ts`, `PomodoroView.test.tsx`)
- [x] Der Timer läuft überall weiter, rechnet mit dem Endzeitpunkt und übersteht Ruhezustand und Neustart (Tests). Mini-Timer auf PC und Handy. (`pomodoro-timer.test.ts`, `PomodoroView.test.tsx`)
- [x] Ton und Benachrichtigung am Ende. Auf Android kommt sie auch bei App im Hintergrund (Nachweis mit `adb` im Chat). (`pomodoro-timer.test.ts`, `PomodoroView.test.tsx`; `dumpsys notification`: id 2301, Launcher vorn)
- [x] Ziel, „Pomodoro für diese Seite starten“ und Verlauf in `.localist/pomodoro/YYYY-MM.jsonl` mit „Heute“ und „Diese Woche“, getestet. (`pomodoro.test.ts`, `PomodoroView.test.tsx`)
- [ ] Arbeitsregel 6 erfüllt, APK baut, Sicherheitstest 21/21, Klicklisten 1.0, 2.0, 2.1, 2.3 und 2.4 abgehakt.
- [ ] Version 2.4.0 gesetzt, „Neu in Version 2.4“ in `README.md` und `ANLEITUNG.md`.

## Klickliste „Version 2.4“
Feste Liste für Version 2.4, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.4` (Maus bei 1280 × 800, Punkt 4 bei 360 × 740 mit Touch; die Uhr der Vorschau wird über `__devVault.vorspulen` vorgestellt).

Letzter Stand: 2026-11-01 14:09, Etappe 23, alle 4 Punkte bestanden.
- [x] Pomodoro öffnen, Fokus auf 1 Min. stellen, starten, zu einer Notiz wechseln: Der Mini-Timer läuft weiter.
- [x] Ablauf (Zeit in der Vorschau vorspulen): Meldung erscheint, die Session steht unter „Heute“.
- [x] „Pomodoro für diese Seite starten“ im „…“-Menü von „Ideen“: Der Link zur Seite erscheint.
- [x] Handy 360 × 740: Mini-Leiste über der Navigationsleiste, Klick öffnet die Ansicht.

## Klickliste „Version 2.3“
Feste Liste für Version 2.3, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.3` (Maus bei 1280 × 800, Finger bei 360 × 740 mit Touch).

Letzter Stand: 2026-11-01 14:40, Etappe 23, alle 4 Punkte bestanden.
- [x] Seite in einen Ordner ziehen, danach „Rückgängig“.
- [x] Ordner in einen anderen Ordner ziehen; ein Link auf eine Seite darin funktioniert danach noch.
- [x] Handy-Ansicht 360 × 740 mit Touch: lange drücken, ziehen, ablegen.
- [x] Kanban-Karte auf dem Handy in eine andere Spalte ziehen.

## Klickliste „Version 1.0“
Feste Liste aus Arbeitsregel 7, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 1.0` (echte Tastatur und Maus in Microsoft Edge).

Letzter Stand: 2026-11-01 14:33, Etappe 23, alle 12 Punkte bestanden (Punkt 6 zieht seit Etappe 22 mit der Maus).
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

Letzter Stand: 2026-11-01 14:35, Etappe 23, alle 7 Punkte bestanden.
- [x] HTML-Seite anlegen: „Neu“ → „HTML-Seite“ legt `Unbenannt.html` nach dem Speicherformat an (mit `localist-id`) und öffnet sie in „Geteilt“.
- [x] Code bearbeiten: Im Code-Editor tippen; gespeichert wird nur die geänderte Stelle, die Vorschau zeigt den neuen Text.
- [x] Jeder Baustein: alle 13 Bausteine über die Werkzeugleiste einfügen (Bild und Seitenlink mit Auswahl), in „Lesen“ dargestellt, Karteikarte per Klick umdrehen.
- [x] Eigener Baustein: markierten Code „Als Baustein speichern“, er erscheint in der Werkzeugleiste und lässt sich einfügen.
- [x] Notizbuch: Ordner „Notizen“ in ein Notizbuch umwandeln, Inhaltsverzeichnis, „Weiter“.
- [x] Umwandeln: „Ideen“ nach Rückfrage in eine HTML-Seite umwandeln, Links und Notizbuch-Eintrag werden angepasst.
- [x] Export: „DNS“ als eigenständige HTML-Datei exportieren (CSS und Skript eingebettet).

## Klickliste „Version 2.1“
Feste Liste für Version 2.1, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.1` (1280 × 800).

Letzter Stand: 2026-11-01 14:38, Etappe 23, alle 9 Punkte bestanden.
- [x] Tab/Shift+Tab in Liste und Code: In „Ideen“ einen Listenpunkt mit Tab einrücken und mit Umschalt+Tab ausrücken (gespeichert, Fokus bleibt im Editor); im Code-Editor von „DNS“ eine Zeile mit dem Cursor mitten darin ein- und ausrücken.
- [x] „Im Explorer öffnen“ in der Vorschau-Simulation: Rechtsklick auf eine Seite → „Im Explorer öffnen“ zeigt die Meldung der Vorschau mit dem Pfad.
- [x] Seitenleiste rechts und eingeklappt: Einstellungen → Darstellung → „Rechts“, dann Strg+. ein- und wieder ausklappen; beides wird gemerkt.
- [x] Code rechts und Trennlinie ziehen: In „Geteilt“ „Seiten tauschen“, die Trennlinie mit der Maus ziehen; Seite und Verhältnis werden gemerkt.
- [x] Reiter öffnen/wechseln/schließen: Strg+Klick öffnet einen neuen Reiter, Strg+Tab und Strg+Umschalt+Tab wechseln, Strg+W und Mittelklick schließen.
- [x] Schnell notieren: Auf der Startseite zwei Zeilen tippen (Umschalt+Enter), Enter legt die Notiz an.
- [x] Modus Schwarz mit Akzent Blau: Knopf „Schwarz“ unten in der Seitenleiste, Akzent „Blau“ in den Einstellungen; wirkt sofort und bleibt nach dem Neuladen.
- [x] Tabelle in einer Notiz bearbeiten: In „Subnetting“ eine Zelle ändern und über „+“ eine Zeile anfügen; gespeichert als Markdown-Tabelle.
- [x] Nach Updates suchen (Vorschau-Simulation): Update verfügbar → installieren.

## Abgeschlossene Etappen
- Etappen 0–20 und der Nachtrag „Android-Statusleiste“: `archiv/FORTSCHRITT-bis-2.1.md`.
- Etappe 21 – Updates über GitHub Releases (abgeschlossen am 2026-10-31): `archiv/FORTSCHRITT-2.2.md`.
- Etappe 22 – Ziehen und Ablegen auf PC und Handy (abgeschlossen am 2026-11-01), danach 2.3.1 und 2.3.2: `archiv/FORTSCHRITT-2.3.md`.

## Prüfrunden
- Runde 1 (2026-11-01, ein lesender Sonnet-Agent, vier Fragen des Auftrags): kein A, ein B – ein beim Start schon abgelaufener Timer konnte beim ersten Fokus des Fensters vor der Anmeldung des Vaults mit Standardwerten abgeschlossen werden (falsche Phase/kein automatischer Start). Behoben: `pruefen` wartet auf die erste Anmeldung, Test „Zurückkehren in die App vor der Anmeldung …“. Dazu selbst gefunden: Leertaste kam in Tests manchmal vor dem Hörer an → `useLayoutEffect` (10/10 Läufe grün).
- Runde 2 (eigene Prüfung ohne Agent: automatische Tests, Klicklisten, Builds): keine Funde A/B → Schluss.

## Offene Probleme
- Für Emre: `%USERPROFILE%\.tauri\localist.key` sichern und den ersten echten Update-Test machen (2.2.1 installieren, 2.2.2 veröffentlichen, in der App aktualisieren; `ANLEITUNG-RELEASE.md`, Schritt 5). Erstes Release [v2.2.1](https://github.com/mezhnet/localist/releases/tag/v2.2.1) ist veröffentlicht (Run 41224614969 grün, `latest.json` mit Version 2.2.1, Signaturen mit Schlüssel-ID 6BEE31F67A3C789E).
- Debug-APKs hängen an v2.2.1 und v2.3.0 (`…_android-debug.apk`, Debug-Schlüssel dieses PCs). Ab 2.3.1 baut der Release-Workflow eine signierte APK (`Localist_X.Y.Z_android.apk`); von 2.3.0 aus einmal deinstallieren (Android lehnt sie sonst mit `INSTALL_FAILED_UPDATE_INCOMPATIBLE` ab, im Emulator gesehen).
- Für Emre: `C:\Users\emre\.localist-android\github-secrets.env` löschen (Secrets sind bei GitHub), den Ordner wie `.tauri` sichern. Auf dem Handy einmal die alte App deinstallieren und `Localist_2.3.1_android.apk` installieren.
- Wackliger Test: „Quiz-Formular: richtige Antwort per Auswahlknopf festlegen“ (`src/App.test.tsx`, Etappe 13) fand auf GitHubs Windows-Rechner den Dialog nicht (5 s); lokal grün. Vermutlich kommt die Bearbeiten-Nachricht, bevor die Seite eingelesen ist.
- Hinweis von GitHub, nicht dringend: `actions/checkout@v4` und `actions/setup-node@v4` nutzen noch Node 20 und laufen erzwungen mit Node 24. Bei Gelegenheit auf neuere Hauptversionen anheben.
- Beobachtet, nicht behoben: Läuft `npm test` neben anderer Last (z. B. Build), scheitern einzelne Tests in `App.test.tsx`/`bausteine.test.ts` (meist an der 5- bzw. 15-s-Grenze, einmal „inert“ der Handy-Ansicht „Seiten“). Einzeln und ohne Last sind sie grün, der volle Lauf auch (484/484).
- Ziehgriff im Block-Editor auf dem Handy: Senkrecht ziehen geht (Android-WebView startet HTML5-Ziehen nach langem Druck). Der Griff liegt aber am linken Bildschirmrand (x ≈ 8 CSS-px); wer von dort nach rechts zieht, löst die Zurück-Geste von Android aus, und die App schließt sich. Abhilfe bräuchte mehr Abstand links in Handy-Notizen (weicht von Vorlage 04 ab) oder einen eigenen Griff statt dem von BlockNote – ein Umbau für einen späteren Auftrag.
- Erledigte Einträge bis Version 2.3 stehen im Archiv.

## Entscheidungen
- 2026-11-01: Benachrichtigungen mit `tauri-plugin-notification` 2.8 (MIT/Apache). Laut Quellcode ignoriert der PC-Teil `schedule` („the scheduling … options are ignored“); Planen geht nur auf Android (AlarmManager). Deshalb plant am PC `src-tauri/src/benachrichtigung.rs`: ein Thread schaut jede Sekunde auf die Systemuhr (nicht auf eine Wartezeit, so stimmt es auch nach dem Ruhezustand) und zeigt die Benachrichtigung über das Plugin; neu planen oder abbrechen macht alte Planungen ungültig. Nur solange Localist läuft. Rechte: nur `is-permission-granted`, `request-permission`, `notify`, `cancel` in `default.json`.
- 2026-11-01: Pomodoro-Regeln: „Zurücksetzen“ = alles auf Anfang (Fokus, Runde 1), „Überspringen“ zählt die Runde und startet die nächste Phase nur bei passendem Schalter. Ein angefangener Fokus wird bei beidem als abgebrochen gespeichert. Ids der Benachrichtigung wechseln zwischen Fokus (2301) und Pause (2302), damit eine automatisch gestartete Folgephase die gerade fällige nicht ersetzt; ein reguläres Ende bricht nichts ab (auf Android würde `cancel` die eben gezeigte Benachrichtigung entfernen). Ton nur, wenn das Ende höchstens 2 Min. her ist. Sessions warten im App-Speicher (`localist-pomodoro`, Feld `offen`), bis sie im Vault stehen. „Heute“ zählt nach dem Ende, die Datei ist der Monat des Starts. Grenze: Mit automatischem Start plant Android die Folgephase erst, wenn Localist wieder läuft.
- 2026-11-01: Genaue Zeitpunkte auf Android brauchen ab Android 12 die Erlaubnis für exakte Alarme; ohne sie plant das Plugin ungenau (`setAndAllowWhileIdle`, Android darf um bis zu 75 % der Wartezeit verschieben). Gewählt: `USE_EXACT_ALARM` (ab 13) und `SCHEDULE_EXACT_ALARM` mit `maxSdkVersion="32"` im Manifest, beide ohne Rückfrage; geplant wird mit `allowWhileIdle: true` (`setExactAndAllowWhileIdle`, kommt auch im Ruhemodus). Play-Store-Regeln für `USE_EXACT_ALARM` betreffen Localist nicht (APK über GitHub). `POST_NOTIFICATIONS` bringt das Plugin mit; Localist fragt erst beim ersten Timer, nach einem Satz Erklärung, und danach nie wieder.
- 2026-11-01: Pomodoro-Oberfläche: Eine Seite ohne feste id bekommt sie erst, wenn der Nutzer „Pomodoro für diese Seite starten“ wählt (`mitSeitenId`, nur dieses Feld bzw. Tag). Die Aktion öffnet die Ansicht am PC in einem eigenen Reiter (die Seite bleibt offen) und startet nur einen bereitstehenden Fokus, keine anstehende Pause. Pausen haben im Ring und im Mini-Timer `--color-success`, der Fokus die Akzentfarbe. Der Mini-Timer fehlt in der Ansicht selbst; auf dem Handy ist er beim Schreiben ausgeblendet wie die Navigationsleiste. Die Leertaste gehört Eingabefeldern, Knöpfen, Menüs und Dialogen. Die Erklärung vor der Frage nach der Erlaubnis zeigt `message` aus plugin-dialog („Weiter“).
- 2026-11-01: Tests bewusst angepasst (Etappe 23): „Aufbau von oben nach unten“ erwartet den neuen Bereich „Werkzeuge“, der Rechte-Test die vier Benachrichtigungsrechte aus Phase 1. Vitest schließt `.claude/**` aus: Dort lag eine Arbeitskopie einer anderen Sitzung, deren Tests mitliefen.
- 2026-11-01: Eine EXE aus `target/release` meldet ihre Benachrichtigungen bei Windows als „Windows PowerShell“ (das Plugin setzt die App-Kennung nur bei installierten Builds, `desktop.rs`); die installierte App erscheint als „Localist“. Nachweis deshalb zusätzlich über den Benachrichtigungsverlauf von Windows (Kopie von `wpndatabase.db`, nur der eigene Eintrag). Das Bildschirmfoto zeigt nur die Benachrichtigung, nichts vom übrigen Bildschirm.
Entscheidungen bis Version 2.1: `archiv/FORTSCHRITT-bis-2.1.md`, Version 2.2: `archiv/FORTSCHRITT-2.2.md`, Version 2.3: `archiv/FORTSCHRITT-2.3.md`, jeweils Abschnitt „Entscheidungen“.
