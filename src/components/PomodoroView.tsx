// Ansicht „Pomodoro“ (Werkzeug, Etappe 23): großer Fortschrittsring mit Restzeit in Monospace, Phase und Runde,
// Knöpfe Starten/Pausieren/Fortsetzen, Überspringen und Zurücksetzen, „Woran arbeitest du?“, der Link zur
// verknüpften Seite und darunter „Heute“ und „Diese Woche“ aus dem Verlauf im Vault. Der Timer selbst lebt in
// src/lib/pomodoro-timer.ts und läuft weiter, wenn diese Ansicht geschlossen wird. In der Ansicht startet und
// pausiert die Leertaste den Timer, solange kein Eingabefeld (oder Knopf) den Fokus hat.
import { Link2, Pause, Play, RotateCcw, SkipForward, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  lokaleZeit,
  PHASEN_NAME,
  restzeit,
  uebersicht,
  verlaufDatei,
  verlaufLesen,
  zeitText,
  zuLesendeMonate,
  type Phase,
  type Session,
} from "../lib/pomodoro";
import { pomodoro, usePomodoro } from "../lib/pomodoro-timer";
import type { IndexEntry } from "../lib/search";
import { pfadZurId } from "../lib/seiten-id";
import { pageTitle } from "../lib/tree";
import { readPage } from "../lib/vault-api";
import { oeffnenKlick } from "./Reiterleiste";
import { Button, cx, IconButton, Input } from "./ui";

interface Props {
  /** Suchindex: findet die Seite zur festen id (Link zur Seite, Seiten im Verlauf). */
  index: readonly IndexEntry[];
  /** `neu`: Strg+Klick oder Mittelklick (neuer Reiter). */
  onOpenPage: (path: string, neu: boolean) => void;
  /** Dauern und Schalter stehen in den Einstellungen. */
  onEinstellungen: () => void;
  handy?: boolean;
}

const PHASEN: Phase[] = ["fokus", "kurz", "lang"];
/** Ring im viewBox 0 0 120 120 */
const RADIUS = 54;
const UMFANG = 2 * Math.PI * RADIUS;

/** Fokus liegt in einem Eingabefeld, Knopf, Link, Menü oder Dialog: Dort gehört die Leertaste diesem Element. */
function leertasteGehoertAnderem(element: EventTarget | null): boolean {
  if (!(element instanceof Element)) return false;
  return element.closest('input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="menu"], [role="switch"]') !== null;
}

