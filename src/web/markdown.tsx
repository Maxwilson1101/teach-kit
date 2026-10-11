/**
 * Renders the shared Markdown AST through HAST and the React JSX runtime.
 * Callers must reject parsing, directive, and resource errors before rendering.
 * Conversion does not mutate the shared tree, assign anchors, or rewrite asset URLs.
 * Raw HTML, footnotes, and unsupported directives are not rendered.
 */

import { type Element, type Nodes as HastNodes, type Root as HastRoot } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { type Code, type Root } from "mdast";
import { type ContainerDirective } from "mdast-util-directive";
import { type InlineMath, type Math as MathNode } from "mdast-util-math";
import { defaultHandlers, toHast } from "mdast-util-to-hast";
import { type ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeKatex from "rehype-katex";
import { unified } from "unified";
import { isCalloutKind } from "../markdown/callout-kind";
import { MATH_STRICT } from "../markdown/math";
import { Callout } from "./components/callout";
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
        table: ({ node: _node, ...props }) => (
          <section className="table-scroll" aria-label="Scrollable table">
            <table {...props} />
          </section>
        ),
        div: ({ node, ...props }) =>
          node && directives.has(node) ? directives.get(node) : <div {...props} />,
      },
    });

  // Math inside directive containers is converted separately, so every subtree
  // runs through the same KaTeX transform as the document root.
  const katex = unified().use(rehypeKatex, { strict: MATH_STRICT });
  const renderMath = (hast: HastNodes): ReactNode =>
    renderHast(katex.runSync(hast as HastRoot) as unknown as HastNodes);

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
      // Placeholders carrying the class names rehype-katex replaces below.
      inlineMath(_state, node: InlineMath): Element {
        return {
          type: "element",
          tagName: "span",
          properties: { className: ["math", "math-inline"] },
          children: [{ type: "text", value: node.value }],
        };
      },
      math(_state, node: MathNode): Element {
        return {
          type: "element",
          tagName: "div",
          properties: { className: ["math", "math-display"] },
          children: [{ type: "text", value: node.value }],
        };
      },
      containerDirective(state, node: ContainerDirective) {
        const content = renderDirective(node, (child) =>
          renderMath({ type: "root", children: state.all(child) }),
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

  return renderMath(hast);
}
