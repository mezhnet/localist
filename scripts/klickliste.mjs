// Klicklisten „Version 1.0“ (Arbeitsregel 7), „Version 2.0“ (Etappe 15), „Version 2.1“ (Etappe 20, Punkt 9 seit
// Etappe 21), „Version 2.3“ (Etappe 22, Ziehen und Ablegen) und „Version 2.4“ (Etappe 23, Pomodoro; die Uhr der
// Vorschau wird über `__devVault.vorspulen` vorgestellt) automatisch in der Browser-Vorschau:
// steuert Microsoft Edge im Hintergrund mit echter Tastatur, Maus und (Liste 2.3) Fingern über das DevTools-Protokoll
// und prüft nach jedem Schritt die Datei im Arbeitsspeicher der Vorschau (dev-backend.ts). Echte Dateien ändern sich
// nicht. Seit Etappe 22 zieht auch die Kanban-Karte mit der Maus (Pointer Events statt HTML5-Drag-and-Drop).
//
// Aufruf, während die Vorschau läuft: node scripts/klickliste.mjs http://localhost:1430 "Etappe 15" [1.0|2.0|2.1|2.3|2.4]
// Rückfragen der Seite (window.confirm) beantwortet das Skript wie ein Mensch mit „OK“.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", etappe = "Etappe", liste = "1.0"] = process.argv.slice(2);
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
  } else if (message.method === "Page.javascriptDialogOpening") {
    dialoge.push(message.params.message);
    void send("Page.handleJavaScriptDialog", { accept: true });
  }
};
/** Texte der beantworteten Rückfragen. */
const dialoge = [];
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
const KEYS = { Enter: ["Enter", 13], Escape: ["Escape", 27], End: ["End", 35], Home: ["Home", 36], Tab: ["Tab", 9], ".": [".", 190] };
const taste = async (key, modifiers = 0, code) => {
  const [name, keyCode] = KEYS[key] ?? [key, key.toUpperCase().charCodeAt(0)];
  const info = { key: name, code: code ?? (KEYS[key] ? name : `Key${key.toUpperCase()}`), windowsVirtualKeyCode: keyCode, modifiers };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...info });
  if (name === "Enter") await send("Input.dispatchKeyEvent", { type: "char", text: "\r", ...info });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...info });
  await sleep(120);
};
const klick = async (x, y, { button = "left", modifiers = 0 } = {}) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : button, clickCount: 1, modifiers });
  await sleep(200);
};
/** Mit gedrückter Maustaste von (x1, y1) nach (x2, y2) ziehen, in kleinen Schritten wie eine echte Hand. */
const ziehen = async (x1, y1, x2, y2, { halten = 0 } = {}) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x1, y: y1, button: "none" });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x1, y: y1, button: "left", buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x1 + ((x2 - x1) * i) / 12, y: y1 + ((y2 - y1) * i) / 12, button: "left", buttons: 1 });
    await sleep(30);
  }
  if (halten) await sleep(halten);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", buttons: 0, clickCount: 1 });
  await sleep(300);
};
/**
 * Mit dem Finger: aufsetzen, `lang` ms ruhig liegen lassen (langes Drücken), in Schritten zum Ziel, loslassen
 * (Touch-Ereignisse über das Protokoll; die Seite bekommt daraus Pointer Events mit pointerType „touch“).
 */
