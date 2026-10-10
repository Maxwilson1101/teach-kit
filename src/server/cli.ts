#!/usr/bin/env bun
import { readCoursePages } from "./course-data";
import { createServer } from "./create-server";

const [command, entry = "index.ts", ...extra] = process.argv.slice(2);
try {
  if ((command !== "check" && command !== "dev") || extra.length > 0) {
    throw new Error("Usage: teach-kit <check|dev> [entry.ts]");
  }
  if (command === "check") {
    const course = await readCoursePages(entry);
    for (const diagnostic of course.diagnostics)
      console.warn(`${diagnostic.path}: ${diagnostic.message}`);
    const available = course.overview.lessons.filter(
      (lesson) => lesson.status === "generated",
    ).length;
    console.log(
      `Course valid: ${available} available, ${course.overview.lessons.length - available} planned.`,
    );
  } else {
    const value = process.env.PORT ?? "4321";
    if (!/^\d+$/.test(value) || Number(value) > 65535) {
      throw new Error("PORT must be an integer from 0 to 65535.");
    }
    const server = await createServer({ entry, port: Number(value) });
    console.log(`Teach Kit running at ${server.url}`);
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, () => {
        server.stop(true);
        process.exit(0);
      });
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
