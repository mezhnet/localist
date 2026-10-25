// Eingabefelder: Textfeld (mit optionalem Symbol) und Auswahlliste.
// Varianten: default (mit Rahmen), inline (unsichtbar bis zum Überfahren, z. B. in Tabellenzellen)
// und bare (ganz ohne Rahmen, z. B. das große Suchfeld im Such-Dialog).
import { ChevronDown } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "./cx";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
  variant?: "default" | "inline" | "bare";
  /** Symbol links im Feld, z. B. eine Lupe. */
  icon?: ReactNode;
  /** Klasse für die Hülle, wenn ein Symbol gesetzt ist. */
  wrapClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "md", variant = "default", icon, wrapClassName, className, ...rest },
  ref,
) {
  const input = <input ref={ref} className={cx("ui-input", `ui-input--${variant}`, `ui-input--${inputSize}`, className)} {...rest} />;
  if (!icon) return input;
  return (
    <span className={cx("ui-input-wrap", `ui-input-wrap--${variant}`, `ui-input-wrap--${inputSize}`, wrapClassName)}>
      <span className="ui-input-wrap__icon" aria-hidden="true">
        {icon}
      </span>
      {input}
    </span>
  );
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  inputSize?: Exclude<InputSize, "lg">;
  wrapClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { inputSize = "md", wrapClassName, className, children, ...rest },
  ref,
) {
  return (
    <span className={cx("ui-select", `ui-select--${inputSize}`, wrapClassName)}>
      <select ref={ref} className={cx("ui-select__control", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="ui-select__chevron" aria-hidden="true" />
    </span>
  );
});

/** Beschriftetes Feld für Formulare: Titel, Eingabe und optionaler Hinweis. */
export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {hint && <span className="ui-field__hint">{hint}</span>}
    </div>
  );
}
