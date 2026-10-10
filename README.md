# Teach Kit

Teach Kit is a Bun package for turning Markdown lessons into a local course preview. It is designed for teaching agents: plan a course in TypeScript, write lessons in Markdown, and verify the reading experience with Playwright.

## Status

Typed course configuration, runtime content loading, shared Markdown validation, teaching components, the course overview, lesson pages, and the `dev` / `check` CLI are implemented. The package ships a prebuilt React frontend with a shadcn-managed, Medium-inspired light reading theme. Section-rail navigation, syntax highlighting, math, and Mermaid remain planned. The package name is provisional; it is not published yet.

See [PLAN.md](PLAN.md) for the MVP checklist and acceptance criteria, and [AGENTS.md](AGENTS.md) for development rules.

## MVP Scope

- One consuming project represents one course.
- A typed root `index.ts` defines the course and ordered lesson plan.
- Markdown files in `lessons/` provide lesson bodies; `assets/` holds course resources.
- A dedicated course index shows both generated and planned lessons.
- Lesson pages include a compact section rail with hover/focus previews, anchor navigation, and active-section tracking.
- Restricted Markdown directives provide callouts, disclosures, tabs, and two-column layouts.
- Standard Markdown, syntax-highlighted code, math, and Mermaid diagrams support teaching content.
- A local preview server provides the reading experience; Playwright verifies browser behavior and layout.

Offline HTML export, multi-course management, learning progress, executable notebooks, and arbitrary JSX or custom CSS authoring are outside the MVP.

## Consumer Experience

The overview lists every configured lesson in order. Valid lesson bodies are available; missing bodies stay visibly planned without links. Lesson pages provide a course-overview link and the immediately previous and next items in the plan. Planned neighbors are shown as information, not skipped or linked.

### Project Layout

```text
my-course/
├── index.ts
├── package.json
├── lessons/
│   └── message-lifecycle.md
└── assets/
    └── message-flow.png
```

### Course Definition

```ts
// index.ts
import { defineCourse } from "teach-kit";

export default defineCourse({
  title: "Hyperlane Protocol Study",
  description: "Understand message delivery, security boundaries, and application authorization.",
  lessons: [
    {
      id: "message-lifecycle",
      title: "Message Lifecycle",
      description: "Distinguish message transport from verification.",
    },
    {
      id: "mailbox",
      title: "Mailbox and Message Format",
      description: "Understand dispatch, process, and message identifiers.",
    },
  ],
});
```

`defineCourse()` validates the configuration at runtime and throws a `CourseConfigError` containing all validation issues, with paths such as `lessons[1]`. An empty `lessons` array is valid, but every index in a non-empty array must contain a valid lesson object. Sparse slots and explicit `undefined` entries are errors, not planned lessons.

The configuration is the source of truth for lesson order, titles, and descriptions. Each lesson ID maps to `lessons/<id>.md`; paths resolve relative to the course entry rather than the current working directory.

Course configuration imports follow Bun's module cache; restart the preview process after editing `index.ts`. Symbolic links are outside the supported course layout and are not explicitly rejected by the current loader. The low-level `loadCourse()` API reports generated status when a lesson source is read. The CLI and page server additionally validate every available lesson before exposing the course.

A missing lesson file is shown as planned. An existing but unreadable lesson is reported as an error, not treated as missing. The shared pipeline in `src/markdown/` parses lesson sources into an AST, derives level-two sections with unique anchors and plain-text summaries, and validates links and local images. Raw HTML is reported as a located error rather than rendered. Links may use `http`, `https`, or `mailto` protocols, relative paths, or anchors; any other protocol is rejected. Images are local course assets only: remote, absolute, and escaping paths are errors, and a missing asset file is an error. The low-level loader does not parse Markdown; `check` and the page server consume the shared pipeline. The pipeline parses container directives and validates them against a fixed allowlist, and the React renderer turns callouts, details, tabs, and two-column layouts into components on real lesson pages. Top-level Markdown files in `lessons/` that are absent from the plan produce warnings in the loaded course diagnostics; nested directories and non-Markdown files are ignored. Authors do not maintain a separate generation status or duplicate metadata in Markdown frontmatter.

### Lesson Authoring

```md
## Transport and Verification

Relayers transport messages; security modules verify them.

:::callout{kind="warning" title="Keep These Guarantees Separate"}
Successful dispatch does not imply successful execution on the destination chain.
:::

## Check Your Understanding

Does a failed destination transaction automatically revert the source transaction?

:::details{title="Show Answer"}
No. They are separate transactions on different chains.
:::
```

