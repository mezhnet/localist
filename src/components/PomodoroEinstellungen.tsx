// Abschnitt „Pomodoro“ in den Einstellungen (PC-Dialog und Handy-Einstellungen): Dauern von Fokus und Pausen,
// Runden bis zur langen Pause, „Pausen/Fokus automatisch starten“ und der Ton am Ende. Gespeichert wird in
// `.localist/settings.json` unter `pomodoro` (über useVaultSettings im Arbeitsbereich).
import { useEffect, useState } from "react";
import { begrenzen, GRENZEN, type PomodoroEinstellungen as Werte } from "../lib/pomodoro";
import { cx, Input } from "./ui";
import { Switch } from "./ui/Switch";

interface Props {
  einstellungen: Werte;
  onChange: (einstellungen: Werte) => void;
  handy?: boolean;
}

type ZahlFeld = keyof typeof GRENZEN;

const ZAHLEN: { feld: ZahlFeld; name: string; einheit: string }[] = [
  { feld: "fokus", name: "Fokus", einheit: "Min." },
  { feld: "kurz", name: "Kurze Pause", einheit: "Min." },
  { feld: "lang", name: "Lange Pause", einheit: "Min." },
  { feld: "runden", name: "Lange Pause nach", einheit: "Runden" },
];

const SCHALTER: { feld: "pausenAuto" | "fokusAuto" | "ton"; name: string; text: string }[] = [
  { feld: "pausenAuto", name: "Pausen automatisch starten", text: "Nach dem Fokus beginnt die Pause von selbst." },
  { feld: "fokusAuto", name: "Fokus automatisch starten", text: "Nach der Pause beginnt die nächste Runde von selbst." },
  { feld: "ton", name: "Ton am Ende", text: "Ein kurzer, ruhiger Ton, wenn eine Phase um ist." },
];

/** Zahlenfeld: Während des Tippens darf es leer sein; übernommen (und begrenzt) wird beim Verlassen oder mit Enter. */
function ZahlEingabe({ feld, name, einheit, wert, onWert }: { feld: ZahlFeld; name: string; einheit: string; wert: number; onWert: (wert: number) => void }) {
  const [text, setText] = useState(String(wert));
  useEffect(() => setText(String(wert)), [wert]);
  const [min, max] = GRENZEN[feld];
  const uebernehmen = () => {
    const neu = begrenzen(feld, text.trim() === "" ? wert : text);
    setText(String(neu));
    if (neu !== wert) onWert(neu);
  };
  return (
    <label className="pomodoro-feld">
      <span className="pomodoro-feld-name">{name}</span>
      <span className="pomodoro-feld-eingabe">
        <Input
          type="number"
          inputMode="numeric"
          inputSize="sm"
          min={min}
          max={max}
          step={1}
          aria-label={`${name} (${min}–${max} ${einheit})`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={uebernehmen}
          onKeyDown={(event) => {
            if (event.key === "Enter") uebernehmen();
          }}
        />
        <span className="pomodoro-feld-einheit">{einheit}</span>
      </span>
    </label>
  );
}

export function PomodoroEinstellungen({ einstellungen, onChange, handy = false }: Props) {
  return (
    <section className={cx("settings-section pomodoro-einstellungen", handy && "is-handy")} role="group" aria-label="Pomodoro">
      {!handy && <h3 className="settings-titel">Pomodoro</h3>}
      <div className="pomodoro-felder">
        {ZAHLEN.map(({ feld, name, einheit }) => (
          <ZahlEingabe key={feld} feld={feld} name={name} einheit={einheit} wert={einstellungen[feld]} onWert={(wert) => onChange({ ...einstellungen, [feld]: wert })} />
        ))}
      </div>
      {SCHALTER.map(({ feld, name, text }) => (
        <div key={feld} className="settings-row settings-karte">
          <div className="settings-text">
            <h4>{name}</h4>
            <p>{text}</p>
          </div>
          <Switch label={name} checked={einstellungen[feld]} onChange={(an) => onChange({ ...einstellungen, [feld]: an })} />
        </div>
      ))}
    </section>
  );
}

/** Kurzfassung für die Handy-Übersicht, z. B. „25 / 5 / 15 Min. · 4 Runden“. */
export function pomodoroKurz(e: Werte): string {
  return `${e.fokus} / ${e.kurz} / ${e.lang} Min. · ${e.runden} ${e.runden === 1 ? "Runde" : "Runden"}`;
}
