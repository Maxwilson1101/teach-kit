/**
 * Validation for restricted teaching directives.
 *
 * Only a fixed set of container directives is supported. Each directive has an
 * attribute allowlist, and structural rules keep tab groups well formed.
 * Violations become source-located error diagnostics; this module never mutates
 * the tree or renders anything.
 */

import { type Parent, type Root, type RootContent } from "mdast";
import { type ContainerDirective } from "mdast-util-directive";
import { CALLOUT_KINDS } from "./callout-kind";
import { type MarkdownDiagnostic, toDiagnostic } from "./diagnostics";

interface AttributeRule {
  /** The attribute must be present. */
  required?: boolean;
  /** A present value must not be empty or whitespace only. */
  nonEmpty?: boolean;
  /** A present value must be one of these literals. */
  values?: readonly string[];
}

interface DirectiveRule {
  attributes: Record<string, AttributeRule>;
  /** Direct container parent that must enclose the directive. */
  parent?: string;
  /** Ancestor containers the directive may not appear inside. */
  forbiddenAncestors?: readonly string[];
  /** Direct block children must all be container directives with these names. */
  children?: readonly string[];
  /** The directive must contain at least this many named children. */
  minimumChildren?: { name: string; count: number };
}

const DIRECTIVE_RULES: Readonly<Record<string, DirectiveRule>> = {
  callout: {
    attributes: {
      kind: { required: true, values: CALLOUT_KINDS },
      title: { nonEmpty: true },
    },
  },
  details: {
    attributes: { title: { required: true, nonEmpty: true } },
  },
  tabs: {
    attributes: {},
    forbiddenAncestors: ["tabs"],
    children: ["tab"],
    minimumChildren: { name: "tab", count: 1 },
  },
  tab: {
    attributes: { title: { required: true, nonEmpty: true } },
    parent: "tabs",
  },
};

function quoted(name: string): string {
  return `"${name}"`;
}

function retiredDirectiveMessage(name: string): string | undefined {
  if (name !== "columns" && name !== "column") return undefined;
  return (
    `Directive ${quoted(name)} is no longer supported. ` +
    "Use sequential headings and paragraphs, or a Markdown table for comparisons."
  );
}

function validateAttributes(
  diagnostics: MarkdownDiagnostic[],
  path: string,
  node: ContainerDirective,
  rule: DirectiveRule,
): void {
  const attributes = node.attributes ?? {};

  for (const key of Object.keys(attributes)) {
    if (!Object.hasOwn(rule.attributes, key)) {
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          `Unsupported attribute ${quoted(key)} on directive ${quoted(node.name)}.`,
        ),
      );
    }
  }

  for (const [key, attribute] of Object.entries(rule.attributes)) {
    const value = attributes[key];
    if (value === undefined) {
      if (attribute.required) {
        diagnostics.push(
          toDiagnostic(
            path,
            node,
            `Directive ${quoted(node.name)} requires the ${quoted(key)} attribute.`,
          ),
        );
      }
      continue;
    }

    if (value === null || (attribute.nonEmpty && value.trim() === "")) {
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          `Attribute ${quoted(key)} on directive ${quoted(node.name)} must not be empty.`,
        ),
      );
      continue;
    }

    if (attribute.values && !attribute.values.includes(value)) {
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          `Unsupported ${quoted(key)} value ${quoted(value)} for directive ${quoted(node.name)}. ` +
            `Expected one of: ${attribute.values.join(", ")}.`,
        ),
      );
    }
  }
}

function countChildren(children: readonly RootContent[], name: string): number {
  return children.filter((child) => child.type === "containerDirective" && child.name === name)
    .length;
}

function validateChildren(
  diagnostics: MarkdownDiagnostic[],
  path: string,
  node: ContainerDirective,
  rule: DirectiveRule,
): void {
  const children = node.children as readonly RootContent[];

  if (rule.children) {
    const allowed = new Set(rule.children);
    const invalid = children.some(
      (child) => child.type !== "containerDirective" || !allowed.has(child.name),
    );
    if (invalid) {
      const names = rule.children.map(quoted).join(" or ");
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          `Directive ${quoted(node.name)} may only contain ${names} children.`,
        ),
      );
    }
  }

  if (rule.minimumChildren) {
    const { name, count } = rule.minimumChildren;
    if (countChildren(children, name) < count) {
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          `Directive ${quoted(node.name)} requires at least ${count} ${quoted(name)} child.`,
        ),
      );
    }
  }
}

/**
 * Validates every directive in a parsed lesson tree.
 * Returns diagnostics sorted by document position. Unknown directives are
 * reported and their children are still inspected for further problems.
 */
export function validateDirectives(tree: Root, path: string): MarkdownDiagnostic[] {
  const diagnostics: MarkdownDiagnostic[] = [];

  const inspect = (node: RootContent, ancestors: readonly string[]): void => {
    if (node.type === "containerDirective") {
      const rule = Object.hasOwn(DIRECTIVE_RULES, node.name)
        ? DIRECTIVE_RULES[node.name]
        : undefined;
      if (!rule) {
        diagnostics.push(
          toDiagnostic(
            path,
            node,
            retiredDirectiveMessage(node.name) ?? `Unknown directive ${quoted(node.name)}.`,
          ),
        );
      } else {
        const parent = ancestors.at(-1);
        if (rule.parent !== undefined && parent !== rule.parent) {
          diagnostics.push(
            toDiagnostic(
              path,
              node,
              `Directive ${quoted(node.name)} must be inside ${quoted(rule.parent)}.`,
            ),
          );
        }
        for (const ancestor of rule.forbiddenAncestors ?? []) {
          if (ancestors.includes(ancestor)) {
            diagnostics.push(
              toDiagnostic(
                path,
                node,
                `Directive ${quoted(node.name)} cannot be nested inside ${quoted(ancestor)}.`,
              ),
            );
            break;
          }
        }
        validateAttributes(diagnostics, path, node, rule);
        validateChildren(diagnostics, path, node, rule);
      }

      for (const child of node.children as readonly RootContent[]) {
        inspect(child, [...ancestors, node.name]);
      }
      return;
    }

    if (node.type === "leafDirective" || node.type === "textDirective") {
      diagnostics.push(
        toDiagnostic(
          path,
          node,
          retiredDirectiveMessage(node.name) ??
            `Directive ${quoted(node.name)} must use the container form (:::name).`,
        ),
      );
      return;
    }

    if ("children" in node) {
      for (const child of (node as Parent).children as unknown as readonly RootContent[]) {
        inspect(child, ancestors);
      }
    }
  };

  for (const child of tree.children) inspect(child, []);

  return diagnostics.sort((left, right) => left.line - right.line || left.column - right.column);
}
