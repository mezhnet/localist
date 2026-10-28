// Prüft die Seitenleiste (Etappe 18) in der Browser-Vorschau mit echter Tastatur und Maus in Microsoft Edge:
// Ein- und Ausklappen über den Knopf und Strg+. (auch mit Fokus im Block-Editor und im Code-Editor, ohne dass sich dort
// etwas ändert), Übergang (Dauer und Zwischenschritte, ohne Übergang bei „Bewegung reduzieren“), volle Breite des
// Inhalts, Lage des Knopfs links und rechts, Fensterknöpfe oben rechts, Menüs im Fenster und den gemerkten Zustand.
//
// Aufruf, während die Vorschau läuft: node scripts/seitenleiste-pruefung.mjs http://localhost:1420
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1420"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-seitenleiste-"));
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
await new Promise((done) => (ws.onopen = done));
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
  new Promise((done) => {
    const id = nextId++;
    pending.set(id, done);
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
/** Echter Tastendruck Strg+. (wie auf einer deutschen Tastatur: Taste „Period“, keine AltGr). */
const strgPunkt = async () => {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: ".", code: "Period", windowsVirtualKeyCode: 190, modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: ".", code: "Period", windowsVirtualKeyCode: 190, modifiers: 2 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 });
};
const klick = async (selektor) => {
  const p = await ev(`(() => { const b = document.querySelector(${JSON.stringify(selektor)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: p.x, y: p.y, button: "left", clickCount: 1 });
};
const masse = () =>
  ev(`(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), r: Math.round(b.right), w: Math.round(b.width), y: Math.round(b.y) }; };
    return { breite: innerWidth, seitenleiste: r(".sidebar-shell"), inhalt: r(".main"), knopf: r(".seitenleiste-knopf"), fenster: r(".fenster-knoepfe"),
      sichtbar: getComputedStyle(document.querySelector(".sidebar-shell")).visibility, eingeklappt: document.querySelector(".workspace").classList.contains("is-eingeklappt"),
      gemerkt: localStorage.getItem("seitenleiste-eingeklappt"), label: document.querySelector(".seitenleiste-knopf")?.getAttribute("aria-label") };
  })()`);

/** Lädt die Vorschau mit diesen Werten im App-Speicher und öffnet die Notiz „Ideen“. */
async function oeffnen({ seite = "links", eingeklappt = false, bewegung = "no-preference" } = {}) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: bewegung }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", "light");
    localStorage.setItem("seitenleiste-seite", ${JSON.stringify(seite)}); localStorage.setItem("seitenleiste-eingeklappt", ${JSON.stringify(String(eingeklappt))}); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
  await ev(`document.querySelector('.tree [title="Notizen"]').click(); true`);
  await waitFor(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`);
  await ev(`document.querySelector('.tree [title="Notizen/Ideen.md"]').click(); true`);
  await waitFor(`document.querySelector('.bn-editor')`);
  await sleep(500);
}

/** Breite der Seitenleiste in jedem Bild während des Übergangs (requestAnimationFrame). */
const verlaufMessen = () =>
  ev(`new Promise((fertig) => {
    const werte = []; const start = performance.now();
    const schritt = () => { werte.push([Math.round(performance.now() - start), Math.round(document.querySelector(".sidebar-shell").getBoundingClientRect().width)]);
      if (performance.now() - start < 450) requestAnimationFrame(schritt); else fertig(werte); };
    requestAnimationFrame(schritt);
  })`);
const zusammenfassen = (werte) => {
  const anfang = werte[0][1];
  const ende = werte[werte.length - 1][1];
  const bewegt = werte.filter(([, w]) => w !== anfang && w !== ende);
  const fertig = werte.find(([, w]) => w === ende)?.[0];
  return `${anfang} → ${ende} px, fertig nach ${fertig} ms, ${bewegt.length} Zwischenbilder (${bewegt.map(([t, w]) => `${t} ms: ${w}`).join(", ") || "-"})`;
};

