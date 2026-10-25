// Screenshots der Browser-Vorschau für docs/screenshots/<etappe>/, jeweils hell und dunkel, am PC (1280 × 800)
// und auf dem Handy (360 × 740). Szenen "etappe9": Startseite, Notiz, Tabelle, Kanban, Kalender.
// Szenen "etappe10": HTML-Seite in der abgeschotteten Anzeige, „Neu“-Menü und „Verschieben nach …“.
// Nutzt das installierte Microsoft Edge unsichtbar im Hintergrund über das DevTools-Protokoll, ohne zusätzliche Pakete.
// Damit Kanban und Kalender etwas zeigen, legt das Skript einige Beispiel-Einträge an – nur im Arbeitsspeicher
// der Vorschau (dev-backend.ts), echte Dateien ändern sich nicht.
//
// Aufruf, während die Vorschau läuft (z. B. `npm run dev -- --port 1430`):
//   node scripts/screenshots.mjs http://localhost:1430 docs/screenshots/etappe-9 [etappe9|etappe10]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", outDir = "docs/screenshots/etappe-9", scenes = "etappe9"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const profile = mkdtempSync(join(tmpdir(), "localist-screenshots-"));
const edge = spawn(
  EDGE,
  ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--lang=de-DE", "about:blank"],
  { stdio: "ignore" },
);

async function pageSocketUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Edge startet noch.
    }
    await sleep(200);
  }
  throw new Error("Microsoft Edge antwortet nicht.");
}

const socket = new WebSocket(await pageSocketUrl());
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const waiting = message.id && pending.get(message.id);
  if (!waiting) return;
  pending.delete(message.id);
  if (message.error) waiting.reject(new Error(message.error.message));
  else waiting.resolve(message.result);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, what) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`Nicht erschienen: ${what}`);
}

const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const clickTab = (name) => evaluate(`[...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes(${JSON.stringify(name)})).click()`);

async function shot(name) {
  await evaluate("document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 400))))");
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`  ${file}`);
}

// Beispiel-Einträge rund um heute, dazu Kanban- und Kalender-Ansicht (nur im Arbeitsspeicher der Vorschau).
const SAMPLE_DATA = `(() => {
  const vault = window.__devVault;
  const day = (offset, time) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return time ? date + "T" + time : date;
  };
  const entry = (name, frontmatter) => vault.externalWrite("Projekte/" + name + ".md", "---\\nid: " + crypto.randomUUID() + "\\n" + frontmatter + "---\\n");
  entry("Messestand planen", "icon: 🎪\\nstatus: Geplant\\nfällig: " + day(3) + "\\npriorität: mittel\\n");
  entry("Newsletter", "icon: ✉️\\nstatus: Erledigt\\nfällig: " + day(-12) + "\\npriorität: niedrig\\n");
  entry("Team-Workshop", "icon: 🧠\\nstatus: In Arbeit\\nfällig: " + day(-4, "10:00") + "\\npriorität: hoch\\n");
  entry("Budget 2027", "status: Geplant\\nfällig: " + day(5, "14:30") + "\\npriorität: hoch\\n");
  entry("Fotos sortieren", "status: Erledigt\\nfällig: " + day(-9) + "\\n");
  entry("Ideen sammeln", "status: In Arbeit\\n");
  vault.externalWrite("Projekte/_ansichten.yaml", vault.files.get("Projekte/_ansichten.yaml")
    + "  - name: Kanban\\n    typ: kanban\\n    gruppierung: status\\n    sortierung: []\\n    filter: []\\n"
    + "  - name: Kalender\\n    typ: kalender\\n    datum: fällig\\n    modus: monat\\n    sortierung: []\\n    filter: []\\n");
})()`;

async function openVault(theme, device) {
  const mobile = device === "handy";
  await send("Emulation.setDeviceMetricsOverride", mobile ? { width: 360, height: 740, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme === "hell" ? "light" : "dark" }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body", "Seite");
  await evaluate(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", ${JSON.stringify(theme === "hell" ? "light" : "dark")}); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row') && document.querySelector('.home-card')`, "Startseite");
  return mobile ? "handy-" : "";
}

async function runHtml(theme, device) {
  const prefix = await openVault(theme, device);
  await click('.tree [title="Notizen"]');
  await waitFor(`document.querySelector('.tree [title="Notizen/DNS.html"]')`, "DNS.html im Ordnerbaum");
  await click('.tree [title="Notizen/DNS.html"]');
  await waitFor(`document.querySelector('iframe.html-frame') && document.querySelector('iframe.html-frame').style.height`, "HTML-Seite mit Höhe");
  await sleep(800);
  await shot(`${prefix}html-seite-${theme}`);
  if (prefix) return;
  await evaluate(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.trim() === "Neu").click()`);
  await waitFor(`document.querySelector('[role="menu"]')`, "Neu-Menü");
  await shot(`neu-menue-${theme}`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
  await sleep(300);
  await click('[aria-label="Aktionen für „DNS“"]');
  await waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.includes("Verschieben nach"))`, "Menü mit Verschieben");
  await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.includes("Verschieben nach")).click()`);
  await waitFor(`document.querySelector('[role="dialog"]')`, "Verschieben-Dialog");
  await shot(`verschieben-${theme}`);
}

async function run(theme, device) {
  const mobile = device === "handy";
  await send("Emulation.setDeviceMetricsOverride", mobile ? { width: 360, height: 740, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme === "hell" ? "light" : "dark" }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body", "Seite");
  await evaluate(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", ${JSON.stringify(theme === "hell" ? "light" : "dark")}); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row') && document.querySelector('.home-card')`, "Startseite");
  const prefix = mobile ? "handy-" : "";
  await shot(`${prefix}startseite-${theme}`);

  if (mobile) {
    await click(".topbar-menu");
    await sleep(400);
    await shot(`${prefix}menue-${theme}`);
    await click(".drawer-backdrop");
  }

  await evaluate(SAMPLE_DATA);
  await sleep(500);
  await click('.tree [title="Projekte"]');
  await waitFor(`document.querySelector('.tree [title="Projekte/Website-Relaunch.md"]')`, "Einträge der Datenbank");
  await click('.tree [title="Projekte/Website-Relaunch.md"]');
  await waitFor(`document.querySelector('.bn-editor') && document.querySelector('.callout-frame')`, "Notiz");
  await shot(`${prefix}notiz-${theme}`);

  await click('.tree [title="Projekte"]');
  await waitFor(`document.querySelectorAll('.database-table tbody tr').length >= 8`, "Tabelle");
  await shot(`${prefix}tabelle-${theme}`);

  await clickTab("Kanban");
  await waitFor(`document.querySelector('.kanban-card')`, "Kanban");
  await shot(`${prefix}kanban-${theme}`);

  await clickTab("Kalender");
  await waitFor(`document.querySelector('.calendar-entry')`, "Kalender");
  await shot(`${prefix}kalender-${theme}`);
}

try {
  mkdirSync(outDir, { recursive: true });
  await send("Page.enable");
  await send("Runtime.enable");
  for (const device of ["pc", "handy"]) {
    for (const theme of ["hell", "dunkel"]) {
      console.log(`${device === "pc" ? "PC" : "Handy"}, ${theme}:`);
      if (scenes === "etappe10") await runHtml(theme, device);
      else await run(theme, device);
    }
  }
} finally {
  socket.close();
  edge.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
