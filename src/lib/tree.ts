// Hilfsfunktionen für den Ordnerbaum der Sidebar.
import type { TreeNode } from "./vault-api";

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

/** Ordner zuerst, dann Seiten, jeweils nach deutscher Sortierung (Ä bei A, 2 vor 10). */
export function sortTree(nodes: readonly TreeNode[]): TreeNode[] {
  return [...nodes]
    .sort((a, b) => (a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === "folder" ? -1 : 1))
    .map((node) => (node.children ? { ...node, children: sortTree(node.children) } : node));
}

export function findNode(nodes: readonly TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children && path.startsWith(`${node.path}/`)) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** Elternordner eines relativen Pfads ("" für die Vault-Wurzel). */
export function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/** Seitentitel aus einem Pfad, z. B. "Notizen/Ideen.md" → "Ideen", "Lernen/DNS.html" → "DNS". */
export function pageTitle(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.(md|html)$/i, "");
}

/** Liegt `path` in `folder` (oder ist es `folder` selbst)? */
export function isInside(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

/** Ersetzt den Anfang `from` eines Pfads durch `to` (nach dem Umbenennen eines Ordners). */
export function movePath(path: string, from: string, to: string): string {
  return isInside(path, from) ? to + path.slice(from.length) : path;
}

/** Freier Name im Ordner: "Unbenannt", "Unbenannt 2", "Unbenannt 3" … (ohne Rücksicht auf Groß-/Kleinschreibung). */
export function uniqueName(siblings: readonly TreeNode[], base: string): string {
  const taken = new Set(siblings.map((node) => node.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Kinder eines Ordners ("" = Vault-Wurzel). */
export function childrenOf(nodes: readonly TreeNode[], dir: string): readonly TreeNode[] {
  if (dir === "") return nodes;
  return findNode(nodes, dir)?.children ?? [];
}

/** Alle Ordner auf dem Weg zu `path`, damit sie in der Sidebar aufgeklappt werden können. */
export function ancestorFolders(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}
