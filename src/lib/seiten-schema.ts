// Regeln des Schemas `localist-seite` für die Browser-Vorschau (Vite-Middleware in vite.config.ts).
// Gleiche Regeln wie src-tauri/src/page_scheme.rs: nur Dateien aus dem Vault, versteckte Ordner nur für
// `.localist/bausteine/` (dafür die gebündelte Fassung aus src-tauri/seite/), CSP und Brücken-Skript ebenfalls von dort.

const BAUSTEINE_DIR = ".localist/bausteine";

/** Wandelt den Pfad einer Anfrage in einen relativen Vault-Pfad um, oder null, wenn er abgelehnt wird. */
export function requestToRel(requestPath: string): string | null {
  let decoded: string;
  try {
    // Ungültige %-Folgen und ungültiges UTF-8 lösen hier einen Fehler aus.
    decoded = decodeURIComponent(requestPath.startsWith("/") ? requestPath.slice(1) : requestPath);
  } catch {
    return null;
  }
  const parts = decoded.split("/");
  if (parts.some((part) => part === "" || part === "." || part === ".." || /[\\:\0]/.test(part))) return null;
  const rel = parts.join("/");
  const inBausteine = rel.toLowerCase().startsWith(`${BAUSTEINE_DIR}/`) && parts.length === 3 && !parts[2].startsWith(".");
  if (parts.some((part) => part.startsWith(".")) && !inBausteine) return null;
  return rel;
}

/** Ist das eine der gebündelten Bausteine-Dateien? Liefert "css" oder "js". */
export function bundledBaustein(rel: string): "css" | "js" | null {
  const lower = rel.toLowerCase();
  if (lower === `${BAUSTEINE_DIR}/localist.css`) return "css";
  if (lower === `${BAUSTEINE_DIR}/localist.js`) return "js";
  return null;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/plain; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function contentType(rel: string): string {
  const dot = rel.lastIndexOf(".");
  return (dot === -1 ? undefined : TYPES[rel.slice(dot + 1).toLowerCase()]) ?? "application/octet-stream";
}

/** Fügt das Brücken-Skript nach `<head>` ein (sonst nach `<html>` bzw. `<!doctype>`, sonst am Anfang). */
export function injectBridge(html: string, bridge: string, basis: string): string {
  const script = `<script>${bridge.replace("__LOCALIST_BASIS__", basis)}</script>`;
  const lower = html.toLowerCase();
  const afterTag = (tag: string): number | null => {
    let from = 0;
    for (;;) {
      const start = lower.indexOf(tag, from);
      if (start === -1) return null;
      if (/[>\s]/.test(lower[start + tag.length] ?? "")) {
        const end = lower.indexOf(">", start);
        return end === -1 ? null : end + 1;
      }
      from = start + tag.length;
    }
  };
  const at = afterTag("<head") ?? afterTag("<html") ?? afterTag("<!doctype") ?? (html.startsWith("﻿") ? 1 : 0);
  return html.slice(0, at) + script + html.slice(at);
}

/** Kopfzeilen jeder Antwort (gleich wie `page_scheme::headers`). */
export function schemeHeaders(csp: string): Record<string, string> {
  return {
    "Content-Security-Policy": csp.trim(),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
}
