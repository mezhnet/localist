// Dialoge über dem Arbeitsbereich: Schnellsuche (Strg+P), Volltextsuche, Vorlagen-Auswahl und Einstellungen.
// Die drei Such-Dialoge sind Listen mit Eingabefeld, die sich mit Pfeiltasten, Enter und Escape bedienen lassen.
import { FileCode, FileText, Folder, FolderInput, FolderOpen, House, LayoutTemplate, Search, TextSearch } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import packageInfo from "../../package.json";
import type { PageRef } from "../lib/links";
import { quickSwitch, searchEntries, type IndexEntry } from "../lib/search";
import { isHtmlPath } from "../lib/html";
import { CODE_SEITEN, useCodeSeite, type CodeSeite } from "../lib/html-editor";
import { isInside, parentDir } from "../lib/tree";
import type { TreeNode } from "../lib/vault-api";
import { DarstellungEinstellungen } from "./Darstellung";
import { oeffnenKlick } from "./Reiterleiste";
import { Button, Dialog, Input, Kbd, Segmented } from "./ui";

interface ListDialogProps<T> {
  label: string;
  placeholder: string;
  icon: ReactNode;
  items: T[];
  emptyText: string;
  query: string;
  onQuery: (query: string) => void;
  /** `neu`: Strg+Enter, Strg+Klick oder Mittelklick (in einem neuen Reiter öffnen). */
  onPick: (item: T, neu: boolean) => void;
  onClose: () => void;
  render: (item: T) => ReactNode;
  itemKey: (item: T) => string;
  footer?: ReactNode;
}

function ListDialog<T>(props: ListDialogProps<T>) {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [props.query, props.items.length]);
  return (
    <Dialog label={props.label} onClose={props.onClose} placement="top" className="list-dialog">
      <Input
        autoFocus
        variant="bare"
        inputSize="lg"
        icon={props.icon}
        wrapClassName="list-dialog-search"
        aria-label={props.label}
        placeholder={props.placeholder}
        value={props.query}
        onChange={(event) => props.onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelected((i) => Math.min(props.items.length - 1, i + 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelected((i) => Math.max(0, i - 1));
          }
          if (event.key === "Enter" && props.items[selected]) props.onPick(props.items[selected], event.ctrlKey || event.metaKey);
        }}
      />
      <ul className="dialog-list" role="listbox" aria-label="Ergebnisse">
        {props.items.length === 0 && <li className="dialog-empty">{props.emptyText}</li>}
        {props.items.map((item, index) => (
          <li
            key={props.itemKey(item)}
            role="option"
            aria-selected={index === selected}
            className={index === selected ? "selected" : undefined}
            onMouseEnter={() => setSelected(index)}
            {...oeffnenKlick((neu) => props.onPick(item, neu))}
          >
            {props.render(item)}
          </li>
        ))}
      </ul>
      {props.footer && <div className="dialog-footer">{props.footer}</div>}
    </Dialog>
  );
}

/** Symbol je Seitentyp: Notiz oder HTML-Seite. */
function PageIcon({ path }: { path: string }) {
  return isHtmlPath(path) ? <FileCode className="dialog-item-icon" aria-hidden="true" /> : <FileText className="dialog-item-icon" aria-hidden="true" />;
}

const keyHints = (
  <>
    <span>
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd> auswählen
    </span>
    <span>
      <Kbd>Enter</Kbd> öffnen
    </span>
    <span>
      <Kbd>Strg+Enter</Kbd> in neuem Reiter
    </span>
    <span>
      <Kbd>Esc</Kbd> schließen
    </span>
  </>
);

