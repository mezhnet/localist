# Fortschritt

## Aktueller Stand
- Etappe: 22 – Ziehen und Ablegen auf PC und Handy (Version 2.3, in Arbeit). Auftrag: `docs/auftrag-version-2.3.md`. Version 2.2: `archiv/FORTSCHRITT-2.2.md`, bis 2.1: `archiv/FORTSCHRITT-bis-2.1.md`.
- Zuletzt aktualisiert: 2026-11-01 02:55
- Nächster Schritt: EXE mit echter Maus prüfen (`node scripts/ziehen-pruefung.mjs src-tauri/target/release/localist.exe docs/screenshots/etappe-22 nachher`), dann Phase 3 im Emulator (`scripts/android-ziehen-pruefung.mjs … nachher`, APK neu bauen).
- Hinweise für spätere Sitzungen: (a) Handy = schmaler Bildschirm unter 769 px (`useSchmal()` in `Reiterleiste.tsx`, Klasse `is-handy` am `.workspace`), Navigationsleiste `src/components/Navigationsleiste.tsx`, Leiste über der Tastatur `src/components/Tastaturleiste.tsx`, Handy-Einstellungen `HandyEinstellungen` in `Dialogs.tsx`. (b) Prüfskripte: `scripts/handy-pruefung.mjs` (360 × 740, Tippflächen ≥ 44 px, auch im iframe), `scripts/vorlage-vergleich.mjs … handy` (Vorlagen 03–05), `scripts/android-handy-pruefung.mjs` und `scripts/android-statusleiste-pruefung.mjs` (Emulator, nur mit `ANDROID_SERIAL`), `scripts/klickliste.mjs … 1.0|2.0|2.1`. (c) Fremden Emulator „Kartei_Test“ (`emulator-5554`) nie anfassen, eigenen „Medium_Phone_API_37.0“ auf Port 5556 starten. (d) Nach einem Versionswechsel `npm run build`, damit die gebündelten Bausteine die neue Version tragen. (e) Bash-Heredocs verschlucken `\\`: Umbau-Skripte mit dem Write-Werkzeug schreiben.

## Fertig-Kriterien der aktuellen Etappe
- [x] Phase 0 erledigt: Version 2.2 liegt im Archiv, `CLAUDE.md` ist ergänzt und committet.
- [x] Phase 1: Die Tabelle „Ziehen vorher“ (PC-EXE und Android) steht in `FORTSCHRITT.md`. (Abschnitt „Ziehen vorher“; `scripts/ziehen-pruefung.mjs … vorher`, `scripts/android-ziehen-pruefung.mjs … vorher`)
- [ ] Am PC funktioniert Ziehen in der gebauten `localist.exe` mit echter Maus: Seitenleiste, Kanban, Ziehgriff, Notizbuch-Reihenfolge (Nachweis im Chat).
- [x] Ziehen in der Seitenleiste mit Hervorhebung, Aufklappen beim Verweilen, Auto-Scroll, Escape, Namenskonflikt-Meldung und „Rückgängig“, getestet. (`src/lib/ziehen.ts`, Tests `src/lib/ziehen.test.tsx` 13, `tree.test.ts` „Regeln beim Ziehen …“ 2, `App.test.tsx` „Ziehen und Ablegen (Etappe 22)“ 6; Klickliste 2.3 4/4)
- [ ] Auf dem Handy greift langes Drücken eine Zeile und lässt sich ablegen. Scrollen, Tippen und Kontextmenü funktionieren wie vorher. Kanban und Notizbuch-Reihenfolge gehen auch per Finger. Nachweis mit `adb` im Chat.
- [ ] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten 1.0, 2.0, 2.1 und 2.3 abgehakt.
- [ ] Version 2.3.0 gesetzt, „Neu in Version 2.3“ in `README.md` und `ANLEITUNG.md`.

## Ziehen vorher (Phase 1, Stand 2.2.1)
PC: gebaute `localist.exe` 2.2.1 mit echter Maus (`node scripts/ziehen-pruefung.mjs <exe> <Ordner> vorher`, Eingaben über `mouse_event` in `scripts/fenster-helfer.ps1`, Datei per OLE-Ziehen wie aus dem Explorer). Handy: Debug-APK 2.2.1 im Emulator 5556 (`node scripts/android-ziehen-pruefung.mjs <adb> <apk> <Ordner> vorher`, `input motionevent DOWN`, 0,9 s Pause, `MOVE` …, `UP`).

