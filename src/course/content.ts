/**
 * Course content loading and path resolution.
 *
 * Lesson bodies live at `lessons/<id>.md` relative to the course entry.
 * Paths are always resolved from the course directory, never from the
 * process working directory.
 */

import { isAbsolute, relative, resolve } from "node:path";

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
  return relativePath.split(/[\\/]/).some(segment => segment === "..");
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