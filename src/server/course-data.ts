import { definitions } from "mdast-util-definitions";
import { visit } from "unist-util-visit";
import { loadCourse } from "../course/content";
import { type CourseOverview, type LessonPage, MAIN_CONTENT_ID } from "../course/page";
import { validateDirectives } from "../markdown/directives";
import { validateMath } from "../markdown/math";
import { renderMermaidBlocks } from "../markdown/mermaid";
import { parseMarkdown } from "../markdown/parse";
import { resolveCourseResource, validateResources } from "../markdown/resources";
import { extractSections } from "../markdown/sections";

export class CourseContentError extends Error {}

/** Reads fresh lesson sources and rejects invalid content before exposing any page. */
export async function readCoursePages(entry: string) {
  const loaded = await loadCourse(entry);
  const pages = new Map<string, LessonPage>();
  const assets = new Map<string, string>();
  for (const lesson of loaded.lessons) {
    if (lesson.source === undefined) continue;
    const document = parseMarkdown(lesson.file, lesson.source);
    const diagnostics = [
      ...document.diagnostics,
      ...validateMath(document.tree, lesson.file),
      ...renderMermaidBlocks(document.tree, lesson.file),
      ...validateDirectives(document.tree, lesson.file),
      ...(await validateResources(document.tree, {
        path: lesson.file,
        courseDirectory: loaded.directory,
      })),
    ];
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      throw new CourseContentError(
        diagnostics
          .map(
            (diagnostic) =>
              `${diagnostic.path}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.message}`,
          )
          .join("\n"),
      );
    }
    const sections = extractSections(document.tree, [MAIN_CONTENT_ID]);
    let sectionIndex = 0;
    for (const node of document.tree.children) {
      if (node.type === "heading" && node.depth === 2) {
        node.data = { ...node.data, hProperties: { id: sections[sectionIndex++]?.id } };
      }
    }
    const definition = definitions(document.tree);
    visit(document.tree, (node) => {
      if (
        node.type !== "link" &&
        node.type !== "image" &&
        node.type !== "linkReference" &&
        node.type !== "imageReference"
      )
        return;
      const isImage = node.type === "image" || node.type === "imageReference";
      const url =
        node.type === "image" || node.type === "link" ? node.url : definition(node.identifier)?.url;
      if (!url) return;
      const resource = resolveCourseResource(loaded.directory, url);
      if (resource.kind === "unchanged") return;
      // Only images publish files outside the assets directory; links stay contained.
      if (isImage && resource.kind === "local") {
        assets.set(resource.url.split(/[?#]/, 1)[0] ?? resource.url, resource.file);
      }
      if (node.type === "link" || node.type === "image") {
        node.url = resource.url;
      } else {
        // Inline references so a shared definition can serve both links and images.
        Object.assign(node, {
          type: isImage ? "image" : "link",
          url: resource.url,
          title: definition(node.identifier)?.title ?? null,
        });
      }
    });
    pages.set(lesson.id, { tree: document.tree, sections });
  }
  const overview: CourseOverview = {
    title: loaded.title,
    description: loaded.description,
    lessons: loaded.lessons.map(({ id, title, description, status }) => ({
      id,
      title,
      description,
      status,
    })),
  };
  return { overview, pages, assets, directory: loaded.directory, diagnostics: loaded.diagnostics };
}
