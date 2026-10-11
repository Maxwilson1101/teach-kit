import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import {
  CourseLoadError,
  entryInspectionMessage,
  resolveLessonFile,
} from "../../../src/course/content";

describe("resolveLessonFile", () => {
  test("resolves a lesson file inside the course lessons directory", () => {
    expect(resolveLessonFile("/course", "message-lifecycle")).toBe(
      join(resolve("/course"), "lessons", "message-lifecycle.md"),
    );
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

describe("entryInspectionMessage", () => {
  test("reports a missing entry as missing", () => {
    expect(entryInspectionMessage({ code: "ENOENT" })).toBe("Course entry file does not exist.");
  });

  test("reports any other inspection failure with its reason", () => {
    const error = Object.assign(new Error("ENOTDIR: not a directory, stat"), { code: "ENOTDIR" });
    expect(entryInspectionMessage(error)).toBe(
      "Failed to inspect the course entry: ENOTDIR: not a directory, stat",
    );
    expect(entryInspectionMessage("plain failure")).toBe(
      "Failed to inspect the course entry: plain failure",
    );
  });
});
