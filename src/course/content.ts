/**
 * Course content loading and lesson path resolution.
 *
 * Relative course entry paths resolve against the working directory.
 * Lesson paths resolve against the course entry directory.
 */

import { type Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type CourseConfig, CourseConfigError, defineCourse, type LessonConfig } from "./config";

export class CourseLoadError extends Error {
  /** Location of the problem, for example the course entry path. */
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "CourseLoadError";
    this.path = path;
  }
}

function containsTraversal(relativePath: string): boolean {
  return relativePath.split(/[\\/]/).some((segment) => segment === "..");
}

/**
 * Constructs a lexical path to `<courseDirectory>/lessons/<id>.md`.
 * Rejects empty ids, path separators, and paths outside the lessons directory.
 * Does not access the filesystem or resolve symbolic links.
 *
 * @throws {CourseLoadError} When the id produces an unsafe lesson path.
 */
export function resolveLessonFile(courseDirectory: string, id: string): string {
  if (id.length === 0 || /[\\/]/.test(id)) {
    throw new CourseLoadError("lessons", `Unsafe lesson id "${id}".`);
  }

  const lessonsDirectory = resolve(courseDirectory, "lessons");
  const file = resolve(lessonsDirectory, `${id}.md`);
  const relativePath = relative(lessonsDirectory, file);

  if (relativePath !== `${id}.md` || isAbsolute(relativePath) || containsTraversal(relativePath)) {
    throw new CourseLoadError("lessons", `Unsafe lesson id "${id}".`);
  }

  return file;
}

export interface ContentDiagnostic {
  severity: "error" | "warning";
  /** File path associated with the diagnostic. */
  path: string;
  message: string;
}

export type LessonStatus = "planned" | "generated";

export interface LoadedLesson extends LessonConfig {
  /**
   * `planned` means the lesson file is missing; `generated` means it was read.
   * Generated status does not imply Markdown parsing or validation succeeded.
   */
  status: LessonStatus;
  /** Absolute path of `lessons/<id>.md`. */
  file: string;
  /** Markdown body, present only for generated lessons. */
  source?: string;
}

export interface LoadedCourse {
  title: string;
  description: string;
  /** Absolute path of the course entry file. */
  entry: string;
  /** Absolute directory of the course entry; the base for content and assets. */
  directory: string;
  /** Configured lessons in reading order, including those with missing files. */
  lessons: LoadedLesson[];
  /**
   * Warnings for unplanned top-level Markdown files in the lessons directory.
   * Loading failures throw instead of returning error diagnostics.
   */
  diagnostics: ContentDiagnostic[];
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Finds top-level `lessons/*.md` files whose id is absent from the plan.
 * Nested directories and non-markdown files are ignored; every planned lesson
 * maps to exactly one top-level file.
 */
async function findUnplannedLessons(
  directory: string,
  plannedIds: ReadonlySet<string>,
): Promise<ContentDiagnostic[]> {
  const lessonsDirectory = join(directory, "lessons");
  let entries: Dirent[];
  try {
    entries = await readdir(lessonsDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return [];
    const message = error instanceof Error ? error.message : String(error);
    throw new CourseLoadError(lessonsDirectory, `Failed to scan the lessons directory: ${message}`);
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => ({ entry, id: entry.name.slice(0, -3) }))
    .filter(({ id }) => !plannedIds.has(id))
    .map(
      ({ entry }): ContentDiagnostic => ({
        severity: "warning",
        path: join(lessonsDirectory, entry.name),
        message: `Markdown file is not part of the course plan: ${entry.name}.`,
      }),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function importEntry(entry: string): Promise<unknown> {
  const stats = await stat(entry).catch(() => undefined);
  if (!stats?.isFile()) throw new CourseLoadError(entry, "Course entry file does not exist.");

  let imported: { default?: unknown };
  try {
    imported = (await import(pathToFileURL(entry).href)) as { default?: unknown };
  } catch (error) {
    // Configuration validation errors originate in the entry itself and stay actionable as-is.
    if (error instanceof CourseConfigError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new CourseLoadError(entry, `Failed to import the course entry: ${message}`);
  }

  if (!("default" in imported) || imported.default === undefined) {
    throw new CourseLoadError(entry, "Course entry must export a default course configuration.");
  }
  return imported.default;
}

async function loadLesson(directory: string, lesson: LessonConfig): Promise<LoadedLesson> {
  const file = resolveLessonFile(directory, lesson.id);
  try {
    const source = await readFile(file, "utf8");
    return { ...lesson, status: "generated", file, source };
  } catch (error) {
    if (isMissingFile(error)) return { ...lesson, status: "planned", file };
    const message = error instanceof Error ? error.message : String(error);
    throw new CourseLoadError(file, `Failed to read the lesson: ${message}`);
  }
}

/**
 * Loads course configuration and lesson sources in the configured order.
 * Missing lesson files are planned content; unreadable files cause an error.
 * Unplanned top-level Markdown files produce warnings, not additional lessons.
 * Markdown parsing and validation are not performed by this loader.
 *
 * Entry imports follow the runtime module cache. Restart the process after
 * changing course configuration. Symbolic links are outside the supported
 * course layout; this loader does not explicitly reject them.
 *
 * @param entryPath Course entry path, relative to the working directory when
 * not absolute. Defaults to `index.ts`; lessons resolve against its directory.
 * @throws {CourseConfigError} When the entry exports invalid configuration.
 * @throws {CourseLoadError} When the entry cannot be loaded or lesson content
 * cannot be read or scanned.
 */
export async function loadCourse(entryPath = "index.ts"): Promise<LoadedCourse> {
  const entry = resolve(entryPath);
  const directory = dirname(entry);
  const config = defineCourse((await importEntry(entry)) as CourseConfig);
  const lessons = await Promise.all(config.lessons.map((lesson) => loadLesson(directory, lesson)));
  const diagnostics = await findUnplannedLessons(
    directory,
    new Set(config.lessons.map((lesson) => lesson.id)),
  );

  return {
    title: config.title,
    description: config.description,
    entry,
    directory,
    lessons,
    diagnostics,
  };
}
