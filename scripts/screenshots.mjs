// Screenshots der Browser-Vorschau für docs/screenshots/<etappe>/, jeweils hell und dunkel, am PC (1280 × 800)
// und auf dem Handy (360 × 740). Szenen "etappe9": Startseite, Notiz, Tabelle, Kanban, Kalender.
// Szenen "etappe10": HTML-Seite in der abgeschotteten Anzeige, „Neu“-Menü und „Verschieben nach …“.
// Szenen "etappe11": Code-Editor in „Code“ und „Geteilt“, Suchen und Ersetzen, Autovervollständigung.
// Szenen "etappe12": Beispielseite Lernen/Bausteine.html in „Lesen“, Stift-Symbol, Formular, Tabellen-Editor,
// Werkzeugleiste mit „/“-Menü und dieselbe Datei per Doppelklick im Browser (file://, mit echten Mausklicks).
// Nutzt das installierte Microsoft Edge unsichtbar im Hintergrund über das DevTools-Protokoll, ohne zusätzliche Pakete.
// Damit Kanban und Kalender etwas zeigen, legt das Skript einige Beispiel-Einträge an – nur im Arbeitsspeicher
// der Vorschau (dev-backend.ts), echte Dateien ändern sich nicht.
//
// Aufruf, während die Vorschau läuft (z. B. `npm run dev -- --port 1430`):
//   node scripts/screenshots.mjs http://localhost:1430 docs/screenshots/etappe-9 [etappe9|etappe10|etappe11|etappe12]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [base = "http://localhost:1430", outDir = "docs/screenshots/etappe-9", scenes = "etappe9"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
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

const key = async (keyName, code, keyCode, modifiers = 0) => {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers });
};

async function runEditor(theme, device) {
  const prefix = await openVault(theme, device);
  await evaluate(`localStorage.setItem("html-ansicht", "geteilt"); true`);
  await click('.tree [title="Notizen"]');
  await waitFor(`document.querySelector('.tree [title="Notizen/DNS.html"]')`, "DNS.html im Ordnerbaum");
  await click('.tree [title="Notizen/DNS.html"]');
  await waitFor(`document.querySelector('.cm-editor') && document.querySelector('iframe.html-frame')`, "Geteilt mit Editor und Vorschau");
  await sleep(1500);
  await shot(`${prefix}geteilt-${theme}`);
  if (prefix) return;
  await evaluate(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent === "Code").click()`);
  await waitFor(`!document.querySelector('iframe.html-frame') && document.querySelector('.cm-editor')`, "Code-Ansicht");
  await shot(`code-${theme}`);
  if (theme !== "hell") return;
  // Suchen und Ersetzen
  await evaluate(`document.querySelector('.cm-content').focus()`);
  await key("f", "KeyF", 70, 2);
  await waitFor(`document.querySelector('.cm-search')`, "Suchfeld");
  await send("Input.insertText", { text: "Port" });
  await key("Enter", "Enter", 13);
  await shot("code-suchen-hell");
  await key("Escape", "Escape", 27);
  // Autovervollständigung am Anfang von <main>
  await evaluate(`(() => { const view = document.querySelector('.cm-content'); view.focus(); const sel = window.getSelection(); sel.collapse(view.querySelector('.cm-line'), 0); })()`);
  await send("Input.insertText", { text: "<det" });
  await waitFor(`document.querySelector('.cm-tooltip-autocomplete')`, "Vorschläge");
  await shot("code-vorschlaege-hell");
}

/** Wertet einen Ausdruck in einem iframe aus (abgeschottete Seiten laufen in Edge als eigenes Ziel). */
async function evaluateInFrame(urlPart, expression) {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = targets.find((candidate) => candidate.type === "iframe" && candidate.url.includes(urlPart));
  if (!target) throw new Error(`iframe nicht gefunden: ${urlPart}`);
  const frameSocket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen) => (frameSocket.onopen = resolveOpen));
  const result = await new Promise((resolveResult) => {
    frameSocket.onmessage = (event) => resolveResult(JSON.parse(event.data).result?.result?.value);
    frameSocket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  });
  frameSocket.close();
  return result;
}

const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: type === "mouseMoved" ? 0 : 1 });
const realClick = async (x, y) => {
  await mouse("mouseMoved", x, y);
  await mouse("mousePressed", x, y);
  await mouse("mouseReleased", x, y);
};

/** Bringt einen Baustein der Seite ins Bild, fährt mit der Maus darüber und liefert die Lage des Stifts. */
async function hoverBaustein(selector) {
  const visibleFrame = `[...document.querySelectorAll('iframe.html-frame')].find((f) => !f.classList.contains('is-loading'))`;
  const rect = `(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, height: r.height, width: r.width }; })()`;
  const first = await evaluateInFrame("Bausteine.html", rect);
  await evaluate(`(() => {
    const frame = ${visibleFrame};
    let box = frame.parentElement;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    (box ?? document.scrollingElement).scrollTop += frame.getBoundingClientRect().top + ${first.y} - 140;
  })()`);
  await sleep(300);
  const inner = await evaluateInFrame("Bausteine.html", rect);
  const frameBox = await evaluate(`(() => { const r = ${visibleFrame}.getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
  await mouse("mouseMoved", frameBox.x + inner.x + Math.min(60, inner.width / 2), frameBox.y + inner.y + Math.min(12, inner.height / 2));
  await sleep(300);
  return {
    x: inner.width < 160 ? frameBox.x + inner.right + 20 : frameBox.x + inner.right - 18,
    y: inner.height < 36 ? frameBox.y + inner.y + inner.height / 2 : frameBox.y + inner.y + 18,
  };
}

async function runBausteine(theme, device) {
  const prefix = await openVault(theme, device);
  await evaluate(`localStorage.setItem("html-ansicht", "lesen"); true`);
  await click('.tree [title="Lernen"]');
  await waitFor(`document.querySelector('.tree [title="Lernen/Bausteine.html"]')`, "Bausteine.html im Ordnerbaum");
  await click('.tree [title="Lernen/Bausteine.html"]');
  await waitFor(`document.querySelector('iframe.html-frame') && document.querySelector('.html-preview').style.height`, "Beispielseite mit Höhe");
  await sleep(1000);
  if (prefix) {
    await shot(`${prefix}lesen-${theme}`);
    return;
  }
  // Ganze Seite: Fenster so hoch wie der Inhalt
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 2300, deviceScaleFactor: 1, mobile: false });
  await sleep(800);
  await shot(`lesen-${theme}`);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(500);

  // Stift-Symbol beim Überfahren, ein echter Klick darauf öffnet das Formular
  const pencil = await hoverBaustein("l-callout");
  await shot(`stift-${theme}`);
  await realClick(pencil.x, pencil.y);
  await waitFor(`document.querySelector('[role="dialog"][aria-label="Callout bearbeiten"]')`, "Formular für den Callout");
  await shot(`formular-callout-${theme}`);
  await key("Escape", "Escape", 27);
  await sleep(300);

  // Tabellen-Editor
  const tablePencil = await hoverBaustein("table");
  await realClick(tablePencil.x, tablePencil.y);
  await waitFor(`document.querySelector('[role="dialog"][aria-label="Tabelle bearbeiten"]')`, "Tabellen-Editor");
  await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes("Zeile hinzufügen")).click()`);
  await sleep(300);
  await shot(`tabellen-editor-${theme}`);
  await key("Escape", "Escape", 27);
  await sleep(300);

  // Werkzeugleiste und „/“-Menü im Code-Editor
  await evaluate(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent === "Code").click()`);
  await waitFor(`document.querySelector('.cm-editor') && document.querySelector('.baustein-leiste')`, "Code-Ansicht mit Werkzeugleiste");
  await evaluate(`(() => { const content = document.querySelector('.cm-content'); content.focus(); const line = [...content.querySelectorAll('.cm-line')][3]; window.getSelection().collapse(line, 0); })()`);
  await send("Input.insertText", { text: "/" });
  await waitFor(`document.querySelector('.cm-tooltip-autocomplete')`, "„/“-Menü");
  await shot(`werkzeugleiste-${theme}`);
  // Das getippte „/“ wieder entfernen und speichern lassen (die Vorschau merkt sich HTML-Seiten bis zum Neustart).
  await key("Escape", "Escape", 27);
  await key("Backspace", "Backspace", 8);
  await sleep(1500);
}

