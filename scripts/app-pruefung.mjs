// Prüft die gebaute localist.exe mit ihrer echten CSP: öffnet Notiz, Datenbank und HTML-Seite, sammelt
// CSP-Verstöße und Fehler aus der Konsole, prüft Strg+P und einen Link aus der HTML-Seite und speichert Screenshots.
// Die App wird mit `--vault <Kopie>` gestartet, merkt sich diesen Vault also nicht. Die WebView2-Entwickler-
// schnittstelle wird über WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS nur für diesen Start eingeschaltet.
//
// Aufruf: node scripts/app-pruefung.mjs <localist.exe> <Vault-Kopie> <Screenshot-Ordner>
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [exe, vault, outDir] = process.argv.slice(2);
if (!exe || !vault || !outDir) {
  console.error("Aufruf: node scripts/app-pruefung.mjs <localist.exe> <Vault-Kopie> <Screenshot-Ordner>");
  process.exit(2);
}
const PORT = 9336;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(outDir, { recursive: true });

// Eigener WebView2-Datenordner: So stört die Prüfung keine laufende Localist-App (WebView2 erlaubt sonst
// keine zweite Instanz mit anderen Startparametern) und hinterlässt nichts im Datenordner der echten App.
const webviewData = mkdtempSync(join(tmpdir(), "localist-pruefung-webview-"));
// Ziel für den Export (Etappe 14): ein leerer Ordner außerhalb des Vaults
const exportDir = mkdtempSync(join(tmpdir(), "localist-pruefung-export-"));
const app = spawn(exe, ["--vault", vault], {
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`, WEBVIEW2_USER_DATA_FOLDER: webviewData },
  stdio: "ignore",
});

let target;
for (let i = 0; i < 150 && !target; i++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = targets.find((t) => t.type === "page" && t.url.includes("tauri.localhost"));
  } catch {
    // App startet noch.
  }
  await sleep(200);
}
if (!target) {
  console.error("Die App hat keine Entwicklerschnittstelle geöffnet.");
  app.kill();
  process.exit(2);
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => (socket.onopen = resolve));
let nextId = 1;
const pending = new Map();
const problems = [];
/** Ausführungskontexte der Frames (frameId → contextId); das iframe hat einen undurchsichtigen Ursprung. */
const contexts = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    problems.push(`${message.params.entry.source}: ${message.params.entry.text}`);
  } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    problems.push(`console.error: ${message.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  } else if (message.method === "Runtime.exceptionThrown") {
    problems.push(`Ausnahme: ${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}`);
  } else if (message.method === "Runtime.executionContextCreated") {
    const context = message.params.context;
    if (context.auxData?.isDefault && context.auxData.frameId) contexts.set(context.auxData.frameId, context.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression, contextId) => {
  const answer = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) });
  return answer.result?.result?.value;
};
const waitFor = async (expression, what) => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate(`Boolean(${expression})`)) return true;
    await sleep(150);
  }
  throw new Error(`Nicht erschienen: ${what}`);
};
const shot = async (name) => {
  await sleep(600);
  const answer = await send("Page.captureScreenshot", { format: "png" });
  const file = join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(answer.result.data, "base64"));
  return file;
};
const click = async (x, y) => {
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
};

