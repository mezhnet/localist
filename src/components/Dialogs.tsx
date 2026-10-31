// Dialoge über dem Arbeitsbereich: Schnellsuche (Strg+P), Volltextsuche, Vorlagen-Auswahl und Einstellungen.
// Die drei Such-Dialoge sind Listen mit Eingabefeld, die sich mit Pfeiltasten, Enter und Escape bedienen lassen.
import { ChevronLeft, ChevronRight, FileCode, FileText, Folder, FolderInput, FolderOpen, House, LayoutTemplate, Palette, Search, TextSearch } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PageRef } from "../lib/links";
import { quickSwitch, searchEntries, type IndexEntry } from "../lib/search";
import { isHtmlPath } from "../lib/html";
import { CODE_SEITEN, useCodeSeite, type CodeSeite } from "../lib/html-editor";
import { isInside, parentDir } from "../lib/tree";
import type { TreeNode } from "../lib/vault-api";
import { AKZENTE, MODI, useTheme } from "../lib/theme";
import { DarstellungEinstellungen } from "./Darstellung";
import { oeffnenKlick } from "./Reiterleiste";
import { UeberLocalist } from "./UeberLocalist";
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
interface SettingsProps {
  vaultName: string;
  vaultRoot: string;
  onSwitchVault: () => void;
  onClose: () => void;
  /** Betriebssystem ("windows", "android", "browser" …): Auf Android gibt es keinen Updater. */
  platform: string;
  /** Speichert vor einem Update alle ausstehenden Änderungen (scheitert bei einem Speicherfehler). */
  vorDemUpdate: () => Promise<void>;
  onOpenExternal: (url: string) => void;
  /** Handy: eigene Seiten über dem ganzen Bildschirm statt Dialog (Vorlage 05). */
  handy?: boolean;
}

export function SettingsDialog({ handy = false, ...props }: SettingsProps) {
  const { vaultName, vaultRoot, onSwitchVault, platform, vorDemUpdate, onOpenExternal } = props;
  const [codeSeite, setCodeSeite] = useCodeSeite();
  // Solange ein Update lädt oder installiert wird, bleiben die Einstellungen offen: So kann nichts Neues
  // ungespeichert sein, wenn sich die App für den Installer beendet.
  const updateLaeuft = useRef(false);
  const setUpdateLaeuft = (laeuft: boolean) => (updateLaeuft.current = laeuft);
  const onClose = () => {
    if (!updateLaeuft.current) props.onClose();
  };
  if (handy) return <HandyEinstellungen {...props} onClose={onClose} onUpdateLaeuft={setUpdateLaeuft} />;
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
      <section className="settings-section" aria-label="Über Localist">
        <UeberLocalist platform={platform} vorDemUpdate={vorDemUpdate} onOpenExternal={onOpenExternal} onLaeuft={setUpdateLaeuft} />
      </section>
    </Dialog>
  );
}

/**
 * Einstellungen auf dem Handy (Vorlage 05-handy-darstellung-dunkel.png): eine Seite über dem ganzen Bildschirm mit
 * Zurück-Pfeil und großem Titel. Die Übersicht führt zu „Darstellung“ (Vorschaukarten, „Wie System“, Erklärung zu
 * Schwarz, Akzentfarbe); dort führt der Pfeil „Einstellungen“ zurück. Escape geht ebenfalls eine Seite zurück.
 */
function HandyEinstellungen({
  vaultName,
  vaultRoot,
  onSwitchVault,
  onClose,
  platform,
  vorDemUpdate,
  onOpenExternal,
  onUpdateLaeuft,
}: Omit<SettingsProps, "handy"> & { onUpdateLaeuft: (laeuft: boolean) => void }) {
  const [seite, setSeite] = useState<"uebersicht" | "darstellung">("uebersicht");
  const [codeSeite, setCodeSeite] = useCodeSeite();
  const { resolved, wieSystem, akzent } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const zurueck = () => (seite === "darstellung" ? setSeite("uebersicht") : onClose());
  // Fokus auf die Seite (für Bildschirmleser und Escape), danach zurück, wo er war.
  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (vorher?.isConnected) vorher.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    ref.current?.scrollTo?.({ top: 0 });
    ref.current?.focus({ preventScroll: true });
  }, [seite]);
  const modus = wieSystem ? `Wie System (${MODI.find((m) => m.value === resolved)?.label})` : MODI.find((m) => m.value === resolved)?.label;
  const titel = seite === "darstellung" ? "Darstellung" : "Einstellungen";
  return createPortal(
    <div
      ref={ref}
      className="handy-seite"
      role="dialog"
      aria-modal="true"
      aria-label={titel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        zurueck();
      }}
    >
      <header className="handy-seite-kopf">
        <button type="button" className="handy-zurueck" aria-label={seite === "darstellung" ? "Zurück zu „Einstellungen“" : "Einstellungen schließen"} onClick={zurueck}>
          <ChevronLeft aria-hidden="true" />
          <span>{seite === "darstellung" ? "Einstellungen" : "Zurück"}</span>
        </button>
      </header>
      <h1 className="handy-titel handy-seite-titel">{titel}</h1>
      {seite === "darstellung" ? (
        <DarstellungEinstellungen handy />
      ) : (
        <div className="handy-einstellungen">
          <button type="button" className="handy-einstellung handy-karte" onClick={() => setSeite("darstellung")}>
            <Palette aria-hidden="true" />
            <span className="handy-einstellung-text">
              <span className="handy-einstellung-name">Darstellung</span>
              <span className="handy-einstellung-wert">
                {modus} · {AKZENTE.find((a) => a.value === akzent)?.label}
              </span>
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
          <section className="handy-karte settings-row" aria-label="HTML-Seiten">
            <div className="settings-text">
              <h3>HTML-Seiten</h3>
              <p>Code-Editor in der Ansicht „Geteilt“: auf dem Handy „Links“ oben, „Rechts“ unten.</p>
            </div>
            <Segmented<CodeSeite> label="Code-Editor" options={CODE_SEITEN} value={codeSeite} onChange={setCodeSeite} />
          </section>
          <section className="handy-karte" aria-label="Vault">
            <div className="settings-text">
              <h3>Vault</h3>
              <p className="settings-vault-name">{vaultName}</p>
              <p className="settings-path">{vaultRoot}</p>
            </div>
            <Button className="handy-einstellungen-knopf" icon={<FolderOpen />} onClick={onSwitchVault}>
              Anderen Vault öffnen …
            </Button>
          </section>
          <section className="handy-karte" aria-label="Über Localist">
            <UeberLocalist handy platform={platform} vorDemUpdate={vorDemUpdate} onOpenExternal={onOpenExternal} onLaeuft={onUpdateLaeuft} />
          </section>
        </div>
      )}
    </div>,
    document.body,
  );
}
