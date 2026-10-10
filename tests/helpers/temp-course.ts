/**
 * Creates a disposable course directory that mirrors the consuming project
 * layout: a root `index.ts` entry, `lessons/<id>.md`, and optional extra files.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CourseConfig } from "../../src/course/config";

/** File URL of the package entry, used to build generated course entries. */
export const packageEntryUrl = pathToFileURL(resolve(import.meta.dir, "../../src/index.ts")).href;

export interface TempCourse {
  directory: string;
  entry: string;
  cleanup: () => Promise<void>;
}

export interface TempCourseOptions {
  config: CourseConfig;
  /** Markdown bodies keyed by lesson id. */
  lessons?: Record<string, string>;
  /** Extra files keyed by path relative to the course directory. */
  extraFiles?: Record<string, string>;
  /** Replaces the generated entry source; use to test entry failure modes. */
  entrySource?: string;
}

export async function createTempCourse(options: TempCourseOptions): Promise<TempCourse> {
  const directory = await mkdtemp(join(tmpdir(), "teach-kit-course-"));
  const entry = join(directory, "index.ts");
  const source =
    options.entrySource ??
    `import { defineCourse } from ${JSON.stringify(packageEntryUrl)};\n\n` +
      `export default defineCourse(${JSON.stringify(options.config, null, 2)});\n`;
  await writeFile(entry, source);

  if (options.lessons) {
    await mkdir(join(directory, "lessons"), { recursive: true });
    for (const [id, markdown] of Object.entries(options.lessons)) {
      await writeFile(join(directory, "lessons", `${id}.md`), markdown);
    }
  }

  for (const [relativePath, content] of Object.entries(options.extraFiles ?? {})) {
    const target = join(directory, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }

  return {
    directory,
    entry,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}