const report = [];
try {
  await send("Log.enable");
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await waitFor(`document.querySelector('[role="tree"] .tree-row')`, "Ordnerbaum");
  report.push(`App gestartet: ${await evaluate("location.href")}, Vault „${await evaluate("document.querySelector('.vault-name').textContent")}“`);

  // Notiz
  await evaluate(`document.querySelector('.tree [title="Notizen"]').click()`);
  await waitFor(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`, "Notizen aufgeklappt");
  await evaluate(`document.querySelector('.tree [title="Notizen/Ideen.md"]').click()`);
  await waitFor(`document.querySelector('.bn-editor') && document.body.textContent.includes("Hier sammle ich lose Gedanken.")`, "Notiz Ideen");
  report.push(`Notiz „Ideen“ geöffnet: ${await shot("app-notiz")}`);

  // Datenbank
  await evaluate(`document.querySelector('.tree [title="Projekte"]').click()`);
  await waitFor(`document.querySelectorAll('.database-table tbody tr').length >= 2`, "Tabelle Projekte");
  report.push(`Datenbank „Projekte“ geöffnet (${await evaluate("document.querySelectorAll('.database-table tbody tr').length")} Zeilen): ${await shot("app-datenbank")}`);

  // HTML-Seite
  await evaluate(`document.querySelector('.tree [title="Notizen/DNS.html"]').click()`);
  await waitFor(`document.querySelector('iframe.html-frame') && document.querySelector('.html-preview').style.height`, "HTML-Seite mit gemeldeter Höhe");
  const frameInfo = await evaluate(`(() => { const f = document.querySelector('iframe.html-frame'); const r = f.getBoundingClientRect(); return { src: f.src, sandbox: f.getAttribute('sandbox'), hoehe: document.querySelector('.html-preview').style.height, x: r.x, y: r.y }; })()`);
  report.push(`HTML-Seite „DNS“ geöffnet: src ${frameInfo.src}, sandbox="${frameInfo.sandbox}", Höhe von der Brücke ${frameInfo.hoehe}`);
  // Im iframe nachsehen (eigener Ausführungskontext): Bild aus dem Vault geladen? Kein Tauri?
  await sleep(500);
  // Das iframe läuft durch Site Isolation in einem eigenen Prozess: eigene Verbindung über die Zielliste.
  const frameTarget = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.url.includes("DNS.html"));
  const frameSocket = frameTarget && new WebSocket(frameTarget.webSocketDebuggerUrl);
  if (frameSocket) await new Promise((resolve) => (frameSocket.onopen = resolve));
  const inside = frameSocket
    ? async (expression) => {
        const answer = await new Promise((resolve) => {
          frameSocket.onmessage = (event) => resolve(JSON.parse(event.data));
          frameSocket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
        });
        return answer.result?.result?.value;
      }
    : null;
  if (inside) {
    const state = await inside(
      `({ bildBreite: document.querySelector('img')?.naturalWidth, tauri: typeof window.__TAURI_INTERNALS__, ipc: typeof window.ipc, ursprung: String(window.origin), link: (() => { const r = document.querySelector('a[href="Ideen.md"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })() })`,
    );
    frameSocket.close();
    report.push(`Im iframe: Bild aus dem Vault ${state.bildBreite > 0 ? `geladen (${state.bildBreite} px breit)` : "NICHT geladen"}, __TAURI_INTERNALS__: ${state.tauri}, window.ipc: ${state.ipc}, Ursprung: ${state.ursprung}`);
    await shot("app-html-seite");

    // Strg+P, während die Seite den Fokus hat
    await click(frameInfo.x + 20, frameInfo.y + 20);
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, modifiers: 2 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "p", code: "KeyP", windowsVirtualKeyCode: 80, modifiers: 2 });
    const quick = await waitFor(`document.querySelector('[role="dialog"][aria-label="Schnellsuche"]')`, "Schnellsuche nach Strg+P in der Seite").catch(() => false);
    report.push(`Strg+P mit Fokus in der HTML-Seite öffnet die Schnellsuche der App: ${quick ? "ja" : "NEIN"}`);
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(300);

    // Klick auf den Link „Ideen“ in der Seite öffnet die Notiz in der App (vorher ins Bild scrollen)
    await evaluate(`document.querySelector('.main').scrollTop += ${Math.round(frameInfo.y + state.link.y - 400)}`);
    await sleep(300);
    const frameTop = await evaluate(`document.querySelector('iframe.html-frame').getBoundingClientRect().y`);
    await click(frameInfo.x + state.link.x, frameTop + state.link.y);
    const opened = await waitFor(`document.querySelector('.page-title')?.value === "Ideen"`, "Notiz nach Linkklick").catch(() => false);
    report.push(`Klick auf den Link „Ideen“ in der HTML-Seite öffnet die Notiz in der App: ${opened ? "ja" : "NEIN"}`);
  } else {
    report.push("Das iframe wurde in der Zielliste nicht gefunden.");
  }

  // Code-Editor (Etappe 11): „Code“ und „Geteilt“ unter der CSP der App
  const pickMode = (name) => evaluate(`[...document.querySelectorAll('[aria-label="Ansicht (Strg+E)"] button')].find((b) => b.textContent === "${name}")?.click()`);
  {
    await evaluate(`document.querySelector('.tree [title="Notizen/DNS.html"]').click()`);
    await waitFor(`document.querySelector('[aria-label="Ansicht (Strg+E)"]')`, "HTML-Seite");
    await pickMode("Code");
    const code = await waitFor(`document.querySelector('.cm-editor .cm-line') && document.querySelector('.cm-lineNumbers')`, "Code-Editor").catch(() => false);
    report.push(`Ansicht „Code“: CodeMirror mit Zeilennummern ${code ? "läuft" : "läuft NICHT"}: ${await shot("app-code")}`);
    await pickMode("Geteilt");
    const split = await waitFor(`document.querySelector('.html-workspace.is-geteilt .cm-editor') && document.querySelector('.html-workspace.is-geteilt iframe.html-frame')`, "Geteilt").catch(() => false);
    report.push(`Ansicht „Geteilt“: Editor und Vorschau ${split ? "nebeneinander" : "NICHT da"}: ${await shot("app-geteilt")}`);
    await pickMode("Lesen");
  }

  // Bausteine (Etappe 12): Dateien im Vault, Stift-Symbol mit echter Maus, Häkchen landet in der Datei
  {
    const firstLine = (text) => text.split("\n")[0];
    const imVault = readFileSync(join(vault, ".localist/bausteine/localist.css"), "utf8");
    const gebuendelt = readFileSync("src-tauri/seite/localist.css", "utf8");
    report.push(`Vault geöffnet → .localist/bausteine/localist.css: ${imVault === gebuendelt ? "gleich der gebündelten Fassung" : "WEICHT AB"}, ${firstLine(imVault).slice(0, 60)}…`);
    const jsGleich = readFileSync(join(vault, ".localist/bausteine/localist.js"), "utf8") === readFileSync("src-tauri/seite/localist.js", "utf8");
    report.push(`Vault geöffnet → .localist/bausteine/localist.js: ${jsGleich ? "gleich der gebündelten Fassung" : "WEICHT AB"}`);

    await evaluate(`document.querySelector('.tree [title="Lernen"]').click()`);
    await waitFor(`document.querySelector('.tree [title="Lernen/Bausteine.html"]')`, "Lernen aufgeklappt");
    await evaluate(`document.querySelector('.tree [title="Lernen/Bausteine.html"]').click()`);
    await waitFor(`document.querySelector('iframe.html-frame') && document.querySelector('.html-preview').style.height`, "Bausteine.html in „Lesen“");
    await sleep(800);
    const bausteineTarget = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.url.includes("Bausteine.html"));
    const inPage = async (expression) => {
      const pageSocket = new WebSocket(bausteineTarget.webSocketDebuggerUrl);
      await new Promise((resolve) => (pageSocket.onopen = resolve));
      const answer = await new Promise((resolve) => {
        pageSocket.onmessage = (event) => resolve(JSON.parse(event.data));
        pageSocket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
      });
      pageSocket.close();
      return answer.result?.result?.value;
    };
    const look = await inPage(
      `document.fonts.ready.then(() => ({ version: document.documentElement.getAttribute("data-localist-bausteine"), schrift: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")).filter((n, i, a) => a.indexOf(n) === i).join(" + "), callout: getComputedStyle(document.querySelector("l-callout")).backgroundColor, sprache: document.querySelector("pre").getAttribute("data-sprache") }))`,
    );
    report.push(`In der Seite: Bausteine ${look.version}, Schriften geladen: ${look.schrift || "KEINE"}, Callout-Hintergrund ${look.callout}, Code-Beschriftung „${look.sprache}“`);

    const rect = (selector) => inPage(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, width: r.width, height: r.height }; })()`);
    const frameAt = () => evaluate(`(() => { const r = [...document.querySelectorAll('iframe.html-frame')].find((f) => !f.classList.contains('is-loading')).getBoundingClientRect(); return { x: r.x, y: r.y }; })()`);
    const scrollTo = async (selector) => {
      const inner = await rect(selector);
      const frame = await frameAt();
      await evaluate(`document.querySelector('.main').scrollTop += ${Math.round(frame.y + inner.y - 200)}`);
      await sleep(300);
      return { inner: await rect(selector), frame: await frameAt() };
    };

    // Stift: Maus über den ersten Callout, dann auf den Stift oben rechts klicken
    const callout = await scrollTo("l-callout");
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: callout.frame.x + callout.inner.x + 80, y: callout.frame.y + callout.inner.y + 12 });
    await sleep(400);
    const stiftX = callout.frame.x + callout.inner.right - 18;
    const stiftY = callout.frame.y + callout.inner.y + 18;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: stiftX, y: stiftY });
    await sleep(200);
    const vorStift = await shot("app-stift");
    await click(stiftX, stiftY);
    const formular = await waitFor(`document.querySelector('[role="dialog"][aria-label="Callout bearbeiten"]')`, "Formular nach Klick auf den Stift").catch(() => false);
    report.push(`Stift-Symbol am Callout (echte Maus in WebView2): ${vorStift}; Klick öffnet das Formular: ${formular ? "ja" : "NEIN"}`);
    if (formular) {
      const text = await evaluate(`document.querySelector('[role="dialog"] textarea').value`);
      report.push(`Formular zeigt den Text aus der Datei: „${text}“: ${await shot("app-formular")}`);
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await sleep(300);
    }

    // Häkchen: echter Klick auf das zweite Kästchen der Checkliste, danach steht „checked“ in der Datei
    const datei = join(vault, "Lernen/Bausteine.html");
    const vorher = readFileSync(datei, "utf8");
    const box = await scrollTo("ul.l-checkliste > li:nth-child(2) > input");
    await click(box.frame.x + box.inner.x + box.inner.width / 2, box.frame.y + box.inner.y + box.inner.height / 2);
    let nachher = vorher;
    for (let i = 0; i < 30 && nachher === vorher; i++) {
      await sleep(200);
      nachher = readFileSync(datei, "utf8");
    }
    const erwartet = vorher.replace('<input type="checkbox"> Eine eigene Lernseite anlegen', '<input type="checkbox" checked> Eine eigene Lernseite anlegen');
    report.push(`Häkchen in „Lesen“ gesetzt (echter Klick): Datei ${nachher === erwartet ? "geändert, nur diese Stelle (checked ergänzt)" : nachher === vorher ? "NICHT geändert" : "ANDERS geändert"}: ${await shot("app-haekchen")}`);

    // Etappe 13: Lern-Bausteine mit echten Klicks in der Seite
    const mitte = async (selector) => {
      const { inner, frame } = await scrollTo(selector);
      return { x: frame.x + inner.x + inner.width / 2, y: frame.y + inner.y + inner.height / 2 };
    };
    const lern = await inPage(
      `({ karten: document.querySelectorAll("l-karteikarte").length, diagramme: document.querySelectorAll("l-diagramm[data-gezeichnet] > svg").length, stapel: document.querySelector(".l-stapel-zaehler")?.textContent, quiz: document.querySelector(".l-quiz-punkte")?.textContent })`,
    );
    report.push(`Lern-Bausteine: ${lern.karten} Karteikarten, Kartenstapel „${lern.stapel}“, Quiz „${lern.quiz}“, ${lern.diagramme} Diagramme als SVG gezeichnet`);
    let punkt = await mitte("main > l-karteikarte");
    await click(punkt.x, punkt.y);
    await sleep(300);
    const umgedreht = await inPage(`document.querySelector("main > l-karteikarte").hasAttribute("data-umgedreht")`);
    punkt = await mitte("l-kartenstapel > l-karteikarte:not([hidden])");
    await click(punkt.x, punkt.y);
    await sleep(300);
    const knopf = await inPage(`(() => { const b = [...document.querySelectorAll("l-kartenstapel button")].find((b) => b.textContent === "Gewusst"); b.id = "pruef-knopf"; return !b.disabled; })()`);
    punkt = await mitte("#pruef-knopf");
    await click(punkt.x, punkt.y);
    await sleep(300);
    const stapelNachher = await inPage(`document.querySelector(".l-stapel-zaehler").textContent`);
    punkt = await mitte("l-quizfrage li:nth-child(2)");
    await click(punkt.x, punkt.y);
    await sleep(300);
    const quizNachher = await inPage(`[document.querySelector(".l-quiz-punkte").textContent, document.querySelector(".l-quiz-rueckmeldung").textContent]`);
    report.push(
      `Echte Klicks: Karteikarte umgedreht: ${umgedreht ? "ja" : "NEIN"}; Kartenstapel nach Umdrehen ${knopf ? "bewertbar" : "NICHT bewertbar"}, nach „Gewusst“: „${stapelNachher}“; Quiz nach Klick auf „32“: „${quizNachher[1]}“, „${quizNachher[0]}“: ${await shot("app-lernen")}`,
    );

    // Bereich „Bausteine“: Bibliothek über das Schema, mit den eigenen Bausteinen des Vaults
    await evaluate(`[...document.querySelectorAll('.sidebar-item')].find((b) => b.textContent.trim() === "Bausteine").click()`);
    await waitFor(`document.querySelector('.bibliothek-vorschau iframe')`, "Bibliothek");
    await sleep(1500);
    const bibliothekTarget = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.url.includes("bibliothek.html"));
    const bibliothek = bibliothekTarget
      ? await new Promise((resolve) => {
          const s = new WebSocket(bibliothekTarget.webSocketDebuggerUrl);
          s.onopen = () =>
            s.send(
              JSON.stringify({
                id: 1,
                method: "Runtime.evaluate",
                params: { expression: `({ eintraege: document.querySelectorAll("section.eintrag").length, eigene: [...document.querySelectorAll("section[id^=eigen-] h2")].map((h) => h.textContent), url: location.href })`, returnByValue: true },
              }),
            );
          s.onmessage = (event) => {
            resolve(JSON.parse(event.data).result?.result?.value);
            s.close();
          };
        })
      : null;
    report.push(
      bibliothek
        ? `Bibliothek (${bibliothek.url}): ${bibliothek.eintraege} Einträge mit Vorschau, eigene Bausteine aus dem Vault: ${bibliothek.eigene.join(", ")}: ${await shot("app-bibliothek")}`
        : "Bibliothek: iframe NICHT gefunden",
    );

    // Eigenen Baustein aus markiertem Code speichern (Rust-Befehl schreibt die Datei)
    await evaluate(`document.querySelector('.tree [title="Notizen/DNS.html"]').click()`);
    await waitFor(`document.querySelector('[aria-label="Ansicht (Strg+E)"]')`, "HTML-Seite DNS");
    await pickMode("Code");
    await waitFor(`document.querySelector('.cm-editor .cm-line') && document.querySelector('.baustein-leiste')`, "Code-Ansicht");
    await evaluate(`(() => {
      const content = document.querySelector('.cm-content');
      content.focus();
      const zeile = [...content.querySelectorAll('.cm-line')].find((l) => l.textContent.startsWith('<l-callout'));
      const range = document.createRange();
      range.selectNodeContents(zeile);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    })()`);
    await sleep(300);
    await evaluate(`[...document.querySelectorAll('.baustein-leiste button')].find((b) => b.textContent.includes("Als Baustein speichern")).click()`);
    await waitFor(`document.querySelector('[role="dialog"][aria-label="Als eigenen Baustein speichern"]')`, "Dialog eigener Baustein");
    await evaluate(`(() => { const set = (label, value) => { const input = document.querySelector('[role="dialog"] [aria-label="' + label + '"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }; set("Name", "App-Test"); set("Beschreibung", "Gespeichert in der gebauten App"); })()`);
    await evaluate(`[...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === "Speichern").click()`);
    const eigenDatei = join(vault, ".localist/bausteine/eigene/App-Test.html");
    let eigenInhalt = null;
    for (let i = 0; i < 30 && eigenInhalt === null; i++) {
      await sleep(200);
      try {
        eigenInhalt = readFileSync(eigenDatei, "utf8");
      } catch {
        // noch nicht geschrieben
      }
    }
    const inLeiste = await waitFor(`[...document.querySelectorAll('.baustein-leiste button')].some((b) => b.textContent === "App-Test")`, "neuer Baustein in der Werkzeugleiste").catch(() => false);
    report.push(
      `Eigener Baustein aus markiertem Code gespeichert: ${eigenInhalt ? JSON.stringify(eigenInhalt.split("\n").slice(0, 2).join("\n")) : "NICHT geschrieben"}; in der Werkzeugleiste: ${inLeiste ? "ja" : "NEIN"}: ${await shot("app-eigener-baustein")}`,
    );
    await pickMode("Lesen");
  }

  // Etappe 14: Notizbuch (Notiz fertig dargestellt über das Schema), Umwandeln und Export mit den echten Dialogen
  const inFrame = async (urlPart, expression) => {
    const ziel = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "iframe" && t.url.includes(urlPart));
    if (!ziel) return null;
    return new Promise((resolve) => {
      const s = new WebSocket(ziel.webSocketDebuggerUrl);
      s.onopen = () => s.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
      s.onmessage = (event) => {
        resolve(JSON.parse(event.data).result?.result?.value);
        s.close();
      };
    });
  };
  /** Beantwortet einen Dialog der App über scripts/dialog-bedienen.ps1 (nur Fenster dieses Prozesses). */
  const dialog = (...args) => {
    const ergebnis = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/dialog-bedienen.ps1", "-ProzessId", String(app.pid), ...args], { encoding: "utf8" });
    return { ok: ergebnis.status === 0, text: (ergebnis.stdout || ergebnis.stderr).trim() };
  };
  const menue = async (seite, punkt) => {
    await evaluate(`document.querySelector('[aria-label="Aktionen für „${seite}“"]').click()`);
    await waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.includes(${JSON.stringify(punkt)}))`, `Menüpunkt ${punkt}`);
    await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.includes(${JSON.stringify(punkt)})).click()`);
  };
  const NOTIZBUCH = `document.querySelector('.notizbuch-inhaltsseite iframe.html-frame:not(.is-loading)') && document.querySelector('.notizbuch-inhaltsseite .html-preview').style.height`;
  await evaluate(`document.querySelector('.tree [title="Lernen"]').click()`);
  await waitFor(NOTIZBUCH, "Notizbuch mit dargestellter Notiz");
  await sleep(1000);
  const notizbuch = {
    titel: await evaluate(`document.querySelector('.notizbuch-kopf h1').textContent`),
    inhalt: await evaluate(`[...document.querySelectorAll('.notizbuch-eintrag')].map((b) => b.textContent)`),
    iframe: await evaluate(`(() => { const f = document.querySelector('.notizbuch-inhaltsseite iframe.html-frame:not(.is-loading)'); return { src: f.src, sandbox: f.getAttribute('sandbox') }; })()`),
  };
  const notizImFrame = await inFrame(
    "Subnetting.md",
    `({ callout: document.querySelector("l-callout")?.getAttribute("typ"), toggle: document.querySelector("details > summary")?.textContent, tabellenzeilen: document.querySelectorAll("table tr").length, checkliste: document.querySelectorAll("ul.l-checkliste input").length, bausteine: document.documentElement.getAttribute("data-localist-bausteine"), tauri: typeof window.__TAURI_INTERNALS__ })`,
  );
  report.push(`Notizbuch „${notizbuch.titel}“: Inhaltsverzeichnis ${JSON.stringify(notizbuch.inhalt)}, Seite ${notizbuch.iframe.src} (sandbox="${notizbuch.iframe.sandbox}"), Notiz fertig dargestellt: ${JSON.stringify(notizImFrame)}: ${await shot("app-notizbuch")}`);
  await evaluate(`[...document.querySelectorAll('.notizbuch-blaettern button')].find((b) => b.textContent.startsWith("Weiter")).click()`);
  await waitFor(`${NOTIZBUCH} && document.querySelector('.notizbuch-inhaltsseite iframe.html-frame:not(.is-loading)').src.includes("Bausteine.html")`, "nächste Seite im Notizbuch");
  report.push(`„Weiter“ blättert zu ${await evaluate(`document.querySelector('.notizbuch-leiste h2').textContent`)}, „Zurück“: ${await evaluate(`document.querySelector('.notizbuch-blaettern button').textContent`)}`);

  // „In HTML-Seite umwandeln“: Rückfrage der App mit „Ja“ beantworten
  await evaluate(`document.querySelector('.tree [title="Notizen/Formatierung.md"]') || document.querySelector('.tree [title="Notizen"]').click()`);
  await waitFor(`document.querySelector('[aria-label="Aktionen für „Formatierung“"]')`, "Formatierung im Ordnerbaum");
  await menue("Formatierung", "In HTML-Seite umwandeln");
  report.push(`Rückfrage: ${dialog("-Titel", "In HTML-Seite umwandeln", "-Knopf", "Ja").text}`);
  const htmlDatei = join(vault, "Notizen", "Formatierung.html");
  for (let i = 0; i < 50 && !existsSync(htmlDatei); i++) await sleep(200);
  await waitFor(`document.querySelector('[aria-label="Ansicht (Strg+E)"]') && document.querySelector('.tree [title="Notizen/Formatierung.html"]')`, "umgewandelte Seite geöffnet");
  const umgewandelt = existsSync(htmlDatei) ? readFileSync(htmlDatei, "utf8") : "";
  report.push(
    `Umgewandelt: Formatierung.html ${umgewandelt ? `geschrieben (${umgewandelt.length} Zeichen, <title>${/<title>(.*?)<\/title>/.exec(umgewandelt)?.[1]}</title>, ${(umgewandelt.match(/<(h[1-3]|ul|ol|table|blockquote|pre|l-callout|details)\b/g) ?? []).length} Blöcke)` : "NICHT geschrieben"}, Formatierung.md im Vault: ${existsSync(join(vault, "Notizen", "Formatierung.md")) ? "NOCH DA" : "entfernt (Papierkorb)"}, Hinweis: „${await evaluate(`document.querySelector('.notice')?.textContent ?? ""`)}“: ${await shot("app-umgewandelt")}`,
  );

  // „Als HTML-Datei exportieren“: Speichern-Dialog ausfüllen, Datei landet außerhalb des Vaults
  const exportDatei = join(exportDir, "Bausteine.html");
  await evaluate(`document.querySelector('.tree [title="Lernen/Bausteine.html"]') || document.querySelector('.tree [title="Lernen"]').click()`);
  await waitFor(`document.querySelector('[aria-label="Aktionen für „Bausteine“"]')`, "Bausteine im Ordnerbaum");
  await menue("Bausteine", "Als HTML-Datei exportieren");
  report.push(`Export: ${dialog("-Titel", "Als HTML-Datei exportieren", "-Dateiname", exportDatei).text}`);
  for (let i = 0; i < 50 && !existsSync(exportDatei); i++) await sleep(200);
  const exportiert = existsSync(exportDatei) ? readFileSync(exportDatei, "utf8") : "";
  report.push(
    exportiert
      ? `Exportierte Datei ${exportDatei}: ${exportiert.length} Zeichen, CSS eingebettet: ${exportiert.includes("<style>\n/*! Localist-Bausteine") ? "ja" : "NEIN"}, Skript eingebettet: ${/<script>\n\/\*! Localist-Bausteine/.test(exportiert) ? "ja" : "NEIN"}, Bild als data:-URL: ${exportiert.includes('src="data:image/svg+xml;base64,') ? "ja" : "NEIN"}, Verweise in den Vault: ${(exportiert.match(/\.localist\//g) ?? []).length}`
      : `Exportierte Datei ${exportDatei}: NICHT geschrieben`,
  );
  await sleep(500);
  report.push(`Hinweis nach dem Export: „${await evaluate(`document.querySelector('.notice')?.textContent ?? ""`)}“`);

  // Etappe 17: „Im Explorer öffnen“ (echter Rechtsklick auf Seite und Ordner, Menü „…“, Menü „Vault“). Welches
  // Explorer-Fenster welchen Ordner zeigt und was darin markiert ist, liest scripts/explorer-pruefen.ps1 aus.
  const explorer = (...args) => {
    const ergebnis = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/explorer-pruefen.ps1", ...args], { encoding: "utf8" });
    return `${ergebnis.status === 0 ? "ja" : "NEIN"} – ${(ergebnis.stdout || ergebnis.stderr).trim()}`;
  };
  const rechtsklick = async (selector) => {
    const r = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({ block: "center" }); const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r.x, y: r.y, button: type === "mouseMoved" ? "none" : "right", clickCount: 1 });
  };
  const menuepunkt = async (punkt) => {
    await waitFor(`[...document.querySelectorAll('[role="menuitem"]')].some((m) => m.textContent.trim() === ${JSON.stringify(punkt)})`, `Menüpunkt ${punkt}`);
    await evaluate(`[...document.querySelectorAll('[role="menuitem"]')].find((m) => m.textContent.trim() === ${JSON.stringify(punkt)}).click()`);
  };
  await evaluate(`document.querySelector('.tree [title="Notizen/Ideen.md"]') || document.querySelector('.tree [title="Notizen"]').click()`);
  await waitFor(`document.querySelector('.tree [title="Notizen/Ideen.md"]')`, "Ideen im Ordnerbaum");
  await rechtsklick('.tree [title="Notizen/Ideen.md"]');
  await menuepunkt("Im Explorer öffnen");
  report.push(`Im Explorer öffnen, Rechtsklick auf die Notiz „Ideen“: ${explorer("-Ordner", resolve(vault, "Notizen"), "-Datei", "Ideen.md", "-Schliessen")}`);
  await menue("DNS", "Im Explorer öffnen");
  report.push(`Im Explorer öffnen, Menü der HTML-Seite „DNS“: ${explorer("-Ordner", resolve(vault, "Notizen"), "-Datei", "DNS.html", "-Schliessen")}`);
  await rechtsklick('.tree [title="Projekte"]');
  await menuepunkt("Im Explorer öffnen");
  report.push(`Im Explorer öffnen, Rechtsklick auf den Ordner „Projekte“: ${explorer("-Ordner", resolve(vault, "Projekte"), "-Schliessen")}`);
  await evaluate(`document.querySelector('.vault-switcher').click()`);
  await menuepunkt("Vault im Explorer öffnen");
  report.push(`Menü „Vault“ → „Vault im Explorer öffnen“: ${explorer("-Ordner", resolve(vault), "-Schliessen")}`);
  report.push(`Fehlermeldung nach „Im Explorer öffnen“: ${await evaluate(`document.querySelector('.notice[role="alert"]')?.textContent ?? "keine"`)}`);

  report.push(problems.length === 0 ? "Konsole: keine Fehler und keine CSP-Verstöße." : `Konsole: ${problems.length} Meldungen:\n  ${problems.join("\n  ")}`);
} catch (error) {
  report.push(`FEHLER: ${error.message}`);
  report.push(...problems);
} finally {
  console.log(report.join("\n"));
  socket.close();
  app.kill(); // beendet nur die hier gestartete Prüf-App
  await sleep(1000);
  rmSync(webviewData, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  rmSync(exportDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
