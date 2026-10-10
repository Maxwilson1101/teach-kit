import { describe, expect, test } from "bun:test";
import { type Root } from "mdast";
import { validateDirectives } from "../../../src/markdown/directives";
import { parseMarkdown } from "../../../src/markdown/parse";

const PATH = "lessons/directives.md";

/** Parses a lesson body and validates only its directives. */
function validate(source: string): ReturnType<typeof validateDirectives> {
  const document = parseMarkdown(PATH, source);
  return validateDirectives(document.tree, PATH);
}

function tree(source: string): Root {
  return parseMarkdown(PATH, source).tree;
}

describe("validateDirectives", () => {
  test("accepts an allowlisted callout with a kind and title", () => {
    const source = [
      ':::callout{kind="warning" title="Keep these separate"}',
      "",
      "Dispatch success does not imply execution success.",
      "",
      ":::",
    ].join("\n");

    expect(validate(source)).toEqual([]);
  });

  test("requires the callout kind attribute", () => {
    expect(validate(':::callout{title="Heads up"}\n\nBody.\n\n:::')).toMatchObject([
      {
        severity: "error",
        path: PATH,
        line: 1,
        column: 1,
        message: 'Directive "callout" requires the "kind" attribute.',
      },
    ]);
  });

  test("rejects a callout kind outside the allowlist", () => {
    expect(validate(':::callout{kind="danger"}\n\nBody.\n\n:::')).toMatchObject([
      {
        severity: "error",
        path: PATH,
        message:
          'Unsupported "kind" value "danger" for directive "callout". Expected one of: note, tip, warning.',
      },
    ]);
  });

  test("rejects attributes that are not allowlisted", () => {
    expect(validate(':::callout{kind="note" class="wide"}\n\nBody.\n\n:::')).toMatchObject([
      { severity: "error", message: 'Unsupported attribute "class" on directive "callout".' },
    ]);
  });

  test("rejects an empty required attribute value", () => {
    expect(validate(':::details{title=""}\n\nBody.\n\n:::')).toMatchObject([
      { severity: "error", message: 'Attribute "title" on directive "details" must not be empty.' },
    ]);
  });

  test("rejects unknown directives", () => {
    expect(validate(":::warning\n\nBody.\n\n:::")).toMatchObject([
      { severity: "error", line: 1, column: 1, message: 'Unknown directive "warning".' },
    ]);
  });

  test.each(["constructor", "toString", "valueOf"])(
    "rejects prototype property %s as an unknown directive without throwing",
    (name) => {
      expect(validate(`:::${name}\n\nBody.\n\n:::`)).toEqual([
        {
          severity: "error",
          path: PATH,
          line: 1,
          column: 1,
          message: `Unknown directive "${name}".`,
        },
      ]);
    },
  );

  test.each(["constructor", "toString", "valueOf"])(
    "rejects prototype property %s as an unsupported attribute",
    (name) => {
      expect(validate(`:::callout{kind="note" ${name}="x"}\n\nBody.\n\n:::`)).toEqual([
        {
          severity: "error",
          path: PATH,
          line: 1,
          column: 1,
          message: `Unsupported attribute "${name}" on directive "callout".`,
        },
      ]);
    },
  );

  test("rejects an own __proto__ attribute on a synthetic directive node", () => {
    const parsed = tree(':::callout{kind="note"}\n\nBody.\n\n:::');
    const node = parsed.children[0];
    if (node?.type !== "containerDirective") throw new Error("Expected a container directive.");
    node.attributes = { kind: "note", ["__proto__"]: "x" };

    expect(validateDirectives(parsed, PATH)).toMatchObject([
      { message: 'Unsupported attribute "__proto__" on directive "callout".' },
    ]);
  });

  test("rejects leaf and text directives", () => {
    const source = ["Paragraph with :tip.", "", '::callout{kind="note"}', "", "::details"].join(
      "\n",
    );

    expect(validate(source)).toMatchObject([
      { severity: "error", message: 'Directive "tip" must use the container form (:::name).' },
      { severity: "error", message: 'Directive "callout" must use the container form (:::name).' },
      { severity: "error", message: 'Directive "details" must use the container form (:::name).' },
    ]);
  });

  test("requires tab inside tabs and column inside columns", () => {
    const source = [
      ':::tab{title="Loose"}',
      "",
      "Body.",
      "",
      ":::",
      "",
      ":::column",
      "",
      "Body.",
      "",
      ":::",
    ].join("\n");

    expect(validate(source)).toMatchObject([
      { severity: "error", line: 1, message: 'Directive "tab" must be inside "tabs".' },
      { severity: "error", message: 'Directive "column" must be inside "columns".' },
    ]);
  });

  test("rejects nested tab groups", () => {
    const source = [
      "::::::tabs",
      "",
      ':::::tab{title="Outer"}',
      "",
      "::::tabs",
      "",
      ':::tab{title="Inner"}',
      "",
      "Body.",
      "",
      ":::",
      "",
      "::::",
      "",
      ":::::",
      "",
      "::::::",
    ].join("\n");

    expect(validate(source)).toMatchObject([
      { severity: "error", line: 5, message: 'Directive "tabs" cannot be nested inside "tabs".' },
    ]);
  });

  test("requires exactly two columns", () => {
    const one = "::::columns\n\n:::column\n\nOnly.\n\n:::\n\n::::";

    expect(validate(one)).toMatchObject([
      { severity: "error", message: 'Directive "columns" requires exactly 2 "column" children.' },
    ]);
  });

  test("rejects non-column content inside columns", () => {
    const source = [
      "::::columns",
      "",
      "Loose paragraph.",
      "",
      ":::column",
      "",
      "Left.",
      "",
      ":::",
      "",
      ":::column",
      "",
      "Right.",
      "",
      ":::",
      "",
      "::::",
    ].join("\n");

    expect(validate(source)).toMatchObject([
      { severity: "error", message: 'Directive "columns" may only contain "column" children.' },
    ]);
  });

  test("requires at least one tab inside tabs", () => {
    expect(validate(":::tabs\n\n:::")).toMatchObject([
      { severity: "error", message: 'Directive "tabs" requires at least 1 "tab" child.' },
    ]);
  });

  test("accepts tabs with several tabs and nested components", () => {
    const source = [
      "::::::tabs",
      "",
      ':::::tab{title="One"}',
      "",
      '::::callout{kind="tip"}',
      "",
      "Tip body.",
      "",
      "::::",
      "",
      ":::::",
      "",
      ':::::tab{title="Two"}',
      "",
      "::::columns",
      "",
      ":::column",
      "",
      "Left.",
      "",
      ":::",
      "",
      ":::column",
      "",
      "Right.",
      "",
      ":::",
      "",
      "::::",
      "",
      ":::::",
      "",
      "::::::",
    ].join("\n");

    expect(validate(source)).toEqual([]);
  });

  test("sorts diagnostics by document position", () => {
    const source = [":::nope", "", ":::", "", ":::also-nope", "", ":::"].join("\n");
    const diagnostics = validate(source);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => diagnostic.line)).toEqual([1, 5]);
  });

  test("does not mutate the parsed tree", () => {
    const parsed = tree(':::callout{kind="nope"}\n\nBody.\n\n:::');
    const before = JSON.stringify(parsed);

    validateDirectives(parsed, PATH);

    expect(JSON.stringify(parsed)).toBe(before);
  });
});
