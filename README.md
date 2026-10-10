# Teach Kit

Teach Kit is a planned Bun package for turning Markdown lessons into a local course preview. It is designed for teaching agents: plan a course in TypeScript, write lessons in Markdown, and verify the reading experience with Playwright.

## Status

This repository has a minimal Bun + React + Tailwind application scaffold, a side-effect-free public entry, a frontend build, and unit/browser test infrastructure. The typed course configuration API and course content loading are implemented. The CLI, lesson rendering, and end-to-end package distribution described below are not implemented yet. The package name is provisional.

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

## Planned Consumer Experience

The course configuration API and content loading described below are implemented. Lesson rendering and the commands describe the intended interface and are not yet available.

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

Course configuration imports follow Bun's module cache; restart the preview process after editing `index.ts`. Symbolic links are outside the supported course layout and are not explicitly rejected by the current loader. Generated status currently means the lesson source was read, not that Markdown validation has run.

A missing lesson file is shown as planned. An existing but unreadable lesson is reported as an error, not treated as missing. Markdown syntax validation is planned but not yet implemented. Top-level Markdown files in `lessons/` that are absent from the plan produce warnings in the loaded course diagnostics; nested directories and non-Markdown files are ignored. Authors do not maintain a separate generation status or duplicate metadata in Markdown frontmatter.

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

Planned directives:

| Directive | Purpose | Constraints |
| --- | --- | --- |
| `callout` | Definitions, conclusions, tips, and risks | Kinds: `note`, `tip`, `warning`, `danger` |
| `details` | Answers, proofs, and supplementary explanations | Required title; collapsed by default |
| `tabs` / `tab` | Alternative perspectives or implementations | Required tab titles; no nested tab groups |
| `columns` / `column` | Side-by-side comparisons | Exactly two columns; stacked on narrow screens |

Nested directives use a longer colon fence for the outer container. Unsupported directives, attributes, and structures produce actionable diagnostics. Raw HTML, arbitrary JSX, and custom CSS are not authoring escape hatches.

Level-two headings (`##`) define primary lesson sections and navigation entries. Component-internal headings do not enter the section navigation. Preview summaries are derived from ordinary section text.

### Installation and Commands

Once packaging is implemented, local development will support installing the library from a local path:

```bash
bun add /absolute/path/to/teach-kit
```

A published package will support `bun add teach-kit`, subject to package name availability. Consumers will not need to configure React or Tailwind.

The intended project scripts are:

```json
{
  "scripts": {
    "dev": "teach-kit dev",
    "check": "teach-kit check"
  }
}
```

`dev` will load the root course entry and serve the course index at `/` and lesson pages at `/lessons/<id>`. `check` will validate configuration, Markdown, and resource references without launching a browser.

## Planned Repository Layout

```text
src/
├── index.ts               # Public API and types
├── course/                # Typed configuration, validation, and content loading
├── markdown/              # Shared AST pipeline, directives, and section metadata
├── cli/                   # dev and check commands
├── server/                # Preview server, routes, and resource access
└── web/                   # Browser pages, components, and styles

tests/
├── unit/                  # Unit tests for source modules and tooling
├── integration/           # Filesystem, CLI, and packed-package consumption
├── e2e/                   # Playwright browser tests
├── fixtures/              # Valid, invalid, and boundary content
└── helpers/               # Temporary projects and server lifecycle

examples/
└── hyperlane/             # A course matching the consumer project layout

dist/                      # Generated package output; not committed
```

This is the intended structure, not a list of directories already implemented. All test files live under `tests/`: unit tests in `tests/unit/`, integration tests in `tests/integration/`, and browser tests in `tests/e2e/`. Source and tooling directories do not contain test files.

`src/index.ts` is the public package entry and does not start a server. The scaffold preview runs through `src/server/dev.ts`; browser code lives in `src/web/`. Remaining directories will be introduced as their features are implemented.

Course content will be read at runtime, while the package frontend will be built in advance. Package installation tests will use an actual packed artifact in an independent project, not only a linked workspace.

## Development

Install dependencies and run the scaffold preview:

```bash
bun install
bun run dev
```

Available verification commands:

```bash
bun run typecheck
bun run test
bun run coverage:core
bun x playwright install chromium
bun run test:e2e
bun run build
```

`bun run test` runs unit and integration tests. `bun run coverage:core` runs them again with an LCOV report and fails when configuration or content loading drops below 90% line coverage.

`bun run build` generates the public JavaScript entry, type declarations, and frontend assets in `dist/`. It does not yet build a course CLI. `bun run start` runs the source preview server with development features disabled; it is not a packaged production server.

Playwright covers desktop and narrow-screen Chromium. Browser downloads are needed once per environment. Generated build output and test reports are ignored by Git.

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
