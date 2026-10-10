import { describe, expect, test } from "bun:test";
import { evaluateCoreCoverage, parseLcov } from "../../../scripts/core-coverage";

const report = [
  "SF:src/course/config.ts",
  "LF:10",
  "LH:10",
  "end_of_record",
  "SF:src/course/content.ts",
  "LF:10",
  "LH:8",
  "end_of_record",
  "SF:src/server/create-server.ts",
  "LF:4",
  "LH:4",
  "end_of_record",
].join("\n");

describe("parseLcov", () => {
  test("derives line coverage per file", () => {
    expect(parseLcov(report).get("src/course/content.ts")?.lineCoverage).toBeCloseTo(0.8);
  });

  test("treats a record without executable lines as fully covered", () => {
    const empty = "SF:src/course/empty.ts\nLF:0\nLH:0\nend_of_record";
    expect(parseLcov(empty).get("src/course/empty.ts")?.lineCoverage).toBe(1);
  });
});

describe("evaluateCoreCoverage", () => {
  test("reports coverage for the requested modules only", () => {
    expect(evaluateCoreCoverage(report, ["src/course/config.ts", "src/course/content.ts"])).toEqual(
      [
        { module: "src/course/config.ts", lineCoverage: 1 },
        { module: "src/course/content.ts", lineCoverage: 0.8 },
      ],
    );
  });

  test("counts a module missing from the report as zero coverage", () => {
    expect(evaluateCoreCoverage(report, ["src/markdown/pipeline.ts"])).toEqual([
      { module: "src/markdown/pipeline.ts", lineCoverage: 0 },
    ]);
  });

  test("matches absolute report paths against relative module names", () => {
    const absolute = report.replace(
      "SF:src/course/config.ts",
      `SF:${process.cwd()}/src/course/config.ts`,
    );
    expect(evaluateCoreCoverage(absolute, ["src/course/config.ts"])).toEqual([
      { module: "src/course/config.ts", lineCoverage: 1 },
    ]);
  });
});
