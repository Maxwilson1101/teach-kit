import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseView } from "../../../src/web/app";

test("renders an empty plan without placeholder lesson links", () => {
  const html = renderToStaticMarkup(
    <CourseView course={{ title: "Empty", description: "A blank course.", lessons: [] }} />,
  );
  expect(html).toContain("No lessons have been planned yet.");
  expect(html).not.toContain('href="/lessons/');
});

test("keeps introductory content and shared reference definitions throughout the article", () => {
  const html = renderToStaticMarkup(
    <CourseView
      course={{
        title: "References",
        description: "Shared definitions.",
        lessons: [{ id: "ready", title: "Ready", description: "Available", status: "generated" }],
      }}
      lessonId="ready"
      page={{
        sections: [],
        tree: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: "Introduction before sections." }],
            },
            { type: "heading", depth: 2, children: [{ type: "text", value: "A section" }] },
            {
              type: "paragraph",
              children: [
                {
                  type: "linkReference",
                  identifier: "source",
                  referenceType: "full",
                  children: [{ type: "text", value: "Read more" }],
                },
              ],
            },
            { type: "definition", identifier: "source", url: "https://example.com", title: null },
          ],
        },
      }}
    />,
  );
  expect(html).toContain("Introduction before sections.");
  expect(html).toContain('href="https://example.com"');
  expect(html).toContain("Read more");
});

test("keeps long metadata as escaped text and never links planned neighbors", () => {
  const course = {
    title: "<script>not executable</script>",
    description: "A".repeat(300),
    lessons: [
      { id: "before", title: "Before", description: "Planned first", status: "planned" as const },
      { id: "ready", title: "Ready", description: "Available", status: "generated" as const },
      { id: "after", title: "After", description: "Planned last", status: "planned" as const },
    ],
  };
  const html = renderToStaticMarkup(
    <CourseView
      course={course}
      lessonId="ready"
      page={{ tree: { type: "root", children: [] }, sections: [] }}
    />,
  );
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Previous lesson");
  expect(html).toContain("Next lesson");
  expect(html).not.toContain('href="/lessons/before"');
  expect(html).not.toContain('href="/lessons/after"');
});
