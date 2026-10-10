/**
 * Link and local image validation for lesson Markdown.
 *
 * Links may point to safe external protocols, relative paths, or anchors.
 * Images are local course assets only: remote, absolute, and escaping paths
 * are rejected, and a missing asset file is an error. The course directory is
 * the resolution base for every relative asset path.
 */

import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { type Root, type RootContent } from "mdast";
import { definitions } from "mdast-util-definitions";
import { visit } from "unist-util-visit";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";

const SAFE_LINK_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);
/**
 * Returns an error message for an invalid URL or unsupported protocol, or
 * `undefined` when allowed. Does not check target existence or anchor validity
 * and does not rewrite or sanitize the supplied URL.
 */
export function unsafeLinkMessage(url: string): string | undefined {
  let parsed: URL;
  try {
    // A safe base lets the platform parser classify relative links as well as protocols.
    parsed = new URL(url.trim(), "https://teach-kit.invalid/");
  } catch {
    return "Invalid link URL.";
  }
  if (SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return undefined;
  return `Unsupported link protocol "${parsed.protocol}".`;
}

export type LocalAssetResult = { ok: true; file: string } | { ok: false; message: string };

function escapesCourseDirectory(courseDirectory: string, file: string): boolean {
  const path = relative(courseDirectory, file);
  return path === "" || isAbsolute(path) || path.split(/[\\/]/).includes("..");
}

/**
 * Resolves a URL path lexically inside the course directory, decoding it once.
 * Query strings and fragments do not participate in filesystem lookup.
 * Does not check existence or resolve symbolic links; symlink layouts are unsupported.
 */
export function resolveLocalAsset(courseDirectory: string, url: string): LocalAssetResult {
  const value = url.trim();
  if (value === "") return { ok: false, message: "Image source is empty." };

  const parsed = URL.parse(value);
  if (parsed) {
    const protocol = parsed.protocol;
    return {
      ok: false,
      message: `Only local images are supported, but found "${protocol}" source.`,
    };
  }

  let path: string;
  try {
    // Decode before path normalization so encoded traversal cannot evade containment checks.
    path = decodeURIComponent(value.split(/[?#]/, 1)[0] ?? "");
  } catch {
    return { ok: false, message: `Invalid image URL encoding: ${value}.` };
  }
  if (path === "" || path.includes("\0")) {
    return { ok: false, message: "Image source has an empty or invalid path." };
  }
  if (isAbsolute(path)) {
    return { ok: false, message: `Absolute image paths are not supported: ${value}.` };
  }

  const file = resolve(courseDirectory, path);
  if (escapesCourseDirectory(courseDirectory, file)) {
    return { ok: false, message: `Image path escapes the course directory: ${value}.` };
  }
  return { ok: true, file };
}

export interface ResourceValidationOptions {
  /** File path used in diagnostics, normally the lesson Markdown file. */
  path: string;
  /** Course entry directory; the base for relative asset paths. */
  courseDirectory: string;
}

/**
 * Validates inline and reference-style links and images in a parsed tree.
 * Definitions use CommonMark precedence; unused definitions are not resources.
 * Diagnostics point to each usage, sorted by document position. Does not mutate the tree.
 */
export async function validateResources(
  tree: Root,
  options: ResourceValidationOptions,
): Promise<MarkdownDiagnostic[]> {
  const diagnostics: MarkdownDiagnostic[] = [];
  const links: { node: RootContent; url: string }[] = [];
  const images: { node: RootContent; url: string }[] = [];

  const definition = definitions(tree);
  visit(tree, (node) => {
    if (node.type === "link" || node.type === "image") {
      const resources = node.type === "link" ? links : images;
      resources.push({ node, url: node.url });
    } else if (node.type === "linkReference" || node.type === "imageReference") {
      const target = definition(node.identifier);
      if (target) {
        const resources = node.type === "linkReference" ? links : images;
        resources.push({ node, url: target.url });
      }
    }
  });

  for (const { node, url } of links) {
    const message = unsafeLinkMessage(url);
    if (message) diagnostics.push(toDiagnostic(options.path, node, message));
  }

  for (const { node, url } of images) {
    const result = resolveLocalAsset(options.courseDirectory, url);
    if (!result.ok) {
      diagnostics.push(toDiagnostic(options.path, node, result.message));
      continue;
    }

    const details = await stat(result.file).catch(() => undefined);
    if (!details?.isFile()) {
      const shown = relative(options.courseDirectory, result.file) || url;
      diagnostics.push(toDiagnostic(options.path, node, `Image file does not exist: ${shown}.`));
    }
  }

  return diagnostics.sort((left, right) => left.line - right.line || left.column - right.column);
}
