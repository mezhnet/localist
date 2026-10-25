// Seitenlink im Obsidian-Format: [[Seitenname]] oder [[Seitenname|Anzeigetext]].
// Wohin ein Link führt und was ein Klick tut, entscheidet die App über den WikiLinkContext.
import { createReactInlineContentSpec } from "@blocknote/react";
import { createContext, useContext } from "react";

export interface WikiLinkActions {
  /** Pfad der Seite, auf die der Link zeigt, oder null, wenn es sie (noch) nicht gibt. */
  resolve: (target: string) => string | null;
  /** Öffnet die Seite (und legt sie an, falls sie fehlt). */
  open: (target: string) => void;
}

export const WikiLinkContext = createContext<WikiLinkActions>({
  resolve: () => null,
  open: () => {},
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
      onClick={() => actions.open(target)}
    >
      {alias || target}
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
