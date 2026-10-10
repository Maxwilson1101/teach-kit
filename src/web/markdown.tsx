/**
 * Renders the shared Markdown AST through HAST and the React JSX runtime.
 * Callers must reject parsing, directive, and resource errors before rendering.
 * Conversion does not mutate the shared tree, assign anchors, or rewrite asset URLs.
 * Raw HTML, footnotes, and unsupported directives are not rendered.
 */

import { type Element, type Nodes as HastNodes } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { type Code, type Root } from "mdast";
import { type ContainerDirective } from "mdast-util-directive";
import { defaultHandlers, toHast } from "mdast-util-to-hast";
import { type ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { isCalloutKind } from "../markdown/callout-kind";
import { Callout } from "./components/callout";
import { Column, Columns } from "./components/columns";
import { Details } from "./components/details";
import { type TabItem, Tabs } from "./components/tabs";

/** Adapts supported teaching directives; structural validation remains separate. */
function renderDirective(
  node: ContainerDirective,
  renderChildren: (node: ContainerDirective) => ReactNode,
): ReactNode {
  switch (node.name) {
    case "callout": {
      const kind = node.attributes?.kind;
      if (!isCalloutKind(kind)) return null;
      const title = node.attributes?.title;
      return typeof title === "string" ? (
        <Callout kind={kind} title={title}>
          {renderChildren(node)}
        </Callout>
      ) : (
        <Callout kind={kind}>{renderChildren(node)}</Callout>
      );
    }
    case "details": {
      const title = node.attributes?.title;
      if (typeof title !== "string" || title.trim() === "") return null;
      return <Details title={title}>{renderChildren(node)}</Details>;
    }
    case "tabs": {
      const tabs: TabItem[] = [];
      for (const child of node.children) {
        if (child.type !== "containerDirective" || child.name !== "tab") return null;
        const title = child.attributes?.title;
        if (typeof title !== "string" || title.trim() === "") return null;
        const start = child.position?.start;
        const id = start ? `${start.line}:${start.column}` : `tab-${tabs.length}`;
        tabs.push({ id, title, content: renderChildren(child) });
      }
      return tabs.length ? <Tabs tabs={tabs} /> : null;
    }
    case "columns": {
      if (node.children.length !== 2) return null;
      const columns: ReactNode[] = [];
      for (const child of node.children) {
        if (child.type !== "containerDirective" || child.name !== "column") return null;
        columns.push(<Column key={columns.length}>{renderChildren(child)}</Column>);
      }
      return <Columns>{columns}</Columns>;
    }
    default:
      return null;
  }
}

/**
 * Renders an already-validated lesson AST without parsing it again.
 * Teaching directives use private HAST placeholders that never become DOM wrappers.
 * Heading anchors and resource URL rewriting are not handled here.
 */
export function Markdown({ tree }: { tree: Root }): ReactNode {
  const directives = new WeakMap<Element, ReactNode>();
  const renderHast = (hast: HastNodes): ReactNode =>
    toJsxRuntime(hast, {
      Fragment,
      jsx,
      jsxs,
      passNode: true,
      components: {
        div: ({ node, ...props }) =>
          node && directives.has(node) ? directives.get(node) : <div {...props} />,
      },
    });

  const hast = toHast(tree, {
    allowDangerousHtml: false,
    unknownHandler: () => undefined,
    handlers: {
      footnoteDefinition: () => undefined,
      footnoteReference: () => undefined,
      leafDirective: () => undefined,
      textDirective: () => undefined,
      code(state, node: Code) {
        const result = defaultHandlers.code(state, node);
        // The default handler appends a newline; preserve the original code text.
        const code = result.children[0];
        if (code?.type === "element") code.children = [{ type: "text", value: node.value }];
        return result;
      },
      containerDirective(state, node: ContainerDirective) {
        const content = renderDirective(node, (child) =>
          renderHast({ type: "root", children: state.all(child) }),
        );
        if (content === null) return undefined;
        const placeholder: Element = {
          type: "element",
          tagName: "div",
          properties: {},
          children: [],
        };
        directives.set(placeholder, content);
        return placeholder;
      },
    },
  });

  return renderHast(hast);
}
