// Mini-Timer (Etappe 23): Solange ein Pomodoro läuft oder pausiert ist, zeigt er Phase und Restzeit mit einem Knopf
// zum Pausieren bzw. Fortsetzen. Am PC steht er unten in der Seitenleiste (eingeklappt in der oberen Leiste), auf dem
// Handy als schmale Leiste über der Navigationsleiste. Ein Klick öffnet die Ansicht „Pomodoro“.
// Er liest nur Ausschnitte des Timers (usePomodoroAuswahl): So zeichnet er höchstens einmal pro Sekunde neu und der
// Arbeitsbereich drumherum gar nicht.
import { Pause, Play, Timer } from "lucide-react";
import type { CSSProperties } from "react";
import { PHASEN_NAME, restzeit, zeitText } from "../lib/pomodoro";
import { pomodoro, usePomodoroAuswahl } from "../lib/pomodoro-timer";
import { oeffnenKlick } from "./Reiterleiste";
import { cx, IconButton } from "./ui";

/** Läuft oder pausiert gerade ein Pomodoro? (Dann gibt es den Mini-Timer.) */
export function usePomodoroAktiv(): boolean {
  return usePomodoroAuswahl((stand) => stand.timer.lauf !== "bereit");
}

interface Props {
  /** „seitenleiste“ (PC unten in der Seitenleiste), „leiste“ (PC, obere Leiste bei eingeklappter Seitenleiste), „handy“ */
  ort: "seitenleiste" | "leiste" | "handy";
  /** `neu`: Strg+Klick oder Mittelklick (neuer Reiter). */
  onOeffnen: (neu: boolean) => void;
}

export function MiniTimer({ ort, onOeffnen }: Props) {
  const lauf = usePomodoroAuswahl((stand) => stand.timer.lauf);
  const phase = usePomodoroAuswahl((stand) => stand.timer.phase);
  const zeit = usePomodoroAuswahl((stand) => zeitText(restzeit(stand.timer, stand.jetzt)));
  /** Fortschritt in Prozent (ganze Zahlen, damit nicht in jedem Takt neu gezeichnet wird). */
  const prozent = usePomodoroAuswahl((stand) => Math.round(100 - (100 * restzeit(stand.timer, stand.jetzt)) / Math.max(1, stand.timer.dauer)));
  if (lauf === "bereit") return null;
  const laeuft = lauf === "laeuft";
  return (
    <div
      className={cx("mini-timer", `is-${ort}`, !laeuft && "is-pausiert", phase !== "fokus" && "is-pause")}
      role="group"
      aria-label="Pomodoro"
      style={{ "--mini-timer-fortschritt": `${prozent}%` } as CSSProperties}
    >
      <button type="button" className="mini-timer-oeffnen" title="Pomodoro öffnen" {...oeffnenKlick(onOeffnen)}>
        <Timer className="mini-timer-symbol" aria-hidden="true" />
        <span className="mini-timer-phase">{laeuft ? PHASEN_NAME[phase] : `${PHASEN_NAME[phase]} · pausiert`}</span>
        <span className="mini-timer-zeit" role="timer">
          {zeit}
        </span>
      </button>
      <IconButton size="sm" className="mini-timer-knopf" label={laeuft ? "Pomodoro pausieren" : "Pomodoro fortsetzen"} onClick={() => pomodoro.umschalten()}>
        {laeuft ? <Pause /> : <Play />}
      </IconButton>
    </div>
  );
}
