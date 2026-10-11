import { type Root } from "mdast";
import { type MarkdownSection } from "../markdown/sections";
import { type CourseConfig, type LessonConfig } from "./config";
import { type LessonStatus } from "./content";

/** Stable skip-link target, reserved when assigning lesson heading anchors. */
export const MAIN_CONTENT_ID = "main-content";

/** Serializable course metadata; filesystem paths and sources stay on the server. */
export interface LessonOverview extends LessonConfig {
  status: LessonStatus;
}

export interface CourseOverview extends Omit<CourseConfig, "lessons"> {
  lessons: LessonOverview[];
}

export interface LessonPage {
  tree: Root;
  /** Ordered navigation metadata from the same AST that supplies heading IDs. */
  sections: MarkdownSection[];
}
