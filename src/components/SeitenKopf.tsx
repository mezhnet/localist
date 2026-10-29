// Seitenkopf über dem Inhalt (Vorlage 02): links der Pfad „Ordner / Seite“, rechts der Speicherstatus in Monospace
// („Speichert …“, „gerade eben gespeichert“, „vor 3 Min. gespeichert“, Fehler deutlich in Rot), der Stern für
// Favoriten (gefüllt in Akzentfarbe) und „…“ mit denselben Aktionen wie das Kontextmenü der Seitenleiste.
// Auf dem Handy übernimmt die untere Navigationsleiste Menü und Suche (Navigationsleiste.tsx).
import { AlertTriangle, MoreHorizontal, Star } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { aktuellerSpeicherZustand, speicherZustandAbonnieren } from "../lib/autosave";
import { relativeTime } from "../lib/home";
import type { TreeNode } from "../lib/vault-api";
import { NodeItems, type NodeItemsProps } from "./Sidebar";
import { cx, IconButton, Menu, type MenuAnchor } from "./ui";

interface Props {
  /** Ordner auf dem Weg zur Seite (nur die Namen) und der Titel. */
  ordner: string[];
  titel: string;
  /** Eine Seite ist offen: dann gibt es den Speicherstatus. */
  istSeite: boolean;
  /** Letzte Änderung der Datei (Suchindex), solange in dieser Ansicht noch nichts gespeichert wurde. */
  geaendert?: number;
  /** Seite, Datenbank oder Notizbuch im Ordnerbaum (für Stern und „…“); fehlt z. B. bei „Bausteine“. */
  node: TreeNode | null;
  favorit: boolean;
  onFavorit: () => void;
  /** Aktionen für „…“ (wie im Kontextmenü der Seitenleiste). */
  aktionen: Omit<NodeItemsProps, "node" | "favorite" | "onToggleFavorite"> | null;
  /** Startseite: ohne Kopf (auf dem Handy hat sie einen eigenen, siehe HomePage.tsx). */
  start: boolean;
}

export function SeitenKopf(props: Props) {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  return (
    <header className={cx("topbar", props.start && "is-start")}>
      <nav className="breadcrumb" aria-label="Pfad">
        {props.ordner.map((name, i) => (
          <span key={i} className="breadcrumb-folder">
            <span className="breadcrumb-name">{name}</span>
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
          </span>
        ))}
        <span className="topbar-title">{props.titel}</span>
      </nav>
      <div className="topbar-actions">
        {props.istSeite && <Speicherstatus geaendert={props.geaendert} />}
        {props.node && (
          <IconButton
            label={props.favorit ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
            active={props.favorit}
            className="favorite-toggle"
            onClick={props.onFavorit}
          >
            <Star />
          </IconButton>
        )}
        {props.node && props.aktionen && (
          <IconButton className="topbar-mehr" label="Weitere Aktionen" aria-haspopup="menu" aria-expanded={menu !== null} onClick={(event) => setMenu({ element: event.currentTarget })}>
            <MoreHorizontal />
          </IconButton>
        )}
      </div>
      {menu && props.node && props.aktionen && (
        <Menu anchor={menu} label={`Aktionen für „${props.node.name}“`} align="end" onClose={() => setMenu(null)}>
          <NodeItems {...props.aktionen} node={props.node} favorite={props.favorit} onToggleFavorite={props.onFavorit} />
        </Menu>
      )}
    </header>
  );
}

/** „gerade eben gespeichert“, „vor 3 Min. gespeichert“, „am 12.10.2026 gespeichert“ */
export function gespeichertText(zeit: number, jetzt: number): string {
  const wann = relativeTime(zeit, jetzt);
  return /^\d/.test(wann) ? `am ${wann} gespeichert` : `${wann} gespeichert`;
}

/** Wie oft die relative Zeit („vor 3 Min.“) nachgezogen wird. */
const TAKT_MS = 30_000;

function Speicherstatus({ geaendert }: { geaendert?: number }) {
  const zustand = useSyncExternalStore(speicherZustandAbonnieren, aktuellerSpeicherZustand);
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    setJetzt(Date.now());
    const takt = window.setInterval(() => setJetzt(Date.now()), TAKT_MS);
    return () => window.clearInterval(takt);
  }, [zustand]);
  if (zustand.art === "fehler") {
    return (
      <span className="speicherstatus is-fehler" role="alert" title={zustand.meldung}>
        <AlertTriangle aria-hidden="true" />
        Nicht gespeichert
      </span>
    );
  }
  const text =
    zustand.art === "speichert"
      ? "Speichert …"
      : zustand.art === "gespeichert"
        ? gespeichertText(zustand.zeit, jetzt)
        : geaendert
          ? gespeichertText(Math.min(geaendert, jetzt), jetzt)
          : "";
  return (
    <span className="speicherstatus" role="status">
      {text}
    </span>
  );
}