const zeilen = [];
const ja = (x) => (x ? "ja" : "NEIN");
try {
  await send("Page.enable");
  await send("Runtime.enable");

  // 1. Links: Knopf, Übergang, volle Breite
  await oeffnen();
  let m = await masse();
  zeilen.push(`Links (1280 × 800): Seitenleiste ${m.seitenleiste.x}–${m.seitenleiste.r}, Inhalt ${m.inhalt.x}–${m.inhalt.r}, Knopf „${m.label}“ bei x = ${m.knopf.x} (am Inhalt: ${ja(m.knopf.x >= m.inhalt.x && m.knopf.x < m.inhalt.x + 12)}), Fensterknöpfe ${m.fenster.x}–${m.fenster.r} (oben rechts: ${ja(m.fenster.r === m.breite && m.fenster.y === 0)})`);
  const titel = await ev(`document.querySelector(".seitenleiste-knopf").title`);
  zeilen.push(`Tooltip des Knopfs: „${titel}“`);
  const verlauf = verlaufMessen();
  await klick(".seitenleiste-knopf");
  zeilen.push(`Klick auf den Knopf, Übergang: ${zusammenfassen(await verlauf)}`);
  await sleep(200);
  m = await masse();
  zeilen.push(`Eingeklappt: Inhalt ${m.inhalt.x}–${m.inhalt.r} von ${m.breite} px (volle Breite bis auf den Rand: ${ja(m.inhalt.x <= 6 && m.inhalt.r >= m.breite - 6)}), Seitenleiste ${m.seitenleiste.w} px breit und ${m.sichtbar}, gemerkt „${m.gemerkt}“, Knopf jetzt „${m.label}“ bei x = ${m.knopf.x}`);

  // 2. Strg+. im Block-Editor: klappt aus, der Text bleibt gleich
  const vorher = await ev(`window.__devVault.files.get("Notizen/Ideen.md")`);
  await klick(".bn-editor p, .bn-editor .bn-inline-content");
  const fokus = await ev(`document.activeElement?.closest(".bn-editor") ? "Block-Editor" : document.activeElement?.tagName`);
  const verlauf2 = verlaufMessen();
  await strgPunkt();
  zeilen.push(`Strg+. mit Fokus im ${fokus}: ${zusammenfassen(await verlauf2)}`);
  await sleep(900);
  m = await masse();
  const nachher = await ev(`window.__devVault.files.get("Notizen/Ideen.md")`);
  zeilen.push(`Danach: ausgeklappt ${ja(!m.eingeklappt)}, gemerkt „${m.gemerkt}“, Fokus noch im Editor: ${ja(await ev(`Boolean(document.activeElement?.closest(".bn-editor"))`))}, Notiz unverändert: ${ja(nachher === vorher)}`);

  // 3. Strg+. im Code-Editor einer HTML-Seite
  await ev(`document.querySelector('.tree [title="Notizen/DNS.html"]').click(); true`);
  await waitFor(`[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Code")`);
  await ev(`[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Code").click(); true`);
  await waitFor(`document.querySelector(".cm-content")`);
  await sleep(300);
  const dnsVorher = await ev(`window.__devVault.files.get("Notizen/DNS.html")`);
  await klick(".cm-line");
  await strgPunkt();
  await sleep(500);
  m = await masse();
  zeilen.push(`Strg+. im Code-Editor („${await ev(`document.activeElement?.closest(".cm-editor") ? "Fokus im Code-Editor" : "kein Fokus im Editor"`)}“): eingeklappt ${ja(m.eingeklappt)}, HTML-Seite unverändert: ${ja((await ev(`window.__devVault.files.get("Notizen/DNS.html")`)) === dnsVorher)}`);
  await strgPunkt();
  await sleep(400);
  zeilen.push(`Noch einmal Strg+.: ausgeklappt ${ja(!(await masse()).eingeklappt)}`);

  // 4. Bewegung reduzieren: kein Übergang
  await oeffnen({ bewegung: "reduce" });
  const verlauf3 = verlaufMessen();
  await klick(".seitenleiste-knopf");
  zeilen.push(`Mit „Bewegung reduzieren“: ${zusammenfassen(await verlauf3)}`);

  // 5. Rechts: Knopf an der Kante zur Seitenleiste, Fensterknöpfe oben rechts, Menüs im Fenster
  await oeffnen({ seite: "rechts" });
  m = await masse();
  zeilen.push(`Rechts: Inhalt ${m.inhalt.x}–${m.inhalt.r}, Seitenleiste ${m.seitenleiste.x}–${m.seitenleiste.r}, Knopf ${m.knopf.x}–${m.knopf.r} (an der Kante zur Seitenleiste: ${ja(m.knopf.r <= m.seitenleiste.x && m.knopf.r > m.seitenleiste.x - 12)}), Fensterknöpfe ${m.fenster.x}–${m.fenster.r} (oben rechts: ${ja(m.fenster.r === m.breite && m.fenster.y === 0)})`);
  await klick(".sidebar-nav .sidebar-item:last-child");
  await waitFor(`document.querySelector('[role="menu"]')`);
  const menue = await ev(`(() => { const b = document.querySelector('[role="menu"]').getBoundingClientRect(); return { x: Math.round(b.x), r: Math.round(b.right) }; })()`);
  zeilen.push(`Menü „Neu“ aus „Neue Seite“: ${menue.x}–${menue.r} (im Fenster: ${ja(menue.x >= 0 && menue.r <= m.breite)})`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  const verlauf4 = verlaufMessen();
  await klick(".seitenleiste-knopf");
  zeilen.push(`Rechts einklappen: ${zusammenfassen(await verlauf4)}`);
  await sleep(200);
  m = await masse();
  zeilen.push(`Rechts eingeklappt: Inhalt ${m.inhalt.x}–${m.inhalt.r} (volle Breite: ${ja(m.inhalt.x <= 6 && m.inhalt.r >= m.breite - 6)}), Knopf ${m.knopf.x}–${m.knopf.r} neben den Fensterknöpfen (${m.fenster.x}): ${ja(m.knopf.r <= m.fenster.x && m.knopf.r >= m.fenster.x - 8)}`);

  // 6. Gemerkt nach dem Neuladen
  await send("Page.reload");
  await waitFor(`document.querySelector(".workspace")`);
  await sleep(400);
  m = await masse();
  zeilen.push(`Nach dem Neuladen: eingeklappt ${ja(m.eingeklappt)}, Seitenleiste ${m.seitenleiste.w} px, Seite rechts ${ja(await ev(`document.querySelector(".workspace").classList.contains("seitenleiste-rechts")`))}`);

  console.log(`Seitenleiste (Etappe 18), Vorschau ${base} (Edge, echte Tastatur und Maus):`);
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
