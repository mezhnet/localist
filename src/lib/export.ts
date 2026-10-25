// „Als eigenständige HTML-Datei exportieren“: Die Seite bekommt localist.css und localist.js eingebettet
// (statt der Verweise auf .localist/bausteine/) und Bilder aus dem Vault als data:-Adressen. So funktioniert
// die Datei überall, auch ohne Vault – per Doppelklick im Browser oder als Anhang einer E-Mail.
// Geändert wird über die Quellpositionen von parse5, der Rest der Seite bleibt wie er ist.
import { applyEdits, attr, isElement, parseWithPositions, resolveRelative, type Edit, type Element, type ParentNode } from "./html";
import { contentType } from "./seiten-schema";
import { parentDir } from "./tree";

export interface ExportQuellen {
  /** Gebündelte Bausteine (src-tauri/seite/localist.css und .js). */
  css: string;
  js: string;
  /** Inhalt einer Datei im Vault als Base64 (oder null, wenn es sie nicht gibt). */
  laden: (vaultPfad: string) => Promise<string | null>;
}

function* elemente(node: ParentNode): Generator<Element> {
  for (const kind of node.childNodes) {
    if (isElement(kind)) {
      yield kind;
      yield* elemente(kind);
    }
  }
}

const istRelativ = (wert: string) => wert.trim() !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(wert.trim()) && !/^[/#?\\]/.test(wert.trim());

/** `</script` bzw. `</style` im eingebetteten Text würde den Block vorzeitig beenden. */
const sicher = (text: string, tag: string) => text.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);

export async function eigenstaendigesHtml(html: string, seitenPfad: string, quellen: ExportQuellen): Promise<string> {
  const { document, offset } = parseWithPositions(html);
  const dir = parentDir(seitenPfad);
  const edits: Edit[] = [];
  const ersetzen = (element: Element, text: string) => {
    const ort = element.sourceCodeLocation!;
    edits.push({ start: offset + ort.startOffset, end: offset + ort.endOffset, text });
  };
  let body: Element | undefined;

  for (const element of elemente(document)) {
    if (element.tagName === "body") body = element;
    if (!element.sourceCodeLocation) continue;
    const href = attr(element, "href") ?? "";
    const src = attr(element, "src") ?? "";
    if (element.tagName === "link" && /(^|\/)localist\.css$/i.test(href)) {
      ersetzen(element, `<style>\n${sicher(quellen.css, "style")}</style>`);
    } else if (element.tagName === "script" && /(^|\/)localist\.js$/i.test(src)) {
      // Das Skript kommt ans Ende von <body>: eingebettet läuft es sofort, dann müssen die Bausteine schon da sein.
      ersetzen(element, "");
    } else if (element.tagName === "img" && istRelativ(src)) {
      const pfad = resolveRelative(dir, src.split(/[?#]/)[0]);
      const daten = pfad === null ? null : await quellen.laden(pfad);
      const ort = element.sourceCodeLocation.attrs?.src;
      if (daten !== null && ort && pfad !== null) {
        edits.push({ start: offset + ort.startOffset, end: offset + ort.endOffset, text: `src="data:${contentType(pfad)};base64,${daten}"` });
      }
    }
  }

  const skript = `<script>\n${sicher(quellen.js, "script")}</script>\n`;
  const ende = body?.sourceCodeLocation?.endTag?.startOffset;
  const stelle = ende === undefined ? html.length : offset + ende;
  edits.push({ start: stelle, end: stelle, text: skript });
  return applyEdits(html, edits);
}
