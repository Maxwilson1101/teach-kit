import { describe, expect, test } from "bun:test";
import { CourseConfigError, defineCourse, type CourseConfig } from "./config";

const validConfig: CourseConfig = {
  title: "Message Passing",
  description: "Understand transport and verification.",
  lessons: [
    { id: "message-lifecycle", title: "Message Lifecycle", description: "Transport versus verification." },
    { id: "mailbox", title: "Mailbox", description: "Dispatch and processing." },
  ],
};

function captureError(run: () => unknown): CourseConfigError {
  try {
    run();
  } catch (error) {
    if (error instanceof CourseConfigError) return error;
    throw error;
  }
  throw new Error("Expected defineCourse to throw a CourseConfigError.");
}

describe("defineCourse", () => {
  test("returns the validated course and preserves lesson order", () => {
    const course = defineCourse(validConfig);
    expect(course.title).toBe("Message Passing");
    expect(course.lessons.map(lesson => lesson.id)).toEqual(["message-lifecycle", "mailbox"]);
  });

  test("accepts a course with no planned lessons", () => {
    expect(defineCourse({ ...validConfig, lessons: [] }).lessons).toEqual([]);
  });
});

describe("course configuration validation", () => {
  test("rejects a config that is not an object", () => {
    const error = captureError(() => defineCourse(null as unknown as CourseConfig));
    expect(error.issues.map(issue => issue.path)).toEqual(["course"]);
  });

  test("rejects a missing or empty title and description", () => {
    const error = captureError(() => defineCourse({ ...validConfig, title: "  ", description: "" }));
    expect(error.issues.map(issue => issue.path)).toEqual(["title", "description"]);
  });

  test("rejects a lessons field that is not an array", () => {
    const error = captureError(() => defineCourse({ ...validConfig, lessons: "nope" } as unknown as CourseConfig));
    expect(error.issues.map(issue => issue.path)).toEqual(["lessons"]);
  });

  test("rejects lessons that are not objects with required fields", () => {
    const error = captureError(() =>
      defineCourse({ ...validConfig, lessons: [null, { id: "valid-id" }] } as unknown as CourseConfig),
    );
    expect(error.issues.map(issue => issue.path)).toEqual(["lessons[0]", "lessons[1].title", "lessons[1].description"]);
  });

  test("rejects missing lesson title and description", () => {
    const error = captureError(() =>
      defineCourse({ ...validConfig, lessons: [{ id: "valid-id", title: "", description: "  " }] }),
    );
    expect(error.issues.map(issue => issue.path)).toEqual(["lessons[0].title", "lessons[0].description"]);
  });

  test("rejects unsafe lesson ids", () => {
    const unsafeIds = ["../escape", "Message Lifecycle", "UPPER", "trailing-", "-leading", "double--dash", ""];
    for (const id of unsafeIds) {
      const error = captureError(() =>
        defineCourse({ ...validConfig, lessons: [{ id, title: "Title", description: "Description" }] }),
      );
      expect(error.issues.map(issue => issue.path)).toEqual(["lessons[0].id"]);
    }
  });

  test("rejects duplicate lesson ids and reports the duplicate", () => {
    const error = captureError(() =>
      defineCourse({
        ...validConfig,
        lessons: [
          { id: "same-id", title: "First", description: "First body." },
          { id: "same-id", title: "Second", description: "Second body." },
        ],
      }),
    );
    expect(error.issues.map(issue => issue.path)).toEqual(["lessons[1].id"]);
  });

  test("collects all issues into an aggregated error", () => {
    const error = captureError(() => defineCourse({ title: "", description: "", lessons: [] }));
    expect(error.name).toBe("CourseConfigError");
    expect(error.issues).toHaveLength(2);
    expect(error.message).toContain("title");
    expect(error.message).toContain("description");
  });
});