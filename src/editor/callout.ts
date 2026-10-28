// Callout-Block im Obsidian-Format ("> [!info] Titel"). Ein Toggle ist ein einklappbarer Callout
// ("> [!note]- Titel" startet zugeklappt, "+" aufgeklappt). Der Titel ist der Text des Blocks,
// der Inhalt sind seine Kind-Blöcke.
import { createBlockSpec, createToggleFrame, type BlockNoteEditor } from "@blocknote/core";

export interface CalloutKind {
  type: string;
  label: string;
  icon: string;
}

/** Die Callout-Typen von Obsidian (Auswahl), mit deutscher Bezeichnung. */
export const CALLOUT_KINDS: CalloutKind[] = [
  { type: "note", label: "Notiz", icon: "✏️" },
  { type: "info", label: "Info", icon: "ℹ️" },
  { type: "tip", label: "Tipp", icon: "💡" },
  { type: "success", label: "Erledigt", icon: "✅" },
  { type: "question", label: "Frage", icon: "❓" },
  { type: "warning", label: "Warnung", icon: "⚠️" },
  { type: "danger", label: "Gefahr", icon: "⛔" },
  { type: "bug", label: "Fehler", icon: "🐞" },
  { type: "example", label: "Beispiel", icon: "📋" },
  { type: "quote", label: "Zitat", icon: "❝" },
  { type: "abstract", label: "Zusammenfassung", icon: "📄" },
  { type: "todo", label: "Aufgabe", icon: "☑️" },
];

export function calloutKind(type: string): CalloutKind {
  const lower = type.toLowerCase();
  return CALLOUT_KINDS.find((kind) => kind.type === lower) ?? { type: lower, label: type, icon: "📌" };
}

// Ob ein Toggle offen ist, ist Ansichtssache und gehört nicht in die Datei.
// Ohne eigene Wahl gilt das Faltzeichen: "+" offen, "-" zu.
const openState = new Map<string, boolean>();

/** Merkt einen Toggle als geöffnet, z. B. direkt nach dem Einfügen über das Slash-Menü. */
export function markToggleOpen(blockId: string): void {
  openState.set(blockId, true);
}

function isOpen(block: { id: string; props: { fold: string } }): boolean {
  return block.props.fold === "" || (openState.get(block.id) ?? block.props.fold === "+");
}

/** Linien-Symbole (lucide, 24 × 24, ohne Füllung) je Callout-Typ; die Farbe kommt aus dem CSS. */
const SYMBOLE: Record<string, string> = {
  note: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  tip: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  success: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  danger: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  bug: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  example: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>',
  abstract: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  todo: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
};
const PIN = '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>';

function calloutSymbol(type: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, wert] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) {
    svg.setAttribute(name, wert);
  }
  // Feste Zeichenketten aus SYMBOLE, keine Nutzerdaten.
  svg.innerHTML = SYMBOLE[type] ?? PIN;
  return svg;
}

function createCalloutFrame(block: any, editor: BlockNoteEditor<any, any, any>) {
  const kind = calloutKind(block.props.calloutType);
  const dom = document.createElement("div");
  dom.className = "callout-frame";
  dom.dataset.calloutType = kind.type;

  // Symbol mit unsichtbarer Auswahlliste darüber: Ein Klick wechselt den Callout-Typ.
  const iconBox = document.createElement("label");
  iconBox.className = "callout-icon";
  iconBox.title = `${kind.label} – klicken zum Ändern`;
  iconBox.append(calloutSymbol(kind.type));
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Callout-Typ");
  const kinds = CALLOUT_KINDS.some((k) => k.type === kind.type) ? CALLOUT_KINDS : [kind, ...CALLOUT_KINDS];
  for (const option of kinds) {
    const element = document.createElement("option");
    element.value = option.type;
    element.textContent = `${option.icon} ${option.label}`;
    element.selected = option.type === kind.type;
    select.append(element);
  }
  select.addEventListener("change", () => editor.updateBlock(block.id, { props: { calloutType: select.value } }));
  iconBox.append(select);

  if (block.props.fold === "") {
    const slot = document.createElement("div");
    slot.className = "callout-slot";
    dom.append(iconBox, slot);
    return { dom, slot, update: () => false };
  }

  const toggle = createToggleFrame(block, editor, {
    get: (b) => isOpen({ id: b.id, props: { fold: block.props.fold } }),
    set: (b, open) => openState.set(b.id, open),
  });
  dom.classList.add("callout-foldable");
  dom.append(iconBox, toggle.dom);
  return {
    dom,
    slot: toggle.slot,
    update: (updated: any) =>
      updated.props.calloutType === block.props.calloutType && updated.props.fold === block.props.fold
        ? toggle.update(updated)
        : false,
  };
}

export const createCalloutBlockSpec = createBlockSpec(
  {
    type: "callout" as const,
    propSchema: {
      calloutType: { default: "info" as string },
      fold: { default: "" as const, values: ["", "+", "-"] as const },
    },
    content: "inline" as const,
  },
  {
    // Enter im Titel springt in den Inhalt (wie bei Notion-Toggles), solange er sichtbar ist.
    experimental_keyboard: (block) => {
      const open = isOpen(block);
      return {
        enter: open ? "into-children" : "split",
        splitKeepsChildren: !open,
        emptyChildEnter: open ? "stay" : "outdent",
      };
    },
    meta: {
      isolating: false,
      dropsIntoChildren: () => true,
    },
    render: () => {
      const title = document.createElement("p");
      title.className = "callout-title";
      return { dom: title, contentDOM: title };
    },
    renderFrame: createCalloutFrame,
  },
);
