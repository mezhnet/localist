// Screenshots für Etappe 18 (neues Design, Teil 1) in Microsoft Edge (unsichtbar im Hintergrund): für jeden Modus
// (Hell, Dunkel, Schwarz) die Notiz „Ideen“ mit Seitenleiste links, rechts und eingeklappt sowie Einstellungen →
// Darstellung; dazu die Handy-Ansicht (360 × 740). Modus, Seitenleiste und Akzent kommen wie in der App aus dem
// App-Speicher. Szene „schnell“ macht nur je einen Screenshot pro Modus (zum Nachsehen während der Arbeit).
//
// Aufruf, während die Vorschau läuft: node scripts/etappe18-screenshots.mjs http://localhost:1420 docs/screenshots/etappe-18 [schnell]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1420", outDir = "docs/screenshots/etappe-18", szene = "alle"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-e18-"));
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
const waitFor = async (expression, ms = 10000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await ev(`Boolean(${expression})`)) return true;
    await sleep(100);
  }
  throw new Error(`Nicht erschienen: ${expression}`);
};
const shot = async (name) => {
  await sleep(600);
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  const datei = join(outDir, `${name}.png`);
  writeFileSync(datei, Buffer.from(result.data, "base64"));
  return datei;
};

/** Lädt die Vorschau mit diesen Werten im App-Speicher und öffnet die Notiz „Ideen“. */
async function oeffnen({ modus, akzent = "orange", seite = "links", eingeklappt = false, breite = 1280, hoehe = 800, mobil = false }) {
  await send("Emulation.setDeviceMetricsOverride", { width: breite, height: hoehe, deviceScaleFactor: mobil ? 2 : 1, mobile: mobil });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)");
    localStorage.setItem("theme", ${JSON.stringify(modus)}); localStorage.setItem("akzent", ${JSON.stringify(akzent)});
    localStorage.setItem("seitenleiste-seite", ${JSON.stringify(seite)}); localStorage.setItem("seitenleiste-eingeklappt", ${JSON.stringify(String(eingeklappt))}); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
  await ev(`document.querySelector('.tree [title="Notizen"]').click(); true`);
  await waitFor(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
  await ev(`document.querySelector('.tree [title="Notizen/Ideen.md"]').click(); true`);
  await waitFor(`document.querySelector('.bn-editor')`);
  await sleep(800);
}

const NAMEN = { light: "hell", dark: "dunkel", black: "schwarz" };
const zeilen = [];
try {
  await send("Page.enable");
  await send("Runtime.enable");
  for (const modus of ["light", "dark", "black"]) {
    const name = NAMEN[modus];
    await oeffnen({ modus });
    zeilen.push(`${name}, Seitenleiste links: ${await shot(`${name}-seitenleiste-links`)}`);
    if (szene === "schnell") continue;
    await oeffnen({ modus, seite: "rechts" });
    zeilen.push(`${name}, Seitenleiste rechts: ${await shot(`${name}-seitenleiste-rechts`)}`);
    await oeffnen({ modus, eingeklappt: true });
    zeilen.push(`${name}, Seitenleiste eingeklappt: ${await shot(`${name}-seitenleiste-eingeklappt`)}`);
    await oeffnen({ modus });
    await ev(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith("Einstellungen")).click(); true`);
    await waitFor(`document.querySelector('[role="dialog"] .modus-karten')`);
    zeilen.push(`${name}, Einstellungen → Darstellung: ${await shot(`${name}-einstellungen-darstellung`)}`);
    await oeffnen({ modus, breite: 360, hoehe: 740, mobil: true });
    zeilen.push(`${name}, Handy 360 × 740: ${await shot(`${name}-handy`)}`);
  }
  console.log(`Screenshots Etappe 18, Vorschau ${base}:`);
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
