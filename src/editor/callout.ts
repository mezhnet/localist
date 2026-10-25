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

function createCalloutFrame(block: any, editor: BlockNoteEditor<any, any, any>) {
  const kind = calloutKind(block.props.calloutType);
  const dom = document.createElement("div");
  dom.className = "callout-frame";
  dom.dataset.calloutType = kind.type;

  // Symbol mit unsichtbarer Auswahlliste darüber: Ein Klick wechselt den Callout-Typ.
  const iconBox = document.createElement("label");
  iconBox.className = "callout-icon";
  iconBox.title = `${kind.label} – klicken zum Ändern`;
  iconBox.textContent = kind.icon;
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
