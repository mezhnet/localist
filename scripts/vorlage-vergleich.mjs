// Vergleich mit der Design-Vorlage (Etappe 19): eigener Vault mit den Inhalten der Vorlage („Vault-Localist-1“,
// „AP2 Lernen“, „RAID und Speicher“ …), dieselbe Fenstergröße wie die PNGs (1200 × 767 bzw. 1200 × 1133 bei
// Faktor 1,5 = 1800 × 1150 bzw. 1800 × 1700 Pixel) und dieselbe Uhrzeit (Mo, 26.10.2026, 8:30). Macht Screenshots
// von Startseite (Hell, wie 01-…) und Notiz mit offenem Menü „Baustein wählen …“ (Schwarz, wie 02-…) in Microsoft
// Edge (unsichtbar im Hintergrund) und misst die Lage der wichtigsten Elemente in Pixeln der Vorlage (× 1,5).
//
// Etappe 20, drittes Argument `handy`: dieselben Inhalte auf dem Handy (375 × 812 bei Faktor 2,6 = 975 × 2111 Pixel
// wie 03-…, 04-… und 05-…, Android in der Vorschau): Startseite (Hell), Notiz beim Schreiben (Schwarz) und
// Einstellungen → Darstellung (Dunkel).
//
// Aufruf, während die Vorschau läuft: node scripts/vorlage-vergleich.mjs http://localhost:1430 docs/screenshots/etappe-19
//                                     node scripts/vorlage-vergleich.mjs http://localhost:1430 docs/screenshots/etappe-20 handy
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [base = "http://localhost:1430", outDir = "docs/screenshots/etappe-19", geraet = "pc"] = process.argv.slice(2);
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9400 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "localist-vorlage-"));
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
  await sleep(800);
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  const datei = join(outDir, `${name}.png`);
  writeFileSync(datei, Buffer.from(result.data, "base64"));
  return datei;
};
const maus = async (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? "none" : "left", clickCount: 1 });

const VAULT = "C:/Vaults/Vault-Localist-1";
const RAID = `---
id: 3f2a9c1e-5b7d-4e8a-9c21-7d4e6b1a0c55
Tags:
  - AP2
  - IT-Systeme
Erstellt: 2026-10-26
---
RAID verteilt Daten auf mehrere Festplatten – für mehr Tempo, mehr Ausfallsicherheit oder beides. Für die Prüfung zählen drei Dinge: Mindestanzahl der Platten, Nutzkapazität und wie viele Ausfälle ein Level verkraftet.

> [!info] **RAID ersetzt kein Backup.** Gegen versehentliches Löschen, Ransomware oder einen defekten Controller hilft nur eine getrennte Sicherung.

## RAID-Level im Vergleich

| Level | Prinzip | Min. Platten | Nutzkapazität | Verkraftet |
| --- | --- | --- | --- | --- |
| \`RAID 0\` | Striping | 2 | 100 % | keinen Ausfall |
| \`RAID 1\` | Spiegelung | 2 | 50 % | 1 Platte |
| \`RAID 5\` | Striping mit Parität | 3 | (n – 1) / n | 1 Platte |
| \`RAID 6\` | Doppelte Parität | 4 | (n – 2) / n | 2 Platten |
| \`RAID 10\` | Gespiegeltes Striping | 4 | 50 % | 1 je Spiegelpaar |

## Aufgaben für heute

- [x] RAID 0, 1, 5, 6 und 10 verstehen
- [ ] Passende Aufgaben aus dem Aufgaben-Pool lösen und mit der Lösung korrigieren
- [ ] Fehler in die Fehlerliste, 5–10 Karten zum Thema anlegen
`;
const HTML = (titel, id) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel}</title>
<meta name="localist-id" content="${id}">
<link rel="stylesheet" href=".localist/bausteine/localist.css">
<script src=".localist/bausteine/localist.js" defer></script>
</head>
<body>
<main>
<h1>${titel}</h1>
<l-callout typ="tipp">Jeden Tag eine Lernseite.</l-callout>
</main>
</body>
</html>
`;

// Vor dem Start der App: feste Uhrzeit und der Vault der Vorlage (die Vorschau hält den Vault im Arbeitsspeicher).
const VORBEREITUNG = `(() => {
  const ZIEL = new Date(2026, 9, 26, 8, 30).getTime();
  const Echt = Date;
  const versatz = ZIEL - Echt.now();
  class Fest extends Echt {
    constructor(...a) { if (a.length === 0) super(Echt.now() + versatz); else super(...a); }
    static now() { return Echt.now() + versatz; }
  }
  window.Date = Fest;
  let vault;
  Object.defineProperty(window, "__devVault", {
    configurable: true,
    get: () => vault,
    set: (v) => {
      vault = v;
      const behalten = (p) => p.startsWith(".localist/") || p.startsWith("Anhänge/") || p.startsWith("Vorlagen/");
      for (const p of [...v.files.keys()]) if (!behalten(p)) v.files.delete(p);
      for (const p of [...v.folders]) if (!behalten(p + "/")) v.folders.delete(p);
      const jetzt = Date.now();
      const datei = (p, text, minuten) => {
        v.files.set(p, text);
        const teile = p.split("/");
        for (let i = 1; i < teile.length; i++) v.folders.add(teile.slice(0, i).join("/"));
        v.setModified(p, jetzt - minuten * 60000);
      };
      datei("AP2 Lernen/RAID und Speicher.md", ${JSON.stringify(RAID)}, 0.2);
      datei("AP2-Endspurt.html", ${JSON.stringify(HTML("AP2-Endspurt", "6b0c3f7e-1d2a-4c5b-8e9f-0a1b2c3d4e5f"))}, 1.2);
      datei("AP2 Lernen/Fehlerliste/_ansichten.yaml", "eigenschaften:\\n  status:\\n    typ: status\\nansichten:\\n  - name: Tabelle\\n    typ: tabelle\\n", 7.2);
      datei("AP2 Lernen/Fehlerliste/Subnetzmaske vergessen.md", "---\\nid: 0f1e2d3c-4b5a-4968-8776-655443322110\\nstatus: Offen\\n---\\n", 7.2);
      datei("AP2 Lernen/Active Directory und Rechte.md", "---\\nid: 1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d\\n---\\nGruppen, OUs und NTFS-Rechte.\\n", 8.3);
      datei("Unbenannt 2.md", "---\\nid: 2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e\\n---\\n", 20 * 60);
      v.files.set(".localist/settings.json", JSON.stringify({ version: 1, favoriten: ["AP2-Endspurt.html", "AP2 Lernen/RAID und Speicher.md"] }, null, 2) + "\\n");
    },
  });
})();`;

/** Lädt die Vorschau mit dem Vault der Vorlage; `aktiv` = Index des aktiven Reiters (−1 = Startseite). */
async function oeffnen({ modus, hoehe, aktiv }) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: hoehe, deviceScaleFactor: 1.5, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: modus === "light" ? "light" : "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  const reiter = { reiter: [{ art: "seite", pfad: "AP2 Lernen/RAID und Speicher.md" }, { art: "seite", pfad: "AP2-Endspurt.html" }], aktiv };
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", ${JSON.stringify(VAULT)}); localStorage.setItem("theme", ${JSON.stringify(modus)});
    localStorage.setItem(${JSON.stringify(`reiter:${VAULT}`)}, ${JSON.stringify(JSON.stringify(reiter))}); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelectorAll('[role="tablist"] [role="tab"]').length === 3`);
  // Ordner „AP2 Lernen“ aufgeklappt wie in der Vorlage
  if (!(await ev(`Boolean(document.querySelector('.tree [title="AP2 Lernen/RAID und Speicher.md"]'))`))) {
    await ev(`document.querySelector('.tree [aria-label="„AP2 Lernen“ aufklappen"]').click(); true`);
  }
  await waitFor(`document.querySelector('.tree [title="AP2 Lernen/RAID und Speicher.md"]')`);
  await sleep(600);
}

