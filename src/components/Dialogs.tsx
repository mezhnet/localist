// Dialoge über dem Arbeitsbereich: Schnellsuche (Strg+P), Volltextsuche und Vorlagen-Auswahl.
// Alle drei sind Listen mit Eingabefeld, die sich mit Pfeiltasten, Enter und Escape bedienen lassen.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PageRef } from "../lib/links";
import { quickSwitch, searchEntries, type IndexEntry } from "../lib/search";
import { parentDir } from "../lib/tree";

interface ListDialogProps<T> {
  label: string;
  placeholder: string;
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
    <div className="dialog-backdrop" onMouseDown={props.onClose}>
      <div className="dialog" role="dialog" aria-label={props.label} onMouseDown={(event) => event.stopPropagation()}>
        <input
          autoFocus
          className="dialog-input"
          aria-label={props.label}
          placeholder={props.placeholder}
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") props.onClose();
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
      </div>
    </div>
  );
}

/** Strg+P: Seiten nach Titel finden und öffnen. */
export function QuickSwitcher({ pages, onOpen, onClose }: { pages: PageRef[]; onOpen: (path: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => quickSwitch(pages, query), [pages, query]);
  return (
    <ListDialog
      label="Schnellsuche"
      placeholder="Seite suchen …"
      items={items}
      emptyText="Keine passende Seite."
      query={query}
      onQuery={setQuery}
      onPick={(page) => onOpen(page.path)}
      onClose={onClose}
      itemKey={(page) => page.path}
      render={(page) => (
        <>
          <span className="dialog-title">{page.title}</span>
          <span className="dialog-sub">{parentDir(page.path) || "Vault"}</span>
        </>
      )}
      footer="↑↓ auswählen · Enter öffnen · Esc schließen"
    />
  );
}

/** Volltextsuche über alle Seiten (Suchindex aus dem Cache-Ordner der App). */
export function SearchDialog({ loadIndex, onOpen, onClose }: { loadIndex: () => Promise<IndexEntry[]>; onOpen: (path: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  useEffect(() => {
    void loadIndex().then(setIndex, () => setIndex([]));
  }, [loadIndex]);
  const hits = useMemo(() => (index ? searchEntries(index, query) : []), [index, query]);
  return (
    <ListDialog
      label="Volltextsuche"
      placeholder="Text in allen Seiten suchen …"
      items={hits}
      emptyText={index === null ? "Suchindex wird geladen …" : query.trim() ? "Nichts gefunden." : "Suchbegriff eingeben."}
      query={query}
      onQuery={setQuery}
      onPick={(hit) => onOpen(hit.path)}
      onClose={onClose}
      itemKey={(hit) => hit.path}
      render={(hit) => (
        <>
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
        </>
      )}
      footer={index ? `${index.length} Seiten durchsucht · Enter öffnet den Treffer` : undefined}
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
      items={items}
      emptyText={templates.length === 0 ? "Im Ordner „Vorlagen“ gibt es noch keine Seiten." : "Keine passende Vorlage."}
      query={query}
      onQuery={setQuery}
      onPick={(page) => onPick(page.path)}
      onClose={onClose}
      itemKey={(page) => page.path}
      render={(page) => <span className="dialog-title">📋 {page.title}</span>}
      footer="Die neue Seite übernimmt Eigenschaften und Inhalt der Vorlage."
    />
  );
}
