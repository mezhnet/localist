# Fortschritt

## Aktueller Stand
- Etappe: 22 – Ziehen und Ablegen (abgeschlossen am 2026-11-01). Danach auf Wunsch von Emre Version 2.3.1: signierte Android-APK aus dem Release-Workflow und „Nach Updates suchen“ auf dem Handy (veröffentlicht 2026-11-01), dann 2.3.2 mit eigenem Android-App-Symbol. Auftrag 2.3: `docs/auftrag-version-2.3.md`. Version 2.2: `archiv/FORTSCHRITT-2.2.md`, bis 2.1: `archiv/FORTSCHRITT-bis-2.1.md`.
- Zuletzt aktualisiert: 2026-11-01 13:11
- Nächster Schritt: keiner offen. Release v2.3.2 steht mit Installer, MSI und `Localist_2.3.2_android.apk` (signiert, `3b6d407d…783f`, Adaptive Icon geprüft mit `aapt2`; Lauf 41303748053, beide Jobs grün). Im Hauptordner einmal `git pull`. Neue Arbeit erst mit einem neuen Auftrag (2.4–2.6 unversioniert in `docs/`); dann Version 2.3 nach `archiv/` verschieben.
- Hinweise für spätere Sitzungen: (a) Handy = schmaler Bildschirm unter 769 px (`useSchmal()` in `Reiterleiste.tsx`, Klasse `is-handy` am `.workspace`), Navigationsleiste `src/components/Navigationsleiste.tsx`, Leiste über der Tastatur `src/components/Tastaturleiste.tsx`, Handy-Einstellungen `HandyEinstellungen` in `Dialogs.tsx`. (b) Prüfskripte: `scripts/handy-pruefung.mjs` (360 × 740, Tippflächen ≥ 44 px, auch im iframe), `scripts/vorlage-vergleich.mjs … handy` (Vorlagen 03–05), `scripts/android-handy-pruefung.mjs` und `scripts/android-statusleiste-pruefung.mjs` (Emulator, nur mit `ANDROID_SERIAL`), `scripts/klickliste.mjs … 1.0|2.0|2.1`. (c) Fremden Emulator „Kartei_Test“ (`emulator-5554`) nie anfassen, eigenen „Medium_Phone_API_37.0“ auf Port 5556 starten. (d) Nach einem Versionswechsel `npm run build`, damit die gebündelten Bausteine die neue Version tragen. (e) Bash-Heredocs verschlucken `\\`: Umbau-Skripte mit dem Write-Werkzeug schreiben.