/** Strg+P: Seiten nach Titel finden und öffnen. */
export function QuickSwitcher({ pages, onOpen, onClose }: { pages: PageRef[]; onOpen: (path: string, neu: boolean) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => quickSwitch(pages, query), [pages, query]);
  return (
    <ListDialog
      label="Schnellsuche"
      placeholder="Seite suchen …"
      icon={<Search />}
      items={items}
      emptyText="Keine passende Seite."
      query={query}
      onQuery={setQuery}
      onPick={(page, neu) => onOpen(page.path, neu)}
      onClose={onClose}
      itemKey={(page) => page.path}
      render={(page) => (
        <>
          <PageIcon path={page.path} />
          <span className="dialog-item-text">
            <span className="dialog-title">{page.title}</span>
            <span className="dialog-sub">{parentDir(page.path) || "Vault"}</span>
          </span>
        </>
      )}
      footer={keyHints}
    />
  );
}

/** Seite auswählen, z. B. als Ziel eines Seitenlinks in einer HTML-Seite. */
export function PagePicker({ pages, label, onPick, onClose }: { pages: PageRef[]; label: string; onPick: (page: PageRef) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => quickSwitch(pages, query), [pages, query]);
  return (
    <ListDialog
      label={label}
      placeholder="Seite suchen …"
      icon={<Search />}
      items={items}
      emptyText="Keine passende Seite."
      query={query}
      onQuery={setQuery}
      onPick={(page) => onPick(page)}
      onClose={onClose}
      itemKey={(page) => page.path}
      render={(page) => (
        <>
          <PageIcon path={page.path} />
          <span className="dialog-item-text">
            <span className="dialog-title">{page.title}</span>
            <span className="dialog-sub">{parentDir(page.path) || "Vault"}</span>
          </span>
        </>
      )}
      footer={keyHints}
    />
  );
}

