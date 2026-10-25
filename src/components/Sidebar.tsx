// Sidebar mit dem Ordnerbaum des Vaults: Seiten öffnen, Ordner auf- und zuklappen,
// Seiten und Ordner anlegen, umbenennen und löschen (per Rechtsklick, "⋯"-Knopf, F2 oder Entf).
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import packageInfo from "../../package.json";
import { useTheme, type ThemePreference } from "../lib/theme";
import { ancestorFolders } from "../lib/tree";
import type { TreeNode } from "../lib/vault-api";

export interface SidebarActions {
  onOpen: (path: string) => void;
  onCreatePage: (dir: string) => void;
  onCreateFolder: (dir: string) => void;
  onRename: (node: TreeNode, newName: string) => void;
  onDelete: (node: TreeNode) => void;
  onSwitchVault: () => void;
  onOpenDatabase: (path: string) => void;
  onConvertToDatabase: (path: string) => void;
  onQuickOpen: () => void;
  onSearch: () => void;
  onCreateFromTemplate: (dir: string) => void;
}

interface Props extends SidebarActions {
  vaultName: string;
  tree: TreeNode[];
  openPath: string | null;
  /** Geöffnete Datenbank (Ordnerpfad) oder null. */
  openDatabase: string | null;
  /** Eintrag, der gerade umbenannt werden soll (z. B. direkt nach dem Anlegen). */
  renamingPath: string | null;
  onRenamingDone: () => void;
}

interface MenuState {
  x: number;
  y: number;
  /** null = Menü für die Vault-Wurzel. */
  node: TreeNode | null;
}

