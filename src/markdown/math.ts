/**
 * Validation for math expressions.
 *
 * `remark-math` produces `inlineMath` and `math` nodes during parsing. Each
 * expression is parsed with KaTeX; a `ParseError` becomes a source-located
 * error diagnostic. This module never mutates the tree or renders anything.
 * Rendering reuses the same strictness so a validated document cannot fail
 * later, and a document that renders cannot hide a parse error.
 */

import katex from "katex";
import { type Root } from "mdast";
import { type InlineMath, type Math as MathNode } from "mdast-util-math";
import { visit } from "unist-util-visit";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";

/** Shared KaTeX strictness so validation and rendering agree on warnings. */
export const MATH_STRICT = "ignore" as const;

/**
 * Validates every math expression in a parsed lesson tree.
 * Returns diagnostics sorted by document position. The tree is left untouched.
 */
export function validateMath(tree: Root, path: string): MarkdownDiagnostic[] {
  const diagnostics: MarkdownDiagnostic[] = [];

  visit(tree, (node) => {
    if (node.type !== "inlineMath" && node.type !== "math") return;
    const math: InlineMath | MathNode = node;
    try {
      katex.renderToString(math.value, {
        strict: MATH_STRICT,
        displayMode: math.type === "math",
        throwOnError: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push(toDiagnostic(path, math, `Invalid math: ${message}`));
    }
  });

  return diagnostics.sort((left, right) => left.line - right.line || left.column - right.column);
}
