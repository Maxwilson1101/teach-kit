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
    expect(unsafeLinkMessage("java\tscript:alert(1)")).toBe(
      'Unsupported link protocol "javascript:".',
    );
  });
});

describe("invalid link URLs", () => {
  test("reports malformed absolute URLs instead of treating them as relative", () => {
    expect(unsafeLinkMessage("https://[")).toBe("Invalid link URL.");
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

  test("decodes URL paths and ignores query strings and fragments", () => {
    expect(resolveLocalAsset("/course", "assets/my%20diagram.png?v=1#preview")).toEqual({
      ok: true,
      file: resolve("/course", "assets/my diagram.png"),
    });
    expect(resolveLocalAsset("/course", "assets/caf%C3%A9.png")).toEqual({
      ok: true,
      file: resolve("/course", "assets/caf\u00e9.png"),
    });
    expect(resolveLocalAsset("/course", "assets/a%23b%3Fc.png")).toEqual({
      ok: true,
      file: resolve("/course", "assets/a#b?c.png"),
    });
  });

  test("rejects malformed encodings and decoded unsafe paths", () => {
    for (const url of [
      "assets/%ZZ.png",
      "assets/%E0%A4.png",
      "%2Fetc/passwd",
      "%2e%2e/secret.png",
      "assets/%2e%2e/%2e%2e/secret.png",
      "assets/a%00.png",
      "#preview",
      "?v=1",
    ]) {
      expect(resolveLocalAsset("/course", url).ok).toBe(false);
    }
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

  test("validates full, collapsed, and shortcut references at their usage positions", async () => {
    const source = [
      "[bad][Target]",
      "",
      "[target][]",
      "",
      "[target]",
      "",
      "![remote][pic]",
      "",
      "[TARGET]: javascript:alert(1)",
      "",
      "[pic]: https://example.com/a.png",
      "",
      "[target]: https://example.com",
    ].join("\n");
    const document = parseMarkdown("references.md", source);
    const diagnostics = await validateResources(document.tree, {
      path: document.path,
      courseDirectory: "/course",
    });
    expect(diagnostics.map(({ line, message }) => ({ line, message }))).toEqual([
      { line: 1, message: 'Unsupported link protocol "javascript:".' },
      { line: 3, message: 'Unsupported link protocol "javascript:".' },
      { line: 5, message: 'Unsupported link protocol "javascript:".' },
      { line: 7, message: 'Only local images are supported, but found "https:" source.' },
    ]);
  });

  test("does not validate unused definitions or unresolved literal references", async () => {
    const document = parseMarkdown("references.md", "[unknown]\n\n[unused]: javascript:alert(1)");
    expect(
      await validateResources(document.tree, { path: document.path, courseDirectory: "/course" }),
    ).toEqual([]);
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
