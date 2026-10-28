// Prüft den eigenen Fensterrahmen der gebauten localist.exe (Etappe 18) mit echter Maus und Tastatur: keine
// Windows-Titelleiste, Ziehen an einer freien Stelle der oberen Leiste, Doppelklick maximiert, die drei Fensterknöpfe,
// Größe am Rand ändern, Andocken mit Win+Pfeiltasten und Schließen über das X. Die Messungen und die Eingaben macht
// scripts/fenster-helfer.ps1; die Positionen der Elemente kommen über die WebView2-Entwicklerschnittstelle.
// Maus und Tasten wirken nur, solange das Localist-Fenster vorn liegt (sonst bricht der Helfer ab).
//
// Aufruf: node scripts/fenster-pruefung.mjs <localist.exe> <Vault-Kopie> <Screenshot-Ordner>
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

const [exe, vault, outDir] = process.argv.slice(2);
if (!exe || !vault || !outDir) {
  console.error("Aufruf: node scripts/fenster-pruefung.mjs <localist.exe> <Vault-Kopie> <Screenshot-Ordner>");
  process.exit(2);
}
const PORT = 9338;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
mkdirSync(outDir, { recursive: true });

const webviewData = mkdtempSync(join(tmpdir(), "localist-fenster-webview-"));
const app = spawn(exe, ["--vault", vault], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`, WEBVIEW2_USER_DATA_FOLDER: webviewData },
  stdio: "ignore",
});
let exitCode = null;
app.on("exit", (code) => (exitCode = code));

// Helfer (PowerShell) mit einer Befehlszeile je Anfrage und einer JSON-Zeile je Antwort
const helfer = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/fenster-helfer.ps1"], { stdio: ["pipe", "pipe", "inherit"] });
const antworten = [];
let warten = null;
createInterface({ input: helfer.stdout }).on("line", (zeile) => {
  if (!zeile.trim().startsWith("{")) return;
  antworten.push(JSON.parse(zeile));
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
const ja = (wert) => (wert ? "ja" : "NEIN");
const r = (x) => `${x.links},${x.oben} ${x.breite} × ${x.hoehe}`;
let hwnd;
try {
  const bereit = await naechste(); // erste Zeile des Helfers: „bereit“
  if (!bereit.bereit) throw new Error("Der Helfer scripts/fenster-helfer.ps1 ist nicht gestartet.");
  // Zwei Klicks kurz nacheinander an derselben Stelle wären ein Doppelklick: zwischen getrennten Aktionen warten.
  const pause = () => sleep(bereit.doppelklickZeit + 200);
  await waitFor(`document.querySelector('.workspace-leiste .fensterleiste-frei')`, "Fensterleiste");
  for (let i = 0; i < 50 && !hwnd; i++) {
    hwnd = (await ps(`finde ${app.pid}`)).hwnd || null;
    if (!hwnd) await sleep(200);
  }
  if (!hwnd) throw new Error("Kein sichtbares Fenster „Localist“ gefunden.");
  // Damit kein anderes Fenster die Prüfung verdeckt, liegt Localist so lange ganz oben.
  await ps(`oben ${hwnd} 1`);
  const info = () => ps(`info ${hwnd}`);
  const dpr = await evaluate("window.devicePixelRatio");
  /** Bildschirmpunkt der Mitte eines Elements (CSS-Pixel → echte Pixel). */
  const punkt = async (selektor) => {
    const i = await info();
    const b = await evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selektor)}).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    return { x: Math.round(i.innen.x + b.x * dpr), y: Math.round(i.innen.y + b.y * dpr) };
  };

  // Welche Knöpfe in der Seite einen Klick bekommen (zur Kontrolle der echten Mausklicks)
  await evaluate(`window.__klicks = []; document.addEventListener("click", (e) => window.__klicks.push(e.target.closest("button")?.getAttribute("aria-label") ?? e.target.className), true); true`);
  let i = await info();
  report.push(
    `Start: Fenster ${r(i.fenster)}, sichtbarer Rahmen ${r(i.sichtbar)}, Innenbereich ${i.innen.x},${i.innen.y} ${i.innen.breite} × ${i.innen.hoehe}, DPI ${i.dpi} (devicePixelRatio ${dpr})`,
  );
  // Tauri behält den Fensterstil WS_CAPTION (für Andocken und Animationen), zeichnet aber keine Titelleiste:
  // Der Innenbereich (die Seite) beginnt direkt unter der 1 px breiten Fensterlinie von Windows.
  report.push(
    `Ohne Windows-Titelleiste: Innenbereich beginnt ${i.innen.y - i.sichtbar.oben} px unter dem oberen sichtbaren Rand (nur die Fensterlinie): ${ja(i.innen.y - i.sichtbar.oben <= 1)}, Seite füllt die Fensterbreite ${i.innen.breite} von ${i.sichtbar.breite} px; Größe änderbar (WS_THICKFRAME): ${ja(i.groesseAenderbar)}, maximierbar: ${ja(i.maximierbar)}, minimierbar: ${ja(i.minimierbar)}`,
  );

  // Frei: eine Stelle der oberen Leiste ohne Knopf
  const frei = await evaluate(`(() => { const b = document.querySelector('.workspace-leiste .fensterleiste-frei').getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2; const el = document.elementFromPoint(x, y); return { x, y, element: el.className, region: el.closest('[data-tauri-drag-region]')?.getAttribute('data-tauri-drag-region') ?? null }; })()`);
  report.push(`Freie Stelle der oberen Leiste bei CSS ${Math.round(frei.x)},${Math.round(frei.y)}: Element „${frei.element}“, Ziehbereich „${frei.region}“`);
  const freiPunkt = await punkt(".workspace-leiste .fensterleiste-frei");

  // Ein echter Klick holt das Fenster nach vorn (startet ein Ziehen ohne Bewegung).
  await ps(`klick ${hwnd} ${freiPunkt.x} ${freiPunkt.y}`);
  await bis(async () => (await info()).vorn);
  await pause();
  i = await info();
  report.push(`Nach einem Klick auf die Leiste liegt Localist vorn: ${ja(i.vorn)}, Fenster unverändert: ${ja(r(i.fenster) === r((await info()).fenster))}`);

  // 1. Ziehen
  const vorher = (await info()).sichtbar;
  await ps(`ziehen ${hwnd} ${freiPunkt.x} ${freiPunkt.y} -160 90`);
  await sleep(300);
  const nachher = (await info()).sichtbar;
  report.push(
    `Ziehen an der freien Stelle um −160, +90 px: Fenster ${vorher.links},${vorher.oben} → ${nachher.links},${nachher.oben} (Verschiebung ${nachher.links - vorher.links}, ${nachher.oben - vorher.oben}), Größe gleich: ${ja(nachher.breite === vorher.breite && nachher.hoehe === vorher.hoehe)}`,
  );

  // 2. Doppelklick maximiert und stellt wieder her
  const p2 = await punkt(".workspace-leiste .fensterleiste-frei");
  await ps(`doppelklick ${hwnd} ${p2.x} ${p2.y}`);
  await bis(async () => (await info()).maximiert);
  await pause();
  i = await info();
  const knopfName = () => evaluate(`document.querySelectorAll('.fenster-knopf')[1].getAttribute('aria-label')`);
  await bis(async () => (await knopfName()) === "Fenster wiederherstellen");
  report.push(
    `Doppelklick auf die Leiste: maximiert ${ja(i.maximiert)}, Innenbereich ${i.innen.x},${i.innen.y} ${i.innen.breite} × ${i.innen.hoehe} = Arbeitsfläche ${r(i.arbeitsflaeche)}: ${ja(i.innen.x === i.arbeitsflaeche.links && i.innen.y === i.arbeitsflaeche.oben && i.innen.breite === i.arbeitsflaeche.breite && i.innen.hoehe === i.arbeitsflaeche.hoehe)}, Knopf heißt jetzt „${await knopfName()}“`,
  );
  await ps(`doppelklick ${hwnd} ${(await punkt(".workspace-leiste .fensterleiste-frei")).x} ${(await punkt(".workspace-leiste .fensterleiste-frei")).y}`);
  await bis(async () => !(await info()).maximiert);
  i = await info();
  report.push(`Zweiter Doppelklick: wiederhergestellt ${ja(!i.maximiert)}, Fenster wieder bei ${i.sichtbar.links},${i.sichtbar.oben} ${i.sichtbar.breite} × ${i.sichtbar.hoehe}: ${ja(r(i.sichtbar) === r(nachher))}`);
  await bis(async () => (await knopfName()) === "Fenster maximieren");
  await pause();

  // 3. Die Knöpfe mit echter Maus
  await ps(`klick ${hwnd} ${(await punkt(".fenster-knopf:nth-child(2)")).x} ${(await punkt(".fenster-knopf:nth-child(2)")).y}`);
  const maxKnopf = await bis(async () => (await info()).maximiert);
  await bis(async () => (await knopfName()) === "Fenster wiederherstellen");
  await ps(`bild ${hwnd} ${resolve(outDir, "fenster-maximiert.png")}`);
  await pause();
  await ps(`klick ${hwnd} ${(await punkt(".fenster-knopf:nth-child(2)")).x} ${(await punkt(".fenster-knopf:nth-child(2)")).y}`);
  const wiederKnopf = await bis(async () => !(await info()).maximiert);
  await pause();
  report.push(`Knopf „Maximieren“: maximiert ${ja(maxKnopf)}; Knopf „Wiederherstellen“: wiederhergestellt ${ja(wiederKnopf)}`);
  await ps(`klick ${hwnd} ${(await punkt(".fenster-knopf:nth-child(1)")).x} ${(await punkt(".fenster-knopf:nth-child(1)")).y}`);
  const minKnopf = await bis(async () => (await info()).minimiert);
  report.push(`Knopf „Minimieren“: minimiert ${ja(minKnopf)}`);
  await ps(`zeigen ${hwnd}`);
  await bis(async () => !(await info()).minimiert);
  await sleep(400);
  const p3 = await punkt(".workspace-leiste .fensterleiste-frei");
  await ps(`klick ${hwnd} ${p3.x} ${p3.y}`);
  await bis(async () => (await info()).vorn);
  await pause();

  // 4. Größe am Rand ändern (rechts und unten im unsichtbaren Rand, oben am Rand des Innenbereichs)
  const g0 = (await info()).sichtbar;
  const mitteY = Math.round(g0.oben + g0.hoehe / 2);
  await ps(`ziehen ${hwnd} ${g0.rechts + 3} ${mitteY} 120 0`);
  await sleep(300);
  const g1 = (await info()).sichtbar;
  report.push(`Rechter Rand um +120 px gezogen: Breite ${g0.breite} → ${g1.breite} (${g1.breite - g0.breite}), links bleibt ${ja(g1.links === g0.links)}`);
  await ps(`ziehen ${hwnd} ${Math.round(g1.links + g1.breite / 3)} ${g1.unten + 3} 0 -100`);
  await sleep(300);
  const g2 = (await info()).sichtbar;
  report.push(`Unterer Rand um −100 px gezogen: Höhe ${g1.hoehe} → ${g2.hoehe} (${g2.hoehe - g1.hoehe})`);
  await ps(`ziehen ${hwnd} ${Math.round(g2.links + g2.breite / 3)} ${g2.oben + 1} 0 -60`);
  await sleep(300);
  const g3 = (await info()).sichtbar;
  report.push(`Oberer Rand um −60 px gezogen: oben ${g2.oben} → ${g3.oben}, Höhe ${g2.hoehe} → ${g3.hoehe} (${g3.hoehe - g2.hoehe})`);
  await ps(`ziehen ${hwnd} ${g3.links - 3} ${g3.unten + 3} 80 -40`);
  await sleep(300);
  const g4 = (await info()).sichtbar;
  report.push(`Ecke unten links um +80, −40 px gezogen: Breite ${g3.breite} → ${g4.breite}, Höhe ${g3.hoehe} → ${g4.hoehe}`);

  // 5. Andocken mit Win+Pfeiltasten
  const vorDem = (await info()).sichtbar;
  await ps(`tasten ${hwnd} win+up`);
  const winUp = await bis(async () => (await info()).maximiert);
  report.push(`Win+↑: maximiert ${ja(winUp)}`);
  await ps(`tasten ${hwnd} win+down`);
  const winDown = await bis(async () => !(await info()).maximiert);
  i = await info();
  report.push(`Win+↓: wiederhergestellt ${ja(winDown)}, wieder ${r(i.sichtbar)}: ${ja(r(i.sichtbar) === r(vorDem))}`);
  await ps(`tasten ${hwnd} win+left`);
  await sleep(900);
  i = await info();
  const halb = Math.round(i.arbeitsflaeche.breite / 2);
  report.push(
    `Win+←: angedockt links ${i.sichtbar.links},${i.sichtbar.oben} ${i.sichtbar.breite} × ${i.sichtbar.hoehe} (Arbeitsfläche ${r(i.arbeitsflaeche)}, halbe Breite ${halb}): ${ja(Math.abs(i.sichtbar.links - i.arbeitsflaeche.links) <= 2 && Math.abs(i.sichtbar.breite - halb) <= 12 && Math.abs(i.sichtbar.hoehe - i.arbeitsflaeche.hoehe) <= 2)}`,
  );
  // Windows zeigt daneben die Fensterauswahl (Snap Assist); Escape schließt sie, falls sie offen ist.
  if (!(await info()).vorn) await ps(`tasten ${hwnd} escape`).catch(() => {});
  await sleep(400);
  await ps(`bild ${hwnd} ${resolve(outDir, "fenster-links-angedockt.png")}`);
  if (!(await info()).vorn) {
    const p4 = await punkt(".workspace-leiste .fensterleiste-frei");
    await ps(`klick ${hwnd} ${p4.x} ${p4.y}`);
    await bis(async () => (await info()).vorn);
  }
  await ps(`tasten ${hwnd} win+right`);
  await sleep(900);
  i = await info();
  report.push(`Danach Win+→: zurück an der alten Stelle ${r(i.sichtbar)}: ${ja(r(i.sichtbar) === r(vorDem))}`);
  if (!(await info()).vorn) await ps(`tasten ${hwnd} escape`).catch(() => {});
  await ps(`bild ${hwnd} ${resolve(outDir, "fenster-rahmen.png")}`);

  report.push(`Echte Klicks auf Knöpfe in der Seite: ${(await evaluate("window.__klicks.join(' | ')")) || "-"}`);

  // 6. Schließen über das X (sichert vorher, die App beendet sich)
  await ps(`oben ${hwnd} 0`);
  const p5 = await punkt(".fenster-knopf.is-schliessen");
  await ps(`klick ${hwnd} ${p5.x} ${p5.y}`);
  const zu = await bis(async () => exitCode !== null, 5000);
  report.push(`Knopf „Schließen“: App beendet ${ja(zu)}${zu ? ` (Exit-Code ${exitCode})` : ""}`);
  report.push(`Screenshots (echte Bildschirmaufnahme des Fensters): ${["fenster-rahmen.png", "fenster-maximiert.png", "fenster-links-angedockt.png"].map((n) => join(outDir, n)).join(", ")}`);
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
} finally {
  console.log(report.join("\n"));
  if (hwnd && exitCode === null) await ps(`oben ${hwnd} 0`).catch(() => {});
  helfer.stdin.write("ende\n");
  socket.close();
  if (exitCode === null) app.kill(); // beendet nur die hier gestartete Prüf-App
  await sleep(1000);
  helfer.kill();
  rmSync(webviewData, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
