import { expect, test } from "bun:test";
import { defineCourse, type CourseConfig } from "../../src/index";

test("exports the course configuration API from the package entry", () => {
  const config = {
    title: "Message Passing",
    description: "Understand transport and verification.",
    lessons: [{ id: "message-lifecycle", title: "Message Lifecycle", description: "Transport versus verification." }],
  } satisfies CourseConfig;

  expect(defineCourse(config).lessons[0]?.id).toBe("message-lifecycle");
});