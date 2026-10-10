import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";

function render(source: string): string {
  const document = parseMarkdown("lessons/callout.md", source);
  return renderToStaticMarkup(<Markdown tree={document.tree} />);
}

describe("Callout", () => {
  test("renders its kind, explicit title, and body", () => {
    const html = render(
      ':::callout{kind="warning" title="Keep these separate"}\n\nBody text.\n\n:::',
    );

    expect(html).toContain('data-callout="warning"');
    expect(html).toContain("Keep these separate");
    expect(html).toContain("Body text.");
  });

  test("falls back to the kind label when no title is given", () => {
    const html = render(':::callout{kind="tip"}\n\nBody.\n\n:::');

    expect(html).toContain('data-callout="tip"');
    expect(html).toContain("Tip");
  });

  test("renders nested Markdown inside the callout body", () => {
    const html = render(':::callout{kind="note"}\n\n- one\n- two\n\n:::');

    expect(html).toContain("<li>one</li>");
  });

  test("does not render an unknown kind", () => {
    const html = render(':::callout{kind="danger"}\n\nBody.\n\n:::');

    expect(html).not.toContain("danger");
  });
});