Supported directives:

| Directive | Purpose | Constraints |
| --- | --- | --- |
| `callout` | Definitions, conclusions, tips, and risks | Kinds: `note`, `tip`, `warning` |
| `details` | Answers, proofs, and supplementary explanations | Required title; collapsed by default |
| `tabs` / `tab` | Alternative perspectives or implementations | Required tab titles; no nested tab groups |
| `columns` / `column` | Side-by-side comparisons | Exactly two columns; stacked on narrow screens |

Tabs use `@radix-ui/react-tabs` for keyboard focus, automatic activation, and ARIA relationships while retaining package-owned styling. Inactive panels stay mounted and hidden, so switching tabs preserves nested disclosure state. The selected panel is keyboard-focusable. Markdown validation, rather than the UI primitive, enforces the prohibition on nested tab groups.

Nested directives use a longer colon fence for the outer container. Unsupported directives, attributes, and structures produce actionable diagnostics. Raw HTML, arbitrary JSX, and custom CSS are not authoring escape hatches. Footnote references and definitions are also rejected with located errors; move their explanations into the lesson body instead.

Root-level headings (`##`) define primary lesson sections and navigation entries. Headings inside block quotes do not enter navigation; headings inside teaching components are excluded as well. Section anchors are non-empty and unique among sections, with `section` as the fallback for empty or punctuation-only titles. Anchors are deterministic for the same heading order; reordering duplicate headings can change their suffixes.

Preview summaries use the first non-empty paragraph, including paragraphs in lists and block quotes. Subheadings, code, tables, raw HTML, and other non-prose containers do not supply summaries. Inline formatting preserves text boundaries, and image alternative text contributes to the summary. Sections without prose have an empty summary.

Inline and reference-style links and images share resource validation. References follow CommonMark definition precedence, and diagnostics identify the usage rather than the definition. Unused definitions are not checked as resources. Image URL paths are decoded once before containment checks; query strings and fragments do not affect filesystem lookup. Invalid encodings and decoded absolute, escaping, or null-containing paths are errors. Paths resolve relative to the course entry directory, not the lesson file. Symbolic-link layouts remain unsupported.

The internal Markdown modules separate parsing, section metadata, resource validation, and source diagnostics. They reuse `unist-util-visit` for traversal, `mdast-util-definitions` for reference resolution, `mdast-util-to-string` for text extraction, and `github-slugger` for anchors. Standard Markdown rendering reuses `mdast-util-to-hast` and `hast-util-to-jsx-runtime`, consuming the existing mdast tree without parsing the source again. A small adapter maps teaching directives to React components; raw HTML, footnotes, and unsupported nodes remain disabled. Code text is preserved without adding a trailing newline. Teach Kit owns the authoring policies and filesystem checks; links are validated with the platform URL parser and reported as errors rather than silently sanitized.

### Installation and Commands

Build and pack this repository, then install the resulting artifact in an independent course project:

```bash
# In the Teach Kit repository
bun install
bun run build
bun pm pack --filename teach-kit.tgz

# In the course project
bun add /absolute/path/to/teach-kit/teach-kit.tgz
```

A published package may later support `bun add teach-kit`, subject to package name availability. Consumers do not need React or Tailwind configuration; the frontend is already built.

Use these project scripts:

```json
{
  "scripts": {
    "dev": "teach-kit dev",
    "check": "teach-kit check"
  }
}
```

`teach-kit dev` loads the root `index.ts` and serves `/` and `/lessons/<id>` on loopback port 4321. `teach-kit check` validates configuration, Markdown, and resources without launching a browser. Both commands accept an optional entry path, resolved against the working directory:

```bash
bun run check
bun run dev
PORT=4325 bun run dev /absolute/path/to/course/index.ts
```

Invalid configuration or lesson content produces a nonzero exit code with actionable diagnostics. Missing lesson bodies are valid planned content. Unknown and planned lesson URLs return HTTP 404. `PORT` must be an integer between 0 and 65535; 0 requests an available port. SIGINT and SIGTERM shut down the preview cleanly. Edit Markdown or assets and refresh to see changes; restart after configuration changes. No hot-reload system is provided.

## Repository Layout

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

example/                   # A course with two available and two planned lessons
├── index.ts
├── lessons/               # Prose and teaching components; no code or Mermaid
└── assets/                # Local SVG illustration

