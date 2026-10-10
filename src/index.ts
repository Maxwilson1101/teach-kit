/**
 * Public package entry.
 * Importing this module must not start the preview server.
 */
export {
  CourseConfigError,
  defineCourse,
  type CourseConfig,
  type LessonConfig,
  type ValidationIssue,
} from "./course/config";
