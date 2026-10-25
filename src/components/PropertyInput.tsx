// Eingabefeld für einen Eigenschaftswert, passend zum Typ. Wird in der Eigenschaften-Leiste
// einer Seite und in den Zellen der Tabellenansicht verwendet.
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useId, useState } from "react";
import { asList, normalizeValue, type PropertyType, type PropertyValue } from "../lib/properties";

interface Props {
  type: PropertyType;
  value: unknown;
  /** Vorschläge für Auswahl, Status und Mehrfachauswahl. */
  options?: string[];
  label: string;
  /** null = Feld entfernen. */
  onChange: (value: PropertyValue | null) => void;
}

export function PropertyInput({ type, value, options = [], label, onChange }: Props) {
  const listId = useId();
  const commit = (input: unknown) => {
    const next = normalizeValue(type, input);
    if (JSON.stringify(next) !== JSON.stringify(value ?? null)) onChange(next);
  };

  switch (type) {
    case "checkbox":
      return (
        <input
          type="checkbox"
          className="prop-checkbox"
          aria-label={label}
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      );
    case "datum":
      return <DateInput label={label} value={typeof value === "string" ? value : ""} onCommit={commit} />;
    case "mehrfachauswahl":
      return <MultiSelect label={label} values={asList(value)} options={options} onCommit={commit} />;
    default: {
      const datalist = (type === "auswahl" || type === "status") && options.length > 0;
      return (
        <span className="prop-text">
          <TextInput
            label={label}
            value={value === undefined || value === null ? "" : asList(value).join(", ")}
            inputType={type === "zahl" ? "number" : type === "url" ? "url" : "text"}
            list={datalist ? listId : undefined}
            className={type === "auswahl" || type === "status" ? `prop-input prop-select status-${String(value ?? "").toLowerCase().replace(/\s+/g, "-")}` : "prop-input"}
            onCommit={commit}
          />
          {datalist && (
            <datalist id={listId}>
              {options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
          {type === "url" && typeof value === "string" && value !== "" && (
            <button type="button" className="prop-open" title="Im Browser öffnen" onClick={() => void openLink(value)}>
              ↗
            </button>
          )}
        </span>
      );
    }
  }
}

async function openLink(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

/** Textfeld, das erst beim Verlassen oder mit Enter übernimmt (nicht bei jedem Tastendruck speichern). */
function TextInput(props: {
  label: string;
  value: string;
  inputType: string;
  list?: string;
  className: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  return (
    <input
      type={props.inputType}
      className={props.className}
      aria-label={props.label}
      placeholder="Leer"
      list={props.list}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        // Auswahl aus der Vorschlagsliste sofort übernehmen.
        if (props.list && (event.nativeEvent as InputEvent).inputType === undefined) props.onCommit(event.target.value);
      }}
      onBlur={() => props.onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(props.value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function DateInput({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [withTime, setWithTime] = useState(value.includes("T"));
  useEffect(() => setWithTime(value.includes("T")), [value]);
  const shown = withTime ? (value.includes("T") ? value : value ? `${value}T09:00` : "") : value.slice(0, 10);
  return (
    <span className="prop-date">
      <input
        type={withTime ? "datetime-local" : "date"}
        className="prop-input"
        aria-label={label}
        value={shown}
        onChange={(event) => onCommit(event.target.value)}
      />
      <button
        type="button"
        className={`prop-time-toggle${withTime ? " active" : ""}`}
        title={withTime ? "Uhrzeit entfernen" : "Uhrzeit hinzufügen"}
        aria-label={withTime ? "Uhrzeit entfernen" : "Uhrzeit hinzufügen"}
        onClick={() => {
          const next = !withTime;
          setWithTime(next);
          if (value) onCommit(next ? (value.includes("T") ? value : `${value}T09:00`) : value.slice(0, 10));
        }}
      >
        🕒
      </button>
    </span>
  );
}

function MultiSelect({ label, values, options, onCommit }: { label: string; values: string[]; options: string[]; onCommit: (value: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !values.includes(trimmed)) onCommit([...values, trimmed]);
    setDraft("");
  };
  return (
    <span className="prop-multi">
      {values.map((item) => (
        <span key={item} className="prop-chip">
          {item}
          <button type="button" aria-label={`„${item}“ entfernen`} onClick={() => onCommit(values.filter((v) => v !== item))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="prop-input prop-multi-input"
        aria-label={label}
        placeholder={values.length === 0 ? "Leer" : "+"}
        list={listId}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if ((event.nativeEvent as InputEvent).inputType === undefined && options.includes(event.target.value)) add(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(draft);
          }
          if (event.key === "Backspace" && draft === "" && values.length > 0) onCommit(values.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id={listId}>
        {options
          .filter((option) => !values.includes(option))
          .map((option) => (
            <option key={option} value={option} />
          ))}
      </datalist>
    </span>
  );
}
