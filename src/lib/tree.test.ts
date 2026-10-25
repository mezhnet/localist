import { describe, expect, it } from "vitest";
import { ancestorFolders, findNode, isInside, movePath, pageTitle, parentDir, sortTree, uniqueName } from "./tree";
import type { TreeNode } from "./vault-api";

const page = (path: string): TreeNode => ({ name: pageTitle(path), path, kind: "page" });
const folder = (path: string, children: TreeNode[] = []): TreeNode => ({
  name: path.slice(path.lastIndexOf("/") + 1),
  path,
  kind: "folder",
  children,
});

describe("Ordnerbaum-Hilfen", () => {
  it("sortiert Ordner vor Seiten und nach deutscher Reihenfolge", () => {
    const sorted = sortTree([page("Zebra.md"), page("Äpfel.md"), folder("Notizen"), page("Seite 10.md"), page("Seite 2.md"), folder("Anhänge")]);
    expect(sorted.map((n) => n.name)).toEqual(["Anhänge", "Notizen", "Äpfel", "Seite 2", "Seite 10", "Zebra"]);
  });

  it("findet Einträge in Unterordnern", () => {
    const tree = [folder("Projekte", [folder("Projekte/2026", [page("Projekte/2026/Umzug.md")])])];
    expect(findNode(tree, "Projekte/2026/Umzug.md")?.name).toBe("Umzug");
    expect(findNode(tree, "Projekte/Fehlt.md")).toBeNull();
  });

  it("vergibt freie Namen wie in Notion", () => {
    expect(uniqueName([page("Ideen.md")], "Unbenannt")).toBe("Unbenannt");
    expect(uniqueName([page("Unbenannt.md"), page("unbenannt 2.md")], "Unbenannt")).toBe("Unbenannt 3");
  });

  it("Pfad-Hilfen", () => {
    expect(parentDir("Notizen/Ideen.md")).toBe("Notizen");
    expect(parentDir("Ideen.md")).toBe("");
    expect(pageTitle("Notizen/Ideen.md")).toBe("Ideen");
    expect(isInside("Projekte/Umzug.md", "Projekte")).toBe(true);
    expect(isInside("Projekte2/Umzug.md", "Projekte")).toBe(false);
    expect(movePath("Projekte/Umzug.md", "Projekte", "Archiv")).toBe("Archiv/Umzug.md");
    expect(ancestorFolders("a/b/c.md")).toEqual(["a", "a/b"]);
  });
});
