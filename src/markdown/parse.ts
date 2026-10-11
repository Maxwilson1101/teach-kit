/**
 * Shared Markdown AST pipeline.
 *
 * The mdast tree and pipeline models stay internal to the package.
 * Raw HTML and footnotes are unsupported and produce located error diagnostics.
 * Callers must reject documents with errors before rendering.
 */

import { type Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
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
 * Parses Markdown into an AST, enabling GitHub-flavored tables, math
 * expressions, and container directives. Directive fences use three or more
 * colons; nesting an outer container requires a longer fence than its inner
 * containers. Raw HTML and footnotes produce error diagnostics; every
 * structure is preserved so rendering, validation, and navigation share one
 * parse result. Does not validate directive, math, or resource rules.
 *
 * @param path Source identifier for diagnostics; used as supplied, without file access.
 * @param source Markdown text to parse.
 */
export function parseMarkdown(path: string, source: string): MarkdownDocument {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .parse(source) as Root;
  const diagnostics: MarkdownDiagnostic[] = [];

  visit(tree, (node) => {
    if (node.type === "html") {
      diagnostics.push(toDiagnostic(path, node, "Raw HTML is not supported."));
    } else if (node.type === "footnoteReference" || node.type === "footnoteDefinition") {
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          "Footnotes are not supported. Move the explanation into the lesson body.",
        ),
      );
    }
  });

  return { path, tree, diagnostics };
}
