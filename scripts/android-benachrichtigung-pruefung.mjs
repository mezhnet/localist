// Echte Benachrichtigung im Android-Emulator (Etappe 23): installiert die APK, legt eine Kopie von beispiel-vault/
// (Fokus auf 1 Minute) auf das Gerät, öffnet sie und startet in der Ansicht „Pomodoro“ den Timer. Beim ersten Start
// erscheinen die Erklärung von Localist und danach die Frage von Android nach der Erlaubnis (beide werden fotografiert
// und angetippt). Dann geht die App in den Hintergrund (KEYCODE_HOME); nach dem Ende zeigt
// `dumpsys notification` die Benachrichtigung, und ein Bildschirmfoto zeigt sie in der Benachrichtigungsleiste.
// Alle adb-Befehle stehen mit Ausgabe im Bericht. Nur das Gerät aus ANDROID_SERIAL wird angesprochen.
//
// Aufruf: set ANDROID_SERIAL=emulator-5556 & node scripts/android-benachrichtigung-pruefung.mjs <adb.exe> <app.apk> <beispiel-vault> <Ausgabe-Ordner>
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [adb, apk, vaultQuelle, outDir] = process.argv.slice(2);
if (!adb || !apk || !vaultQuelle || !outDir || !process.env.ANDROID_SERIAL) {
  console.error("Aufruf mit gesetztem ANDROID_SERIAL: node scripts/android-benachrichtigung-pruefung.mjs <adb.exe> <app.apk> <beispiel-vault> <Ausgabe-Ordner>");
  process.exit(2);
}
const PAKET = "de.localist.desktop";
const VAULT_NAME = "Localist-Pomodoro";
const VAULT_GERAET = `/sdcard/Documents/${VAULT_NAME}`;
const PORT = 9342;
const TEXT = "Fokus geschafft – Zeit für 5 Minuten Pause";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const bericht = [];
const run = (args, { log = true, binary = false, zeilen = 4 } = {}) => {
  const result = spawnSync(adb, args, { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (log) bericht.push(`> adb ${args.join(" ")}\n      ${`${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/).slice(-zeilen).join("\n      ")}`);
  return result;
};
const shell = (befehl, optionen) => run(["shell", befehl], optionen);
const foto = (name) => {
  const datei = join(outDir, `${name}.png`);
  writeFileSync(datei, run(["exec-out", "screencap", "-p"], { log: false, binary: true }).stdout);
  bericht.push(`> adb exec-out screencap -p > ${datei}`);
  return datei;
};
/** Knopf eines System-Dialogs über uiautomator finden und antippen (Text oder Ressourcen-id). */
const dialogKnopf = async (muster, was) => {
  for (let i = 0; i < 30; i++) {
    shell("uiautomator dump /sdcard/localist-ui.xml", { log: false });
    const xml = shell("cat /sdcard/localist-ui.xml", { log: false }).stdout;
    const knoten = [...xml.matchAll(/<node [^>]*>/g)].map((m) => m[0]).find((n) => muster.test(n));
    const grenzen = knoten && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(knoten);
    if (grenzen) {
      const [x, y] = [Math.round((+grenzen[1] + +grenzen[3]) / 2), Math.round((+grenzen[2] + +grenzen[4]) / 2)];
      shell(`input tap ${x} ${y}`, { log: false });
      bericht.push(`> adb shell input tap ${x} ${y}   (${was}: ${(/text="([^"]*)"/.exec(knoten) ?? [])[1] ?? ""})`);
      await sleep(1200);
      return true;
    }
    await sleep(500);
  }
  bericht.push(`(${was}: nicht erschienen)`);
  return false;
};

// 1. Gerät, Installation, Vault-Kopie mit Fokus 1 Minute, Erlaubnis zurücksetzen (damit Localist neu fragt)
run(["devices"]);
shell("getprop ro.build.version.release");
run(["install", "-r", apk]);
shell(`dumpsys package ${PAKET} | grep versionName`);
shell(`pm revoke ${PAKET} android.permission.POST_NOTIFICATIONS`);
shell(`pm clear-permission-flags ${PAKET} android.permission.POST_NOTIFICATIONS user-set user-fixed`);
const kopie = join(mkdtempSync(join(tmpdir(), "localist-android-")), VAULT_NAME);
cpSync(vaultQuelle, kopie, { recursive: true });
const settingsPfad = join(kopie, ".localist", "settings.json");
const settings = JSON.parse(readFileSync(settingsPfad, "utf8"));
writeFileSync(settingsPfad, `${JSON.stringify({ ...settings, pomodoro: { fokus: 1, kurz: 5, lang: 15, runden: 4, pausenAuto: false, fokusAuto: false, ton: true } }, null, 2)}\n`);
shell(`rm -rf ${VAULT_GERAET}`, { log: false });
run(["push", kopie, VAULT_GERAET]);
rmSync(join(kopie, ".."), { recursive: true, force: true });
shell(`appops set ${PAKET} MANAGE_EXTERNAL_STORAGE allow`);
shell(`am force-stop ${PAKET}`, { log: false });
// App-Speicher leeren: Erklärung und Frage kommen nur beim allerersten Timer.
shell(`pm clear ${PAKET}`);
shell(`appops set ${PAKET} MANAGE_EXTERNAL_STORAGE allow`, { log: false });
shell(`am start -n ${PAKET}/.MainActivity`);

let pid = "";
for (let i = 0; i < 50 && !pid; i++) {
  await sleep(200);
  pid = shell(`pidof ${PAKET}`, { log: false }).stdout.trim();
}
let socketName = "";
for (let i = 0; i < 50 && !socketName; i++) {
  await sleep(200);
  socketName = shell("cat /proc/net/unix", { log: false }).stdout.includes(`webview_devtools_remote_${pid}`) ? `webview_devtools_remote_${pid}` : "";
}
run(["forward", `tcp:${PORT}`, `localabstract:${socketName}`], { log: false });
let target;
for (let i = 0; i < 50 && !target; i++) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page");
  } catch {
    // WebView startet noch.
  }
  await sleep(200);
}
if (!target) {
  console.error(`Keine WebView-Entwicklerschnittstelle gefunden (Prozess ${pid}, Socket ${socketName || "–"}).`);
  process.exit(2);
}
const socket = new WebSocket(target.webSocketDebuggerUrl);
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
socket.onclose = () => pending.forEach((done) => done({}));
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: false, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, was, versuche = 100) => {
  for (let i = 0; i < versuche; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${was}`);
};

let ergebnis = 0;
try {
  await send("Runtime.enable");
  await waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Vault-Ordner öffnen'))`, "Willkommen");
  // 2. Vault-Kopie mit der Ordnerauswahl von Localist öffnen
  await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Vault-Ordner öffnen")).click()`);
  await waitFor(`document.querySelector('.folder-picker [role="option"]')`, "Ordnerauswahl");
  await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.includes("/storage/emulated/0") || o.textContent.includes("Interner")).click()`);
  for (const ordner of ["Documents", VAULT_NAME]) {
    await waitFor(`[...document.querySelectorAll('.folder-picker [role="option"]')].some((o) => o.textContent.trim() === ${JSON.stringify(ordner)})`, `Ordner ${ordner}`);
    await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.trim() === ${JSON.stringify(ordner)}).click()`);
  }
  await sleep(300);
  await evaluate(`[...document.querySelectorAll(".folder-picker button")].find((b) => b.textContent.includes("Diesen Ordner als Vault verwenden")).click()`);
  await waitFor(`document.querySelector('.home-schnellaktion')`, "Startseite mit Schnellaktion „Pomodoro“");

  // 3. Pomodoro öffnen und starten: erst die Erklärung von Localist, dann die Frage von Android
  await evaluate(`document.querySelector('.home-schnellaktion').click()`);
  await waitFor(`document.querySelector('.pomodoro-zeit')?.textContent === "01:00"`, "Ansicht „Pomodoro“ mit 01:00");
  await sleep(500);
  foto("android-pomodoro");
  await evaluate(`document.querySelector('.pomodoro-start').click()`);
  await sleep(1500);
  foto("android-erklaerung");
  await dialogKnopf(/text="Weiter"/, "Erklärung von Localist");
  await sleep(800);
  foto("android-erlaubnis-frage");
  await dialogKnopf(/resource-id="com\.android\.permissioncontroller:id\/permission_allow_button"|text="(Allow|Zulassen)"/, "Frage von Android");
  await waitFor(`document.querySelector('.pomodoro-start')?.textContent === "Pausieren"`, "Timer läuft");
  shell(`dumpsys package ${PAKET} | grep -E "POST_NOTIFICATIONS|USE_EXACT_ALARM"`, { zeilen: 6 });
  const ende = await evaluate(`JSON.parse(localStorage.getItem("localist-pomodoro")).timer.ende`);
  bericht.push(`Timer läuft, Ende ${new Date(ende).toLocaleTimeString("de-DE")}; geplant über AlarmManager:`);
  shell(`dumpsys alarm | grep -A3 "${PAKET}" | head -8`, { zeilen: 8 });

  // 4. App in den Hintergrund, auf das Ende warten
  socket.close();
  shell("input keyevent KEYCODE_HOME");
  await sleep(1500);
  shell(`dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" | head -2`);
  await sleep(Math.max(0, ende - Date.now()) + 4000);
  const dump = run(["shell", `dumpsys notification --noredact | grep -A30 "pkg=${PAKET}" | grep -E "NotificationRecord|pkg=|android.title|android.text|when="`], { zeilen: 12 });
  if (!dump.stdout.includes(TEXT)) ergebnis = 1;
  shell("cmd statusbar expand-notifications", { log: false });
  await sleep(1500);
  foto("android-benachrichtigung");
  shell("cmd statusbar collapse", { log: false });
} catch (error) {
  bericht.push(`FEHLER: ${error.message}`);
  ergebnis = 1;
} finally {
  run(["forward", "--remove", `tcp:${PORT}`], { log: false });
  console.log(bericht.join("\n"));
  console.log(ergebnis === 0 ? `Ergebnis: Benachrichtigung „${TEXT}“ kam mit der App im Hintergrund.` : "Ergebnis: Benachrichtigung NICHT gefunden.");
  process.exitCode = ergebnis;
}
