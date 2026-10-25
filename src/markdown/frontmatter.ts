// Trennt das YAML-Frontmatter vom Seiteninhalt, ohne es zu verändern.
// Das Frontmatter wird hier nicht interpretiert: Es bleibt Zeichen für Zeichen erhalten.

export interface SplitResult {
  /** Frontmatter-Block inklusive der Begrenzer "---" und abschließendem Zeilenumbruch, sonst null. */
  frontmatter: string | null;
  /** Der restliche Markdown-Text ohne Frontmatter. */
  body: string;
}

const OPENING = /^---[ \t]*\r?\n/;
// Obsidian und Jekyll beenden Frontmatter mit "---", YAML erlaubt auch "...".
const CLOSING = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m;

/** Trennt ein YAML-Frontmatter am Dateianfang vom Inhalt, ohne es zu interpretieren. */
export function splitFrontmatter(text: string): SplitResult {
  const opening = OPENING.exec(text);
  if (!opening) return { frontmatter: null, body: text };

  const rest = text.slice(opening[0].length);
  const closing = CLOSING.exec(rest);
  if (!closing) return { frontmatter: null, body: text };

  const end = opening[0].length + closing.index + closing[0].length;
  return { frontmatter: text.slice(0, end), body: text.slice(end) };
}

// ---------------------------------------------------------------------------
// Einzelne Felder lesen und ändern (z. B. icon, cover). Nur die Zeile des Feldes wird angefasst,
// alle anderen Zeilen bleiben Zeichen für Zeichen erhalten.

function fieldPattern(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}[ \\t]*:(.*)$`);
}

/** Wert eines einfachen Feldes der obersten Ebene, ohne Anführungszeichen; null, wenn es fehlt oder leer ist. */
export function getFrontmatterField(frontmatter: string | null, key: string): string | null {
  if (frontmatter === null) return null;
  const pattern = fieldPattern(key);
  for (const line of frontmatter.split(/\r?\n/).slice(1)) {
    const match = pattern.exec(line);
    if (!match) continue;
    const raw = match[1].trim();
    if (raw === "") return null;
    const doubleQuoted = /^("(?:[^"\\]|\\.)*")(?:\s+#.*)?$/.exec(raw);
    if (doubleQuoted) return JSON.parse(doubleQuoted[1]) as string;
    const singleQuoted = /^'((?:[^']|'')*)'(?:\s+#.*)?$/.exec(raw);
    if (singleQuoted) return singleQuoted[1].replace(/''/g, "'");
    return raw.replace(/\s+#.*$/, "");
  }
  return null;
}

/** YAML-Schreibweise eines Textes: ohne Anführungszeichen, wenn das eindeutig ist. */
export function yamlString(value: string): string {
  const plainIsSafe =
    value !== "" &&
    value.trim() === value &&
    !/^[-?:,[\]{}#&*!|>'"%@`]/.test(value) &&
    !/: |\s#|[\n\r\t]/.test(value) &&
    !/^(true|false|yes|no|on|off|null|~|[-+]?[\d.]+(e[-+]?\d+)?)$/i.test(value);
  return plainIsSafe ? value : JSON.stringify(value);
}

/**
 * Setzt ein Feld der obersten Ebene (value = null entfernt es). Fehlt das Frontmatter, wird es angelegt.
 * Liefert das neue Frontmatter (oder null, wenn danach nichts mehr drinsteht und vorher keins da war).
 */
export function setFrontmatterField(frontmatter: string | null, key: string, value: string | null): string | null {
  return replaceFrontmatterEntry(frontmatter, key, value === null ? null : [`${key}: ${yamlString(value)}`]);
}

/** Zeilen zwischen "---" und dem Abschluss (ohne die Begrenzer). */
export function frontmatterInner(frontmatter: string | null): string {
  if (frontmatter === null) return "";
  const lines = frontmatter.split(/\r?\n/);
  const closing = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line));
  return lines.slice(1, closing === -1 ? undefined : closing).join("\n");
}

/**
 * Ersetzt den Eintrag `key` (seine Zeile plus eingerückte Folgezeilen, z. B. Listen) durch `entry`,
 * entfernt ihn (entry = null) oder hängt ihn am Ende an. Alle anderen Zeilen bleiben unverändert.
 */
export function replaceFrontmatterEntry(frontmatter: string | null, key: string, entry: string[] | null): string | null {
  if (frontmatter === null) {
    return entry === null ? null : `---\n${entry.join("\n")}\n---\n`;
  }
  const eol = frontmatter.includes("\r\n") ? "\r\n" : "\n";
  const lines = frontmatter.split(/\r?\n/);
  // Letzte Zeile mit "---" bzw. "..." ist der Abschluss; danach kann noch "" (Zeilenende) stehen.
  const closing = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line));
  const pattern = fieldPattern(key);
  const index = lines.findIndex((line, i) => i > 0 && i < closing && pattern.test(line));

  if (index !== -1) {
    // Eingerückte Folgezeilen und Listenpunkte ("- …") gehören zum Feld und werden mit ersetzt.
    let end = index + 1;
    while (end < closing && /^([ \t]+\S|-([ \t]|$))/.test(lines[end])) end++;
    lines.splice(index, end - index, ...(entry ?? []));
  } else if (entry !== null) {
    lines.splice(closing, 0, ...entry);
  }
  return lines.join(eol);
}

/** Setzt Frontmatter und Inhalt wieder zusammen; splitFrontmatter(joinFrontmatter(f, b)) == { f, b }. */
export function joinFrontmatter(frontmatter: string | null, body: string): string {
  if (frontmatter === null) return body;
  // Fehlt der Zeilenumbruch nach dem schließenden "---", würde der Inhalt sonst daran kleben.
  const needsBreak = body !== "" && !frontmatter.endsWith("\n");
  return frontmatter + (needsBreak ? "\n" : "") + body;
}
