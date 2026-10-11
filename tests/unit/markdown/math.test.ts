import { describe, expect, test } from "bun:test";
import { validateMath } from "../../../src/markdown/math";
import { parseMarkdown } from "../../../src/markdown/parse";

const PATH = "lessons/math.md";

/** Parses a lesson body and validates only its math expressions. */
function validate(source: string): ReturnType<typeof validateMath> {
  const document = parseMarkdown(PATH, source);
  return validateMath(document.tree, PATH);
}

describe("validateMath", () => {
  test("accepts valid inline and display math", () => {
    expect(validate("Value $x^2$ inline.\n\n$$\n\\frac{a}{b}\n$$\n")).toEqual([]);
  });

  test("reports invalid LaTeX with its source location", () => {
    const diagnostics = validate("First paragraph.\n\nInline $\\frac{1}$ is broken.\n");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      path: PATH,
      line: 3,
      message: expect.stringContaining("Invalid math"),
    });
  });

  test("reports every invalid expression in document order", () => {
    const diagnostics = validate("$\\frac{1}$\n\n$$\n\\sqrt\n$$\n");
    expect(diagnostics.map(({ line }) => line)).toEqual([1, 3]);
    expect(diagnostics.every(({ severity }) => severity === "error")).toBe(true);
  });

  test("accepts a plain paragraph without math", () => {
    expect(validate("A paragraph with no formulas.")).toEqual([]);
  });
});
