// Prüft in Microsoft Edge (unsichtbar im Hintergrund), ob die Vorschau in „Geteilt“ nach dem Tippen an derselben
// Stelle bleibt: lange Beispielseite (nur im Arbeitsspeicher der Vorschau) öffnen, Vorschau nach unten scrollen,
// im Editor tippen, nach dem automatischen Speichern und Neuladen die Scrollposition der neuen Fassung messen.
// Aufruf, während die Vorschau läuft (npm run dev -- --port 1430): node scripts/vorschau-scroll-pruefung.mjs [Screenshot.png]
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.VORSCHAU_URL ?? "http://localhost:1430";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-scroll-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 1;
const pending = new Map();
const contexts = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === "Runtime.executionContextCreated" && m.params.context.auxData?.isDefault) {
    contexts.set(m.params.context.auxData.frameId, m.params.context.id);
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression, contextId) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) })).result?.result?.value;
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
  const results = [];
  for (const target of targets) results.push({ url: target.url.replace(base, ""), y: await evalTarget(target, "Math.round(window.scrollY)") });
  return results;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: base });
await sleep(1500);
await ev(`localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("html-ansicht", "geteilt"); true`);
await send("Page.navigate", { url: base });
await sleep(2500);
const absaetze = Array.from({ length: 80 }, (_, i) => `<p>Absatz ${i + 1}: Ein Resolver fragt die Nameserver der Reihe nach ab.</p>`).join("\\n");
await ev(`window.__devVault.externalWrite("Notizen/Lang.html", "<!doctype html>\\n<html lang=\\"de\\">\\n<head>\\n<title>Lang</title>\\n</head>\\n<body>\\n<main>\\n<h1>Lange Seite</h1>\\n${absaetze}\\n</main>\\n</body>\\n</html>\\n"); true`);
await sleep(1200);
await ev(`document.querySelector('.tree [title="Notizen"]').click(); true`);
await sleep(500);
await ev(`document.querySelector('.tree [title="Notizen/Lang.html"]').click(); true`);
await sleep(2500);
const rect = await ev(`(() => { const r = document.querySelector('iframe.html-frame').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 200 }; })()`);
await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: rect.x, y: rect.y, deltaX: 0, deltaY: 1500 });
await sleep(800);
const before = await frameScroll();
console.log("Vor dem Tippen:", JSON.stringify(before));
// Am Ende von <main> tippen
await ev(`(() => { const lines = document.querySelectorAll('.cm-line'); const last = lines[lines.length - 1]; document.querySelector('.cm-content').focus(); window.getSelection().collapse(last, last.childNodes.length); })()`);
await send("Input.insertText", { text: "<p>Neu getippt</p>" });
await sleep(3500);
const after = await frameScroll();
console.log("Nach dem Neuladen:", JSON.stringify(after));
const { result } = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(process.argv[2] ?? "scroll-check.png", Buffer.from(result.data, "base64"));
ws.close();
// Edge samt aller Unterprozesse beenden, sonst bleibt der Port belegt und der nächste Lauf spricht mit diesem Browser.
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
await sleep(300);
rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
