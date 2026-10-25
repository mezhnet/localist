// Backlinks unten auf einer Seite: welche Seiten verlinken mit [[…]] hierher?
import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { PageRef } from "../lib/links";
import { backlinksFor, type Backlink, type IndexEntry } from "../lib/search";
import { Badge } from "./ui";

interface Props {
  path: string;
  pages: PageRef[];
  loadIndex: () => Promise<IndexEntry[]>;
  /** Wird erhöht, wenn sich im Vault etwas geändert hat. */
  version: number;
  /** Emoji-Icons der Seiten (aus dem Suchindex). */
  icons: ReadonlyMap<string, string>;
  onOpen: (path: string) => void;
}

export function Backlinks({ path, pages, loadIndex, version, icons, onOpen }: Props) {
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
        Verlinkt von <Badge>{links.length}</Badge>
      </h2>
      {links.length === 0 ? (
        <p className="muted-small">Noch keine Seite verlinkt hierher. Tippe auf einer anderen Seite [[ und wähle diese aus.</p>
      ) : (
        <ul>
          {links.map((link) => (
            <li key={link.path}>
              <button type="button" className="backlink" onClick={() => onOpen(link.path)}>
                <span className="backlink-title">
                  <span className="backlink-icon" aria-hidden="true">
                    {icons.get(link.path) ?? <FileText />}
                  </span>
                  {link.title}
                </span>
                <span className="backlink-context">{link.context}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
