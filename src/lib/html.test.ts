import { describe, expect, it } from "vitest";
import {
  encodePath,
  htmlLinks,
  htmlVisibleText,
  instantiateHtmlTemplate,
  newHtmlPage,
  pathMapper,
  readHead,
  relativePath,
  resolveRelative,
  rewriteReferences,
  setMeta,
  setTitle,
} from "./html";

const ID = "7c1e2b4a-0d3f-4a5e-9b8c-1f2e3d4c5b6a";

const DNS = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>DNS</title>
<meta name="localist-id" content="${ID}">
<meta name="localist-icon" content="🧠">
<link rel="stylesheet" href="../.localist/bausteine/localist.css">
<script src="../.localist/bausteine/localist.js" defer></script>
</head>
<body>
<main>
<l-callout typ="tipp">DNS übersetzt Namen in IP-Adressen.</l-callout>
<figure><img src="../Anh%C3%A4nge/skizze.png" alt="Skizze"></figure>
<p>Siehe auch <a href="../Notizen/Ideen.md">Ideen</a> und <a href='Subnetting.html#masken'>Subnetting</a>.</p>
<p><a href="https://example.com">extern</a> <a href="#oben">oben</a></p>
<script>const geheim = "kein Suchtext";</script>
<style>p { color: red }</style>
</main>
</body>
</html>
`;

describe("HTML-Seiten: neue Seite und Kopfbereich", () => {
  it("legt eine Seite nach dem Speicherformat an (Pfade zu den Bausteinen relativ zum Ordner)", () => {
    const page = newHtmlPage("DNS & Ports", ID, "Lernen/Netze/DNS & Ports.html");
    expect(page).toBe(
      `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
        `<title>DNS &amp; Ports</title>\n<meta name="localist-id" content="${ID}">\n` +
        `<link rel="stylesheet" href="../../.localist/bausteine/localist.css">\n<script src="../../.localist/bausteine/localist.js" defer></script>\n` +
        `</head>\n<body>\n<main>\n</main>\n</body>\n</html>\n`,
    );
    expect(newHtmlPage("Start", ID, "Start.html")).toContain('href=".localist/bausteine/localist.css"');
  });

  it("liest Titel, id, Icon und Cover aus dem Kopfbereich", () => {
    expect(readHead(DNS)).toEqual({ title: "DNS", id: ID, icon: "🧠", cover: null });
  });

  it("ändert nur den Titel, alles andere bleibt Zeichen für Zeichen gleich (auch mit CRLF und BOM)", () => {
    const crlf = `﻿${DNS.replace(/\n/g, "\r\n")}`;
    const renamed = setTitle(crlf, "Namen & Adressen");
    expect(renamed).toBe(crlf.replace("<title>DNS</title>", "<title>Namen &amp; Adressen</title>"));
    expect(readHead(renamed).title).toBe("Namen & Adressen");
    expect(setTitle(DNS, "DNS")).toBe(DNS);
  });

  it("setzt, ändert und entfernt <meta>-Angaben an genau einer Stelle", () => {
    const crlf = `﻿${DNS.replace(/\n/g, "\r\n")}`;
    const changed = setMeta(crlf, "localist-icon", "🌐");
    expect(changed).toBe(crlf.replace('content="🧠"', 'content="🌐"'));
    const withCover = setMeta(crlf, "localist-cover", "../Anhänge/skizze.png");
    expect(withCover).toBe(crlf.replace(`content="${ID}">`, `content="${ID}">\r\n<meta name="localist-cover" content="../Anhänge/skizze.png">`));
    const removed = setMeta(crlf, "localist-icon", null);
    expect(removed).toBe(crlf.replace('<meta name="localist-icon" content="🧠">\r\n', ""));
    expect(readHead(removed).icon).toBeNull();
    expect(setMeta(DNS, "localist-icon", "🧠")).toBe(DNS);
  });
});

