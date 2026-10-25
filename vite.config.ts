import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { bausteineBauen } from "./src/bausteine/bauen.ts";
import { BIBLIOTHEK_PFAD, bibliothekSeite, bibliothekVorlage } from "./src/lib/bibliothek.ts";
import { EIGENE_DIR, eigenerBausteinLesen } from "./src/lib/eigene-bausteine.ts";
import { bundledBaustein, contentType, injectBridge, requestToRel, schemeHeaders } from "./src/lib/seiten-schema.ts";
const host = process.env.TAURI_DEV_HOST;

/** Ordner mit CSP, Brücken-Skript und Bausteinen – dieselben Dateien nutzt src-tauri/src/page_scheme.rs. */
const SEITE = "src-tauri/seite";
const PAGE_PREFIX = "/__localist-seite/";

/**
 * Erzeugt localist.css und localist.js aus src/styles/tokens.css und src/bausteine/ (beim Build vor dem
 * Rust-Teil, in der Vorschau beim Start und bei jeder Änderung). Ziel: src-tauri/seite/ (von dort bündelt die
 * App sie) und beispiel-vault/.localist/bausteine/ (damit der Beispiel-Vault auch per Doppelklick funktioniert).
 * Geschrieben wird nur, wenn sich etwas geändert hat. In Tests nicht: Dort prüft ein Test, dass alles aktuell ist.
 */
