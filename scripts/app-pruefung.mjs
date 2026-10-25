// Prüft die gebaute localist.exe mit ihrer echten CSP: öffnet Notiz, Datenbank und HTML-Seite, sammelt
// CSP-Verstöße und Fehler aus der Konsole, prüft Strg+P und einen Link aus der HTML-Seite und speichert Screenshots.
// Die App wird mit `--vault <Kopie>` gestartet, merkt sich diesen Vault also nicht. Die WebView2-Entwickler-
// schnittstelle wird über WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS nur für diesen Start eingeschaltet.
//
// Aufruf: node scripts/app-pruefung.mjs <localist.exe> <Vault-Kopie> <Screenshot-Ordner>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [exe, vault, outDir] = process.argv.slice(2);
if (!exe || !vault || !outDir) {
  console.error("Aufruf: node scripts/app-pruefung.mjs <localist.exe> <Vault-Kopie> <Screenshot-Ordner>");
  process.exit(2);
}
const PORT = 9336;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const app = spawn(exe, ["--vault", vault], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}` },
  stdio: "ignore",
});

let target;
for (let i = 0; i < 150 && !target; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = targets.find((t) => t.type === "page" && t.url.includes("tauri.localhost"));
  } catch {
    // App startet noch.
  }
  await sleep(200);
}
if (!target) {
  console.error("Die App hat keine Entwicklerschnittstelle geöffnet.");
  app.kill();
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
  } else if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    problems.push(`${message.params.entry.source}: ${message.params.entry.text}`);
  } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    problems.push(`console.error: ${message.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  } else if (message.method === "Runtime.exceptionThrown") {
    problems.push(`Ausnahme: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
  } else if (message.method === "Runtime.executionContextCreated") {
    const context = message.params.context;
    if (context.origin && context.auxData?.frameId) contexts.set(context.auxData.frameId, context.id);
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
const waitFor = async (expression, what) => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(`Boolean(${expression})`)) return true;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};
const shot = async (name) => {
  await sleep(600);
  const answer = await send("Page.captureScreenshot", { format: "png" });
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(answer.result.data, "base64"));
  return file;
};
const click = async (x, y) => {
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
};

const report = [];
try {
  await send("Log.enable");
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`, "Ordnerbaum");
  report.push(`App gestartet: ${await evaluate("location.href")}, Vault „${await evaluate("document.querySelector('.vault-name').textContent")}“`);

  // Notiz
  await evaluate(`document.querySelector('.tree [title="Notizen"]').click()`);
  await waitFor(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`, "Notizen aufgeklappt");
  await evaluate(`document.querySelector('.tree [title="Notizen/Ideen.md"]').click()`);
  await waitFor(`document.querySelector('.bn-editor') && document.body.textContent.includes("Hier sammle ich lose Gedanken.")`, "Notiz Ideen");
  report.push(`Notiz „Ideen“ geöffnet: ${await shot("app-notiz")}`);

  // Datenbank
  await evaluate(`document.querySelector('.tree [title="Projekte"]').click()`);
  await waitFor(`document.querySelectorAll('.database-table tbody tr').length >= 2`, "Tabelle Projekte");
  report.push(`Datenbank „Projekte“ geöffnet (${await evaluate("document.querySelectorAll('.database-table tbody tr').length")} Zeilen): ${await shot("app-datenbank")}`);

  // HTML-Seite
  await evaluate(`document.querySelector('.tree [title="Notizen/DNS.html"]').click()`);
  await waitFor(`document.querySelector('iframe.html-frame') && document.querySelector('iframe.html-frame').style.height`, "HTML-Seite mit gemeldeter Höhe");
  const frameInfo = await evaluate(`(() => { const f = document.querySelector('iframe.html-frame'); const r = f.getBoundingClientRect(); return { src: f.src, sandbox: f.getAttribute('sandbox'), hoehe: f.style.height, x: r.x, y: r.y }; })()`);
  report.push(`HTML-Seite „DNS“ geöffnet: src ${frameInfo.src}, sandbox="${frameInfo.sandbox}", Höhe von der Brücke ${frameInfo.hoehe}`);
  // Im iframe nachsehen (eigener Ausführungskontext): Bild aus dem Vault geladen? Kein Tauri?
  const tree = await send("Page.getFrameTree");
  const child = tree.result.frameTree.childFrames?.[0]?.frame;
  const inside = child && contexts.get(child.id);
  if (inside) {
    const state = await evaluate(
      `({ bildBreite: document.querySelector('img')?.naturalWidth, tauri: typeof window.__TAURI_INTERNALS__, ipc: typeof window.ipc, ursprung: String(window.origin), link: (() => { const r = document.querySelector('a[href="Ideen.md"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })() })`,
      inside,
    );
    report.push(`Im iframe: Bild aus dem Vault ${state.bildBreite > 0 ? `geladen (${state.bildBreite} px breit)` : "NICHT geladen"}, __TAURI_INTERNALS__: ${state.tauri}, window.ipc: ${state.ipc}, Ursprung: ${state.ursprung}`);
    await shot("app-html-seite");

    // Strg+P, während die Seite den Fokus hat
    await click(frameInfo.x + 20, frameInfo.y + 20);
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, modifiers: 2 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, modifiers: 2 });
    const quick = await waitFor(`document.querySelector('[role="dialog"][aria-label="Schnellsuche"]')`, "Schnellsuche nach Strg+P in der Seite").catch(() => false);
    report.push(`Strg+P mit Fokus in der HTML-Seite öffnet die Schnellsuche der App: ${quick ? "ja" : "NEIN"}`);
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(300);

    // Klick auf den Link „Ideen“ in der Seite öffnet die Notiz in der App
    await click(frameInfo.x + state.link.x, frameInfo.y + state.link.y);
    const opened = await waitFor(`document.querySelector('.page-title')?.value === "Ideen"`, "Notiz nach Linkklick").catch(() => false);
    report.push(`Klick auf den Link „Ideen“ in der HTML-Seite öffnet die Notiz in der App: ${opened ? "ja" : "NEIN"}`);
  } else {
    report.push("Ausführungskontext des iframes nicht gefunden.");
  }

  report.push(problems.length === 0 ? "Konsole: keine Fehler und keine CSP-Verstöße." : `Konsole: ${problems.length} Meldungen:\n  ${problems.join("\n  ")}`);
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
  report.push(...problems);
} finally {
  console.log(report.join("\n"));
  socket.close();
  app.kill();
}
