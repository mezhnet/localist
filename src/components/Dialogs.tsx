// Dialoge über dem Arbeitsbereich: Schnellsuche (Strg+P), Volltextsuche, Vorlagen-Auswahl und Einstellungen.
// Die drei Such-Dialoge sind Listen mit Eingabefeld, die sich mit Pfeiltasten, Enter und Escape bedienen lassen.
import { FileText, FolderOpen, LayoutTemplate, Monitor, Moon, Search, Sun, TextSearch } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import packageInfo from "../../package.json";
import type { PageRef } from "../lib/links";
import { quickSwitch, searchEntries, type IndexEntry } from "../lib/search";
import { useTheme, type ThemePreference } from "../lib/theme";
import { parentDir } from "../lib/tree";
import { Button, Dialog, Input, Kbd, Segmented } from "./ui";

interface ListDialogProps<T> {
  label: string;
  placeholder: string;
  icon: ReactNode;
  items: T[];
  emptyText: string;
  query: string;
  onQuery: (query: string) => void;
  onPick: (item: T) => void;
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
          if (event.key === "Enter" && props.items[selected]) props.onPick(props.items[selected]);
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
            onClick={() => props.onPick(item)}
          >
            {props.render(item)}
          </li>
        ))}
      </ul>
      {props.footer && <div className="dialog-footer">{props.footer}</div>}
    </Dialog>
  );
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
      <Kbd>Esc</Kbd> schließen
    </span>
  </>
);

/** Strg+P: Seiten nach Titel finden und öffnen. */
export function QuickSwitcher({ pages, onOpen, onClose }: { pages: PageRef[]; onOpen: (path: string) => void; onClose: () => void }) {
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
      onPick={(page) => onOpen(page.path)}
      onClose={onClose}
      itemKey={(page) => page.path}
      render={(page) => (
        <>
          <FileText className="dialog-item-icon" aria-hidden="true" />
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
  onOpen: (path: string) => void;
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
      onPick={(hit) => onOpen(hit.path)}
      onClose={onClose}
      itemKey={(hit) => hit.path}
      render={(hit) => (
        <>
          <FileText className="dialog-item-icon" aria-hidden="true" />
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
          <LayoutTemplate className="dialog-item-icon" aria-hidden="true" />
          <span className="dialog-item-text">
            <span className="dialog-title">{page.title}</span>
          </span>
        </>
      )}
      footer={<span>Die neue Seite übernimmt Eigenschaften und Inhalt der Vorlage.</span>}
    />
  );
}

const THEME_OPTIONS = [
  { value: "system" as const, label: "Wie System", icon: <Monitor /> },
  { value: "light" as const, label: "Hell", icon: <Sun /> },
  { value: "dark" as const, label: "Dunkel", icon: <Moon /> },
];

/** Einstellungen: Darstellung, Vault und Informationen zur App. */
export function SettingsDialog({ vaultName, vaultRoot, onSwitchVault, onClose }: { vaultName: string; vaultRoot: string; onSwitchVault: () => void; onClose: () => void }) {
  const { preference, setPreference } = useTheme();
  return (
    <Dialog label="Einstellungen" title="Einstellungen" onClose={onClose} size="md" className="settings-dialog">
      <section className="settings-section">
        <div className="settings-row">
          <div className="settings-text">
            <h3>Darstellung</h3>
            <p>Hell, dunkel oder automatisch wie in Windows.</p>
          </div>
          <Segmented<ThemePreference> label="Darstellung" options={THEME_OPTIONS} value={preference} onChange={setPreference} />
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
