// Seitenlink im Obsidian-Format: [[Seitenname]] oder [[Seitenname|Anzeigetext]].
// Wohin ein Link führt und was ein Klick tut, entscheidet die App über den WikiLinkContext.
import { createReactInlineContentSpec } from "@blocknote/react";
import { createContext, useContext } from "react";
import { linkLabel } from "../lib/links";

export interface WikiLinkActions {
  /** Pfad der Seite, auf die der Link zeigt, oder null, wenn es sie (noch) nicht gibt. */
  resolve: (target: string) => string | null;
  /** Öffnet die Seite (und legt sie an, falls sie fehlt); `neu`: in einem neuen Reiter. */
  open: (target: string, neu?: boolean) => void;
  /** Passende Seiten für die Vorschläge nach "[[". */
  suggest: (query: string) => LinkSuggestion[];
}

export interface LinkSuggestion {
  title: string;
  folder: string;
  /** HTML-Seite statt Notiz (eigenes Symbol in den Vorschlägen). */
  html?: boolean;
  /** Was zwischen [[ und ]] eingefügt wird. */
  target: string;
}

export const WikiLinkContext = createContext<WikiLinkActions>({
  resolve: () => null,
  open: () => {},
  suggest: () => [],
});

function WikiLinkView({ target, alias }: { target: string; alias: string }) {
  const actions = useContext(WikiLinkContext);
  const exists = actions.resolve(target) !== null;
  return (
    <span
      className={`wikilink${exists ? "" : " unresolved"}`}
      title={exists ? `Öffnet „${target}“` : `„${target}“ gibt es noch nicht – Klick legt die Seite an`}
      role="link"
      onMouseDown={(event) => event.preventDefault()}
      // Strg+Klick oder Mittelklick: in einem neuen Reiter öffnen.
      onClick={(event) => actions.open(target, event.ctrlKey || event.metaKey)}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        actions.open(target, true);
      }}
    >
      {alias || linkLabel(target)}
    </span>
  );
}

export const WikiLink = createReactInlineContentSpec(
  {
    type: "wikilink",
    propSchema: {
      target: { default: "" },
      alias: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ inlineContent }) => <WikiLinkView target={inlineContent.props.target} alias={inlineContent.props.alias} />,
  },
);
