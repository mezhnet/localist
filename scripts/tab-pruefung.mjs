// Tab und Shift+Tab in Notizen und im Code-Editor (Etappe 17): steuert Microsoft Edge im Hintergrund mit echter
// Tastatur und Maus (DevTools-Protokoll) und gibt eine Tabelle aus. Je Fall: Einrückung vorher → nachher, Versatz
// des Blocks in px, wo der Fokus danach ist, ob Cursor bzw. Markierung und Scrollposition gleich bleiben und was in
// der Datei gespeichert wird. Die Testnotiz entsteht nur im Arbeitsspeicher der Vorschau (dev-backend.ts).
//
// Aufruf, während die Vorschau läuft: node scripts/tab-pruefung.mjs http://localhost:1420
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1420"] = process.argv.slice(2);
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
const SHIFT = 8;
const KEYS = { Escape: ["Escape", 27], End: ["End", 35], Home: ["Home", 36], Tab: ["Tab", 9], ArrowUp: ["ArrowUp", 38], ArrowDown: ["ArrowDown", 40] };
const taste = async (key, modifiers = 0) => {
  const [name, keyCode] = KEYS[key];
  const info = { key: name, code: name, windowsVirtualKeyCode: keyCode, modifiers };
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...info });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...info });
  await sleep(150);
};
const klick = async (x, y) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });
  await sleep(250);
};
/** Klick auf ein Element (Ausdruck liefert das Element), an Position `wo` (Bruchteil der Breite des Texts). */
const klickAuf = async (elementExpr, wo = 0.5) => {
  const rect = await evaluate(`(() => { const el = ${elementExpr}; if (!el) return null; el.scrollIntoView({ block: "center" });
    const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect().width > 0 ? range.getBoundingClientRect() : el.getBoundingClientRect();
    return { x: r.x + Math.max(1, r.width * ${wo}), y: r.y + r.height / 2 }; })()`);
  if (!rect) throw new Error(`Nicht gefunden: ${elementExpr}`);
  await klick(rect.x, rect.y);
};
const knopf = (text) => `[...document.querySelectorAll('button, [role="menuitem"], [role="tab"]')].find((b) => b.textContent.trim() === ${JSON.stringify(text)} || b.getAttribute("aria-label") === ${JSON.stringify(text)})`;
const datei = (pfad) => evaluate(`window.__devVault.files.get(${JSON.stringify(pfad)}) ?? ""`);

// Hilfsfunktionen in der Seite: Block finden, Einrückungstiefe, Fokus, Markierung und Scrollposition beschreiben.
const HELFER = `window.__tab = {
  block(text) { return [...document.querySelectorAll('.bn-editor .bn-inline-content')].find((e) => e.textContent.startsWith(text)); },
  tiefe(text) { const el = this.block(text); if (!el) return null; let d = 0; let n = el.closest('.bn-block-outer');
    while ((n = n.parentElement?.closest('.bn-block-outer'))) d++; return d; },
  links(text) { const el = this.block(text); return el ? Math.round(el.getBoundingClientRect().left) : null; },
  fokus() { const a = document.activeElement;
    if (!a || a === document.body) return 'nichts (body)';
    if (a.closest('.bn-formatting-toolbar')) return 'Formatierungsleiste (' + (a.getAttribute('aria-label') || a.getAttribute('data-test') || a.textContent.trim() || a.tagName) + ')';
    if (a.closest('.bn-editor')) return 'Editor';
    if (a.closest('.cm-editor')) return 'Code-Editor';
    const name = (a.getAttribute('aria-label') || a.getAttribute('title') || a.textContent || '').trim().slice(0, 30);
    return a.tagName.toLowerCase() + ' „' + name + '“'; },
  markierung() { const s = getSelection(); if (!s || !s.anchorNode) return ''; return (s.anchorNode.textContent || '').slice(0, 16) + '@' + s.anchorOffset + '/' + s.focusOffset; },
  scroll() { return JSON.stringify([window.scrollY, ...[...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => (e.className || e.tagName) + ':' + Math.round(e.scrollTop))]); },
  leiste() { return Boolean(document.querySelector('.bn-formatting-toolbar')); },
  zeile(text) { return [...document.querySelectorAll('.cm-line')].find((z) => z.textContent.includes(text)); },
  einzug(text) { const z = this.zeile(text); return z ? z.textContent.match(/^\\s*/)[0].length : null; },
  cursor() { const s = getSelection(); const line = s?.focusNode && (s.focusNode.nodeType === 1 ? s.focusNode : s.focusNode.parentElement)?.closest('.cm-line');
    if (!line) return 'außerhalb'; const r = document.createRange(); r.setStart(line, 0); r.setEnd(s.focusNode, s.focusOffset);
    const text = line.textContent.trim().slice(0, 14); const markiert = s.toString().length;
    return '„' + text + '“ Spalte ' + r.toString().length + (markiert ? ' (' + markiert + ' Zeichen markiert)' : ''); },
}; true`;

