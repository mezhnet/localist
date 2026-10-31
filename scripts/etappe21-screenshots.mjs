// Screenshots für Etappe 21 (Updates über GitHub Releases) in Microsoft Edge (unsichtbar im Hintergrund): nur der
// Abschnitt „Über Localist“ in den Einstellungen, jeweils in Hell und Schwarz.
// PC (1280 × 800): „Aktuell“, „Update verfügbar“ mit Fortschritt beim Herunterladen, „Fehler“ (keine Verbindung).
// Handy (360 × 740, wie Android): Version und „Neue Versionen auf GitHub ansehen“.
// Die Update-Zustände kommen aus der Simulation in dev-backend.ts (localStorage "dev-update"); es gibt kein Netz.
//
// Aufruf, während die Vorschau läuft: node scripts/etappe21-screenshots.mjs http://localhost:1431 docs/screenshots/etappe-21
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", outDir = "docs/screenshots/etappe-21"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-screenshots-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--lang=de-DE", "about:blank"], { stdio: "ignore" });
mkdirSync(outDir, { recursive: true });

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
const waitFor = async (expression, ms = 10000, takt = 100) => {
  for (let t = 0; t < ms; t += takt) {
    if (await ev(`Boolean(${expression})`)) return true;
    await sleep(takt);
  }
  throw new Error(`Nicht erschienen: ${expression}`);
};
const klickAuf = async (expression) => {
  const r = await ev(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  if (!r) throw new Error(`Nicht gefunden: ${expression}`);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
  await sleep(200);
};
const knopf = (text) => `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute("aria-label") === ${JSON.stringify(text)})`;
const ABSCHNITT = `document.querySelector('[aria-label="Über Localist"]')`;

/** Screenshot nur vom Abschnitt „Über Localist“ (mit etwas Rand). */
const shot = async (name, warten = 400) => {
  await sleep(warten);
  // Der Dialog scrollt: den ganzen Abschnitt (auch eine neue Meldung darunter) sichtbar machen.
  const r = await ev(`(() => { ${ABSCHNITT}.scrollIntoView({ block: "end" }); const b = ${ABSCHNITT}.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()`);
  const rand = 12;
  const clip = { x: Math.max(0, r.x - rand), y: Math.max(0, r.y - rand), width: r.width + 2 * rand, height: r.height + 2 * rand, scale: 1 };
  const { result } = await send("Page.captureScreenshot", { format: "png", clip });
  const datei = join(outDir, `${name}.png`);
  writeFileSync(datei, Buffer.from(result.data, "base64"));
  const text = await ev(`${ABSCHNITT}.innerText.replace(/\\s+/g, " ").trim()`);
  console.log(`${datei}: ${text}`);
};

/** Lädt die Vorschau mit Modus, Update-Szenario und Bildschirm und öffnet die Einstellungen. */
async function einstellungen({ modus, szenario = "verfuegbar", handy = false }) {
  await send("Emulation.setDeviceMetricsOverride", { width: handy ? 360 : 1280, height: handy ? 740 : 800, deviceScaleFactor: handy ? 2 : 1, mobile: handy });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)");
    localStorage.setItem("theme", ${JSON.stringify(modus)}); localStorage.setItem("akzent", "orange"); localStorage.setItem("dev-update", ${JSON.stringify(szenario)});
    ${handy ? 'localStorage.setItem("dev-platform", "android");' : ""} true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row') || document.querySelector(".handy-nav")`);
  if (handy) await klickAuf(`[...document.querySelectorAll(".handy-nav button")].find((b) => b.getAttribute("aria-label") === "Einstellungen")`);
  else await klickAuf(`[...document.querySelectorAll(".sidebar-footer button")].find((b) => b.textContent.trim().startsWith("Einstellungen"))`);
  await waitFor(`${ABSCHNITT}?.querySelector(".app-version")?.textContent.match(/^\\d/)`);
  await ev(`${ABSCHNITT}.scrollIntoView({ block: "center" }); true`);
}

try {
  for (const modus of ["light", "black"]) {
    const name = modus === "light" ? "hell" : "schwarz";

    await einstellungen({ modus, szenario: "aktuell" });
    await klickAuf(knopf("Nach Updates suchen"));
    await waitFor(`${ABSCHNITT}.querySelector(".update-status--aktuell")`);
    await shot(`pc-aktuell-${name}`);

    await einstellungen({ modus, szenario: "verfuegbar" });
    await klickAuf(knopf("Nach Updates suchen"));
    await waitFor(`${ABSCHNITT}.querySelector(".update-status--verfuegbar")`);
    await shot(`pc-update-verfuegbar-${name}`);
    await klickAuf(knopf("Jetzt installieren"));
    // Mitten im simulierten Download (zehn Teile à 150 ms) festhalten
    await waitFor(`Number(${ABSCHNITT}.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")) >= 40`, 8000, 20);
    await shot(`pc-update-fortschritt-${name}`, 0);

    await einstellungen({ modus, szenario: "fehler" });
    await klickAuf(knopf("Nach Updates suchen"));
    await waitFor(`${ABSCHNITT}.querySelector(".update-status--fehler")`);
    await shot(`pc-fehler-${name}`);

    await einstellungen({ modus, handy: true });
    await shot(`handy-${name}`);
  }
} finally {
  ws.close();
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(1000);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch {
    // Edge gibt das Profil manchmal erst später frei; es liegt nur im Temp-Ordner.
  }
}
