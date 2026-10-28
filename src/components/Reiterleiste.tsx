// Reiterleiste über dem Inhalt (PC, Vorlage 01/02): fester Reiter „Startseite“ ohne ×, dann die offenen Reiter mit
// Typ-Symbol und ×, am Ende „+“. Der aktive Reiter ist unterstrichen. Mittelklick schließt einen Reiter.
// Die Logik (öffnen, schließen, wechseln, merken) steht in src/lib/reiter.ts.
import { Blocks, BookOpen, Database, FileCode, FileText, House, Plus, X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
import { isHtmlPath } from "../lib/html";
import { istFest, type Reiter, type ReiterInhalt, type ReiterStand } from "../lib/reiter";
import { pageTitle } from "../lib/tree";
import { cx } from "./ui";

export function reiterTitel(inhalt: ReiterInhalt): string {
  if (inhalt.art === "start") return "Startseite";
  if (inhalt.art === "bausteine") return "Bausteine";
  return pageTitle(inhalt.pfad);
}

export function ReiterSymbol({ inhalt }: { inhalt: ReiterInhalt }) {
  if (inhalt.art === "start") return <House aria-hidden="true" />;
  if (inhalt.art === "bausteine") return <Blocks aria-hidden="true" />;
  if (inhalt.art === "datenbank") return <Database aria-hidden="true" />;
  if (inhalt.art === "notizbuch") return <BookOpen aria-hidden="true" />;
  return isHtmlPath(inhalt.pfad) ? <FileCode aria-hidden="true" /> : <FileText aria-hidden="true" />;
}

/**
 * Klick-Handler für alles, was eine Seite öffnet (Seitenleiste, Startseite, Strg+P, Links): ein Klick öffnet im
 * aktuellen Reiter, Strg+Klick oder Mittelklick in einem neuen.
 */
export function oeffnenKlick(oeffnen: (neu: boolean) => void) {
  return {
    onClick: (event: ReactMouseEvent) => oeffnen(event.ctrlKey || event.metaKey),
    onAuxClick: (event: ReactMouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      oeffnen(true);
    },
    // Mittelklick: kein automatisches Scrollen von Windows.
    onMouseDown: (event: ReactMouseEvent) => {
      if (event.button === 1) event.preventDefault();
    },
  };
}

/** Schmales Fenster oder Handy (unter 769 px): keine Reiterleiste. */
const SCHMAL = "(max-width: 768px)";

function schmalAbonnieren(melden: () => void) {
  const abfrage = typeof window.matchMedia === "function" ? window.matchMedia(SCHMAL) : null;
  abfrage?.addEventListener?.("change", melden);
  return () => abfrage?.removeEventListener?.("change", melden);
}

export function useSchmal(): boolean {
  return useSyncExternalStore(schmalAbonnieren, () => typeof window.matchMedia === "function" && window.matchMedia(SCHMAL).matches === true);
}

interface Props {
  stand: ReiterStand;
  onAktivieren: (id: number) => void;
  onSchliessen: (id: number) => void;
  onNeu: () => void;
}

export function Reiterleiste({ stand, onAktivieren, onSchliessen, onNeu }: Props) {
  const aktivRef = useRef<HTMLDivElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  // Der aktive Reiter bleibt sichtbar, wenn viele Reiter offen sind (nur die Leiste scrollt, nie die Seite).
  useEffect(() => {
    const liste = listeRef.current;
    const reiter = aktivRef.current;
    if (!liste || !reiter) return;
    if (reiter.offsetLeft < liste.scrollLeft) liste.scrollLeft = reiter.offsetLeft;
    else if (reiter.offsetLeft + reiter.offsetWidth > liste.scrollLeft + liste.clientWidth) liste.scrollLeft = reiter.offsetLeft + reiter.offsetWidth - liste.clientWidth;
  }, [stand.aktiv]);

  const reiter = (r: Reiter) => {
    const titel = reiterTitel(r.inhalt);
    const aktiv = r.id === stand.aktiv;
    const fest = istFest(r);
    return (
      <div
        key={r.id}
        ref={aktiv ? aktivRef : undefined}
        className={cx("reiter", aktiv && "is-aktiv", fest && "is-fest")}
        // Mittelklick: schließen (und vorher das automatische Scrollen von Windows verhindern).
        onMouseDown={(event) => event.button === 1 && event.preventDefault()}
        onAuxClick={(event) => {
          if (event.button !== 1 || fest) return;
          event.preventDefault();
          onSchliessen(r.id);
        }}
      >
        <button
          type="button"
          role="tab"
          className="reiter-knopf"
          aria-selected={aktiv}
          title={"pfad" in r.inhalt ? r.inhalt.pfad : titel}
          onClick={() => onAktivieren(r.id)}
        >
          <span className="reiter-symbol">
            <ReiterSymbol inhalt={r.inhalt} />
          </span>
          <span className="reiter-titel">{titel}</span>
        </button>
        {!fest && (
          <button type="button" className="reiter-schliessen" aria-label={`Reiter „${titel}“ schließen`} title="Schließen (Strg+W)" tabIndex={aktiv ? 0 : -1} onClick={() => onSchliessen(r.id)}>
            <X aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="reiterleiste">
      <div ref={listeRef} className="reiter-liste" role="tablist" aria-label="Offene Reiter">
        {stand.reiter.map(reiter)}
      </div>
      <button type="button" className="reiter-neu" aria-label="Neuer Reiter" title="Neuer Reiter (Strg+T)" onClick={onNeu}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}