const NOTIZ = "Notizen/Tab-Test.md";
const INHALT = `---
id: 00000000-0000-4000-8000-000000000017
---
Erster Absatz

Zweiter Absatz

## Überschrift

- Punkt A
- Punkt B
- Punkt C

Absatz nach Liste

- [ ] Aufgabe A
- [ ] Aufgabe B

1. Schritt A
2. Schritt B

> [!info] Callout A

> [!note]- Toggle A
> Inhalt im Toggle

Letzter Absatz
`;
const sichtbar = (s) => s.replace(/^( +)/, (m) => "·".repeat(m.length));
/** Gespeicherte Zeilen, die zum Fall gehören (führende Leerzeichen als „·“). */
const gespeichert = async (texte) => {
  const zeilen = (await datei(NOTIZ)).split("\n");
  return texte.map((t) => {
    const z = zeilen.find((zeile) => zeile.includes(t));
    return z === undefined ? `„${t}“ fehlt` : `\`${sichtbar(z)}\``;
  }).join(" ");
};

const zeilen = [];
const zeile = (...spalten) => zeilen.push(`| ${spalten.join(" | ")} |`);

async function zuruecksetzen() {
  await sleep(1500); // Speichern abwarten
  await evaluate(`window.__devVault.externalWrite(${JSON.stringify(NOTIZ)}, ${JSON.stringify(INHALT)}); true`);
  await sleep(600);
  await waitFor(`window.__tab.block("Letzter Absatz") && window.__tab.tiefe("Punkt B") === 0 && window.__tab.tiefe("Zweiter Absatz") === 0`);
  await klickAuf(`window.__tab.block("Letzter Absatz")`, 0.99);
}

/** Ein Fall in der Notiz: Tab, danach Shift+Tab, jeweils gemessen. */
async function notizFall(name, texte, markieren) {
  await zuruecksetzen();
  const vorbereiten = async () => {
    await klickAuf(`window.__tab.block(${JSON.stringify(texte.at(-1))})`, 0.99);
    await taste("End");
    if (markieren === "zeile") await taste("Home", SHIFT);
    if (markieren === "bloecke") for (let i = 1; i < texte.length; i++) await taste("ArrowUp", SHIFT);
    await sleep(300);
  };
  await vorbereiten();
  const messen = async () => ({
    tiefe: (await Promise.all(texte.map((t) => evaluate(`window.__tab.tiefe(${JSON.stringify(t)})`)))).join("+"),
    links: await evaluate(`window.__tab.links(${JSON.stringify(texte[0])})`),
    markierung: await evaluate(`window.__tab.markierung()`),
    scroll: await evaluate(`window.__tab.scroll()`),
    leiste: await evaluate(`window.__tab.leiste()`),
  });
  for (const [label, mod] of [["Tab", 0], ["Shift+Tab", SHIFT]]) {
    const vorher = await messen();
    await taste("Tab", mod);
    await sleep(300);
    const nachher = await messen();
    const fokus = await evaluate(`window.__tab.fokus()`);
    await sleep(1500);
    const datei = await gespeichert(texte);
    zeile(
      name,
      label + (vorher.leiste ? " (Formatierungsleiste offen)" : ""),
      `${vorher.tiefe} → ${nachher.tiefe}`,
      `${nachher.links - vorher.links} px`,
      fokus,
      vorher.markierung === nachher.markierung ? "gleich" : `${vorher.markierung} → ${nachher.markierung}`,
      vorher.scroll === nachher.scroll ? "gleich" : `${vorher.scroll} → ${nachher.scroll}`,
      datei,
    );
    // Hat der Fokus den Editor verlassen, für Shift+Tab wieder an dieselbe Stelle setzen.
    if (label === "Tab" && fokus !== "Editor") {
      await vorbereiten();
      zeilen[zeilen.length - 1] += " (für Shift+Tab neu in den Block geklickt)";
    }
  }
}

