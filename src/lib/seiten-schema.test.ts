// Gleiche Fälle wie `pfade_der_anfragen_werden_geprueft` in src-tauri/src/page_scheme.rs:
// Die Browser-Vorschau prüft Pfade genauso streng wie die echte App.
import { describe, expect, it } from "vitest";
import { bundledBaustein, contentType, injectBridge, requestToRel, schemeHeaders } from "./seiten-schema";

describe("Schema localist-seite (Browser-Vorschau)", () => {
  it("prüft Pfade wie die App: nur Dateien im Vault, keine versteckten Dateien außer den Bausteinen", () => {
    expect(requestToRel("/Notizen/DNS.html")).toBe("Notizen/DNS.html");
    expect(requestToRel("/Notizen/DNS%20Kurs.html")).toBe("Notizen/DNS Kurs.html");
    expect(requestToRel("/Anh%C3%A4nge/skizze.png")).toBe("Anhänge/skizze.png");
    expect(requestToRel("/.localist/bausteine/localist.css")).toBe(".localist/bausteine/localist.css");
    for (const bad of [
      "/",
      "/../geheim.png",
      "/%2e%2e/geheim.png",
      "/%2E%2E/geheim.png",
      "/..%2fgeheim.png",
      "/..%5cgeheim.png",
      "/Notizen/..%2F..%2Fgeheim.png",
      "/a//b.html",
      "/./a.html",
      "/C:/Windows/win.ini",
      "/%43%3a/Windows/win.ini",
      "/Notizen/%00.html",
      "/%ff.html",
      "/%zz.html",
      "/.localist/settings.json",
      "/.localist/bausteine/eigene/Box.html",
      "/.localist/bausteine/.versteckt.js",
      "/.git/config",
      "/Notizen/.Ideen.md.123.tmp",
    ]) {
      expect(requestToRel(bad), bad).toBeNull();
    }
  });

  it("liefert für localist.css und localist.js die gebündelte Fassung", () => {
    expect(bundledBaustein(".localist/bausteine/localist.css")).toBe("css");
    expect(bundledBaustein(".localist/bausteine/LOCALIST.JS")).toBe("js");
    expect(bundledBaustein("Notizen/localist.css")).toBeNull();
  });

  it("fügt die Brücke nach <head> ein, die Datei bleibt sonst gleich", () => {
    const page = "<!doctype html>\r\n<html>\r\n<head>\r\n<title>DNS</title>\r\n</head>\r\n";
    expect(injectBridge(page, "var BASIS = \"__LOCALIST_BASIS__\";", "/__localist-seite/")).toBe(
      '<!doctype html>\r\n<html>\r\n<head><script>var BASIS = "/__localist-seite/";</script>\r\n<title>DNS</title>\r\n</head>\r\n',
    );
    expect(injectBridge("\uFEFF<p>x</p>", "B", "/")).toBe("\uFEFF<script>B</script><p>x</p>");
    expect(injectBridge("<header>x</header>", "B", "/")).toBe("<script>B</script><header>x</header>");
  });

  it("setzt CSP und Schutz-Kopfzeilen", () => {
    expect(schemeHeaders("default-src 'none'\n")).toEqual({
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    expect(contentType("a/DNS.HTML")).toBe("text/html; charset=utf-8");
    expect(contentType("ohne_endung")).toBe("application/octet-stream");
  });
});
