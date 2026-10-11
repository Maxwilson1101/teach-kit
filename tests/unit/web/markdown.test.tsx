import { describe, expect, test } from "bun:test";
import { type Root } from "mdast";
import { renderToStaticMarkup } from "react-dom/server";
import { renderMermaidBlocks } from "../../../src/markdown/mermaid";
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

    expect(html).toContain("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>first</li>\n<li>second</li>\n</ol>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("done");
    expect(html).toContain("todo");
  });

  test("keeps multiple paragraphs in a loose list item separate", () => {
    const html = render("- First paragraph.\n\n  Second paragraph.\n- Next item.");

    expect(html).toContain("<p>First paragraph.</p>");
    expect(html).toContain("<p>Second paragraph.</p>");
    expect(html).toContain("<p>Next item.</p>");
    expect(html).not.toContain("First paragraph.Second paragraph.");
  });

  test("preserves a non-default ordered list start", () => {
    expect(render("3. Third\n4. Fourth")).toContain('<ol start="3">');
  });

  test("highlights fenced code with its language", () => {
    const html = render("```js\nconst answer = 42;\n```");

    expect(html).toContain('class="hljs language-js"');
    expect(html).toContain('class="hljs-keyword"');
    expect(html).toContain('class="hljs-number"');
  });

  test("renders fenced code without a language", () => {
    expect(render("```\nplain\n```")).toContain("<pre><code>plain</code></pre>");
  });

  test("keeps code in an unknown language as plain text", () => {
    const html = render("```notalanguage\nplain text\n```");

    expect(html).toContain('<code class="hljs language-notalanguage">plain text</code>');
    expect(html).not.toContain("hljs-keyword");
  });

  test("renders inline and display math through KaTeX", () => {
    const html = render("Energy is $E = mc^2$ inline.\n\n$$\n\\int_0^1 x\\,dx\n$$");

    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    expect(html).not.toContain("math-inline");
  });

  test("renders math nested inside directive containers", () => {
    const html = render([':::callout{kind="note"}', "", "Value $x^2$.", "", ":::"].join("\n"));
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("math-inline");
  });

  test("renders a sanitized Mermaid diagram inside a figure", () => {
    const document = parseMarkdown(
      "lessons/mermaid.md",
      "```mermaid\nflowchart LR\n A[Start] --> B[Done]\n```",
    );
    renderMermaidBlocks(document.tree, "lessons/mermaid.md");

    const html = renderToStaticMarkup(<Markdown tree={document.tree} />);

    expect(html).toContain('class="mermaid-figure"');
    expect(html).toContain("<svg");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  test("highlights code nested inside directive containers", () => {
    const html = render(
      [':::details{title="Snippet"}', "", "```js", "const answer = 42;", "```", "", ":::"].join(
        "\n",
      ),
    );

    expect(html).toContain('class="hljs language-js"');
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

  test("keeps reference definitions available inside nested directives", () => {
    const html = render(
      [
        ':::details{title="Source"}',
        "",
        "[Read][source]",
        "",
        ":::",
        "",
        "[source]: https://example.com",
      ].join("\n"),
    );

    expect(html).toContain('<a href="https://example.com">Read</a>');
  });

  test("does not enable footnotes or unsupported directive forms", () => {
    const html = render(
      "Text[^note].\n\n[^note]: Hidden footnote.\n\n:::unknown\n\nHidden container.\n\n:::\n\n::leaf\n\n:badge[Hidden text]",
    );

    expect(html).toContain("Text");
    expect(html).not.toContain("Hidden");
    expect(html).not.toContain("footnote");
    expect(html).not.toContain("<div");
  });

  test("does not mutate the shared AST or write section anchors", () => {
    const document = parseMarkdown(
      "lesson.md",
      '## Section\n\n:::callout{kind="note"}\n\nBody.\n\n:::',
    );
    const original = structuredClone(document.tree);
    const html = renderToStaticMarkup(<Markdown tree={document.tree} />);

    expect(document.tree).toEqual(original);
    expect(html).toContain("<h2>Section</h2>");
    expect(html).not.toContain('id="section"');
    expect(renderToStaticMarkup(<Markdown tree={document.tree} />)).toBe(html);
  });

  test("preserves ordinary converted div elements and their properties", () => {
    const document = parseMarkdown("converted.md", "Converted **content**.");
    const paragraph = document.tree.children[0];
    if (paragraph?.type !== "paragraph") throw new Error("Expected a paragraph.");
    paragraph.data = { hName: "div", hProperties: { id: "converted", className: ["converted"] } };
    const original = structuredClone(document.tree);

    expect(renderToStaticMarkup(<Markdown tree={document.tree} />)).toBe(
      '<div id="converted" class="converted">Converted <strong>content</strong>.</div>',
    );
    expect(document.tree).toEqual(original);
  });

  test("preserves ordinary div elements inside teaching directives", () => {
    const document = parseMarkdown(
      "converted.md",
      ':::details{title="More"}\n\nConverted content.\n\n:::',
    );
    const directive = document.tree.children[0];
    if (directive?.type !== "containerDirective") throw new Error("Expected a directive.");
    const paragraph = directive.children[0];
    if (paragraph?.type !== "paragraph") throw new Error("Expected a paragraph.");
    paragraph.data = { hName: "div", hProperties: { id: "nested" } };

    const html = renderToStaticMarkup(<Markdown tree={document.tree} />);
    expect(html).toContain("<summary");
    expect(html).toContain('<div id="nested">Converted content.</div>');
  });

  test("drops unknown AST nodes instead of using a generic HTML fallback", () => {
    const tree = {
      type: "root",
      children: [{ type: "unsupported", value: "Hidden unknown node." }],
    } as unknown as Root;

    expect(renderToStaticMarkup(<Markdown tree={tree} />)).toBe("");
  });

  test("renders block quotes, thematic breaks, and nested emphasis", () => {
    const html = render("> quoted\n\n---\n\n***bold italic***");

    expect(html).toContain("<blockquote>");
    expect(html).toContain("<hr");
    expect(html).toContain("<em><strong>bold italic</strong></em>");
  });
});
