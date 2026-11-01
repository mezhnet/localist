// Sidebar nach der Vorlage (01/02): oben der Vault-Umschalter, dann Suchen, Volltextsuche, Startseite, Bausteine und
// „Neue Seite“ (öffnet das „Neu“-Menü), darunter die Favoriten und der Ordnerbaum („Seiten“), unten Modus und Einstellungen.
// Seiten und Ordner lassen sich anlegen, umbenennen, anheften, verschieben und löschen (per Rechtsklick, "⋯"-Knopf,
// F2 oder Entf). Verschieben geht auch per Ziehen (src/lib/ziehen.ts): mit der Maus sofort, mit dem Finger nach
// langem Drücken; Verweilen über einem zugeklappten Ordner klappt ihn auf, Escape bricht ab. Notizen und
// HTML-Seiten haben verschiedene Symbole.
import {
  Blocks,
  BookOpen,
  FileDown,
  Repeat2,
  ChevronRight,
  ChevronsUpDown,
  Database,
  FileCode,
  FileText,
  FolderInput,
  Folder,
  FolderOpen,
  FolderSearch,
  House,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  StarOff,
  TextSearch,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import packageInfo from "../../package.json";
import { ablageGueltig, ancestorFolders, findNode, parentDir } from "../lib/tree";
import { useZiehen } from "../lib/ziehen";
import { ModusUmschalter } from "./Darstellung";
import { oeffnenKlick } from "./Reiterleiste";
import type { TreeNode } from "../lib/vault-api";
import { Button, cx, IconButton, Input, Kbd, Menu, MenuItem, MenuLabel, MenuSeparator, type MenuAnchor } from "./ui";

export type CreateKind = "page" | "html" | "folder" | "database" | "template";

export interface SidebarActions {
  /** Öffnen im aktuellen Reiter; `neu` (Strg+Klick oder Mittelklick): in einem neuen Reiter. */
  onOpen: (path: string, neu?: boolean) => void;
  onOpenDatabase: (path: string, neu?: boolean) => void;
  onOpenHome: () => void;
  /** Bereich „Bausteine“ (Bibliothek und Hilfe) öffnen. */
  onOpenLibrary: (neu?: boolean) => void;
  onCreate: (kind: CreateKind, dir: string) => void;
  onRename: (node: TreeNode, newName: string) => void;
  /** Per Ziehen in einen Ordner gelegt ("" = Vault-Wurzel). */
  onMove: (node: TreeNode, targetDir: string) => void;
  /** „Verschieben nach …“ gewählt: Zielordner erfragen. */
  onRequestMove: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  onConvertToDatabase: (path: string) => void;
  /** Notizbuch (Ordner mit _notizbuch.yaml) öffnen bzw. einen Ordner dazu machen. */
  onOpenNotebook: (path: string, neu?: boolean) => void;
  onConvertToNotebook: (path: string) => void;
  /** Notiz in eine HTML-Seite umwandeln (fragt vorher nach). */
  onConvertToHtml: (node: TreeNode) => void;
  /** Seite als eigenständige HTML-Datei exportieren. */
  onExport: (node: TreeNode) => void;
  /** „Im Explorer öffnen“ ("" = Vault). Fehlt auf dem Handy, dann gibt es die Einträge nicht. */
  onRevealInExplorer?: (path: string) => void;
  onToggleFavorite: (path: string) => void;
  onQuickOpen: () => void;
  onSearch: () => void;
  onOpenSettings: () => void;
  onSwitchVault: () => void;
}

interface Props extends SidebarActions {
  vaultName: string;
  tree: TreeNode[];
  openPath: string | null;
  /** Geöffnete Datenbank (Ordnerpfad) oder null. */
  openDatabase: string | null;
  /** Geöffnetes Notizbuch (Ordnerpfad) oder null. */
  openNotebook?: string | null;
  /** Die Startseite ist zu sehen (keine Seite und keine Datenbank offen). */
  homeActive: boolean;
  /** Der Bereich „Bausteine“ ist offen. */
  libraryActive?: boolean;
  /** Angeheftete Seiten und Datenbanken (Pfade). */
  favorites: string[];
  /** Emoji-Icons der Seiten (aus dem Frontmatter). */
  icons: ReadonlyMap<string, string>;
  /** Eintrag, der gerade umbenannt werden soll (z. B. direkt nach dem Anlegen). */
  renamingPath: string | null;
  onRenamingDone: () => void;
  /** PC mit eigenem Fensterrahmen: Der Kopf gehört dann zur oberen Leiste und zieht das Fenster. */
  fensterrahmen?: boolean;
  /** Steht die Seitenleiste rechts, öffnen sich die Menüs ihrer Knöpfe nach links (bleiben im Fenster). */
  seite?: "links" | "rechts";
  /**
   * Handy: Ansicht „Seiten“ der Navigationsleiste. Vault-Umschalter, Suchen, Startseite, „Neue Seite“, Modus und
   * Einstellungen stehen dann auf der Startseite bzw. in der Navigationsleiste und fehlen hier.
   */
  handy?: boolean;
}

type MenuState =
  | { kind: "node"; anchor: MenuAnchor; node: TreeNode }
  | { kind: "new"; anchor: MenuAnchor; dir: string }
  | { kind: "vault"; anchor: MenuAnchor };

export function Sidebar(props: Props) {
  const { tree, openPath, renamingPath, favorites, icons } = props;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  /**
   * Ziehen: Ziel ist der Ordner unter dem Zeiger (`data-ziel-ordner`; eine Seite steht für ihren Ordner, "" für die
   * Vault-Wurzel). Ungültige Ziele (gleicher Ordner, Ordner in sich selbst) gibt es nicht, sie werden nicht markiert.
   */
  const ziehen = useZiehen<TreeNode, string>({
    zielAn: (element, _x, _y, node) => {
      const ort = element.closest<HTMLElement>("[data-ziel-ordner]");
      if (!ort || !navRef.current?.contains(ort)) return null;
      const dir = ort.dataset.zielOrdner ?? "";
      return ablageGueltig(node, dir) ? dir : null;
    },
    onAblegen: (node, dir) => {
      if (dir) setExpanded((previous) => new Set([...previous, dir]));
      props.onMove(node, dir);
    },
    // Finger lange gedrückt und ohne Bewegung losgelassen: Menü wie bisher beim langen Drücken.
    onLangDruck: (node, x, y) => setMenu({ kind: "node", anchor: { x, y }, node }),
    // Kurz über einem zugeklappten Ordner verweilen klappt ihn auf.
    onVerweilen: (dir) => dir && setExpanded((previous) => (previous.has(dir) ? previous : new Set([...previous, dir]))),
  });
  const gezogen = ziehen.zustand;
  /** Ordner, in den gerade abgelegt würde ("" = Vault-Wurzel), oder null. */
  const dropTarget = gezogen?.ziel ?? null;

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

  /** Menü öffnen; ein zweiter Klick auf denselben Knopf schließt es wieder. */
  const openMenu = (next: MenuState) =>
    setMenu((current) =>
      current && "element" in current.anchor && "element" in next.anchor && current.anchor.element === next.anchor.element ? null : next,
    );
  const atPointer = (event: ReactMouseEvent): MenuAnchor => {
    event.preventDefault();
    event.stopPropagation();
    return { x: event.clientX, y: event.clientY };
  };
  const below = (event: ReactMouseEvent<HTMLElement>): MenuAnchor => {
    event.stopPropagation();
    return { element: event.currentTarget };
  };

  const finishRename = (node: TreeNode, newName: string | null) => {
    setRenaming(null);
    props.onRenamingDone();
    if (newName !== null && newName.trim() !== "" && newName.trim() !== node.name) props.onRename(node, newName.trim());
  };

  const create = (kind: CreateKind, dir: string) => {
    if (dir) setExpanded((previous) => new Set([...previous, dir]));
    props.onCreate(kind, dir);
  };

  const open = (node: TreeNode, neu = false) => {
    if (node.kind === "page") props.onOpen(node.path, neu);
    else if (node.database) {
      // Eine Datenbank öffnet sich als Tabelle und klappt ihre Einträge auf.
      setExpanded((previous) => new Set([...previous, node.path]));
      props.onOpenDatabase(node.path, neu);
    } else if (node.notebook) {
      // Ein Notizbuch öffnet sich wie eine kleine Website.
      setExpanded((previous) => new Set([...previous, node.path]));
      props.onOpenNotebook(node.path, neu);
    } else if (!neu) toggle(node.path);
  };

  const isActive = (node: TreeNode) => node.path === openPath || node.path === props.openDatabase || node.path === props.openNotebook;

  const nodeIcon = (node: TreeNode, isOpen: boolean) => {
    if (node.kind === "page") {
      const emoji = icons.get(node.path);
      if (emoji) return <span className="tree-emoji">{emoji}</span>;
      return node.html ? <FileCode /> : <FileText />;
    }
    if (node.database) return <Database />;
    if (node.notebook) return <BookOpen />;
    return isOpen ? <FolderOpen /> : <Folder />;
  };

  const renderNodes = (nodes: TreeNode[], depth: number) => {
    // Gleichnamige Seiten im selben Ordner (z. B. Ideen.md und Ideen.html aus einem bestehenden Vault) markieren.
    const counts = new Map<string, number>();
    for (const node of nodes) if (node.kind === "page") counts.set(node.name.toLowerCase(), (counts.get(node.name.toLowerCase()) ?? 0) + 1);
    return nodes.map((node) => {
      const isFolder = node.kind === "folder";
      const isOpen = expanded.has(node.path);
      const indent = { "--depth": depth } as CSSProperties;
      const duplicate = node.kind === "page" && (counts.get(node.name.toLowerCase()) ?? 0) > 1;
      const targetDir = isFolder ? node.path : parentDir(node.path);
      return (
        <li key={node.path} role="treeitem" aria-expanded={isFolder ? isOpen : undefined} aria-selected={isActive(node)}>
          {renaming === node.path ? (
            <RenameInput node={node} style={indent} onDone={(name) => finishRename(node, name)} />
          ) : (
            <div
              className={cx(
                "tree-row",
                isActive(node) && "active",
                isFolder && dropTarget === node.path && "drop-target",
                gezogen?.quelle.path === node.path && (gezogen.phase === "gegriffen" ? "is-gegriffen" : "is-gezogen"),
              )}
              style={indent}
              data-ziel-ordner={targetDir}
              {...ziehen.griff(node)}
              onContextMenu={(event) => setMenu({ kind: "node", anchor: atPointer(event), node })}
            >
              {isFolder ? (
                <button
                  type="button"
                  tabIndex={-1}
                  className={cx("tree-toggle", isOpen && "is-open")}
                  aria-label={isOpen ? `„${node.name}“ zuklappen` : `„${node.name}“ aufklappen`}
                  onClick={() => toggle(node.path)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              ) : (
                <span className="tree-toggle" aria-hidden="true" />
              )}
              <button
                type="button"
                className="tree-label"
                title={node.path}
                {...oeffnenKlick((neu) => open(node, neu))}
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
                  {nodeIcon(node, isOpen)}
                </span>
                <span className="tree-name">{node.name}</span>
                {duplicate && (
                  <span className="tree-duplicate" title="Gleicher Name wie eine andere Seite in diesem Ordner. [[Name]] meint die Notiz.">
                    {node.html ? "HTML" : "MD"}
                  </span>
                )}
              </button>
              {isFolder && (
                <IconButton
                  size="sm"
                  className="tree-action tree-neu"
                  label={`Neu in „${node.name}“`}
                  onClick={(event) => openMenu({ kind: "new", anchor: below(event), dir: node.path })}
                >
                  <Plus />
                </IconButton>
              )}
              <IconButton
                size="sm"
                className="tree-action"
                label={`Aktionen für „${node.name}“`}
                title="Weitere Aktionen"
                onClick={(event) => openMenu({ kind: "node", anchor: below(event), node })}
              >
                <MoreHorizontal />
              </IconButton>
            </div>
          )}
          {isFolder && isOpen && node.children && (
            <ul role="group" data-ziel-ordner={node.path}>
              {node.children.length === 0 ? (
                <li className="tree-empty" style={{ "--depth": depth + 1 } as CSSProperties}>
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
  };

  const favoriteNodes = favorites.map((path) => findNode(tree, path)).filter((node): node is TreeNode => node !== null);
  const menuAlign = props.seite === "rechts" ? "end" : "start";

  return (
    <nav ref={navRef} className="sidebar" aria-label="Seiten" onContextMenu={(event) => setMenu({ kind: "new", anchor: atPointer(event), dir: "" })}>
      {/* Steht die Seitenleiste links, liegt der Kopf in der oberen Leiste: Freie Stellen ziehen das Fenster. */}
      {props.handy ? (
        <h1 className="handy-titel sidebar-handy-titel">Seiten</h1>
      ) : (
        <div className="sidebar-header" data-tauri-drag-region={props.fensterrahmen ? "deep" : undefined}>
          <button
            type="button"
            className="vault-switcher"
            title="Vault wechseln oder Einstellungen öffnen"
            aria-haspopup="menu"
            onClick={(event) => openMenu({ kind: "vault", anchor: below(event) })}
          >
            <span className="vault-avatar" aria-hidden="true">
              {props.vaultName.trim().charAt(0).toUpperCase() || "V"}
            </span>
            <span className="vault-name">{props.vaultName}</span>
            <ChevronsUpDown className="vault-switcher-chevron" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="sidebar-scroll">
        <div className="sidebar-nav">
          {!props.handy && (
            <Button variant="ghost" className="sidebar-item" icon={<Search />} trailing={<Kbd>Strg P</Kbd>} onClick={props.onQuickOpen} title="Seite nach Titel öffnen (Strg+P)">
              Suchen
            </Button>
          )}
          <Button
            variant="ghost"
            className="sidebar-item"
            icon={<TextSearch />}
            trailing={<Kbd>Strg ⇧ F</Kbd>}
            onClick={props.onSearch}
            title="Text in allen Seiten suchen (Strg+Umschalt+F)"
          >
            Volltextsuche
          </Button>
          {!props.handy && (
            <Button variant="ghost" className={cx("sidebar-item", props.homeActive && "active")} icon={<House />} onClick={props.onOpenHome}>
              Startseite
            </Button>
          )}
          <Button
            variant="ghost"
            className={cx("sidebar-item", props.libraryActive && "active")}
            icon={<Blocks />}
            {...oeffnenKlick((neu) => props.onOpenLibrary(neu))}
            title="Alle Bausteine mit Vorschau, eigene Bausteine und Hilfe"
          >
            Bausteine
          </Button>
          {!props.handy && (
            <Button
              variant="ghost"
              className="sidebar-item"
              icon={<Plus />}
              aria-haspopup="menu"
              title="Neue Notiz, HTML-Seite, Ordner, Datenbank oder Notiz aus Vorlage"
              onClick={(event) => openMenu({ kind: "new", anchor: below(event), dir: "" })}
            >
              Neue Seite
            </Button>
          )}
        </div>

        <section className="sidebar-section" aria-label="Favoriten">
          <h2 className="sidebar-section-title">Favoriten</h2>
          {favoriteNodes.length === 0 ? (
            <p className="sidebar-hint">Seiten über „⋯“ oder den Stern anheften.</p>
          ) : (
            <ul className="favorites">
              {favoriteNodes.map((node) => (
                <li key={node.path}>
                  {/* Wie in der Vorlage ist nur der Eintrag im Ordnerbaum hervorgehoben, nicht der Favorit. */}
                  <div className="tree-row" onContextMenu={(event) => setMenu({ kind: "node", anchor: atPointer(event), node })}>
                    <button type="button" className="tree-label" title={node.path} {...oeffnenKlick((neu) => open(node, neu))}>
                      <span className="tree-icon" aria-hidden="true">
                        {nodeIcon(node, false)}
                      </span>
                      <span className="tree-name">{node.name}</span>
                    </button>
                    <IconButton size="sm" className="tree-action" label={`„${node.name}“ aus Favoriten lösen`} onClick={() => props.onToggleFavorite(node.path)}>
                      <StarOff />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sidebar-section sidebar-section--tree" aria-label="Seiten">
          {/* Die Überschrift „Seiten“ und die Fläche unter dem Baum nehmen Einträge für die oberste Ebene an. */}
          <div className="sidebar-section-head" data-ziel-ordner="">
            <h2 className="sidebar-section-title">Seiten</h2>
            <IconButton size="sm" label="Neu im Vault" onClick={(event) => openMenu({ kind: "new", anchor: below(event), dir: "" })}>
              <Plus />
            </IconButton>
          </div>
          <ul className={cx("tree", dropTarget === "" && "drop-target")} role="tree" aria-label="Ordner und Seiten" data-ziel-ordner="">
            {tree.length === 0 ? <li className="tree-empty">Noch keine Seiten</li> : renderNodes(tree, 0)}
          </ul>
          {gezogen?.phase === "zieht" && ablageGueltig(gezogen.quelle, "") && (
            <div className={cx("tree-wurzel", dropTarget === "" && "drop-target")} data-ziel-ordner="">
              In die oberste Ebene
            </div>
          )}
        </section>
      </div>

      {!props.handy && (
        <div className="sidebar-footer">
          <div className="sidebar-darstellung">
            <span className="sidebar-section-label">Darstellung</span>
            <ModusUmschalter />
          </div>
          <div className="sidebar-footer-zeile">
            <Button variant="ghost" className="sidebar-item" icon={<SlidersHorizontal />} onClick={props.onOpenSettings}>
              Einstellungen
            </Button>
            <span className="app-version">v{packageInfo.version}</span>
          </div>
        </div>
      )}

      {menu?.kind === "new" && (
        <Menu anchor={menu.anchor} label="Neu" align={menuAlign} onClose={() => setMenu(null)}>
          <NewItems dir={menu.dir} tree={tree} onCreate={create} />
        </Menu>
      )}
      {menu?.kind === "vault" && (
        <Menu anchor={menu.anchor} label="Vault" align={menuAlign} onClose={() => setMenu(null)}>
          <MenuItem icon={<FolderOpen />} onSelect={props.onSwitchVault}>
            Anderen Vault öffnen …
          </MenuItem>
          {props.onRevealInExplorer && (
            <MenuItem icon={<FolderSearch />} onSelect={() => props.onRevealInExplorer?.("")}>
              Vault im Explorer öffnen
            </MenuItem>
          )}
          <MenuItem icon={<Settings />} onSelect={props.onOpenSettings}>
            Einstellungen
          </MenuItem>
        </Menu>
      )}
      {menu?.kind === "node" && (
        <Menu anchor={menu.anchor} label={`Aktionen für „${menu.node.name}“`} align={menuAlign} onClose={() => setMenu(null)}>
          <NodeItems
            node={menu.node}
            tree={tree}
            favorite={favorites.includes(menu.node.path)}
            onCreate={create}
            onRename={() => setRenaming(menu.node.path)}
            onMove={() => props.onRequestMove(menu.node)}
            onDelete={() => props.onDelete(menu.node)}
            onToggleFavorite={() => props.onToggleFavorite(menu.node.path)}
            onDatabase={() => (menu.node.database ? props.onOpenDatabase(menu.node.path) : props.onConvertToDatabase(menu.node.path))}
            onNotebook={() => (menu.node.notebook ? props.onOpenNotebook(menu.node.path) : props.onConvertToNotebook(menu.node.path))}
            onConvertToHtml={() => props.onConvertToHtml(menu.node)}
            onExport={() => props.onExport(menu.node)}
            onReveal={props.onRevealInExplorer && (() => props.onRevealInExplorer?.(menu.node.path))}
          />
        </Menu>
      )}
    </nav>
  );
}

/** Einträge des „Neu“-Menüs: Notiz, Ordner, Datenbank und Notiz aus Vorlage. */
export function NewItems({ dir, tree, onCreate }: { dir: string; tree: TreeNode[]; onCreate: (kind: CreateKind, dir: string) => void }) {
  const where = dir ? findNode(tree, dir)?.name ?? dir : null;
  return (
    <>
      {where && <MenuLabel>Neu in „{where}“</MenuLabel>}
      <MenuItem icon={<FileText />} onSelect={() => onCreate("page", dir)}>
        Notiz
      </MenuItem>
      <MenuItem icon={<FileCode />} onSelect={() => onCreate("html", dir)}>
        HTML-Seite
      </MenuItem>
      <MenuItem icon={<Folder />} onSelect={() => onCreate("folder", dir)}>
        Ordner
      </MenuItem>
      <MenuItem icon={<Database />} onSelect={() => onCreate("database", dir)}>
        Datenbank
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={<LayoutTemplate />} onSelect={() => onCreate("template", dir)}>
        Notiz aus Vorlage …
      </MenuItem>
    </>
  );
}

export interface NodeItemsProps {
  node: TreeNode;
  tree: TreeNode[];
  favorite: boolean;
  onCreate: (kind: CreateKind, dir: string) => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onDatabase: () => void;
  onNotebook: () => void;
  onConvertToHtml: () => void;
  onExport: () => void;
  /** „Im Explorer öffnen“ (fehlt auf dem Handy). */
  onReveal?: () => void;
}

export function NodeItems({ node, tree, favorite, onCreate, onRename, onMove, onDelete, onToggleFavorite, onDatabase, onNotebook, onConvertToHtml, onExport, onReveal }: NodeItemsProps) {
  const isFolder = node.kind === "folder";
  // Ein Ordner ist entweder Datenbank oder Notizbuch (liegen beide Dateien darin, gilt er als Datenbank).
  const notebook = node.notebook && !node.database;
  return (
    <>
      {isFolder && (
        <>
          <NewItems dir={node.path} tree={tree} onCreate={onCreate} />
          <MenuSeparator />
          {!notebook && (
            <MenuItem icon={<Database />} onSelect={onDatabase}>
              {node.database ? "Datenbank öffnen" : "In Datenbank umwandeln"}
            </MenuItem>
          )}
          {!node.database && (
            <MenuItem icon={<BookOpen />} onSelect={onNotebook}>
              {notebook ? "Notizbuch öffnen" : "In Notizbuch umwandeln"}
            </MenuItem>
          )}
        </>
      )}
      {!isFolder && (
        <>
          {!node.html && (
            <MenuItem icon={<Repeat2 />} onSelect={onConvertToHtml}>
              In HTML-Seite umwandeln …
            </MenuItem>
          )}
          <MenuItem icon={<FileDown />} onSelect={onExport}>
            Als HTML-Datei exportieren …
          </MenuItem>
          <MenuSeparator />
        </>
      )}
      {(!isFolder || node.database || notebook) && (
        <MenuItem icon={favorite ? <StarOff /> : <Star />} onSelect={onToggleFavorite}>
          {favorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
        </MenuItem>
      )}
      <MenuItem icon={<Pencil />} hint="F2" onSelect={onRename}>
        Umbenennen
      </MenuItem>
      <MenuItem icon={<FolderInput />} onSelect={onMove}>
        Verschieben nach …
      </MenuItem>
      {onReveal && (
        <MenuItem icon={<FolderSearch />} onSelect={onReveal}>
          Im Explorer öffnen
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem icon={<Trash2 />} hint="Entf" danger onSelect={onDelete}>
        Löschen …
      </MenuItem>
    </>
  );
}

function RenameInput({ node, style, onDone }: { node: TreeNode; style: CSSProperties; onDone: (name: string | null) => void }) {
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
    <div className="tree-row renaming" style={style}>
      <Input
        ref={input}
        inputSize="sm"
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
