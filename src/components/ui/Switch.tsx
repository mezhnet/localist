import { cx } from "./cx";

interface SwitchProps {
  /** Name für Bildschirmleser. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Schalter für an/aus (role="switch"), z. B. „Wie System“. */
export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={cx("ui-switch", checked && "is-on")} onClick={() => onChange(!checked)}>
      <span className="ui-switch__knopf" aria-hidden="true" />
    </button>
  );
}
