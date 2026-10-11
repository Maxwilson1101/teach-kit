import { expect, test } from "bun:test";
import { findActiveSection } from "../../../src/web/hooks/use-active-section";

const headings = [
  { id: "first", top: 120 },
  { id: "second", top: 600 },
  { id: "last", top: 700 },
];

test("has no current section until the first heading reaches the reading line", () => {
  expect(findActiveSection(headings, 80, false)).toBeUndefined();
  expect(findActiveSection([], 80, true)).toBeUndefined();
});

test("selects the last heading at or above the reading line, including its boundary", () => {
  expect(findActiveSection(headings, 120, false)).toBe("first");
  expect(findActiveSection(headings, 650, false)).toBe("second");
  expect(findActiveSection(headings, 700, false)).toBe("last");
});

test("activates a short final section at the document bottom", () => {
  expect(findActiveSection(headings, 80, true)).toBe("last");
});
