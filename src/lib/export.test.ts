// Export als eigenständige HTML-Datei: CSS, Skript und Bilder eingebettet, der Rest bleibt wie er ist.
import { describe, expect, it } from "vitest";
import dnsSeite from "../../beispiel-vault/Notizen/DNS.html?raw";
import { eigenstaendigesHtml } from "./export";

const quellen = {
  css: "main { color: red } /* </style> im Text */",
  js: 'console.log("</script>");',
  laden: async (pfad: string) => (pfad === "Anhänge/skizze.png" ? "iVBORw0KGgo=" : null),
};

describe("Export als eigenständige HTML-Datei", () => {
  it("bettet localist.css, localist.js und Bilder aus dem Vault ein", async () => {
    const datei = await eigenstaendigesHtml(dnsSeite, "Notizen/DNS.html", quellen);
    expect(datei).not.toContain('href="../.localist/bausteine/localist.css"');
    expect(datei).not.toContain('src="../.localist/bausteine/localist.js"');
    expect(datei).toContain("<style>\nmain { color: red } /* <\\/style> im Text */</style>");
    // Das Skript steht am Ende von <body>, damit alle Bausteine schon gelesen sind, wenn es läuft.
    expect(datei).toMatch(/<\/main>\n<script>\nconsole\.log\("<\\\/script>"\);<\/script>\n<\/body>/);
    expect(datei).toContain('<img src="data:image/png;base64,iVBORw0KGgo=" alt="Skizze einer Namensauflösung" width="240">');
    // Alles andere bleibt Zeichen für Zeichen gleich.
    expect(datei).toContain('<l-callout typ="tipp">DNS übersetzt Namen wie example.com in IP-Adressen.</l-callout>');
    expect(datei.startsWith('<!doctype html>\n<html lang="de">\n<head>')).toBe(true);
  });

  it("funktioniert ohne Vault: keine Verweise mehr auf .localist/ oder auf Bilder im Vault", async () => {
    const datei = await eigenstaendigesHtml(dnsSeite, "Notizen/DNS.html", quellen);
    expect(datei).not.toMatch(/\.localist\//);
    expect([...datei.matchAll(/<img [^>]*src="([^"]+)"/g)].map((m) => m[1].slice(0, 22))).toEqual(["data:image/png;base64,"]);
  });

  it("fehlende Bilder und Adressen nach außen bleiben unverändert, auch ohne <body>", async () => {
    const seite = '<link rel="stylesheet" href="localist.css"><img src="fehlt.png"><img src="https://example.com/a.png"><p>x</p>';
    const datei = await eigenstaendigesHtml(seite, "Seite.html", quellen);
    expect(datei).toContain('<img src="fehlt.png"><img src="https://example.com/a.png">');
    expect(datei.endsWith('<script>\nconsole.log("<\\/script>");</script>\n')).toBe(true);
  });
});
