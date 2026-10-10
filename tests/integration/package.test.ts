import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const project = resolve(import.meta.dir, "../..");

async function run(args: string[], cwd: string): Promise<void> {
  const child = Bun.spawn([process.execPath, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode, `${args.join(" ")}\n${stdout}\n${stderr}`).toBe(0);
}

test("installs the packed artifact with types, CLI, browser pages, and Markdown refresh", async () => {
  const directory = await mkdtemp(join(tmpdir(), "teach-kit-package-"));
  try {
    await run(["run", "build"], project);
    await run(["pm", "pack", "--filename", join(directory, "teach-kit.tgz"), "--quiet"], project);
    await Bun.write(
      join(directory, "package.json"),
      JSON.stringify({
        name: "packed-course-fixture",
        private: true,
        type: "module",
        dependencies: { "teach-kit": "file:./teach-kit.tgz" },
      }),
    );
    await run(["install", "--ignore-scripts"], directory);
    await mkdir(join(directory, "course", "lessons"), { recursive: true });
    await Bun.write(
      join(directory, "course", "index.ts"),
      `
import { defineCourse } from "teach-kit";
export default defineCourse({
  title: "Packed course",
  description: "Independent installation",
  lessons: [
    { id: "ready", title: "Ready", description: "Available source" },
    { id: "planned", title: "Planned", description: "Missing source" },
  ],
});
`,
    );
    await Bun.write(join(directory, "course", "lessons", "ready.md"), "## Ready\n\nBody.");
    await Bun.write(
      join(directory, "check.ts"),
      `
import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadCourse } from "teach-kit";
import { toHast } from "mdast-util-to-hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import * as Tabs from "@radix-ui/react-tabs";

const course = await loadCourse("course/index.ts");
assert.deepEqual(course.lessons.map((lesson) => lesson.status), ["generated", "planned"]);
assert.equal(course.lessons[0].source, "## Ready\\n\\nBody.");
assert.deepEqual(course.diagnostics, []);
const entry = new URL(import.meta.resolve("teach-kit"));
assert.equal((await stat(fileURLToPath(new URL("web/index.html", entry)))).isFile(), true);
const tree = { type: "root", children: [
  { type: "paragraph", children: [{ type: "text", value: "Packaged runtime." }] },
] };
assert.equal(renderToStaticMarkup(toJsxRuntime(toHast(tree), { Fragment, jsx, jsxs })),
  "<p>Packaged runtime.</p>");
const tabs = renderToStaticMarkup(jsxs(Tabs.Root, {
  defaultValue: "one",
  children: [
    jsx(Tabs.List, { children: jsx(Tabs.Trigger, { value: "one", children: "First" }) }),
    jsx(Tabs.Content, { value: "one", children: "Installed panel." }),
  ],
}));
assert.match(tabs, /role="tab"/);
assert.match(tabs, /role="tabpanel"/);
assert.match(tabs, /Installed panel/);
`,
    );
    await run(["run", "check.ts"], directory);
    const installedCli = join(directory, "node_modules/teach-kit/dist/server/cli.js");
    await run(["run", "node_modules/.bin/teach-kit", "check", "course/index.ts"], directory);
    const preview = Bun.spawn([process.execPath, installedCli, "dev", "course/index.ts"], {
      cwd: directory,
      env: { ...process.env, PORT: "0" },
      stdout: "pipe",
      stderr: "pipe",
    });
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      const reader = preview.stdout.getReader();
      let startup = "";
      while (!startup.includes("http://")) {
        const next = await reader.read();
        if (next.done)
          throw new Error(`Installed preview failed: ${await new Response(preview.stderr).text()}`);
        startup += new TextDecoder().decode(next.value);
      }
      const url = startup.match(/http:\/\/[^\s]+/)?.[0];
      if (!url) throw new Error("Installed preview URL is missing.");
      browser = await chromium.launch({ headless: true });
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 393, height: 851 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(url);
        await page.getByRole("heading", { name: "Packed course", exact: true }).waitFor();
        expect(await page.getByRole("link", { name: /Ready/ }).count()).toBe(1);
        expect(await page.getByRole("link", { name: /Planned/ }).count()).toBe(0);
        await page.getByRole("link", { name: /Ready/ }).click();
        await page.getByText("Body.", { exact: true }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await Bun.write(
          join(directory, "course/lessons/ready.md"),
          "## Ready\n\nRefreshed packed body.",
        );
        await page.reload();
        await page.getByText("Refreshed packed body.", { exact: true }).waitFor();
        expect(errors).toEqual([]);
        await page.close();
        await Bun.write(join(directory, "course/lessons/ready.md"), "## Ready\n\nBody.");
      }
      preview.kill("SIGTERM");
      expect(await preview.exited).toBe(0);
    } finally {
      await browser?.close();
      preview.kill();
      await preview.exited;
    }
    await Bun.write(
      join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          target: "ESNext",
          module: "Preserve",
          moduleResolution: "bundler",
          types: [],
        },
        include: ["course/index.ts"],
      }),
    );
    await run(
      [join(project, "node_modules/typescript/bin/tsc"), "--project", "tsconfig.json"],
      directory,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 120_000);
