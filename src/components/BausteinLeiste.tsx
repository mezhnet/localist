// Werkzeugleiste über dem Code-Editor: ein Knopf je Baustein, dahinter die eigenen Bausteine des Vaults und
// „Als Baustein speichern“ (markierten Code in den Code-Speicher legen). Ein Klick fügt den Baustein an der
// Cursorposition ein (Bild und Seitenlink fragen vorher nach dem Ziel). Auf schmalen Bildschirmen lässt sie sich
// waagerecht scrollen.
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
  Puzzle,
  Save,
  SquareCode,
  StickyNote,
  Table,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { BAUSTEINE, type BausteinArt } from "../lib/bausteine";
import type { EigenerBaustein } from "../lib/eigene-bausteine";
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

/** Der Fokus bleibt im Editor, damit Cursorposition und Markierung erhalten bleiben. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

interface Props {
  onPick: (art: BausteinArt) => void;
  eigene?: EigenerBaustein[];
  onPickEigen?: (name: string) => void;
  /** Markierten Code als eigenen Baustein speichern. */
  onSave?: () => void;
}

export function BausteinLeiste({ onPick, eigene = [], onPickEigen, onSave }: Props) {
  return (
    <div className="baustein-leiste" role="toolbar" aria-label="Baustein einfügen">
      {BAUSTEINE.map((info) => {
        const Symbol = BAUSTEIN_SYMBOLE[info.art];
        return (
          <Button key={info.art} variant="ghost" size="sm" icon={<Symbol />} title={`${info.name} einfügen: ${info.beschreibung}`} onMouseDown={keepFocus} onClick={() => onPick(info.art)}>
            {info.name}
          </Button>
        );
      })}
      {(eigene.length > 0 || onSave) && <span className="baustein-leiste__trenner" aria-hidden="true" />}
      {eigene.map((baustein) => (
        <Button
          key={baustein.name}
          variant="ghost"
          size="sm"
          icon={<Puzzle />}
          className="baustein-leiste__eigen"
          title={`Eigener Baustein „${baustein.name}“ einfügen${baustein.beschreibung ? `: ${baustein.beschreibung}` : ""}`}
          onMouseDown={keepFocus}
          onClick={() => onPickEigen?.(baustein.name)}
        >
          {baustein.name}
        </Button>
      ))}
      {onSave && (
        <Button variant="ghost" size="sm" icon={<Save />} title="Markierten Code als eigenen Baustein speichern" onMouseDown={keepFocus} onClick={onSave}>
          Als Baustein speichern
        </Button>
      )}
    </div>
  );
}
