import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { visit } from "unist-util-visit";
import { readCoursePages } from "../../src/server/course-data";

test("provides a validated example whose rendering lesson exercises every renderer", async () => {
  const course = await readCoursePages(resolve(import.meta.dir, "../../example/index.ts"));
  expect(course.overview.lessons.map((lesson) => lesson.status)).toEqual([
    "generated",
    "generated",
    "generated",
    "planned",
    "planned",
  ]);
  expect(course.diagnostics).toEqual([]);

  const rendering = course.pages.get("rendering");
  if (!rendering) throw new Error("The example is missing the rendering lesson.");
  const types = new Set<string>();
  visit(rendering.tree, (node) => {
    types.add(node.type);
  });
  for (const type of ["inlineMath", "math", "code", "mermaidDiagram"]) {
    expect(types.has(type)).toBe(true);
  }
});
