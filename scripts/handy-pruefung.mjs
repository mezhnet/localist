// Handy-Prüfung (Etappe 20): Geht in der Browser-Vorschau alle Ansichten bei 360 × 740 durch (Android, Microsoft Edge
// unsichtbar im Hintergrund) und prüft, dass alles bedienbar ist: nichts ragt seitlich aus dem Bildschirm (nur
// Tabellen, Kanban und Code dürfen in sich waagerecht rollen), und jede Tippfläche ist mindestens 44 × 44 px groß.
// Ausgenommen sind nur Textlinks im Fließtext und der Text im Editor selbst (WCAG 2.5.5 „inline“). In HTML-Seiten
// werden auch die Bausteine im abgeschotteten iframe gemessen. Dazu Screenshots jeder Ansicht in Hell, Dunkel und
// Schwarz. Alles geschieht nur im Arbeitsspeicher der Vorschau (dev-backend.ts), echte Dateien ändern sich nicht.
//
// Aufruf, während die Vorschau läuft: node scripts/handy-pruefung.mjs http://localhost:1430 docs/screenshots/etappe-20
// Ohne Screenshots (nur messen): drittes Argument `messen`.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", outDir = "docs/screenshots/etappe-20", art = "alles"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const BREITE = 360;
const HOEHE = 740;
const MIN = 44;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "localist-handy-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--lang=de-DE", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {
    // Edge startet noch
  }
  if (!wsUrl) await sleep(200);
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
/** `sessionId`: Befehl an ein angehängtes Ziel (z. B. das iframe einer HTML-Seite, das in eigenem Prozess läuft). */
const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
const ev = async (expression, sessionId) => {
  const antwort = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (antwort.result?.exceptionDetails) throw new Error(antwort.result.exceptionDetails.exception?.description ?? antwort.result.exceptionDetails.text);
  return antwort.result?.result?.value;
};
const waitFor = async (expression, was = expression, ms = 10000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await ev(`Boolean(${expression})`).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`Nicht erschienen: ${was}`);
};
/** Klick auf das erste Element, das zum Selektor passt (und ggf. den Text enthält). */
const klick = async (selektor, text) => {
  const ok = await ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selektor)})].find((e) => ${text === undefined ? "true" : `(e.getAttribute("aria-label") ?? e.textContent).trim().startsWith(${JSON.stringify(text)})`}); if (!e) return false; e.click(); return true; })()`);
  if (!ok) throw new Error(`Nicht gefunden: ${selektor} ${text ?? ""}`);
  await sleep(350);
};
const nav = (name) => klick(".handy-nav button", name);
const taste = async (key, code, keyCode) => {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
  await sleep(250);
};

/** Misst im Dokument (oder im iframe): seitliches Überstehen und zu kleine Tippflächen. */
const MESSEN = `(() => {
  const B = ${BREITE}, MIN = ${MIN};
  const sichtbar = (e) => {
    if (e.closest('[inert], [hidden], [aria-hidden="true"], .visually-hidden')) return false;
    for (let x = e; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    }
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const name = (e) => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || e.tagName).trim().replace(/\\s+/g, " ").slice(0, 40);
  const ZIELE = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="switch"], [role="radio"], [role="checkbox"], [role="gridcell"], [role="separator"][tabindex], [tabindex="0"]';
  const klein = [];
  let anzahl = 0;
  // Ist ein Dialog offen, zählt nur, was darin (oder in einem Menü darüber) liegt.
  const dialog = [...document.querySelectorAll('[aria-modal="true"]')].pop();
  for (const e of document.querySelectorAll(ZIELE)) {
    if (!sichtbar(e)) continue;
    if (dialog && !dialog.contains(e) && !e.closest('[role="menu"], [role="listbox"]')) continue;
    // Text im Editor und Textlinks im Fließtext sind keine eigenen Tippflächen (WCAG 2.5.5, „inline“).
    if (e.closest('[contenteditable="true"]') && !e.matches('input, button')) continue;
    if (e.tagName === "A" && !e.matches('[role], [class*="button"], .l-seitenlink') && e.closest("p, li, td, figcaption, .bn-inline-content, l-callout, l-antwort")) continue;
    // Optionen eines nativen <select> erscheinen im Auswahlfenster des Systems.
    if (e.tagName === "OPTION") continue;
    // Ein Kästchen in einem <label> lässt sich über das ganze Label antippen.
    const r = (e.matches('input[type="checkbox"], input[type="radio"]') && e.closest("label") ? e.closest("label") : e).getBoundingClientRect();
    anzahl++;
    if (r.width < MIN - 0.5 || r.height < MIN - 0.5) klein.push(name(e) + " (" + Math.round(r.width) + " × " + Math.round(r.height) + ")");
  }
  // Seitlich überstehend: Elemente, die rechts oder links aus dem Bildschirm ragen und nicht in einem waagerecht
  // rollenden Bereich liegen.
  const rollt = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if ((s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden" || s.overflowX === "clip") && x.getBoundingClientRect().right <= B + 0.5) return true; } return false; };
  const raus = [];
  for (const e of document.body.querySelectorAll("*")) {
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || (r.right <= B + 0.5 && r.left >= -0.5)) continue;
    if (!sichtbar(e) || rollt(e)) continue;
    raus.push((e.className?.toString?.().split(" ")[0] || e.tagName) + " (" + Math.round(r.left) + "–" + Math.round(r.right) + ")");
  }
  return { breite: document.documentElement.scrollWidth, klein: [...new Set(klein)], raus: [...new Set(raus)].slice(0, 8), anzahl };
})()`;

const ergebnisse = [];
let fehler = 0;
async function pruefen(name, { iframe = false } = {}) {
  await sleep(300);
  const m = await ev(MESSEN);
  let rahmen = null;
  if (iframe) {
    // Die Seite im abgeschotteten iframe läuft in eigenem Prozess: an ihr Ziel anhängen und dort messen. Die Breite
    // ist die des iframes; Lage und Größen gelten in seinem Ausschnitt.
    const { src, breite } = await ev(`(() => { const f = [...document.querySelectorAll("iframe")].find((f) => f.getBoundingClientRect().width > 0 && getComputedStyle(f).visibility !== "hidden"); return { src: f?.src, breite: Math.round(f?.getBoundingClientRect().width ?? 0) }; })()`);
    const ziele = (await send("Target.getTargets")).result.targetInfos;
    const ziel = ziele.find((z) => z.type === "iframe" && z.url === src) ?? ziele.find((z) => z.type === "iframe" && z.url.includes("localist-seite"));
    if (ziel) {
      const { result } = await send("Target.attachToTarget", { targetId: ziel.targetId, flatten: true });
      rahmen = await ev(MESSEN.replace("const B = 360", `const B = ${breite}`), result.sessionId).catch((e) => ({ fehler: e.message }));
      await send("Target.detachFromTarget", { sessionId: result.sessionId });
    } else rahmen = { fehler: "iframe nicht gefunden" };
  }
  const ok = m.breite <= BREITE && m.klein.length === 0 && m.raus.length === 0 && (!rahmen || (!rahmen.fehler && rahmen.klein.length === 0 && rahmen.raus.length === 0));
  if (!ok) fehler++;
  ergebnisse.push(`[${ok ? "x" : " "}] ${name}: Breite ${m.breite} px, ${m.anzahl} Tippflächen${m.klein.length ? `, zu klein: ${m.klein.join("; ")}` : ""}${m.raus.length ? `, ragt heraus: ${m.raus.join("; ")}` : ""}${rahmen ? ` | HTML-Seite: ${rahmen.fehler ?? `${rahmen.klein.length ? `zu klein: ${rahmen.klein.join("; ")}` : `alle ${rahmen.anzahl} Tippflächen ≥ 44 px`}${rahmen.raus.length ? `, ragt heraus: ${rahmen.raus.join("; ")}` : ""}`}` : ""}`);
}

const MODUS = { hell: "light", dunkel: "dark", schwarz: "black" };
async function oeffnen(modus) {
  await send("Emulation.setDeviceMetricsOverride", { width: BREITE, height: HOEHE, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: modus === "hell" ? "light" : "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", "beispiel-vault (Browser-Vorschau)"); localStorage.setItem("dev-platform", "android"); localStorage.setItem("theme", ${JSON.stringify(MODUS[modus])}); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector(".handy-nav") && document.querySelector(".home-table-zeile")`, "Handy-Startseite");
  await sleep(500);
}
async function shot(name, modus) {
  if (art === "messen") return;
  await ev("document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 300))))");
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, `handy-${name}-${modus}.png`), Buffer.from(result.data, "base64"));
}

