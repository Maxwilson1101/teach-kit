import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";

function render(source: string): string {
  const document = parseMarkdown("lessons/columns.md", source);
  return renderToStaticMarkup(<Markdown tree={document.tree} />);
}

describe("Retired layout rendering", () => {
  test("does not render a retired layout even when handed an unvalidated tree", () => {
    const source = readFileSync(
      new URL("../../fixtures/legacy-columns.md", import.meta.url),
      "utf8",
    );
    expect(render(source)).toBe("<h2>Legacy comparison</h2>");
  });

  test.each(["columns", "column"])("does not render the retired %s container", (name) => {
    expect(render(`:::${name}\n\nRetired body.\n\n:::`)).toBe("");
  });
});
