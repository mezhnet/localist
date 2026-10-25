// Dialogfenster über der App mit abgedunkeltem Hintergrund. Escape oder ein Klick daneben schließt ihn
// (wenn onClose gesetzt ist), der Fokus bleibt im Dialog und kehrt danach dorthin zurück, wo er war.
import { X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./Button";
import { cx } from "./cx";

const FOCUSABLE = 'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  /** Name für Bildschirmleser (auch ohne sichtbaren Titel). */
  label: string;
  /** Sichtbare Überschrift mit Schließen-Knopf. */
  title?: ReactNode;
  /** Ohne onClose lässt sich der Dialog nur über seine eigenen Knöpfe schließen. */
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** "top" für Such-Dialoge (wie Strg+P), "center" für alles andere. */
  placement?: "top" | "center";
  className?: string;
}

export function Dialog({ label, title, onClose, children, footer, size = "md", placement = "center", className }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus();
    }
    return () => {
      if (previous?.isConnected && (document.activeElement === document.body || dialog?.contains(document.activeElement))) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape" && onClose) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    // Mit Tab im Dialog bleiben.
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={cx("ui-dialog-backdrop", `ui-dialog-backdrop--${placement}`)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx("ui-dialog", `ui-dialog--${size}`, className)}
        onKeyDown={onKeyDown}
      >
        {title !== undefined && (
          <header className="ui-dialog__header">
            <h2 className="ui-dialog__title">{title}</h2>
            {onClose && (
              <IconButton label="Schließen" size="sm" onClick={onClose}>
                <X />
              </IconButton>
            )}
          </header>
        )}
        <div className="ui-dialog__body">{children}</div>
        {footer && <footer className="ui-dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
