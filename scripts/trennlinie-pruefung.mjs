// Prüft die Trennlinie in „Geteilt“ (Etappe 17) in Microsoft Edge (unsichtbar im Hintergrund) mit echter Maus,
// echtem Finger (Touch-Emulation) und echter Tastatur über das DevTools-Protokoll: Ziehen auch über die Vorschau
// hinweg, Begrenzung auf mindestens 280 px je Seite, Doppelklick auf 50 : 50, Pfeiltasten, „Seiten tauschen“ und
// die Anordnung auf dem Handy. Gemessen wird außerdem, ob beim Ziehen Text markiert wird, ob die Vorschau neu lädt
// oder ihre Scrollposition verliert und ob es ruckelt (Abstand zwischen zwei Bildern, lange Aufgaben > 50 ms).
// Die lange Testseite entsteht nur im Arbeitsspeicher der Vorschau (dev-backend.ts).
//
// Aufruf, während die Vorschau läuft: node scripts/trennlinie-pruefung.mjs http://localhost:1420 [Screenshot-Ordner]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1420", shots] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-trennlinie-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--lang=de-DE", "about:blank"], { stdio: "ignore" });

let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {
    // Edge startet noch
  }
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((resolve) => (ws.onopen = resolve));
let nextId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await ev(`Boolean(${expression})`)) return true;
    await sleep(100);
  }
  throw new Error(`Nicht erschienen: ${expression}`);
};
/** Scrollposition jedes iframes über dessen eigenes DevTools-Ziel (die Seiten sind abgeschottet). */
const evalTarget = (target, expression) =>
  new Promise((resolve) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    socket.onmessage = (event) => {
      resolve(JSON.parse(event.data).result?.result?.value);
      socket.close();
    };
  });
const frameScroll = async () => {
  const targets = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === "iframe");
  const werte = [];
  // scrollY und der oberste sichtbare Absatz: Wird die Vorschau schmaler, bricht der Text um und der Browser hält den
  // sichtbaren Absatz fest (Scroll-Anchoring), scrollY ändert sich dann, der Inhalt im Bild nicht.
  const oben = "(() => { const p = [...document.querySelectorAll('main > *')].find((e) => e.getBoundingClientRect().bottom > 0); return p ? p.textContent.slice(0, 10) : '–'; })()";
  for (const target of targets) werte.push(`${decodeURIComponent(new URL(target.url).pathname.split("/").pop())}: scrollY ${await evalTarget(target, "Math.round(window.scrollY)")}, oben „${await evalTarget(target, oben)}“`);
  return werte.join(", ");
};
const maus = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" && !extra.buttons ? "none" : "left", ...extra });
const shot = async (name) => {
  if (!shots) return "";
  mkdirSync(shots, { recursive: true });
  await sleep(400);
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  const datei = join(shots, `${name}.png`);
  writeFileSync(datei, Buffer.from(result.data, "base64"));
  return ` (${datei})`;
};
const ja = (wert) => (wert ? "ja" : "NEIN");

const TRENNER = `document.querySelector('[role="separator"].html-trenner')`;
const zustand = () =>
  ev(`(() => { const t = ${TRENNER}; const c = document.querySelector('.html-code-pane').getBoundingClientRect(); const p = document.querySelector('.html-preview-pane').getBoundingClientRect();
    const frames = [...document.querySelectorAll('iframe.html-frame')];
    return { wert: t ? Number(t.getAttribute('aria-valuenow')) : null, code: Math.round(c.width), vorschau: Math.round(p.width), codeLinks: Math.round(c.left), vorschauLinks: Math.round(p.left),
      codeOben: Math.round(c.top), vorschauOben: Math.round(p.top), gemerkt: localStorage.getItem('html-geteilt-anteil'), seite: localStorage.getItem('html-code-seite'),
      markiert: getSelection().toString().length, frames: frames.length, src: frames.map((f) => f.src).join(' '), trennerSichtbar: t ? getComputedStyle(t).display !== 'none' : false }; })()`);
