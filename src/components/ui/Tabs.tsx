// Reiter (z. B. Ansichten einer Datenbank) und Umschalter mit wenigen Möglichkeiten (z. B. Monat/Woche).
// Reiter lassen sich mit den Pfeiltasten wechseln.
import { forwardRef, useRef, type ButtonHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export function TabList({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const tabs = [...(ref.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
    const index = tabs.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
    next.click();
  };
  return (
    <div ref={ref} role="tablist" aria-label={label} className={cx("ui-tabs", className)} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  icon?: ReactNode;
}

export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab({ selected, icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={cx("ui-tab", selected && "is-selected", className)}
      {...rest}
    >
      {icon && (
        <span className="ui-tab__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="ui-tab__label">{children}</span>
    </button>
  );
});

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** Umschalter: genau eine Möglichkeit ist gewählt (Knöpfe mit aria-pressed). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className={cx("ui-segmented", `ui-segmented--${size}`)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={cx("ui-segmented__option", option.value === value && "is-selected")}
          onClick={() => onChange(option.value)}
        >
          {option.icon && (
            <span className="ui-segmented__icon" aria-hidden="true">
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
