// Prüft Ziehen und Ablegen in der gebauten localist.exe mit echter Maus (Etappe 22): Seitenleiste (Seite in einen
// Ordner, Ordner in einen Ordner, Seite in die Vault-Wurzel), Kanban-Karte in eine andere Spalte, Ziehgriff im
// Block-Editor, Reihenfolge im Notizbuch und ein Bild, das wie aus dem Explorer in eine Notiz gezogen wird.
// Die Eingaben macht scripts/fenster-helfer.ps1 (SetCursorPos, mouse_event, OLE-Ziehen); Positionen und Ereignisse
// kommen über die WebView2-Entwicklerschnittstelle, geprüft wird an den Dateien der Vault-Kopie.
// Maus und Tasten wirken nur, solange das Localist-Fenster vorn liegt (sonst bricht der Helfer ab).
//
// Aufruf: node scripts/ziehen-pruefung.mjs <localist.exe> <Ausgabe-Ordner> [vorher|nachher]
// „nachher“ prüft zusätzlich die Regeln von Etappe 22 (Hervorhebung, Aufklappen, Escape, Namenskonflikt, Rückgängig)
// und legt Screenshots beim Ziehen in Hell und Schwarz ab.
import { spawn } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

const [exe, outDir, modus = "vorher"] = process.argv.slice(2);
if (!exe || !outDir) {
  console.error("Aufruf: node scripts/ziehen-pruefung.mjs <localist.exe> <Ausgabe-Ordner> [vorher|nachher]");
  process.exit(2);
}
const nachher = modus === "nachher";
const PORT = 9339;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
mkdirSync(outDir, { recursive: true });

// Eigene Vault-Kopie mit drei Zusätzen: ein leerer Ordner „Archiv“, ein Ordner „Entwürfe“ mit einer Seite und eine
// Seite in der Wurzel. Der echte Vault des Nutzers wird nie geöffnet (--vault merkt sich nichts).
const vault = mkdtempSync(join(tmpdir(), "localist-ziehen-vault-"));
cpSync(resolve("beispiel-vault"), vault, { recursive: true });
mkdirSync(join(vault, "Archiv"));
mkdirSync(join(vault, "Entwürfe"));
writeFileSync(join(vault, "Entwürfe", "Skizze.md"), "---\nid: 3f0c1a52-8d7e-4b6a-9c1d-2e3f4a5b6c7d\n---\n# Skizze\n\nErster Entwurf.\n");
writeFileSync(join(vault, "Wurzel-Notiz.md"), "---\nid: 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d\n---\nLiegt in der Wurzel.\n");
// Bild außerhalb des Vaults, wie es im Explorer liegen könnte
const bildOrdner = mkdtempSync(join(tmpdir(), "localist-ziehen-bild-"));
const bild = join(bildOrdner, "foto.png");
copyFileSync(join(vault, "Anhänge", "skizze.png"), bild);
const liegt = (pfad) => existsSync(join(vault, ...pfad.split("/")));
const lies = (pfad) => readFileSync(join(vault, ...pfad.split("/")), "utf8");

