/**
 * Shared Markdown AST pipeline.
 *
 * The mdast tree and pipeline models stay internal to the package.
 * Raw HTML is not an authoring escape hatch and is reported as a located
 * error diagnostic. Rendering must reject documents with errors.
 */

import { type Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";

export interface MarkdownDocument {
  path: string;
  /** Parsed document tree. Internal; not re-exported from the package entry. */
  tree: Root;
  diagnostics: MarkdownDiagnostic[];
}

/**
 * Parses Markdown into an AST, enabling GitHub-flavored tables.
 * Raw HTML produces an error diagnostic; every other structure is preserved
 * so rendering, validation, and navigation share one parse result.
 */
export function parseMarkdown(path: string, source: string): MarkdownDocument {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source) as Root;
  const diagnostics: MarkdownDiagnostic[] = [];

  visit(tree, "html", (node) => {
    diagnostics.push(toDiagnostic(path, node, "Raw HTML is not supported."));
  });

  return { path, tree, diagnostics };
}
