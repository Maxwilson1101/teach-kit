import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { CourseLoadError, resolveLessonFile } from "./content";

describe("resolveLessonFile", () => {
  test("resolves a lesson file inside the course lessons directory", () => {
    expect(resolveLessonFile("/course", "message-lifecycle")).toBe("/course/lessons/message-lifecycle.md");
  });

  test("resolves relative course directories against the working directory", () => {
    expect(resolveLessonFile("course", "mailbox")).toBe(resolve("course/lessons/mailbox.md"));
  });

  test("rejects ids that traverse outside the lessons directory", () => {
    expect(() => resolveLessonFile("/course", "../secrets")).toThrow(CourseLoadError);
    expect(() => resolveLessonFile("/course", "../../etc/passwd")).toThrow(CourseLoadError);
  });

  test("rejects ids that contain path separators", () => {
    expect(() => resolveLessonFile("/course", "nested/lesson")).toThrow(CourseLoadError);
    expect(() => resolveLessonFile("/course", "nested\\lesson")).toThrow(CourseLoadError);
  });

  test("rejects an empty id", () => {
    expect(() => resolveLessonFile("/course", "")).toThrow(CourseLoadError);
  });
});