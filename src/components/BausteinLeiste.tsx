// Werkzeugleiste über dem Code-Editor: ein Knopf je Baustein. Ein Klick fügt ihn an der Cursorposition ein
// (Bild und Seitenlink fragen vorher nach dem Ziel). Auf schmalen Bildschirmen lässt sie sich waagerecht scrollen.
import {
  ChartColumn,
  CircleQuestionMark,
  Columns2,
  Image,
  Layers,
  Link,
  ListChecks,
  ListCollapse,
  MessageSquareText,
  Minus,
  SquareCode,
  StickyNote,
  Table,
  type LucideIcon,
} from "lucide-react";
import { BAUSTEINE, type BausteinArt } from "../lib/bausteine";
import { Button } from "./ui";

export const BAUSTEIN_SYMBOLE: Record<BausteinArt, LucideIcon> = {
  callout: MessageSquareText,
  toggle: ListCollapse,
  tabelle: Table,
  checkliste: ListChecks,
  spalten: Columns2,
  bild: Image,
  trennlinie: Minus,
  code: SquareCode,
  seitenlink: Link,
  karteikarte: StickyNote,
  kartenstapel: Layers,
  quiz: CircleQuestionMark,
  diagramm: ChartColumn,
};

export function BausteinLeiste({ onPick }: { onPick: (art: BausteinArt) => void }) {
  return (
    <div className="baustein-leiste" role="toolbar" aria-label="Baustein einfügen">
      {BAUSTEINE.map((info) => {
        const Symbol = BAUSTEIN_SYMBOLE[info.art];
        return (
          <Button
            key={info.art}
            variant="ghost"
            size="sm"
            icon={<Symbol />}
            title={`${info.name} einfügen: ${info.beschreibung}`}
            // Der Fokus bleibt im Editor, damit die Cursorposition erhalten bleibt.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(info.art)}
          >
            {info.name}
          </Button>
        );
      })}
    </div>
  );
}
