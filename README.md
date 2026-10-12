# Teach Kit

Teach Kit is a Bun package that renders Markdown courses as a local preview. You plan a course in TypeScript, write lesson bodies in Markdown, and verify the reading experience in a browser. The frontend is prebuilt, so consumers need no React or Tailwind configuration; the preview UI and example course are shown in Chinese by default.

## Quick Start

Install the package into a course project:

```bash
bun add teach-kit
```

Until the package is published under its final name, install a packed artifact instead:

```bash
bun add /absolute/path/to/teach-kit/teach-kit.tgz
```

A course project contains a root `index.ts`, a `lessons/` directory, and an optional `assets/` directory:

```text
my-course/
├── index.ts
├── package.json
├── lessons/
│   └── message-lifecycle.md
└── assets/
    └── message-flow.png
```

Define the course in `index.ts`:

```ts
import { defineCourse } from "teach-kit";

export default defineCourse({
  title: "Hyperlane 协议学习",
  description: "理解消息交付、安全边界和应用授权。",
  lessons: [
    { id: "message-lifecycle", title: "消息生命周期", description: "区分消息传输和验证。" },
    { id: "mailbox", title: "Mailbox 与消息格式", description: "理解消息分发、处理和消息标识符。" },
  ],
});
```

Write each lesson body in `lessons/<id>.md`:

```md
## 传输与验证

中继器传输消息，安全模块验证消息。

:::callout{kind="warning" title="区分这些保证"}
成功分发并不意味着目标链执行成功。
:::
```

Add the CLI to your scripts:

```json
{
  "scripts": {
    "dev": "teach-kit dev",
    "check": "teach-kit check"
  }
}
```

Then start the preview and open `http://127.0.0.1:4321`:

```bash
bun run check   # validate configuration, Markdown, and resources
bun run dev     # serve / and /lessons/<id> on 127.0.0.1:4321
```

Both commands accept an optional entry path resolved against the working directory. `PORT` sets an integer port from 0 to 65535 (0 picks a free port). Invalid configuration or lesson content exits nonzero with diagnostics; a missing lesson body is planned content, and unknown or planned lesson URLs return 404. Edit Markdown or assets and refresh; restart after editing `index.ts`, since there is no hot reload.

## Wiki

### Course definition

- One consuming project represents one course.
- `index.ts` is the source of truth for lesson order, titles, and descriptions.
- Each lesson ID maps to `lessons/<id>.md`, resolved relative to the course entry, not the working directory.
- `defineCourse()` validates at runtime and throws a `CourseConfigError` listing every issue with paths such as `lessons[1]`. An empty `lessons` array is valid; in a non-empty array every index must be a valid lesson object, so sparse slots and explicit `undefined` are errors.
- A missing lesson file is planned content; an existing but unreadable lesson is an error.
- Configuration imports follow Bun's module cache, so restart the preview after editing `index.ts`. Symbolic links are outside the supported layout.

### Writing lessons

```md
## 传输与验证

中继器传输消息，安全模块验证消息。

:::callout{kind="warning" title="区分这些保证"}
成功分发并不意味着目标链执行成功。
:::

## 检查理解

目标链交易失败会自动回滚源链交易吗？

:::details{title="显示答案"}
不会。这是发生在不同链上的两笔独立交易。
:::
```

| Directive | Purpose | Constraints |
| --- | --- | --- |
| `callout` | Definitions, conclusions, tips, and risks | Kinds: `note`, `tip`, `warning` |
| `details` | Answers, proofs, and supplementary explanations | Required title; collapsed by default |
| `tabs` / `tab` | Alternative perspectives or implementations | Required tab titles; no nested tab groups |

Directive rules: nested directives use a longer colon fence for the outer container; unsupported directives, attributes, and structures produce located diagnostics. Raw HTML, arbitrary JSX, footnotes, and custom CSS are rejected rather than rendered. The retired `columns` / `column` directives are rejected with migration guidance — use sequential headings and paragraphs, or a Markdown table.

