// Die feste `id` einer Seite (Notiz: Frontmatter-Feld `id`, HTML-Seite: `<meta name="localist-id">`). Sie bleibt beim
// Umbenennen und Verschieben gleich; deshalb verknüpft z. B. der Pomodoro-Verlauf Seiten über sie statt über den Pfad.
import { getFrontmatterField, joinFrontmatter, setFrontmatterField, splitFrontmatter } from "../markdown/frontmatter";
import { setMeta } from "./html";

const HTML = /\.html$/i;
const META = /<meta\b[^>]*\bname\s*=\s*["']localist-id["'][^>]*>/i;
const CONTENT = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

export function seitenId(pfad: string, inhalt: string): string | null {
  if (HTML.test(pfad)) {
    const kopfEnde = inhalt.search(/<\/head\s*>/i);
    const tag = META.exec(kopfEnde < 0 ? inhalt : inhalt.slice(0, kopfEnde))?.[0];
    const wert = tag ? CONTENT.exec(tag) : null;
    const id = (wert?.[1] ?? wert?.[2] ?? "").trim();
    return id || null;
  }
  return getFrontmatterField(splitFrontmatter(inhalt).frontmatter, "id")?.trim() || null;
}

/** Setzt die id (nur, wenn sie fehlt; nur genau dieses Feld bzw. dieses Tag, der Rest bleibt Zeichen für Zeichen). */
export function mitSeitenId(pfad: string, inhalt: string, id: string): string {
  if (seitenId(pfad, inhalt)) return inhalt;
  if (HTML.test(pfad)) return setMeta(inhalt, "localist-id", id);
  const { frontmatter, body } = splitFrontmatter(inhalt);
  return joinFrontmatter(setFrontmatterField(frontmatter, "id", id), body);
}

/** Pfad der Seite mit dieser id (z. B. aus dem Suchindex), sonst null. */
export function pfadZurId(seiten: readonly { path: string; content: string }[], id: string): string | null {
  return seiten.find((seite) => seitenId(seite.path, seite.content) === id)?.path ?? null;
}
