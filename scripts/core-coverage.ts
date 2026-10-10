/**
 * Enforces per-module line coverage for core course modules.
 *
 * Bun's `coverageThreshold` is global, which would let a well-covered module
 * hide an under-tested one. This gate reads the LCOV report produced by
 * `bun test --coverage --coverage-reporter=lcov` and checks each core module.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ModuleCoverage {
  module: string;
  /** Line coverage as a ratio between 0 and 1. */
  lineCoverage: number;
}

/** Core modules that must each meet the line coverage minimum. */
export const CORE_MODULES: readonly string[] = ["src/course/config.ts", "src/course/content.ts"];

export const MINIMUM_LINE_COVERAGE = 0.9;

/** Parses an LCOV report into a map of file path to line coverage. */
export function parseLcov(report: string): Map<string, ModuleCoverage> {
  const coverage = new Map<string, ModuleCoverage>();
  let file: string | undefined;
  let linesFound = 0;
  let linesHit = 0;

  const flush = () => {
    if (file === undefined) return;
    coverage.set(file, {
      module: file,
      lineCoverage: linesFound === 0 ? 1 : linesHit / linesFound,
    });
    file = undefined;
    linesFound = 0;
    linesHit = 0;
  };

  for (const line of report.split(/\r?\n/)) {
    if (line.startsWith("SF:")) file = line.slice(3).trim();
    else if (line.startsWith("LF:")) linesFound = Number(line.slice(3));
    else if (line.startsWith("LH:")) linesHit = Number(line.slice(3));
    else if (line.trim() === "end_of_record") flush();
  }
  flush();

  return coverage;
}

/**
 * Reports line coverage for the requested core modules.
 * A module missing from the report counts as zero coverage so an absent or
 * renamed core module fails the gate instead of silently passing.
 */
export function evaluateCoreCoverage(
  report: string,
  modules: readonly string[] = CORE_MODULES,
): ModuleCoverage[] {
  const coverage = parseLcov(report);
  const records = [...coverage.values()];

  return modules.map((module) => {
    const match = records.find((record) => {
      if (record.module === module) return true;
      const normalized = record.module.replaceAll("\\", "/");
      return normalized.endsWith(`/${module}`);
    });
    return { module, lineCoverage: match?.lineCoverage ?? 0 };
  });
}

if (import.meta.main) {
  const tests = Bun.spawn(
    [
      "bun",
      "test",
      "./tests/unit",
      "./tests/integration",
      "--coverage",
      "--coverage-reporter=lcov",
    ],
    { stdio: ["inherit", "inherit", "inherit"] },
  );
  const exitCode = await tests.exited;
  if (exitCode !== 0) process.exit(exitCode);

  const report = await readFile(resolve("coverage/lcov.info"), "utf8");
  let failed = false;
  console.log(`\nCore module line coverage (minimum ${Math.round(MINIMUM_LINE_COVERAGE * 100)}%):`);
  for (const { module, lineCoverage } of evaluateCoreCoverage(report)) {
    const ok = lineCoverage >= MINIMUM_LINE_COVERAGE;
    if (!ok) failed = true;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${module}: ${(lineCoverage * 100).toFixed(2)}%`);
  }

  if (failed) {
    console.error("Core module coverage is below the required threshold.");
    process.exit(1);
  }
}
