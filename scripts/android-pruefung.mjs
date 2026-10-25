// Prüft die Android-APK im Emulator (oder auf einem Gerät mit USB-Debugging): Installation, Vault-Kopie, HTML-Seite,
// Notizbuch, Karteikarte, Kartenstapel und Quiz mit echten Fingertipps (`adb shell input tap`), Code-Ansicht mit
// Werkzeugleiste (Wischen mit `adb shell input swipe`, Einfügen per Fingertipp). Screenshots per `adb exec-out screencap`.
// Gesteuert wird die Oberfläche über die WebView-Entwicklerschnittstelle der Debug-APK (nur Navigation und Auslesen;
// alles, was bedient werden soll, geschieht per Fingertipp). Jeder adb-Befehl wird mit seiner Ausgabe protokolliert.
//
// Aufruf: node scripts/android-pruefung.mjs <adb.exe> <app-universal-debug.apk> <beispiel-vault> <Screenshot-Ordner>
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const [adb, apk, vaultQuelle, outDir] = process.argv.slice(2);
if (!adb || !apk || !vaultQuelle || !outDir) {
  console.error("Aufruf: node scripts/android-pruefung.mjs <adb.exe> <app-universal-debug.apk> <beispiel-vault> <Screenshot-Ordner>");
  process.exit(2);
}
const PAKET = "de.localist.desktop";
const VAULT_NAME = "Localist-Pruefung";
const VAULT_GERAET = `/sdcard/Documents/${VAULT_NAME}`;
const PORT = 9338;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const report = [];
/** Führt adb aus und protokolliert Befehl und Ausgabe (gekürzt). */
const run = (args, { log = true, binary = false } = {}) => {
  const result = spawnSync(adb, args, { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (log) {
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/).slice(-4).join("\n      ");
    report.push(`> adb ${args.join(" ")}\n      ${text}`);
  }
  return result;
};
const shell = (command, options) => run(["shell", command], options);
const screenshot = (name) => {
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, run(["exec-out", "screencap", "-p"], { log: false, binary: true }).stdout);
  report.push(`> adb exec-out screencap -p > ${file}`);
  return file;
};

