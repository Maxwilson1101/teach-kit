/**
 * Link and local image validation for lesson Markdown.
 *
 * Links may point to safe external protocols, relative paths, or anchors.
 * Images are local course assets only: remote, absolute, and escaping paths
 * are rejected, and a missing asset file is an error. The course directory is
 * the resolution base for every relative asset path.
 */

import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
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

export type CourseResource =
  | { kind: "unchanged" }
  | { kind: "lesson"; url: string }
  | { kind: "local"; url: string; file: string };

const LESSON_LINK_PATTERN = /^lessons\/([^/]+)\.md$/;

/** Splits a URL into its path and the query/fragment suffix. */
function splitUrlSuffix(value: string): { path: string; suffix: string } {
  const hashAt = value.indexOf("#");
  const withoutHash = hashAt === -1 ? value : value.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : value.slice(hashAt);
  const queryAt = withoutHash.indexOf("?");
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  const suffix = (queryAt === -1 ? "" : withoutHash.slice(queryAt)) + hash;
  return { path, suffix };
}

/**
 * Maps a Markdown link or image URL to its public course URL.
 *
 * External, protocol-relative, root-relative, anchor, and query-only values
 * are left unchanged. `lessons/<id>.md` links map to `/lessons/<id>`. Local
 * resources map to `/assets/...` when they live in the assets directory and to
 * `/_course-assets/...` otherwise. Query strings and fragments are preserved.
 */
export function resolveCourseResource(courseDirectory: string, url: string): CourseResource {
  const value = url.trim();
  if (value === "" || value.startsWith("//")) return { kind: "unchanged" };
  if (URL.parse(value)) return { kind: "unchanged" };

  const { path, suffix } = splitUrlSuffix(value);
  if (path === "" || path.startsWith("/")) return { kind: "unchanged" };

  const lesson = LESSON_LINK_PATTERN.exec(path);
  if (lesson) return { kind: "lesson", url: `/lessons/${lesson[1]}${suffix}` };

  const asset = resolveLocalAsset(courseDirectory, path);
  if (!asset.ok) return { kind: "unchanged" };

  const relativePath = relative(courseDirectory, asset.file)
    .split(sep)
    .map(encodeURIComponent)
    .join("/");
  const served = relativePath.startsWith("assets/")
    ? `/${relativePath}`
    : `/_course-assets/${relativePath}`;
  return { kind: "local", url: `${served}${suffix}`, file: asset.file };
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

    const shown = relative(options.courseDirectory, result.file) || url;
    try {
      const details = await stat(result.file);
      if (!details.isFile()) {
        diagnostics.push(
          toDiagnostic(options.path, node, `Image path is not a regular file: ${shown}.`),
        );
      }
    } catch (error) {
      const missing =
        typeof error === "object" &&
        error !== null &&
        (error as { code?: unknown }).code === "ENOENT";
      const reason = error instanceof Error ? error.message : String(error);
      const message = missing
        ? `Image file does not exist: ${shown}.`
        : `Failed to inspect image file ${shown}: ${reason}`;
      diagnostics.push(toDiagnostic(options.path, node, message));
    }
  }

  return diagnostics.sort((left, right) => left.line - right.line || left.column - right.column);
}