const mitte = () => ev(`(() => { const r = ${TRENNER}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);

const zeilen = [];
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("html-ansicht", "geteilt"); localStorage.setItem("theme", "light"); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
  const absaetze = Array.from({ length: 80 }, (_, i) => `<p>Absatz ${i + 1}: Ein Resolver fragt die Nameserver der Reihe nach ab.</p>`).join("\\n");
  await ev(`window.__devVault.externalWrite("Notizen/Lang.html", "<!doctype html>\\n<html lang=\\"de\\">\\n<head>\\n<title>Lang</title>\\n</head>\\n<body>\\n<main>\\n<h1>Lange Seite</h1>\\n${absaetze}\\n</main>\\n</body>\\n</html>\\n"); true`);
  await sleep(800);
  await ev(`document.querySelector('.tree [title="Notizen"]').click(); true`);
  await waitFor(`document.querySelector('.tree [title="Notizen/Lang.html"]')`);
  await ev(`document.querySelector('.tree [title="Notizen/Lang.html"]').click(); true`);
  await waitFor(`${TRENNER} && document.querySelector('iframe.html-frame:not(.is-loading)')`);
  await sleep(1500);

  // Vorschau nach unten scrollen (Mausrad über dem iframe)
  const vorschau = await ev(`(() => { const r = document.querySelector('iframe.html-frame').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 200 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: vorschau.x, y: vorschau.y, deltaX: 0, deltaY: 1500 });
  await sleep(800);
  const scrollVorher = await frameScroll();
  const start = await zustand();
  zeilen.push(`Start (1280 × 800): Code ${start.code} px, Vorschau ${start.vorschau} px, aria-valuenow ${start.wert}, Vorschau gescrollt: ${scrollVorher}`);

  // Ruckeln messen, nur zwischen Drücken und Loslassen: Abstand zwischen zwei Bildern (requestAnimationFrame) und
  // „lange Bilder“ (long-animation-frame, > 50 ms Skript, Layout und Zeichnen zusammen).
  await ev(`window.__ruckeln = { bilder: [], lang: [], laeuft: true }; new PerformanceObserver((liste) => { if (window.__ruckeln.laeuft) window.__ruckeln.lang.push(...liste.getEntries().map((e) => Math.round(e.duration) + ' ms (blockiert ' + Math.round(e.blockingDuration) + ' ms, Stil/Layout ' + Math.round(e.startTime + e.duration - e.styleAndLayoutStart) + ' ms, Skripte ' + e.scripts.length + ')')); }).observe({ type: "long-animation-frame" }); true`);

  // 1. Mit der Maus nach rechts ziehen, quer über die Vorschau (iframe)
  let m = await mitte();
  await maus("mouseMoved", m.x, m.y);
  await ev(`(() => { let letzt = performance.now(); const schritt = (t) => { if (!window.__ruckeln.laeuft) return; window.__ruckeln.bilder.push(t - letzt); letzt = t; requestAnimationFrame(schritt); }; requestAnimationFrame(schritt); })(); true`);
  await maus("mousePressed", m.x, m.y, { clickCount: 1 });
  for (let i = 1; i <= 25; i++) {
    await maus("mouseMoved", m.x + i * 10, m.y + (i % 3), { buttons: 1 });
    await sleep(16);
  }
  await maus("mouseReleased", m.x + 250, m.y, { clickCount: 1 });
  await ev(`window.__ruckeln.laeuft = false; true`);
  // Zustand während des Ziehens: noch einmal drücken und kurz bewegen, dann nachsehen (danach loslassen).
  const m2 = await mitte();
  await maus("mousePressed", m2.x, m2.y, { clickCount: 1 });
  await maus("mouseMoved", m2.x + 1, m2.y, { buttons: 1 });
  const waehrend = await ev(`({ ziehen: document.querySelector('.html-workspace').classList.contains('is-ziehen'), frame: getComputedStyle(document.querySelector('iframe.html-frame')).pointerEvents, ueber: document.elementFromPoint(${m2.x + 120}, ${m2.y})?.tagName })`);
  await maus("mouseReleased", m2.x, m2.y, { clickCount: 1 });
  await sleep(500);
  const ruckeln = await ev(`(() => { const b = window.__ruckeln.bilder.slice(1); return { max: Math.round(Math.max(...b)), mittel: Math.round(b.reduce((s, x) => s + x, 0) / b.length), bilder: b.length, lang: window.__ruckeln.lang }; })()`);
  const gezogen = await zustand();
  const scrollNachher = await frameScroll();
  zeilen.push(
    `Maus: um 250 px nach rechts gezogen (über der Vorschau): Code ${start.code} → ${gezogen.code} px, Vorschau ${start.vorschau} → ${gezogen.vorschau} px, aria-valuenow ${start.wert} → ${gezogen.wert}, gemerkt „${gezogen.gemerkt}“`,
  );
  zeilen.push(`  während des Ziehens: Klasse is-ziehen ${ja(waehrend.ziehen)}, iframe pointer-events „${waehrend.frame}“, unter dem Zeiger liegt ${waehrend.ueber}`);
  zeilen.push(`  Text markiert: ${gezogen.markiert} Zeichen; iframes vorher/nachher ${start.frames}/${gezogen.frames}, gleiche Adresse: ${ja(start.src === gezogen.src)}; Scrollposition ${scrollVorher} → ${scrollNachher}`);
  zeilen.push(`  Ruckeln (nur während des Ziehens): ${ruckeln.bilder} Bilder, Abstand im Mittel ${ruckeln.mittel} ms, höchstens ${ruckeln.max} ms, lange Bilder (> 50 ms): ${ruckeln.lang.length ? ruckeln.lang.join(", ") : "keine"}${await shot("geteilt-gezogen")}`);

  // 2. Weit über den rechten Rand hinaus: Die Vorschau bleibt mindestens 280 px breit
  m = await mitte();
  await maus("mouseMoved", m.x, m.y);
  await maus("mousePressed", m.x, m.y, { clickCount: 1 });
  for (let i = 1; i <= 10; i++) await maus("mouseMoved", m.x + i * 60, m.y, { buttons: 1 });
  await maus("mouseReleased", 1279, m.y, { clickCount: 1 });
  await sleep(300);
  const rechts = await zustand();
  m = await mitte();
  await maus("mouseMoved", m.x, m.y);
  await maus("mousePressed", m.x, m.y, { clickCount: 1 });
  for (let i = 1; i <= 15; i++) await maus("mouseMoved", m.x - i * 80, m.y, { buttons: 1 });
  await maus("mouseReleased", 0, m.y, { clickCount: 1 });
  await sleep(300);
  const links = await zustand();
  zeilen.push(`Begrenzung: ganz nach rechts → Vorschau ${rechts.vorschau} px (aria-valuenow ${rechts.wert}); ganz nach links → Code ${links.code} px (aria-valuenow ${links.wert})`);

  // 3. Doppelklick setzt auf 50 : 50 zurück
  m = await mitte();
  for (const clickCount of [1, 2]) {
    await maus("mousePressed", m.x, m.y, { clickCount });
    await maus("mouseReleased", m.x, m.y, { clickCount });
  }
  await sleep(300);
  const doppel = await zustand();
  zeilen.push(`Doppelklick: aria-valuenow ${links.wert} → ${doppel.wert}, Code ${doppel.code} px, Vorschau ${doppel.vorschau} px, gemerkt „${doppel.gemerkt}“`);

  // 4. Tastatur: Fokus auf der Linie, Pfeiltasten
  await ev(`${TRENNER}.focus(); true`);
  const taste = async (key, code, modifiers = 0) => {
    for (const type of ["rawKeyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key, code: key, windowsVirtualKeyCode: code, modifiers });
    await sleep(150);
  };
  await taste("ArrowRight", 39);
  const pfeil = await zustand();
  await taste("ArrowLeft", 37, 8);
  const umschalt = await zustand();
  await taste("Enter", 13);
  const enter = await zustand();
  zeilen.push(`Tastatur (Fokus: ${await ev(`document.activeElement.getAttribute('role')`)}): → ${doppel.wert} → ${pfeil.wert}, Umschalt+← → ${umschalt.wert}, Enter → ${enter.wert}`);

  // 5. „Seiten tauschen“ mit echtem Klick: Code nach rechts, Vorschau lädt nicht neu
  const knopf = await ev(`(() => { const r = document.querySelector('button[aria-label="Seiten tauschen"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await maus("mouseMoved", knopf.x, knopf.y);
  await maus("mousePressed", knopf.x, knopf.y, { clickCount: 1 });
  await maus("mouseReleased", knopf.x, knopf.y, { clickCount: 1 });
  await sleep(600);
  const getauscht = await zustand();
  zeilen.push(
    `„Seiten tauschen“: Code links bei x = ${getauscht.codeLinks}, Vorschau bei x = ${getauscht.vorschauLinks} (Code rechts: ${ja(getauscht.codeLinks > getauscht.vorschauLinks)}), gemerkt „${getauscht.seite}“, gleiche Vorschau-Adresse: ${ja(getauscht.src === enter.src)}, iframes ${getauscht.frames}, Scrollposition ${await frameScroll()}${await shot("geteilt-code-rechts")}`,
  );

  // 6. Finger (Touch-Emulation): Linie nach links ziehen
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  m = await mitte();
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: m.x, y: m.y }] });
  for (let i = 1; i <= 10; i++) {
    await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: m.x - i * 10, y: m.y }] });
    await sleep(16);
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(400);
  const finger = await zustand();
  zeilen.push(`Finger: um 100 px nach links gewischt (Code rechts wird breiter): aria-valuenow ${getauscht.wert} → ${finger.wert}, Code ${getauscht.code} → ${finger.code} px, gemerkt „${finger.gemerkt}“, Text markiert: ${finger.markiert}`);
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });

  // 7. Handy (360 × 740): untereinander, „rechts“ heißt unten, keine Trennlinie
  await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
  await sleep(800);
  const handy = await zustand();
  zeilen.push(`Handy 360 × 740, Code „rechts“: Vorschau oben bei y = ${handy.vorschauOben}, Code darunter bei y = ${handy.codeOben} (unten: ${ja(handy.codeOben > handy.vorschauOben)}), Trennlinie sichtbar: ${ja(handy.trennerSichtbar)}${await shot("geteilt-handy-code-unten")}`);

  console.log(`Trennlinie in „Geteilt“, Vorschau ${base} (Edge, echte Maus, Finger und Tastatur):`);
  console.log(zeilen.join("\n"));
} catch (error) {
  console.log(zeilen.join("\n"));
  console.log(`FEHLER: ${error.message}`);
  process.exitCode = 1;
} finally {
  ws.close();
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Edge gibt das Profil manchmal verzögert frei
  }
}