// 1. Gerät, Installation, Vault-Kopie, Zugriff auf alle Dateien, Start
run(["devices"]);
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
  socketName = /webview_devtools_remote_\d+/.exec(shell("cat /proc/net/unix", { log: false }).stdout)?.[0] ?? "";
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
const evaluate = async (expression, contextId) => {
  const answer = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) });
  return answer.result?.result?.value;
};
const waitFor = async (expression, what, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};
const klick = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const klickText = (selector, text) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim().includes(${JSON.stringify(text)})).click()`);
const SICHTBAR = `[...document.querySelectorAll('iframe.html-frame')].find((f) => !f.classList.contains('is-loading'))`;

/** Wertet einen Ausdruck in der gerade sichtbaren Seite (abgeschottetes iframe) aus. */
async function inSeite(expression) {
  const src = await evaluate(`${SICHTBAR}?.src`);
  const finde = (frame) => (frame.frame.url === src ? frame.frame : (frame.childFrames ?? []).map(finde).find(Boolean));
  const { result } = await send("Page.getFrameTree");
  const frame = finde(result.frameTree);
  if (!frame || !contexts.has(frame.id)) throw new Error(`Seite nicht gefunden: ${src}`);
  return evaluate(expression, contexts.get(frame.id));
}

/** Bildschirmpunkt (Gerätepixel) eines Elements in der sichtbaren Seite; scrollt es vorher in die Mitte. */
async function punkt(selector, { mitte = true } = {}) {
  const rect = `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`;
  const innen = await inSeite(rect);
  if (mitte) {
    await evaluate(`(() => {
      const frame = ${SICHTBAR};
      let box = frame.parentElement;
      while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
      (box ?? document.scrollingElement).scrollTop += frame.getBoundingClientRect().top + ${innen.y} + ${innen.h / 2} - innerHeight / 2;
    })()`);
    await sleep(400);
  }
  const neu = await inSeite(rect);
  const frame = await evaluate(`(() => { const r = ${SICHTBAR}.getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
  return aufGeraet(frame.x + neu.x + Math.min(neu.w / 2, 120), frame.y + neu.y + neu.h / 2);
}

let geraet; // Umrechnung CSS-Pixel → Bildschirm
const aufGeraet = (x, y) => ({ x: Math.round(geraet.left + x * geraet.dpr), y: Math.round(geraet.top + y * geraet.dpr) });
async function tippen(p, was) {
  shell(`input tap ${p.x} ${p.y}`, { log: false });
  report.push(`> adb shell input tap ${p.x} ${p.y}   (${was})`);
  await sleep(600);
}

try {
  await send("Runtime.enable");
  await send("Page.enable");
  await waitFor(`document.querySelector('.vault-name') || [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Vault-Ordner öffnen'))`, "Oberfläche");
  await sleep(1500);
  const groesse = /(\d+)x(\d+)/.exec(shell("wm size", { log: false }).stdout);
  const fenster = await evaluate(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
  const hoehe = Number(groesse[2]);
  // Die WebView füllt die Breite und reicht bis zum unteren Rand; oben liegt die Statusleiste.
  geraet = { dpr: fenster.dpr, left: 0, top: hoehe - fenster.h * fenster.dpr };
  report.push(`Bildschirm ${groesse[1]}×${groesse[2]} px, WebView ${fenster.w}×${fenster.h} CSS-Pixel, devicePixelRatio ${fenster.dpr}, WebView beginnt bei y=${Math.round(geraet.top)} px`);

  // 2. Vault-Kopie öffnen (eigene Ordnerauswahl von Localist)
  const vaultJetzt = await evaluate(`document.querySelector('.vault-name')?.textContent ?? null`);
  if (vaultJetzt !== VAULT_NAME) {
    if (vaultJetzt === null) await klickText("button", "Vault-Ordner öffnen");
    else {
      await klick(".vault-switcher");
      await waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.includes("Anderen Vault öffnen"))`, "Vault-Menü");
      await klickText('[role="menuitem"]', "Anderen Vault öffnen");
    }
    await waitFor(`document.querySelector('.folder-picker [role="option"]')`, "Ordnerauswahl");
    const orte = await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].map((o) => o.textContent)`);
    report.push(`Ordnerauswahl, Speicherorte: ${JSON.stringify(orte)}`);
    await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.includes("/storage/emulated/0") || o.textContent.includes("Interner")).click()`);
    for (const ordner of ["Documents", VAULT_NAME]) {
      await waitFor(`[...document.querySelectorAll('.folder-picker [role="option"]')].some((o) => o.textContent.trim() === ${JSON.stringify(ordner)})`, `Ordner ${ordner}`);
      await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.trim() === ${JSON.stringify(ordner)}).click()`);
    }
    await sleep(300);
    await klickText(".folder-picker button", "Diesen Ordner als Vault verwenden");
  }
  await waitFor(`document.querySelector('.vault-name')?.textContent === ${JSON.stringify(VAULT_NAME)} && document.querySelector('.tree [title="Lernen"]')`, "Vault-Kopie geöffnet");
  await evaluate(`localStorage.setItem("html-ansicht", "lesen"); true`);
  report.push(`Vault geöffnet: ${await evaluate(`document.querySelector('.vault-name').textContent`)}, Version in der Sidebar: ${await evaluate(`[...document.querySelectorAll('.sidebar *')].find((e) => e.children.length === 0 && /^v[0-9.]+$/.test(e.textContent.trim()))?.textContent`)}`);
  screenshot("01-vault");

  // 3. HTML-Seite lesen
  await klick('.tree [title="Notizen"]');
  await waitFor(`document.querySelector('.tree [title="Notizen/DNS.html"]')`, "DNS im Ordnerbaum");
  await klick('.tree [title="Notizen/DNS.html"]');
  await waitFor(`${SICHTBAR} && document.querySelector('.html-preview').style.height`, "HTML-Seite DNS");
  await sleep(1200);
  const dns = await inSeite(`({ titel: document.title, callout: document.querySelector("l-callout")?.getAttribute("aria-label"), bausteine: document.documentElement.getAttribute("data-localist-bausteine"), bild: document.querySelector("img")?.naturalWidth ?? null })`);
  report.push(`HTML-Seite „DNS“ in „Lesen“: ${JSON.stringify(dns)}`);
  screenshot("02-html-seite");

  // 4. Notizbuch lesen
  await klick('.tree [title="Lernen"]');
  await waitFor(`document.querySelector('.notizbuch-inhaltsseite iframe.html-frame:not(.is-loading)') && document.querySelector('.notizbuch-inhaltsseite .html-preview').style.height`, "Notizbuch");
  await sleep(1200);
  const notizbuch = {
    titel: await evaluate(`document.querySelector('.notizbuch-kopf h1').textContent`),
    inhalt: await evaluate(`[...document.querySelectorAll('.notizbuch-eintrag')].map((b) => b.textContent)`),
    seite: await inSeite(`({ adresse: location.pathname, callout: document.querySelector("l-callout")?.getAttribute("typ"), tabelle: document.querySelectorAll("table tr").length })`),
  };
  report.push(`Notizbuch: ${JSON.stringify(notizbuch)}`);
  screenshot("03-notizbuch");
  // „Weiter“ per Fingertipp
  await evaluate(`document.querySelector('.notizbuch-blaettern').scrollIntoView({ block: "center" })`);
  await sleep(400);
  const weiter = await evaluate(`(() => { const r = [...document.querySelectorAll('.notizbuch-blaettern button')].find((b) => b.textContent.startsWith("Weiter")).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await tippen(aufGeraet(weiter.x, weiter.y), "„Weiter“ im Notizbuch");
  await waitFor(`document.querySelector('.notizbuch-leiste h2')?.textContent === "Bausteine"`, "zweite Seite im Notizbuch");
  report.push(`Nach dem Fingertipp auf „Weiter“: Seite „${await evaluate(`document.querySelector('.notizbuch-leiste h2').textContent`)}“`);

  // 5. Karteikarte, Kartenstapel und Quiz per Fingertipp (Seite Lernen/Bausteine.html in „Lesen“)
  await klick('.tree [title="Lernen/Bausteine.html"]');
  await waitFor(`document.querySelector('[aria-label="Ansicht (Strg+E)"]') && ${SICHTBAR} && document.querySelector('.html-preview').style.height && ${SICHTBAR}.src.includes("Bausteine.html")`, "Bausteine.html");
  await sleep(1500);
  await tippen(await punkt("main > l-karteikarte"), "Karteikarte");
  const karte = await inSeite(`document.querySelector("main > l-karteikarte").hasAttribute("data-umgedreht")`);
  report.push(`Karteikarte nach Fingertipp umgedreht: ${karte ? "ja" : "NEIN"}`);
  screenshot("04-karteikarte");

  await tippen(await punkt("l-kartenstapel > l-karteikarte:not([hidden])"), "oberste Karte im Kartenstapel");
  await inSeite(`[...document.querySelectorAll("l-kartenstapel button")].find((b) => b.textContent === "Gewusst").id = "knopf-gewusst"`);
  await tippen(await punkt("#knopf-gewusst", { mitte: false }), "„Gewusst“");
  report.push(`Kartenstapel nach Umdrehen und „Gewusst“: „${await inSeite(`document.querySelector(".l-stapel-zaehler").textContent`)}“`);
  screenshot("05-kartenstapel");

  await tippen(await punkt("l-quizfrage:nth-of-type(1) li:nth-child(2)"), "Antwort im Quiz");
  const quiz = await inSeite(`[document.querySelector(".l-quiz-rueckmeldung")?.textContent, document.querySelector(".l-quiz-punkte")?.textContent]`);
  report.push(`Quiz nach Fingertipp: „${quiz[0]}“, „${quiz[1]}“`);
  screenshot("06-quiz");

  // 6. Code-Ansicht: Werkzeugleiste wischen und einen Baustein per Fingertipp einfügen (Notizen/DNS.html)
  await klick('.tree [title="Notizen/DNS.html"]');
  await waitFor(`document.querySelector('[aria-label="Ansicht (Strg+E)"]')`, "DNS");
  await sleep(500);
  const codeKnopf = await evaluate(`(() => { const b = [...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent.trim() === "Code"); b.scrollIntoView({ block: "center" }); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await tippen(aufGeraet(codeKnopf.x, codeKnopf.y), "Ansicht „Code“");
  await waitFor(`document.querySelector('.cm-editor .cm-line') && document.querySelector('.baustein-leiste')`, "Code-Ansicht");
  await sleep(800);
  const leiste = `document.querySelector('.baustein-leiste')`;
  const vorher = await evaluate(`(() => { const l = ${leiste}; l.scrollIntoView({ block: "center" }); const r = l.getBoundingClientRect(); return { breite: l.clientWidth, inhalt: l.scrollWidth, overflowX: getComputedStyle(l).overflowX, links: l.scrollLeft, x: r.x, y: r.y + r.height / 2, w: r.width }; })()`);
  report.push(`Werkzeugleiste: sichtbar ${vorher.breite} px, Inhalt ${vorher.inhalt} px breit, overflow-x: ${vorher.overflowX}`);
  screenshot("07-code");
  const von = aufGeraet(vorher.x + vorher.w - 30, vorher.y);
  const bis = aufGeraet(vorher.x + 30, vorher.y);
  shell(`input swipe ${von.x} ${von.y} ${bis.x} ${bis.y} 400`, { log: false });
  report.push(`> adb shell input swipe ${von.x} ${von.y} ${bis.x} ${bis.y} 400   (Werkzeugleiste nach links wischen)`);
  await sleep(800);
  report.push(`Werkzeugleiste nach dem Wischen: scrollLeft ${await evaluate(`${leiste}.scrollLeft`)} px (vorher ${vorher.links})`);
  screenshot("08-code-werkzeugleiste-gewischt");
  // Zurück an den Anfang und „Callout“ per Fingertipp einfügen; die Datei auf dem Gerät prüfen
  await evaluate(`${leiste}.scrollLeft = 0`);
  await sleep(300);
  const datei = `${VAULT_GERAET}/Notizen/DNS.html`;
  const zaehlen = () => Number(shell(`grep -c "<l-callout" ${datei}`, { log: false }).stdout.trim() || 0);
  const calloutsVorher = zaehlen();
  const callout = await evaluate(`(() => { const b = [...document.querySelectorAll('.baustein-leiste button')].find((b) => b.textContent.trim() === "Callout"); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await tippen(aufGeraet(callout.x, callout.y), "„Callout“ in der Werkzeugleiste");
  await sleep(1500);
  const calloutsNachher = zaehlen();
  shell(`grep -c "<l-callout" ${datei}`);
  report.push(`Callouts in ${datei}: vorher ${calloutsVorher}, nach dem Fingertipp ${calloutsNachher} (automatisch gespeichert)`);
  screenshot("09-code-eingefuegt");

  report.push(problems.length === 0 ? "Konsole: keine Fehler." : `Konsole: ${problems.length} Meldungen:\n  ${problems.join("\n  ")}`);
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
  report.push(...problems);
  screenshot("fehler");
} finally {
  console.log(report.join("\n"));
  socket.close();
  run(["forward", "--remove", `tcp:${PORT}`], { log: false });
  console.log(`Screenshots in ${outDir} (${basename(outDir)}).`);
}
