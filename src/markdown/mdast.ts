// Einlesen und Schreiben von Markdown über remark (CommonMark + GitHub-Erweiterungen wie Checklisten).
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const parser = unified().use(remarkParse).use(remarkGfm).freeze();

// Dieselben Schreibweisen wie Obsidian: "-" für Listen, "*" für kursiv, "**" für fett, "---" als Trennlinie.
const stringifier = unified()
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "*",
    strong: "*",
    fence: "`",
    fences: true,
    rule: "-",
    listItemIndent: "one",
    incrementListMarker: true,
  })
  .use(remarkGfm)
  .freeze();

export function parseMarkdown(markdown: string): Root {
  return parser.parse(markdown);
}

export function stringifyMarkdown(tree: Root): string {
  return stringifier.stringify(tree);
}
