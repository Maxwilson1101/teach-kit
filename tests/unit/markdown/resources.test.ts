import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseMarkdown } from "../../../src/markdown/parse";
import {
  resolveLocalAsset,
  unsafeLinkMessage,
  validateResources,
} from "../../../src/markdown/resources";

describe("unsafeLinkMessage", () => {
  test("accepts safe and relative links", () => {
    expect(unsafeLinkMessage("https://example.com/page")).toBeUndefined();
    expect(unsafeLinkMessage("http://example.com")).toBeUndefined();
    expect(unsafeLinkMessage("mailto:tutor@example.com")).toBeUndefined();
    expect(unsafeLinkMessage("lessons/other.md")).toBeUndefined();
    expect(unsafeLinkMessage("#section-one")).toBeUndefined();
  });

  test("rejects script and data protocols", () => {
    expect(unsafeLinkMessage("javascript:alert(1)")).toBe(
      'Unsupported link protocol "javascript:".',
    );
    expect(unsafeLinkMessage("VBScript:msgbox(1)")).toBe('Unsupported link protocol "vbscript:".');
    expect(unsafeLinkMessage("data:text/html,<b>x</b>")).toBe('Unsupported link protocol "data:".');
  });
});

describe("resolveLocalAsset", () => {
  test("resolves a relative path inside the course directory", () => {
    const result = resolveLocalAsset("/course", "assets/diagram.png");
    expect(result).toEqual({ ok: true, file: resolve("/course", "assets/diagram.png") });
  });

  test("rejects paths that escape the course directory", () => {
    expect(resolveLocalAsset("/course", "../secret.png")).toMatchObject({
      ok: false,
      message: "Image path escapes the course directory: ../secret.png.",
    });
    expect(resolveLocalAsset("/course", "assets/../../secret.png")).toMatchObject({ ok: false });
  });

  test("rejects absolute filesystem paths", () => {
    expect(resolveLocalAsset("/course", "/etc/passwd")).toMatchObject({
      ok: false,
      message: "Absolute image paths are not supported: /etc/passwd.",
    });
  });

  test("rejects remote and protocol image sources", () => {
    expect(resolveLocalAsset("/course", "https://example.com/a.png")).toMatchObject({
      ok: false,
      message: 'Only local images are supported, but found "https:" source.',
    });
    expect(resolveLocalAsset("/course", "data:image/png;base64,AAAA")).toMatchObject({
      ok: false,
      message: 'Only local images are supported, but found "data:" source.',
    });
  });

  test("rejects an empty source", () => {
    expect(resolveLocalAsset("/course", "  ")).toMatchObject({
      ok: false,
      message: "Image source is empty.",
    });
  });
});

describe("validateResources", () => {
  test("reports unsafe links with their source position", async () => {
    const document = parseMarkdown(
      "lessons/links.md",
      ["Text.", "", "[bad](javascript:alert(1))"].join("\n"),
    );
    const diagnostics = await validateResources(document.tree, {
      path: document.path,
      courseDirectory: "/course",
    });

    expect(diagnostics).toEqual([
      {
        severity: "error",
        path: "lessons/links.md",
        line: 3,
        column: 1,
        message: 'Unsupported link protocol "javascript:".',
      },
    ]);
  });

  test("reports unsafe image sources", async () => {
    const document = parseMarkdown(
      "lessons/images.md",
      ["![remote](https://example.com/a.png)", "", "![escape](../a.png)"].join("\n"),
    );
    const diagnostics = await validateResources(document.tree, {
      path: document.path,
      courseDirectory: "/course",
    });

    expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'Only local images are supported, but found "https:" source.',
      "Image path escapes the course directory: ../a.png.",
    ]);
  });
});
