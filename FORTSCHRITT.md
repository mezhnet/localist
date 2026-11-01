# Fortschritt

## Aktueller Stand
- Etappe: 23 – Pomodoro, Grundversion (in Arbeit). Auftrag: `docs/auftrag-version-2.4.md`. Version 2.3: `archiv/FORTSCHRITT-2.3.md`, 2.2: `archiv/FORTSCHRITT-2.2.md`, bis 2.1: `archiv/FORTSCHRITT-bis-2.1.md`.
- Zuletzt aktualisiert: 2026-11-01 13:30
- Nächster Schritt: Phase 1 – `tauri-plugin-notification` einbinden, `src/lib/benachrichtigungen.ts` mit Tests.
- Hinweise für spätere Sitzungen: (a) Handy = schmaler Bildschirm unter 769 px (`useSchmal()` in `Reiterleiste.tsx`, Klasse `is-handy` am `.workspace`), Navigationsleiste `src/components/Navigationsleiste.tsx`, Leiste über der Tastatur `src/components/Tastaturleiste.tsx`, Handy-Einstellungen `HandyEinstellungen` in `Dialogs.tsx`. (b) Prüfskripte: `scripts/handy-pruefung.mjs` (360 × 740, Tippflächen ≥ 44 px, auch im iframe), `scripts/vorlage-vergleich.mjs … handy` (Vorlagen 03–05), `scripts/android-handy-pruefung.mjs` und `scripts/android-statusleiste-pruefung.mjs` (Emulator, nur mit `ANDROID_SERIAL`), `scripts/klickliste.mjs … 1.0|2.0|2.1|2.3`. (c) Fremden Emulator „Kartei_Test“ (`emulator-5554`) nie anfassen, eigenen „Medium_Phone_API_37.0“ auf Port 5556 starten. (d) Nach einem Versionswechsel `npm run build`, damit die gebündelten Bausteine die neue Version tragen. (e) Bash-Heredocs verschlucken `\\`: Umbau-Skripte mit dem Write-Werkzeug schreiben.

## Fertig-Kriterien der aktuellen Etappe
- [ ] Phase 0 erledigt, `CLAUDE.md` ergänzt (Werkzeuge, Pomodoro-Verlauf) und committet.
- [ ] `src/lib/benachrichtigungen.ts` mit Plugin auf Windows und Android, Berechtigung mit Erklärung, getestet, je eine echte Benachrichtigung in EXE und Emulator.
- [ ] Pomodoro-Ansicht mit Phasen, einstellbaren Dauern, langer Pause nach N Runden, Leertaste und automatischem Start, getestet.
- [ ] Der Timer läuft überall weiter, rechnet mit dem Endzeitpunkt und übersteht Ruhezustand und Neustart (Tests). Mini-Timer auf PC und Handy.
- [ ] Ton und Benachrichtigung am Ende. Auf Android kommt sie auch bei App im Hintergrund (Nachweis mit `adb` im Chat).
- [ ] Ziel, „Pomodoro für diese Seite starten“ und Verlauf in `.localist/pomodoro/YYYY-MM.jsonl` mit „Heute“ und „Diese Woche“, getestet.
- [ ] Arbeitsregel 6 erfüllt, APK baut, Sicherheitstest 21/21, Klicklisten 1.0, 2.0, 2.1, 2.3 und 2.4 abgehakt.
- [ ] Version 2.4.0 gesetzt, „Neu in Version 2.4“ in `README.md` und `ANLEITUNG.md`.

## Klickliste „Version 2.3“
Feste Liste für Version 2.3, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.3` (Maus bei 1280 × 800, Finger bei 360 × 740 mit Touch).

Letzter Stand: 2026-11-01 02:54, Etappe 22, alle 4 Punkte bestanden.
- [x] Seite in einen Ordner ziehen, danach „Rückgängig“.
- [x] Ordner in einen anderen Ordner ziehen; ein Link auf eine Seite darin funktioniert danach noch.
- [x] Handy-Ansicht 360 × 740 mit Touch: lange drücken, ziehen, ablegen.
- [x] Kanban-Karte auf dem Handy in eine andere Spalte ziehen.

## Klickliste „Version 1.0“
Feste Liste aus Arbeitsregel 7, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 1.0` (echte Tastatur und Maus in Microsoft Edge).

Letzter Stand: 2026-11-01 03:20, Etappe 22, alle 12 Punkte bestanden (Punkt 6 zieht seit Etappe 22 mit der Maus).
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

Letzter Stand: 2026-11-01 03:21, Etappe 22, alle 7 Punkte bestanden.
- [x] HTML-Seite anlegen: „Neu“ → „HTML-Seite“ legt `Unbenannt.html` nach dem Speicherformat an (mit `localist-id`) und öffnet sie in „Geteilt“.
- [x] Code bearbeiten: Im Code-Editor tippen; gespeichert wird nur die geänderte Stelle, die Vorschau zeigt den neuen Text.
- [x] Jeder Baustein: alle 13 Bausteine über die Werkzeugleiste einfügen (Bild und Seitenlink mit Auswahl), in „Lesen“ dargestellt, Karteikarte per Klick umdrehen.
- [x] Eigener Baustein: markierten Code „Als Baustein speichern“, er erscheint in der Werkzeugleiste und lässt sich einfügen.
- [x] Notizbuch: Ordner „Notizen“ in ein Notizbuch umwandeln, Inhaltsverzeichnis, „Weiter“.
- [x] Umwandeln: „Ideen“ nach Rückfrage in eine HTML-Seite umwandeln, Links und Notizbuch-Eintrag werden angepasst.
- [x] Export: „DNS“ als eigenständige HTML-Datei exportieren (CSS und Skript eingebettet).

## Klickliste „Version 2.1“
Feste Liste für Version 2.1, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.1` (1280 × 800).

Letzter Stand: 2026-11-01 03:22, Etappe 22, alle 9 Punkte bestanden.
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
- noch keine

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
Entscheidungen bis Version 2.1: `archiv/FORTSCHRITT-bis-2.1.md`, Version 2.2: `archiv/FORTSCHRITT-2.2.md`, Version 2.3: `archiv/FORTSCHRITT-2.3.md`, jeweils Abschnitt „Entscheidungen“.
