import { createRoot } from "react-dom/client";
import { validateDirectives } from "../../../src/markdown/directives";
import { parseMarkdown } from "../../../src/markdown/parse";
import { Markdown } from "../../../src/web/markdown";
import "../../../src/web/styles/globals.css";

const source = [
  "## Markdown rendering",
  "",
  "- First paragraph.",
  "",
  "  Second paragraph.",
  "- Next item.",
  "",
  "| Stage | Result |",
  "| :--- | ---: |",
  "| Parse | Shared AST |",
  "",
  "```ts",
  "const shared = true;",
  "```",
  "",
  ':::callout{kind="note" title="Shared pipeline"}',
  "",
  "Standard Markdown and teaching components share the same parsed tree.",
  "",
  ":::",
  "",
  ":::::tabs",
  "",
  '::::tab{title="Transport"}',
  "",
  "Relayers move messages.",
  "",
  ':::details{title="Show answer"}',
  "",
  "Transport does not imply verification.",
  "",
  ":::",
  "",
  "::::",
  "",
  '::::tab{title="Verification"}',
  "",
  "Security modules verify them.",
  "",
  "::::",
  "",
  '::::tab{title="Execution"}',
  "",
  "The recipient executes the message.",
  "",
  "::::",
  "",
  ":::::",
  "",
  "::::columns",
  "",
  ":::column",
  "",
  "Left comparison.",
  "",
  ":::",
  "",
  ":::column",
  "",
  "Right comparison.",
  "",
  ":::",
  "",
  "::::",
  "",
  "::::tabs",
  "",
  ':::tab{title="Example A"}',
  "",
  "First example.",
  "",
  ":::",
  "",
  ':::tab{title="Example B"}',
  "",
  "Second example.",
  "",
  ":::",
  "",
  "::::",
].join("\n");

const document = parseMarkdown("fixture.md", source);
const diagnostics = [...document.diagnostics, ...validateDirectives(document.tree, document.path)];
if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
  throw new Error(JSON.stringify(diagnostics));
}

const root = globalThis.document.getElementById("root");
if (!root) throw new Error("Fixture root element is missing.");
createRoot(root).render(
  <main className="mx-auto max-w-3xl px-6 py-8">
    <h1 className="mb-6 text-3xl font-bold">Renderer fixture</h1>
    <Markdown tree={document.tree} />
  </main>,
);
