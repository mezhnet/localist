import { describe, expect, it } from "vitest";
import { linkLabel, linkTargetFor, renamedTarget, resolveLink, rewriteLinks, type PageRef } from "./links";

const pages: PageRef[] = [
  { path: "Notizen/Ideen.md", title: "Ideen" },
  { path: "Projekte/Umzug.md", title: "Umzug" },
  { path: "Projekte/Website-Relaunch.md", title: "Website-Relaunch" },
  { path: "Archiv/Ideen.md", title: "Ideen" },
  { path: "Start.md", title: "Start" },
];

describe("Seitenlinks auflösen", () => {
  it("findet Seiten über den Titel, unabhängig von Groß-/Kleinschreibung und Abschnitt", () => {
    expect(resolveLink(pages, "Umzug")).toBe("Projekte/Umzug.md");
    expect(resolveLink(pages, "umzug#Termine")).toBe("Projekte/Umzug.md");
    expect(resolveLink(pages, "Fehlt")).toBeNull();
  });

  it("bei gleichen Titeln: erst derselbe Ordner, sonst der kürzeste Pfad", () => {
    expect(resolveLink(pages, "Ideen", "Archiv/Alt.md")).toBe("Archiv/Ideen.md");
    expect(resolveLink(pages, "Ideen", "Projekte/Umzug.md")).toBe("Archiv/Ideen.md");
    expect(resolveLink(pages, "Notizen/Ideen")).toBe("Notizen/Ideen.md");
  });

  it("Linkziel ist der Titel, bei Mehrdeutigkeit der Pfad", () => {
    expect(linkTargetFor(pages, "Projekte/Umzug.md")).toBe("Umzug");
    expect(linkTargetFor(pages, "Notizen/Ideen.md")).toBe("Notizen/Ideen");
  });
});

describe("Links nach dem Umbenennen anpassen", () => {
  const renameUmzug = (name: string) => (resolveLink(pages, name) === "Projekte/Umzug.md" ? renamedTarget(name, "Projekte/Umzug 2027.md") : null);

  it("passt alle Schreibweisen an und behält Abschnitt, Anzeigetext und Einbettung", () => {
    const text = "[[Umzug]], [[umzug|Anzeige]], [[Umzug#Termine]], ![[Umzug]], [[Projekte/Umzug]] und [[Ideen]]";
    expect(rewriteLinks(text, renameUmzug)).toBe(
      "[[Umzug 2027]], [[Umzug 2027|Anzeige]], [[Umzug 2027#Termine]], ![[Umzug 2027]], [[Projekte/Umzug 2027]] und [[Ideen]]",
    );
  });

  it("lässt Code-Blöcke und Code im Text unverändert", () => {
    const text = "Vorher [[Umzug]]\n\n```md\n[[Umzug]]\n```\n\nIm Text `[[Umzug]]` und [[Umzug]]\n";
    expect(rewriteLinks(text, renameUmzug)).toBe(
      "Vorher [[Umzug 2027]]\n\n```md\n[[Umzug]]\n```\n\nIm Text `[[Umzug]]` und [[Umzug 2027]]\n",
    );
  });

  it("ändert nichts, wenn kein Link betroffen ist", () => {
    const text = "---\nid: 1\n---\nNur [[Ideen]] hier.\n";
    expect(rewriteLinks(text, renameUmzug)).toBe(text);
  });
});

describe("Links auf HTML-Seiten ([[Name.html]])", () => {
  const mixed: PageRef[] = [
    { path: "Notizen/Ideen.md", title: "Ideen" },
    { path: "Lernen/Ideen.html", title: "Ideen" },
    { path: "Lernen/DNS.html", title: "DNS" },
    { path: "Archiv/DNS.html", title: "DNS" },
  ];

  it("[[Name]] meint nur Notizen, [[Name.html]] nur HTML-Seiten", () => {
    expect(resolveLink(mixed, "Ideen")).toBe("Notizen/Ideen.md");
    expect(resolveLink(mixed, "Ideen.html")).toBe("Lernen/Ideen.html");
    expect(resolveLink(mixed, "ideen.HTML#Abschnitt")).toBe("Lernen/Ideen.html");
    expect(resolveLink(mixed, "DNS")).toBeNull();
    expect(resolveLink(mixed, "DNS.html", "Archiv/Alt.md")).toBe("Archiv/DNS.html");
    expect(resolveLink(mixed, "Lernen/DNS.html")).toBe("Lernen/DNS.html");
  });

  it("Linkziel und Anzeige: mit Endung gespeichert, ohne Endung angezeigt", () => {
    expect(linkTargetFor(mixed, "Lernen/Ideen.html")).toBe("Ideen.html");
    expect(linkTargetFor(mixed, "Notizen/Ideen.md")).toBe("Ideen");
    expect(linkTargetFor(mixed, "Lernen/DNS.html")).toBe("Lernen/DNS.html"); // mehrdeutig
    expect(linkLabel("DNS.html")).toBe("DNS");
    expect(linkLabel("Ideen")).toBe("Ideen");
  });

  it("beim Umbenennen bleibt die Endung erhalten", () => {
    expect(renamedTarget("DNS.html", "Lernen/Namensauflösung.html")).toBe("Namensauflösung.html");
    expect(renamedTarget("dns.html", "Archiv/DNS.html")).toBe("dns.html");
    expect(renamedTarget("Lernen/DNS.html", "Kurs/DNS.html")).toBe("Kurs/DNS.html");
    expect(rewriteLinks("Siehe [[DNS.html|Notizen zu DNS]].", (name) => (name === "DNS.html" ? "Namensauflösung.html" : null))).toBe(
      "Siehe [[Namensauflösung.html|Notizen zu DNS]].",
    );
  });
});
