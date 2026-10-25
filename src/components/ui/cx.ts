/** Verbindet CSS-Klassen und lässt leere Werte weg: cx("a", false && "b", "c") → "a c". */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
