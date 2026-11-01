// Android-Prüfung für Etappe 22 (Ziehen und Ablegen) im eigenen Emulator: echte Fingereingaben per
// `adb shell input motionevent` (DOWN, Pause, MOVE …, UP), `input tap` und `input swipe`. Geprüft werden in der
// Ansicht „Seiten“: Tippen öffnet, Wischen scrollt, langes Drücken ohne Bewegung zeigt das Menü, langes Drücken und
// Ziehen legt eine Seite bzw. einen Ordner in einen anderen Ordner; dazu Kanban-Karte und Notizbuch-Reihenfolge per
// Finger und der Ziehgriff im Block-Editor (nur Verhalten notieren). Ergebnis an den Dateien auf dem Gerät (`adb shell ls`).
// Jeder adb-Befehl steht mit seiner Ausgabe im Bericht, Screenshots per `adb exec-out screencap`.
// Das Gerät wählt `ANDROID_SERIAL` (z. B. emulator-5556), damit kein fremdes Gerät angesprochen wird.
//
// Aufruf: set ANDROID_SERIAL=emulator-5556 & node scripts/android-ziehen-pruefung.mjs <adb.exe> <app-universal-debug.apk> <Ausgabe-Ordner> [vorher|nachher]
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [adb, apk, outDir, modus = "vorher"] = process.argv.slice(2);
if (!adb || !apk || !outDir || !process.env.ANDROID_SERIAL) {
  console.error("Aufruf mit gesetztem ANDROID_SERIAL: node scripts/android-ziehen-pruefung.mjs <adb.exe> <app-universal-debug.apk> <Ausgabe-Ordner> [vorher|nachher]");
  process.exit(2);
}
const nachher = modus === "nachher";
const PAKET = "de.localist.desktop";
const VAULT_NAME = "Localist-Ziehen";
const VAULT_GERAET = `/sdcard/Documents/${VAULT_NAME}`;
const PORT = 9341;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
mkdirSync(outDir, { recursive: true });

