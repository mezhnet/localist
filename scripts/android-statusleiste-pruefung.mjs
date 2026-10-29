// Android-Prüfung „Statusleiste folgt dem Modus der App“ (Nachtrag nach Version 2.1) im Emulator oder auf einem Gerät
// mit USB-Debugging: Die Symbole oben (Uhrzeit, WLAN, Akku) sind in Hell dunkel und in Dunkel und Schwarz hell, auch
// wenn das System-Design das Gegenteil sagt, und schon direkt nach dem Start. Gemessen wird zweifach: was Android meldet
// (`dumpsys window`: LIGHT_STATUS_BARS = heller Grund, also dunkle Symbole) und der Kontrast der Uhrzeit im
// Screenshot (`adb exec-out screencap`). Bedient wird mit echten Fingertipps (`adb shell input tap`), gelesen über die
// WebView-Entwicklerschnittstelle der Debug-APK. Das System-Design (`cmd uimode night`) wird am Ende zurückgesetzt.
// Das Gerät wählt `ANDROID_SERIAL` (z. B. emulator-5556), damit kein fremdes Gerät angesprochen wird.
//
// Aufruf: set ANDROID_SERIAL=emulator-5556 & node scripts/android-statusleiste-pruefung.mjs <adb.exe> <app-universal-debug.apk> <beispiel-vault> <Screenshot-Ordner>
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const [adb, apk, vaultQuelle, outDir] = process.argv.slice(2);
if (!adb || !apk || !vaultQuelle || !outDir || !process.env.ANDROID_SERIAL) {
  console.error("Aufruf mit gesetztem ANDROID_SERIAL: node scripts/android-statusleiste-pruefung.mjs <adb.exe> <app-universal-debug.apk> <beispiel-vault> <Screenshot-Ordner>");
  process.exit(2);
}
const PAKET = "de.localist.desktop";
const VAULT_NAME = "Localist-Handy";
const VAULT_GERAET = `/sdcard/Documents/${VAULT_NAME}`;
const PORT = 9339;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

const report = [];
const fehler = [];
const run = (args, { log = true, binary = false } = {}) => {
  const result = spawnSync(adb, args, { encoding: binary ? "buffer" : "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (log) {
    const text = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split(/\r?\n/).slice(-4).join("\n      ");
    report.push(`> adb ${args.join(" ")}\n      ${text}`);
  }
  return result;
};
const shell = (command, options) => run(["shell", command], options);

/** Liest ein PNG von `screencap` (8 Bit je Kanal, RGB oder RGBA, ohne Interlacing). */
function pngLesen(puffer) {
  let pos = 8;
  let breite = 0;
  let hoehe = 0;
  let farbtyp = 0;
  const daten = [];
  while (pos < puffer.length) {
    const laenge = puffer.readUInt32BE(pos);
    const art = puffer.toString("latin1", pos + 4, pos + 8);
    const inhalt = puffer.subarray(pos + 8, pos + 8 + laenge);
    if (art === "IHDR") {
      breite = inhalt.readUInt32BE(0);
      hoehe = inhalt.readUInt32BE(4);
      farbtyp = inhalt[9];
    } else if (art === "IDAT") daten.push(inhalt);
    else if (art === "IEND") break;
    pos += 12 + laenge;
  }
  const kanaele = farbtyp === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(daten));
  const zeile = breite * kanaele;
  const pixel = Buffer.alloc(zeile * hoehe);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    for (let x = 0; x < zeile; x++) {
      const a = x >= kanaele ? pixel[y * zeile + x - kanaele] : 0;
      const b = y > 0 ? pixel[(y - 1) * zeile + x] : 0;
      const c = x >= kanaele && y > 0 ? pixel[(y - 1) * zeile + x - kanaele] : 0;
      let vorhersage = 0;
      if (filter === 1) vorhersage = a;
      else if (filter === 2) vorhersage = b;
      else if (filter === 3) vorhersage = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        vorhersage = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixel[y * zeile + x] = (roh[y * (zeile + 1) + 1 + x] + vorhersage) & 255;
    }
  }
  return { breite, hoehe, kanaele, pixel };
}

