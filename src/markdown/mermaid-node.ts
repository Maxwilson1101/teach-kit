/**
 * The custom node that replaces a `mermaid` fenced code block once it has been
 * rendered to SVG while loading content.
 *
 * It is kept separate from the renderer so the browser bundle can import the
 * node type without pulling the server-only renderer and its layout engine.
 */

import { type Literal } from "mdast";

export interface MermaidDiagram extends Literal {
  type: "mermaidDiagram";
  /** Sanitized SVG markup produced from the fence body. */
  svg: string;
}

declare module "mdast" {
  interface RootContentMap {
    mermaidDiagram: MermaidDiagram;
  }
}