| Ort | PC (EXE) | Handy (APK) | Ursache |
|---|---|---|---|
| Seite in einen Ordner | geht nicht | geht nicht | PC: Tauri fängt jedes Ziehen ab (`dragDropEnabled` fehlt): `dragstart 1`, `dragover 0`, `drop 0`, Zeiger „verboten“. Handy: langes Drücken öffnet das Menü „Aktionen für …“, ein Ziehen startet nicht. |
| Ordner in einen Ordner | geht nicht | geht nicht | wie oben |
| Seite in die Vault-Wurzel | geht nicht | nicht geprüft | PC wie oben; außerdem gibt es keine freie Ablagefläche für die Wurzel (nur eine Seite der Wurzel als Ziel). |
| Kanban-Karte in eine andere Spalte | geht nicht | geht nicht | PC wie oben; Handy: HTML5-Ziehen per Finger startet auf der Karte nicht. |
| Ziehgriff im Block-Editor | geht nicht | geht (senkrecht) | PC wie oben. Handy: Der Griff liegt am linken Rand (x ≈ 8 CSS-px); waagerechtes Ziehen von dort ist die Zurück-Geste von Android und schließt die App. |
| Reihenfolge im Notizbuch | geht nicht | geht | PC wie oben; Handy: Android-WebView startet HTML5-Ziehen nach langem Druck. |
| Bild aus dem Explorer in eine Notiz | geht nicht | – | Tauri nimmt die Datei an (Effekt `Copy, Move, Link`), die Seite bekommt kein `drop`. Natives Ablegen (`onDragDropEvent`, `tauri://drag-drop`) nutzt die App nirgends (grep in `src`, `src-tauri/src`: 0 Treffer). |
| Tippen, Wischen, langes Drücken (Seitenleiste) | – | geht | Tippen öffnet, Wischen scrollt (`scrollTop` 0 → 1045), langes Drücken ohne Bewegung zeigt „Aktionen für „Ideen““, kein markierter Text. |

## Klickliste „Version 2.3“
Feste Liste für Version 2.3, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.3` (Maus bei 1280 × 800, Finger bei 360 × 740 mit Touch).

Letzter Stand: 2026-11-01 02:54, Etappe 22, alle 4 Punkte bestanden.
- [x] Seite in einen Ordner ziehen, danach „Rückgängig“.
- [x] Ordner in einen anderen Ordner ziehen; ein Link auf eine Seite darin funktioniert danach noch.
- [x] Handy-Ansicht 360 × 740 mit Touch: lange drücken, ziehen, ablegen.
- [x] Kanban-Karte auf dem Handy in eine andere Spalte ziehen.

## Klickliste „Version 1.0“
Feste Liste aus Arbeitsregel 7, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 1.0` (echte Tastatur und Maus in Microsoft Edge).

Letzter Stand: 2026-10-31 10:22, Etappe 21 (Version 2.2.0), alle 12 Punkte bestanden.
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

Letzter Stand: 2026-10-31 10:22, Etappe 21 (Version 2.2.0), alle 7 Punkte bestanden.
- [x] HTML-Seite anlegen: „Neu“ → „HTML-Seite“ legt `Unbenannt.html` nach dem Speicherformat an (mit `localist-id`) und öffnet sie in „Geteilt“.
- [x] Code bearbeiten: Im Code-Editor tippen; gespeichert wird nur die geänderte Stelle, die Vorschau zeigt den neuen Text.
- [x] Jeder Baustein: alle 13 Bausteine über die Werkzeugleiste einfügen (Bild und Seitenlink mit Auswahl), in „Lesen“ dargestellt, Karteikarte per Klick umdrehen.
- [x] Eigener Baustein: markierten Code „Als Baustein speichern“, er erscheint in der Werkzeugleiste und lässt sich einfügen.
- [x] Notizbuch: Ordner „Notizen“ in ein Notizbuch umwandeln, Inhaltsverzeichnis, „Weiter“.
- [x] Umwandeln: „Ideen“ nach Rückfrage in eine HTML-Seite umwandeln, Links und Notizbuch-Eintrag werden angepasst.
- [x] Export: „DNS“ als eigenständige HTML-Datei exportieren (CSS und Skript eingebettet).

## Klickliste „Version 2.1“
Feste Liste für Version 2.1, automatisch mit `node scripts/klickliste.mjs <Vorschau-URL> "<Etappe>" 2.1` (1280 × 800).

