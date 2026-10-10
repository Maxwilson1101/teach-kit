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
export {
  CourseLoadError,
  loadCourse,
  type ContentDiagnostic,
  type LoadedCourse,
  type LoadedLesson,
  type LessonStatus,
} from "./course/content";