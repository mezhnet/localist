// Seite „Bausteine“ (Etappe 17): öffnet Bibliothek und Hilfe in Microsoft Edge (unsichtbar im Hintergrund) bei
// 1280 × 800, 1920 × 1080 und 360 × 740, hell und dunkel, speichert Screenshots und misst, ob die Seite die Breite
// und (in der Bibliothek) die Fensterhöhe nutzt, ob die Hilfe Erklärung und Code nebeneinander zeigt und ob etwas
// über den Rand ragt. Auf dem Handy wird zusätzlich ein Eintrag angetippt (Vorschau muss ins Bild kommen).
//
// Aufruf, während die Vorschau läuft: node scripts/bausteine-seite-pruefung.mjs http://localhost:1420 docs/screenshots/etappe-17
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1420", outDir = "docs/screenshots/etappe-17"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-bausteine-"));
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
  await sleep(700);
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  const datei = join(outDir, `${name}.png`);
  writeFileSync(datei, Buffer.from(result.data, "base64"));
  return datei;
};
/** Antippen bzw. Klicken mit echtem Zeiger an der Mitte eines Elements. */
const tippen = async (expr, touch) => {
  const r = await ev(`(() => { const el = ${expr}; el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await sleep(300);
  if (touch) {
    await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r.x, y: r.y }] });
    await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
  }
  await sleep(400);
};
const knopf = (text) => `[...document.querySelectorAll('button, [role="tab"]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
/** Ragt etwas über den rechten Rand? Liefert die Anzahl solcher Elemente auf der Seite. */
// Inhalt in einem eigenen, quer scrollbaren Kasten (z. B. langer Code in <pre>) zählt nicht, nur der Kasten selbst.
const UEBERSTAND = `(() => { const raus = [...document.querySelectorAll('.bibliothek-seite *')].filter((e) => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.right > innerWidth + 1)) return false; for (let p = e.parentElement; p && !p.classList.contains('bibliothek-seite'); p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return false; return true; }); return raus.length ? raus.length + ' (' + raus.slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + e.className).join(', ') + ')' : 0; })()`;

/** Liegt „Kopieren“ über Code-Text, und scrollt ein Code-Kasten quer? (Anzahl der Beispiele) */
const KOPIEREN = `(() => { let ueber = 0; let quer = 0; for (const box of document.querySelectorAll('.hilfe-code')) { const k = box.querySelector('.ui-button').getBoundingClientRect(); const pre = box.querySelector('pre'); if (pre.scrollWidth > pre.clientWidth + 1) quer++; const r = document.createRange(); r.selectNodeContents(pre.querySelector('code')); if ([...r.getClientRects()].some((z) => z.width > 0 && z.right > k.left && z.left < k.right && z.bottom > k.top && z.top < k.bottom)) ueber++; } return { ueber, quer }; })()`;

const GROESSEN = [
  { name: "pc", breite: 1280, hoehe: 800, faktor: 1, mobil: false },
  { name: "breit", breite: 1920, hoehe: 1080, faktor: 1, mobil: false },
  { name: "handy", breite: 360, hoehe: 740, faktor: 2, mobil: true },
];

const zeilen = [];
try {
  await send("Page.enable");
  await send("Runtime.enable");
  for (const g of GROESSEN) {
    for (const thema of ["light", "dark"]) {
      await send("Emulation.setDeviceMetricsOverride", { width: g.breite, height: g.hoehe, deviceScaleFactor: g.faktor, mobile: g.mobil });
      await send("Emulation.setTouchEmulationEnabled", { enabled: g.mobil, maxTouchPoints: g.mobil ? 1 : 0 });
      await send("Page.navigate", { url: base });
      await waitFor("document.body");
      await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", ${JSON.stringify(thema)}); true`);
      await send("Page.navigate", { url: base });
      await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
      await ev(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.includes("Bausteine")).click(); true`);
      await waitFor(`document.querySelector('.bibliothek-vorschau iframe.html-frame')`);
      await sleep(1500);
      const praefix = `${g.name}-`;
      const hell = thema === "light" ? "hell" : "dunkel";

      const bib = await ev(`(() => { const main = document.querySelector('.main'); const v = document.querySelector('.bibliothek-vorschau').getBoundingClientRect(); const l = document.querySelector('.bibliothek-liste').getBoundingClientRect(); const s = document.querySelector('.bibliothek-seite').getBoundingClientRect(); const m = main.getBoundingClientRect();
        return { fenster: innerWidth + " × " + innerHeight, haupt: Math.round(m.width), seite: Math.round(s.width), liste: Math.round(l.width), vorschau: Math.round(v.width) + " × " + Math.round(v.height), rechterRand: Math.round(m.right - v.right), untererRand: Math.round(innerHeight - v.bottom), scrollt: main.scrollHeight > main.clientHeight + 1, querscroll: document.documentElement.scrollWidth > innerWidth + 1 || main.scrollWidth > main.clientWidth + 1 }; })()`);
      const ueberBib = await ev(UEBERSTAND);
      zeilen.push(
        `${g.breite} × ${g.hoehe} ${hell}, Bibliothek: Arbeitsbereich ${bib.haupt} px, Seite ${bib.seite} px, Liste ${bib.liste} px, Vorschau ${bib.vorschau} px, Abstand rechts ${bib.rechterRand} px, unten ${bib.untererRand} px, Arbeitsbereich scrollt: ${bib.scrollt ? "ja" : "nein"}, quer scrollbar: ${bib.querscroll ? "JA" : "nein"}, über den Rand: ${ueberBib}: ${await shot(`${praefix}bibliothek-${hell}`)}`,
      );

      if (g.mobil && thema === "light") {
        // Eintrag antippen: Die Vorschau muss ins Bild kommen und den Baustein oben zeigen.
        await tippen(`[...document.querySelectorAll('.bibliothek-eintrag')].find((b) => b.textContent.includes("Quiz"))`, true);
        await sleep(1200);
        const nachTipp = await ev(`(() => { const v = document.querySelector('.bibliothek-vorschau').getBoundingClientRect(); return { oben: Math.round(v.top), unten: Math.round(v.bottom), aktiv: document.querySelector('.bibliothek-eintrag.active')?.textContent.slice(0, 4) }; })()`);
        zeilen.push(`  Handy: „Quiz“ angetippt (aktiv: „${nachTipp.aktiv}“), Vorschau jetzt bei y = ${nachTipp.oben} bis ${nachTipp.unten} (im Bild: ${nachTipp.oben >= 0 && nachTipp.oben < g.hoehe / 2 ? "ja" : "NEIN"}): ${await shot(`${praefix}bibliothek-vorschau-${hell}`)}`);
      }

      await tippen(knopf("Hilfe"), g.mobil);
      await waitFor(`document.querySelector('.hilfe-eintrag')`);
      const hilfe = await ev(`(() => { const e = document.querySelector('.hilfe-eintrag'); const t = e.querySelector('.hilfe-text').getBoundingClientRect(); const c = e.querySelector('.hilfe-code').getBoundingClientRect(); const s = document.querySelector('.bibliothek-seite').getBoundingClientRect();
        return { seite: Math.round(s.width), nebeneinander: c.left >= t.right - 1, text: Math.round(t.width), code: Math.round(c.width), preRaus: [...document.querySelectorAll('.hilfe-code pre')].filter((p) => p.getBoundingClientRect().right > innerWidth + 1).length }; })()`);
      const ueberHilfe = await ev(UEBERSTAND);
      const kopierenPruefung = await ev(KOPIEREN);
      zeilen.push(
        `${g.breite} × ${g.hoehe} ${hell}, Hilfe: Seite ${hilfe.seite} px, Erklärung und Code ${hilfe.nebeneinander ? `nebeneinander (${hilfe.text} px | ${hilfe.code} px)` : `untereinander (${hilfe.code} px breit)`}, Code-Kästen über den Rand: ${hilfe.preRaus}, „Kopieren“ über Code-Text: ${kopierenPruefung.ueber}, Code-Kästen mit Querscrollen: ${kopierenPruefung.quer}, Elemente über den Rand: ${ueberHilfe}: ${await shot(`${praefix}hilfe-${hell}`)}`,
      );
    }
  }
  console.log(`Seite „Bausteine“, Vorschau ${base} (Edge):`);
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