## Fertig-Kriterien der aktuellen Etappe
- [x] Phase 0 erledigt: Version 2.2 liegt im Archiv, `CLAUDE.md` ist ergänzt und committet.
- [x] Phase 1: Die Tabelle „Ziehen vorher“ (PC-EXE und Android) steht in `FORTSCHRITT.md`. (Abschnitt „Ziehen vorher“; `scripts/ziehen-pruefung.mjs … vorher`, `scripts/android-ziehen-pruefung.mjs … vorher`)
- [x] Am PC funktioniert Ziehen in der gebauten `localist.exe` mit echter Maus: Seitenleiste, Kanban, Ziehgriff, Notizbuch-Reihenfolge (Nachweis im Chat). (`node scripts/ziehen-pruefung.mjs src-tauri/target/release/localist.exe docs/screenshots/etappe-22 nachher`: alle 9 Orte „geht“, Ziehgriff `dragover 47`/`drop 1`; Bild aus dem Explorer wird abgewiesen (OLE-Effekt `None`), die Seite bleibt)
- [x] Ziehen in der Seitenleiste mit Hervorhebung, Aufklappen beim Verweilen, Auto-Scroll, Escape, Namenskonflikt-Meldung und „Rückgängig“, getestet. (`src/lib/ziehen.ts`, Tests `src/lib/ziehen.test.tsx` 13, `tree.test.ts` „Regeln beim Ziehen …“ 2, `App.test.tsx` „Ziehen und Ablegen (Etappe 22)“ 6; Klickliste 2.3 4/4)
- [x] Auf dem Handy greift langes Drücken eine Zeile und lässt sich ablegen. Scrollen, Tippen und Kontextmenü funktionieren wie vorher. Kanban und Notizbuch-Reihenfolge gehen auch per Finger. Nachweis mit `adb` im Chat. (`scripts/android-ziehen-pruefung.mjs … nachher` im Emulator 5556: alle 8 Punkte „geht“; Screenshots `docs/screenshots/etappe-22/android-seite-ziehen.png`, `android-kanban-ziehen.png`; Tests mit falschen Zeitgebern in `ziehen.test.tsx`; `scripts/handy-pruefung.mjs` 26/26, Tippflächen ≥ 44 px)
- [x] Arbeitsregel 6 erfüllt, APK baut, `localist.exe --sicherheitstest` 21/21, Klicklisten 1.0, 2.0, 2.1 und 2.3 abgehakt. (`npm test` 43 Dateien/508, `cargo test` 44, `tsc` ohne Fehler, `npm run tauri build` 2.3.0 EXIT=0, APK 2.3.0 EXIT=0, Sicherheitstest 21/21, Klicklisten 12/12, 7/7, 9/9, 4/4)
- [x] Version 2.3.0 gesetzt, „Neu in Version 2.3“ in `README.md` und `ANLEITUNG.md`. (`node scripts/version.mjs 2.3.0` → cd6f92e „Version 2.3.0“, Tag `v2.3.0`; daac3f0)

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
- Etappe 22 – Ziehen und Ablegen auf PC und Handy (abgeschlossen am 2026-11-01): Phase 0 2775801, 20f0eee, 16823e3; Phase 1 e7eacc0; Phase 2 2636b5e, aa5810e; Phase 3 2cb5069; Prüfrunde 1 daac3f0, Funde behoben 9e85bc2; Version 2.3.0 cd6f92e (Tag `v2.3.0`); Screenshots `docs/screenshots/etappe-22/` (6 Bilder). Endnachweis mit EXE und APK 2.3.0: `scripts/ziehen-pruefung.mjs … nachher` alle 9 Orte „geht“, `scripts/android-ziehen-pruefung.mjs … nachher` alle 8 Punkte „geht“.

## Prüfrunden
- Runde 1 (2026-11-01): Arbeitsregel 6 grün, Klicklisten 12/12, 7/7, 9/9, 4/4, Sicherheitstest 21/21. Unabhängige Prüfung (Sonnet, lesend): B1 „Rückgängig“ rechnete mit dem Baum von vor dem Verschieben (Links in der verschobenen HTML-Seite bei anderer Ordnertiefe und Pfad-Links wie `[[Notizen/Ideen]]` blieben falsch), B2 „Rückgängig“ gab der Seite ihren Platz im Notizbuch nicht zurück. Beide behoben (`relocate` nimmt `treeRef.current`, `notizbuchWiederEinfuegen`), Test „„Rückgängig“ stellt alles genau wieder her …“ (scheitert ohne den Fix).
- Runde 2 (2026-11-01): `npm test` 508/508, Klicklisten 12/12, 7/7, 9/9, 4/4 – keine Funde A/B, Schluss.

