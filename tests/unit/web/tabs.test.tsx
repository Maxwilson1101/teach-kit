import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";

function render(source: string): string {
  const document = parseMarkdown("lessons/tabs.md", source);
  return renderToStaticMarkup(<Markdown tree={document.tree} />);
}

const TWO_TABS = [
  "::::tabs",
  "",
  ':::tab{title="Transport"}',
  "",
  "Relayers move messages.",
  "",
  ":::",
  "",
  ':::tab{title="Verification"}',
  "",
  "Security modules verify them.",
  "",
  ":::",
  "",
  "::::",
].join("\n");

describe("Tabs", () => {
  test("renders a tablist with titles and panels", () => {
    const html = render(TWO_TABS);

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)?.length).toBe(2);
    expect(html.match(/role="tabpanel"/g)?.length).toBe(2);
    expect(html).toContain("Transport");
    expect(html).toContain("Verification");
    expect(html).toContain("Relayers move messages.");
  });

  test("selects the first tab and hides the others", () => {
    const html = render(TWO_TABS);

    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html.match(/hidden=""/g)?.length).toBe(1);
  });

  test("links each tab to its panel for assistive technology", () => {
    const html = render(TWO_TABS);

    expect(html).toContain('aria-controls="');
    expect(html).toContain('aria-labelledby="');
  });

  test("does not render tabs without tab children", () => {
    expect(render("::::tabs\n\n::::")).not.toContain('role="tablist"');
  });
});
