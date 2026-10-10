import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { parseMarkdown } from "../../src/markdown/parse";
import { validateResources } from "../../src/markdown/resources";
import { createTempCourse } from "../helpers/temp-course";

describe("validateResources filesystem checks", () => {
  test("accepts an existing local asset and reports a missing one", async () => {
    const course = await createTempCourse({
      config: { title: "Media course", description: "Checks assets.", lessons: [] },
      extraFiles: {
        "assets/present.png": "png",
        "assets/my diagram.png": "png",
        "assets/caf\u00e9.png": "png",
      },
    });

    try {
      const path = join(course.directory, "lessons", "media.md");
      const source = [
        "## Media",
        "",
        "![present](assets/present.png)",
        "",
        "![missing][missing]",
        "",
        "![encoded](assets/my%20diagram.png?v=1#preview)",
        "",
        "![unicode](assets/caf%C3%A9.png)",
        "",
        "![present][]",
        "",
        "![present]",
        "",
        "[missing]: assets/missing.png",
        "[present]: assets/present.png",
      ].join("\n");

      const document = parseMarkdown(path, source);
      const diagnostics = await validateResources(document.tree, {
        path,
        courseDirectory: course.directory,
      });

      expect(diagnostics).toEqual([
        {
          severity: "error",
          path,
          line: 5,
          column: 1,
          message: "Image file does not exist: assets/missing.png.",
        },
      ]);
    } finally {
      await course.cleanup();
    }
  });
});
