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
import { visit } from "unist-util-visit";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";

const SAFE_LINK_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);
const PROTOCOL_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

/** Returns a diagnostic message when a link uses an unsafe protocol. */
export function unsafeLinkMessage(url: string): string | undefined {
  const match = PROTOCOL_PATTERN.exec(url.trim());
  if (!match) return undefined;
  const protocol = `${(match[1] ?? "").toLowerCase()}:`;
  if (SAFE_LINK_PROTOCOLS.has(protocol)) return undefined;
  return `Unsupported link protocol "${protocol}".`;
}

export type LocalAssetResult = { ok: true; file: string } | { ok: false; message: string };

function escapesCourseDirectory(courseDirectory: string, file: string): boolean {
  const path = relative(courseDirectory, file);
  return path === "" || isAbsolute(path) || path.split(/[\\/]/).includes("..");
}

/** Resolves a local image source to an absolute path inside the course directory. */
export function resolveLocalAsset(courseDirectory: string, url: string): LocalAssetResult {
  const value = url.trim();
  if (value === "") return { ok: false, message: "Image source is empty." };

  const match = PROTOCOL_PATTERN.exec(value);
  if (match) {
    const protocol = (match[1] ?? "").toLowerCase();
    return {
      ok: false,
      message: `Only local images are supported, but found "${protocol}:" source.`,
    };
  }

  if (isAbsolute(value)) {
    return { ok: false, message: `Absolute image paths are not supported: ${value}.` };
  }

  const file = resolve(courseDirectory, value);
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
 * Validates links and images in a parsed tree.
 * Returns diagnostics sorted by document position.
 */
export async function validateResources(
  tree: Root,
  options: ResourceValidationOptions,
): Promise<MarkdownDiagnostic[]> {
  const diagnostics: MarkdownDiagnostic[] = [];
  const links: { node: RootContent; url: string }[] = [];
  const images: { node: RootContent; url: string }[] = [];

  visit(tree, (node) => {
    if (node.type === "link") links.push({ node, url: node.url });
    else if (node.type === "image") images.push({ node, url: node.url });
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
