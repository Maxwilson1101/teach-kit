/**
 * Section metadata derived from level-two headings.
 *
 * Only direct children of the document root act as section boundaries, so
 * headings nested inside containers (block quotes now, directives later) never
 * enter the section navigation. Each section carries a unique, stable anchor
 * and a plain-text summary taken from its first prose block.
 */

import GithubSlugger from "github-slugger";
import { type Root, type RootContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";

export interface MarkdownSection {
  /** URL-safe anchor, unique within the lesson. */
  id: string;
  title: string;
  /** Plain text from the first prose block, or an empty string when absent. */
  summary: string;
}

/** Node types excluded from summaries because they are not ordinary prose. */
const NON_PROSE: ReadonlySet<RootContent["type"]> = new Set([
  "code",
  "table",
  "html",
  "thematicBreak",
  "yaml",
  "definition",
  "footnoteDefinition",
]);

function plainText(node: RootContent): string {
  if (NON_PROSE.has(node.type)) return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (!("children" in node)) return "";
  return node.children.map(plainText).join(" ");
}

function summarize(nodes: readonly RootContent[]): string {
  for (const node of nodes) {
    const text = plainText(node).replace(/\s+/g, " ").trim();
    if (text !== "") return text;
  }
  return "";
}

/**
 * Extracts level-two sections in document order.
 * Duplicate or empty titles receive unique anchors via the slugger.
 */
export function extractSections(tree: Root): MarkdownSection[] {
  const slugger = new GithubSlugger();
  const sections: MarkdownSection[] = [];
  let current: { id: string; title: string; nodes: RootContent[] } | undefined;

  const flush = () => {
    if (!current) return;
    sections.push({ id: current.id, title: current.title, summary: summarize(current.nodes) });
  };

  for (const node of tree.children) {
    if (node.type === "heading" && node.depth === 2) {
      flush();
      const title = mdastToString(node).trim();
      current = { id: slugger.slug(title || "section"), title, nodes: [] };
      continue;
    }
    if (current) current.nodes.push(node);
  }
  flush();

  return sections;
}