/** Volltextsuche über alle Seiten (Suchindex aus dem Cache-Ordner der App). */
export function SearchDialog({
  loadIndex,
  initialQuery = "",
  onOpen,
  onClose,
}: {
  loadIndex: () => Promise<IndexEntry[]>;
  initialQuery?: string;
  onOpen: (path: string, neu: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  useEffect(() => {
    void loadIndex().then(setIndex, () => setIndex([]));
  }, [loadIndex]);
  const hits = useMemo(() => (index ? searchEntries(index, query) : []), [index, query]);
  return (
    <ListDialog
      label="Volltextsuche"
      placeholder="Text in allen Seiten suchen …"
      icon={<TextSearch />}
      items={hits}
      emptyText={index === null ? "Suchindex wird geladen …" : query.trim() ? "Nichts gefunden." : "Suchbegriff eingeben."}
      query={query}
      onQuery={setQuery}
      onPick={(hit, neu) => onOpen(hit.path, neu)}
      onClose={onClose}
      itemKey={(hit) => hit.path}
      render={(hit) => (
        <>
          <PageIcon path={hit.path} />
          <span className="dialog-item-text">
            <span className="dialog-title">
              {hit.title} <span className="dialog-sub">{parentDir(hit.path)}</span>
            </span>
            <span className="dialog-snippet">
              {hit.highlight ? (
                <>
                  {hit.snippet.slice(0, hit.highlight[0])}
                  <mark>{hit.snippet.slice(hit.highlight[0], hit.highlight[0] + hit.highlight[1])}</mark>
                  {hit.snippet.slice(hit.highlight[0] + hit.highlight[1])}
                </>
              ) : (
                hit.snippet
              )}
            </span>
          </span>
        </>
      )}
      footer={index ? <span>{index.length} Seiten durchsucht · Enter öffnet den Treffer</span> : undefined}
    />
  );
}

/** Auswahl einer Vorlage aus dem Ordner "Vorlagen/" für eine neue Seite. */
export function TemplatePicker({ templates, onPick, onClose }: { templates: PageRef[]; onPick: (path: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => quickSwitch(templates, query, 50), [templates, query]);
  return (
    <ListDialog
      label="Vorlage wählen"
      placeholder="Vorlage suchen …"
      icon={<LayoutTemplate />}
      items={items}
      emptyText={templates.length === 0 ? "Im Ordner „Vorlagen“ gibt es noch keine Seiten." : "Keine passende Vorlage."}
      query={query}
      onQuery={setQuery}
      onPick={(page) => onPick(page.path)}
      onClose={onClose}
      itemKey={(page) => page.path}
      render={(page) => (
        <>
          <PageIcon path={page.path} />
          <span className="dialog-item-text">
            <span className="dialog-title">{page.title}</span>
          </span>
        </>
      )}
      footer={<span>Die neue Seite übernimmt Eigenschaften und Inhalt der Vorlage.</span>}
    />
  );
}

interface FolderChoice {
  path: string;
  name: string;
}

/** „Verschieben nach …“: Zielordner wählen (nicht der jetzige Ordner und bei Ordnern nicht sie selbst oder darin). */
export function MoveDialog({ node, tree, onPick, onClose }: { node: TreeNode; tree: TreeNode[]; onPick: (dir: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const folders = useMemo(() => {
    const all: FolderChoice[] = [{ path: "", name: "Vault (oberste Ebene)" }];
    const walk = (nodes: readonly TreeNode[]) => {
      for (const child of nodes) {
        if (child.kind !== "folder") continue;
        all.push({ path: child.path, name: child.name });
        if (child.children) walk(child.children);
      }
    };
    walk(tree);
    const current = parentDir(node.path);
    return all.filter((folder) => folder.path !== current && !(node.kind === "folder" && isInside(folder.path, node.path)));
  }, [tree, node]);
  const q = query.trim().toLowerCase();
  const items = q ? folders.filter((folder) => folder.path.toLowerCase().includes(q) || folder.name.toLowerCase().includes(q)) : folders;
  return (
    <ListDialog
      label={`„${node.name}“ verschieben nach`}
      placeholder="Ordner suchen …"
      icon={<FolderInput />}
      items={items}
      emptyText="Kein passender Ordner."
      query={query}
      onQuery={setQuery}
      onPick={(folder) => onPick(folder.path)}
      onClose={onClose}
      itemKey={(folder) => folder.path || "/"}
      render={(folder) => (
        <>
          {folder.path === "" ? <House className="dialog-item-icon" aria-hidden="true" /> : <Folder className="dialog-item-icon" aria-hidden="true" />}
          <span className="dialog-item-text">
            <span className="dialog-title">{folder.name}</span>
            {folder.path.includes("/") && <span className="dialog-sub">{parentDir(folder.path)}</span>}
          </span>
        </>
      )}
      footer={<span>Links auf verschobene Seiten werden im ganzen Vault angepasst.</span>}
    />
  );
}

/** Einstellungen: Darstellung, Vault und Informationen zur App. */
export function SettingsDialog({ vaultName, vaultRoot, onSwitchVault, onClose }: { vaultName: string; vaultRoot: string; onSwitchVault: () => void; onClose: () => void }) {
  const [codeSeite, setCodeSeite] = useCodeSeite();
  return (
    <Dialog label="Einstellungen" title="Einstellungen" onClose={onClose} size="md" className="settings-dialog">
      <DarstellungEinstellungen />
      <section className="settings-section">
        <div className="settings-row">
          <div className="settings-text">
            <h3>HTML-Seiten</h3>
            <p>Code-Editor in der Ansicht „Geteilt“ links oder rechts. Auf schmalen Bildschirmen oben oder unten.</p>
          </div>
          <Segmented<CodeSeite> label="Code-Editor" options={CODE_SEITEN} value={codeSeite} onChange={setCodeSeite} />
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-row">
          <div className="settings-text">
            <h3>Vault</h3>
            <p className="settings-vault-name">{vaultName}</p>
            <p className="settings-path" title={vaultRoot}>
              {vaultRoot}
            </p>
          </div>
          <Button icon={<FolderOpen />} onClick={onSwitchVault}>
            Anderen Vault öffnen …
          </Button>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-text">
          <h3>Über Localist</h3>
          <p>
            Version {packageInfo.version}. Alle Seiten liegen als normale Dateien in deinem Vault. Keine Konten, kein Server, keine
            Telemetrie – Localist funktioniert komplett offline.
          </p>
        </div>
      </section>
    </Dialog>
  );
}
