import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTempCourse, type TempCourse } from "../helpers/temp-course";

const cli = resolve(import.meta.dir, "../../src/server/cli.ts");
const courses: TempCourse[] = [];
afterEach(async () => {
  for (const course of courses.splice(0)) await course.cleanup();
});
async function course() {
  const fixture = await createTempCourse({
    config: {
      title: "CLI course",
      description: "Command fixture.",
      lessons: [{ id: "ready", title: "Ready", description: "Available" }],
    },
    lessons: { ready: "## A section\n\nBody." },
  });
  courses.push(fixture);
  return fixture;
}
async function run(args: string[], cwd: string) {
  const child = Bun.spawn([process.execPath, cli, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("checks the default entry and an explicit entry from a different directory", async () => {
  const fixture = await course();
  for (const [args, cwd] of [
    [["check"], fixture.directory],
    [["check", fixture.entry], "/tmp"],
  ] as const) {
    const result = await run([...args], cwd);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("1 available");
  }
});

test("reports unplanned Markdown as a warning without failing a valid course", async () => {
  const fixture = await course();
  await Bun.write(resolve(fixture.directory, "lessons/extra.md"), "Extra notes.");
  const result = await run(["check"], fixture.directory);
  expect(result.code).toBe(0);
  expect(result.stderr).toContain("not part of the course plan");
});

test("fails check with source locations and migration guidance for retired layouts", async () => {
  const fixture = await course();
  const source = readFileSync(new URL("../fixtures/legacy-columns.md", import.meta.url), "utf8");
  await Bun.write(resolve(fixture.directory, "lessons/ready.md"), source);
  const result = await run(["check"], fixture.directory);
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('ready.md:3:1: Directive "columns" is no longer supported.');
  expect(result.stderr).toContain('ready.md:4:1: Directive "column" is no longer supported.');
  expect(result.stderr).toContain("Use sequential headings and paragraphs, or a Markdown table");
  expect(result.stdout).not.toContain("available");
});

test("returns nonzero located diagnostics for invalid content and missing entries", async () => {
  const fixture = await course();
  await Bun.write(resolve(fixture.directory, "lessons/ready.md"), ":::unknown\nBody\n:::");
  const invalid = await run(["check"], fixture.directory);
  expect(invalid.code).toBe(1);
  expect(invalid.stderr).toContain("ready.md:1:1");
  expect(invalid.stderr).toContain("Unknown directive");
  const missing = await run(["check", "missing.ts"], fixture.directory);
  expect(missing.code).toBe(1);
  expect(missing.stderr).toContain("does not exist");
});

test("rejects unknown commands, extra arguments, and invalid ports", async () => {
  const fixture = await course();
  for (const args of [["unknown"], ["check", fixture.entry, "extra"]]) {
    const result = await run(args, fixture.directory);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Usage:");
  }
  const child = Bun.spawn([process.execPath, cli, "dev"], {
    cwd: fixture.directory,
    env: { ...process.env, PORT: "not-a-port" },
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(await new Response(child.stderr).text()).toContain("PORT");
  expect(await child.exited).toBe(1);
});

test("starts a preview, serves a direct lesson, and exits cleanly on SIGTERM", async () => {
  const fixture = await course();
  const child = Bun.spawn([process.execPath, cli, "dev", fixture.entry], {
    cwd: "/tmp",
    env: { ...process.env, PORT: "0" },
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    const reader = child.stdout.getReader();
    let output = "";
    const decoder = new TextDecoder();
    while (!output.includes("http://")) {
      const next = await reader.read();
      if (next.done) throw new Error("Preview exited before startup.");
      output += decoder.decode(next.value);
    }
    const url = output.match(/http:\/\/[^\s]+/)?.[0];
    if (!url) throw new Error("Startup URL is missing.");
    expect((await fetch(new URL("/lessons/ready", url))).status).toBe(200);
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0);
  } finally {
    child.kill();
    await child.exited;
  }
}, 15_000);
