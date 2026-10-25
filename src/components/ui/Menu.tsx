// Aufklappmenü für Rechtsklick und "⋯"-Knöpfe. Es erscheint am Mauszeiger oder unter einem Element,
// bleibt immer ganz im Fenster, schließt bei Klick daneben, Escape oder nach einer Auswahl
// und lässt sich mit den Pfeiltasten bedienen.
import { Check } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

/** Wo das Menü erscheint: an einem Punkt (Rechtsklick) oder unter einem Element (Knopf). */
export type MenuAnchor = { x: number; y: number } | { element: HTMLElement };

const MenuContext = createContext<{ close: () => void }>({ close: () => {} });

const ITEM_SELECTOR = ["menuitem", "menuitemradio", "menuitemcheckbox"].map((role) => `[role="${role}"]:not(:disabled)`).join(",");
const GAP = 4;
const MARGIN = 8;

interface MenuProps {
  anchor: MenuAnchor;
  onClose: () => void;
  label?: string;
  /** Unter einem Element: linksbündig (start) oder rechtsbündig (end). */
  align?: "start" | "end";
  className?: string;
  children: ReactNode;
}

export function Menu({ anchor, onClose, label, align = "start", className, children }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Position berechnen, bevor das Menü zu sehen ist.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left: number;
    let top: number;
    if ("element" in anchor) {
      const rect = anchor.element.getBoundingClientRect();
      left = align === "end" ? rect.right - width : rect.left;
      top = rect.bottom + GAP;
      if (top + height > window.innerHeight - MARGIN && rect.top - GAP - height >= MARGIN) top = rect.top - GAP - height;
    } else {
      left = anchor.x;
      top = anchor.y + height > window.innerHeight - MARGIN ? anchor.y - height : anchor.y;
    }
    setPosition({
      left: Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN)),
      top: Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN)),
    });
  }, [anchor, align]);

  // Fokus auf den ersten Eintrag, danach zurück dorthin, wo er vorher war.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus({ preventScroll: true });
    const menu = ref.current;
    return () => {
      const focusLost = document.activeElement === document.body || (menu?.contains(document.activeElement) ?? false);
      if (focusLost && previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  // Schließen bei Klick daneben, Escape und Größenänderung des Fensters.
  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      // Der Knopf, der das Menü geöffnet hat, schaltet es selbst wieder zu.
      if ("element" in anchor && anchor.element.contains(target)) return;
      onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const onResize = () => onCloseRef.current();
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [anchor]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => {
      event.preventDefault();
      event.stopPropagation();
      items[(next + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") focusAt(index + 1);
    else if (event.key === "ArrowUp") focusAt(index < 0 ? items.length - 1 : index - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(items.length - 1);
    else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  // Das Menü hängt am Ende von <body>, damit es nie abgeschnitten wird. Ereignisse aus dem Menü sollen
  // aber nicht an die Komponenten weiterwandern, in denen es steht (z. B. ein Klick auf einen Kalendertag).
  const stop = (event: ReactMouseEvent) => event.stopPropagation();
  return createPortal(
    <MenuContext.Provider value={{ close: onClose }}>
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        className={cx("ui-menu", className)}
        style={position ?? { left: 0, top: 0, visibility: "hidden" }}
        onKeyDown={onKeyDown}
        onClick={stop}
        onMouseDown={stop}
        onDoubleClick={stop}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {children}
      </div>
    </MenuContext.Provider>,
    document.body,
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  /** Rot hervorgehoben, z. B. Löschen. */
  danger?: boolean;
  disabled?: boolean;
  /** Hinweis rechts, z. B. ein Tastenkürzel (gehört nicht zum Namen des Eintrags). */
  hint?: ReactNode;
  title?: string;
  /** Auswahl aus mehreren Möglichkeiten (Häkchen bei der aktuellen). */
  checked?: boolean;
}

export function MenuItem({ icon, children, onSelect, danger = false, disabled = false, hint, title, checked }: MenuItemProps) {
  const { close } = useContext(MenuContext);
  const isRadio = checked !== undefined;
  return (
    <button
      type="button"
      role={isRadio ? "menuitemradio" : "menuitem"}
      aria-checked={isRadio ? checked : undefined}
      tabIndex={-1}
      disabled={disabled}
      title={title}
      className={cx("ui-menu__item", danger && "is-danger", checked && "is-checked")}
      onClick={() => {
        close();
        onSelect();
      }}
    >
      <span className="ui-menu__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ui-menu__label">{children}</span>
      {hint && (
        <span className="ui-menu__hint" aria-hidden="true">
          {hint}
        </span>
      )}
      {checked && (
        <span className="ui-menu__check" aria-hidden="true">
          <Check />
        </span>
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="ui-menu__separator" />;
}

/** Überschrift einer Gruppe im Menü. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" className="ui-menu__group-label">
      {children}
    </div>
  );
}

/** Zustand eines Menüs: geöffnet am Mauszeiger oder unter dem Knopf, der es auslöst. */
export function useMenu() {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return {
    anchor,
    close: () => setAnchor(null),
    /** Für onContextMenu: öffnet am Mauszeiger. */
    openAtPointer: (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setAnchor({ x: event.clientX, y: event.clientY });
    },
    /** Für onClick eines Knopfs: öffnet darunter, ein zweiter Klick schließt wieder. */
    toggleBelow: (event: ReactMouseEvent<HTMLElement>) => {
      event.stopPropagation();
      const element = event.currentTarget;
      setAnchor((current) => (current && "element" in current && current.element === element ? null : { element }));
    },
  };
}
