import { describe, expect, it } from "vitest";
import { allPages } from "./links";
import { backlinksFor, fuzzyScore, instantiateTemplate, quickSwitch, searchEntries, type IndexEntry } from "./search";
import type { TreeNode } from "./vault-api";

const entries: IndexEntry[] = [
  { path: "Notizen/Ideen.md", title: "Ideen", content: "# Ideen\n\nHier sammle ich lose Gedanken.\n\n- Wochenplanung als Kanban\n" },
  {
    path: "Projekte/Website-Relaunch.md",
    title: "Website-Relaunch",
    content: "---\nid: 1\nstatus: In Arbeit\n---\n- [ ] Domain prüfen\n\nSiehe auch [[Ideen]] für das Kanban.\n",
  },
  { path: "Projekte/Umzug.md", title: "Umzug", content: "---\nid: 2\n---\n# Umzug\n\nKartons für den Umzug besorgen. Möbel planen.\n" },
  { path: "Archiv/Kanban.md", title: "Kanban", content: "Altes Board\n\n```\n[[Ideen]] im Code zählt nicht\n```\n" },
  { path: "Start.md", title: "Start", content: "Verweise: [[Notizen/Ideen|meine Ideen]] und [[Ideen#Abschnitt]]\n" },
];

const tree: TreeNode[] = entries.map((entry) => ({ name: entry.title, path: entry.path, kind: "page" }));
const pages = allPages(tree);

describe("Volltextsuche", () => {
  it("findet Wörter im Text aller Seiten, Treffer im Titel stehen vorn", () => {
    expect(searchEntries(entries, "kanban").map((hit) => hit.title)).toEqual(["Kanban", "Ideen", "Website-Relaunch"]);
  });

  it("alle Wörter müssen vorkommen, Groß-/Kleinschreibung und Umlaute sind egal", () => {
    expect(searchEntries(entries, "umzug KARTONS").map((hit) => hit.title)).toEqual(["Umzug"]);
    expect(searchEntries(entries, "mobel").map((hit) => hit.title)).toEqual(["Umzug"]);
    expect(searchEntries(entries, "pruefen")).toEqual([]);
    expect(searchEntries(entries, "prüfen").map((hit) => hit.title)).toEqual(["Website-Relaunch"]);
    expect(searchEntries(entries, "   ")).toEqual([]);
  });

  it("durchsucht nicht das Frontmatter und liefert einen Ausschnitt mit Markierung", () => {
    expect(searchEntries(entries, "status")).toEqual([]);
    const [hit] = searchEntries(entries, "gedanken");
    expect(hit.snippet).toContain("Hier sammle ich lose Gedanken.");
    expect(hit.snippet.slice(hit.highlight![0], hit.highlight![0] + hit.highlight![1])).toBe("Gedanken");
  });
});

describe("Schnellsuche (Strg+P)", () => {
  it("findet Seiten auch mit Abkürzungen, Anfänge zuerst", () => {
    expect(quickSwitch(pages, "wsr").map((p) => p.title)).toEqual(["Website-Relaunch"]);
    expect(quickSwitch(pages, "um").map((p) => p.title)[0]).toBe("Umzug");
    expect(fuzzyScore("Ideen", "xyz")).toBeNull();
    expect(quickSwitch(pages, "").length).toBe(5);
  });
});

describe("Backlinks", () => {
  it("listet alle Seiten, die auf eine Seite verlinken, mit der Zeile des Links", () => {
    expect(backlinksFor(entries, pages, "Notizen/Ideen.md")).toEqual([
      { path: "Start.md", title: "Start", context: "Verweise: [[Notizen/Ideen|meine Ideen]] und [[Ideen#Abschnitt]]" },
      { path: "Projekte/Website-Relaunch.md", title: "Website-Relaunch", context: "Siehe auch [[Ideen]] für das Kanban." },
    ]);
  });

  it("Links in Code-Blöcken und auf andere Seiten zählen nicht", () => {
    expect(backlinksFor(entries, pages, "Projekte/Umzug.md")).toEqual([]);
    expect(backlinksFor(entries, pages, "Notizen/Ideen.md").map((b) => b.title)).not.toContain("Kanban");
  });
});

describe("Vorlagen", () => {
  const values = { id: "neu-1", title: "Garten", date: "2026-10-25", time: "14:30" };

  it("übernimmt Frontmatter und Text, setzt eine eigene id und füllt Platzhalter", () => {
    const template = "---\nstatus: Geplant\npriorität: mittel\n---\n# {{title}}\n\nAngelegt am {{date}} um {{ time }}.\n";
    expect(instantiateTemplate(template, values)).toBe(
      "---\nid: neu-1\nstatus: Geplant\npriorität: mittel\n---\n# Garten\n\nAngelegt am 2026-10-25 um 14:30.\n",
    );
  });

  it("ersetzt eine id aus der Vorlage und legt Frontmatter an, wenn die Vorlage keins hat", () => {
    expect(instantiateTemplate("---\nid: vorlage\ntyp: x\n---\nText\n", values)).toBe("---\nid: neu-1\ntyp: x\n---\nText\n");
    expect(instantiateTemplate("Nur Text\n", values)).toBe("---\nid: neu-1\n---\nNur Text\n");
  });
});

describe("HTML-Seiten in Suche und Backlinks", () => {
  const html = `<!doctype html><html><head><title>DNS</title><meta name="localist-id" content="1"></head><body><main>
<h1>Namensauflösung</h1><p>DNS nutzt Port 53.</p><p>Siehe <a href="../Notizen/Ideen.md">meine Ideen</a>.</p>
<script>var geheimwort = "Port 9999";</script><style>.geheimstil { color: red }</style></main></body></html>`;
  const htmlEntries: IndexEntry[] = [
    { path: "Lernen/DNS.html", title: "DNS", content: html },
    { path: "Notizen/Ideen.md", title: "Ideen", content: "# Ideen\n\nMehr dazu: [[DNS.html]]" },
  ];
  const htmlPages = allPages([
    { name: "DNS", path: "Lernen/DNS.html", kind: "page", html: true },
    { name: "Ideen", path: "Notizen/Ideen.md", kind: "page" },
  ]);

  it("durchsucht den sichtbaren Text, nicht Tags, Skripte oder Styles", () => {
    const hits = searchEntries(htmlEntries, "port 53");
    expect(hits.map((hit) => hit.path)).toEqual(["Lernen/DNS.html"]);
    expect(hits[0].snippet).toContain("DNS nutzt Port 53.");
    expect(searchEntries(htmlEntries, "geheimwort")).toEqual([]);
    expect(searchEntries(htmlEntries, "geheimstil")).toEqual([]);
    expect(searchEntries(htmlEntries, "localist-id")).toEqual([]);
  });

  it("Backlinks in beide Richtungen: <a href> aus HTML-Seiten und [[Name.html]] aus Notizen", () => {
    expect(backlinksFor(htmlEntries, htmlPages, "Notizen/Ideen.md")).toEqual([{ path: "Lernen/DNS.html", title: "DNS", context: "Link „meine Ideen“" }]);
    expect(backlinksFor(htmlEntries, htmlPages, "Lernen/DNS.html")).toEqual([{ path: "Notizen/Ideen.md", title: "Ideen", context: "Mehr dazu: [[DNS.html]]" }]);
  });
});
