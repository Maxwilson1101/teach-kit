import { type Nodes } from "mdast";

/** A source-located authoring problem shared by Markdown pipeline stages. */
export interface MarkdownDiagnostic {
  severity: "error" | "warning";
  /** File path of the lesson the diagnostic belongs to. */
  path: string;
  /** One-based line of the problem. */
  line: number;
  /** One-based column of the problem. */
  column: number;
  message: string;
}

/** Builds a located diagnostic; synthetic nodes without positions use 1:1. */
export function toDiagnostic(
  path: string,
  node: Nodes,
  message: string,
  severity: MarkdownDiagnostic["severity"] = "error",
): MarkdownDiagnostic {
  const start = node.position?.start;
  return { severity, path, line: start?.line ?? 1, column: start?.column ?? 1, message };
}
