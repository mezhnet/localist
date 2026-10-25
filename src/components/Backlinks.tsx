// Backlinks unten auf einer Seite: welche Seiten verlinken mit [[…]] hierher?
import { useEffect, useState } from "react";
import type { PageRef } from "../lib/links";
import { backlinksFor, type Backlink, type IndexEntry } from "../lib/search";

interface Props {
  path: string;
  pages: PageRef[];
  loadIndex: () => Promise<IndexEntry[]>;
  /** Wird erhöht, wenn sich im Vault etwas geändert hat. */
  version: number;
  onOpen: (path: string) => void;
}

export function Backlinks({ path, pages, loadIndex, version, onOpen }: Props) {
  const [links, setLinks] = useState<Backlink[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadIndex().then(
      (index) => !cancelled && setLinks(backlinksFor(index, pages, path)),
      () => !cancelled && setLinks([]),
    );
    return () => {
      cancelled = true;
    };
  }, [path, pages, loadIndex, version]);

  if (links === null) return null;
  return (
    <section className="backlinks" aria-label="Backlinks">
      <h2>
        Verlinkt von <span className="kanban-count">{links.length}</span>
      </h2>
      {links.length === 0 ? (
        <p className="muted-small">Noch keine Seite verlinkt hierher. Tippe auf einer anderen Seite [[ und wähle diese aus.</p>
      ) : (
        <ul>
          {links.map((link) => (
            <li key={link.path}>
              <button type="button" className="backlink" onClick={() => onOpen(link.path)}>
                <span className="backlink-title">📄 {link.title}</span>
                <span className="backlink-context">{link.context}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
