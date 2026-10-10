import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "../../../src/markdown/parse";
import { extractSections } from "../../../src/markdown/sections";

function sections(source: string) {
  return extractSections(parseMarkdown("lessons/lesson.md", source).tree);
}

describe("extractSections", () => {
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
      { id: "first", title: "First", summary: "One." },
      { id: "second", title: "Second", summary: "Two." },
    ]);
  });

  test("keeps deeper headings inside the enclosing section and not as boundaries", () => {
    const source = ["## Outer", "", "Intro.", "", "### Nested", "", "Detail."].join("\n");

    expect(sections(source)).toEqual([{ id: "outer", title: "Outer", summary: "Intro." }]);
  });

  test("does not treat headings inside block quotes as sections", () => {
    const source = ["> ## Quoted", "", "## Real", "", "Body."].join("\n");

    expect(sections(source)).toEqual([{ id: "real", title: "Real", summary: "Body." }]);
  });

  test("generates unique anchors for duplicate titles", () => {
    const source = ["## Overview", "", "A.", "", "## Overview", "", "B."].join("\n");

    expect(sections(source).map((section) => section.id)).toEqual(["overview", "overview-1"]);
  });

  test("generates unique anchors for punctuation-only and empty titles", () => {
    const source = ["## !!!", "", "A.", "", "## !!!", "", "B.", "", "##", "", "C."].join("\n");

    const result = sections(source);

    expect(result.map((section) => section.id)).toHaveLength(3);
    expect(new Set(result.map((section) => section.id)).size).toBe(3);
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
      { id: "mixed", title: "Mixed", summary: "Real summary text." },
    ]);
  });

  test("returns an empty summary when a section has no prose", () => {
    const source = ["## Code only", "", "```js", "value()", "```"].join("\n");

    expect(sections(source)).toEqual([{ id: "code-only", title: "Code only", summary: "" }]);
  });

  test("ignores content before the first level-two heading", () => {
    expect(sections("Intro only.")).toEqual([]);
  });
});
