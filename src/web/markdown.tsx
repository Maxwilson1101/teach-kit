/**
 * Renders the shared Markdown AST as React elements.
 *
 * The renderer is environment agnostic so server and browser output share the
 * same components. Callers must reject parsing, directive, and resource errors
 * before rendering; this module does not run those checks. Raw HTML, unknown
 * directives, and some malformed directive structures render nothing as a
 * defensive fallback, not a substitute for validation. Directive components
 * are dispatched here and implemented under `src/web/components/`.
 */

import {
  type AlignType,
  type Definition,
  type ListItem,
  type PhrasingContent,
  type Root,
  type RootContent,
  type TableCell,
  type TableRow,
} from "mdast";
import { definitions } from "mdast-util-definitions";
import { createElement, Fragment, type OlHTMLAttributes, type ReactNode } from "react";
import { Callout, isCalloutKind } from "./components/callout";
import { Details } from "./components/details";

type DefinitionLookup = (identifier: string) => Definition | undefined;

const HEADINGS = { 1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const;

function renderInline(nodes: readonly PhrasingContent[], lookup: DefinitionLookup): ReactNode[] {
  return nodes.map((node, index) => renderInlineNode(node, lookup, index));
}

function renderInlineNode(node: PhrasingContent, lookup: DefinitionLookup, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "emphasis":
      return createElement("em", { key }, renderInline(node.children, lookup));
    case "strong":
      return createElement("strong", { key }, renderInline(node.children, lookup));
    case "delete":
      return createElement("del", { key }, renderInline(node.children, lookup));
    case "inlineCode":
      return createElement("code", { key }, node.value);
    case "break":
      return createElement("br", { key });
    case "link":
      return createElement(
        "a",
        { key, href: node.url, title: node.title ?? undefined },
        renderInline(node.children, lookup),
      );
    case "linkReference": {
      const target = lookup(node.identifier);
      if (!target) return createElement(Fragment, { key }, renderInline(node.children, lookup));
      return createElement(
        "a",
        { key, href: target.url, title: target.title ?? undefined },
        renderInline(node.children, lookup),
      );
    }
    case "image":
      return createElement("img", {
        key,
        src: node.url,
        alt: node.alt ?? "",
        title: node.title ?? undefined,
      });
    case "imageReference": {
      const target = lookup(node.identifier);
      if (!target) return null;
      return createElement("img", {
        key,
        src: target.url,
        alt: node.alt ?? "",
        title: target.title ?? undefined,
      });
    }
    case "footnoteReference":
    case "html":
    case "textDirective":
      return null;
    default:
      return null;
  }
}

function renderListItem(item: ListItem, tight: boolean, lookup: DefinitionLookup): ReactNode[] {
  const nodes: ReactNode[] = [];
  if (item.checked !== null && item.checked !== undefined) {
    nodes.push(
      createElement("input", {
        key: "checkbox",
        type: "checkbox",
        defaultChecked: item.checked,
        disabled: true,
      }),
    );
  }

  item.children.forEach((child, index) => {
    if (tight && child.type === "paragraph") {
      nodes.push(createElement(Fragment, { key: index }, renderInline(child.children, lookup)));
      return;
    }
    nodes.push(renderBlockNode(child as RootContent, lookup, index));
  });

  return nodes;
}

function renderCell(
  cell: TableCell,
  align: AlignType | null,
  header: boolean,
  lookup: DefinitionLookup,
  key: number,
): ReactNode {
  const style = align ? { textAlign: align } : undefined;
  return createElement(header ? "th" : "td", { key, style }, renderInline(cell.children, lookup));
}

function renderRow(
  row: TableRow,
  align: readonly (AlignType | null)[],
  header: boolean,
  lookup: DefinitionLookup,
  key: number,
): ReactNode {
  return createElement(
    "tr",
    { key },
    row.children.map((cell, index) =>
      renderCell(cell, align[index] ?? null, header, lookup, index),
    ),
  );
}

function renderBlock(nodes: readonly RootContent[], lookup: DefinitionLookup): ReactNode[] {
  return nodes.map((node, index) => renderBlockNode(node, lookup, index));
}

function renderBlockNode(node: RootContent, lookup: DefinitionLookup, key: number): ReactNode {
  switch (node.type) {
    case "paragraph":
      return createElement("p", { key }, renderInline(node.children, lookup));
    case "heading": {
      const tag = HEADINGS[node.depth] as "h2";
      return createElement(tag, { key }, renderInline(node.children, lookup));
    }
    case "blockquote":
      return createElement("blockquote", { key }, renderBlock(node.children, lookup));
    case "list": {
      const tight = !node.spread;
      const items = node.children.map((item, index) =>
        createElement("li", { key: index }, renderListItem(item, tight, lookup)),
      );
      if (node.ordered) {
        const props: OlHTMLAttributes<HTMLOListElement> = {};
        if (node.start != null && node.start !== 1) props.start = node.start;
        return createElement("ol", { key, ...props }, items);
      }
      return createElement("ul", { key }, items);
    }
    case "code":
      return createElement(
        "pre",
        { key },
        createElement("code", node.lang ? { className: `language-${node.lang}` } : {}, node.value),
      );
    case "table": {
      const [head, ...rows] = node.children;
      const align = node.align ?? [];
      return createElement(
        "table",
        { key },
        head ? createElement("thead", {}, renderRow(head, align, true, lookup, 0)) : null,
        rows.length > 0
          ? createElement(
              "tbody",
              {},
              rows.map((row, index) => renderRow(row, align, false, lookup, index)),
            )
          : null,
      );
    }
    case "thematicBreak":
      return createElement("hr", { key });
    case "html":
    case "definition":
    case "leafDirective":
    case "textDirective":
    case "footnoteDefinition":
      return null;
    case "containerDirective":
      return renderDirectiveNode(node, lookup, key);
    default:
      return null;
  }
}

/**
 * Dispatches a container directive from a tree validated by the caller.
 * Unsupported names render nothing; this function does not run validation.
 */
function renderDirectiveNode(
  node: Extract<RootContent, { type: "containerDirective" }>,
  lookup: DefinitionLookup,
  key: number,
): ReactNode {
  switch (node.name) {
    case "callout": {
      const kind = node.attributes?.kind;
      if (!isCalloutKind(kind)) return null;
      const title = node.attributes?.title;
      const children = renderBlock(node.children, lookup);
      return typeof title === "string"
        ? createElement(Callout, { key, kind, title }, children)
        : createElement(Callout, { key, kind }, children);
    }
    case "details": {
      const title = node.attributes?.title;
      if (typeof title !== "string" || title.trim() === "") return null;
      return createElement(Details, { key, title }, renderBlock(node.children, lookup));
    }
    default:
      return null;
  }
}

/**
 * Renders a lesson AST without validating it or mutating the tree.
 * Callers must reject parsing, directive, and resource errors before rendering.
 * Heading anchors and resource URL rewriting are not handled here.
 */
export function Markdown({ tree }: { tree: Root }): ReactNode {
  const lookup = definitions(tree);
  return createElement(Fragment, null, renderBlock(tree.children, lookup));
}