dist/                      # Generated package output; not committed
```

All test files live under `tests/`: unit tests in `tests/unit/`, integration tests in `tests/integration/`, and browser tests in `tests/e2e/`. Source and tooling directories do not contain test files.

`src/index.ts` is the public package entry and does not start a server. The repository preview runs through `src/server/dev.ts` using `example/index.ts` by default; the consumer CLI lives in `src/server/cli.ts`. Browser code lives in `src/web/`.

Course content is read at runtime, while the package frontend is built in advance. Package installation tests use an actual packed artifact in an independent project, including CLI validation and desktop/narrow-screen browser navigation.

## Development

Install dependencies and preview the example (the command builds the package first):

```bash
bun install
bun run dev
```

Available verification commands:

```bash
bun run lint
bun run typecheck
bun run test
bun run coverage:core
bun x playwright install chromium
bun run test:e2e
bun run build
```

`bun run lint` checks formatting, import organization, and recommended Biome lint rules without modifying files. Warnings fail the gate. `bun run lint:fix` applies safe automatic fixes; review the diff afterward. Biome uses two-space indentation, a 100-column target width, and inline `type` specifiers. Dependencies and generated output are excluded; source and tests are checked.

`bun run verify` runs lint, type checks, core coverage tests, and the build in order, stopping at the first failure. The GitHub Actions quality job runs the same command on pushes and pull requests. Unit and integration tests, including packed-package consumption with Chromium, run through the coverage command. The full Playwright suite is an additional required check. Install Chromium before running verification. Repository branch protection must require the `quality` job to prevent merging failures.

Type checking also rejects unused locals and parameters, missing return paths, and explicit `undefined` assignments to optional properties that do not allow them. Isolated-module checking matches Bun's per-file transpilation, and consistent filename casing helps prevent cross-platform import failures.

`bun run test` runs unit and integration tests. `bun run coverage:core` runs them again with an LCOV report and fails when configuration, content loading, or Markdown pipeline modules drop below 90% line coverage.

`bun run build` generates the public JavaScript entry, CLI, type declarations, and frontend assets in `dist/`. `bun run start` runs the repository example using an existing build; it is not a separate production-deployment workflow.

Playwright covers desktop and narrow-screen Chromium. Browser downloads are needed once per environment. The main preview on port 4322 exercises the real example; a test-only preview on port 4323 exercises the renderer and components independently. The packed-package integration test installs the artifact in a temporary consumer, validates public types, starts its installed CLI, opens the overview and a lesson in Chromium, and verifies Markdown refresh and process cleanup. Generated build output and test reports are ignored by Git.

### Theme and Components

`components.json` configures shadcn for React, Tailwind v4, CSS variables, and the `@/` source alias. Registry components live in `src/web/components/ui/`; pages compose Badge and Button without duplicating their primitives. Course items use subtle dividing rules, and lessons render as continuous articles rather than section cards. `src/web/lib/utils.ts` provides the standard `clsx` + `tailwind-merge` utility. Existing accessible tabs remain backed by Radix; disclosures use native HTML semantics.

Theme colors and radii belong in `src/web/styles/globals.css`, using semantic tokens such as `background`, `card`, `primary`, and `muted-foreground`. The theme uses a white canvas, dark neutral text, restrained green accents, serif article text, and a centered reading column. Teaching-callout colors extend the semantic tokens. Only a light theme is provided: system dark-mode preferences do not change the page, and there is no theme switcher. Add only needed components with `bunx shadcn@latest add <component>`, inspect generated imports and dependencies, then run `bun run lint:fix` and verification. The Bun frontend build scans package source only; it does not scan a consuming course's Markdown or require a consumer Tailwind configuration.

Development follows TDD:

1. Write and run a focused failing test.
2. Implement the smallest passing change.
3. Refactor while keeping tests green.
4. Run relevant tests and type checks; use Playwright for browser behavior.
5. Commit the complete change and its tests as one atomic commit.

Use English Conventional Commit messages. Keep unrelated cleanup and features separate, and do not commit intermediate failing states. All repository file content is written in English except `PLAN.md`, which is written in Chinese; existing visual reference assets are preserved.

## Agent Workflow

The intended teaching workflow is:

1. Plan or revise the course in `index.ts`.
2. Create or update a lesson Markdown file and any necessary assets.
3. Run content validation.
4. Open the local preview with Playwright.
5. Check navigation, component interactions, browser errors, and desktop/narrow-screen layouts.
6. Inspect screenshots and revise the content as needed.

Routine lesson generation should not require changes to the library rendering code. Browser checks validate presentation and interactions; they do not establish the factual correctness of teaching content.
