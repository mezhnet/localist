// Klickliste „Version 1.0“ (Arbeitsregel 7) automatisch in der Browser-Vorschau: steuert Microsoft Edge im
// Hintergrund mit echter Tastatur und Maus (DevTools-Protokoll) und prüft nach jedem Schritt die Datei im
// Arbeitsspeicher der Vorschau (dev-backend.ts). Echte Dateien ändern sich nicht.
// Einzige Ausnahme: Das Ziehen einer Kanban-Karte nutzt Drag-Ereignisse per Skript (natives Drag & Drop lässt
// sich über das Protokoll nicht auslösen).
//
// Aufruf, während die Vorschau läuft: node scripts/klickliste.mjs http://localhost:1430 "Etappe 13"
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", etappe = "Etappe"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-check-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--lang=de-DE", "about:blank"], { stdio: "ignore" });

let url;
for (let i = 0; i < 100 && !url; i++) {
  try {
    url = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {
    // Edge startet noch
  }
  await sleep(200);
}
const socket = new WebSocket(url);
await new Promise((resolve) => (socket.onopen = resolve));
let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
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
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, ms = 8000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return true;
    await sleep(100);
  }
  return false;
};
const tippen = (text) => send("Input.insertText", { text });
const KEYS = { Enter: ["Enter", 13], Escape: ["Escape", 27], End: ["End", 35], Tab: ["Tab", 9] };
const taste = async (key, modifiers = 0, code) => {
  const [name, keyCode] = KEYS[key] ?? [key, key.toUpperCase().charCodeAt(0)];
  const info = { key: name, code: code ?? (KEYS[key] ? name : `Key${key.toUpperCase()}`), windowsVirtualKeyCode: keyCode, modifiers };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...info });
  if (name === "Enter") await send("Input.dispatchKeyEvent", { type: "char", text: "\r", ...info });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...info });
  await sleep(120);
};
const klick = async (x, y) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
  await sleep(200);
};
/** Klick auf ein Element (Ausdruck liefert das Element), an Position `wo` (Bruchteil der Breite). */
const klickAuf = async (elementExpr, wo = 0.5) => {
  const rect = await evaluate(`(() => { const el = ${elementExpr}; if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width * ${wo}, y: r.y + r.height / 2 }; })()`);
  if (!rect) throw new Error(`Nicht gefunden: ${elementExpr}`);
  await klick(rect.x, rect.y);
};
const knopf = (text) => `[...document.querySelectorAll('button, [role="menuitem"], [role="option"], [role="tab"]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute("aria-label") === ${JSON.stringify(text)})`;
const datei = (pfad) => evaluate(`window.__devVault.files.get(${JSON.stringify(pfad)}) ?? ""`);