Sections and summaries: top-level `##` headings define lesson sections and navigation entries (headings in block quotes or teaching components are excluded). Anchors are non-empty, unique, and deterministic; empty or punctuation-only titles fall back to `section`, and `main-content` is reserved for the skip link. Preview summaries come from the first non-empty paragraph, including lists and block quotes, not from subheadings, code, or tables.

### Math, code, and diagrams

- Inline `$...$` and block `$$...$$` math render with KaTeX. `check` and the server validate every expression, so invalid LaTeX produces a located error instead of an unvalidated render. Block math is excluded from summaries; inline math contributes.
- Fenced code blocks are highlighted by language and keep their text verbatim; unknown or missing languages fall back to plain text without error.
- `mermaid` fences render to SVG on the server (flowchart, state, sequence, class, ER, and xychart). Parse failures produce located errors, and generated SVG has `<script>`, external `href`, and Google Fonts `@import` removed, so the preview makes no third-party requests.

### Resources and validation

- Links may use `http`, `https`, `mailto`, relative paths, or anchors; other protocols are rejected. Images must be local course assets — remote, absolute, or escaping paths are errors, as is a missing asset file.
- Inline and reference-style links and images share validation, follow CommonMark definition precedence, and report diagnostics at the usage. Image paths are decoded once; query strings and fragments do not affect filesystem lookup.
- The shared `src/markdown/` pipeline parses sources into an AST, derives sections, and validates resources, math, and Mermaid. Unplanned top-level Markdown files in `lessons/` produce warnings; nested directories and non-Markdown files are ignored.

### Navigation and layout

- Desktop: a left section rail provides native anchor links with hover/focus previews of title and summary. Escape dismisses a preview without moving focus, and previews stay within the viewport. The current section tracks heading positions while scrolling; selecting a section updates the URL fragment and focuses its heading.
- Narrow viewports (under 1000px): a "本页内容" button above the article expands the outline; choosing a link collapses it and moves focus to the heading. Escape returns focus to the button, and long outlines scroll within their region.
- Ordinary scrolling does not rewrite the URL or add history entries; fragment links preserve Back/Forward navigation. Courses without top-level sections show no navigation controls.

### Teaching components

Callouts use a slim left rule, a kind icon, and compact spacing, with a pale warm background for warnings. Disclosures keep the author's title visible with a rotating arrow and an indented answer, and the entire title row supports pointer, touch, Enter, and Space. Tabs use `@radix-ui/react-tabs` for keyboard focus and ARIA, keep inactive panels mounted, and scroll long label rows. The package owns all styling and content.

### Repository structure

```text
src/
├── index.ts               # Public API and types
├── course/                # Typed configuration, validation, and content loading
├── markdown/              # Shared AST pipeline, directives, and section metadata
├── server/                # CLI, preview routes, and resource access
└── web/                   # Browser pages, components, and styles

tests/
├── unit/                  # Unit tests for source modules and tooling
├── integration/           # Filesystem, CLI, and packed-package consumption
├── e2e/                   # Playwright browser tests
├── fixtures/              # Valid, invalid, and boundary content
└── helpers/               # Temporary projects and server lifecycle

example/                   # A course with three available and two planned lessons
```

All test files live under `tests/`. `src/index.ts` is the public entry and does not start a server; the consumer CLI is in `src/server/cli.ts`, and the repository preview runs through `src/server/dev.ts` using `example/index.ts` by default. Course content is read at runtime while the frontend is built in advance.

### Teaching workflow

1. Plan or revise the course in `index.ts`.
2. Create or update a lesson Markdown file and any assets.
3. Run `bun run check`.
4. Open the local preview and verify navigation, component interactions, browser errors, and desktop and narrow-screen layouts.
5. Inspect screenshots and revise the content as needed.

Routine lesson changes should not require editing the library rendering code. Browser checks validate presentation and interactions, not the factual correctness of teaching content.