export function PomodoroView({ index, onOpenPage, onEinstellungen, handy = false }: Props) {
  const { timer, einstellungen, jetzt, verlauf } = usePomodoro();
  const rest = restzeit(timer, jetzt);
  const anteil = timer.dauer > 0 ? Math.min(1, Math.max(0, rest / timer.dauer)) : 0;
  const seitePfad = timer.seite ? pfadZurId(index, timer.seite) : null;
  const heute = useHeute(verlauf, jetzt);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
      if (leertasteGehoertAnderem(event.target) || leertasteGehoertAnderem(document.activeElement)) return;
      event.preventDefault(); // sonst scrollt die Seite
      pomodoro.umschalten();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hauptKnopf = timer.lauf === "laeuft" ? "Pausieren" : timer.lauf === "pausiert" ? "Fortsetzen" : "Starten";
  const titelZuId = (id: string | null) => {
    const pfad = id ? pfadZurId(index, id) : null;
    return pfad ? { pfad, titel: pageTitle(pfad) } : null;
  };

  return (
    <div className={cx("pomodoro", handy && "is-handy", `phase-${timer.phase}`, timer.lauf === "laeuft" && "is-laeuft")} role="region" aria-label="Pomodoro">
      <header className="pomodoro-kopf">
        <h1 className="pomodoro-titel">Pomodoro</h1>
        <Button variant="ghost" size="sm" className="pomodoro-einstellungen" icon={<SlidersHorizontal />} onClick={onEinstellungen} title="Dauern, Runden, Ton und automatischer Start">
          Einstellungen
        </Button>
      </header>

      <ol className="pomodoro-phasen" aria-label="Phasen">
        {PHASEN.map((phase) => (
          <li key={phase} className={cx("pomodoro-phasen-chip", timer.phase === phase && "is-aktiv")} aria-current={timer.phase === phase ? "step" : undefined}>
            {PHASEN_NAME[phase]}
            <span className="pomodoro-phasen-dauer">{einstellungen[phase]} Min.</span>
          </li>
        ))}
      </ol>

      <div className="pomodoro-uhr">
        <svg className="pomodoro-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle className="pomodoro-ring-spur" cx="60" cy="60" r={RADIUS} />
          <circle
            className="pomodoro-ring-rest"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={UMFANG}
            strokeDashoffset={UMFANG * (1 - anteil)}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="pomodoro-uhr-text">
          <span className="pomodoro-phase">{PHASEN_NAME[timer.phase]}</span>
          <span className="pomodoro-zeit" role="timer" aria-label={`Restzeit ${zeitText(rest)}`}>
            {zeitText(rest)}
          </span>
          <span className="pomodoro-runde">
            Runde {Math.min(timer.runde, einstellungen.runden)} von {einstellungen.runden}
          </span>
        </div>
      </div>

      <div className="pomodoro-knoepfe">
        <Button variant="ghost" className="pomodoro-knopf" icon={<RotateCcw />} onClick={() => pomodoro.zuruecksetzen()} title="Alles auf Anfang: Fokus, Runde 1">
          Zurücksetzen
        </Button>
        <Button
          variant="primary"
          className="pomodoro-start"
          icon={timer.lauf === "laeuft" ? <Pause /> : <Play />}
          onClick={() => pomodoro.umschalten()}
          title={`${hauptKnopf} (Leertaste)`}
        >
          {hauptKnopf}
        </Button>
        <Button variant="ghost" className="pomodoro-knopf" icon={<SkipForward />} onClick={() => pomodoro.ueberspringen()} title="Weiter zur nächsten Phase">
          Überspringen
        </Button>
      </div>

      <div className="pomodoro-ziel">
        <label className="pomodoro-ziel-label" htmlFor="pomodoro-ziel">
          Woran arbeitest du?
        </label>
        <Input
          id="pomodoro-ziel"
          className="pomodoro-ziel-feld"
          placeholder="z. B. Subnetting üben"
          value={timer.ziel}
          maxLength={200}
          onChange={(event) => pomodoro.zielSetzen(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur();
          }}
        />
        {timer.seite && (
          <div className="pomodoro-seite">
            <Link2 aria-hidden="true" />
            {seitePfad ? (
              <button type="button" className="pomodoro-seite-link" title={seitePfad} {...oeffnenKlick((neu) => onOpenPage(seitePfad, neu))}>
                {pageTitle(seitePfad)}
              </button>
            ) : (
              <span className="pomodoro-seite-fehlt">Verknüpfte Seite nicht gefunden</span>
            )}
            <IconButton size="sm" className="pomodoro-seite-loesen" label="Verknüpfung mit der Seite lösen" onClick={() => pomodoro.seiteSetzen(null)}>
              <X />
            </IconButton>
          </div>
        )}
      </div>

      <section className="pomodoro-verlauf" aria-label="Verlauf">
        <div className="pomodoro-zahlen">
          <div className="pomodoro-zahl" aria-label="Heute">
            <span className="pomodoro-zahl-name">Heute</span>
            <span className="pomodoro-zahl-wert">{heute.uebersicht.heuteMinuten} Min.</span>
            <span className="pomodoro-zahl-zusatz">
              {heute.uebersicht.heute.length} {heute.uebersicht.heute.length === 1 ? "Session" : "Sessions"}
            </span>
          </div>
          <div className="pomodoro-zahl" aria-label="Diese Woche">
            <span className="pomodoro-zahl-name">Diese Woche</span>
            <span className="pomodoro-zahl-wert">{heute.uebersicht.wocheMinuten} Min.</span>
            <span className="pomodoro-zahl-zusatz">seit Montag</span>
          </div>
        </div>
        <h2 className="pomodoro-verlauf-titel">Heute</h2>
        {heute.uebersicht.heute.length === 0 ? (
          <p className="pomodoro-leer">{heute.geladen ? "Noch keine Fokus-Session heute." : "Lädt …"}</p>
        ) : (
          <ul className="pomodoro-sessions">
            {[...heute.uebersicht.heute].reverse().map((session) => (
              <SessionZeile key={session.id} session={session} seite={titelZuId(session.seite)} onOpenPage={onOpenPage} />
            ))}
          </ul>
        )}
        <p className="pomodoro-hinweis">Gespeichert in „.localist/pomodoro/“ im Vault, eine Datei pro Monat. Pausen werden nicht gespeichert.</p>
      </section>
    </div>
  );
}

function SessionZeile({ session, seite, onOpenPage }: { session: Session; seite: { pfad: string; titel: string } | null; onOpenPage: Props["onOpenPage"] }) {
  return (
    <li className={cx("pomodoro-session", session.abgebrochen && "is-abgebrochen")}>
      <span className="pomodoro-session-zeit">
        {session.start.slice(11)}–{session.ende.slice(11)}
      </span>
      <span className="pomodoro-session-text">
        <span className="pomodoro-session-ziel">{session.ziel || "Ohne Ziel"}</span>
        {seite && (
          <button type="button" className="pomodoro-session-seite" title={seite.pfad} {...oeffnenKlick((neu) => onOpenPage(seite.pfad, neu))}>
            {seite.titel}
          </button>
        )}
      </span>
      <span className="pomodoro-session-minuten">
        {session.minuten} Min.{session.abgebrochen && <span className="pomodoro-session-abgebrochen"> · abgebrochen</span>}
      </span>
    </li>
  );
}

/**
 * Liest die Monatsdateien für „Heute“ und „Diese Woche“: neu, wenn eine Session geschrieben wurde (`verlauf`) oder
 * ein neuer Tag beginnt. Fehlt eine Datei, gibt es in dem Monat eben noch nichts.
 */
function useHeute(verlauf: number, jetzt: number) {
  const tag = lokaleZeit(jetzt).slice(0, 10);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    // Ab Mitternacht: So kommt auch der Vormonat dazu, wenn eine Session am 1. kurz nach Mitternacht endete.
    const monate = zuLesendeMonate(Date.parse(`${tag}T00:00`));
    void Promise.all(monate.map((monat) => readPage(verlaufDatei(monat)).then(verlaufLesen, () => [] as Session[]))).then((listen) => {
      if (!abgebrochen) setSessions(listen.flat());
    });
    return () => {
      abgebrochen = true;
    };
  }, [verlauf, tag]);
  // Die Übersicht hängt nur vom Tag ab (nicht von jeder Sekunde).
  const werte = useMemo(() => uebersicht(sessions ?? [], Date.parse(`${tag}T00:00`)), [sessions, tag]);
  return { uebersicht: werte, geladen: sessions !== null };
}