/** Handy wie in den Vorlagen 03–05: 375 × 812 bei Faktor 2,6, Android in der Vorschau, ohne Reiter. */
async function oeffnenHandy({ modus }) {
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2.6, mobile: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: modus === "light" ? "light" : "dark" }, { name: "prefers-reduced-motion", value: "reduce" }] });
  await send("Page.navigate", { url: base });
  await waitFor("document.body");
  await ev(`localStorage.clear(); localStorage.setItem("dev-last-vault", ${JSON.stringify(VAULT)}); localStorage.setItem("theme", ${JSON.stringify(modus)});
    localStorage.setItem("dev-platform", "android"); true`);
  await send("Page.navigate", { url: base });
  await waitFor(`document.querySelector('.handy-nav') && document.querySelectorAll('.home-table-zeile').length >= 4`);
  await sleep(600);
}

/** Lage eines Elements in Pixeln der Vorlage (× 1,5, auf dem Handy × 2,6). */
const FAKTOR = geraet === "handy" ? 2.6 : 1.5;
const LAGE = `(sel) => { const e = typeof sel === "string" ? document.querySelector(sel) : sel; if (!e) return null; const r = e.getBoundingClientRect(); const f = (n) => Math.round(n * ${FAKTOR}); return [f(r.left), f(r.top), f(r.right), f(r.bottom)].join(","); }`;

