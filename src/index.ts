/**
 * Public package entry.
 * Importing this module must not start the preview server.
 */
export {
  type CourseConfig,
  CourseConfigError,
  defineCourse,
  type LessonConfig,
  type ValidationIssue,
} from "./course/config";
export {
  type ContentDiagnostic,
  CourseLoadError,
  type LessonStatus,
  type LoadedCourse,
  type LoadedLesson,
  loadCourse,
} from "./course/content";
