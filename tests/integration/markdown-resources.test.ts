import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseMarkdown } from "../../src/markdown/parse";
import { validateResources } from "../../src/markdown/resources";
import { createTempCourse } from "../helpers/temp-course";

describe("validateResources filesystem checks", () => {
  test("preserves inspection failures and distinguishes directories from missing images", async () => {
    const course = await createTempCourse({
      config: { title: "Media course", description: "Checks assets.", lessons: [] },
      extraFiles: { "assets/blocked": "Not a directory." },
    });

    try {
      await mkdir(join(course.directory, "assets", "directory.png"));
      const document = parseMarkdown(
        "lessons/media.md",
        "![blocked](assets/blocked/image.png)\n\n![directory](assets/directory.png)\n\n![missing](assets/missing.png)",
      );
      const diagnostics = await validateResources(document.tree, {
        path: document.path,
        courseDirectory: course.directory,
      });

      expect(diagnostics).toHaveLength(3);
      expect(diagnostics[0]).toMatchObject({
        severity: "error",
        path: document.path,
        line: 1,
        column: 1,
      });
      expect(diagnostics[0]?.message).toContain(
        "Failed to inspect image file assets/blocked/image.png:",
      );
      expect(diagnostics[0]?.message).toContain("ENOTDIR");
      expect(diagnostics[1]).toMatchObject({
        line: 3,
        message: "Image path is not a regular file: assets/directory.png.",
      });
      expect(diagnostics[2]).toMatchObject({
        line: 5,
        message: "Image file does not exist: assets/missing.png.",
      });
    } finally {
      await course.cleanup();
    }
  });

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