const kanal = (wert) => {
  const c = wert / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const kontrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

/** Uhrzeit links in der Statusleiste: Farbe des Grunds, ob die Schrift heller oder dunkler ist, und ihr Kontrast. */
function uhrzeitMessen(bild, statusHoehe) {
  const { breite, kanaele, pixel } = bild;
  const werte = [];
  for (let y = 0; y < statusHoehe; y++) {
    for (let x = 0; x < Math.round(breite * 0.35); x++) {
      const i = (y * breite + x) * kanaele;
      werte.push(0.2126 * kanal(pixel[i]) + 0.7152 * kanal(pixel[i + 1]) + 0.0722 * kanal(pixel[i + 2]));
    }
  }
  // Grund = häufigste Helligkeit; Schrift = die 1 % der Pixel, die sich am stärksten davon abheben
  const haeufig = new Map();
  for (const l of werte) haeufig.set(Math.round(l * 200), (haeufig.get(Math.round(l * 200)) ?? 0) + 1);
  const grund = [...haeufig.entries()].sort((x, y) => y[1] - x[1])[0][0] / 200;
  const sortiert = werte.map((l) => ({ l, k: kontrast(l, grund) })).sort((x, y) => y.k - x.k);
  const schrift = sortiert[Math.floor(sortiert.length * 0.01)];
  return { grund, schriftHell: schrift.l > grund, kontrast: Math.round(schrift.k * 10) / 10 };
}

let nummer = 0;
let statusHoehe = 0;
/** Screenshot, Meldung von Android und Messung im Bild; vergleicht beides mit dem Modus, der in der App gerade gilt. */
async function pruefen(name, beschreibung) {
  await sleep(1200);
  const modus = await evaluate(`document.documentElement.dataset.theme`);
  const erwartetHell = modus !== "light"; // Dunkel und Schwarz → helle Symbole
  const file = join(outDir, `${String(++nummer).padStart(2, "0")}-${name}.png`);
  const png = run(["exec-out", "screencap", "-p"], { log: false, binary: true }).stdout;
  writeFileSync(file, png);
  report.push(`> adb exec-out screencap -p > ${file}`);
  const android = shell("dumpsys window | grep -A1 mLastStatusBarAppearanceRegions");
  const regel = /AppearanceRegion\{([^}]*)\}/.exec(android.stdout)?.[1] ?? "";
  const androidHell = !regel.includes("LIGHT_STATUS_BARS"); // Android 17 schreibt es ohne „APPEARANCE_“
  const messung = uhrzeitMessen(pngLesen(png), statusHoehe);
  const gut = androidHell === erwartetHell && messung.schriftHell === erwartetHell && messung.kontrast >= 3;
  if (!gut) fehler.push(name);
  report.push(
    `${gut ? "[x]" : "[ ]"} ${beschreibung}: App-Modus „${modus}“ → erwartet ${erwartetHell ? "helle" : "dunkle"} Symbole; ` +
      `Android meldet ${androidHell ? "helle" : "dunkle"} Symbole; Uhrzeit im Bild ${messung.schriftHell ? "hell" : "dunkel"} auf ` +
      `${messung.grund < 0.2 ? "dunklem" : "hellem"} Grund, Kontrast ${messung.kontrast} : 1 (lesbar ab 3 : 1)`,
  );
}

// 1. Gerät, Installation, Vault-Kopie, Zugriff auf alle Dateien
run(["devices"]);
run(["emu", "avd", "name"]);
shell("getprop ro.build.version.release");
run(["install", "-r", apk]);
shell(`dumpsys package ${PAKET} | grep versionName`);
const kopie = join(mkdtempSync(join(tmpdir(), "localist-android-")), VAULT_NAME);
cpSync(vaultQuelle, kopie, { recursive: true });
shell(`rm -rf ${VAULT_GERAET}`, { log: false });
run(["push", kopie, VAULT_GERAET]);
rmSync(join(kopie, ".."), { recursive: true, force: true });
shell(`appops set ${PAKET} MANAGE_EXTERNAL_STORAGE allow`);
const nachtVorher = /Night mode: (\w+)/.exec(shell("cmd uimode night").stdout)?.[1] ?? "no";
shell("cmd uimode night no");

// Verbindung zur WebView der App (nach jedem Neustart neu)
let socket;
let nextId = 1;
const pending = new Map();
const problems = [];
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const waitFor = async (expression, what, tries = 100) => {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};

