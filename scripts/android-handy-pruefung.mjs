// Android-Prüfung für Etappe 20 (Handy und Version 2.1) im Emulator oder auf einem Gerät mit USB-Debugging:
// Startseite, untere Navigationsleiste, Notiz bearbeiten mit der Leiste über der Bildschirmtastatur und „Fertig“,
// Einstellungen → Darstellung (Hell, Dunkel, Schwarz und eine andere Akzentfarbe), Seite „Bausteine“ und eine
// HTML-Seite in „Lesen“ und „Code“. Bedient wird mit echten Fingertipps (`adb shell input tap`) und der echten
// Bildschirmtastatur (`adb shell input text`); gelesen wird über die WebView-Entwicklerschnittstelle der Debug-APK.
// Jeder adb-Befehl steht mit seiner Ausgabe im Bericht, Screenshots per `adb exec-out screencap`.
// Das Gerät wählt `ANDROID_SERIAL` (z. B. emulator-5556), damit kein fremdes Gerät angesprochen wird.
//
// Aufruf: set ANDROID_SERIAL=emulator-5556 & node scripts/android-handy-pruefung.mjs <adb.exe> <app-universal-debug.apk> <beispiel-vault> <Screenshot-Ordner>
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [adb, apk, vaultQuelle, outDir] = process.argv.slice(2);
if (!adb || !apk || !vaultQuelle || !outDir || !process.env.ANDROID_SERIAL) {
  console.error("Aufruf mit gesetztem ANDROID_SERIAL: node scripts/android-handy-pruefung.mjs <adb.exe> <app-universal-debug.apk> <beispiel-vault> <Screenshot-Ordner>");
  process.exit(2);
}
const PAKET = "de.localist.desktop";
const VAULT_NAME = "Localist-Handy";
const VAULT_GERAET = `/sdcard/Documents/${VAULT_NAME}`;
const PORT = 9339;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const report = [];
const run = (args, { log = true, binary = false } = {}) => {
  const result = spawnSync(adb, args, { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (log) {
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/).slice(-4).join("\n      ");
    report.push(`> adb ${args.join(" ")}\n      ${text}`);
  }
  return result;
};
const shell = (command, options) => run(["shell", command], options);
let nummer = 0;
const screenshot = (name) => {
  const file = join(outDir, `${String(++nummer).padStart(2, "0")}-${name}.png`);
  writeFileSync(file, run(["exec-out", "screencap", "-p"], { log: false, binary: true }).stdout);
  report.push(`> adb exec-out screencap -p > ${file}`);
  return file;
};
/** Ist die Bildschirmtastatur offen? (Android meldet es im Eingabe-Dienst.) */
const tastaturOffen = () => /mInputShown=true|isInputViewShown=true/.test(shell("dumpsys input_method", { log: false }).stdout);

// 1. Gerät, Installation, Vault-Kopie, Zugriff auf alle Dateien, Start
run(["devices"]);
shell("getprop ro.build.version.release");
run(["install", "-r", apk]);
shell(`dumpsys package ${PAKET} | grep versionName`);
const kopie = join(mkdtempSync(join(tmpdir(), "localist-android-")), VAULT_NAME);
cpSync(vaultQuelle, kopie, { recursive: true });
shell(`rm -rf ${VAULT_GERAET}`, { log: false });
run(["push", kopie, VAULT_GERAET]);
rmSync(join(kopie, ".."), { recursive: true, force: true });
shell(`appops set ${PAKET} MANAGE_EXTERNAL_STORAGE allow`);
shell(`am force-stop ${PAKET}`, { log: false });
shell(`am start -n ${PAKET}/.MainActivity`);

let pid = "";
for (let i = 0; i < 50 && !pid; i++) {
  await sleep(200);
  pid = shell(`pidof ${PAKET}`, { log: false }).stdout.trim();
}
let socketName = "";
for (let i = 0; i < 50 && !socketName; i++) {
  await sleep(200);
  // Die Schnittstelle des neu gestarteten Prozesses (ältere Einträge können noch in der Liste stehen)
  const liste = shell("cat /proc/net/unix", { log: false }).stdout;
  socketName = liste.includes(`webview_devtools_remote_${pid}`) ? `webview_devtools_remote_${pid}` : "";
}
run(["forward", `tcp:${PORT}`, `localabstract:${socketName}`], { log: false });
let target;
for (let i = 0; i < 50 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  } catch {
    // WebView startet noch.
  }
  await sleep(200);
}
if (!target) {
  console.error(`Keine WebView-Entwicklerschnittstelle gefunden (Prozess ${pid}, Socket ${socketName || "–"}).`);
  process.exit(2);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => (socket.onopen = resolve));
