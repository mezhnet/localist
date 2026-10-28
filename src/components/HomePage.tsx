// Startseite nach der Vorlage (01-desktop-startseite-hell.png): Datum und Begrüßung, „Schnell notieren …“ mit
// Knöpfen für Datenbank, Vorlage und „+ Notiz“, „Zuletzt bearbeitet“ als Tabelle (mit „Alle Seiten“) und die
// Favoriten als Chips. Ein Klick öffnet im aktuellen Reiter, Strg+Klick oder Mittelklick in einem neuen.
import { CornerDownLeft, Database, FileCode, FileText, LayoutTemplate, Plus, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { allePagesNachZeit, greeting, kurzesDatum, recentPages, relativeTime } from "../lib/home";
import { isHtmlPath } from "../lib/html";
import type { IndexEntry } from "../lib/search";
import { parentDir } from "../lib/tree";
import type { TreeNode } from "../lib/vault-api";
import { oeffnenKlick } from "./Reiterleiste";
import { Button, cx, IconButton } from "./ui";

/** So viele Seiten zeigt „Zuletzt bearbeitet“, bis „Alle Seiten“ gewählt ist. */
const ZULETZT = 5;

interface Props {
  index: IndexEntry[];
  favorites: TreeNode[];
  icons: ReadonlyMap<string, string>;
  /** `neu`: Strg+Klick oder Mittelklick (neuer Reiter). */
  onOpen: (node: { path: string; kind: TreeNode["kind"] }, neu?: boolean) => void;
  onCreateNote: () => void;
  onCreateDatabase: () => void;
  onCreateFromTemplate: () => void;
  /** „Schnell notieren“: legt die Notiz an; true, wenn es geklappt hat (dann wird das Feld geleert). */
  onQuickNote: (text: string) => Promise<boolean>;
}

export function HomePage(props: Props) {
  const now = new Date();
  const [alle, setAlle] = useState(false);
  const seiten = useMemo(() => (alle ? allePagesNachZeit(props.index) : recentPages(props.index, ZULETZT)), [props.index, alle]);
  return (
    <div className="home" role="region" aria-label="Startseite">
      <header className="home-hero">
        <p className="home-date">{kurzesDatum(now)}</p>
        <h1 className="home-greeting">{greeting(now)}</h1>
      </header>

      <SchnellNotieren onQuickNote={props.onQuickNote} onCreateNote={props.onCreateNote} onCreateDatabase={props.onCreateDatabase} onCreateFromTemplate={props.onCreateFromTemplate} />

      <section className="home-section" aria-label={alle ? "Alle Seiten" : "Zuletzt bearbeitet"}>
        <div className="home-section-head">
          <h2 className="home-section-title">{alle ? "Alle Seiten" : "Zuletzt bearbeitet"}</h2>
          <button type="button" className="home-link" aria-pressed={alle} onClick={() => setAlle(!alle)}>
            {alle ? "Zuletzt bearbeitet" : "Alle Seiten"}
          </button>
        </div>
        {seiten.length === 0 ? (
          <p className="home-empty">Noch keine Seiten. Schreib oben etwas und drück Enter – das wird deine erste Notiz.</p>
        ) : (
          <div className="home-table">
            <div className="home-table-kopf" aria-hidden="true">
              <span>Name</span>
              <span>Ort</span>
              <span className="home-table-zeit">Bearbeitet</span>
            </div>
            <ul className="home-table-zeilen">
              {seiten.map((entry) => (
                <li key={entry.path}>
                  <button type="button" className="home-table-zeile" title={entry.path} {...oeffnenKlick((neu) => props.onOpen({ path: entry.path, kind: "page" }, neu))}>
                    <span className="home-table-name">
                      <SeitenSymbol emoji={props.icons.get(entry.path)} html={isHtmlPath(entry.path)} />
                      <span className="home-table-titel">{entry.title}</span>
                    </span>
                    <span className="home-table-ort">{parentDir(entry.path) || "Vault"}</span>
                    <span className="home-table-zeit">{entry.modified ? relativeTime(entry.modified, now.getTime()) : "–"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="home-section" aria-label="Favoriten">
        <h2 className="home-section-title">Favoriten</h2>
        {props.favorites.length === 0 ? (
          <p className="home-empty">Noch keine Favoriten. Hefte Seiten über den Stern oben rechts oder das „⋯“-Menü in der Seitenleiste an.</p>
        ) : (
          <ul className="home-chips">
            {props.favorites.map((node) => (
              <li key={node.path}>
                <button type="button" className="home-chip" title={node.path} {...oeffnenKlick((neu) => props.onOpen(node, neu))}>
                  <Star className="home-chip-stern" aria-hidden="true" />
                  <span className="home-chip-name">{node.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SeitenSymbol({ emoji, html }: { emoji?: string; html: boolean }) {
  return (
    <span className={cx("home-table-symbol", emoji && "is-emoji")} aria-hidden="true">
      {emoji ?? (html ? <FileCode /> : <FileText />)}
    </span>
  );
}

/**
 * „Schnell notieren …“: Enter legt eine Notiz in der Vault-Wurzel an (erste Zeile = Titel, Rest = Inhalt),
 * Umschalt+Enter macht eine neue Zeile, ein leeres Feld macht nichts. „+ Notiz“ tut dasselbe; ist das Feld leer,
 * legt es eine leere Notiz an und öffnet sie.
 */
function SchnellNotieren(props: Pick<Props, "onQuickNote" | "onCreateNote" | "onCreateDatabase" | "onCreateFromTemplate">) {
  const [text, setText] = useState("");
  const [speichert, setSpeichert] = useState(false);
  const speichern = async () => {
    if (speichert || text.trim() === "") return;
    setSpeichert(true);
    try {
      if (await props.onQuickNote(text)) setText("");
    } finally {
      setSpeichert(false);
    }
  };
  return (
    <div className="home-schnell">
      <textarea
        className="home-schnell-feld"
        aria-label="Schnell notieren"
        placeholder="Schnell notieren …"
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          void speichern();
        }}
      />
      <div className="home-schnell-leiste">
        <span className="home-schnell-hinweis" aria-hidden="true">
          <CornerDownLeft /> als neue Notiz speichern
        </span>
        <IconButton className="home-schnell-knopf" label="Neue Datenbank" title="Neue Datenbank" onClick={props.onCreateDatabase}>
          <Database />
        </IconButton>
        <IconButton className="home-schnell-knopf" label="Neue Seite aus Vorlage" title="Neue Seite aus Vorlage" onClick={props.onCreateFromTemplate}>
          <LayoutTemplate />
        </IconButton>
        <Button
          variant="primary"
          size="sm"
          className="home-schnell-notiz"
          icon={<Plus />}
          title={text.trim() ? "Als neue Notiz speichern (Enter)" : "Neue leere Notiz"}
          onClick={() => (text.trim() ? void speichern() : props.onCreateNote())}
        >
          Notiz
        </Button>
      </div>
    </div>
  );
}
