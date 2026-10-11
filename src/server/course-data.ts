import { relative, sep } from "node:path";
import { definitions } from "mdast-util-definitions";
import { visit } from "unist-util-visit";
import { loadCourse } from "../course/content";
import { type CourseOverview, type LessonPage, MAIN_CONTENT_ID } from "../course/page";
import { validateDirectives } from "../markdown/directives";
import { parseMarkdown } from "../markdown/parse";
import { resolveLocalAsset, validateResources } from "../markdown/resources";
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
      if (node.type !== "image" && node.type !== "imageReference") return;
      const url = node.type === "image" ? node.url : definition(node.identifier)?.url;
      if (!url) return;
      const asset = resolveLocalAsset(loaded.directory, url);
      if (!asset.ok) return;
      const path = relative(loaded.directory, asset.file)
        .split(sep)
        .map(encodeURIComponent)
        .join("/");
      const served = path.startsWith("assets/") ? `/${path}` : `/_course-assets/${path}`;
      assets.set(served, asset.file);
      if (node.type === "image") node.url = served;
      else {
        // Inline reference images so a shared definition can still be used as a link.
        Object.assign(node, {
          type: "image",
          url: served,
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