Letzter Stand: 2026-10-31 10:22, Etappe 21 (Version 2.2.0), alle 9 Punkte bestanden.
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

## Offene Probleme
- Für Emre: `%USERPROFILE%\.tauri\localist.key` sichern und den ersten echten Update-Test machen (2.2.1 installieren, 2.2.2 veröffentlichen, in der App aktualisieren; `ANLEITUNG-RELEASE.md`, Schritt 5). Erstes Release [v2.2.1](https://github.com/mezhnet/localist/releases/tag/v2.2.1) ist veröffentlicht (Run 41224614969 grün, `latest.json` mit Version 2.2.1, Signaturen mit Schlüssel-ID 6BEE31F67A3C789E).
- Debug-APK 2.2.1 hängt am Release v2.2.1 (`Localist_2.2.1_android-debug.apk`, 299 244 782 Bytes, sha256 `60c5bc4e…0ea4`, im Emulator 5556 als 2.2.1 geprüft). Signierte Release-APK kommt mit einem späteren Auftrag.
- Hinweis von GitHub, nicht dringend: `actions/checkout@v4` und `actions/setup-node@v4` nutzen noch Node 20 und laufen erzwungen mit Node 24. Bei Gelegenheit auf neuere Hauptversionen anheben.
- Beobachtet, nicht behoben: Läuft `npm test` neben anderer Last (z. B. Build), scheitern einzelne Tests in `App.test.tsx`/`bausteine.test.ts` (meist an der 5- bzw. 15-s-Grenze, einmal „inert“ der Handy-Ansicht „Seiten“). Einzeln und ohne Last sind sie grün, der volle Lauf auch (484/484).
- Erledigte Einträge bis Version 2.2 stehen im Archiv.

## Entscheidungen
Entscheidungen bis Version 2.1: `archiv/FORTSCHRITT-bis-2.1.md`, Version 2.2: `archiv/FORTSCHRITT-2.2.md`, jeweils Abschnitt „Entscheidungen“.
- 2026-11-01: Eigener Hook `src/lib/ziehen.ts` (Pointer Events) statt `@dnd-kit/core`: keine neue Bibliothek, und die Sonderfälle (Menü beim Loslassen ohne Bewegung, Aufklappen beim Verweilen, Mit-Scrollen in genau einem Bereich, kein Systemmenü von Android) hätte man bei dnd-kit ohnehin selbst bauen müssen. Maus greift ab 4 px Bewegung, Finger nach 400 ms ohne Bewegung (bis 8 px Toleranz); Bewegung vorher bleibt Wischen.
- 2026-11-01: Der Hook ersetzt HTML5-Drag-and-Drop in Seitenleiste, Kanban und Notizbuch auch am PC (ein Weg für Maus und Finger). Der Kalender bleibt bei HTML5 (nicht Teil des Auftrags, geht am PC wieder dank `dragDropEnabled: false`). Bewusst geänderte Tests (Verhalten gleich, nur Pointer- statt Drag-Ereignisse): `App.test.tsx` „Drag & Drop in eine andere Spalte …“, „Verschieben per Drag & Drop …“, „Reihenfolge per Drag & Drop …“; Klickliste 1.0 Punkt 6 zieht die Kanban-Karte jetzt mit der Maus statt per Skript-Ereignis.
- 2026-11-01: Mit `dragDropEnabled: false` würde die WebView eine aus dem Explorer fallengelassene Datei selbst öffnen (App weg). `fremdeDateienAbweisen()` in `main.tsx` verhindert das (Zeiger „nicht erlaubt“). Ein Bild aus dem Explorer in eine Notiz ziehen ging schon vorher nicht (Phase 1) und bleibt so.
- 2026-11-01: Namenskonflikt, Meldung mit „Rückgängig“ und Rückgängig selbst gelten für jedes Verschieben (Ziehen und „Verschieben nach …“), ein Weg in `Workspace.move`. Die Meldung liegt jetzt außerhalb von `<main>`, weil `<main>` auf dem Handy hinter der Ansicht „Seiten“ inert ist.
- 2026-11-01: Mit-Scrollen am Rand steigt quadratisch an: Linear scrollte die Liste schon beim Streifen der Randzone so schnell, dass in der Klickliste (Handy) das Ziel unter dem ruhenden Finger wegrutschte und in der obersten Ebene landete.