## Offene Probleme
- Erledigt 2026-11-01: v2.3.0 und v2.3.1 veröffentlicht. Zu v2.3.1: Lauf 41301302555 (Windows erst rot durch den wackligen Test unten, nach „Re-run“ grün; Android rot an `setup-android`), APK danach mit dem reparierten Workflow per Start von Hand nachgebaut (Lauf 41302775088, grün).
- Für Emre: `%USERPROFILE%\.tauri\localist.key` sichern und den ersten echten Update-Test machen (2.2.1 installieren, 2.2.2 veröffentlichen, in der App aktualisieren; `ANLEITUNG-RELEASE.md`, Schritt 5). Erstes Release [v2.2.1](https://github.com/mezhnet/localist/releases/tag/v2.2.1) ist veröffentlicht (Run 41224614969 grün, `latest.json` mit Version 2.2.1, Signaturen mit Schlüssel-ID 6BEE31F67A3C789E).
- Debug-APKs hängen an v2.2.1 und v2.3.0 (`…_android-debug.apk`, Debug-Schlüssel dieses PCs). Ab 2.3.1 baut der Release-Workflow eine signierte APK (`Localist_X.Y.Z_android.apk`); von 2.3.0 aus einmal deinstallieren (Android lehnt sie sonst mit `INSTALL_FAILED_UPDATE_INCOMPATIBLE` ab, im Emulator gesehen).
- Für Emre: `C:\Users\emre\.localist-android\github-secrets.env` löschen (Secrets sind bei GitHub), den Ordner wie `.tauri` sichern. Auf dem Handy einmal die alte App deinstallieren und `Localist_2.3.1_android.apk` installieren.
- Wackliger Test: „Quiz-Formular: richtige Antwort per Auswahlknopf festlegen“ (`src/App.test.tsx`, Etappe 13) fand auf GitHubs Windows-Rechner den Dialog nicht (5 s); lokal grün. Vermutlich kommt die Bearbeiten-Nachricht, bevor die Seite eingelesen ist.
- Branch `claude/objective-rosalind-c1b1f0` (Commit e8d9be6): Android-App-Symbol mit Localist-Logo statt Tauri, noch nicht in `main`.
- Hinweis von GitHub, nicht dringend: `actions/checkout@v4` und `actions/setup-node@v4` nutzen noch Node 20 und laufen erzwungen mit Node 24. Bei Gelegenheit auf neuere Hauptversionen anheben.
- Beobachtet, nicht behoben: Läuft `npm test` neben anderer Last (z. B. Build), scheitern einzelne Tests in `App.test.tsx`/`bausteine.test.ts` (meist an der 5- bzw. 15-s-Grenze, einmal „inert“ der Handy-Ansicht „Seiten“). Einzeln und ohne Last sind sie grün, der volle Lauf auch (484/484).
- Ziehgriff im Block-Editor auf dem Handy: Senkrecht ziehen geht (Android-WebView startet HTML5-Ziehen nach langem Druck). Der Griff liegt aber am linken Bildschirmrand (x ≈ 8 CSS-px); wer von dort nach rechts zieht, löst die Zurück-Geste von Android aus, und die App schließt sich. Abhilfe bräuchte mehr Abstand links in Handy-Notizen (weicht von Vorlage 04 ab) oder einen eigenen Griff statt dem von BlockNote – ein Umbau für einen späteren Auftrag.
- Erledigte Einträge bis Version 2.2 stehen im Archiv.

## Entscheidungen
- 2026-11-01: Auf Wunsch von Emre bekommt jedes Release neben dem Windows-Installer eine Android-APK. Erst von Hand (Debug-APK 2.3.0), dann auf Emres „Ja, einrichten“ automatisch: Job `android` in `release.yml` (ubuntu-latest, `needs: release`, nur aarch64, Schlüssel aus den Secrets `ANDROID_KEYSTORE_BASE64`/`ANDROID_KEYSTORE_PASSWORD` nach `$RUNNER_TEMP`, `apksigner verify` vor `gh release upload`). Gradle signiert die Release-APK nur, wenn `keystore.properties` da ist (Git ignoriert sie). Lint vor Release-Builds aus (`checkReleaseBuilds = false`), weil Lint an den Kotlin-Plugins abstürzt. `gradlew` ist jetzt ausführbar (Linux).
- 2026-11-01: „Nach Updates suchen“ auch auf Android, nur nach Klick. Emre wollte zuerst automatisch suchen, hat dann aber „ein Button ‚Nach Updates suchen‘“ für beide gewählt, die Regel „nie automatisch“ in `CLAUDE.md` bleibt. Weg: `src-tauri/src/android_update.rs` legt die Adressen fest (latest.json wie am PC, APK `…/download/vX.Y.Z/Localist_X.Y.Z_android.apk`, Version nur `\d+.\d+.\d+`), `AktualisierenPlugin.kt` lädt mit `HttpURLConnection` (Release-Builds nur `https://github.com/`), prüft Paketname und Version der APK und öffnet den Installer (`ACTION_VIEW` über den vorhandenen FileProvider, Recht `REQUEST_INSTALL_PACKAGES`). Hängt die APK noch nicht am Release, meldet die App „… für Android noch nicht fertig“. Nur Debug-Builds lesen eine Testadresse aus `update-test-adresse.txt` im App-Datenordner. Bewusst geänderte Tests: Android-Tests in `UeberLocalist.test.tsx` (vorher nur der GitHub-Knopf) und `release-workflow.test.ts` (vorher genau ein Job).
- 2026-11-01: Nachweis im Emulator 5556: Release-APK (neuer Schlüssel) fragt echtes GitHub → „Du bist auf dem neuesten Stand (v2.3.0)“. Debug 2.3.0 → Testserver (`adb reverse`) → „Update verfügbar: v2.3.1“ → „Jetzt installieren“ (100 %) → Android fragt einmal nach der Erlaubnis → „Update this app?“ → Update → `versionName=2.3.1`, Vault noch offen.
- 2026-11-01: `release.yml` kann von Hand gestartet werden (`gh workflow run release.yml -f tag=vX.Y.Z`): Dann läuft nur der Android-Job für den Code dieses Tags und hängt die APK an dessen Release; nötig, weil ein „Re-run“ die alte Workflow-Datei nimmt. `setup-android` braucht `packages: platform-tools`.
Entscheidungen bis Version 2.1: `archiv/FORTSCHRITT-bis-2.1.md`, Version 2.2: `archiv/FORTSCHRITT-2.2.md`, jeweils Abschnitt „Entscheidungen“.
- 2026-11-01: Eigener Hook `src/lib/ziehen.ts` (Pointer Events) statt `@dnd-kit/core`: keine neue Bibliothek, und die Sonderfälle (Menü beim Loslassen ohne Bewegung, Aufklappen beim Verweilen, Mit-Scrollen in genau einem Bereich, kein Systemmenü von Android) hätte man bei dnd-kit ohnehin selbst bauen müssen. Maus greift ab 4 px Bewegung, Finger nach 400 ms ohne Bewegung (bis 8 px Toleranz); Bewegung vorher bleibt Wischen.
- 2026-11-01: Der Hook ersetzt HTML5-Drag-and-Drop in Seitenleiste, Kanban und Notizbuch auch am PC (ein Weg für Maus und Finger). Der Kalender bleibt bei HTML5 (nicht Teil des Auftrags, geht am PC wieder dank `dragDropEnabled: false`). Bewusst geänderte Tests (Verhalten gleich, nur Pointer- statt Drag-Ereignisse): `App.test.tsx` „Drag & Drop in eine andere Spalte …“, „Verschieben per Drag & Drop …“, „Reihenfolge per Drag & Drop …“; Klickliste 1.0 Punkt 6 zieht die Kanban-Karte jetzt mit der Maus statt per Skript-Ereignis.
- 2026-11-01: Mit `dragDropEnabled: false` würde die WebView eine aus dem Explorer fallengelassene Datei selbst öffnen (App weg). `fremdeDateienAbweisen()` in `main.tsx` verhindert das (Zeiger „nicht erlaubt“). Ein Bild aus dem Explorer in eine Notiz ziehen ging schon vorher nicht (Phase 1) und bleibt so.
- 2026-11-01: Namenskonflikt, Meldung mit „Rückgängig“ und Rückgängig selbst gelten für jedes Verschieben (Ziehen und „Verschieben nach …“), ein Weg in `Workspace.move`. Die Meldung liegt jetzt außerhalb von `<main>`, weil `<main>` auf dem Handy hinter der Ansicht „Seiten“ inert ist.
- 2026-11-01: `scripts/version.mjs` prüft nur noch versionierte Dateien auf Änderungen (`--untracked-files=no`): Die Aufträge 2.4–2.6 liegen unversioniert im Ordner und sollen unangetastet bleiben; committet wird ohnehin nur mit `git add -u`. Neuer Test in `scripts/version.test.mjs`.
- 2026-11-01: Berechtigung `VIBRATE` im Android-Manifest (normale Berechtigung ohne Rückfrage) für das kurze Vibrieren beim Greifen (`navigator.vibrate`); ohne sie vibriert einfach nichts.
- 2026-11-01: Die Kopie beim Ziehen liegt neben dem Zeiger (Maus: rechts darunter; Finger: darüber), nicht auf der gegriffenen Stelle: Sonst verdeckte sie in der 360-px-Vorschau genau die Hervorhebung des Ziels.
- 2026-11-01: Mit-Scrollen am Rand steigt quadratisch an: Linear scrollte die Liste schon beim Streifen der Randzone so schnell, dass in der Klickliste (Handy) das Ziel unter dem ruhenden Finger wegrutschte und in der obersten Ebene landete.
- 2026-11-01: Android-Symbol aus dem Localist-Logo: `npx tauri icon app-icon.json` schreibt die Mipmaps nach `src-tauri/gen/android` (Vorder-/Hintergrund getrennt in `app-icon-android-*.svg`, Logo höchstens 28,3 dp vom Mittelpunkt, sichere Zone 33 dp). Windows-Symbole bleiben byte-gleich; das dabei neu erzeugte `icon.icns` (macOS) wird verworfen. Nachweis: `docs/screenshots/android-symbol/`.
