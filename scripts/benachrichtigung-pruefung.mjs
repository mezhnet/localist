// Echte Benachrichtigung in der gebauten localist.exe (Etappe 23): startet die App mit einer Kopie von beispiel-vault/
// (Fokus auf 1 Minute in `.localist/settings.json`), startet in der Ansicht „Pomodoro“ den Timer, minimiert das
// Fenster und wartet auf das Ende. Nachweise: ein Bildschirmfoto der Ecke unten rechts (dort erscheint die
// Benachrichtigung von Windows), der Eintrag im Benachrichtigungsverlauf von Windows (nur dieser eine, gesucht nach
// dem Text) und die Session im Verlauf der Vault-Kopie. Der echte Vault des Nutzers wird nie geöffnet.
// Hinweis: Eine EXE aus target/release meldet sich bei Windows als „Windows PowerShell“ (so macht es das Plugin bei
// nicht installierten Builds); die installierte App erscheint als „Localist“.
//
// Aufruf: node scripts/benachrichtigung-pruefung.mjs <localist.exe> <Ausgabe-Ordner>
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const [exe, outDir] = process.argv.slice(2);
if (!exe || !outDir) {
  console.error("Aufruf: node scripts/benachrichtigung-pruefung.mjs <localist.exe> <Ausgabe-Ordner>");
  process.exit(2);
}
const PORT = 9341;
const TEXT = "Fokus geschafft – Zeit für 5 Minuten Pause";
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
mkdirSync(outDir, { recursive: true });

const vault = mkdtempSync(join(tmpdir(), "localist-benachrichtigung-vault-"));
cpSync(resolve("beispiel-vault"), vault, { recursive: true });
const settingsPfad = join(vault, ".localist", "settings.json");
const settings = existsSync(settingsPfad) ? JSON.parse(readFileSync(settingsPfad, "utf8")) : { version: 1 };
writeFileSync(settingsPfad, `${JSON.stringify({ ...settings, pomodoro: { fokus: 1, kurz: 5, lang: 15, runden: 4, pausenAuto: false, fokusAuto: false, ton: true } }, null, 2)}\n`);

const webviewData = mkdtempSync(join(tmpdir(), "localist-benachrichtigung-webview-"));
const app = spawn(exe, ["--vault", vault], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`, WEBVIEW2_USER_DATA_FOLDER: webviewData },
  stdio: "ignore",
});

let target;
for (let i = 0; i < 150 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page" && t.url.includes("tauri.localhost"));
  } catch {
    // App startet noch.
  }
  if (!target) await sleep(200);
}
if (!target) {
  console.error("Die App hat keine Entwicklerschnittstelle geöffnet.");
  spawnSync("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
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
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = nextId++;
    pending.set(id, done);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, was, ms = 15000) => {
  for (let t = 0; t < ms; t += 150) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${was}`);
};

/** Bildschirmfoto nur der Ecke unten rechts über der Taskleiste, so groß wie die Benachrichtigung (nichts anderes). */
function eckeFotografieren(datei) {
  const skript = `
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Name Dpi -Namespace Lp -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
[void][Lp.Dpi]::SetProcessDPIAware()
$a = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$s = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero).DpiX / 96
$b = [int](362 * $s); $h = [int](104 * $s)
$bmp = New-Object System.Drawing.Bitmap $b, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($a.Right - $b - [int](20 * $s), $a.Bottom - $h - [int](22 * $s), 0, 0, $bmp.Size)
$bmp.Save('${datei.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
"$($a.Width)x$($a.Height)"`;
  return spawnSync("powershell", ["-NoProfile", "-Command", skript], { encoding: "utf8" }).stdout.trim();
}

