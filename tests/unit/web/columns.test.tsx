import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";

function render(source: string): string {
  const document = parseMarkdown("lessons/columns.md", source);
  return renderToStaticMarkup(<Markdown tree={document.tree} />);
}

const TWO_COLUMNS = [
  "::::columns",
  "",
  ":::column",
  "",
  "Left side.",
  "",
  ":::",
  "",
  ":::column",
  "",
  "Right side.",
  "",
  ":::",
  "",
  "::::",
].join("\n");

describe("Columns", () => {
  test("renders exactly two columns with responsive stacking", () => {
    const html = render(TWO_COLUMNS);

    expect(html).toContain("data-columns");
    expect(html.match(/data-column(?!s)/g)?.length).toBe(2);
    expect(html).toContain("sm:grid-cols-2");
  });

  test("keeps the reading order of the columns", () => {
    const html = render(TWO_COLUMNS);

    expect(html.indexOf("Left side.")).toBeLessThan(html.indexOf("Right side."));
  });

  test("does not render columns without exactly two column children", () => {
    const one = "::::columns\n\n:::column\n\nOnly.\n\n:::\n\n::::";

    expect(render(one)).not.toContain("data-columns");
  });
});