let nextId = 1;
const pending = new Map();
const problems = [];
const contexts = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method === "Runtime.executionContextCreated") {
    const context = message.params.context;
    if (context.auxData?.isDefault && context.auxData.frameId) contexts.set(context.auxData.frameId, context.id);
  } else if (message.method === "Runtime.exceptionThrown") {
    problems.push(`Ausnahme: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
  } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    problems.push(`console.error: ${message.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression, contextId) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) })).result?.result?.value;
const waitFor = async (expression, what, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};
const SICHTBAR = `[...document.querySelectorAll('iframe.html-frame')].find((f) => !f.classList.contains('is-loading'))`;
async function inSeite(expression) {
  const src = await evaluate(`${SICHTBAR}?.src`);
  const finde = (frame) => (frame.frame.url === src ? frame.frame : (frame.childFrames ?? []).map(finde).find(Boolean));
  const { result } = await send("Page.getFrameTree");
  const frame = finde(result.frameTree);
  if (!frame || !contexts.has(frame.id)) throw new Error(`Seite nicht gefunden: ${src}`);
  return evaluate(expression, contexts.get(frame.id));
}

let geraet; // Umrechnung CSS-Pixel → Bildschirm
const aufGeraet = (x, y) => ({ x: Math.round(geraet.left + x * geraet.dpr), y: Math.round(geraet.top + y * geraet.dpr) });
/** Mitte eines Elements (Ausdruck liefert das Element) in Gerätepixeln; scrollt es vorher ins Bild, wenn nötig. */
async function wo(ausdruck, { scrollen = true, xAnteil = 0.5 } = {}) {
  const r = await evaluate(`(() => { const e = ${ausdruck}; if (!e) return null; ${scrollen ? 'const q = e.getBoundingClientRect(); if (q.top < 0 || q.bottom > innerHeight) e.scrollIntoView({ block: "center" });' : ""} const r = e.getBoundingClientRect(); return { x: r.x + r.width * ${xAnteil}, y: r.y + r.height / 2 }; })()`);
  if (!r) throw new Error(`Nicht gefunden: ${ausdruck}`);
  return aufGeraet(r.x, r.y);
}
async function tippe(ausdruck, was, optionen) {
  const p = await wo(ausdruck, optionen);
  shell(`input tap ${p.x} ${p.y}`, { log: false });
  report.push(`> adb shell input tap ${p.x} ${p.y}   (${was})`);
  await sleep(700);
}
const nav = (name) => `[...document.querySelectorAll(".handy-nav button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).trim() === ${JSON.stringify(name)})`;
const aktivNav = () => evaluate(`document.querySelector('.handy-nav [aria-current="page"]')?.textContent ?? "–"`);

