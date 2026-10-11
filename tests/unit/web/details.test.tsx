import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";

function render(source: string): string {
  const document = parseMarkdown("lessons/details.md", source);
  return renderToStaticMarkup(<Markdown tree={document.tree} />);
}

describe("Details", () => {
  test("renders a collapsed disclosure with its title and body", () => {
    const html = render(':::details{title="Show Answer"}\n\nThe answer.\n\n:::');

    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Show Answer");
    expect(html).toContain("The answer.");
    const detailsTag = html.match(/<details[^>]*>/)?.[0] ?? "";
    expect(detailsTag).not.toContain("open");
  });

  test("renders nested Markdown in the disclosure body", () => {
    const html = render(':::details{title="Proof"}\n\n1. first\n2. second\n\n:::');

    expect(html).toContain("<li>first</li>");
  });

  test("does not render a disclosure without a title", () => {
    const html = render(":::details\n\nBody.\n\n:::");

    expect(html).not.toContain("<details");
  });
});