/** Ein Fall im Code-Editor. */
async function codeFall(name, text, vorbereiten, tasten) {
  await vorbereiten();
  const vorher = { einzug: await evaluate(`window.__tab.einzug(${JSON.stringify(text)})`), cursor: await evaluate(`window.__tab.cursor()`) };
  for (const [taste_, mod] of tasten) await taste(taste_, mod);
  await sleep(300);
  const nachher = { einzug: await evaluate(`window.__tab.einzug(${JSON.stringify(text)})`), cursor: await evaluate(`window.__tab.cursor()`) };
  zeile(
    "Code-Editor: " + name,
    tasten.map(([t, m]) => (m ? "Shift+" : "") + t).join(", "),
    `${vorher.einzug} → ${nachher.einzug} Leerzeichen`,
    "–",
    await evaluate(`window.__tab.fokus()`),
    `${vorher.cursor} → ${nachher.cursor}`,
    "–",
    "–",
  );
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await evaluate(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("theme", "light"); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`);
  await evaluate(HELFER);
  await evaluate(`window.__devVault.externalWrite(${JSON.stringify(NOTIZ)}, ${JSON.stringify(INHALT)}); true`);
  await sleep(500);
  await klickAuf(`document.querySelector('.tree [title="Notizen"]')`);
  await waitFor(`document.querySelector('.tree [title="${NOTIZ}"]')`);
  await klickAuf(`document.querySelector('.tree [title="${NOTIZ}"]')`);
  await waitFor(`window.__tab.block("Letzter Absatz")`);

  zeile("Fall", "Taste", "Einrückung (Tiefe)", "Versatz", "Fokus danach", "Cursor/Markierung", "Scroll", "gespeichert");
  zeile("---", "---", "---", "---", "---", "---", "---", "---");
  await notizFall("Erster Block (Absatz)", ["Erster Absatz"], false);
  await notizFall("Absatz", ["Zweiter Absatz"], false);
  await notizFall("Absatz, Text markiert", ["Zweiter Absatz"], "zeile");
  await notizFall("Überschrift", ["Überschrift"], false);
  await notizFall("Liste", ["Punkt B"], false);
  await notizFall("Liste, Text markiert", ["Punkt B"], "zeile");
  await notizFall("Liste, zwei Punkte markiert", ["Punkt B", "Punkt C"], "bloecke");
  await notizFall("Absatz direkt nach Liste", ["Absatz nach Liste"], false);
  await notizFall("Checkliste", ["Aufgabe B"], false);
  await notizFall("Checkliste, Text markiert", ["Aufgabe B"], "zeile");
  await notizFall("Nummerierte Liste", ["Schritt B"], false);
  await notizFall("Callout", ["Callout A"], false);
  await notizFall("Toggle", ["Toggle A"], false);
  await notizFall("Absatz nach Toggle", ["Letzter Absatz"], false);

  // Code-Editor: DNS.html in der Ansicht „Code“
  await klickAuf(`document.querySelector('.tree [title="Notizen/DNS.html"]')`);
  await waitFor(knopf("Code"));
  await klickAuf(knopf("Code"));
  await waitFor(`window.__tab.zeile("l-callout")`);
  const inZeile = (text, wo) => async () => {
    await klickAuf(`window.__tab.zeile(${JSON.stringify(text)})`, wo);
  };
  await codeFall("Cursor mitten in der Zeile", "<l-callout", inZeile("<l-callout", 0.5), [["Tab", 0]]);
  await codeFall("Cursor mitten in der Zeile", "<l-callout", inZeile("<l-callout", 0.5), [["Tab", SHIFT]]);
  await codeFall("Cursor mitten in eingerückter Zeile", "<l-frage>", inZeile("<l-frage>", 0.5), [["Tab", SHIFT]]);
  await codeFall("drei Zeilen markiert (Einzug der ersten)", "<l-karteikarte>", async () => {
    await klickAuf(`window.__tab.zeile("<l-karteikarte>")`, 0.3);
    await taste("ArrowDown", SHIFT);
    await taste("ArrowDown", SHIFT);
  }, [["Tab", 0]]);
  await codeFall("drei Zeilen markiert, zurück", "<l-karteikarte>", async () => {}, [["Tab", SHIFT]]);
  await codeFall("Escape, dann Tab", "<l-callout", inZeile("<l-callout", 0.5), [["Escape", 0], ["Tab", 0]]);
  await sleep(1500);

  console.log(`Tab und Shift+Tab, Vorschau ${base} (Edge, echte Tastatur, 1280 × 800):\n`);
  console.log(zeilen.join("\n"));
} finally {
  socket.close();
  spawnSync("taskkill", ["/PID", String(edge.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Edge gibt das Profil manchmal verzögert frei
  }
}