describe("HTML-Seiten: relative Pfade", () => {
  it("löst relative Pfade auf und berechnet sie neu", () => {
    expect(resolveRelative("Lernen", "../Notizen/Ideen.md")).toBe("Notizen/Ideen.md");
    expect(resolveRelative("Lernen", "../Anh%C3%A4nge/a%20b.png")).toBe("Anhänge/a b.png");
    expect(resolveRelative("", "../draußen.png")).toBeNull();
    expect(relativePath("Lernen", "Notizen/Ideen.md")).toBe("../Notizen/Ideen.md");
    expect(relativePath("Lernen/Netze", "Lernen/DNS.html")).toBe("../DNS.html");
    expect(relativePath("", ".localist/bausteine/localist.css")).toBe(".localist/bausteine/localist.css");
    expect(relativePath("A", "A/b.md")).toBe("b.md");
    expect(encodePath("../Meine Notizen/Ideen #1.md")).toBe("../Meine%20Notizen/Ideen%20%231.md");
  });

  it("Verschieben: Bausteine, Bilder und Links zeigen danach wieder aufs richtige Ziel, nur die Werte ändern sich", () => {
    const moved = rewriteReferences(DNS, "Lernen/DNS.html", "Lernen/Netze/Grundlagen/DNS.html", (p) => p);
    expect(moved).toBe(
      DNS.replace('href="../.localist/bausteine/localist.css"', 'href="../../../.localist/bausteine/localist.css"')
        .replace('src="../.localist/bausteine/localist.js"', 'src="../../../.localist/bausteine/localist.js"')
        .replace('src="../Anh%C3%A4nge/skizze.png"', 'src="../../../Anhänge/skizze.png"')
        .replace('href="../Notizen/Ideen.md"', 'href="../../../Notizen/Ideen.md"')
        .replace("href='Subnetting.html#masken'", "href='../../Subnetting.html#masken'"),
    );
    // Externe Links, Sprungmarken und Skripte bleiben unberührt.
    expect(moved).toContain('href="https://example.com"');
    expect(moved).toContain('href="#oben"');
  });

  it("Umbenennen einer anderen Seite passt nur die Links darauf an", () => {
    const updated = rewriteReferences(DNS, "Lernen/DNS.html", "Lernen/DNS.html", pathMapper("Notizen/Ideen.md", "Notizen/Meine Ideen.md"));
    expect(updated).toBe(DNS.replace('href="../Notizen/Ideen.md"', 'href="../Notizen/Meine%20Ideen.md"'));
    // Ordner umbenannt: alles darin zieht mit.
    const folder = rewriteReferences(DNS, "Lernen/DNS.html", "Lernen/DNS.html", pathMapper("Anhänge", "Bilder"));
    expect(folder).toBe(DNS.replace('src="../Anh%C3%A4nge/skizze.png"', 'src="../Bilder/skizze.png"'));
    // Nichts betroffen: Datei unverändert.
    expect(rewriteReferences(DNS, "Lernen/DNS.html", "Lernen/DNS.html", pathMapper("Projekte", "Archiv"))).toBe(DNS);
  });
});

describe("HTML-Seiten: Text und Links", () => {
  it("liest nur den sichtbaren Text (ohne Tags, Kopfbereich, Skripte und Styles)", () => {
    const text = htmlVisibleText(DNS);
    expect(text).toBe("DNS übersetzt Namen in IP-Adressen. Siehe auch Ideen und Subnetting. extern oben");
    expect(text).not.toContain("geheim");
    expect(text).not.toContain("color");
  });

  it("findet <a href>-Links mit Ziel im Vault", () => {
    expect(htmlLinks(DNS, "Lernen/DNS.html")).toEqual([
      { href: "../Notizen/Ideen.md", target: "Notizen/Ideen.md", text: "Ideen" },
      { href: "Subnetting.html#masken", target: "Lernen/Subnetting.html", text: "Subnetting" },
      { href: "https://example.com", target: null, text: "extern" },
      { href: "#oben", target: null, text: "oben" },
    ]);
  });

  it("Vorlage: neue id, Titel, Platzhalter und Pfade für den Zielordner", () => {
    const template = DNS.replace("<title>DNS</title>", "<title>{{title}}</title>").replace("DNS übersetzt", "Angelegt am {{date}} um {{time}}:");
    const page = instantiateHtmlTemplate(template, "Vorlagen/Lernseite.html", "Kurs/Woche 1/Tag & Nacht.html", {
      id: "neu-123",
      title: "Tag & Nacht",
      date: "2026-10-25",
      time: "14:30",
    });
    expect(readHead(page)).toMatchObject({ title: "Tag & Nacht", id: "neu-123" });
    expect(page).toContain("Angelegt am 2026-10-25 um 14:30:");
    expect(page).toContain('href="../../.localist/bausteine/localist.css"');
    expect(page).toContain('href="../../Notizen/Ideen.md"');
  });
});
