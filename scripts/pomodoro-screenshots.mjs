// Screenshots für Etappe 23 (Pomodoro) aus der Browser-Vorschau: Ansicht „Pomodoro“ am PC in Hell und Schwarz,
// Mini-Timer auf einer Notiz (PC, auch mit eingeklappter Seitenleiste) und dieselben Ansichten auf dem Handy
// (360 × 740). Steuert Microsoft Edge unsichtbar im Hintergrund; alles geschieht nur im Arbeitsspeicher der Vorschau
// (dev-backend.ts), echte Dateien ändern sich nicht.
//
// Aufruf, während die Vorschau läuft: node scripts/pomodoro-screenshots.mjs http://localhost:1430 docs/screenshots/etappe-23
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", outDir = "docs/screenshots/etappe-23"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "localist-pomodoro-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--lang=de-DE", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {
    // Edge startet noch
  }
  if (!wsUrl) await sleep(200);
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
const ev = async (expression) => {
  const antwort = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (antwort.result?.exceptionDetails) throw new Error(antwort.result.exceptionDetails.exception?.description ?? antwort.result.exceptionDetails.text);
  return antwort.result?.result?.value;
};
const waitFor = async (expression, was = expression) => {
  for (let t = 0; t < 10000; t += 100) {
    if (await ev(`Boolean(${expression})`).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`Nicht erschienen: ${was}`);
};
const klick = async (selektor, text) => {
  const ok = await ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selektor)})].find((e) => ${text === undefined ? "true" : `e.textContent.trim().startsWith(${JSON.stringify(text)})`}); if (!e) return false; e.click(); return true; })()`);
  if (!ok) throw new Error(`Nicht gefunden: ${selektor} ${text ?? ""}`);
  await sleep(400);
};
const gespeichert = [];
async function shot(name) {
  await ev("document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 400))))");
  const { data } = (await send("Page.captureScreenshot", { format: "png" })).result;
  const datei = join(outDir, `${name}.png`);
  writeFileSync(datei, Buffer.from(data, "base64"));
  gespeichert.push(datei);
}

const MODUS = { hell: "light", schwarz: "black" };
async function oeffnen(modus, handy) {
  await send("Emulation.setDeviceMetricsOverride", handy ? { width: 360, height: 740, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: modus === "hell" ? "light" : "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", ${JSON.stringify(MODUS[modus])}); ${handy ? `localStorage.setItem("dev-platform", "android");` : ""} true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`, "Vault");
  await sleep(500);
}

/** Zwei beendete Sessions für „Heute“, damit die Ansicht nicht leer ist (nur im Arbeitsspeicher der Vorschau). */
const VERLAUF = `(() => {
  const jetzt = new Date(); const zwei = (n) => String(n).padStart(2, "0");
  const tag = jetzt.getFullYear() + "-" + zwei(jetzt.getMonth() + 1) + "-" + zwei(jetzt.getDate());
  const zeile = (id, von, bis, minuten, ziel, seite) => JSON.stringify({ id, start: tag + "T" + von, ende: tag + "T" + bis, minuten, ziel, seite, abgebrochen: false });
  window.__devVault.externalWrite(".localist/pomodoro/" + tag.slice(0, 7) + ".jsonl", [
    zeile("a", "00:05", "00:30", 25, "Subnetting üben", "7c1e2b4a-0d3f-4a5e-9b8c-1f2e3d4c5b6a"),
    zeile("b", "00:35", "01:00", 25, "Notizen ordnen", null),
  ].join("\\n") + "\\n");
  return true; })()`;

async function szenen(modus, handy) {
  const vorsilbe = handy ? `handy-${modus}` : `pc-${modus}`;
  await oeffnen(modus, handy);
  await ev(VERLAUF);
  if (handy) await klick(".home-schnellaktion", "Pomodoro");
  else await klick(".sidebar-werkzeuge .sidebar-item");
  await waitFor(`document.querySelector(".pomodoro")`, "Pomodoro");
  await ev(`(() => { const f = document.querySelector("#pomodoro-ziel"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(f, "Subnetting üben"); f.dispatchEvent(new Event("input", { bubbles: true })); f.blur(); return true; })()`);
  await klick(".pomodoro-start");
  await waitFor(`document.querySelector(".pomodoro-start")?.textContent === "Pausieren"`, "läuft");
  await ev("window.__devVault.vorspulen(7 * 60000 + 18000); true");
  await sleep(600);
  await shot(`pomodoro-${vorsilbe}`);
  if (!handy) {
    // Ganze Ansicht mit „Heute“ (Inhaltsfläche nach unten gerollt)
    await ev(`document.querySelector(".main-scroll").scrollTop = 10000; true`);
    await shot(`pomodoro-${vorsilbe}-heute`);
  }
  // Mini-Timer auf einer Notiz
  if (handy) {
    await klick(".handy-nav button", "Seiten");
    await klick('.tree [title="Notizen"]');
    await klick('.tree [title="Notizen/Ideen.md"]');
  } else {
    await klick('.tree [title="Notizen"]');
    await klick('.tree [title="Notizen/Ideen.md"]');
  }
  await waitFor(`document.querySelector(".mini-timer")`, "Mini-Timer");
  await sleep(500);
  await shot(`mini-timer-${vorsilbe}`);
  if (!handy && modus === "hell") {
    await ev(`document.querySelector(".seitenleiste-knopf").click(); true`);
    await waitFor(`document.querySelector(".mini-timer.is-leiste")`, "Mini-Timer in der oberen Leiste");
    await sleep(600);
    await shot(`mini-timer-${vorsilbe}-eingeklappt`);
  }
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await szenen("hell", false);
  await szenen("schwarz", false);
  await szenen("hell", true);
  await szenen("schwarz", true);
  console.log(`Screenshots (${gespeichert.length}):\n${gespeichert.join("\n")}`);
} catch (error) {
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