/** Dieselbe Seite per Doppelklick: direkt aus dem Ordner im Browser (file://), Bausteine aus .localist/bausteine. */
async function runBrowser(theme) {
  const url = pathToFileURL(resolve("beispiel-vault/Lernen/Bausteine.html")).href;
  await send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 2100, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme === "hell" ? "light" : "dark" }] });
  await send("Page.navigate", { url });
  await waitFor(`document.documentElement.getAttribute("data-localist-bausteine")`, "localist.js geladen");
  // Interaktiv: Toggle aufklappen und einen Checklisten-Punkt per Klick auf den Text abhaken (echte Mausklicks)
  const at = (selector) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + 60, y: r.y + r.height / 2 }; })()`);
  const summary = await at("details > summary");
  await realClick(summary.x, summary.y);
  const item = await at("ul.l-checkliste > li:nth-child(2)");
  await realClick(item.x, item.y);
  await sleep(300);
  const check = await evaluate(`({
    adresse: location.protocol,
    bausteine: document.documentElement.getAttribute("data-localist-bausteine"),
    calloutFarbe: getComputedStyle(document.querySelector("l-callout")).backgroundColor,
    toggleOffen: document.querySelector("details").open,
    haekchen: [...document.querySelectorAll("ul.l-checkliste input")].map((input) => input.checked),
    callout: document.querySelector("l-callout").getAttribute("aria-label"),
    codeSprache: document.querySelector("pre").getAttribute("data-sprache"),
    bildBreite: document.querySelector("figure img").naturalWidth,
  })`);
  console.log(`  file:// (${theme}): ${JSON.stringify(check)}`);
  await shot(`browser-${theme}`);
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
      else if (scenes === "etappe11") await runEditor(theme, device);
      else if (scenes === "etappe12") await runBausteine(theme, device);
      else await run(theme, device);
    }
  }
  if (scenes === "etappe12") {
    for (const theme of ["hell", "dunkel"]) await runBrowser(theme);
  }
} finally {
  socket.close();
  // Edge samt aller Unterprozesse beenden, sonst bleibt der Port belegt und der nächste Lauf spricht mit diesem Browser.
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
