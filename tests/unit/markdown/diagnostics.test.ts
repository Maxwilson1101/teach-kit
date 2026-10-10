import { describe, expect, test } from "bun:test";
import { toDiagnostic } from "../../../src/markdown/diagnostics";

describe("toDiagnostic", () => {
  test("uses a node's one-based source location and defaults to an error", () => {
    expect(
      toDiagnostic(
        "lesson.md",
        {
          type: "text",
          value: "Text",
          position: {
            start: { line: 3, column: 5, offset: 10 },
            end: { line: 3, column: 9, offset: 14 },
          },
        },
        "Invalid content.",
      ),
    ).toEqual({
      severity: "error",
      path: "lesson.md",
      line: 3,
      column: 5,
      message: "Invalid content.",
    });
  });

  test("uses 1:1 for synthetic nodes and preserves warning severity", () => {
    expect(
      toDiagnostic("lesson.md", { type: "text", value: "Text" }, "Check content.", "warning"),
    ).toEqual({
      severity: "warning",
      path: "lesson.md",
      line: 1,
      column: 1,
      message: "Check content.",
    });
  });
});
