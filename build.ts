import { rm } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";

await rm(new URL("./dist", import.meta.url), { recursive: true, force: true });

const results = await Promise.all([
  Bun.build({
    entrypoints: ["src/index.ts"],
    outdir: "dist",
    target: "bun",
  }),
  Bun.build({
    entrypoints: ["src/web/index.html"],
    outdir: "dist/web",
    plugins: [tailwind],
    minify: true,
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  }),
]);

for (const result of results) {
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    process.exitCode = 1;
  }
}
if (process.exitCode) throw new Error("Package build failed.");

const declarations = Bun.spawn(["bun", "x", "--no-install", "tsc", "-p", "tsconfig.build.json"], {
  stdout: "inherit",
  stderr: "inherit",
});
if ((await declarations.exited) !== 0) throw new Error("Declaration build failed.");

console.log("Built the public entry, declarations, and frontend scaffold.");
