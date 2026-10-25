import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { existsSync, readFileSync, statSync } from "node:fs";
import { bundledBaustein, contentType, injectBridge, requestToRel, schemeHeaders } from "./src/lib/seiten-schema.ts";
const host = process.env.TAURI_DEV_HOST;

/** Ordner mit CSP, Brücken-Skript und Platzhaltern – dieselben Dateien nutzt src-tauri/src/page_scheme.rs. */
const SEITE = "src-tauri/seite";
const PAGE_PREFIX = "/__localist-seite/";

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
          const rel = requestToRel(`/${url.searchParams.get("pfad") ?? ""}`);
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
  plugins: [react(), localistSeite()],


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
