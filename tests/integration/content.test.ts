import { afterEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { CourseConfigError, CourseLoadError, loadCourse } from "../../src/index";
import type { CourseConfig } from "../../src/index";
import { createTempCourse, packageEntryUrl, type TempCourse, type TempCourseOptions } from "../helpers/temp-course";

const courses: TempCourse[] = [];

async function makeCourse(options: TempCourseOptions): Promise<TempCourse> {
  const course = await createTempCourse(options);
  courses.push(course);
  return course;
}

afterEach(async () => {
  await Promise.all(courses.splice(0).map(course => course.cleanup()));
});

const config: CourseConfig = {
  title: "Message Passing",
  description: "Understand transport and verification.",
  lessons: [
    { id: "message-lifecycle", title: "Message Lifecycle", description: "Transport versus verification." },
    { id: "mailbox", title: "Mailbox", description: "Dispatch and processing." },
  ],
};

async function captureError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("Expected the call to reject.");
}

describe("loadCourse", () => {
  test("derives generated and planned status while preserving the configured order", async () => {
    const course = await makeCourse({
      config,
      lessons: { "message-lifecycle": "## Transport\n\nRelayers transport messages.\n" },
    });

    const loaded = await loadCourse(course.entry);

    expect(loaded.title).toBe("Message Passing");
    expect(loaded.lessons.map(lesson => [lesson.id, lesson.status])).toEqual([
      ["message-lifecycle", "generated"],
      ["mailbox", "planned"],
    ]);
  });

  test("reads the lesson body and points planned lessons at their expected file", async () => {
    const body = "## Transport\n\nRelayers transport messages.\n";
    const course = await makeCourse({ config, lessons: { "message-lifecycle": body } });

    const loaded = await loadCourse(course.entry);
    const [generated, planned] = loaded.lessons;

    expect(generated?.source).toBe(body);
    expect(generated?.file).toBe(join(course.directory, "lessons", "message-lifecycle.md"));
    expect(planned?.source).toBeUndefined();
    expect(planned?.file).toBe(join(course.directory, "lessons", "mailbox.md"));
  });

  test("treats a course without a lessons directory as all planned without diagnostics", async () => {
    const course = await makeCourse({ config });

    const loaded = await loadCourse(course.entry);

    expect(loaded.lessons.every(lesson => lesson.status === "planned")).toBe(true);
    expect(loaded.diagnostics).toEqual([]);
  });

  test("resolves the entry against the working directory and lessons against the entry", async () => {
    const course = await makeCourse({ config, lessons: { mailbox: "## Mailbox\n" } });

    const loaded = await loadCourse(relative(process.cwd(), course.entry));

    expect(loaded.entry).toBe(course.entry);
    expect(loaded.directory).toBe(course.directory);
    expect(loaded.lessons.find(lesson => lesson.id === "mailbox")?.status).toBe("generated");
  });

  test("reports a missing course entry", async () => {
    const course = await makeCourse({ config });

    const error = await captureError(() => loadCourse(join(course.directory, "missing.ts")));

    expect(error).toBeInstanceOf(CourseLoadError);
    expect((error as CourseLoadError).path).toBe(join(course.directory, "missing.ts"));
  });

  test("reports an entry without a default export", async () => {
    const course = await makeCourse({ config, entrySource: "export const value = 1;\n" });

    expect(await captureError(() => loadCourse(course.entry))).toBeInstanceOf(CourseLoadError);
  });

  test("wraps an entry module that throws during import", async () => {
    const course = await makeCourse({ config, entrySource: 'throw new Error("entry exploded");\n' });

    const error = await captureError(() => loadCourse(course.entry));

    expect(error).toBeInstanceOf(CourseLoadError);
    expect(error.message).toContain("entry exploded");
  });

  test("propagates configuration errors thrown while importing the entry", async () => {
    const course = await makeCourse({
      config,
      entrySource:
        `import { defineCourse } from ${JSON.stringify(packageEntryUrl)};\n` +
        'export default defineCourse({ title: "", description: "", lessons: [] });\n',
    });

    expect(await captureError(() => loadCourse(course.entry))).toBeInstanceOf(CourseConfigError);
  });

  test("propagates configuration issues for an invalid default export", async () => {
    const course = await makeCourse({
      config,
      entrySource: 'export default { title: "  ", description: "", lessons: [] };\n',
    });

    const error = await captureError(() => loadCourse(course.entry));

    expect(error).toBeInstanceOf(CourseConfigError);
    expect((error as CourseConfigError).issues.map(issue => issue.path)).toEqual(["title", "description"]);
  });

  test("reports a lesson path that exists but cannot be read as a file", async () => {
    const course = await makeCourse({ config });
    await mkdir(join(course.directory, "lessons", "mailbox.md"), { recursive: true });

    expect(await captureError(() => loadCourse(course.entry))).toBeInstanceOf(CourseLoadError);
  });

  test("warns about top-level markdown files that are not part of the plan", async () => {
    const course = await makeCourse({ config, extraFiles: { "lessons/orphan.md": "## Orphan\n" } });

    const loaded = await loadCourse(course.entry);

    expect(loaded.diagnostics).toEqual([
      {
        severity: "warning",
        path: join(course.directory, "lessons", "orphan.md"),
        message: "Markdown file is not part of the course plan: orphan.md.",
      },
    ]);
    expect(loaded.lessons.map(lesson => lesson.id)).toEqual(["message-lifecycle", "mailbox"]);
  });

  test("ignores non-markdown files and nested directories", async () => {
    const course = await makeCourse({
      config,
      extraFiles: {
        "lessons/notes.txt": "not a lesson",
        "lessons/archive/old.md": "## Old\n",
      },
    });

    expect((await loadCourse(course.entry)).diagnostics).toEqual([]);
  });

  test("sorts unplanned markdown warnings by file name", async () => {
    const course = await makeCourse({
      config,
      extraFiles: { "lessons/zeta.md": "## Zeta\n", "lessons/alpha.md": "## Alpha\n" },
    });

    const loaded = await loadCourse(course.entry);

    expect(loaded.diagnostics.map(diagnostic => basename(diagnostic.path))).toEqual(["alpha.md", "zeta.md"]);
  });
});