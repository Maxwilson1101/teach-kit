import { type Page } from "@playwright/test";
import { MAIN_CONTENT_ID } from "../../src/course/page";
import { parseMarkdown } from "../../src/markdown/parse";
import { extractSections } from "../../src/markdown/sections";

/** Exercises the real page and renderer with metadata derived from a parsed boundary fixture. */
export async function openNavigationLesson(page: Page, source: string, fragment = "") {
  const { tree } = parseMarkdown("navigation.md", source);
  const sections = extractSections(tree, [MAIN_CONTENT_ID]);
  let index = 0;
  for (const node of tree.children) {
    if (node.type === "heading" && node.depth === 2) {
      node.data = { hProperties: { id: sections[index++]?.id } };
    }
  }
  await page.route("**/api/lessons/message-lifecycle", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ tree, sections }) }),
  );
  await page.goto(`/lessons/message-lifecycle${fragment}`);
}
