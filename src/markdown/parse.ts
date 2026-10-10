/**
 * Shared Markdown AST pipeline.
 *
 * The mdast tree and pipeline models stay internal to the package.
 * Raw HTML is not an authoring escape hatch and is reported as a located
 * error diagnostic. Callers must reject documents with errors before rendering.
 */

import { type Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";

export interface MarkdownDocument {
  /** Source identifier used in diagnostics; no file is read by the parser. */
  path: string;
  /** Parsed document tree. Internal; not re-exported from the package entry. */
  tree: Root;
  /** Parse-stage diagnostics only; directive and resource validation are separate. */
  diagnostics: MarkdownDiagnostic[];
}

/**
 * Parses Markdown into an AST, enabling GitHub-flavored tables and container
 * directives. Directive fences use three or more colons; nesting an outer
 * container requires a longer fence than its inner containers. Raw HTML
 * produces an error diagnostic; every other structure is preserved so
 * rendering, validation, and navigation share one parse result.
 * Does not validate directive rules or resource references.
 *
 * @param path Source identifier for diagnostics; used as supplied, without file access.
 * @param source Markdown text to parse.
 */
export function parseMarkdown(path: string, source: string): MarkdownDocument {
  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(source) as Root;
  const diagnostics: MarkdownDiagnostic[] = [];

  visit(tree, "html", (node) => {
    diagnostics.push(toDiagnostic(path, node, "Raw HTML is not supported."));
  });

  return { path, tree, diagnostics };
}
