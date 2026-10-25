// Schaltflächen der App. Alle Knöpfe nutzen diese Komponenten, damit sie überall gleich aussehen.
// Varianten: primary (Hauptaktion, Akzentfarbe), secondary (mit Rahmen), ghost (ohne Rahmen), danger.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Symbol vor dem Text, z. B. ein Lucide-Icon. */
  icon?: ReactNode;
  /** Zusatz rechts, z. B. ein Tastenkürzel oder eine Zahl. */
  trailing?: ReactNode;
  /** Hervorgehoben, z. B. ein Filter ist aktiv. */
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, trailing, active = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-button", `ui-button--${variant}`, `ui-button--${size}`, active && "is-active", className)}
      {...rest}
    >
      {icon && (
        <span className="ui-button__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children !== undefined && children !== null && <span className="ui-button__label">{children}</span>}
      {trailing && <span className="ui-button__trailing">{trailing}</span>}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "icon" | "trailing"> {
  /** Pflicht: Name für Bildschirmleser und Hinweis beim Überfahren. */
  label: string;
  children: ReactNode;
}

/** Schaltfläche nur mit Symbol. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, variant = "ghost", size = "md", active = false, className, title, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx("ui-icon-button", `ui-button--${variant}`, `ui-icon-button--${size}`, active && "is-active", className)}
      {...rest}
    >
      <span className="ui-button__icon" aria-hidden="true">
        {children}
      </span>
    </button>
  );
});

/** Tastenkürzel-Hinweis, z. B. <Kbd>Strg+P</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

/** Kleine Zahl oder Markierung, z. B. Anzahl der Einträge. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  return <span className={cx("ui-badge", `ui-badge--${tone}`)}>{children}</span>;
}
