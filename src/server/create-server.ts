import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { serve } from "bun";
import { resolveLocalAsset } from "../markdown/resources";
import { CourseContentError, readCoursePages } from "./course-data";

export interface ServerOptions {
  port?: number;
  entry?: string;
  frontendDirectory?: string;
}

const NOT_FOUND =
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>页面不存在 · Teach Kit</title><body><h1>页面不存在</h1><p>课程可能尚未撰写，或地址不正确。</p><a href="/">课程概览</a></body></html>';

/** Serves the package-owned prebuilt frontend and reads course content at runtime. */
export async function createServer({
  port = 4321,
  entry = "index.ts",
  frontendDirectory = resolve(import.meta.dir, "../../dist/web"),
}: ServerOptions = {}) {
  const initial = await readCoursePages(entry);
  const html = await Bun.file(join(frontendDirectory, "index.html")).text();
  const frontendFiles = new Set(await readdir(frontendDirectory));
  const notFound = () =>
    new Response(NOT_FOUND, {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  return serve({
    reusePort: false,
    hostname: "127.0.0.1",
    port,
    development: false,
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      if (pathname.startsWith("/assets/")) {
        const asset = resolveLocalAsset(initial.directory, pathname.slice(1));
        if (!asset.ok) return notFound();
        // Only the consumer's assets directory is public, never its entry or lesson sources.
        const assetsDirectory = resolve(initial.directory, "assets");
        if (!asset.file.startsWith(`${assetsDirectory}/`)) return notFound();
        try {
          if (!(await stat(asset.file)).isFile()) return notFound();
          return new Response(Bun.file(asset.file));
        } catch {
          return notFound();
        }
      }
      const frontendName = pathname.slice(1);
      if (frontendName !== "index.html" && frontendFiles.has(frontendName)) {
        return new Response(Bun.file(join(frontendDirectory, frontendName)));
      }
      const lessonMatch = /^\/(?:api\/)?lessons\/([^/]+)$/.exec(pathname);
      const isApi = pathname === "/api/course" || pathname.startsWith("/api/lessons/");
      if (
        pathname !== "/" &&
        pathname !== "/api/course" &&
        !lessonMatch &&
        !pathname.startsWith("/_course-assets/")
      )
        return notFound();
      try {
        const course = await readCoursePages(entry);
        if (pathname.startsWith("/_course-assets/")) {
          const file = course.assets.get(pathname);
          return file ? new Response(Bun.file(file)) : notFound();
        }
        if (pathname === "/api/course")
          return Response.json(course.overview, { headers: { "Cache-Control": "no-store" } });
        if (lessonMatch) {
          const lesson = course.pages.get(lessonMatch[1] ?? "");
          if (!lesson)
            return isApi ? Response.json({ message: "课程不存在。" }, { status: 404 }) : notFound();
          if (isApi) return Response.json(lesson, { headers: { "Cache-Control": "no-store" } });
        }
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json(
          { message },
          { status: error instanceof CourseContentError ? 422 : 500 },
        );
      }
    },
  });
}