const ergebnisse = [];
const pruefen = async (nummer, name, fn) => {
  try {
    const detail = await fn();
    ergebnisse.push(`[x] ${nummer}. ${name}: ${detail}`);
  } catch (error) {
    ergebnisse.push(`[ ] ${nummer}. ${name}: FEHLER – ${error.message}`);
  }
};
const erwarte = (bedingung, text) => {
  if (!bedingung) throw new Error(text);
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await evaluate(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", "light"); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`);

  await pruefen(1, "Notiz bearbeiten", async () => {
    await klickAuf(`document.querySelector('.tree [title="Notizen"]')`);
    await klickAuf(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
    await waitFor(`[...document.querySelectorAll('.bn-editor .bn-inline-content')].some((e) => e.textContent.startsWith("Hier sammle"))`);
    await klickAuf(`[...document.querySelectorAll('.bn-editor .bn-inline-content')].find((e) => e.textContent.startsWith("Hier sammle"))`, 0.98);
    await taste("End");
    await tippen(` Klickliste ${etappe}.`);
    await sleep(1500);
    const text = await datei("Notizen/Ideen.md");
    erwarte(text.includes(`Hier sammle ich lose Gedanken. Klickliste ${etappe}.`), "Text nicht gespeichert");
    return `gespeichert: „Hier sammle ich lose Gedanken. Klickliste ${etappe}.“`;
  });

  await pruefen(2, "Callout über das „/“-Menü", async () => {
    await taste("Enter");
    await tippen("/");
    await tippen("Callout");
    await sleep(800);
    await taste("Enter");
    await tippen(`Hinweis ${etappe} `);
    await sleep(300);
    return "eingefügt";
  });

  await pruefen(3, "Link mit [[ und Klick", async () => {
    await tippen("[[");
    await tippen("Format");
    await sleep(800);
    await taste("Enter");
    await sleep(1500);
    const zeile = (await datei("Notizen/Ideen.md")).split("\n").find((z) => z.startsWith("> [!info]"));
    erwarte(zeile?.includes(`Hinweis ${etappe} [[Formatierung]]`), `Callout/Link fehlt: ${zeile}`);
    await klickAuf(`[...document.querySelectorAll('.bn-editor .node-wikilink')].find((e) => e.textContent.trim() === "Formatierung")`);
    await waitFor(`document.querySelector('.page-title')?.value === "Formatierung"`);
    erwarte((await evaluate(`document.querySelector('.page-title').value`)) === "Formatierung", "Link öffnet nicht");
    return `gespeichert als „${zeile.trim()}“, Klick öffnet „Formatierung“`;
  });

  await pruefen(4, "Eigenschaft", async () => {
    await klickAuf(knopf("Eigenschaft hinzufügen"));
    await waitFor(`document.querySelector('[aria-label="Name der Eigenschaft"]')`);
    await klickAuf(`document.querySelector('[aria-label="Name der Eigenschaft"]')`);
    await tippen("kategorie");
    await taste("Enter");
    await waitFor(`document.querySelector('[aria-label="kategorie"]')`);
    await klickAuf(`document.querySelector('[aria-label="kategorie"]')`);
    await tippen("Lernen");
    await taste("Enter");
    await sleep(1200);
    erwarte((await datei("Notizen/Formatierung.md")).includes("kategorie: Lernen"), "Eigenschaft fehlt");
    return "`kategorie: Lernen` im Frontmatter";
  });

  await pruefen(5, "Tabelle: Zelle, Sortierung, Filter", async () => {
    await klickAuf(`document.querySelector('.tree [title="Projekte"]')`);
    await waitFor(`document.querySelector('[aria-label="priorität von „Umzug“"]')`);
    await klickAuf(`document.querySelector('[aria-label="priorität von „Umzug“"]')`);
    await tippen("mittel");
    await taste("Enter");
    await sleep(1000);
    erwarte((await datei("Projekte/Umzug.md")).includes("priorität: mittel"), "Zelle nicht gespeichert");
    await klickAuf(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith("Sortieren"))`);
    await waitFor(`[...document.querySelectorAll('select')].some((s) => s.value === "aufsteigend")`);
    await evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((s) => s.value === "aufsteigend"); s.focus(); s.value = "absteigend"; s.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    await sleep(800);
    const reihenfolge = await evaluate(`[...document.querySelectorAll('table tbody tr input[aria-label^="Name von"]')].map((i) => i.value)`);
    erwarte((await datei("Projekte/_ansichten.yaml")).includes("richtung: absteigend"), "Sortierung nicht gespeichert");
    await taste("Escape");
    await klickAuf(knopf("Filter"));
    await klickAuf(knopf("Filter hinzufügen"));
    await waitFor(`document.querySelector('[aria-label="Filterwert"]')`);
    await klickAuf(`document.querySelector('[aria-label="Filterwert"]')`);
    await tippen("Geplant");
    await taste("Enter");
    await sleep(800);
    const gefiltert = await evaluate(`[...document.querySelectorAll('table tbody tr input[aria-label^="Name von"]')].map((i) => i.value)`);
    erwarte(gefiltert.length === 1 && gefiltert[0] === "Umzug", `Filter: ${gefiltert}`);
    await klickAuf(`document.querySelector('[aria-label="Filter entfernen"]')`);
    return `priorität: mittel; absteigend: ${reihenfolge.join(", ")}; Filter status ist Geplant: ${gefiltert.join(", ")}`;
  });

  await pruefen(6, "Kanban", async () => {
    await taste("Escape");
    await klickAuf(`document.querySelector('[aria-label="Ansicht hinzufügen"]')`);
    await klickAuf(knopf("Kanban"));
    await waitFor(`document.querySelector('.kanban-card')`);
    await evaluate(`(() => {
      const col = (n) => [...document.querySelectorAll('.kanban-column')].find((c) => c.querySelector('.kanban-column-header').textContent.startsWith(n));
      const card = col("Geplant").querySelector('.kanban-card');
      const ziel = col("Erledigt");
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
      for (const typ of ["dragenter", "dragover", "drop"]) ziel.dispatchEvent(new DragEvent(typ, { bubbles: true, cancelable: true, dataTransfer: dt }));
      card.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
    })()`);
    await sleep(1000);
    erwarte((await datei("Projekte/Umzug.md")).includes("status: Erledigt"), "Karte nicht verschoben");
    return "„Umzug“ nach „Erledigt“ (status: Erledigt)";
  });

  await pruefen(7, "Kalender", async () => {
    await klickAuf(`document.querySelector('[aria-label="Ansicht hinzufügen"]')`);
    await klickAuf(knopf("Kalender"));
    await waitFor(`${knopf("Woche")}`);
    await klickAuf(knopf("Woche"));
    await sleep(400);
    const woche = await evaluate(`document.querySelector('.calendar-title')?.textContent`);
    await klickAuf(knopf("Monat"));
    await sleep(400);
    const vorher = await evaluate(`[...window.__devVault.files.keys()].filter((k) => k.startsWith("Projekte/")).length`);
    await klickAuf(`[...document.querySelectorAll('.calendar-grid [role="gridcell"]')][16]`, 0.5);
    await sleep(1000);
    const neu = await evaluate(`[...window.__devVault.files.keys()].filter((k) => k.startsWith("Projekte/Unbenannt")).map((k) => k + " → " + (window.__devVault.files.get(k).match(/fällig: .*/) || [""])[0])`);
    const nachher = await evaluate(`[...window.__devVault.files.keys()].filter((k) => k.startsWith("Projekte/")).length`);
    erwarte(nachher === vorher + 1 && neu.length === 1, `kein neuer Eintrag (${neu})`);
    return `Woche „${woche}“, Monat, Klick auf einen Tag legt ${neu[0]} an`;
  });

  await pruefen(8, "Volltextsuche „Wochenplanung“", async () => {
    await taste("Escape");
    await taste("f", 2 | 8);
    await waitFor(`document.querySelector('[role="dialog"]')`);
    await tippen("Wochenplanung");
    await sleep(900);
    const treffer = await evaluate(`[...document.querySelectorAll('[role="dialog"] [role="option"]')].map((o) => o.querySelector(".dialog-title")?.firstChild?.textContent.trim())`);
    const markiert = await evaluate(`document.querySelector('[role="dialog"] mark')?.textContent`);
    erwarte(treffer.includes("Ideen") && markiert === "Wochenplanung", `Treffer: ${treffer}`);
    await taste("Escape");
    return `Treffer: ${treffer.join(", ")} (markiert: „${markiert}“)`;
  });

  await pruefen(9, "Strg+P", async () => {
    await taste("p", 2);
    await waitFor(`document.querySelector('[role="dialog"]')`);
    await tippen("relaunch");
    await sleep(400);
    await taste("Enter");
    await waitFor(`document.querySelector('.page-title')?.value === "Website-Relaunch"`);
    const titel = await evaluate(`document.querySelector('.page-title')?.value`);
    erwarte(titel === "Website-Relaunch", `geöffnet: ${titel}`);
    return "„relaunch“ + Enter öffnet „Website-Relaunch“";
  });

  await pruefen(10, "Vorlage „Projekt“", async () => {
    await klickAuf(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.trim() === "Neu")`);
    await klickAuf(knopf("Notiz aus Vorlage …"));
    await waitFor(`${knopf("Projekt")}`);
    await klickAuf(knopf("Projekt"));
    await sleep(1200);
    const text = await datei("Unbenannt.md");
    erwarte(/^---\nid: [0-9a-f-]{36}\nstatus: Geplant\npriorität: mittel\n---\n# Ziel/.test(text), `Inhalt: ${text.slice(0, 80)}`);
    return "`Unbenannt.md` mit neuer id, Eigenschaften und Inhalt der Vorlage";
  });

  await pruefen(11, "Backlinks unter „Ideen“", async () => {
    await klickAuf(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
    await waitFor(`document.querySelector('.backlinks')`);
    await sleep(800);
    const text = await evaluate(`document.querySelector('.backlinks').textContent.replace(/\\s+/g, " ")`);
    erwarte(text.includes("Website-Relaunch"), `Backlinks: ${text}`);
    return text.slice(0, 120);
  });

  await pruefen(12, "Hell/Dunkel bleibt nach dem Neuladen", async () => {
    await klickAuf(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith("Einstellungen"))`);
    await klickAuf(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Dunkel")`);
    const sofort = await evaluate(`document.documentElement.dataset.theme`);
    await send("Page.reload");
    await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
    const danach = await evaluate(`document.documentElement.dataset.theme`);
    erwarte(sofort === "dark" && danach === "dark", `${sofort} / ${danach}`);
    return `sofort „${sofort}“, nach dem Neuladen „${danach}“`;
  });
} finally {
  console.log(`Klickliste „Version 1.0“ (${etappe}), Vorschau ${base}:`);
  console.log(ergebnisse.join("\n"));
  socket.close();
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
