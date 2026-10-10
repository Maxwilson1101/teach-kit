import { afterEach, expect, test } from "bun:test";
import { createServer } from "../../../src/server/create-server";
import { createTempCourse, type TempCourse } from "../../helpers/temp-course";

const servers: Awaited<ReturnType<typeof createServer>>[] = [];
const courses: TempCourse[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) server.stop(true);
  for (const course of courses.splice(0)) await course.cleanup();
});

test("serves an empty course without inventing lessons and rejects unsupported methods", async () => {
  const course = await createTempCourse({
    config: { title: "Empty course", description: "A blank plan.", lessons: [] },
  });
  courses.push(course);
  const server = await createServer({ port: 0, entry: course.entry });
  servers.push(server);
  const response = await fetch(server.url);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/html");
  expect(await response.text()).toContain("<title>Teach Kit</title>");
  const metadata = await (await fetch(new URL("/api/course", server.url))).json();
  expect(metadata.lessons).toEqual([]);
  expect((await fetch(server.url, { method: "POST" })).status).toBe(405);
  expect((await fetch(server.url, { method: "HEAD" })).status).toBe(200);
});