async function starten() {
  socket?.close();
  run(["forward", "--remove", `tcp:${PORT}`], { log: false });
  shell(`am force-stop ${PAKET}`);
  shell(`am start -n ${PAKET}/.MainActivity`);
  let pid = "";
  for (let i = 0; i < 50 && !pid; i++) {
    await sleep(200);
    pid = shell(`pidof ${PAKET}`, { log: false }).stdout.trim();
  }
  let socketName = "";
  for (let i = 0; i < 50 && !socketName; i++) {
    await sleep(200);
    const liste = shell("cat /proc/net/unix", { log: false }).stdout;
    socketName = liste.includes(`webview_devtools_remote_${pid}`) ? `webview_devtools_remote_${pid}` : "";
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
  if (!target) throw new Error(`Keine WebView-Entwicklerschnittstelle gefunden (Prozess ${pid}, Socket ${socketName || "–"}).`);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (socket.onopen = resolve));
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method === "Runtime.exceptionThrown") {
      problems.push(`Ausnahme: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
    } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      problems.push(`console.error: ${message.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    }
  };
  await send("Runtime.enable");
  await waitFor(`document.querySelector('.vault-name, .handy-nav') || [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Vault-Ordner öffnen'))`, "Oberfläche");
}

let geraet; // Umrechnung CSS-Pixel → Bildschirm
async function tippe(ausdruck, was) {
  const r = await evaluate(`(() => { const e = ${ausdruck}; if (!e) return null; e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!r) throw new Error(`Nicht gefunden: ${ausdruck}`);
  const x = Math.round(geraet.left + r.x * geraet.dpr);
  const y = Math.round(geraet.top + r.y * geraet.dpr);
  shell(`input tap ${x} ${y}`, { log: false });
  report.push(`> adb shell input tap ${x} ${y}   (${was})`);
  await sleep(700);
}
const nav = (name) => `[...document.querySelectorAll(".handy-nav button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).trim() === ${JSON.stringify(name)})`;
const karte = (name) => `[...document.querySelectorAll(".modus-karte")].find((k) => k.textContent.startsWith(${JSON.stringify(name)}))`;
const WIE_SYSTEM = `document.querySelector('.darstellung.is-handy [role="switch"][aria-label="Wie System"]')`;

try {
  // 2. Start, Vault-Kopie öffnen, Startzustand Hell (System hell)
  await starten();
  await sleep(1500);
  if (await evaluate(`Boolean(document.querySelector(".handy-nav") && !document.querySelector(".vault-name"))`)) {
    await evaluate(`${nav("Start")}.click(); true`);
    await waitFor(`document.querySelector('.vault-name')`, "Startseite");
  }
  const vaultJetzt = await evaluate(`document.querySelector('.vault-name')?.textContent ?? null`);
  if (vaultJetzt !== VAULT_NAME) {
    if (vaultJetzt === null) await evaluate(`[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Vault-Ordner öffnen")).click()`);
    else {
      await evaluate(`document.querySelector(".home-handy-vault, .vault-switcher").click()`);
      await waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.includes("Anderen Vault öffnen"))`, "Vault-Menü");
      await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.includes("Anderen Vault öffnen")).click()`);
    }
    await waitFor(`document.querySelector('.folder-picker [role="option"]')`, "Ordnerauswahl");
    await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.includes("/storage/emulated/0") || o.textContent.includes("Interner")).click()`);
    for (const ordner of ["Documents", VAULT_NAME]) {
      await waitFor(`[...document.querySelectorAll('.folder-picker [role="option"]')].some((o) => o.textContent.trim() === ${JSON.stringify(ordner)})`, `Ordner ${ordner}`);
      await evaluate(`[...document.querySelectorAll('.folder-picker [role="option"]')].find((o) => o.textContent.trim() === ${JSON.stringify(ordner)}).click()`);
    }
    await sleep(300);
    await evaluate(`[...document.querySelectorAll(".folder-picker button")].find((b) => b.textContent.includes("Diesen Ordner als Vault verwenden")).click()`);
  }
  await waitFor(`document.querySelector('.vault-name')?.textContent === ${JSON.stringify(VAULT_NAME)} && document.querySelector('.handy-nav')`, "Vault-Kopie geöffnet");
  await evaluate(`localStorage.setItem("theme", "light"); localStorage.setItem("theme-dunkel", "black"); localStorage.setItem("akzent", "orange"); location.reload(); true`);
  await sleep(2500);
  await waitFor(`document.querySelector('.handy-nav') && document.querySelector('.home-table-zeile')`, "Startseite nach dem Neuladen");

  const groesse = /(\d+)x(\d+)/.exec(shell("wm size", { log: false }).stdout);
  const fenster = await evaluate(`(() => {
    const p = document.createElement("div"); p.style.cssText = "position:fixed;top:0;padding-top:env(safe-area-inset-top)"; document.body.append(p);
    const oben = parseFloat(getComputedStyle(p).paddingTop); p.remove();
    return { w: innerWidth, h: innerHeight, dpr: devicePixelRatio, oben };
  })()`);
  geraet = { dpr: fenster.dpr, left: 0, top: Number(groesse[2]) - fenster.h * fenster.dpr };
  statusHoehe = Math.round((fenster.oben || 24) * fenster.dpr);
  report.push(`Bildschirm ${groesse[1]}×${groesse[2]} px, WebView ${fenster.w}×${fenster.h} CSS-Pixel, devicePixelRatio ${fenster.dpr}, Statusleiste ${statusHoehe} px hoch (safe-area-inset-top ${fenster.oben} CSS-Pixel)`);

  // 3. System hell: Hell, Dunkel und Schwarz über die Vorschaukarten in Einstellungen → Darstellung
  report.push("System-Design hell:");
  await tippe(nav("Einstellungen"), "„Einstell.“ in der Navigationsleiste");
  await waitFor(`document.querySelector(".handy-einstellung")`, "Einstellungen");
  await tippe(`document.querySelector(".handy-einstellung")`, "Karte „Darstellung“");
  await waitFor(`document.querySelector(".darstellung.is-handy .modus-karte")`, "Darstellung");
  for (const name of ["Hell", "Dunkel", "Schwarz"]) {
    await tippe(karte(name), `Vorschaukarte „${name}“`);
    await pruefen(`system-hell-app-${name.toLowerCase()}`, `System hell, Localist „${name}“`);
  }

  // 4. System dunkel: die Symbole folgen weiter der App (Gegenprobe mit Hell), dann „Wie System“
  report.push("System-Design dunkel:");
  shell("cmd uimode night yes");
  await pruefen("system-dunkel-app-schwarz", "System dunkel, Localist „Schwarz“");
  await tippe(karte("Hell"), "Vorschaukarte „Hell“");
  await pruefen("system-dunkel-app-hell", "System dunkel, Localist „Hell“");
  await tippe(WIE_SYSTEM, "Schalter „Wie System“");
  await pruefen("system-dunkel-wie-system", "System dunkel, Localist „Wie System“");
  shell("cmd uimode night no");
  await pruefen("system-hell-wie-system", "Danach System hell, Localist „Wie System“");

  // 5. Direkt nach dem Start: gespeichert ist Schwarz, das System ist hell
  report.push("Neustart mit gespeichertem Modus „Schwarz“ bei hellem System:");
  await tippe(karte("Schwarz"), "Vorschaukarte „Schwarz“");
  report.push(`Gespeichert: theme = ${await evaluate(`localStorage.getItem("theme")`)}`);
  await sleep(5000); // Die WebView schreibt den App-Speicher verzögert auf die Platte, force-stop würde ihn sonst verwerfen.
  await starten();
  await waitFor(`document.documentElement.dataset.theme === "black" && document.querySelector('.handy-nav')`, "Oberfläche in Schwarz");
  await pruefen("start-schwarz", "Nach dem Start, Localist „Schwarz“");

  report.push(problems.length === 0 ? "Konsole: keine Fehler." : `Konsole: ${problems.length} Meldungen:\n  ${problems.join("\n  ")}`);
  report.push(fehler.length === 0 ? "Ergebnis: Die Symbole passen in allen Schritten zum Modus der App." : `Ergebnis: NICHT bestanden (${fehler.join(", ")}).`);
  if (fehler.length > 0) process.exitCode = 1;
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
  report.push(...problems);
  process.exitCode = 1;
} finally {
  shell(`cmd uimode night ${nachtVorher}`);
  console.log(report.join("\n"));
  socket?.close();
  run(["forward", "--remove", `tcp:${PORT}`], { log: false });
  console.log(`Screenshots in ${outDir}.`);
}
