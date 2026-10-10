import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { visit } from "unist-util-visit";
import { readCoursePages } from "../../src/server/course-data";

test("provides a validated prose-only example with available and planned lessons", async () => {
  const course = await readCoursePages(resolve(import.meta.dir, "../../example/index.ts"));
  expect(course.overview.lessons.map((lesson) => lesson.status)).toEqual([
    "generated",
    "generated",
    "planned",
    "planned",
  ]);
  expect(course.diagnostics).toEqual([]);
  for (const { tree } of course.pages.values()) {
    const codeNodes: string[] = [];
    visit(tree, (node) => {
      if (node.type === "code" || node.type === "inlineCode") codeNodes.push(node.type);
    });
    expect(codeNodes).toEqual([]);
  }
});
