// Startseite nach der Vorlage (01-desktop-startseite-hell.png): Datum und Begrüßung, „Schnell notieren …“ mit
// Knöpfen für Datenbank, Vorlage und „+ Notiz“, „Zuletzt bearbeitet“ als Tabelle (mit „Alle Seiten“) und die
// Favoriten als Chips. Ein Klick öffnet im aktuellen Reiter, Strg+Klick oder Mittelklick in einem neuen.
// Auf dem Handy (Vorlage 03-handy-startseite-hell.png) stehen oben Vault-Umschalter, „Darstellung“ und
// „Einstellungen“; „Schnell notieren“ hat nur „+“, darunter die Schnellaktion „Pomodoro“ (am PC steht sie in der
// Seitenleiste unter „Werkzeuge“), „Zuletzt bearbeitet“ ist eine Karte mit „Alle“ und kurzen Zeiten.
import { ChevronsUpDown, CornerDownLeft, Database, FileCode, FileText, FolderOpen, FolderSearch, LayoutTemplate, Plus, Settings, SlidersHorizontal, Star, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { allePagesNachZeit, greeting, kurzesDatum, kurzeZeit, recentPages, relativeTime } from "../lib/home";
import { isHtmlPath } from "../lib/html";
import type { IndexEntry } from "../lib/search";
import { parentDir } from "../lib/tree";
import type { TreeNode } from "../lib/vault-api";
import { ModusKnopf } from "./Darstellung";
import { oeffnenKlick } from "./Reiterleiste";
import { Button, cx, IconButton, Menu, MenuItem, type MenuAnchor } from "./ui";

/** So viele Seiten zeigt „Zuletzt bearbeitet“, bis „Alle Seiten“ gewählt ist (auf dem Handy wie in der Vorlage 4). */
const ZULETZT = 5;
const ZULETZT_HANDY = 4;

/** Kopf der Handy-Startseite: Vault-Umschalter, „Darstellung“ und „Einstellungen“. */
export interface HandyKopf {
  vaultName: string;
  onSwitchVault: () => void;
  /** „Vault im Explorer öffnen“ (fehlt auf Android). */
  onRevealVault?: () => void;
  onOpenSettings: () => void;
  /** Schnellaktion „Pomodoro“ */
  onOpenPomodoro: () => void;
}

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
  /** Handy-Layout (schmaler Bildschirm) mit eigenem Kopf. */
  handy?: HandyKopf;
}

export function HomePage(props: Props) {
  const now = new Date();
  const [alle, setAlle] = useState(false);
  const handy = props.handy !== undefined;
  const seiten = useMemo(() => (alle ? allePagesNachZeit(props.index) : recentPages(props.index, handy ? ZULETZT_HANDY : ZULETZT)), [props.index, alle, handy]);
  const zeit = handy ? kurzeZeit : relativeTime;
  return (
    <div className={cx("home", handy && "is-handy")} role="region" aria-label="Startseite">
      {props.handy && <HandyStartKopf {...props.handy} />}
      <header className="home-hero">
        <p className="home-date">{kurzesDatum(now)}</p>
        <h1 className="home-greeting">{greeting(now)}</h1>
      </header>

      <SchnellNotieren onQuickNote={props.onQuickNote} onCreateNote={props.onCreateNote} onCreateDatabase={props.onCreateDatabase} onCreateFromTemplate={props.onCreateFromTemplate} />

      {props.handy && (
        <div className="home-schnellaktionen" role="group" aria-label="Schnellaktionen">
          <button type="button" className="home-chip home-schnellaktion" onClick={props.handy.onOpenPomodoro}>
            <Timer className="home-schnellaktion-symbol" aria-hidden="true" />
            <span className="home-chip-name">Pomodoro</span>
          </button>
        </div>
      )}

      <section className="home-section home-zuletzt" aria-label={alle ? "Alle Seiten" : "Zuletzt bearbeitet"}>
        <div className="home-section-head">
          <h2 className="home-section-title">{alle ? "Alle Seiten" : "Zuletzt bearbeitet"}</h2>
          {/* Auf dem Handy heißt der Link kurz „Alle“ (Vorlage 03). */}
          <button type="button" className="home-link" aria-pressed={alle} aria-label={alle ? "Zuletzt bearbeitet" : "Alle Seiten"} onClick={() => setAlle(!alle)}>
            {alle ? (handy ? "Zuletzt" : "Zuletzt bearbeitet") : handy ? "Alle" : "Alle Seiten"}
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
                    <span className="home-table-zeit">{entry.modified ? zeit(entry.modified, now.getTime()) : "–"}</span>
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

function HandyStartKopf({ vaultName, onSwitchVault, onRevealVault, onOpenSettings }: HandyKopf) {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  return (
    <div className="home-handy-kopf">
      <button
        type="button"
        className="vault-switcher home-handy-vault"
        title="Vault wechseln oder Einstellungen öffnen"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        onClick={(event) => setMenu(menu ? null : { element: event.currentTarget })}
      >
        <span className="vault-avatar" aria-hidden="true">
          {vaultName.trim().charAt(0).toUpperCase() || "V"}
        </span>
        <span className="vault-name">{vaultName}</span>
        <ChevronsUpDown className="vault-switcher-chevron" aria-hidden="true" />
      </button>
      <ModusKnopf className="home-handy-knopf" />
      <IconButton className="home-handy-knopf" label="Einstellungen" onClick={onOpenSettings}>
        <SlidersHorizontal />
      </IconButton>
      {menu && (
        <Menu anchor={menu} label="Vault" onClose={() => setMenu(null)}>
          <MenuItem icon={<FolderOpen />} onSelect={onSwitchVault}>
            Anderen Vault öffnen …
          </MenuItem>
          {onRevealVault && (
            <MenuItem icon={<FolderSearch />} onSelect={onRevealVault}>
              Vault im Explorer öffnen
            </MenuItem>
          )}
          <MenuItem icon={<Settings />} onSelect={onOpenSettings}>
            Einstellungen
          </MenuItem>
        </Menu>
      )}
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
          <span className="home-schnell-notiz-text">Notiz</span>
        </Button>
      </div>
    </div>
  );
}
