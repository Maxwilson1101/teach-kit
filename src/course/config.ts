/**
 * Typed course configuration and its runtime validation.
 *
 * TypeScript enforces the shape at compile time; runtime validation catches
 * values that arrive from JavaScript or dynamically constructed objects and
 * reports every problem at once instead of failing on the first one.
 */

/** Lesson metadata supplied by the course definition, not Markdown frontmatter. */
export interface LessonConfig {
  /**
   * Course-unique identifier mapped to `lessons/<id>.md`.
   * Use lowercase letters and digits separated by single hyphens.
   */
  id: string;
  /** Display title; must contain non-whitespace text. */
  title: string;
  /** Lesson overview; must contain non-whitespace text. */
  description: string;
}

/** Declarative metadata for a single course. */
export interface CourseConfig {
  /** Display title; must contain non-whitespace text. */
  title: string;
  /** Course overview; must contain non-whitespace text. */
  description: string;
  /** Lessons in reading order. An empty array is valid. */
  lessons: LessonConfig[];
}

export interface ValidationIssue {
  /** Location of the problem, for example `lessons[0].id`. */
  path: string;
  message: string;
}

const LESSON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Aggregates configuration problems with their field paths. */
export class CourseConfigError extends Error {
  /** All issues detected during validation. */
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const details = issues.map(issue => `- ${issue.path}: ${issue.message}`).join("\n");
    super(`Invalid course configuration:\n${details}`);
    this.name = "CourseConfigError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateText(issues: ValidationIssue[], path: string, value: unknown): void {
  if (typeof value !== "string" || value.trim() === "") {
    issues.push({ path, message: "Expected a non-empty string." });
  }
}

function validateLessons(issues: ValidationIssue[], value: unknown): LessonConfig[] {
  if (!Array.isArray(value)) {
    issues.push({ path: "lessons", message: "Expected an array of lessons." });
    return [];
  }

  const seenIds = new Set<string>();
  value.forEach((lesson, index) => {
    const path = `lessons[${index}]`;
    if (!isRecord(lesson)) {
      issues.push({ path, message: "Expected a lesson object." });
      return;
    }

    validateText(issues, `${path}.title`, lesson.title);
    validateText(issues, `${path}.description`, lesson.description);

    const id = lesson.id;
    if (typeof id !== "string" || !LESSON_ID_PATTERN.test(id)) {
      issues.push({ path: `${path}.id`, message: "Expected a lowercase kebab-case identifier." });
    } else if (seenIds.has(id)) {
      issues.push({ path: `${path}.id`, message: `Duplicate lesson id "${id}".` });
    } else {
      seenIds.add(id);
    }
  });

  return value as LessonConfig[];
}

/**
 * Validates a course configuration and returns a new course object.
 * Text is checked for non-whitespace content but returned without trimming.
 * The lessons array and its objects are retained by reference, not cloned.
 *
 * @throws {CourseConfigError} When validation fails, with all detected issues.
 */
export function defineCourse(config: CourseConfig): CourseConfig {
  const issues: ValidationIssue[] = [];
  const input: unknown = config;

  if (!isRecord(input)) {
    throw new CourseConfigError([{ path: "course", message: "Expected a course configuration object." }]);
  }

  validateText(issues, "title", input.title);
  validateText(issues, "description", input.description);
  const lessons = validateLessons(issues, input.lessons);

  if (issues.length > 0) throw new CourseConfigError(issues);

  return {
    title: input.title as string,
    description: input.description as string,
    lessons,
  };
}