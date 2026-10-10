/**
 * Section metadata derived from level-two headings.
 *
 * Only direct children of the document root act as section boundaries, so
 * headings nested inside block quotes, lists, or directive containers never
 * enter the section navigation. Anchors are unique and deterministic for the
 * same heading order. Summaries use the first non-empty paragraph in ordinary
 * prose, including lists and block quotes, but excluding other containers.
 */

import GithubSlugger, { slug } from "github-slugger";
import { type Paragraph, type Root, type RootContent } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import { EXIT, SKIP, visit } from "unist-util-visit";

export interface MarkdownSection {
  /** Non-empty heading slug, unique among the lesson's section anchors. */
  id: string;
  title: string;
  /** First non-empty paragraph in ordinary prose, including image alt text; empty when absent. */
  summary: string;
}

/** Only ordinary prose containers may contribute a summary paragraph. */
const PROSE_CONTAINERS: ReadonlySet<RootContent["type"]> = new Set([
  "blockquote",
  "list",
  "listItem",
]);

function summaryText(paragraph: Paragraph): string {
  // The text utility omits hard breaks; map them to spaces on a disposable copy.
  const copy = structuredClone(paragraph);
  visit(copy, "break", (_node, index, parent) => {
    if (parent && index !== undefined) parent.children[index] = { type: "text", value: " " };
  });
  return mdastToString(copy, { includeImageAlt: true, includeHtml: false })
    .replace(/\s+/g, " ")
    .trim();
}

function summarize(nodes: readonly RootContent[]): string {
  for (const node of nodes) {
    let summary = "";
    visit(node, (candidate) => {
      if (candidate.type === "paragraph") {
        summary = summaryText(candidate);
        return summary ? EXIT : SKIP;
      }
      return PROSE_CONTAINERS.has(candidate.type) ? undefined : SKIP;
    });
    if (summary) return summary;
  }
  return "";
}

/**
 * Extracts sections from top-level level-two headings in document order.
 * Content before the first section is ignored. Each section extends to the
 * next top-level level-two heading; deeper headings do not split sections.
 * Empty or unsluggable titles use `section` as the anchor base, and duplicate
 * anchors receive unique suffixes. Summaries follow the prose rules above.
 * Does not mutate the tree or write anchor IDs onto heading nodes.
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
      current = { id: slugger.slug(slug(title) ? title : "section"), title, nodes: [] };
      continue;
    }
    if (current) current.nodes.push(node);
  }
  flush();

  return sections;
}
