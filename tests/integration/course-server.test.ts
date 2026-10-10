import { afterEach, expect, test } from "bun:test";
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
  expect(JSON.stringify(body.tree)).toContain('"url":"figure%20one.svg"');
  expect(body.tree.children[1].children[0].title).toBe("Shared diagram");
  expect((await fetch(new URL("/_course-assets/figure%20one.svg", server.url))).status).toBe(200);
  expect((await fetch(new URL("/_course-assets/secret.txt", server.url))).status).toBe(404);
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