const report = [];
const tabelle = [];
const run = (args, { log = true, binary = false } = {}) => {
  const result = spawnSync(adb, args, { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (log) {
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/).slice(-6).join("\n      ");
    report.push(`> adb ${args.join(" ")}${text ? `\n      ${text}` : ""}`);
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
const liegt = (pfad) => shell(`ls "${VAULT_GERAET}/${pfad}"`).status === 0;

// 1. Gerät, Installation, Vault-Kopie mit Zusätzen (leerer Ordner „Archiv“, Ordner „Entwürfe“, viele Seiten zum Scrollen)
run(["devices"]);
run(["install", "-r", apk]);
shell(`dumpsys package ${PAKET} | grep versionName`);
const basis = mkdtempSync(join(tmpdir(), "localist-android-ziehen-"));
const kopie = join(basis, VAULT_NAME);
cpSync(resolve("beispiel-vault"), kopie, { recursive: true });
// `adb push` lässt leere Ordner aus: „Archiv“ bekommt deshalb eine Seite.
mkdirSync(join(kopie, "Archiv"));
writeFileSync(join(kopie, "Archiv", "Alt.md"), "---\nid: 5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a\n---\nAlt.\n");
mkdirSync(join(kopie, "Entwürfe"));
writeFileSync(join(kopie, "Entwürfe", "Skizze.md"), "---\nid: 3f0c1a52-8d7e-4b6a-9c1d-2e3f4a5b6c7d\n---\nErster Entwurf.\n");
mkdirSync(join(kopie, "Viele"));
for (let i = 1; i <= 24; i++) writeFileSync(join(kopie, "Viele", `Seite ${String(i).padStart(2, "0")}.md`), `---\nid: 00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}\n---\nSeite ${i}\n`);
shell(`rm -rf ${VAULT_GERAET}`, { log: false });
run(["push", kopie, VAULT_GERAET], { log: false });
report.push(`> adb push <Kopie von beispiel-vault mit Archiv, Entwürfe, Viele> ${VAULT_GERAET}`);
rmSync(basis, { recursive: true, force: true });
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
await new Promise((done) => (socket.onopen = done));
let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
// Bricht die Verbindung ab (WebView neu geladen oder App beendet), warten offene Anfragen nicht ewig.
let getrennt = false;
socket.onclose = () => {
  getrennt = true;
  pending.forEach((done) => done({}));
  pending.clear();
};
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = nextId++;
    pending.set(id, done);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, what, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};

let geraet;
const aufGeraet = (x, y) => ({ x: Math.round(geraet.left + x * geraet.dpr), y: Math.round(geraet.top + y * geraet.dpr) });
async function wo(ausdruck, fx = 0.5, fy = 0.5) {
  const r = await evaluate(`(() => { const e = ${ausdruck}; if (!e) return null; const q = e.getBoundingClientRect(); if (q.top < 0 || q.bottom > innerHeight) e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width * ${fx}, y: r.y + r.height * ${fy} }; })()`);
  if (!r) throw new Error(`Nicht gefunden: ${ausdruck}`);
  return aufGeraet(r.x, r.y);
}
const nav = (name) => `[...document.querySelectorAll(".handy-nav button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).trim() === ${JSON.stringify(name)})`;
const row = (pfad) => `document.querySelector('.sidebar-shell.open .tree [title=${JSON.stringify(pfad)}]')?.closest('.tree-row')`;
const tippe = async (ausdruck, was) => {
  const p = await wo(ausdruck);
  shell(`input tap ${p.x} ${p.y}`, { log: false });
  report.push(`> adb shell input tap ${p.x} ${p.y}   (${was})`);
  await sleep(800);
};
/**
 * Finger aufsetzen, `halten` ms ruhig liegen lassen, in Schritten zum Ziel bewegen, verweilen, loslassen. Alle Schritte
 * laufen in einem adb-Aufruf; jeder `input motionevent` startet auf dem Gerät ein eigenes Programm (etwa 0,2–0,4 s).
 */
const finger = async (von, nach, was, { halten = 0.9, schritte = 5, verweilen = 0.6, bild } = {}) => {
  const teile = [`input motionevent DOWN ${von.x} ${von.y}`, `sleep ${halten}`];
  for (let i = 1; i <= schritte; i++) teile.push(`input motionevent MOVE ${Math.round(von.x + ((nach.x - von.x) * i) / schritte)} ${Math.round(von.y + ((nach.y - von.y) * i) / schritte)}`);
  teile.push(`sleep ${verweilen}`);
  if (bild) {
    // Für den Screenshot während des Ziehens: Finger liegen lassen, Bild holen, dann erst loslassen.
    shell(teile.join("; "), { log: false });
    report.push(`> adb shell "${teile.join("; ")}"   (${was})`);
    screenshot(bild);
    shell(`input motionevent UP ${nach.x} ${nach.y}`);
  } else {
    teile.push(`input motionevent UP ${nach.x} ${nach.y}`);
    shell(teile.join("; "), { log: false });
    report.push(`> adb shell "${teile.join("; ")}"   (${was})`);
  }
  await sleep(1500);
};
const menuOffen = () => evaluate(`Boolean(document.querySelector('[role="menu"]'))`);
const menuZu = async () => {
  if (await menuOffen()) {
    shell("input keyevent KEYCODE_ESCAPE", { log: false });
    await sleep(300);
    if (await menuOffen()) await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); true`);
    await sleep(300);
  }
};
const seitenOeffnen = async () => {
  if (!(await evaluate(`Boolean(document.querySelector(".sidebar-shell.open [role='tree']"))`))) await tippe(nav("Seiten"), "„Seiten“ in der Navigationsleiste");
  await waitFor(`document.querySelector(".sidebar-shell.open [role='tree']")`, "Ansicht „Seiten“");
};
const aufklappen = async (pfad) => {
  await evaluate(`(() => { const r = ${row(pfad)}; if (r && r.closest('li').getAttribute('aria-expanded') !== 'true') r.querySelector('.tree-toggle').click(); return true; })()`);
  await sleep(400);
};
const eintrag = (ort, geht, ursache) => tabelle.push({ ort, geht, ursache });

try {
  await send("Runtime.enable");
  await waitFor(`document.querySelector('.vault-name, .handy-nav') || [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Vault-Ordner öffnen'))`, "Oberfläche");
  await sleep(1500);
  if (await evaluate(`Boolean(document.querySelector(".handy-nav") && !document.querySelector(".vault-name"))`)) {
    await evaluate(`[...document.querySelectorAll(".handy-nav button")].find((b) => b.textContent.trim() === "Start").click(); true`);
    await waitFor(`document.querySelector('.vault-name')`, "Startseite");
  }
  const groesse = /(\d+)x(\d+)/.exec(shell("wm size", { log: false }).stdout);
  const fenster = await evaluate(`({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })`);
  geraet = { dpr: fenster.dpr, left: 0, top: Number(groesse[2]) - fenster.h * fenster.dpr };
  report.push(`Bildschirm ${groesse[1]}×${groesse[2]} px, WebView ${fenster.w}×${fenster.h} CSS-Pixel, devicePixelRatio ${fenster.dpr}`);

  // Vault-Kopie öffnen (eigene Ordnerauswahl von Localist)
  if ((await evaluate(`document.querySelector('.vault-name')?.textContent ?? null`)) !== VAULT_NAME) {
    if ((await evaluate(`document.querySelector('.vault-name')?.textContent ?? null`)) === null) await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Vault-Ordner öffnen")).click()`);
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
  await evaluate(`localStorage.setItem("theme", "light"); localStorage.setItem("akzent", "orange"); location.reload(); true`);
  await sleep(2500);
  await waitFor(`document.querySelector('.handy-nav')`, "Startseite nach dem Neuladen");
  await sleep(800);

  // 2. Tippen öffnet (Ordner klappt auf, Seite öffnet sich)
  await seitenOeffnen();
  await tippe(`${row("Notizen")}.querySelector('.tree-label')`, "Ordner „Notizen“ antippen");
  const aufgeklappt = await evaluate(`${row("Notizen")}.closest('li').getAttribute('aria-expanded') === 'true'`);
  await tippe(`${row("Notizen/Formatierung.md")}.querySelector('.tree-label')`, "Seite „Formatierung“ antippen");
  const geoeffnet = await evaluate(`document.querySelector('.page-title')?.value === "Formatierung" && !document.querySelector(".sidebar-shell.open")`);
  report.push(`Tippen: Ordner klappt auf ${aufgeklappt ? "ja" : "NEIN"}, Seite öffnet sich ${geoeffnet ? "ja" : "NEIN"}`);
  eintrag("Kurzes Tippen öffnet", aufgeklappt && geoeffnet, "");

  // 3. Wischen scrollt die Liste
  await seitenOeffnen();
  await aufklappen("Viele");
  const scrollerExpr = `(() => { let e = ${row("Viele")}; while (e && !(e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY))) e = e.parentElement; return e; })()`;
  const vorScroll = await evaluate(`${scrollerExpr}?.scrollTop ?? -1`);
  const a = await wo(row("Viele/Seite 08.md"));
  const b = { x: a.x, y: a.y - 700 };
  shell(`input swipe ${a.x} ${a.y} ${b.x} ${b.y} 350`);
  await sleep(1200);
  const nachScroll = await evaluate(`${scrollerExpr}?.scrollTop ?? -1`);
  const nichtsVerschoben = liegt("Viele/Seite 08.md");
  report.push(`Wischen über die Liste: scrollTop ${vorScroll} → ${nachScroll}, kein Menü ${!(await menuOffen()) ? "ja" : "NEIN"}, „Seite 08“ liegt noch in „Viele“: ${nichtsVerschoben ? "ja" : "NEIN"}`);
  eintrag("Wischen scrollt die Liste", nachScroll > vorScroll && nichtsVerschoben, "");
  await menuZu();
  await evaluate(`${scrollerExpr}.scrollTop = 0; true`);
  await sleep(300);

  // 4. Langes Drücken ohne Bewegung: Menü (heute das Kontextmenü von Android/der WebView)
  const lang = await wo(row("Notizen/Ideen.md"));
  shell(`input motionevent DOWN ${lang.x} ${lang.y}; sleep 1.2; input motionevent UP ${lang.x} ${lang.y}`.replace(/^/, ""), { log: false });
  report.push(`> adb shell "input motionevent DOWN ${lang.x} ${lang.y}; sleep 1.2; input motionevent UP ${lang.x} ${lang.y}"   (lange auf „Ideen“ drücken, ohne Bewegung)`);
  await sleep(800);
  const menu = await evaluate(`document.querySelector('[role="menu"]')?.getAttribute('aria-label') ?? null`);
  const markiert = await evaluate(`String(getSelection())`);
  report.push(`Langes Drücken ohne Bewegung: Menü ${menu ? `„${menu}“` : "keins"}, markierter Text „${markiert}“`);
  if (menu) screenshot("langes-druecken-menue");
  eintrag("Langes Drücken ohne Bewegung zeigt das Menü", Boolean(menu) && markiert === "", "");
  await menuZu();

  // 5. Seite lange drücken und in einen Ordner ziehen
  await seitenOeffnen();
  await aufklappen("Notizen");
  await finger(await wo(row("Notizen/Ideen.md")), await wo(row("Archiv")), "„Ideen“ lange drücken und auf „Archiv“ ziehen", nachher ? { bild: "seite-ziehen" } : {});
  const seiteOk = liegt("Archiv/Ideen.md") && !liegt("Notizen/Ideen.md");
  report.push(`Seite „Ideen“ → „Archiv“: ${seiteOk ? "verschoben" : "NICHT verschoben"}`);
  eintrag("Seite in einen Ordner", seiteOk, "");
  await menuZu();
  if (nachher) await evaluate(`[...document.querySelectorAll('.toast button')].find((b) => b.textContent.includes("Rückgängig")) ? true : false`).then((da) => report.push(`Meldung mit „Rückgängig“ zu sehen: ${da ? "ja" : "NEIN"}`));

  // 6. Ordner in einen Ordner
  await seitenOeffnen();
  await finger(await wo(row("Entwürfe")), await wo(row("Archiv")), "Ordner „Entwürfe“ lange drücken und auf „Archiv“ ziehen");
  const ordnerOk = liegt("Archiv/Entwürfe/Skizze.md") && !liegt("Entwürfe");
  report.push(`Ordner „Entwürfe“ → „Archiv“: ${ordnerOk ? "verschoben" : "NICHT verschoben"}`);
  eintrag("Ordner in einen Ordner", ordnerOk, "");
  await menuZu();

  // 7. Kanban-Karte per Finger
  await seitenOeffnen();
  await tippe(`${row("Projekte")}.querySelector('.tree-label')`, "Datenbank „Projekte“ öffnen");
  await evaluate(`document.querySelector('[aria-label="Ansicht hinzufügen"]').click()`);
  await sleep(400);
  await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.trim() === "Kanban").click()`);
  await waitFor(`document.querySelector('.kanban-card')`, "Kanban-Karten");
  await sleep(600);
  const spalte = (n) => `[...document.querySelectorAll('.kanban-column')].find((c) => c.querySelector('.kanban-column-header').textContent.startsWith(${JSON.stringify(n)}))`;
  const karte = await wo(`${spalte("Geplant")}.querySelector('.kanban-card')`);
  const zielSpalte = await evaluate(`(() => { const r = ${spalte("In Arbeit")}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 120), sichtbar: r.x + r.width / 2 < innerWidth }; })()`);
  await finger(karte, aufGeraet(zielSpalte.x, zielSpalte.y), "Kanban-Karte „Umzug“ lange drücken und nach „In Arbeit“ ziehen", nachher ? { bild: "kanban-ziehen" } : {});
  const kanbanOk = /status: In Arbeit/.test(shell(`cat "${VAULT_GERAET}/Projekte/Umzug.md"`).stdout);
  report.push(`Kanban „Umzug“ → „In Arbeit“: ${kanbanOk ? "verschoben" : "NICHT verschoben"} (Ziel im Bild: ${zielSpalte.sichtbar ? "ja" : "nein"})`);
  eintrag("Kanban-Karte in eine andere Spalte", kanbanOk, "");
  await menuZu();

  // 8. Notizbuch-Reihenfolge per Finger
  await seitenOeffnen();
  await tippe(`${row("Lernen")}.querySelector('.tree-label')`, "Notizbuch „Lernen“ öffnen");
  await waitFor(`document.querySelectorAll('.notizbuch-inhalt li').length >= 2`, "Inhaltsverzeichnis");
  await finger(await wo(`document.querySelectorAll('.notizbuch-inhalt li')[0]`), await wo(`document.querySelectorAll('.notizbuch-inhalt li')[1]`, 0.5, 0.85), "Eintrag „Subnetting“ lange drücken und hinter „Bausteine“ ziehen");
  const yaml = shell(`cat "${VAULT_GERAET}/Lernen/_notizbuch.yaml"`).stdout;
  const buchOk = yaml.indexOf("Bausteine.html") < yaml.indexOf("Subnetting.md");
  report.push(`Notizbuch „Subnetting“ hinter „Bausteine“: ${buchOk ? "umsortiert" : "NICHT umsortiert"}`);
  eintrag("Reihenfolge im Notizbuch", buchOk, "");
  await menuZu();

  // 9. Ziehgriff im Block-Editor (nur Verhalten notieren)
  await seitenOeffnen();
  await aufklappen("Lernen");
  await tippe(`${row("Lernen/Subnetting.md")}.querySelector('.tree-label')`, "Notiz „Subnetting“ öffnen");
  await waitFor(`document.querySelector('.bn-editor .bn-block-outer')`, "Block-Editor");
  const block = await wo(`document.querySelectorAll('.bn-editor .bn-block-outer')[1]`, 0.5, 0.5);
  shell(`input tap ${block.x} ${block.y}`);
  await sleep(800);
  const griff = await evaluate(`(() => { const g = document.querySelector('.bn-side-menu [draggable="true"]'); if (!g) return null; const r = g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sichtbar: r.width > 0 && getComputedStyle(g).visibility !== "hidden" }; })()`);
  report.push(`Ziehgriff im Block-Editor nach Antippen eines Blocks: ${griff?.sichtbar ? "sichtbar" : "nicht sichtbar"}`);
  let griffText = "Ziehgriff erscheint auf dem Handy nicht (BlockNote zeigt ihn nur bei Mausbewegung)";
  if (griff?.sichtbar) {
    const vorher = await evaluate(`[...document.querySelectorAll('.bn-editor .bn-block-outer')].map((b) => b.textContent.slice(0, 12)).join(" | ")`);
    // Der Griff liegt am linken Bildschirmrand: Eine Bewegung nach rechts wäre dort die Zurück-Geste von Android.
    // Deshalb senkrecht nach unten ziehen.
    const start = aufGeraet(griff.x, griff.y);
    const zielBlock = await wo(`document.querySelectorAll('.bn-editor .bn-block-outer')[3]`, 0.5, 0.8);
    await finger(start, { x: start.x, y: zielBlock.y }, "Ziehgriff lange drücken und senkrecht zwei Blöcke tiefer ziehen");
    const danach = getrennt ? null : await evaluate(`[...document.querySelectorAll('.bn-editor .bn-block-outer')].map((b) => b.textContent.slice(0, 12)).join(" | ")`);
    const laeuft = shell(`pidof ${PAKET}`).stdout.trim();
    griffText =
      getrennt || danach === undefined
        ? `Ziehgriff sichtbar, nach dem Ziehen per Finger ist die WebView-Verbindung weg (App läuft: ${laeuft ? `ja, Prozess ${laeuft}` : "nein"})`
        : vorher === danach
          ? "Ziehgriff sichtbar, Ziehen per Finger verschiebt nichts"
          : "Ziehgriff sichtbar, Ziehen per Finger verschiebt den Block";
    if (getrennt || danach === undefined) screenshot("ziehgriff-danach");
  }
  report.push(`Ziehgriff: ${griffText}`);
  eintrag("Ziehgriff im Block-Editor", /verschiebt den Block/.test(griffText), griffText);
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
  screenshot("fehler");
} finally {
  socket.close();
  run(["forward", "--remove", `tcp:${PORT}`], { log: false });
}

console.log(`Ziehen auf Android (${modus}), echte Fingereingaben per adb:`);
for (const zeile of report) console.log(zeile.startsWith(">") ? zeile : `- ${zeile}`);
console.log("\n| Ort | Handy (APK) | Hinweis |\n|---|---|---|");
for (const z of tabelle) console.log(`| ${z.ort} | ${z.geht ? "geht" : "geht nicht"} | ${z.ursache} |`);
writeFileSync(join(outDir, `android-ziehen-${modus}.json`), JSON.stringify({ report, tabelle }, null, 2));
process.exit(report.some((z) => z.startsWith("FEHLER")) ? 1 : 0);