/** Sucht im Benachrichtigungsverlauf von Windows (Kopie der Datenbank) nur nach Einträgen mit unserem Text. */
function verlaufVonWindows(seit) {
  const quelle = join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Notifications");
  const kopie = mkdtempSync(join(tmpdir(), "localist-wpn-"));
  for (const name of ["wpndatabase.db", "wpndatabase.db-wal", "wpndatabase.db-shm"]) {
    if (existsSync(join(quelle, name))) copyFileSync(join(quelle, name), join(kopie, name));
  }
  const db = new DatabaseSync(join(kopie, "wpndatabase.db"));
  try {
    const zeilen = db
      .prepare(
        `SELECT n.Id AS id, CAST(n.ArrivalTime AS TEXT) AS ankunft, h.PrimaryId AS absender, CAST(n.Payload AS TEXT) AS inhalt
         FROM Notification n LEFT JOIN NotificationHandler h ON h.RecordId = n.HandlerId
         WHERE CAST(n.Payload AS TEXT) LIKE ? ORDER BY n.ArrivalTime DESC LIMIT 3`,
      )
      .all(`%${TEXT}%`);
    // ArrivalTime ist eine Windows-Zeit (100-ns-Schritte seit 1601).
    return zeilen
      .map((z) => ({ ...z, zeit: new Date(Number(BigInt(z.ankunft) / 10000n) - 11644473600000) }))
      .filter((z) => z.zeit.getTime() >= seit - 5000)
      .map((z) => ({ zeit: z.zeit.toISOString(), absender: z.absender, text: (z.inhalt.match(/<text[^>]*>[^<]*<\/text>/g) ?? []).join(" ") }));
  } finally {
    db.close();
    rmSync(kopie, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

let ergebnis = 0;
try {
  await send("Runtime.enable");
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`, "Vault geöffnet");
  await evaluate(`document.querySelector('.sidebar-werkzeuge .sidebar-item').click(); true`);
  await waitFor(`document.querySelector('.pomodoro-zeit')?.textContent === "01:00"`, "Ansicht „Pomodoro“ mit 01:00");
  await evaluate(`document.querySelector('.pomodoro-start').click(); true`);
  await waitFor(`document.querySelector('.pomodoro-start')?.textContent === "Pausieren"`, "Timer läuft");
  const start = Date.now();
  const ende = await evaluate(`JSON.parse(localStorage.getItem("localist-pomodoro")).timer.ende`);
  console.log(`Timer gestartet: Ende ${new Date(ende).toLocaleTimeString("de-DE")}, Restzeit ${await evaluate(`document.querySelector('.pomodoro-zeit').textContent`)}`);
  // Fenster minimieren: Die Benachrichtigung kommt trotzdem (der Zeitgeber in Rust schaut auf die Systemuhr).
  await evaluate(`window.__TAURI_INTERNALS__.invoke("plugin:window|minimize", { label: "main" }).then(() => true)`);
  console.log("Fenster minimiert.");
  await sleep(Math.max(0, ende - Date.now()) + 2500);
  const bildschirm = eckeFotografieren(resolve(outDir, "benachrichtigung-exe.png"));
  console.log(`Bildschirmfoto der Ecke unten rechts (Arbeitsfläche ${bildschirm}): ${join(outDir, "benachrichtigung-exe.png")}`);
  await sleep(1500);
  const eintraege = verlaufVonWindows(start);
  console.log(`Benachrichtigungsverlauf von Windows: ${eintraege.length ? JSON.stringify(eintraege, null, 1) : "kein Eintrag"}`);
  const monat = readdirSync(join(vault, ".localist", "pomodoro")).find((name) => name.endsWith(".jsonl"));
  console.log(`Verlauf in der Vault-Kopie: .localist/pomodoro/${monat}: ${readFileSync(join(vault, ".localist", "pomodoro", monat), "utf8").trim()}`);
  if (eintraege.length === 0) ergebnis = 1;
} catch (error) {
  console.error(`FEHLER: ${error.message}`);
  ergebnis = 1;
} finally {
  socket.close();
  spawnSync("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  await sleep(800);
  for (const ordner of [vault, webviewData]) {
    try {
      rmSync(ordner, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      // WebView2 gibt den Ordner manchmal erst später frei; er liegt nur im Temp-Ordner.
    }
  }
  process.exitCode = ergebnis;
}