/** Handy-Vergleiche mit 03-…, 04-… und 05-… */
async function handyVergleich(zeilen) {
  // 03: Startseite, Hell
  await oeffnenHandy({ modus: "light" });
  zeilen.push(`03 Handy-Startseite (Hell): ${await shot("vergleich-03-handy-startseite-hell")}`);
  zeilen.push(
    `   Maße (Pixel der Vorlage, links,oben,rechts,unten): ${JSON.stringify(
      await ev(`(() => { const lage = ${LAGE}; return {
        vault: lage(".home-handy-vault"), darstellung: lage('.home-handy-kopf [aria-label="Darstellung"]'), einstellungen: lage('.home-handy-kopf [aria-label="Einstellungen"]'),
        datum: lage(".home-date"), begruessung: lage(".home-greeting"), schnellNotieren: lage(".home-schnell"), plus: lage(".home-schnell-notiz"),
        zuletzt: lage(".home-zuletzt"), ersteZeile: lage(".home-table-zeile"), favoritChip: lage(".home-chip"), navigation: lage(".handy-nav"), navPlus: lage(".handy-nav-neu"),
        texte: { datum: document.querySelector(".home-date").textContent, begruessung: document.querySelector(".home-greeting").textContent,
          zeilen: [...document.querySelectorAll(".home-table-zeile")].map((z) => [...z.children].filter((s) => getComputedStyle(s).display !== "none").map((s) => s.textContent).join(" | ")),
          navigation: [...document.querySelectorAll(".handy-nav button")].map((b) => b.textContent || b.getAttribute("aria-label")) },
        farben: { hintergrund: getComputedStyle(document.querySelector(".main")).backgroundColor, karte: getComputedStyle(document.querySelector(".home-schnell")).backgroundColor,
          navigation: getComputedStyle(document.querySelector(".handy-nav")).backgroundColor, navPlus: getComputedStyle(document.querySelector(".handy-nav-neu")).backgroundColor } }; })()`),
    )}`,
  );
}

const zeilen = [];
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", { source: VORBEREITUNG });
  if (geraet === "handy") {
    await handyVergleich(zeilen);
    console.log(`Vergleich mit der Vorlage (Handy), Vorschau ${base}:`);
    console.log(zeilen.join("\n"));
  } else {

  // 01: Startseite, Hell, 1200 × 767
  await oeffnen({ modus: "light", hoehe: 767, aktiv: -1 });
  await waitFor(`document.querySelectorAll('.home-table-zeile').length >= 4`);
  zeilen.push(`01 Startseite (Hell): ${await shot("vergleich-01-startseite-hell")}`);
  zeilen.push(
    `   Maße (Pixel der Vorlage, links,oben,rechts,unten): ${JSON.stringify(
      await ev(`(() => { const lage = ${LAGE}; return {
        inhaltsflaeche: lage(".main"), reiterleiste: lage(".reiterleiste"), datum: lage(".home-date"), begruessung: lage(".home-greeting"),
        schnellNotieren: lage(".home-schnell"), notizKnopf: lage(".home-schnell-notiz"), zuletztTitel: lage(".home-section-title"),
        ersteZeile: lage(".home-table-zeile"), favoritChip: lage(".home-chip"),
        texte: { datum: document.querySelector(".home-date").textContent, begruessung: document.querySelector(".home-greeting").textContent,
          zeilen: [...document.querySelectorAll(".home-table-zeile")].map((z) => [...z.children].map((s) => s.textContent).join(" | ")) } }; })()`),
    )}`,
  );

  // 02: Notiz „RAID und Speicher“, Schwarz, 1200 × 1133, Menü „Baustein wählen …“ über „+“ unter der Checkliste
  await oeffnen({ modus: "black", hoehe: 1133, aktiv: 0 });
  await waitFor(`document.querySelector('.bn-editor [data-content-type="table"] table') && document.querySelectorAll('[data-content-type="checkListItem"]').length === 3`);
  const letzte = await ev(`(() => { const r = [...document.querySelectorAll('[data-content-type="checkListItem"]')].pop().getBoundingClientRect(); return { x: r.left + 120, y: r.top + r.height / 2 }; })()`);
  await maus("mouseMoved", letzte.x, letzte.y);
  await sleep(500);
  const plus = await ev(`(() => { const b = document.querySelector('[data-test="dragHandleAdd"]').closest('button'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await maus("mousePressed", plus.x, plus.y);
  await maus("mouseReleased", plus.x, plus.y);
  await waitFor(`document.querySelector('.baustein-menu')`);
  // Den markierten Eintrag wie in der Vorlage auf „Checkliste“ setzen (Pfeiltaste nach unten, zweimal)
  for (let i = 0; i < 2; i++) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
  }
  await maus("mouseMoved", plus.x + 60, plus.y);
  zeilen.push(`02 Notiz mit Menü „Baustein wählen …“ (Schwarz): ${await shot("vergleich-02-notiz-schwarz")}`);
  zeilen.push(
    `   Maße (Pixel der Vorlage, links,oben,rechts,unten): ${JSON.stringify(
      await ev(`(() => { const lage = ${LAGE}; return {
        pfad: lage(".breadcrumb"), status: lage(".speicherstatus"), titel: lage(".page-title"), eigenschaften: lage(".properties"),
        ersterAbsatz: lage('.bn-editor [data-content-type="paragraph"]'), callout: lage(".callout-frame"), tabelle: lage('.bn-editor [data-content-type="table"] table'),
        checkliste: lage('[data-content-type="checkListItem"]'), menue: lage(".baustein-menu"), plus: lage('.bn-side-menu .bn-button'),
        markiert: document.querySelector(".baustein-menu-eintrag.is-markiert .baustein-menu-titel")?.textContent }; })()`),
    )}`,
  );
  console.log(`Vergleich mit der Vorlage, Vorschau ${base}:`);
  console.log(zeilen.join("\n"));
  }
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
