// Darstellung: Modus (Hell, Dunkel, Schwarz), „Wie System“ und Akzentfarbe. Der kleine Umschalter steht unten in
// der Seitenleiste, die ausführliche Wahl in Einstellungen → „Darstellung“ (Vorlage 05-handy-darstellung-dunkel.png).
import { Check, Circle, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { AKZENTE, MODI, useTheme, type Modus } from "../lib/theme";
import { cx, IconButton } from "./ui";
import { Switch } from "./ui/Switch";

const SYMBOL: Record<Modus, typeof Sun> = { light: Sun, dark: Moon, black: Circle };

/** Drei Knöpfe unten in der Seitenleiste; ein Klick wählt den Modus und schaltet „Wie System“ aus. */
export function ModusUmschalter() {
  const { resolved, wieSystem, setModus } = useTheme();
  return (
    <div className="modus-umschalter" role="group" aria-label="Modus">
      {MODI.map(({ value, label }) => {
        const Symbol = SYMBOL[value];
        const aktiv = resolved === value;
        return (
          <IconButton
            key={value}
            size="sm"
            label={label}
            title={aktiv && wieSystem ? `${label} (wie System)` : label}
            active={aktiv}
            aria-pressed={aktiv}
            className={cx("modus-knopf", `is-${value}`)}
            onClick={() => setModus(value)}
          >
            <Symbol />
          </IconButton>
        );
      })}
    </div>
  );
}

/** Abschnitt „Darstellung“ in den Einstellungen: Vorschaukarten, „Wie System“, Erklärung zu Schwarz, Akzentfarbe. */
export function DarstellungEinstellungen({ children }: { children?: ReactNode }) {
  const { resolved, wieSystem, akzent, setModus, setWieSystem, setAkzent } = useTheme();
  return (
    <section className="settings-section darstellung" role="group" aria-label="Darstellung">
      <h3 className="settings-titel">Darstellung</h3>
      <p className="settings-label">Modus</p>
      <div className="modus-karten">
        {MODI.map(({ value, label }) => (
          <button key={value} type="button" className={cx("modus-karte", resolved === value && "is-active")} aria-pressed={resolved === value} onClick={() => setModus(value)}>
            <span className={cx("modus-vorschau", `is-${value}`)} aria-hidden="true">
              <span className="modus-vorschau-leiste" />
              <span className="modus-vorschau-flaeche">
                <span className="modus-vorschau-titel" />
                <span className="modus-vorschau-zeile" />
                <span className="modus-vorschau-zeile is-kurz" />
                <span className="modus-vorschau-akzent" />
              </span>
            </span>
            <span className="modus-name">
              {label}
              {resolved === value && <Check aria-hidden="true" />}
            </span>
          </button>
        ))}
      </div>
      <div className="settings-row settings-karte">
        <div className="settings-text">
          <h4>Wie System</h4>
          <p>Wechselt automatisch mit deinem Gerät zwischen Hell und Dunkel bzw. Schwarz.</p>
        </div>
        <Switch label="Wie System" checked={wieSystem} onChange={setWieSystem} />
      </div>
      <p className="settings-hinweis">
        <strong>Schwarz</strong> nutzt echtes Schwarz statt Dunkelgrau. Auf OLED-Displays bleiben diese Pixel aus – das wirkt ruhiger und spart
        Akku.
      </p>
      <p className="settings-label" id="akzent-titel">
        Akzentfarbe
      </p>
      <div className="akzent-wahl" role="radiogroup" aria-labelledby="akzent-titel">
        {AKZENTE.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={akzent === value}
            aria-label={label}
            title={label}
            className={cx("akzent-punkt", `is-${value}`, akzent === value && "is-active")}
            onClick={() => setAkzent(value)}
          />
        ))}
      </div>
      {children}
    </section>
  );
}
