import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "../../src/server/create-server";
import { createTempCourse, type TempCourse } from "../helpers/temp-course";

const courses: TempCourse[] = [];
const servers: Awaited<ReturnType<typeof createServer>>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) server.stop(true);
  for (const course of courses.splice(0)) await course.cleanup();
});

async function fixture() {
  const course = await createTempCourse({
    config: {
      title: "Protocol study",
      description: "A course about boundaries.",
      lessons: [
        { id: "first", title: "First lesson", description: "The starting point." },
        { id: "planned", title: "Future lesson", description: "Not written yet." },
        { id: "last", title: "Last lesson", description: "The ending." },
      ],
    },
    lessons: {
      first:
        "Introduction.\n\n## Model\n\n![Local diagram](assets/model.svg)\n\n## Model\n\nConclusion.",
      last: "## Review\n\nReview body.",
    },
    extraFiles: {
      "assets/model.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
      "secret.txt": "Private",
    },
  });
  courses.push(course);
  return course;
}

test("serves ordered metadata, validated lesson ASTs, and entry-relative assets", async () => {
  const course = await fixture();
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const metadata = await (await fetch(new URL("/api/course", server.url))).json();
  expect(metadata.title).toBe("Protocol study");
  expect(metadata.lessons.map((lesson: { status: string }) => lesson.status)).toEqual([
    "generated",
    "planned",
    "generated",
  ]);
  expect(JSON.stringify(metadata)).not.toContain(course.directory);
  const lesson = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  expect(
    lesson.tree.children
      .filter((node: { type: string }) => node.type === "heading")
      .map((node: { data: { hProperties: { id: string } } }) => node.data.hProperties.id),
  ).toEqual(["model", "model-1"]);
  expect(lesson.sections).toEqual([
    { id: "model", title: "Model", summary: "Local diagram" },
    { id: "model-1", title: "Model", summary: "Conclusion." },
  ]);
  expect(JSON.stringify(lesson.tree)).toContain("/assets/model.svg");
  for (const path of ["/", "/lessons/first", "/lessons/last"]) {
    const response = await fetch(new URL(path, server.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  }
  const asset = await fetch(new URL("/assets/model.svg", server.url));
  expect(asset.status).toBe(200);
  expect(await asset.text()).toContain("<svg");
  for (const path of [
    "/lessons/planned",
    "/lessons/unknown",
    "/api/lessons/planned",
    "/missing",
    "/secret.txt",
    "/assets/%2e%2e%2fsecret.txt",
    "/assets/missing.svg",
  ]) {
    expect((await fetch(new URL(path, server.url))).status, path).toBe(404);
  }
});

test("shares root heading IDs and prose summaries while excluding nested headings", async () => {
  const course = await fixture();
  await Bun.write(
    join(course.directory, "lessons/first.md"),
    [
      "Introduction.",
      "",
      "> ## Quoted heading",
      "",
      "## Overview",
      "",
      ':::details{title="Extra"}',
      "## Hidden heading",
      "Hidden summary.",
      ":::",
      "",
      "```ts",
      "const value = 1;",
      "```",
      "",
      "Real **summary**.",
      "",
      "## Overview",
      "",
      "##",
    ].join("\n"),
  );
  await Bun.write(join(course.directory, "lessons/last.md"), "Introduction without sections.");
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const lesson = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  expect(lesson.sections).toEqual([
    { id: "overview", title: "Overview", summary: "Real summary." },
    { id: "overview-1", title: "Overview", summary: "" },
    { id: "section", title: "", summary: "" },
  ]);
  expect(
    lesson.tree.children
      .filter(
        (node: { type: string; depth?: number }) => node.type === "heading" && node.depth === 2,
      )
      .map((node: { data: { hProperties: { id: string } } }) => node.data.hProperties.id),
  ).toEqual(lesson.sections.map((section: { id: string }) => section.id));
  const last = await (await fetch(new URL("/api/lessons/last", server.url))).json();
  expect(last.sections).toEqual([]);
});

test("does not assign the skip-link target ID to a lesson heading", async () => {
  const course = await fixture();
  await Bun.write(join(course.directory, "lessons/first.md"), "## Main content\n\nBody.");
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const lesson = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  expect(lesson.sections).toEqual([
    { id: "main-content-1", title: "Main content", summary: "Body." },
  ]);
  expect(lesson.tree.children[0].data.hProperties.id).toBe("main-content-1");
});

test("serves referenced images outside assets without exposing other course files", async () => {
  const course = await fixture();
  await Bun.write(
    join(course.directory, "figure one.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  await Bun.write(
    join(course.directory, "lessons/first.md"),
    '## Figure\n\n![Figure][shared]\n\n[Read the same reference][shared]\n\n[shared]: figure%20one.svg "Shared diagram"',
  );
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const body = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  expect(JSON.stringify(body.tree)).toContain("/_course-assets/figure%20one.svg");
  expect(JSON.stringify(body.tree)).toContain('"url":"/_course-assets/figure%20one.svg"');
  expect(body.tree.children[1].children[0].title).toBe("Shared diagram");
  expect((await fetch(new URL("/_course-assets/figure%20one.svg", server.url))).status).toBe(200);
  expect((await fetch(new URL("/_course-assets/secret.txt", server.url))).status).toBe(404);
});

test("serves nested assets with encoded names and rejects sibling-directory escapes", async () => {
  const course = await fixture();
  await Bun.write(join(course.directory, "assets/nested/figure one.svg"), "Nested figure.");
  await Bun.write(join(course.directory, "assets-private/secret.txt"), "Private sibling.");
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const response = await fetch(new URL("/assets/nested/figure%20one.svg", server.url));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("Nested figure.");
  for (const path of [
    "/assets/%2e%2e%2fassets-private%2fsecret.txt",
    "/assets/%2e%2e%5cassets-private%5csecret.txt",
    "/assets/%2e%2e%2findex.ts",
    "/assets",
  ]) {
    expect((await fetch(new URL(path, server.url))).status, path).toBe(404);
  }
});

test("preserves query strings and fragments on inline and reference images", async () => {
  const course = await fixture();
  await Bun.write(join(course.directory, "figure one.svg"), "Outside figure.");
  await Bun.write(
    join(course.directory, "lessons/first.md"),
    [
      "![Inline](assets/model.svg?v=1#detail)",
      "![Reference][figure]",
      '[figure]: figure%20one.svg?v=2#overview "Figure title"',
    ].join("\n\n"),
  );
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const body = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  const images = body.tree.children
    .filter((node: { type: string }) => node.type === "paragraph")
    .flatMap((node: { children: { url: string }[] }) => node.children);
  expect(images.map((image: { url: string }) => image.url)).toEqual([
    "/assets/model.svg?v=1#detail",
    "/_course-assets/figure%20one.svg?v=2#overview",
  ]);
  for (const image of images) {
    expect((await fetch(new URL(image.url, server.url))).status).toBe(200);
  }
});

test("resolves course-relative resource and lesson links while preserving web URLs and anchors", async () => {
  const course = await fixture();
  await Bun.write(join(course.directory, "figure one.svg"), "Linked figure.");
  await Bun.write(join(course.directory, "assets/notes.txt"), "Linked notes.");
  await Bun.write(
    join(course.directory, "lessons/first.md"),
    [
      "## Model",
      "[Notes](assets/notes.txt?v=1#notes)",
      "[Figure][figure]",
      "![Image][figure]",
      '[figure]: figure%20one.svg?v=2#detail "Shared title"',
      "[Next](lessons/last.md#review)",
      "[Planned](lessons/planned.md)",
      "[Local](#model)",
      "[Query](?mode=reading)",
      "[Route](/lessons/last)",
      "[External](https://example.com/path)",
      "[Email](mailto:teacher@example.com)",
      "[CDN](//example.com/diagram.svg)",
    ].join("\n\n"),
  );
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const body = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  const links = body.tree.children
    .filter((node: { type: string }) => node.type === "paragraph")
    .flatMap((node: { children: { type: string; url?: string }[] }) => node.children)
    .filter((node: { type: string }) => node.type === "link");
  expect(links.map((link: { url: string }) => link.url)).toEqual([
    "/assets/notes.txt?v=1#notes",
    "/_course-assets/figure%20one.svg?v=2#detail",
    "/lessons/last#review",
    "/lessons/planned",
    "#model",
    "?mode=reading",
    "/lessons/last",
    "https://example.com/path",
    "mailto:teacher@example.com",
    "//example.com/diagram.svg",
  ]);
  const base = new URL("/lessons/first", server.url);
  for (const link of links.slice(0, 3)) {
    expect((await fetch(new URL(link.url, base))).status).toBe(200);
  }
  expect((await fetch(new URL(links[3].url, base))).status).toBe(404);
});

test("does not expose entry or lesson sources through local links and returns 404 for missing resources", async () => {
  const course = await fixture();
  await Bun.write(
    join(course.directory, "lessons/first.md"),
    "[Entry](index.ts)\n\n[Unplanned](lessons/orphan.md)\n\n[Missing](missing.pdf)\n\n[Escape](../secret.txt)",
  );
  await Bun.write(join(course.directory, "lessons/orphan.md"), "Private source.");
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const body = await (await fetch(new URL("/api/lessons/first", server.url))).json();
  const links = body.tree.children.flatMap(
    (node: { children: { url: string }[] }) => node.children,
  );
  for (const link of links) {
    expect((await fetch(new URL(link.url, new URL("/lessons/first", server.url)))).status).toBe(
      404,
    );
  }
  expect((await fetch(new URL("/_course-assets/index.ts", server.url))).status).toBe(404);
  expect((await fetch(new URL("/_course-assets/lessons/orphan.md", server.url))).status).toBe(404);
});

test("refreshes Markdown and fails visibly when generated content becomes invalid", async () => {
  const course = await fixture();
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  await Bun.write(join(course.directory, "lessons/first.md"), "## Updated\n\nNew body.");
  let response = await fetch(new URL("/api/lessons/first", server.url));
  expect(await response.text()).toContain("New body.");
  await Bun.write(join(course.directory, "lessons/first.md"), ":::unknown\nBad content.\n:::");
  response = await fetch(new URL("/api/course", server.url));
  expect(response.status).toBe(422);
  const body = await response.json();
  expect(body.message).toContain("Unknown directive");
  expect(body.message).toContain("first.md:1:1");
});

test("rejects invalid lessons at startup rather than reporting them as planned", async () => {
  const course = await fixture();
  await Bun.write(join(course.directory, "lessons/first.md"), "<script>bad</script>");
  await expect(createServer({ port: 0, entry: course.entry })).rejects.toThrow("Raw HTML");
});

test("rejects retired layouts at startup with source-located diagnostics", async () => {
  const course = await fixture();
  const source = readFileSync(new URL("../fixtures/legacy-columns.md", import.meta.url), "utf8");
  await Bun.write(join(course.directory, "lessons/first.md"), source);
  await expect(
    createServer({ port: 0, entry: course.entry }).then((server) => {
      servers.push(server);
    }),
  ).rejects.toThrow(/first.md:3:1: Directive "columns" is no longer supported/);
});

test("returns a visible validation error when a running lesson gains a retired layout", async () => {
  const course = await fixture();
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const source = readFileSync(new URL("../fixtures/legacy-columns.md", import.meta.url), "utf8");
  await Bun.write(join(course.directory, "lessons/first.md"), source);
  const response = await fetch(new URL("/api/lessons/first", server.url));
  expect(response.status).toBe(422);
  const body = await response.json();
  expect(body.message).toContain('first.md:3:1: Directive "columns" is no longer supported.');
  expect(body.message).toContain("Markdown table for comparisons");
});

test("reports missing frontend resources and occupied ports at startup", async () => {
  const course = await fixture();
  await expect(
    createServer({
      port: 0,
      entry: course.entry,
      frontendDirectory: join(course.directory, "missing"),
    }),
  ).rejects.toThrow();
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  await expect(createServer({ port: server.port ?? 0, entry: course.entry })).rejects.toThrow();
});