export function Sidebar(props: Props) {
  const { tree, openPath, renamingPath } = props;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // Ordner der geöffneten Seite und eines neu angelegten Eintrags aufklappen.
  useEffect(() => {
    const paths = [openPath, renamingPath].filter((p): p is string => !!p).flatMap(ancestorFolders);
    if (paths.length === 0) return;
    setExpanded((previous) => (paths.every((p) => previous.has(p)) ? previous : new Set([...previous, ...paths])));
  }, [openPath, renamingPath]);

  useEffect(() => {
    if (renamingPath) setRenaming(renamingPath);
  }, [renamingPath]);

  const toggle = (path: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const openMenu = (event: ReactMouseEvent, node: TreeNode | null) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, node });
  };

  const finishRename = (node: TreeNode, newName: string | null) => {
    setRenaming(null);
    props.onRenamingDone();
    if (newName !== null && newName.trim() !== "" && newName.trim() !== node.name) props.onRename(node, newName.trim());
  };

  const createIn = (dir: string, kind: "page" | "folder") => {
    if (dir) setExpanded((previous) => new Set([...previous, dir]));
    if (kind === "page") props.onCreatePage(dir);
    else props.onCreateFolder(dir);
  };

  const renderNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const isFolder = node.kind === "folder";
      const isOpen = expanded.has(node.path);
      return (
        <li key={node.path} role="treeitem" aria-expanded={isFolder ? isOpen : undefined}>
          {renaming === node.path ? (
            <RenameInput node={node} depth={depth} onDone={(name) => finishRename(node, name)} />
          ) : (
            <div
              className={`tree-row${node.path === openPath || node.path === props.openDatabase ? " active" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onContextMenu={(event) => openMenu(event, node)}
            >
              <button
                type="button"
                className="tree-label"
                title={node.path}
                onClick={() => {
                  if (!isFolder) props.onOpen(node.path);
                  else if (node.database) {
                    // Eine Datenbank öffnet sich als Tabelle und klappt ihre Einträge auf.
                    setExpanded((previous) => new Set([...previous, node.path]));
                    props.onOpenDatabase(node.path);
                  } else toggle(node.path);
                }}
                onKeyDown={(event) => {
                  if (event.key === "F2") {
                    event.preventDefault();
                    setRenaming(node.path);
                  } else if (event.key === "Delete") {
                    event.preventDefault();
                    props.onDelete(node);
                  }
                }}
              >
                <span className="tree-icon" aria-hidden="true">
                  {node.database ? "🗃️" : isFolder ? (isOpen ? "▾" : "▸") : "📄"}
                </span>
                <span className="tree-name">{node.name}</span>
              </button>
              {isFolder && (
                <button
                  type="button"
                  className="tree-action"
                  title={`Neue Seite in „${node.name}“`}
                  aria-label={`Neue Seite in „${node.name}“`}
                  onClick={() => createIn(node.path, "page")}
                >
                  +
                </button>
              )}
              <button
                type="button"
                className="tree-action"
                title="Weitere Aktionen"
                aria-label={`Aktionen für „${node.name}“`}
                onClick={(event) => openMenu(event, node)}
              >
                ⋯
              </button>
            </div>
          )}
          {isFolder && isOpen && node.children && (
            <ul role="group">
              {node.children.length === 0 ? (
                <li className="tree-empty" style={{ paddingLeft: 30 + depth * 14 }}>
                  Leer
                </li>
              ) : (
                renderNodes(node.children, depth + 1)
              )}
            </ul>
          )}
        </li>
      );
    });

  return (
    <nav className="sidebar" aria-label="Seiten" onContextMenu={(event) => openMenu(event, null)}>
      <div className="sidebar-header">
        <span className="vault-name" title={props.vaultName}>
          {props.vaultName}
        </span>
        <button type="button" className="link-button" onClick={props.onSwitchVault} title="Anderen Vault-Ordner öffnen">
          Wechseln
        </button>
      </div>
      <div className="sidebar-actions">
        <button type="button" onClick={props.onQuickOpen} title="Seite nach Titel öffnen">
          ⌕ Schnellsuche <kbd>Strg+P</kbd>
        </button>
        <button type="button" onClick={props.onSearch} title="Text in allen Seiten suchen">
          🔍 Volltextsuche <kbd>Strg+⇧+F</kbd>
        </button>
        <button type="button" onClick={() => createIn("", "page")}>
          + Neue Seite
        </button>
        <button type="button" onClick={() => props.onCreateFromTemplate("")}>
          + Seite aus Vorlage
        </button>
        <button type="button" onClick={() => createIn("", "folder")}>
          + Neuer Ordner
        </button>
      </div>
      <ul className="tree" role="tree">
        {tree.length === 0 ? <li className="tree-empty">Noch keine Seiten</li> : renderNodes(tree, 0)}
      </ul>
      <ThemeSwitch />
      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onCreate={(kind) => createIn(menu.node?.path ?? "", kind)}
          onRename={() => menu.node && setRenaming(menu.node.path)}
          onDelete={() => menu.node && props.onDelete(menu.node)}
          onTemplate={() => props.onCreateFromTemplate(menu.node?.path ?? "")}
          onDatabase={() => {
            if (!menu.node) return;
            if (menu.node.database) props.onOpenDatabase(menu.node.path);
            else props.onConvertToDatabase(menu.node.path);
          }}
        />
      )}
    </nav>
  );
}

/** Umschalter für Hell- und Dunkelmodus am unteren Rand der Sidebar. */
function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="sidebar-footer">
      <label>
        Darstellung{" "}
        <select value={preference} onChange={(event) => setPreference(event.target.value as ThemePreference)}>
          <option value="system">Wie System</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
      <span className="app-version">Localist {packageInfo.version}</span>
    </div>
  );
}

function RenameInput({ node, depth, onDone }: { node: TreeNode; depth: number; onDone: (name: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <div className="tree-row renaming" style={{ paddingLeft: 8 + depth * 14 }}>
      <input
        ref={input}
        className="rename-input"
        aria-label={`Neuer Name für „${node.name}“`}
        defaultValue={node.name}
        onBlur={(event) => finish(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(event.currentTarget.value);
          if (event.key === "Escape") finish(null);
        }}
      />
    </div>
  );
}

interface ContextMenuProps {
  menu: MenuState;
  onClose: () => void;
  onCreate: (kind: "page" | "folder") => void;
  onRename: () => void;
  onDelete: () => void;
  onDatabase: () => void;
  onTemplate: () => void;
}

function ContextMenu({ menu, onClose, onCreate, onRename, onDelete, onDatabase, onTemplate }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  const item = (label: string, action: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      className={danger ? "danger" : undefined}
      onClick={() => {
        onClose();
        action();
      }}
    >
      {label}
    </button>
  );

  const canCreate = menu.node === null || menu.node.kind === "folder";
  return (
    <div ref={ref} className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
      {canCreate && item("Neue Seite", () => onCreate("page"))}
      {canCreate && item("Neue Seite aus Vorlage …", onTemplate)}
      {canCreate && item("Neuer Ordner", () => onCreate("folder"))}
      {menu.node?.kind === "folder" && item(menu.node.database ? "Datenbank öffnen" : "In Datenbank umwandeln", onDatabase)}
      {menu.node && item("Umbenennen", onRename)}
      {menu.node && item("Löschen …", onDelete, true)}
    </div>
  );
}
