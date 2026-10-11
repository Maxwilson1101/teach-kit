import { describe, expect, test } from "bun:test";
import { renderMermaidBlocks, sanitizeMermaidSvg } from "../../../src/markdown/mermaid";
import { type MermaidDiagram } from "../../../src/markdown/mermaid-node";
import { parseMarkdown } from "../../../src/markdown/parse";

const PATH = "lessons/mermaid.md";

function parse(source: string) {
  return parseMarkdown(PATH, source);
}

describe("sanitizeMermaidSvg", () => {
  test("removes remote imports, scripts, and external links", () => {
    const svg = [
      "<svg><style>@import url('https://fonts.googleapis.com/css2?family=Inter');text{fill:red}</style>",
      '<script>alert("x")</script>',
      '<a xlink:href="https://evil.example/x"><text>link</text></a>',
      '<use href="#node-1"/></svg>',
    ].join("");

    const clean = sanitizeMermaidSvg(svg);

    expect(clean).not.toContain("fonts.googleapis.com");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("evil.example");
    expect(clean).toContain('href="#node-1"');
    expect(clean).toContain("text{fill:red}");
  });
});

describe("renderMermaidBlocks", () => {
  test("replaces a mermaid fence with a sanitized SVG diagram node", () => {
    const document = parse("```mermaid\nflowchart LR\n A[Start] --> B[Done]\n```");

    expect(renderMermaidBlocks(document.tree, PATH)).toEqual([]);
    const diagram = document.tree.children[0] as MermaidDiagram;
    expect(diagram.type).toBe("mermaidDiagram");
    expect(diagram.value).toContain("flowchart LR");
    expect(diagram.svg).toContain("<svg");
    expect(diagram.svg).not.toContain("fonts.googleapis.com");
  });

  test("reports an unreadable diagram with its source location and keeps the fence", () => {
    const document = parse("First paragraph.\n\n```mermaid\nnot a diagram\n```");

    const diagnostics = renderMermaidBlocks(document.tree, PATH);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      path: PATH,
      line: 3,
      message: expect.stringContaining("Invalid Mermaid diagram"),
    });
    expect(document.tree.children[1]?.type).toBe("code");
  });

  test("leaves ordinary code fences untouched", () => {
    const document = parse("```js\nconst answer = 42;\n```");

    expect(renderMermaidBlocks(document.tree, PATH)).toEqual([]);
    expect(document.tree.children[0]?.type).toBe("code");
  });
});
