// Menü „Baustein wählen …“ im Block-Editor (Vorlage 02): oben eine Filterzeile („Bausteine filtern …“, zeigt, was
// nach „/“ getippt wurde), darunter die Bausteine mit Symbol-Kästchen; der markierte Eintrag trägt den Hinweis ↵.
// Öffnet sich über „/“ und über das „+“ neben dem Block. Tastatur und Auswahl steuert BlockNote
// (SuggestionMenuController), diese Komponente zeichnet nur.
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from "@blocknote/react";
import {
  CheckSquare,
  ChevronRight,
  Code,
  CornerDownLeft,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  List,
  ListOrdered,
  Minus,
  Quote,
  Search,
  Smile,
  Table,
  Type,
} from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "./ui";

/** Symbol-Kästchen je Baustein (Linien-Symbole wie in der Seitenleiste). */
const SYMBOLE: Record<string, ReactNode> = {
  Text: <Type />,
  Überschrift: <Heading1 />,
  "Überschrift 2": <Heading2 />,
  "Überschrift 3": <Heading3 />,
  Checkliste: <CheckSquare />,
  Callout: <Info />,
  Toggle: <ChevronRight />,
  Tabelle: <Table />,
  Bild: <Image />,
  Aufzählungsliste: <List />,
  "Nummerierte Liste": <ListOrdered />,
  Zitat: <Quote />,
  Codeblock: <Code />,
  Trennlinie: <Minus />,
  Emoji: <Smile />,
};

export function bausteinSymbol(titel: string): ReactNode | undefined {
  return SYMBOLE[titel];
}

/** Was nach „/“ getippt wurde; die Filterzeile zeigt es sofort (auch wenn die Treffer gleich bleiben). */
export function abfrageSpeicher() {
  let wert = "";
  const hoerer = new Set<() => void>();
  return {
    holen: () => wert,
    setzen: (neu: string) => {
      if (neu === wert) return;
      wert = neu;
      hoerer.forEach((h) => h());
    },
    abonnieren: (h: () => void) => {
      hoerer.add(h);
      return () => {
        hoerer.delete(h);
      };
    },
  };
}

/** Erzeugt die Menü-Komponente zu einem Abfrage-Speicher. */
export function bausteinMenu(abfrage: ReturnType<typeof abfrageSpeicher>) {
  return function BausteinMenu({ items, selectedIndex, onItemClick }: SuggestionMenuProps<DefaultReactSuggestionItem>) {
    const liste = useRef<HTMLDivElement>(null);
    // Der markierte Eintrag bleibt im Bild (Pfeiltasten).
    useEffect(() => {
      const element = liste.current?.querySelector<HTMLElement>(".baustein-menu-eintrag.is-markiert");
      element?.scrollIntoView?.({ block: "nearest" });
    }, [selectedIndex]);
    const text = useSyncExternalStore(abfrage.abonnieren, abfrage.holen);
    return (
      <div className="baustein-menu bn-suggestion-menu" role="listbox" aria-label="Baustein wählen" id="bn-suggestion-menu">
        <div className="baustein-menu-filter" aria-hidden="true">
          <Search />
          <span className={cx(!text && "is-leer")}>{text || "Bausteine filtern …"}</span>
        </div>
        <div ref={liste} className="baustein-menu-liste">
          {items.length === 0 && <div className="baustein-menu-leer">Kein passender Baustein</div>}
          {items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              id={`bn-suggestion-menu-item-${index}`}
              className={cx("baustein-menu-eintrag", index === selectedIndex && "is-markiert")}
              title={item.subtext}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onItemClick?.(item)}
            >
              <span className="baustein-menu-symbol" aria-hidden="true">
                {bausteinSymbol(item.title) ?? item.icon}
              </span>
              <span className="baustein-menu-titel">{item.title}</span>
              {index === selectedIndex && <CornerDownLeft className="baustein-menu-enter" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    );
  };
}
