/**
 * Server-side Mermaid rendering.
 *
 * A `mermaid` fenced code block is rendered to SVG with beautiful-mermaid while
 * content loads, sanitized, and stored on a `mermaidDiagram` node. Invalid
 * diagrams become source-located errors. The browser only injects the finished
 * SVG, so no layout engine or DOM dependency ships to the client.
 */

import { renderMermaidSVG } from "beautiful-mermaid";
import { type Code, type Root, type RootContent } from "mdast";
import { visit } from "unist-util-visit";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";
import { type MermaidDiagram } from "./mermaid-node";

/**
 * Diagram colors follow the shared reading theme through CSS variables.
 * beautiful-mermaid sets `--bg`, `--fg`, `--line`, `--accent`, `--muted`,
 * `--surface`, and `--border` on the SVG, so values must not re-declare a
 * property in terms of itself or borrow the page's same-named `--muted` and
 * `--border` tokens; mono fallbacks would otherwise be shadowed.
 */
const MERMAID_OPTIONS = {
  bg: "var(--background)",
  fg: "var(--foreground)",
  line: "var(--border)",
  accent: "var(--primary)",
  muted: "var(--muted-foreground)",
  surface: "var(--secondary)",
  border: "var(--input)",
  transparent: true,
} as const;

/**
 * Removes remote loads and scripts from generated SVG before it is embedded.
 * beautiful-mermaid always writes a Google Fonts import; dropping it keeps the
 * preview offline and avoids a third-party request.
 */
export function sanitizeMermaidSvg(svg: string): string {
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/@import\s+url\([^)]*\);?/gi, "")
    .replace(/\s(?:xlink:)?href="https?:[^"]*"/gi, "");
}

/**
 * Replaces every `mermaid` fenced block with a rendered `mermaidDiagram` node.
 * Returns source-located errors for diagrams beautiful-mermaid refuses; the
 * tree then keeps the original code node so the caller can reject the lesson.
 */
export function renderMermaidBlocks(tree: Root, path: string): MarkdownDiagnostic[] {
  const diagnostics: MarkdownDiagnostic[] = [];

  visit(tree, "code", (node: Code, index, parent) => {
    if (node.lang !== "mermaid") return;
    try {
      const svg = sanitizeMermaidSvg(renderMermaidSVG(node.value, MERMAID_OPTIONS));
      if (parent && index !== undefined) {
        const diagram: MermaidDiagram = { type: "mermaidDiagram", value: node.value, svg };
        if (node.position) diagram.position = node.position;
        parent.children[index] = diagram as RootContent;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push(toDiagnostic(path, node, `Invalid Mermaid diagram: ${message}`));
    }
  });

  return diagnostics.sort((left, right) => left.line - right.line || left.column - right.column);
}