/** Seite im Ordnerbaum („Seiten“) öffnen. */
async function seite(pfad) {
  await nav("Seiten");
  const teile = pfad.split("/");
  for (let i = 1; i < teile.length; i++) {
    const ordner = teile.slice(0, i).join("/");
    const offen = await ev(`Boolean(document.querySelector('.tree [title="${pfad}"]'))`);
    if (!offen) await klick(`.tree [title="${ordner}"]`);
  }
  await waitFor(`document.querySelector('.tree [title="${pfad}"]')`, pfad);
  await klick(`.tree [title="${pfad}"]`);
  await waitFor(`!document.querySelector(".sidebar-shell.open")`, "Seiten geschlossen");
  await sleep(600);
}

/** Alle Szenen; `messen` = false nur für die Screenshots der Modi Dunkel und Schwarz. */
async function szenen(modus, messen) {
  const pruefe = async (name, optionen) => {
    if (messen) await pruefen(name, optionen);
    await shot(name, modus);
  };
  const zurueck = () => klick(".topbar-zurueck");
  await oeffnen(modus);
  await pruefe("startseite");
  await klick(".home-handy-vault");
  await pruefe("vault-menue");
  await taste("Escape", "Escape", 27);
  await klick('.home-handy-kopf [aria-label="Darstellung"]');
  await pruefe("darstellung-menue");
  await taste("Escape", "Escape", 27);
  await nav("Neu");
  await pruefe("neu-menue");
  await taste("Escape", "Escape", 27);
  await nav("Seiten");
  await pruefe("seiten");
  await klick(".tree-row .tree-action[aria-label^='Aktionen']");
  await pruefe("seiten-kontextmenue");
  await taste("Escape", "Escape", 27);
  await klick('.sidebar-item[title^="Text in allen Seiten"]');
  await ev(`(() => { const f = document.querySelector('[role="dialog"] input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(f, "Wochenplanung"); f.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await sleep(600);
  await pruefe("volltextsuche");
  await taste("Escape", "Escape", 27);
  await nav("Suchen");
  await pruefe("schnellsuche");
  await taste("Escape", "Escape", 27);
  await nav("Neu");
  await klick('[role="menuitem"]', "Notiz aus Vorlage …");
  await pruefe("vorlage-waehlen");
  await taste("Escape", "Escape", 27);

  // Notiz mit Eigenschaften
  await seite("Projekte/Website-Relaunch.md");
  await waitFor(`document.querySelector(".properties.is-kompakt")`, "Notiz");
  await pruefe("notiz");
  await klick(".properties-chips");
  await pruefe("notiz-eigenschaften");
  await klick(".topbar-mehr");
  await pruefe("notiz-aktionen");
  await taste("Escape", "Escape", 27);
  await ev(`(() => { const p = [...document.querySelectorAll('.bn-editor .bn-inline-content')].pop(); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector('.bn-editor').focus(); return true; })()`);
  await waitFor(`document.querySelector(".tastaturleiste")`, "Leiste über der Tastatur");
  await pruefe("notiz-schreiben");
  await klick(".tastaturleiste-knopf", "Baustein wählen");
  await waitFor(`document.querySelector(".baustein-menu")`, "Baustein wählen");
  await pruefe("notiz-baustein-waehlen");
  await taste("Escape", "Escape", 27);
  await klick(".tastaturleiste-fertig");

  // Datenbank (Kanban und Kalender nur im Arbeitsspeicher der Vorschau dazu, wie in screenshots.mjs)
  await ev(`(() => {
    const v = window.__devVault;
    const tag = (n, zeit) => { const d = new Date(); d.setDate(d.getDate() + n); const s = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); return zeit ? s + "T" + zeit : s; };
    const eintrag = (name, fm) => v.externalWrite("Projekte/" + name + ".md", "---\\nid: " + crypto.randomUUID() + "\\n" + fm + "---\\n");
    eintrag("Messestand planen", "status: Geplant\\nfällig: " + tag(1) + "\\n");
    eintrag("Team-Workshop", "status: In Arbeit\\nfällig: " + tag(2, "10:00") + "\\n");
    eintrag("Budget 2027", "status: Geplant\\nfällig: " + tag(-1) + "\\n");
    return true; })()`);
  await ev(`(() => { const v = window.__devVault; v.externalWrite("Projekte/_ansichten.yaml", v.files.get("Projekte/_ansichten.yaml")
    + "  - name: Kanban\\n    typ: kanban\\n    gruppierung: status\\n    sortierung: []\\n    filter: []\\n"
    + "  - name: Kalender\\n    typ: kalender\\n    datum: fällig\\n    modus: monat\\n    sortierung: []\\n    filter: []\\n"); return true; })()`);
  await sleep(500);
  await zurueck();
  await waitFor(`document.querySelector(".database-table")`, "Tabelle");
  await pruefe("datenbank-tabelle");
  await klick('[role="tab"]', "Kanban");
  await pruefe("datenbank-kanban");
  await klick('[role="tab"]', "Kalender");
  await pruefe("datenbank-kalender");

  // HTML-Seite
  await seite("Notizen/DNS.html");
  await waitFor(`document.querySelector(".html-workspace iframe")`, "HTML-Seite");
  await sleep(800);
  await klick(".html-page-bar [role='group'] button", "Lesen");
  await sleep(800);
  await pruefe("html-lesen", { iframe: true });
  await klick(".html-page-bar [role='group'] button", "Code");
  await waitFor(`document.querySelector(".cm-editor")`, "Code");
  await pruefe("html-code");
  await klick(".html-page-bar [role='group'] button", "Geteilt");
  await sleep(800);
  await pruefe("html-geteilt");

  // Seite mit allen Bausteinen (Karteikarte, Quiz, Diagramm …) in „Lesen“
  await seite("Lernen/Bausteine.html");
  await klick(".html-page-bar [role='group'] button", "Lesen");
  await sleep(1200);
  await pruefe("html-bausteine", { iframe: true });

  // Notizbuch
  await nav("Seiten");
  await klick('.tree [title="Lernen"]');
  await sleep(1000);
  await pruefe("notizbuch", { iframe: true });

  // Seite „Bausteine“: Bibliothek und Hilfe
  await nav("Seiten");
  await klick(".sidebar-item", "Bausteine");
  await waitFor(`document.querySelector(".bibliothek")`, "Bibliothek");
  await sleep(800);
  await pruefe("bausteine-bibliothek");
  await klick('[role="tab"]', "Hilfe");
  await pruefe("bausteine-hilfe");

  // Einstellungen
  await nav("Einstellungen");
  await pruefe("einstellungen");
  await klick(".handy-einstellung");
  await pruefe("einstellungen-darstellung");
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await szenen("hell", true);
  if (art !== "messen") {
    await szenen("dunkel", false);
    await szenen("schwarz", false);
  }
  console.log(`Handy-Prüfung (${BREITE} × ${HOEHE}, Tippflächen ≥ ${MIN} px), Vorschau ${base}:`);
  console.log(ergebnisse.join("\n"));
  console.log(fehler === 0 ? `Ergebnis: alle ${ergebnisse.length} Ansichten bestanden.` : `Ergebnis: ${fehler} von ${ergebnisse.length} Ansichten mit Mängeln.`);
  if (art !== "messen") console.log(`Screenshots: ${outDir}/handy-<Ansicht>-<hell|dunkel|schwarz>.png`);
  process.exitCode = fehler === 0 ? 0 : 1;
} catch (error) {
  console.log(ergebnisse.join("\n"));
  console.log(`FEHLER: ${error.message}`);
  process.exitCode = 2;
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
