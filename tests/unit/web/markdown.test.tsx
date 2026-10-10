import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";

/** Parses a lesson body and renders it to static HTML. */
function render(source: string): string {
  const document = parseMarkdown("lessons/render.md", source);
  return renderToStaticMarkup(<Markdown tree={document.tree} />);
}

describe("Markdown", () => {
  test("renders headings, paragraphs, and inline formatting", () => {
    const html = render("## Section\n\nText with *emphasis*, **strong**, and `code`.");

    expect(html).toContain("<h2>Section</h2>");
    expect(html).toContain("<p>Text with <em>emphasis</em>, <strong>strong</strong>");
    expect(html).toContain("<code>code</code>");
  });

  test("renders unordered, ordered, and task lists", () => {
    const html = render(
      ["- one", "- two", "", "1. first", "2. second", "", "- [x] done", "- [ ] todo"].join("\n"),
    );

    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("done");
    expect(html).toContain("todo");
  });

  test("renders fenced code with its language", () => {
    const html = render("```js\ncode()\n```");

    expect(html).toContain('<pre><code class="language-js">code()</code></pre>');
  });

  test("renders fenced code without a language", () => {
    expect(render("```\nplain\n```")).toContain("<pre><code>plain</code></pre>");
  });

  test("renders a GFM table with header cells and alignment", () => {
    const html = render("| left | right |\n| :- | -: |\n| a | b |");

    expect(html).toContain("<table>");
    expect(html).toContain("<thead>");
    expect(html).toContain("<tbody>");
    expect(html).toContain('style="text-align:left"');
    expect(html).toContain('style="text-align:right"');
  });

  test("renders links, images, and reference definitions", () => {
    const html = render(
      [
        '[site](https://example.com "Site") ![alt](assets/diagram.png "Diagram")',
        "",
        "[ref][a]",
        "",
        "[a]: https://example.com",
      ].join("\n"),
    );

    expect(html).toContain('<a href="https://example.com" title="Site">site</a>');
    expect(html).toContain('<img src="assets/diagram.png" alt="alt" title="Diagram"');
    expect(html).toContain('<a href="https://example.com">ref</a>');
  });

  test("does not render raw HTML", () => {
    expect(render("<div>unsafe</div>\n\nText.")).not.toContain("unsafe");
  });

  test("renders block quotes, thematic breaks, and nested emphasis", () => {
    const html = render("> quoted\n\n---\n\n***bold italic***");

    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr");
    expect(html).toContain("<em><strong>bold italic</strong></em>");
  });
});
