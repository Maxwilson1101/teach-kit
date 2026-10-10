import { describe, expect, test } from "bun:test";
import { type Root } from "mdast";
import { visit } from "unist-util-visit";
import { parseMarkdown } from "../../../src/markdown/parse";

function types(tree: Root): string[] {
  const found: string[] = [];
  visit(tree, (node) => {
    if (node.type !== "root") found.push(node.type);
  });
  return found;
}

describe("parseMarkdown", () => {
  test("parses standard block and inline structures", () => {
    const source = [
      "Paragraph with *emphasis* and `inline code`.",
      "",
      "- item",
      "",
      "```js",
      "code()",
      "```",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
    ].join("\n");

    const document = parseMarkdown("lessons/basics.md", source);
    const found = types(document.tree);

    expect(found).toContain("paragraph");
    expect(found).toContain("emphasis");
    expect(found).toContain("inlineCode");
    expect(found).toContain("list");
    expect(found).toContain("code");
    expect(found).toContain("table");
    expect(document.path).toBe("lessons/basics.md");
    expect(document.diagnostics).toEqual([]);
  });

  test("keeps image and link nodes with their URLs", () => {
    const document = parseMarkdown(
      "lessons/media.md",
      "[site](https://example.com) ![diagram](assets/diagram.png)",
    );

    const urls: string[] = [];
    visit(document.tree, (node) => {
      if (node.type === "link" || node.type === "image") urls.push(node.url);
    });

    expect(urls).toEqual(["https://example.com", "assets/diagram.png"]);
  });

  test("reports raw HTML as a located error diagnostic", () => {
    const document = parseMarkdown(
      "lessons/html.md",
      ["First paragraph.", "", "<div>unsafe</div>", "", "Inline <b>bold</b>."].join("\n"),
    );

    // Block HTML is one node; inline HTML reports its opening and closing tags.
    expect(document.diagnostics).toHaveLength(3);
    expect(document.diagnostics[0]).toMatchObject({
      severity: "error",
      path: "lessons/html.md",
      line: 3,
      column: 1,
      message: "Raw HTML is not supported.",
    });
    expect(document.diagnostics.slice(1)).toMatchObject([
      { severity: "error", path: "lessons/html.md", line: 5, column: 8 },
      { severity: "error", path: "lessons/html.md", line: 5, column: 15 },
    ]);
  });

  test("parses container directives with their names and attributes", () => {
    const source = [
      ':::callout{kind="warning" title="Keep these separate"}',
      "",
      "Dispatch success does not imply execution success.",
      "",
      ":::",
    ].join("\n");

    const document = parseMarkdown("lessons/directives.md", source);
    const directives: { name: string; attributes: unknown }[] = [];
    visit(document.tree, "containerDirective", (node) => {
      directives.push({ name: node.name, attributes: node.attributes });
    });

    expect(directives).toEqual([
      { name: "callout", attributes: { kind: "warning", title: "Keep these separate" } },
    ]);
    expect(document.diagnostics).toEqual([]);
  });

  test("nests directives with a longer colon fence on the outer container", () => {
    const source = [
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

    const document = parseMarkdown("lessons/nested.md", source);
    const outer = document.tree.children[0];

    expect(outer?.type).toBe("containerDirective");
    if (outer?.type !== "containerDirective") throw new Error("Expected an outer container.");
    expect(outer.name).toBe("columns");
    expect(
      outer.children
        .filter((child) => child.type === "containerDirective")
        .map((child) => child.name),
    ).toEqual(["column", "column"]);
    expect(document.diagnostics).toEqual([]);
  });

  test("does not mutate or share state between documents", () => {
    const first = parseMarkdown("a.md", "Text.");
    const second = parseMarkdown("b.md", "Other.");

    expect(first.path).not.toBe(second.path);
    expect(first.diagnostics).not.toBe(second.diagnostics);
  });
});