const finger = async (x1, y1, x2, y2, { lang = 700, schritte = 10, bild } = {}) => {
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1, id: 1 }] });
  await sleep(lang);
  for (let i = 1; i <= schritte; i++) {
    await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + ((x2 - x1) * i) / schritte, y: y1 + ((y2 - y1) * i) / schritte, id: 1 }] });
    await sleep(40);
  }
  await sleep(300);
  // Screenshot mitten im Ziehen (nur mit gesetztem SCREENSHOT_ORDNER, z. B. docs/screenshots/etappe-22)
  if (bild && process.env.SCREENSHOT_ORDNER) {
    const { data } = (await send("Page.captureScreenshot", { format: "png" })).result;
    writeFileSync(join(process.env.SCREENSHOT_ORDNER, bild), Buffer.from(data, "base64"));
  }
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(500);
};
/** Mitte eines Elements (Ausdruck), scrollt es vorher in Sicht. */
const mitte = async (elementExpr, fy = 0.5) => {
  const r = await evaluate(`(() => { const el = ${elementExpr}; if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * ${fy} }; })()`);
  if (!r) throw new Error(`Nicht gefunden: ${elementExpr}`);
  return r;
};
/** Klick auf ein Element (Ausdruck liefert das Element), an Position `wo` (Bruchteil der Breite). */
const klickAuf = async (elementExpr, wo = 0.5, optionen) => {
  const rect = await evaluate(`(() => { const el = ${elementExpr}; if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width * ${wo}, y: r.y + r.height / 2 }; })()`);
  if (!rect) throw new Error(`Nicht gefunden: ${elementExpr}`);
  await klick(rect.x, rect.y, optionen);
};
const rechteck = (elementExpr) => evaluate(`(() => { const r = (${elementExpr})?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null; })()`);
const knopf = (text) => `[...document.querySelectorAll('button, [role="menuitem"], [role="option"], [role="tab"]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute("aria-label") === ${JSON.stringify(text)})`;
const datei = (pfad) => evaluate(`window.__devVault.files.get(${JSON.stringify(pfad)}) ?? ""`);
const SICHTBAR = `[...document.querySelectorAll('iframe.html-frame')].find((f) => !f.classList.contains('is-loading'))`;
/** Wertet einen Ausdruck in der sichtbaren Seite aus (abgeschottetes iframe, läuft in einem eigenen Prozess). */
async function inSeite(expression) {
  const src = await evaluate(`${SICHTBAR}?.src`);
  const ziel = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "iframe" && t.url === src);
  if (!ziel) throw new Error(`Seite nicht gefunden: ${src}`);
  const frame = new WebSocket(ziel.webSocketDebuggerUrl);
  await new Promise((resolve) => (frame.onopen = resolve));
  const wert = await new Promise((resolve) => {
    frame.onmessage = (event) => resolve(JSON.parse(event.data).result?.result?.value);
    frame.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  });
  frame.close();
  return wert;
}

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

  if (liste === "1.0") {
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
      // Seit Etappe 22 mit der Maus (Pointer Events), vorher Drag-Ereignisse per Skript
      const col = (n) => `[...document.querySelectorAll('.kanban-column')].find((c) => c.querySelector('.kanban-column-header').textContent.startsWith(${JSON.stringify(n)}))`;
      const karte = await mitte(`${col("Geplant")}.querySelector('.kanban-card')`);
      const ziel = await mitte(col("Erledigt"), 0.3);
      await ziehen(karte.x, karte.y, ziel.x, ziel.y);
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
      await klickAuf(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.trim() === "Neue Seite")`);
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
  } else if (liste === "2.3") {
    // Etappe 22: Ziehen und Ablegen mit Maus (1280 × 800) und Finger (Handy 360 × 740 mit Touch)
    const zeile = (pfad) => `document.querySelector('.tree [title=${JSON.stringify(pfad)}]')?.closest('.tree-row')`;
    const aufklappen = async (pfad) => {
      if ((await evaluate(`${zeile(pfad)}?.closest('li').getAttribute('aria-expanded')`)) !== "true") await klickAuf(`${zeile(pfad)}.querySelector('.tree-toggle')`);
      await sleep(300);
    };

    await pruefen(1, "Seite in einen Ordner ziehen, danach „Rückgängig“", async () => {
      await aufklappen("Notizen");
      const von = await mitte(zeile("Notizen/Ideen.md"));
      const nach = await mitte(zeile("Vorlagen"));
      await ziehen(von.x, von.y, nach.x, nach.y);
      erwarte(await waitFor(`window.__devVault.files.has("Vorlagen/Ideen.md") && !window.__devVault.files.has("Notizen/Ideen.md")`), "nicht verschoben");
      const meldung = await evaluate(`document.querySelector('.toast')?.textContent ?? ""`);
      erwarte(meldung.includes("„Ideen“ nach „Vorlagen“ verschoben."), `Meldung: ${meldung}`);
      const link = await datei("Notizen/DNS.html");
      erwarte(link.includes('href="../Vorlagen/Ideen.md"'), "Link in DNS.html nicht angepasst");
      await klickAuf(`[...document.querySelectorAll('.toast button')].find((b) => b.textContent === "Rückgängig")`);
      erwarte(await waitFor(`window.__devVault.files.has("Notizen/Ideen.md") && !window.__devVault.files.has("Vorlagen/Ideen.md")`), "Rückgängig ging nicht");
      erwarte((await datei("Notizen/DNS.html")).includes('href="Ideen.md"'), "Link nach Rückgängig nicht zurück");
      return `Meldung „${meldung}“, nach „Rückgängig“ wieder Notizen/Ideen.md, Link in DNS.html wieder „Ideen.md“`;
    });

    await pruefen(2, "Ordner in einen anderen Ordner ziehen; ein Link auf eine Seite darin geht danach noch", async () => {
      await sleep(6500); // Meldung von Punkt 1 ist weg
      const von = await mitte(zeile("Notizen"));
      const nach = await mitte(zeile("Vorlagen"));
      await ziehen(von.x, von.y, nach.x, nach.y);
      erwarte(await waitFor(`window.__devVault.files.has("Vorlagen/Notizen/Ideen.md") && !window.__devVault.files.has("Notizen/Ideen.md")`), "Ordner nicht verschoben");
      // Lernen/Bausteine.html verlinkt per <a href> auf „Ideen“ in „Notizen“: der Wert folgt dem Ordner
      erwarte(await waitFor(`window.__devVault.files.get("Lernen/Bausteine.html").includes('href="../Vorlagen/Notizen/Ideen.md"')`), "Link in Bausteine.html nicht angepasst");
      // Website-Relaunch verlinkt [[Ideen]]: Ein Klick öffnet die Seite am neuen Ort
      await aufklappen("Projekte");
      await klickAuf(`document.querySelector('.tree [title="Projekte/Website-Relaunch.md"]')`);
      await waitFor(`[...document.querySelectorAll('.bn-editor .node-wikilink')].some((e) => e.textContent.trim() === "Ideen")`);
      await klickAuf(`[...document.querySelectorAll('.bn-editor .node-wikilink')].find((e) => e.textContent.trim() === "Ideen")`);
      erwarte(await waitFor(`document.querySelector('.page-title')?.value === "Ideen"`), "Link öffnet „Ideen“ nicht");
      const aktiv = await evaluate(`document.querySelector('.tree-row.active .tree-label')?.title ?? ""`);
      erwarte(aktiv === "Vorlagen/Notizen/Ideen.md", `geöffnet: ${aktiv}`);
      return `„Notizen“ liegt in „Vorlagen“; Bausteine.html verlinkt „../Vorlagen/Notizen/Ideen.md“; [[Ideen]] in „Website-Relaunch“ öffnet ${aktiv}`;
    });

    // Handy mit Touch
    await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.navigate", { url: base });
    await waitFor(`document.querySelector('.handy-nav')`);
    await sleep(800);

    await pruefen(3, "Handy 360 × 740 mit Touch: lange drücken, ziehen, ablegen", async () => {
      await klickAuf(`[...document.querySelectorAll(".handy-nav button")].find((b) => b.textContent.trim() === "Seiten")`);
      await waitFor(`document.querySelector(".sidebar-shell.open [role='tree']")`);
      const z = (pfad) => `document.querySelector('.sidebar-shell.open .tree [title=${JSON.stringify(pfad)}]')?.closest('.tree-row')`;
      if ((await evaluate(`${z("Notizen")}?.closest('li').getAttribute('aria-expanded')`)) !== "true") await klickAuf(`${z("Notizen")}.querySelector('.tree-toggle')`);
      await sleep(300);
      const von = await mitte(z("Notizen/Formatierung.md"));
      const nach = await mitte(z("Projekte"));
      await finger(von.x, von.y, nach.x, nach.y, { bild: "handy-ziehen-360x740.png" });
      erwarte(await waitFor(`window.__devVault.files.has("Projekte/Formatierung.md")`), "nicht verschoben");
      erwarte(!(await evaluate(`Boolean(document.querySelector('[role="menu"]'))`)), "Menü erschienen");
      return "„Formatierung“ per Finger nach „Projekte“ gelegt, kein Menü";
    });

    await pruefen(4, "Kanban-Karte auf dem Handy in eine andere Spalte ziehen", async () => {
      await sleep(6500);
      const z = (pfad) => `document.querySelector('.sidebar-shell.open .tree [title=${JSON.stringify(pfad)}]')`;
      if (!(await evaluate(`Boolean(document.querySelector(".sidebar-shell.open"))`))) await klickAuf(`[...document.querySelectorAll(".handy-nav button")].find((b) => b.textContent.trim() === "Seiten")`);
      await klickAuf(z("Projekte"));
      await waitFor(`document.querySelector('[aria-label="Ansicht hinzufügen"]')`);
      await klickAuf(`document.querySelector('[aria-label="Ansicht hinzufügen"]')`);
      await klickAuf(knopf("Kanban"));
      await waitFor(`document.querySelector('.kanban-card')`);
      await sleep(500);
      const col = (n) => `[...document.querySelectorAll('.kanban-column')].find((c) => c.querySelector('.kanban-column-header').textContent.startsWith(${JSON.stringify(n)}))`;
      const von = await mitte(`${col("Geplant")}.querySelector('.kanban-card')`);
      const spalte = await evaluate(`(() => { const r = ${col("In Arbeit")}.getBoundingClientRect(); return { x: Math.min(r.x + 40, innerWidth - 20), y: r.y + 60 }; })()`);
      await finger(von.x, von.y, spalte.x, spalte.y);
      erwarte(await waitFor(`window.__devVault.files.get("Projekte/Umzug.md").includes("status: In Arbeit")`), "Karte nicht verschoben");
      return "„Umzug“ per Finger von „Geplant“ nach „In Arbeit“ (status: In Arbeit)";
    });
  } else if (liste === "2.4") {
    // Etappe 23: Pomodoro mit Maus (1280 × 800), danach Handy 360 × 740 mit Touch
    const ansichtOffen = `document.querySelector('.pomodoro')`;
    const zeit = (wo) => evaluate(`document.querySelector(${JSON.stringify(wo)})?.textContent ?? ""`);
    const sekunden = (text) => text.split(":").reduce((summe, teil) => summe * 60 + Number(teil), 0);
    const ideenOeffnen = async () => {
      if ((await evaluate(`document.querySelector('.tree [title="Notizen"]')?.closest('li').getAttribute('aria-expanded')`)) !== "true") {
        await klickAuf(`document.querySelector('.tree [title="Notizen"]')?.closest('.tree-row').querySelector('.tree-toggle')`);
        await sleep(300);
      }
      await klickAuf(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
      erwarte(await waitFor(`document.querySelector('.page-title')?.value === "Ideen"`), "„Ideen“ nicht geöffnet");
    };

    await pruefen(1, "Pomodoro öffnen, Fokus auf 1 Min., starten, zu einer Notiz wechseln: Der Mini-Timer läuft weiter", async () => {
      await klickAuf(`document.querySelector('.sidebar-werkzeuge .sidebar-item')`);
      erwarte(await waitFor(ansichtOffen), "Ansicht „Pomodoro“ nicht geöffnet");
      await klickAuf(`document.querySelector('.pomodoro-einstellungen')`);
      const feld = `document.querySelector('[role="dialog"] input[aria-label="Fokus (1–120 Min.)"]')`;
      erwarte(await waitFor(feld), "Abschnitt „Pomodoro“ in den Einstellungen fehlt");
      await klickAuf(feld);
      await evaluate(`${feld}.select()`);
      await tippen("1");
      await taste("Enter");
      erwarte(await waitFor(`JSON.parse(window.__devVault.files.get(".localist/settings.json") ?? "{}").pomodoro?.fokus === 1`), "Fokus nicht in settings.json");
      await taste("Escape");
      erwarte(await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('.pomodoro-zeit')?.textContent === "01:00"`), "Ansicht zeigt nicht 01:00");
      await klickAuf(knopf("Starten"));
      erwarte(await waitFor(`document.querySelector('.pomodoro-start')?.textContent === "Pausieren"`), "Timer startet nicht");
      await ideenOeffnen();
      const mini = ".mini-timer.is-seitenleiste .mini-timer-zeit";
      erwarte(await waitFor(`document.querySelector(${JSON.stringify(mini)})`), "kein Mini-Timer in der Seitenleiste");
      const vorher = await zeit(mini);
      await sleep(2200);
      const nachher = await zeit(mini);
      erwarte(sekunden(nachher) < sekunden(vorher), `Mini-Timer steht: ${vorher} → ${nachher}`);
      return `settings.json pomodoro.fokus = 1, Ansicht 01:00, gestartet; auf „Ideen“ zeigt der Mini-Timer unten in der Seitenleiste ${vorher} → ${nachher}`;
    });

    await pruefen(2, "Ablauf (Zeit vorgespult): Meldung erscheint, die Session steht unter „Heute“", async () => {
      await evaluate(`window.__devVault.vorspulen(61000); true`);
      erwarte(await waitFor(`[...document.querySelectorAll('.dev-benachrichtigung')].some((e) => e.textContent.includes("Fokus geschafft"))`), "keine Meldung");
      const meldung = await evaluate(`[...document.querySelectorAll('.dev-benachrichtigung')].map((e) => e.textContent).find((t) => t.includes("Fokus geschafft"))`);
      const zeile = await evaluate(`[...window.__devVault.files].find(([pfad]) => pfad.startsWith(".localist/pomodoro/"))`);
      erwarte(zeile && JSON.parse(zeile[1].trim().split("\n").pop()).minuten === 1, `Verlauf: ${JSON.stringify(zeile)}`);
      await klickAuf(`document.querySelector('.sidebar-werkzeuge .sidebar-item')`);
      erwarte(await waitFor(`document.querySelector('.pomodoro-sessions .pomodoro-session')`), "„Heute“ ohne Session");
      const heute = await evaluate(`document.querySelector('.pomodoro-zahl[aria-label="Heute"]').textContent + " – " + document.querySelector('.pomodoro-session').textContent`);
      return `Meldung „${meldung}“; ${zeile[0]}: ${zeile[1].trim()}; unter „Heute“: ${heute}`;
    });

    await pruefen(3, "„Pomodoro für diese Seite starten“ im „…“-Menü von „Ideen“: Der Link zur Seite erscheint", async () => {
      await ideenOeffnen();
      await klickAuf(`document.querySelector('.topbar-mehr')`);
      await klickAuf(knopf("Pomodoro für diese Seite starten"));
      erwarte(await waitFor(`document.querySelector('.pomodoro-seite-link')?.textContent === "Ideen"`), "kein Link zur Seite");
      const id = await evaluate(`(window.__devVault.files.get("Notizen/Ideen.md").match(/^id: (.+)$/m) ?? [])[1] ?? ""`);
      erwarte(/^[0-9a-f-]{36}$/.test(id), `keine id in Ideen.md: ${id}`);
      const reiter = await evaluate(`[...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim()).join(", ")`);
      await klickAuf(`document.querySelector('.pomodoro-seite-link')`);
      erwarte(await waitFor(`document.querySelector('.page-title')?.value === "Ideen"`), "Link öffnet „Ideen“ nicht");
      return `Link „Ideen“ in der Ansicht, Ideen.md hat jetzt id ${id}, Reiter: ${reiter}; Klick auf den Link öffnet „Ideen“`;
    });

    await pruefen(4, "Handy 360 × 740: Mini-Leiste über der Navigationsleiste, Klick öffnet die Ansicht", async () => {
      await klickAuf(`document.querySelector('.sidebar-werkzeuge .sidebar-item')`);
      erwarte(await waitFor(ansichtOffen), "Ansicht nicht geöffnet");
      await klickAuf(knopf("Starten"));
      erwarte(await waitFor(`document.querySelector('.pomodoro-start')?.textContent === "Pausieren"`), "Timer startet nicht");
      // Handy mit Touch; der Timer übersteht das Neuladen (App-Speicher).
      await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await send("Page.navigate", { url: base });
      await waitFor(`document.querySelector('.handy-nav')`);
      // Der gemerkte Reiter zeigt die Ansicht „Pomodoro“ (dort gibt es keine Mini-Leiste): zur Startseite.
      await klickAuf(`[...document.querySelectorAll(".handy-nav button")].find((b) => b.textContent.trim() === "Start")`);
      erwarte(await waitFor(`document.querySelector('.mini-timer.is-handy')`), "keine Mini-Leiste auf dem Handy");
      const mini = await rechteck(`document.querySelector('.mini-timer.is-handy')`);
      const nav = await rechteck(`document.querySelector('.handy-nav')`);
      erwarte(mini.bottom <= nav.top && nav.top - mini.bottom <= 16 && mini.height >= 44, `Lage: Leiste ${JSON.stringify(mini)}, Navigation ${JSON.stringify(nav)}`);
      const text = await zeit(".mini-timer.is-handy .mini-timer-oeffnen");
      await klickAuf(`document.querySelector('.mini-timer.is-handy .mini-timer-oeffnen')`);
      erwarte(await waitFor(ansichtOffen), "Klick öffnet die Ansicht nicht");
      return `Mini-Leiste „${text}“ (${Math.round(mini.height)} px hoch) ${Math.round(nav.top - mini.bottom)} px über der Navigationsleiste; Klick öffnet „Pomodoro“`;
    });
  } else if (liste === "2.1") {
    // Klickliste „Version 2.1“ (Etappe 20)
    const reiter = () => evaluate(`[...document.querySelectorAll('[role="tablist"][aria-label="Offene Reiter"] [role="tab"]')].map((t) => t.textContent.trim() + (t.getAttribute("aria-selected") === "true" ? "*" : ""))`);
    const zeilen = async (pfad, muster) => (await datei(pfad)).split("\n").filter((z) => muster.test(z));

    await pruefen(1, "Tab/Shift+Tab in Liste und Code", async () => {
      await klickAuf(`document.querySelector('.tree [title="Notizen"]')`);
      await klickAuf(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
      erwarte(await waitFor(`[...document.querySelectorAll('.bn-editor .bn-inline-content')].some((e) => e.textContent === "Einkaufsliste mit Checkboxen")`), "Ideen nicht geöffnet");
      await klickAuf(`[...document.querySelectorAll('.bn-editor .bn-inline-content')].find((e) => e.textContent === "Einkaufsliste mit Checkboxen")`, 0.5);
      await taste("Tab");
      await sleep(1200);
      const ein = await zeilen("Notizen/Ideen.md", /Einkaufsliste/);
      erwarte(/^\s+- Einkaufsliste mit Checkboxen$/.test(ein[0] ?? ""), `nicht eingerückt: ${JSON.stringify(ein)}`);
      const imEditor = await evaluate(`document.querySelector('.bn-editor').contains(document.activeElement)`);
      erwarte(imEditor, "Fokus hat den Editor verlassen");
      await taste("Tab", 8);
      await sleep(1200);
      const aus = await zeilen("Notizen/Ideen.md", /Einkaufsliste/);
      erwarte(aus[0] === "- Einkaufsliste mit Checkboxen", `nicht ausgerückt: ${JSON.stringify(aus)}`);
      // Code-Editor der HTML-Seite DNS
      await klickAuf(`document.querySelector('.tree [title="Notizen/DNS.html"]')`);
      erwarte(await waitFor(`document.querySelector('[aria-label="Ansicht (Strg+E)"]')`), "DNS nicht geöffnet");
      await klickAuf(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent.trim() === "Code")`);
      erwarte(await waitFor(`[...document.querySelectorAll('.cm-content .cm-line')].some((l) => l.textContent.startsWith("<h1>"))`), "Code fehlt");
      await klickAuf(`[...document.querySelectorAll('.cm-content .cm-line')].find((l) => l.textContent.startsWith("<h1>"))`, 0.3);
      await taste("Tab");
      await sleep(1200);
      const codeEin = await zeilen("Notizen/DNS.html", /<h1>/);
      await taste("Tab", 8);
      await sleep(1200);
      const codeAus = await zeilen("Notizen/DNS.html", /<h1>/);
      erwarte(codeEin[0]?.startsWith("  <h1>") && codeAus[0]?.startsWith("<h1>"), `Code: ${JSON.stringify(codeEin)} → ${JSON.stringify(codeAus)}`);
      return `Liste: „${ein[0]}“ → „${aus[0]}“, Fokus blieb im Editor; Code (Cursor mitten in der Zeile): „${codeEin[0].slice(0, 12)}…“ → „${codeAus[0].slice(0, 10)}…“`;
    });

    await pruefen(2, "„Im Explorer öffnen“ (Vorschau-Simulation)", async () => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5, button: "none" });
      const r = await rechteck(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
      for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r.left + 30, y: r.top + r.height / 2, button: "right", clickCount: 1 });
      erwarte(await waitFor(knopf("Im Explorer öffnen")), "Kontextmenü ohne „Im Explorer öffnen“");
      await klickAuf(knopf("Im Explorer öffnen"));
      erwarte(await waitFor(`document.querySelector('.notice.toast')?.textContent.includes("Explorer")`), "keine Meldung");
      const meldung = await evaluate(`document.querySelector('.notice.toast').textContent`);
      const pfade = await evaluate(`window.__devVault.explorer.join(", ")`);
      erwarte(pfade === "Notizen/Ideen.md", `Pfad: ${pfade}`);
      return `Rechtsklick auf „Ideen“ → „Im Explorer öffnen“: Meldung „${meldung}“, Pfad ${pfade}`;
    });

    await pruefen(3, "Seitenleiste rechts und eingeklappt", async () => {
      await klickAuf(`[...document.querySelectorAll('.sidebar-footer button')].find((b) => b.textContent.trim().startsWith("Einstellungen"))`);
      await klickAuf(`[...document.querySelectorAll('[role="dialog"] [aria-label="Seitenleiste"] button')].find((b) => b.textContent.trim() === "Rechts")`);
      await taste("Escape");
      await sleep(400);
      const seite = await rechteck(`document.querySelector(".sidebar-shell")`);
      const inhalt = await rechteck(`document.querySelector("main.main")`);
      erwarte(seite.left > inhalt.right - 1, `Seitenleiste nicht rechts (${seite.left} / ${inhalt.right})`);
      await taste(".", 2, "Period");
      await sleep(600);
      const zu = await rechteck(`document.querySelector(".sidebar-shell")`);
      const voll = await rechteck(`document.querySelector("main.main")`);
      erwarte(zu.width < 1 && (await evaluate(`document.querySelector(".workspace").classList.contains("is-eingeklappt")`)), `nicht eingeklappt (${zu.width})`);
      const gemerkt = await evaluate(`localStorage.getItem("seitenleiste-seite") + "/" + localStorage.getItem("seitenleiste-eingeklappt")`);
      await taste(".", 2, "Period");
      await sleep(600);
      const auf = await rechteck(`document.querySelector(".sidebar-shell")`);
      erwarte(auf.width > 200, "nicht wieder ausgeklappt");
      return `rechts: Seitenleiste ab x ${Math.round(seite.left)} (Inhalt bis ${Math.round(inhalt.right)}); Strg+. eingeklappt (Breite ${Math.round(zu.width)}, Inhalt ${Math.round(voll.width)} px breit), gemerkt „${gemerkt}“; Strg+. wieder ${Math.round(auf.width)} px`;
    });

    await pruefen(4, "Code rechts und Trennlinie ziehen", async () => {
      await klickAuf(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent.trim() === "Geteilt")`);
      erwarte(await waitFor(`document.querySelector('.html-workspace.is-geteilt [role="separator"]')`), "„Geteilt“ fehlt");
      await klickAuf(`document.querySelector('[aria-label="Seiten tauschen"]')`);
      await sleep(500);
      const code = await rechteck(`document.querySelector(".html-code-pane")`);
      const vorschau = await rechteck(`document.querySelector(".html-preview-pane")`);
      erwarte(code.left > vorschau.left, "Code nicht rechts");
      const linie = await rechteck(`document.querySelector('.html-workspace [role="separator"]')`);
      const vorher = await evaluate(`document.querySelector('.html-workspace [role="separator"]').getAttribute("aria-valuenow")`);
      await ziehen(linie.left + linie.width / 2, linie.top + linie.height / 2, linie.left + linie.width / 2 - 120, linie.top + linie.height / 2);
      const nachher = await evaluate(`document.querySelector('.html-workspace [role="separator"]').getAttribute("aria-valuenow")`);
      const gemerkt = await evaluate(`localStorage.getItem("html-code-seite") + ", Anteil " + localStorage.getItem("html-geteilt-anteil")`);
      erwarte(Number(nachher) > Number(vorher), `Trennlinie: ${vorher} → ${nachher}`);
      await klickAuf(`document.querySelector('[aria-label="Seiten tauschen"]')`);
      return `„Seiten tauschen“: Code rechts (x ${Math.round(code.left)} > ${Math.round(vorschau.left)}); Trennlinie 120 px nach links gezogen: Code-Anteil ${vorher} % → ${nachher} %, gemerkt „${gemerkt}“`;
    });

    await pruefen(5, "Reiter öffnen, wechseln, schließen", async () => {
      await klickAuf(`document.querySelector('.tree [title="Notizen/Formatierung.md"]')`, 0.5, { modifiers: 2 });
      erwarte(await waitFor(`[...document.querySelectorAll('[aria-label="Offene Reiter"] [role="tab"]')].some((t) => t.textContent.includes("Formatierung"))`), "kein neuer Reiter");
      const offen = await reiter();
      // Strg+Tab wechselt reihum (vom letzten zum festen Reiter „Startseite“), Strg+Umschalt+Tab zurück
      await taste("Tab", 2);
      await sleep(500);
      const gewechselt = await reiter();
      await taste("Tab", 2 | 8);
      await sleep(500);
      const zurueck = await reiter();
      erwarte(gewechselt.includes("Startseite*") && zurueck.some((r) => r.startsWith("Formatierung") && r.endsWith("*")), `Wechsel: ${gewechselt} / ${zurueck}`);
      await taste("w", 2);
      await sleep(500);
      const geschlossen = await reiter();
      erwarte(offen.length === geschlossen.length + 1 && !geschlossen.some((r) => r.startsWith("Formatierung")), `Reiter: ${offen} → ${geschlossen}`);
      // Mittelklick schließt
      await klickAuf(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`, 0.5, { modifiers: 2 });
      await sleep(500);
      const mitIdeen = await reiter();
      await klickAuf(`[...document.querySelectorAll('[aria-label="Offene Reiter"] .reiter')].find((r) => r.textContent.includes("Ideen"))`, 0.4, { button: "middle" });
      await sleep(500);
      const ohne = await reiter();
      erwarte(mitIdeen.length === ohne.length + 1, `Mittelklick: ${mitIdeen} → ${ohne}`);
      return `Strg+Klick: ${offen.join(" | ")}; Strg+Tab: ${gewechselt.join(" | ")}; Strg+Umschalt+Tab: ${zurueck.join(" | ")}; Strg+W: ${geschlossen.join(" | ")}; Mittelklick schließt „Ideen“: ${ohne.join(" | ")}`;
    });

    await pruefen(6, "Schnell notieren", async () => {
      await klickAuf(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.trim() === "Startseite")`);
      erwarte(await waitFor(`document.querySelector('[aria-label="Schnell notieren"]')`), "Startseite fehlt");
      await klickAuf(`document.querySelector('[aria-label="Schnell notieren"]')`);
      await tippen("Klickliste 2.1");
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 });
      await send("Input.dispatchKeyEvent", { type: "char", text: "\r", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers: 8 });
      await tippen("Zweite Zeile vom Schnell-Notieren");
      await taste("Enter");
      erwarte(await waitFor(`window.__devVault.files.has("Klickliste 2.1.md")`), "Notiz nicht angelegt");
      const text = await datei("Klickliste 2.1.md");
      const feld = await evaluate(`document.querySelector('[aria-label="Schnell notieren"]').value`);
      erwarte(/^---\nid: [0-9a-f-]{36}\n---\n/.test(text) && text.includes("Zweite Zeile vom Schnell-Notieren") && feld === "", `Datei: ${JSON.stringify(text)}`);
      const oben = await evaluate(`document.querySelector('.home-table-zeile .home-table-titel')?.textContent`);
      return `Enter legt „Klickliste 2.1.md“ an (Umschalt+Enter = neue Zeile, Inhalt „Zweite Zeile vom Schnell-Notieren“), Feld wieder leer, oben in „Zuletzt bearbeitet“: „${oben}“`;
    });

    await pruefen(7, "Modus Schwarz mit Akzent Blau", async () => {
      await klickAuf(`document.querySelector('.modus-umschalter [aria-label="Schwarz"]')`);
      await klickAuf(`[...document.querySelectorAll('.sidebar-footer button')].find((b) => b.textContent.trim().startsWith("Einstellungen"))`);
      await klickAuf(`document.querySelector('[role="dialog"] [role="radio"][aria-label="Blau"]')`);
      await taste("Escape");
      const css = `(() => { const s = getComputedStyle(document.documentElement); return { modus: document.documentElement.dataset.theme, akzent: document.documentElement.dataset.accent, fenster: s.getPropertyValue("--color-window").trim(), farbe: s.getPropertyValue("--color-accent").trim(), knopf: getComputedStyle(document.querySelector(".home-schnell-notiz")).backgroundColor }; })()`;
      const sofort = await evaluate(css);
      await send("Page.reload");
      await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
      const danach = await evaluate(css);
      erwarte(sofort.modus === "black" && sofort.akzent === "blau" && sofort.fenster === "#000000" && sofort.farbe === "#2a65db", `sofort: ${JSON.stringify(sofort)}`);
      erwarte(danach.modus === "black" && danach.akzent === "blau", `nach dem Neuladen: ${JSON.stringify(danach)}`);
      return `sofort ${JSON.stringify(sofort)}; nach dem Neuladen Modus „${danach.modus}“, Akzent „${danach.akzent}“`;
    });

    await pruefen(8, "Tabelle in einer Notiz bearbeiten", async () => {
      await klickAuf(`document.querySelector('.tree [title="Lernen"]')`);
      erwarte(await waitFor(`document.querySelector('.tree [title="Lernen/Subnetting.md"]')`), "Lernen nicht aufgeklappt");
      await klickAuf(`document.querySelector('.tree [title="Lernen/Subnetting.md"]')`);
      erwarte(await waitFor(`document.querySelector('.bn-editor [data-content-type="table"] td')`), "Tabelle fehlt");
      await klickAuf(`[...document.querySelectorAll('.bn-editor [data-content-type="table"] td')].find((z) => z.textContent.trim() === "64")`, 0.9);
      await taste("End");
      await tippen(" Adr.");
      await sleep(1200);
      const zelle = await zeilen("Lernen/Subnetting.md", /\/26/);
      erwarte(/^\| \/26 \| 64 Adr\. \|$/.test(zelle[0] ?? ""), `Zelle: ${JSON.stringify(zelle)}`);
      // Zeile über das „+“ unter der Tabelle anfügen (erscheint beim Überfahren der Tabelle; ohne zu scrollen klicken)
      const tabelle = await rechteck(`document.querySelector('.bn-editor [data-content-type="table"] table')`);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: tabelle.left + tabelle.width / 2, y: tabelle.bottom - 8, button: "none" });
      await sleep(400);
      erwarte(await waitFor(`document.querySelector(".bn-extend-button-add-remove-rows")`), "„+“ für Zeilen fehlt");
      const plus = await rechteck(`document.querySelector(".bn-extend-button-add-remove-rows")`);
      await klick(plus.left + plus.width / 2, plus.top + plus.height / 2);
      await sleep(1200);
      const tabellenZeilen = await zeilen("Lernen/Subnetting.md", /^\|/);
      erwarte(tabellenZeilen.length === 6 && /^\|\s*\|\s*\|$/.test(tabellenZeilen.at(-1)), `Tabelle: ${JSON.stringify(tabellenZeilen)}`);
      return `Zelle „64“ → „64 Adr.“ und neue Zeile über „+“: ${tabellenZeilen.join(" ")}`;
    });

    await pruefen(9, "Nach Updates suchen (Vorschau-Simulation): Update verfügbar → installieren", async () => {
      const befehle = () => evaluate(`JSON.stringify(window.__devVault.update.befehle)`);
      const meldung = () => evaluate(`document.querySelector('.ueber-localist .update-meldung')?.textContent ?? ""`);
      const vorher = await befehle();
      await klickAuf(`[...document.querySelectorAll('.sidebar-footer button')].find((b) => b.textContent.trim().startsWith("Einstellungen"))`);
      erwarte(await waitFor(`document.querySelector('[role="dialog"] .ueber-localist .app-version')?.textContent.match(/^\\d/)`), "„Über Localist“ ohne Version");
      const version = await evaluate(`document.querySelector('.ueber-localist .app-version').textContent`);
      await sleep(500);
      const offen = await befehle();
      erwarte(vorher === "[]" && offen === "[]", `Abfrage ohne Klick: vorher ${vorher}, nach dem Öffnen ${offen}`);
      await klickAuf(knopf("Nach Updates suchen"));
      erwarte(await waitFor(`document.querySelector('.ueber-localist .update-meldung')?.textContent.startsWith("Update verfügbar: v")`), `keine Meldung „Update verfügbar“: ${await meldung()}`);
      const verfuegbar = await meldung();
      const notizen = await evaluate(`document.querySelector('.ueber-localist .update-notizen')?.textContent.split("\\n")[0] ?? ""`);
      await klickAuf(knopf("Jetzt installieren"));
      let fortschritt = "";
      for (let t = 0; t < 8000 && !fortschritt; t += 50) {
        const text = await meldung();
        if (/^Wird heruntergeladen … \d+ %$/.test(text) && !text.startsWith("Wird heruntergeladen … 0 ")) fortschritt = text;
        else await sleep(50);
      }
      erwarte(fortschritt, "kein Fortschritt in Prozent");
      erwarte(await waitFor(`document.querySelector('.ueber-localist .update-meldung')?.textContent === "Wird installiert, Localist startet neu …"`), `Ende: ${await meldung()}`);
      erwarte(await waitFor(`window.__devVault.update.befehle.join() === "check,download_and_install,restart"`), `Befehle: ${await befehle()}`);
      await taste("Escape");
      return `Version ${version}; ohne Klick keine Abfrage (${offen}); „${verfuegbar}“ mit Notizen „${notizen}“; „Jetzt installieren“: „${fortschritt}“ → „Wird installiert, Localist startet neu …“; Befehle ${await befehle()}`;
    });
  } else {
    // Klickliste „Version 2.0“ (Etappe 15): HTML-Seite anlegen, Code bearbeiten, jeder Baustein, eigener Baustein,
    // Notizbuch, Umwandeln, Export. Rückfragen (window.confirm) beantwortet der Dialog-Handler oben mit „OK“.
    const SEITE = "Unbenannt.html";
    const ansicht = async (name) => {
      await klickAuf(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)})`);
      erwarte(await waitFor(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)}).getAttribute("aria-pressed") === "true"`), `Ansicht ${name} nicht aktiv`);
    };
    const werkzeug = (name) => `[...document.querySelectorAll('.baustein-leiste button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)})`;
    const aktionen = async (seite, punkt) => {
      erwarte(await waitFor(`document.querySelector('[aria-label="Aktionen für „${seite}“"]')`), `„${seite}“ nicht im Ordnerbaum`);
      await klickAuf(`document.querySelector('[aria-label="Aktionen für „${seite}“"]')`);
      erwarte(await waitFor(knopf(punkt)), `Menüpunkt „${punkt}“ fehlt`);
      await klickAuf(knopf(punkt));
    };

    await pruefen(1, "HTML-Seite anlegen", async () => {
      await klickAuf(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.trim() === "Neue Seite")`);
      erwarte(await waitFor(knopf("HTML-Seite")), "„Neu“-Menü ohne HTML-Seite");
      await klickAuf(knopf("HTML-Seite"));
      erwarte(await waitFor(`window.__devVault.files.has(${JSON.stringify(SEITE)}) && document.querySelector('.html-workspace.is-geteilt .cm-editor')`), "Seite nicht angelegt oder nicht in „Geteilt“ geöffnet");
      const text = await datei(SEITE);
      const id = /<meta name="localist-id" content="([0-9a-f-]{36})">/.exec(text)?.[1];
      erwarte(id && text.includes("<title>Unbenannt</title>") && text.includes('<link rel="stylesheet" href=".localist/bausteine/localist.css">'), "Kopfbereich unvollständig");
      return `${SEITE} mit localist-id ${id}, <title>Unbenannt</title> und Verweisen auf .localist/bausteine/, geöffnet in „Geteilt“`;
    });

    await pruefen(2, "Code bearbeiten", async () => {
      const vorher = await datei(SEITE);
      await klickAuf(`document.querySelector('.cm-content .cm-line')`);
      await tippen("<p>Klickliste Version 2.0</p>");
      await sleep(1500);
      const nachher = await datei(SEITE);
      erwarte(nachher.replace("<p>Klickliste Version 2.0</p>", "") === vorher, "Datei anders geändert als erwartet");
      erwarte(await waitFor(`${SICHTBAR}?.src.includes(${JSON.stringify(SEITE)})`), "Vorschau fehlt");
      await sleep(800);
      const vorschau = await inSeite(`document.querySelector("main p")?.textContent`);
      erwarte(vorschau === "Klickliste Version 2.0", `Vorschau zeigt „${vorschau}“`);
      return "getippt, gespeichert (nur diese Zeile neu, Rest der Datei Zeichen für Zeichen gleich), Vorschau zeigt „Klickliste Version 2.0“";
    });

    await pruefen(3, "Jeder Baustein (Werkzeugleiste, dann „Lesen“)", async () => {
      const namen = ["Callout", "Toggle", "Tabelle", "Checkliste", "Spalten", "Bild", "Trennlinie", "Code-Block", "Seitenlink", "Karteikarte", "Kartenstapel", "Quiz", "Diagramm"];
      for (const name of namen) {
        await klickAuf(werkzeug(name));
        if (name === "Seitenlink") {
          erwarte(await waitFor(`document.querySelector('[role="dialog"] input')`), "Seitenwahl fehlt");
          await tippen("Ideen");
          await sleep(300);
          await taste("Enter");
        }
        await sleep(400);
      }
      await sleep(1500);
      const text = await datei(SEITE);
      const markup = ["<l-callout", "<details>", "<table>", 'class="l-checkliste"', "<l-spalten>", "<figure>", "<hr>", "<pre><code", 'class="l-seitenlink" href="Notizen/Ideen.md"', "<l-karteikarte>", "<l-kartenstapel>", "<l-quiz>", "<l-diagramm"];
      const fehlt = markup.filter((m) => !text.includes(m));
      erwarte(fehlt.length === 0, `fehlt in der Datei: ${fehlt.join(", ")}`);
      await ansicht("Lesen");
      erwarte(await waitFor(`${SICHTBAR}?.src.includes(${JSON.stringify(SEITE)}) && document.querySelector('.html-preview').style.height`), "„Lesen“ ohne Seite");
      await sleep(1500);
      const lesen = await inSeite(`({
        callout: document.querySelector("l-callout").getAttribute("aria-label"),
        bild: document.querySelector("figure img").naturalWidth,
        code: document.querySelector("pre").getAttribute("data-sprache"),
        stapel: document.querySelector(".l-stapel-zaehler")?.textContent,
        quiz: document.querySelector(".l-quiz-punkte")?.textContent,
        diagramm: document.querySelectorAll("l-diagramm[data-gezeichnet] svg").length,
        spalten: getComputedStyle(document.querySelector("l-spalten")).display,
      })`);
      erwarte(lesen.bild > 0 && lesen.stapel && lesen.quiz && lesen.diagramm === 1, `Darstellung: ${JSON.stringify(lesen)}`);
      // Echter Klick auf die Karteikarte dreht sie um
      const punkt = await inSeite(`(() => { const k = document.querySelector("main > l-karteikarte"); k.scrollIntoView({ block: "center" }); const r = k.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      const rahmen = await evaluate(`(() => { const r = ${SICHTBAR}.getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
      if (rahmen.y + punkt.y > 780 || rahmen.y + punkt.y < 0) {
        await evaluate(`(() => { const f = ${SICHTBAR}; let b = f.parentElement; while (b && !/(auto|scroll)/.test(getComputedStyle(b).overflowY)) b = b.parentElement; (b ?? document.scrollingElement).scrollTop += f.getBoundingClientRect().top + ${punkt.y} - 400; })()`);
        await sleep(400);
      }
      const neu = await inSeite(`(() => { const r = document.querySelector("main > l-karteikarte").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      const rahmenNeu = await evaluate(`(() => { const r = ${SICHTBAR}.getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
      await klick(rahmenNeu.x + neu.x, rahmenNeu.y + neu.y);
      await sleep(400);
      const umgedreht = await inSeite(`document.querySelector("main > l-karteikarte").hasAttribute("data-umgedreht")`);
      erwarte(umgedreht, "Karteikarte nicht umgedreht");
      return `13 Bausteine eingefügt (${markup.length} Markups in der Datei); in „Lesen“: ${JSON.stringify(lesen)}, Karteikarte per Klick umgedreht`;
    });

    await pruefen(4, "Eigener Baustein", async () => {
      await ansicht("Code");
      await klickAuf(`[...document.querySelectorAll('.cm-content .cm-line')].find((l) => l.textContent.startsWith("<l-callout"))`, 0.02);
      await taste("Home");
      await taste("End", 8);
      await klickAuf(werkzeug("Als Baustein speichern"));
      erwarte(await waitFor(`document.querySelector('[role="dialog"] [aria-label="Name"]')`), "Dialog fehlt");
      await klickAuf(`document.querySelector('[role="dialog"] [aria-label="Name"]')`);
      await tippen("Klickliste-Box");
      await klickAuf(`document.querySelector('[role="dialog"] [aria-label="Beschreibung"]')`);
      await tippen("Aus der Klickliste 2.0");
      await klickAuf(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Speichern")`);
      const pfad = ".localist/bausteine/eigene/Klickliste-Box.html";
      erwarte(await waitFor(`window.__devVault.files.has(${JSON.stringify(pfad)}) && ${werkzeug("Klickliste-Box")}`), "Baustein nicht gespeichert oder nicht in der Werkzeugleiste");
      const gespeichert = await datei(pfad);
      const anzahl = async () => ((await datei(SEITE)).match(/<l-callout typ="info">Text<\/l-callout>/g) ?? []).length;
      const vorher = await anzahl();
      await klickAuf(werkzeug("Klickliste-Box"));
      await sleep(1500);
      const nachher = await anzahl();
      erwarte(nachher === vorher + 1, `eingefügt: ${vorher} → ${nachher}`);
      return `${pfad}: ${JSON.stringify(gespeichert)}; in der Werkzeugleiste, Klick fügt ihn ein (${vorher} → ${nachher})`;
    });

    await pruefen(5, "Notizbuch", async () => {
      await aktionen("Notizen", "In Notizbuch umwandeln");
      erwarte(await waitFor(`document.querySelector('.notizbuch-kopf h1')?.textContent === "Notizen" && document.querySelector('.notizbuch-inhaltsseite iframe.html-frame:not(.is-loading)')`), "Notizbuch nicht geöffnet");
      const yaml = await datei("Notizen/_notizbuch.yaml");
      const inhalt = await evaluate(`[...document.querySelectorAll('.notizbuch-eintrag')].map((b) => b.textContent).join(", ")`);
      await klickAuf(`[...document.querySelectorAll('.notizbuch-blaettern button')].find((b) => b.textContent.startsWith("Weiter"))`);
      erwarte(await waitFor(`document.querySelector('.notizbuch-leiste h2')?.textContent === "Formatierung"`), "„Weiter“ blättert nicht");
      return `_notizbuch.yaml ${JSON.stringify(yaml)}, Inhaltsverzeichnis ${inhalt}, „Weiter“ → Formatierung`;
    });

    await pruefen(6, "Umwandeln", async () => {
      // Ein Klick auf das Notizbuch klappt es im Ordnerbaum auf
      await klickAuf(`document.querySelector('.tree [title="Notizen"]')`);
      await aktionen("Ideen", "In HTML-Seite umwandeln …");
      erwarte(await waitFor(`window.__devVault.files.has("Notizen/Ideen.html") && !window.__devVault.files.has("Notizen/Ideen.md")`), "nicht umgewandelt");
      erwarte(await waitFor(`window.__devVault.files.get("Projekte/Website-Relaunch.md").includes("[[Ideen.html]]")`), "Link nicht angepasst");
      const yaml = await datei("Notizen/_notizbuch.yaml");
      erwarte(yaml.includes("  - Ideen.html"), "Eintrag im Notizbuch nicht angepasst");
      return `Rückfrage „${dialoge.at(-1)}“ mit OK beantwortet; Notizen/Ideen.html angelegt, Ideen.md im Papierkorb, Website-Relaunch verlinkt [[Ideen.html]], Notizbuch-Eintrag Ideen.html`;
    });

    await pruefen(7, "Export", async () => {
      await aktionen("DNS", "Als HTML-Datei exportieren …");
      erwarte(await waitFor(`window.__devVault.exporte.has("C:/Export/DNS.html")`), "nicht exportiert");
      const text = await evaluate(`window.__devVault.exporte.get("C:/Export/DNS.html")`);
      erwarte(text.includes("<style>") && /<script>\n\/\*! Localist-Bausteine/.test(text) && !text.includes(".localist/"), "Export nicht eigenständig");
      return `C:/Export/DNS.html (${text.length} Zeichen): CSS und Skript eingebettet, keine Verweise auf .localist/`;
    });
  }
} finally {
  console.log(`Klickliste „Version ${liste}“ (${etappe}), Vorschau ${base}:`);
  console.log(ergebnisse.join("\n"));
  socket.close();
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch {
    // Edge gibt das Profil unter Last manchmal erst später frei; es liegt nur im Temp-Ordner.
  }
  // Exit-Code 1, wenn ein Punkt nicht bestanden ist
  if (ergebnisse.some((zeile) => zeile.startsWith("[ ]"))) process.exitCode = 1;
}
