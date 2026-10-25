// Startseite, wenn keine Seite offen ist: Begrüßung mit Suchfeld, Schnellaktionen,
// zuletzt bearbeitete Seiten und Favoriten.
import { Database, FileCode, FilePlus, FileText, History, LayoutTemplate, Search, Star, TextSearch } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { greeting, longDate, recentPages, relativeTime } from "../lib/home";
import { isHtmlPath } from "../lib/html";
import type { PageRef } from "../lib/links";
import { quickSwitch, type IndexEntry } from "../lib/search";
import { parentDir } from "../lib/tree";
import type { TreeNode } from "../lib/vault-api";
import { cx, Input, Kbd } from "./ui";

interface Props {
  vaultName: string;
  pages: PageRef[];
  index: IndexEntry[];
  favorites: TreeNode[];
  icons: ReadonlyMap<string, string>;
  onOpen: (node: { path: string; kind: TreeNode["kind"] }) => void;
  onCreateNote: () => void;
  onCreateDatabase: () => void;
  onCreateFromTemplate: () => void;
  /** Volltextsuche öffnen, optional mit Suchbegriff. */
  onSearch: (query?: string) => void;
}

export function HomePage(props: Props) {
  const now = new Date();
  const recent = useMemo(() => recentPages(props.index, 8), [props.index]);
  return (
    <div className="home" role="region" aria-label="Startseite">
      <header className="home-hero">
        <p className="home-date">{longDate(now)}</p>
        <h1 className="home-greeting">{greeting(now)}</h1>
        <p className="home-vault">Vault „{props.vaultName}“</p>
        <HomeSearch pages={props.pages} onOpen={(path) => props.onOpen({ path, kind: "page" })} onSearch={props.onSearch} />
      </header>

      <section className="home-section" aria-label="Schnellaktionen">
        <h2 className="home-section-title">Schnellaktionen</h2>
        <div className="home-actions">
          <ActionCard icon={<FilePlus />} title="Neue Notiz" text="Leere Seite im Vault" onClick={props.onCreateNote} />
          <ActionCard icon={<Database />} title="Neue Datenbank" text="Tabelle, Kanban und Kalender" onClick={props.onCreateDatabase} />
          <ActionCard icon={<LayoutTemplate />} title="Aus Vorlage" text="Seite aus dem Ordner „Vorlagen“" onClick={props.onCreateFromTemplate} />
          <ActionCard icon={<TextSearch />} title="Alle Seiten durchsuchen" text="Suche im Text aller Seiten" onClick={() => props.onSearch()} />
        </div>
      </section>

      <section className="home-section" aria-label="Zuletzt bearbeitet">
        <h2 className="home-section-title">
          <History aria-hidden="true" /> Zuletzt bearbeitet
        </h2>
        {recent.length === 0 ? (
          <p className="home-empty">Noch keine Seiten. Lege mit „Neue Notiz“ die erste an.</p>
        ) : (
          <div className="home-cards">
            {recent.map((entry) => (
              <PageCard
                key={entry.path}
                icon={props.icons.get(entry.path)}
                html={isHtmlPath(entry.path)}
                title={entry.title}
                meta={`${parentDir(entry.path) || "Vault"} · ${entry.modified ? relativeTime(entry.modified, now.getTime()) : "unbekannt"}`}
                onClick={() => props.onOpen({ path: entry.path, kind: "page" })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="home-section" aria-label="Favoriten">
        <h2 className="home-section-title">
          <Star aria-hidden="true" /> Favoriten
        </h2>
        {props.favorites.length === 0 ? (
          <p className="home-empty">Noch keine Favoriten. Hefte Seiten über den Stern oben rechts oder das „⋯“-Menü in der Sidebar an.</p>
        ) : (
          <div className="home-cards">
            {props.favorites.map((node) => (
              <PageCard
                key={node.path}
                icon={node.kind === "folder" ? undefined : props.icons.get(node.path)}
                database={node.kind === "folder"}
                html={node.html}
                title={node.name}
                meta={node.kind === "folder" ? "Datenbank" : parentDir(node.path) || "Vault"}
                onClick={() => props.onOpen(node)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActionCard({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="home-action" onClick={onClick}>
      <span className="home-action-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="home-action-title">{title}</span>
      <span className="home-action-text">{text}</span>
    </button>
  );
}

function PageCard({
  icon,
  database = false,
  html = false,
  title,
  meta,
  onClick,
}: {
  icon?: string;
  database?: boolean;
  html?: boolean;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="home-card" onClick={onClick}>
      <span className={cx("home-card-icon", icon && "is-emoji")} aria-hidden="true">
        {icon ?? (database ? <Database /> : html ? <FileCode /> : <FileText />)}
      </span>
      <span className="home-card-title">{title}</span>
      <span className="home-card-meta">{meta}</span>
    </button>
  );
}

/** Suchfeld der Startseite: Seiten nach Titel, Enter öffnet; darunter der Weg zur Volltextsuche. */
function HomeSearch({ pages, onOpen, onSearch }: { pages: PageRef[]; onOpen: (path: string) => void; onSearch: (query?: string) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const results = useMemo(() => (query.trim() ? quickSwitch(pages, query, 6) : []), [pages, query]);
  /** Ergebnisse plus „Im Text suchen“ als letzter Eintrag. */
  const count = query.trim() ? results.length + 1 : 0;
  const pick = (index: number) => {
    if (index < results.length) onOpen(results[index].path);
    else onSearch(query);
  };
  return (
    <div className="home-search">
      <Input
        inputSize="lg"
        icon={<Search />}
        wrapClassName="home-search-field"
        aria-label="Seiten suchen"
        placeholder="Seiten suchen …"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && count > 0) {
            event.preventDefault();
            setSelected((i) => Math.min(count - 1, i + 1));
          } else if (event.key === "ArrowUp" && count > 0) {
            event.preventDefault();
            setSelected((i) => Math.max(0, i - 1));
          } else if (event.key === "Enter" && count > 0) pick(selected);
          else if (event.key === "Escape") setQuery("");
        }}
      />
      {!query && (
        <span className="home-search-hint" aria-hidden="true">
          <Kbd>Strg+P</Kbd>
        </span>
      )}
      {count > 0 && (
        <ul className="home-search-results" role="listbox" aria-label="Suchergebnisse">
          {results.map((page, index) => (
            <li
              key={page.path}
              role="option"
              aria-selected={index === selected}
              className={cx(index === selected && "selected")}
              onMouseEnter={() => setSelected(index)}
              onClick={() => pick(index)}
            >
              <FileText aria-hidden="true" />
              <span className="dialog-title">{page.title}</span>
              <span className="dialog-sub">{parentDir(page.path) || "Vault"}</span>
            </li>
          ))}
          <li
            role="option"
            aria-selected={selected === results.length}
            className={cx("home-search-fulltext", selected === results.length && "selected")}
            onMouseEnter={() => setSelected(results.length)}
            onClick={() => pick(results.length)}
          >
            <TextSearch aria-hidden="true" />
            <span>Im Text aller Seiten suchen: „{query.trim()}“</span>
          </li>
        </ul>
      )}
    </div>
  );
}