const webviewData = mkdtempSync(join(tmpdir(), "localist-ziehen-webview-"));
const app = spawn(exe, ["--vault", vault], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`, WEBVIEW2_USER_DATA_FOLDER: webviewData },
  stdio: "ignore",
});
let exitCode = null;
app.on("exit", (code) => (exitCode = code));

const helfer = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/fenster-helfer.ps1"], { stdio: ["pipe", "pipe", "inherit"] });
const antworten = [];
let warten = null;
createInterface({ input: helfer.stdout }).on("line", (zeile) => {
  if (!zeile.trim().startsWith("{")) return;
  antworten.push(JSON.parse(zeile));
  warten?.();
});
// Bricht der Helfer ab (z. B. Fehler beim Übersetzen), wartet das Skript nicht ewig.
helfer.on("exit", () => {
  antworten.push({ ok: false, fehler: "Der Helfer scripts/fenster-helfer.ps1 hat sich beendet." });
  warten?.();
});
const naechste = async () => {
  while (antworten.length === 0) await new Promise((done) => (warten = done));
  return antworten.shift();
};
const ps = async (befehl) => {
  helfer.stdin.write(`${befehl}\n`);
  const antwort = await naechste();
  if (!antwort.ok) throw new Error(`${befehl}: ${antwort.fehler}`);
  return antwort;
};

let target;
for (let i = 0; i < 150 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page" && t.url.includes("tauri.localhost"));
  } catch {
    // App startet noch.
  }
  await sleep(200);
}
if (!target) {
  console.error("Die App hat keine Entwicklerschnittstelle geöffnet.");
  app.kill();
  helfer.kill();
  process.exit(2);
}
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done) => (socket.onopen = done));
let nextId = 1;
const pending = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
socket.onclose = () => pending.forEach((done) => done({}));
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = nextId++;
    pending.set(id, done);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, what, ms = 12000) => {
  for (let t = 0; t < ms; t += 150) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};
const bis = async (bedingung, ms = 3000) => {
  for (let t = 0; t < ms; t += 100) {
    if (await bedingung()) return true;
    await sleep(100);
  }
  return false;
};

const report = [];
const tabelle = [];
let hwnd;
try {
  const bereit = await naechste();
  if (!bereit.bereit) throw new Error("Der Helfer scripts/fenster-helfer.ps1 ist nicht gestartet.");
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`, "Ordnerbaum");
  for (let i = 0; i < 50 && !hwnd; i++) {
    hwnd = (await ps(`finde ${app.pid}`)).hwnd || null;
    if (!hwnd) await sleep(200);
  }
  if (!hwnd) throw new Error("Kein sichtbares Fenster „Localist“ gefunden.");
  await ps(`oben ${hwnd} 1`);
  await ps(`vorholen ${hwnd}`);
  const info = () => ps(`info ${hwnd}`);
  const dpr = await evaluate("window.devicePixelRatio");
  const start = await info();
  report.push(`Fenster ${start.sichtbar.links},${start.sichtbar.oben} ${start.sichtbar.breite} × ${start.sichtbar.hoehe}, vorn: ${start.vorn}, DPI ${start.dpi}, Arbeitsfläche ${start.arbeitsflaeche.breite} × ${start.arbeitsflaeche.hoehe}`);

  // Ereignisse in der Seite mitschreiben: Kommen dragover/drop überhaupt an?
  await evaluate(`(() => {
    window.__ereignisse = {};
    for (const typ of ["dragstart", "dragenter", "dragover", "drop", "dragend", "pointerdown", "pointermove", "pointerup", "pointercancel"])
      window.addEventListener(typ, (e) => { window.__ereignisse[typ] = (window.__ereignisse[typ] ?? 0) + 1; if (typ === "drop") window.__dateien = e.dataTransfer?.files?.length ?? 0; }, true);
    return true;
  })()`);
  const ereignisse = async () => {
    const e = (await evaluate("window.__ereignisse")) ?? {};
    await evaluate("window.__ereignisse = {}; true");
    return e;
  };
  const kurz = (e) => ["dragstart", "dragover", "drop", "pointermove", "pointercancel"].map((t) => `${t} ${e[t] ?? 0}`).join(", ");

  /** Bildschirmpunkt eines Elements (Ausdruck), an Position (fx, fy) seiner Fläche; scrollt es vorher in Sicht. */
  const punkt = async (expr, fx = 0.5, fy = 0.5) => {
    const i = await info();
    const b = await evaluate(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: "nearest" }); const b = el.getBoundingClientRect(); return { x: b.x + b.width * ${fx}, y: b.y + b.height * ${fy} }; })()`);
    if (!b) throw new Error(`Nicht gefunden: ${expr}`);
    return { x: Math.round(i.innen.x + b.x * dpr), y: Math.round(i.innen.y + b.y * dpr) };
  };
  /** Mit echter Maus ziehen: drücken, kurz anheben, zum Ziel gleiten, verweilen, loslassen. */
  const ziehe = async (von, nach, { halten = 400, vorDemLoslassen } = {}) => {
    await ps(`runter ${hwnd} ${von.x} ${von.y}`);
    await sleep(150);
    await ps(`gleiten ${hwnd} ${von.x + 6} ${von.y + 8} 4 30`);
    await ps(`gleiten ${hwnd} ${nach.x} ${nach.y} 20 30`);
    await sleep(halten);
    if (vorDemLoslassen) await vorDemLoslassen();
    await ps(`hoch ${hwnd}`);
    await sleep(900);
  };
  const row = (pfad) => `document.querySelector('.tree [title=${JSON.stringify(pfad)}]')?.closest('.tree-row')`;
  const aufklappen = async (pfad) => {
    await evaluate(`(() => { const r = ${row(pfad)}; const t = r?.querySelector('.tree-toggle'); if (r && r.closest('li').getAttribute('aria-expanded') !== 'true') t.click(); return true; })()`);
    await sleep(300);
  };
  const oeffne = async (pfad) => {
    await evaluate(`${row(pfad)}.querySelector('.tree-label').click()`);
    await sleep(800);
  };
  const eintrag = (ort, pc, ursache) => tabelle.push({ ort, pc, ursache });

  // D. Kanban-Karte in eine andere Spalte
  await oeffne("Projekte");
  await evaluate(`document.querySelector('[aria-label="Ansicht hinzufügen"]').click()`);
  await sleep(300);
  await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.trim() === "Kanban").click()`);
  await waitFor(`document.querySelector('.kanban-card')`, "Kanban-Karten");
  const spalte = (n) => `[...document.querySelectorAll('.kanban-column')].find((c) => c.querySelector('.kanban-column-header').textContent.startsWith(${JSON.stringify(n)}))`;
  await ereignisse();
  await ziehe(await punkt(`${spalte("Geplant")}.querySelector('.kanban-card')`), await punkt(spalte("Erledigt"), 0.5, 0.4));
  const kanban = /status: Erledigt/.test(lies("Projekte/Umzug.md"));
  const eK = await ereignisse();
  report.push(`Kanban „Umzug“ Geplant → Erledigt: ${kanban ? "verschoben" : "NICHT verschoben"} (${kurz(eK)})`);
  eintrag("Kanban-Karte in eine andere Spalte", kanban, eK);

  // E. Ziehgriff im Block-Editor: ersten Absatz von „Ideen“ unter den letzten Listenpunkt ziehen
  await aufklappen("Notizen");
  await oeffne("Notizen/Ideen.md");
  const absatz = `[...document.querySelectorAll('.bn-editor .bn-block-outer')].find((b) => b.textContent.startsWith("Hier sammle"))`;
  await waitFor(absatz, "Absatz in Ideen");
  const ueber = await punkt(absatz, 0.3, 0.5);
  await ps(`gleiten ${hwnd} ${ueber.x} ${ueber.y} 10 30`);
  await waitFor(`document.querySelector('.bn-side-menu [draggable="true"]')`, "Ziehgriff");
  const griff = await punkt(`document.querySelector('.bn-side-menu [draggable="true"]')`);
  const letzter = `[...document.querySelectorAll('.bn-editor .bn-block-outer')].find((b) => b.textContent.startsWith("Lesezeichen"))`;
  await ereignisse();
  await ziehe(griff, await punkt(letzter, 0.3, 0.85));
  await sleep(1500);
  const ideen = lies("Notizen/Ideen.md");
  const griffOk = ideen.indexOf("Hier sammle") > ideen.indexOf("Lesezeichen");
  const eG = await ereignisse();
  report.push(`Ziehgriff „Hier sammle …“ unter „Lesezeichen …“: ${griffOk ? "verschoben" : "NICHT verschoben"} (${kurz(eG)})`);
  eintrag("Ziehgriff im Block-Editor", griffOk, eG);

  // F. Reihenfolge im Notizbuch-Inhaltsverzeichnis
  await oeffne("Lernen");
  await waitFor(`document.querySelectorAll('.notizbuch-inhalt li').length >= 2`, "Inhaltsverzeichnis");
  await ereignisse();
  await ziehe(await punkt(`document.querySelectorAll('.notizbuch-inhalt li')[0]`), await punkt(`document.querySelectorAll('.notizbuch-inhalt li')[1]`, 0.5, 0.8));
  const yaml = lies("Lernen/_notizbuch.yaml");
  const buchOk = yaml.indexOf("Bausteine.html") < yaml.indexOf("Subnetting.md");
  const eN = await ereignisse();
  report.push(`Notizbuch „Subnetting“ hinter „Bausteine“: ${buchOk ? "umsortiert" : "NICHT umsortiert"} (${kurz(eN)})`);
  eintrag("Reihenfolge im Notizbuch", buchOk, eN);

  // A. Seite in einen Ordner
  await ereignisse();
  await ziehe(await punkt(row("Notizen/Ideen.md")), await punkt(row("Archiv")));
  const seiteOk = liegt("Archiv/Ideen.md") && !liegt("Notizen/Ideen.md");
  const eA = await ereignisse();
  report.push(`Seitenleiste „Ideen“ → „Archiv“: ${seiteOk ? "verschoben" : "NICHT verschoben"} (${kurz(eA)})`);
  eintrag("Seite in einen Ordner", seiteOk, eA);

  // B. Ordner in einen Ordner
  await ereignisse();
  await ziehe(await punkt(row("Entwürfe")), await punkt(row("Archiv")));
  const ordnerOk = liegt("Archiv/Entwürfe/Skizze.md") && !liegt("Entwürfe");
  const eB = await ereignisse();
  report.push(`Seitenleiste Ordner „Entwürfe“ → „Archiv“: ${ordnerOk ? "verschoben" : "NICHT verschoben"} (${kurz(eB)})`);
  eintrag("Ordner in einen Ordner", ordnerOk, eB);

  // C. Seite in die Vault-Wurzel (Ablegen auf einer Seite der Wurzel legt in deren Ordner)
  await aufklappen("Notizen");
  await ereignisse();
  const wurzelZiel = nachher ? `document.querySelector('.tree-wurzel')` : row("Wurzel-Notiz.md");
  await ziehe(await punkt(row("Notizen/Formatierung.md")), await punkt(wurzelZiel));
  const wurzelOk = liegt("Formatierung.md") && !liegt("Notizen/Formatierung.md");
  const eC = await ereignisse();
  report.push(`Seitenleiste „Formatierung“ → Vault-Wurzel: ${wurzelOk ? "verschoben" : "NICHT verschoben"} (${kurz(eC)})`);
  eintrag("Seite in die Vault-Wurzel", wurzelOk, eC);

  // G. Bild wie aus dem Explorer in eine Notiz ziehen (zuletzt: öffnet die WebView das Bild, ist die App weg)
  await oeffne("Wurzel-Notiz.md");
  await waitFor(`document.querySelector('.bn-editor')`, "Editor");
  const i = await info();
  const ziel = await punkt(`document.querySelector('.bn-editor')`, 0.5, 0.3);
  // Startpunkt außerhalb des Fensters (links daneben, sonst darunter)
  const x0 = i.sichtbar.links > 80 ? i.sichtbar.links - 50 : i.sichtbar.rechts + 50;
  const y0 = i.sichtbar.links > 80 || i.sichtbar.rechts + 80 < i.arbeitsflaeche.rechts ? ziel.y : i.sichtbar.unten + 50;
  const urlVorher = await evaluate("location.href");
  const anhaengeVorher = JSON.stringify(readdir(join(vault, "Anhänge")));
  await ereignisse();
  const datei = await ps(`datei ${hwnd} ${x0} ${y0} ${ziel.x} ${ziel.y} ${bild}`);
  await sleep(1500);
  const urlNachher = await evaluate("location.href").catch(() => "(keine Antwort)");
  const eD = await ereignisse().catch(() => ({}));
  const dateien = await evaluate("window.__dateien ?? 0").catch(() => 0);
  const notiz = lies("Wurzel-Notiz.md");
  const bildDa = /foto/.test(notiz) || JSON.stringify(readdir(join(vault, "Anhänge"))) !== anhaengeVorher;
  report.push(
    `Bild aus dem „Explorer“ (OLE-Ziehen, Ergebnis ${datei.effekt}) auf die Notiz: drop in der Seite ${eD.drop ?? 0} (Dateien ${dateien}), Seite ${urlNachher === urlVorher ? "unverändert" : `NAVIGIERT nach ${urlNachher}`}, Bild in der Notiz: ${bildDa ? "ja" : "nein"}`,
  );
  eintrag("Bild aus dem Explorer in eine Notiz", bildDa, eD);
  if (urlNachher !== urlVorher) report.push("FEHLER: Die Seite ist nach dem Ablegen der Datei weg (navigiert).");
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
} finally {
  if (hwnd) await ps(`oben ${hwnd} 0`).catch(() => {});
  helfer.stdin.write("ende\n");
  socket.close();
  if (exitCode === null) app.kill();
  await sleep(800);
  for (const ordner of [webviewData, bildOrdner, vault]) rmSync(ordner, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

function readdir(ordner) {
  try {
    return readdirSync(ordner).sort();
  } catch {
    return [];
  }
}

console.log(`Ziehen in der gebauten localist.exe (${modus}), echte Maus:`);
for (const zeile of report) console.log(`- ${zeile}`);
console.log("\n| Ort | PC (EXE) | Ereignisse in der Seite |\n|---|---|---|");
for (const z of tabelle) console.log(`| ${z.ort} | ${z.pc ? "geht" : "geht nicht"} | ${kurzText(z.ursache)} |`);
function kurzText(e) {
  return ["dragstart", "dragover", "drop", "pointermove", "pointercancel"].map((t) => `${t} ${e?.[t] ?? 0}`).join(", ");
}
writeFileSync(join(outDir, `ziehen-${modus}.json`), JSON.stringify({ report, tabelle }, null, 2));
process.exit(report.some((z) => z.startsWith("FEHLER")) ? 1 : 0);
