// Untere Navigationsleiste auf dem Handy (Vorlage 03-handy-startseite-hell.png): Start, Suchen, „+“ (Neu-Menü),
// Seiten (Ordnerbaum mit Favoriten) und Einstellungen. Sie ersetzt den Menü-Knopf oben und lässt unten Platz für die
// Gestenleiste des Systems (safe-area-inset-bottom, siehe layout.css). Der mittlere Knopf ist dunkel hervorgehoben.
import { Folder, House, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { TreeNode } from "../lib/vault-api";
import { NewItems, type CreateKind } from "./Sidebar";
import { cx, Menu, type MenuAnchor } from "./ui";

export type NavZiel = "start" | "suchen" | "seiten" | "einstellungen";

interface Props {
  /** Hervorgehobener Eintrag (null, z. B. wenn eine Seite offen ist). */
  aktiv: NavZiel | null;
  tree: TreeNode[];
  onStart: () => void;
  onSuchen: () => void;
  onSeiten: () => void;
  onEinstellungen: () => void;
  onCreate: (kind: CreateKind, dir: string) => void;
}

export function Navigationsleiste({ aktiv, tree, onStart, onSuchen, onSeiten, onEinstellungen, onCreate }: Props) {
  const [neu, setNeu] = useState<MenuAnchor | null>(null);
  const eintrag = (ziel: NavZiel, text: string, Symbol: typeof House, onClick: () => void, label?: string) => (
    <button type="button" className={cx("handy-nav-eintrag", aktiv === ziel && "is-aktiv")} aria-label={label} aria-current={aktiv === ziel ? "page" : undefined} onClick={onClick}>
      <Symbol aria-hidden="true" />
      <span className="handy-nav-text">{text}</span>
    </button>
  );
  return (
    <nav className="handy-nav" aria-label="Navigation">
      {eintrag("start", "Start", House, onStart)}
      {eintrag("suchen", "Suchen", Search, onSuchen)}
      <button
        type="button"
        className="handy-nav-neu"
        aria-label="Neu"
        title="Neue Notiz, HTML-Seite, Ordner, Datenbank oder Notiz aus Vorlage"
        aria-haspopup="menu"
        aria-expanded={neu !== null}
        onClick={(event) => setNeu(neu ? null : { element: event.currentTarget })}
      >
        <Plus aria-hidden="true" />
      </button>
      {eintrag("seiten", "Seiten", Folder, onSeiten)}
      {eintrag("einstellungen", "Einstell.", SlidersHorizontal, onEinstellungen, "Einstellungen")}
      {neu && (
        <Menu anchor={neu} label="Neu" align="end" className="handy-nav-menu" onClose={() => setNeu(null)}>
          <NewItems dir="" tree={tree} onCreate={onCreate} />
        </Menu>
      )}
    </nav>
  );
}
