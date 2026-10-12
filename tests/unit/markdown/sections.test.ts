import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "../../../src/markdown/parse";
import { extractSections } from "../../../src/markdown/sections";

function sections(source: string) {
  return extractSections(parseMarkdown("lessons/lesson.md", source).tree);
}

describe("extractSections", () => {
  test("excludes titles, deep and nested headings while keeping mixed-level anchors unique", () => {
    expect(
      sections(
        "# Title\n\n### Same\n\nChild.\n\n#### Detail\n\nMore.\n\n> ### Quoted\n\n## Same\n\nParent.",
      ),
    ).toEqual([
      { id: "same", depth: 3, title: "Same", summary: "Child." },
      { id: "same-1", depth: 2, title: "Same", summary: "Parent." },
    ]);
  });
  test("uses level-two headings as ordered sections", () => {
    const source = [
      "# Lesson title",
      "Intro.",
      "",
      "## First",
      "",
      "One.",
      "",
      "## Second",
      "",
      "Two.",
    ].join("\n");

    expect(sections(source)).toEqual([
      { id: "first", depth: 2, title: "First", summary: "One." },
      { id: "second", depth: 2, title: "Second", summary: "Two." },
    ]);
  });

  test("includes level-three subheadings as distinct sections", () => {
    const source = ["## Outer", "", "Intro.", "", "### Nested", "", "Detail."].join("\n");

    expect(sections(source)).toEqual([
      { id: "outer", depth: 2, title: "Outer", summary: "Intro." },
      { id: "nested", depth: 3, title: "Nested", summary: "Detail." },
    ]);
  });

  test("does not treat headings inside block quotes as sections", () => {
    const source = ["> ## Quoted", "", "## Real", "", "Body."].join("\n");

    expect(sections(source)).toEqual([{ id: "real", depth: 2, title: "Real", summary: "Body." }]);
  });

  test("generates unique anchors for duplicate titles", () => {
    const source = ["## Overview", "", "A.", "", "## Overview", "", "B."].join("\n");

    expect(sections(source).map((section) => section.id)).toEqual(["overview", "overview-1"]);
  });

  test("generates unique anchors for punctuation-only and empty titles", () => {
    const source = ["## !!!", "", "A.", "", "## !!!", "", "B.", "", "##", "", "C."].join("\n");

    const result = sections(source);

    expect(result.map((section) => section.id)).toEqual(["section", "section-1", "section-2"]);
  });

  test("summarizes from the first prose block and skips code and tables", () => {
    const source = [
      "## Mixed",
      "",
      "```js",
      "not prose",
      "```",
      "",
      "| a | b |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "Real *summary* text.",
    ].join("\n");

    expect(sections(source)).toEqual([
      { id: "mixed", depth: 2, title: "Mixed", summary: "Real summary text." },
    ]);
  });

  test("returns an empty summary when a section has no prose", () => {
    const source = ["## Code only", "", "```js", "value()", "```"].join("\n");

    expect(sections(source)).toEqual([
      { id: "code-only", depth: 2, title: "Code only", summary: "" },
    ]);
  });

  test("keeps fallback anchors unique alongside actual section titles", () => {
    expect(sections("## !!!\n\n## Section\n\n##").map((section) => section.id)).toEqual([
      "section",
      "section-1",
      "section-2",
    ]);
  });

  test("preserves adjacent inline text and includes image alternative text", () => {
    expect(
      sections(
        "## Summary\n\nSome **bold**text and [link](https://example.com). ![Diagram](assets/a.png)",
      )[0]?.summary,
    ).toBe("Some boldtext and link. Diagram");
    expect(
      sections("## Summary\n\n![Referenced diagram][pic]\n\n[pic]: assets/a.png")[0]?.summary,
    ).toBe("Referenced diagram");
  });

  test("preserves hard-break word boundaries without modifying the shared tree", () => {
    const document = parseMarkdown(
      "lesson.md",
      "## Summary\n\nFirst  \nsecond and *third  \nfourth*.",
    );
    const original = structuredClone(document.tree);
    expect(extractSections(document.tree)[0]?.summary).toBe("First second and third fourth.");
    expect(document.tree).toEqual(original);
  });

  test("keeps parent summaries separate from subheadings and reads prose containers", () => {
    expect(sections("## Summary\n\n### Subheading\n\nActual prose.")[1]?.summary).toBe(
      "Actual prose.",
    );
    expect(sections("## Summary\n\n> ### Quoted heading\n>\n> Quoted prose.")[0]?.summary).toBe(
      "Quoted prose.",
    );
    expect(sections("## Summary\n\n- First item.\n- Second item.")[0]?.summary).toBe("First item.");
    expect(sections("## Summary\n\n### Subheading")[0]?.summary).toBe("");
  });

  test("avoids reserved page IDs while keeping duplicate section anchors unique", () => {
    const tree = parseMarkdown(
      "lesson.md",
      "## Main content\n\n## Main content\n\n## Main content-1\n\n## Other",
    ).tree;
    expect(
      extractSections(tree, ["main-content", "main-content-1"]).map((section) => section.id),
    ).toEqual(["main-content-2", "main-content-3", "main-content-1-1", "other"]);
    expect(extractSections(tree).map((section) => section.id)).toEqual([
      "main-content",
      "main-content-1",
      "main-content-1-1",
      "other",
    ]);
  });

  test("ignores content before the first level-two heading", () => {
    expect(sections("Intro only.")).toEqual([]);
  });
});
