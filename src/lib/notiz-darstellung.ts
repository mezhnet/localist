// Gemeinsame Schritte für Notizbuch, Umwandeln und Export: Bilder einer Notiz im Vault suchen und die Notiz
// als HTML-Seite darstellen (src/lib/notiz-html.ts).
import { isHtmlPath } from "./html";
import type { PageRef } from "./links";
import { bildZiele, notizAlsHtml } from "./notiz-html";
import { pageTitle } from "./tree";
import { anhangPfad, readPage } from "./vault-api";

/** Sucht die Bilder einer Notiz im Vault (relativ zur Notiz oder zum Vault) und liefert eine Nachschlage-Funktion. */
export async function bilderSuchen(markdown: string, notizPfad: string): Promise<(ziel: string) => string | null> {
  const karte = new Map<string, string | null>();
  for (const ziel of bildZiele(markdown)) {
    try {
      karte.set(ziel, await anhangPfad(notizPfad, ziel));
    } catch {
      karte.set(ziel, null);
    }
  }
  return (ziel) => karte.get(ziel) ?? null;
}

/** HTML einer Seite: HTML-Seiten wie sie sind, Notizen umgewandelt (`pfad` = Pfad der HTML-Fassung). */
export async function seiteAlsHtml(quelle: string, pfad: string, pages: readonly PageRef[], neueId?: string): Promise<string> {
  const text = await readPage(quelle);
  if (isHtmlPath(quelle)) return text;
  return notizAlsHtml(text, { pfad, titel: pageTitle(quelle), pages, bild: await bilderSuchen(text, quelle), neueId });
}
