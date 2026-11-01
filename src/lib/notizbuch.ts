// Notizbücher: Ein Ordner mit `_notizbuch.yaml` wird wie eine kleine Website angezeigt (Inhaltsverzeichnis,
// Seite, Zurück/Weiter). Die Datei nennt Titel und Reihenfolge der Seiten; Seiten, die dort fehlen, kommen
// alphabetisch ans Ende. Beim Schreiben bleiben andere Felder und Kommentare erhalten.
//
//   titel: Lernen für die Prüfung
//   seiten:
//     - DNS.html
//     - Subnetting.md
import { isMap, isSeq, parseDocument, YAMLSeq } from "yaml";

export const NOTIZBUCH_DATEI = "_notizbuch.yaml";

export interface Notizbuch {
  titel: string | null;
  /** Dateinamen der Seiten (relativ zum Ordner) in der gewünschten Reihenfolge. */
  seiten: string[];
}

/** Liest `_notizbuch.yaml`. Fehlerhafte oder fremde Inhalte ergeben ein leeres Notizbuch statt eines Fehlers. */
export function notizbuchLesen(text: string): Notizbuch {
  const doc = parseDocument(text);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return { titel: null, seiten: [] };
  const titel = doc.get("titel");
  const seiten = doc.get("seiten");
  return {
    titel: typeof titel === "string" && titel.trim() ? titel.trim() : null,
    seiten: isSeq(seiten) ? seiten.items.map((item) => (item && typeof item === "object" && "value" in item ? String(item.value) : String(item))).filter((name) => name.trim() !== "") : [],
  };
}

/** Neue `_notizbuch.yaml` für einen Ordner: Titel = Ordnername, Seiten in der aktuellen Reihenfolge. */
export function notizbuchNeu(titel: string, seiten: string[]): string {
  const doc = parseDocument("titel: x\nseiten: []\n");
  doc.set("titel", titel);
  doc.set("seiten", doc.createNode(seiten));
  return doc.toString({ lineWidth: 0 });
}

/** Setzt die Reihenfolge; andere Felder (und Kommentare) bleiben erhalten. */
export function notizbuchMitReihenfolge(text: string, seiten: string[]): string {
  const doc = parseDocument(text);
  if (doc.errors.length > 0 || !isMap(doc.contents)) return notizbuchNeu(notizbuchLesen(text).titel ?? "", seiten);
  const liste = doc.createNode(seiten) as YAMLSeq;
  liste.flow = false;
  doc.set("seiten", liste);
  return doc.toString({ lineWidth: 0 });
}

/**
 * Reihenfolge der Seiten im Notizbuch: zuerst die in `_notizbuch.yaml` genannten (in deren Reihenfolge,
 * nur wenn es sie gibt; Groß-/Kleinschreibung egal), dann alle übrigen alphabetisch.
 * `dateien` sind die Dateinamen der Seiten im Ordner (z. B. "DNS.html").
 */
export function notizbuchReihenfolge(notizbuch: Notizbuch, dateien: readonly string[]): string[] {
  const rest = new Map(dateien.map((name) => [name.toLowerCase(), name]));
  const ordnung: string[] = [];
  for (const eintrag of notizbuch.seiten) {
    const datei = rest.get(eintrag.toLowerCase());
    if (datei === undefined) continue;
    ordnung.push(datei);
    rest.delete(eintrag.toLowerCase());
  }
  const uebrige = [...rest.values()].sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }) || a.localeCompare(b, "de"));
  return [...ordnung, ...uebrige];
}

/** Schiebt `datei` an die Stelle von `ziel` (Drag & Drop im Inhaltsverzeichnis). */
export function verschieben(reihenfolge: readonly string[], datei: string, ziel: string, danach = false): string[] {
  if (datei === ziel) return [...reihenfolge];
  const ohne = reihenfolge.filter((name) => name !== datei);
  const index = ohne.indexOf(ziel);
  if (index === -1) return [...reihenfolge];
  ohne.splice(danach ? index + 1 : index, 0, datei);
  return ohne;
}

/**
 * „Rückgängig“ nach dem Verschieben aus dem Notizbuch: `datei` kommt wieder an ihren alten Platz in `seiten` – vor
 * den ersten Eintrag, der in der alten Reihenfolge `vorher` nach ihr kam und noch da ist (sonst ans Ende). Stand sie
 * vorher nicht in der Liste oder steht sie schon wieder darin, bleibt der Text unverändert.
 */
export function notizbuchWiederEinfuegen(text: string, datei: string, vorher: readonly string[]): string {
  const klein = (name: string) => name.toLowerCase();
  const alt = vorher.findIndex((name) => klein(name) === klein(datei));
  const seiten = notizbuchLesen(text).seiten;
  if (alt === -1 || seiten.some((name) => klein(name) === klein(datei))) return text;
  const danach = vorher.slice(alt + 1).map(klein);
  const index = seiten.findIndex((name) => danach.includes(klein(name)));
  const neu = index === -1 ? [...seiten, datei] : [...seiten.slice(0, index), datei, ...seiten.slice(index)];
  return notizbuchMitReihenfolge(text, neu);
}

/**
 * Nach Umbenennen, Verschieben oder Umwandeln einer Seite: Einträge in `seiten` anpassen. `alt` und `neu`
 * sind Dateinamen; `neu` = null, wenn die Seite den Ordner verlassen hat (dann fällt der Eintrag weg).
 */
export function notizbuchUmbenennen(text: string, alt: string, neu: string | null): string {
  const notizbuch = notizbuchLesen(text);
  if (!notizbuch.seiten.some((name) => name.toLowerCase() === alt.toLowerCase())) return text;
  const seiten = notizbuch.seiten.flatMap((name) => (name.toLowerCase() === alt.toLowerCase() ? (neu === null ? [] : [neu]) : [name]));
  return notizbuchMitReihenfolge(text, seiten);
}