try {
  await send("Runtime.enable");
  await send("Page.enable");
  await waitFor(`document.querySelector('.vault-name, .handy-nav') || [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Vault-Ordner öffnen'))`, "Oberfläche");
  await sleep(1500);
  // Localist öffnet die zuletzt offene Seite wieder: dann zuerst zur Startseite (dort steht der Vault-Umschalter).
  if (await evaluate(`Boolean(document.querySelector(".handy-nav") && !document.querySelector(".vault-name"))`)) {
    await evaluate(`[...document.querySelectorAll(".handy-nav button")].find((b) => b.textContent.trim() === "Start").click(); true`);
    await waitFor(`document.querySelector('.vault-name')`, "Startseite");
  }
  const groesse = /(\d+)x(\d+)/.exec(shell("wm size", { log: false }).stdout);
  const fenster = await evaluate(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
  // Die WebView füllt die Breite; oben liegt die Statusleiste. Wo die WebView beginnt, zeigt ihre Höhe im Vergleich
  // zum Bildschirm (sie reicht bis zum unteren Rand, auch unter die Gestenleiste).
  geraet = { dpr: fenster.dpr, left: 0, top: Number(groesse[2]) - fenster.h * fenster.dpr };
  report.push(`Bildschirm ${groesse[1]}×${groesse[2]} px, WebView ${fenster.w}×${fenster.h} CSS-Pixel, devicePixelRatio ${fenster.dpr}, WebView beginnt bei y=${Math.round(geraet.top)} px`);

  // 2. Vault-Kopie öffnen (eigene Ordnerauswahl von Localist)
  const vaultJetzt = await evaluate(`document.querySelector('.vault-name')?.textContent ?? null`);
  if (vaultJetzt !== VAULT_NAME) {
    if (vaultJetzt === null) await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Vault-Ordner öffnen")).click()`);
    else {
      await evaluate(`document.querySelector(".home-handy-vault, .vault-switcher").click()`);
      await waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.includes("Anderen Vault öffnen"))`, "Vault-Menü");
      await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.includes("Anderen Vault öffnen")).click()`);
    }
    await waitFor(`document.querySelector('.folder-picker [role="option"]')`, "Ordnerauswahl");
    await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.includes("/storage/emulated/0") || o.textContent.includes("Interner")).click()`);
    for (const ordner of ["Documents", VAULT_NAME]) {
      await waitFor(`[...document.querySelectorAll('.folder-picker [role="option"]')].some((o) => o.textContent.trim() === ${JSON.stringify(ordner)})`, `Ordner ${ordner}`);
      await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.trim() === ${JSON.stringify(ordner)}).click()`);
    }
    await sleep(300);
    await evaluate(`[...document.querySelectorAll(".folder-picker button")].find((b) => b.textContent.includes("Diesen Ordner als Vault verwenden")).click()`);
  }
  await waitFor(`document.querySelector('.vault-name')?.textContent === ${JSON.stringify(VAULT_NAME)} && document.querySelector('.handy-nav')`, "Vault-Kopie geöffnet");
  // Startzustand: Hell, Orange, Ansicht „Lesen“ (nur im App-Speicher, nicht im Vault)
  await evaluate(`localStorage.setItem("theme", "light"); localStorage.setItem("akzent", "orange"); localStorage.setItem("html-ansicht", "lesen"); location.reload(); true`);
  await sleep(2500);
  await waitFor(`document.querySelector('.handy-nav') && document.querySelector('.home-table-zeile')`, "Startseite nach dem Neuladen");
  await sleep(800);

  // 3. Startseite und Navigationsleiste
  const start = await evaluate(`(() => {
    const nav = document.querySelector(".handy-nav").getBoundingClientRect();
    const probe = document.createElement("div"); probe.style.cssText = "position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom)"; document.body.append(probe);
    const inset = getComputedStyle(probe).paddingBottom; probe.remove();
    return { version: document.querySelector(".app-version")?.textContent ?? null, kopf: [...document.querySelectorAll(".home-handy-kopf button")].map((b) => b.getAttribute("aria-label") ?? b.querySelector(".vault-name")?.textContent),
      datum: document.querySelector(".home-date").textContent, begruessung: document.querySelector(".home-greeting").textContent,
      zuletzt: [...document.querySelectorAll(".home-table-zeile")].length, navigation: [...document.querySelectorAll(".handy-nav button")].map((b) => b.textContent || b.getAttribute("aria-label")),
      navUnten: Math.round(innerHeight - nav.bottom), safeAreaUnten: inset, menueKnopfOben: Boolean(document.querySelector(".topbar-menu")) };
  })()`);
  report.push(`Startseite: ${JSON.stringify(start)}`);
  screenshot("startseite");

  await tippe(nav("Seiten"), "„Seiten“ in der Navigationsleiste");
  await waitFor(`document.querySelector(".sidebar-shell.open [role='tree']")`, "Ansicht „Seiten“");
  report.push(`Nach „Seiten“: aktiv „${await aktivNav()}“, Ordner: ${JSON.stringify(await evaluate(`[...document.querySelectorAll(".sidebar-shell.open .tree > li > .tree-row .tree-name")].map((e) => e.textContent)`))}`);
  screenshot("navigation-seiten");
  await tippe(nav("Suchen"), "„Suchen“");
  await waitFor(`document.querySelector('[role="dialog"][aria-label="Schnellsuche"]')`, "Schnellsuche");
  report.push(`Nach „Suchen“: Dialog „${await evaluate(`document.querySelector('[role="dialog"]').getAttribute("aria-label")`)}“, aktiv „${await aktivNav()}“`);
  screenshot("navigation-suchen");
  shell("input keyevent KEYCODE_BACK");
  await sleep(600);
  await evaluate(`document.querySelector('[role="dialog"]') && document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); document.querySelector('[role="dialog"]')?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
  await sleep(400);
  await tippe(nav("Neu"), "„+“ in der Navigationsleiste");
  await waitFor(`document.querySelector('[role="menu"][aria-label="Neu"]')`, "Neu-Menü");
  report.push(`Nach „+“: ${JSON.stringify(await evaluate(`[...document.querySelectorAll('[role="menu"][aria-label="Neu"] [role="menuitem"]')].map((m) => m.textContent)`))}`);
  screenshot("navigation-neu");
  await tippe(nav("Start"), "„Start“ (schließt das Menü)");
  await tippe(nav("Start"), "„Start“");
  report.push(`Nach „Start“: aktiv „${await aktivNav()}“, Startseite: ${await evaluate(`Boolean(document.querySelector('[aria-label="Startseite"]'))`)}`);

  // 4. Notiz bearbeiten: Leiste über der Bildschirmtastatur, Cursor nie verdeckt, „Fertig“ schließt die Tastatur
  await tippe(nav("Seiten"), "„Seiten“");
  await tippe(`document.querySelector('.sidebar-shell.open .tree [title="Notizen"]')`, "Ordner „Notizen“");
  await waitFor(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`, "Ideen im Ordnerbaum");
  await tippe(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`, "Seite „Ideen“");
  await waitFor(`[...document.querySelectorAll('.bn-editor .bn-inline-content')].some((e) => e.textContent === "Lesezeichen für Artikel")`, "Notiz Ideen");
  await sleep(800);
  const kopf = await evaluate(`({ zurueck: Boolean(document.querySelector(".topbar-zurueck")), ort: document.querySelector(".topbar-ort")?.textContent, stern: Boolean(document.querySelector(".topbar .favorite-toggle")), mehr: Boolean(document.querySelector(".topbar-mehr")) })`);
  report.push(`Notiz „Ideen“, Kopf: ${JSON.stringify(kopf)}, Tastatur offen: ${tastaturOffen() ? "ja" : "nein"}`);
  screenshot("notiz");
  await tippe(`[...document.querySelectorAll('.bn-editor .bn-inline-content')].find((e) => e.textContent === "Lesezeichen für Artikel")`, "Ende der letzten Zeile (Tastatur öffnet sich)", { xAnteil: 0.98 });
  await sleep(1500);
  const MESSEN = `(() => {
    const vv = visualViewport; const leiste = document.querySelector(".tastaturleiste"); const l = leiste?.getBoundingClientRect();
    const s = getSelection(); const r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null; r?.collapse(false); let c = r?.getBoundingClientRect(); if (r && !c.height) c = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).getBoundingClientRect();
    return { leiste: Boolean(leiste), knoepfe: leiste ? [...leiste.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? b.textContent) : [], navigation: getComputedStyle(document.querySelector(".handy-nav")).display,
      fenster: innerHeight, sichtbar: Math.round(vv.height), leisteOben: l ? Math.round(l.top) : null, leisteUnten: l ? Math.round(l.bottom) : null, cursorUnten: c ? Math.round(c.bottom) : null, fokusImEditor: document.querySelector(".bn-editor").contains(document.activeElement) };
  })()`;
  const offen = await evaluate(MESSEN);
  report.push(`Nach dem Fingertipp in den Text: Tastatur offen: ${tastaturOffen() ? "ja" : "NEIN"}, ${JSON.stringify(offen)}`);
  report.push(`  Leiste über der Tastatur: ${offen.leisteUnten !== null && offen.leisteUnten <= offen.sichtbar + 1 ? "ja" : "NEIN"} (Unterkante ${offen.leisteUnten} ≤ sichtbare Höhe ${offen.sichtbar}); Cursor über der Leiste: ${offen.cursorUnten !== null && offen.cursorUnten <= offen.leisteOben ? "ja" : "NEIN"} (${offen.cursorUnten} ≤ ${offen.leisteOben})`);
  screenshot("notiz-schreiben-tastatur");
  // Mit der Bildschirmtastatur tippen: neue Zeilen am Ende, bis der Text unten an die Leiste stößt
  shell("input keyevent KEYCODE_MOVE_END");
  for (let i = 1; i <= 6; i++) {
    shell("input keyevent KEYCODE_ENTER", { log: i === 1 });
    shell(`input text "Zeile%s${i}%svom%sHandy"`, { log: i === 1 });
    await sleep(500);
  }
  await sleep(800);
  const getippt = await evaluate(MESSEN);
  report.push(`Nach 6 neuen Zeilen über die Bildschirmtastatur: ${JSON.stringify(getippt)}`);
  report.push(`  Cursor über der Leiste: ${getippt.cursorUnten !== null && getippt.cursorUnten <= getippt.leisteOben ? "ja" : "NEIN"} (${getippt.cursorUnten} ≤ ${getippt.leisteOben}), Tastatur offen: ${tastaturOffen() ? "ja" : "NEIN"}`);
  screenshot("notiz-getippt");
  // „Checkliste“ in der Leiste: die letzte Zeile wird zur Checkliste (die Tastatur bleibt offen)
  await tippe(`document.querySelector('.tastaturleiste [aria-label="Checkliste"]')`, "„Checkliste“ in der Leiste", { scrollen: false });
  await sleep(1500);
  report.push(`Nach „Checkliste“: Tastatur offen: ${tastaturOffen() ? "ja" : "NEIN"}, Fokus im Editor: ${await evaluate(`document.querySelector(".bn-editor").contains(document.activeElement)`)}`);
  shell(`grep -n "vom Handy" ${VAULT_GERAET}/Notizen/Ideen.md`);
  screenshot("notiz-checkliste");
  await tippe(`document.querySelector('.tastaturleiste-fertig')`, "„Fertig“", { scrollen: false });
  await sleep(1200);
  const fertig = await evaluate(MESSEN);
  report.push(`Nach „Fertig“: Tastatur offen: ${tastaturOffen() ? "JA" : "nein"}, Leiste: ${fertig.leiste ? "JA" : "weg"}, Navigationsleiste: ${fertig.navigation}, Fokus im Editor: ${fertig.fokusImEditor}`);
  screenshot("notiz-fertig");

  // 5. Einstellungen → Darstellung: drei Modi und eine andere Akzentfarbe
  await tippe(nav("Einstellungen"), "„Einstell.“ in der Navigationsleiste");
  await waitFor(`document.querySelector(".handy-einstellung")`, "Einstellungen");
  screenshot("einstellungen");
  await tippe(`document.querySelector(".handy-einstellung")`, "Karte „Darstellung“");
  await waitFor(`document.querySelector(".darstellung.is-handy .modus-karte")`, "Darstellung");
  const modus = () => evaluate(`({ modus: document.documentElement.dataset.theme, akzent: document.documentElement.dataset.accent, hintergrund: getComputedStyle(document.querySelector(".handy-seite")).backgroundColor })`);
  for (const [name, datei] of [["Hell", "darstellung-hell"], ["Dunkel", "darstellung-dunkel"], ["Schwarz", "darstellung-schwarz"]]) {
    await tippe(`[...document.querySelectorAll(".modus-karte")].find((k) => k.textContent.startsWith(${JSON.stringify(name)}))`, `Vorschaukarte „${name}“`);
    report.push(`Nach „${name}“: ${JSON.stringify(await modus())}`);
    screenshot(datei);
  }
  await tippe(`document.querySelector('.akzent-punkt[aria-label="Grün"]')`, "Akzentfarbe „Grün“");
  report.push(`Nach „Grün“: ${JSON.stringify(await modus())}`);
  screenshot("darstellung-schwarz-gruen");
  await tippe(`document.querySelector(".handy-zurueck")`, "Zurück zu „Einstellungen“");
  await tippe(`document.querySelector(".handy-zurueck")`, "Einstellungen schließen");
  await waitFor(`!document.querySelector(".handy-seite")`, "Einstellungen geschlossen");
  await tippe(nav("Start"), "„Start“");
  await waitFor(`document.querySelector(".home-schnell-notiz")`, "Startseite");
  report.push(`Startseite in Schwarz mit Grün: Akzent-Knopf ${await evaluate(`getComputedStyle(document.querySelector(".home-schnell-notiz")).backgroundColor`)}`);
  screenshot("startseite-schwarz-gruen");

  // 6. Seite „Bausteine“
  await tippe(nav("Seiten"), "„Seiten“");
  await tippe(`[...document.querySelectorAll(".sidebar-shell.open .sidebar-item")].find((b) => b.textContent.trim().startsWith("Bausteine"))`, "„Bausteine“");
  await waitFor(`document.querySelector('.bibliothek-vorschau iframe.html-frame')`, "Seite Bausteine");
  await sleep(2000);
  report.push(`Seite „Bausteine“: ${JSON.stringify(await evaluate(`({ eintraege: document.querySelectorAll(".bibliothek-eintrag").length, quer: document.documentElement.scrollWidth > innerWidth + 1, kopf: document.querySelector(".topbar-ort")?.textContent })`))}`);
  screenshot("bausteine");
  await tippe(`[...document.querySelectorAll('[role="tab"]')].find((t) => t.textContent.trim() === "Hilfe")`, "Reiter „Hilfe“");
  await waitFor(`document.querySelector(".hilfe-eintrag")`, "Hilfe");
  screenshot("bausteine-hilfe");

  // 7. HTML-Seite in „Lesen“ und „Code“
  await tippe(nav("Seiten"), "„Seiten“");
  if (!(await evaluate(`Boolean(document.querySelector('.tree [title="Notizen/DNS.html"]'))`))) await tippe(`document.querySelector('.tree [title="Notizen"]')`, "Ordner „Notizen“");
  await tippe(`document.querySelector('.tree [title="Notizen/DNS.html"]')`, "Seite „DNS“");
  await waitFor(`${SICHTBAR} && document.querySelector('.html-preview').style.height`, "HTML-Seite DNS in „Lesen“");
  await sleep(1500);
  const lesen = await inSeite(`({ titel: document.title, callout: document.querySelector("l-callout")?.getAttribute("aria-label"), karte: Boolean(document.querySelector("l-karteikarte")), modus: document.documentElement.dataset.theme ?? document.documentElement.getAttribute("data-theme"), akzent: document.documentElement.getAttribute("data-accent") })`);
  report.push(`HTML-Seite „DNS“ in „Lesen“: ${JSON.stringify(lesen)}`);
  screenshot("html-lesen");
  await tippe(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent.trim() === "Code")`, "Ansicht „Code“");
  await waitFor(`document.querySelector('.cm-editor .cm-line') && document.querySelector('.baustein-leiste')`, "Code");
  await sleep(800);
  screenshot("html-code");
  await tippe(`[...document.querySelectorAll('.cm-content .cm-line')].find((l) => l.textContent.startsWith("<h1>"))`, "Zeile im Code-Editor (Tastatur öffnet sich)", { xAnteil: 0.9 });
  await sleep(1500);
  report.push(`Code-Editor mit Tastatur: Tastatur offen: ${tastaturOffen() ? "ja" : "NEIN"}, Navigationsleiste: ${await evaluate(`getComputedStyle(document.querySelector(".handy-nav")).display`)}, sichtbare Höhe ${await evaluate("Math.round(visualViewport.height)")} von ${await evaluate("innerHeight")}`);
  screenshot("html-code-tastatur");
  shell("input keyevent KEYCODE_BACK");
  await sleep(800);

  report.push(problems.length === 0 ? "Konsole: keine Fehler." : `Konsole: ${problems.length} Meldungen:\n  ${problems.join("\n  ")}`);
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
  report.push(...problems);
  screenshot("fehler");
  process.exitCode = 1;
} finally {
  console.log(report.join("\n"));
  socket.close();
  run(["forward", "--remove", `tcp:${PORT}`], { log: false });
  console.log(`Screenshots in ${outDir}.`);
}