function localistBausteine(): Plugin {
  /** Schrift Inter (SIL Open Font License 1.1), wird in localist.css eingebettet. */
  const INTER = "node_modules/@fontsource-variable/inter";
  const quellen = (ext: string) =>
    Object.fromEntries(
      (readdirSync("src/bausteine") as string[]).filter((name) => name.endsWith(ext)).map((name) => [name, readFileSync(`src/bausteine/${name}`, "utf8") as string]),
    );
  const erzeugen = () => {
    const gebaut = bausteineBauen({
      appVersion: JSON.parse(readFileSync("package.json", "utf8")).version,
      tokens: readFileSync("src/styles/tokens.css", "utf8"),
      css: quellen(".css"),
      js: quellen(".js"),
      schrift: {
        base64: readFileSync(`${INTER}/files/inter-latin-wght-normal.woff2`).toString("base64"),
        lizenz: readFileSync(`${INTER}/LICENSE`, "utf8"),
      },
    });
    // Vorlage der Bibliotheksseite (eingebaute Bausteine mit Beispiel), nur für das Schema der App
    const vorlage = bibliothekVorlage();
    if (!existsSync(`${SEITE}/bibliothek.html`) || readFileSync(`${SEITE}/bibliothek.html`, "utf8") !== vorlage) writeFileSync(`${SEITE}/bibliothek.html`, vorlage);
    for (const dir of [SEITE, "beispiel-vault/.localist/bausteine"]) {
      mkdirSync(dir, { recursive: true });
      for (const [name, text] of [
        ["localist.css", gebaut.css],
        ["localist.js", gebaut.js],
      ]) {
        const file = `${dir}/${name}`;
        if (!existsSync(file) || readFileSync(file, "utf8") !== text) writeFileSync(file, text);
      }
    }
  };
  return {
    name: "localist-bausteine",
    apply: () => !process.env.VITEST,
    buildStart: erzeugen,
    configureServer(server) {
      server.watcher.add(["src/bausteine", "src/styles/tokens.css"]);
      const onChange = (file: string) => {
        if (/src[\\/](bausteine[\\/][^\\/]+\.(css|js)|styles[\\/]tokens\.css|lib[\\/](bausteine|bibliothek)\.ts)$/.test(file)) erzeugen();
      };
      server.watcher.on("change", onChange);
      server.watcher.on("add", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}

/**
 * Browser-Vorschau für HTML-Seiten (Arbeitsregel 8): liefert `beispiel-vault/` unter /__localist-seite/ mit
 * denselben Regeln und Kopfzeilen aus wie das Schema `localist-seite` der App. Seiten, die in der Vorschau
 * angelegt oder geändert werden, meldet dev-backend.ts über /__localist-dev/datei; sie bleiben nur im
 * Arbeitsspeicher, die Dateien in beispiel-vault/ ändern sich nie.
 */
function localistSeite(): Plugin {
  const overlay = new Map<string, string | null>();
  return {
    name: "localist-seite",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const send = (status: number, type: string, body: string | Uint8Array, headers: Record<string, string> = {}) => {
          res.statusCode = status;
          res.setHeader("Content-Type", type);
          for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
          res.end(body);
        };

        if (url.pathname === "/__localist-dev/datei") {
          const pfad = url.searchParams.get("pfad") ?? "";
          // Eigene Bausteine liegen in einem versteckten Ordner; nur für die Bibliotheksseite angenommen.
          const eigener = new RegExp(`^${EIGENE_DIR.replace(/\./g, "\\.")}/[^/\\\\]+\\.html$`).test(pfad);
          const rel = eigener ? pfad : requestToRel(`/${pfad}`);
          if (rel === null) return send(400, "text/plain; charset=utf-8", "Ungültiger Pfad.");
          if (req.method === "DELETE") {
            overlay.set(rel, null);
            return send(204, "text/plain", "");
          }
          if (req.method !== "PUT") return send(405, "text/plain", "");
          const chunks: Uint8Array[] = [];
          req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
          req.on("end", () => {
            overlay.set(rel, new TextDecoder().decode(Buffer.concat(chunks)));
            send(204, "text/plain", "");
          });
          return;
        }

        if (!url.pathname.startsWith(PAGE_PREFIX)) return next();
        const headers = schemeHeaders(readFileSync(`${SEITE}/csp.txt`, "utf8"));
        const rel = requestToRel(url.pathname.slice(PAGE_PREFIX.length - 1));
        if (rel === null) return send(403, "text/plain; charset=utf-8", "Zugriff verweigert.", headers);
        const bundled = bundledBaustein(rel);
        if (bundled) return send(200, contentType(rel), readFileSync(`${SEITE}/localist.${bundled}`), headers);
        if (rel === BIBLIOTHEK_PFAD) {
          // Wie page_scheme.rs: Vorlage + eigene Bausteine (aus dem Beispiel-Vault, überlagert von Änderungen der Vorschau)
          const dateien = new Map<string, string | null>();
          const ordner = `beispiel-vault/${EIGENE_DIR}`;
          if (existsSync(ordner)) for (const name of readdirSync(ordner) as string[]) if (name.endsWith(".html")) dateien.set(`${EIGENE_DIR}/${name}`, readFileSync(`${ordner}/${name}`, "utf8"));
          for (const [pfad, inhalt] of overlay) if (pfad.startsWith(`${EIGENE_DIR}/`)) dateien.set(pfad, inhalt);
          const eigene = [...dateien]
            .filter((eintrag): eintrag is [string, string] => eintrag[1] !== null)
            .map(([pfad, inhalt]) => ({ name: pfad.slice(EIGENE_DIR.length + 1, -".html".length), ...eigenerBausteinLesen(inhalt) }))
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
          const seite = bibliothekSeite(readFileSync(`${SEITE}/bibliothek.html`, "utf8"), eigene);
          return send(200, contentType(rel), injectBridge(seite, readFileSync(`${SEITE}/bruecke.js`, "utf8"), PAGE_PREFIX), headers);
        }
        let body: string | Uint8Array | null = null;
        if (overlay.has(rel)) body = overlay.get(rel) ?? null;
        else {
          const file = `beispiel-vault/${rel}`;
          if (existsSync(file) && statSync(file).isFile()) body = readFileSync(file);
        }
        if (body === null) return send(404, "text/plain; charset=utf-8", "Nicht gefunden.", headers);
        const type = contentType(rel);
        if (type.startsWith("text/html")) {
          const html = typeof body === "string" ? body : new TextDecoder().decode(body);
          body = injectBridge(html, readFileSync(`${SEITE}/bruecke.js`, "utf8"), PAGE_PREFIX);
        }
        send(200, type, body, headers);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), localistBausteine(), localistSeite()],


  // Vitest: Tests laufen in einer simulierten Browser-Umgebung (jsdom),
  // damit React-Komponenten wie im echten Fenster gerendert werden können.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    // CSS bleibt in Tests sonst leer. Der Inhalt wird nur gebraucht, wenn ein Test eine Datei mit ?raw liest
    // (Prüfung des Design-Systems in src/styles/tokens.test.ts).
    css: { include: [/\.css\?raw$/] },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
