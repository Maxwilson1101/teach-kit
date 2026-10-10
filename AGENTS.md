# Development Rules

## Scope and Language

- Teach Kit is an installable Bun package for one course per consuming
  project.
- The consuming project contains a root `index.ts`, `lessons/`, and
  `assets/`. TypeScript defines the course; Markdown provides lesson bodies.
- The package owns the preview server, rendering, styling, and navigation.
- Do not introduce multi-course management, offline HTML export, learning
  progress, executable notebooks, or arbitrary JSX/CSS authoring into the MVP.
- Write all repository file content in English except `PLAN.md`, which must
  be written in Chinese.
- This language rule includes comments, diagnostics, tests, fixtures,
  examples, and documentation. Preserve existing visual reference assets.
- Write commit messages in English. Conversational responses may be Chinese.
- Keep all test files under `tests/`: `unit/`, `integration/`, and `e2e/`.
  Do not place test files alongside modules in `src/` or `scripts/`.

## Stage 1: Start a Task

1. Read `PLAN.md` and relevant source files before making changes.
2. Inspect `git status` and identify existing user changes. Do not overwrite
   or include unrelated changes.
3. Define the task's observable behavior, acceptance criteria, and boundaries.
4. Select the required test layers:
   - Unit tests for configuration, parsing, validation, and metadata.
   - Integration tests for filesystem, CLI, server, and package behavior.
   - Playwright tests for browser interactions and responsive presentation.
5. Plan one independently reviewable change per commit. Split unrelated work.
6. Confirm that the task is within the agreed MVP scope. Request clarification
   rather than silently expanding scope.
7. Follow explicit user instructions about approval and committing. If the
   user requests review before a commit, stop after verification and wait.

## Stage 2: Implement with TDD

TDD is mandatory for behavior changes and bug fixes.

### Red

1. Write a focused test for the intended behavior before implementing it.
2. Run the test and confirm that it fails for the expected missing behavior.
3. Correct unrelated setup failures before treating the test as a valid red
   state.
4. For a bug fix, reproduce the bug with a failing regression test first.

### Green

1. Implement the smallest change that makes the test pass.
2. Do not add untested behavior or speculative abstractions.
3. Do not weaken assertions, skip tests, or remove regression coverage merely
   to obtain a passing result.

### Refactor

1. Improve structure without changing the tested contract.
2. Keep relevant tests green throughout the refactor.
3. Separate unrelated cleanup from the functional change.

Pure documentation and formatting changes do not require a red test.
For tooling changes, validate the affected commands and failure behavior
where applicable.

### Required Test Coverage

- Cover expected behavior, invalid inputs, meaningful boundaries, and failure
  states for every behavior change.
- Test observable contracts rather than incidental implementation details.
- Use deterministic fixtures and real temporary files for filesystem tests.
- Do not mock away the behavior under test.
- Do not add assertions that merely execute code to increase coverage.
- Test names and assertions must identify the behavior they protect.

The following contracts require explicit coverage:

| Layer | Required cases |
| --- | --- |
| Configuration | Required fields, invalid values, duplicate and unsafe IDs, ordering, public TypeScript contracts |
| Content loading | Entry-relative paths, missing versus invalid lessons, resource references, path traversal prevention |
| Markdown | Valid syntax, invalid attributes, unsupported structures, nested fences, duplicate headings, summary extraction |
| CLI and server | Exit codes, diagnostics, routes, startup failures, process cleanup |
| Browser | Pointer and keyboard interactions, navigation state, responsive layouts, browser errors |
| Packaging | Installation and supported workflows using an actual packed artifact in an independent project |

### Coverage Gate

- Maintain a reproducible coverage command.
- Configuration, content-loading, and Markdown modules must each achieve
  at least 90% line coverage.
- Measure these core modules separately from browser rendering code.
- Review uncovered lines and conditional branches in changed core modules,
  especially validation and error paths.
- Exclude only generated files, dependencies, and test code from source
  coverage measurement.
- Do not lower thresholds or broaden exclusions to bypass the gate.
- Do not claim coverage compliance until tooling is configured and the
  measurement has actually run.
- If required coverage cannot be measured, treat verification as incomplete
  and report the blocker.

Line coverage does not replace behavioral assertions. Browser behavior must
be verified with Playwright; screenshots alone are insufficient.

### Implementation Constraints

- Resolve content and asset paths relative to the course entry, not the
  current working directory.
- Keep lesson order, titles, and descriptions in the course definition.
  Do not duplicate them in Markdown frontmatter.
- Treat missing lessons as planned content and invalid lessons as errors.
- Use a shared AST-based Markdown pipeline for rendering, validation,
  anchors, and navigation metadata.
- Do not parse nested directives with regular expressions.
- Restrict directives and attributes to explicit allowlists. Report invalid
  structures with actionable file-location diagnostics.
- Do not expose raw HTML, arbitrary JSX, or custom CSS as escape hatches.
- Read course content at runtime and prebuild the package frontend.
- Consumers must not need React or Tailwind configuration.
- Provide keyboard equivalents for hover behavior. Touch layouts must not
  depend on hover.

## Stage 3: Pre-Commit Verification

Complete this stage before every commit.

- Run `bun run lint` before committing. Formatting, import organization, and
  lint warnings must all pass; do not disable rules to bypass the gate.
- Use `bun run lint:fix` for safe automatic fixes and inspect the resulting diff.

1. Run the tests for changed behavior and relevant dependent modules.
2. Run type checks for code, public types, or configuration changes.
3. Run core coverage measurement when core behavior changes.
4. Run Playwright when browser behavior or presentation changes.
5. Run build and packed-package consumption tests when changing dependencies,
   exports, CLI delivery, build output, or package contents.
6. Inspect screenshots when presentation changes. Check desktop and narrow
   layouts; automated assertions do not establish visual quality.
7. Update `PLAN.md` with verified completed tasks and current progress.
   Do not mark work complete merely because code exists.
8. Inspect the diff for unrelated changes, temporary files, generated output,
   secrets, and accidental deletions.
9. Stage explicit paths or hunks. Do not indiscriminately stage the entire
   working tree.
10. Inspect the staged diff and confirm that it represents one coherent change.
11. Confirm that `PLAN.md` is not staged. Unstage it if necessary.
12. Report actual verification results and any blocked or skipped checks.

Never claim a command passed unless it was run. Required checks that fail
or cannot run block the commit; resolve them or obtain explicit approval
for an exception.

Before declaring the MVP complete, run the full test suite, type checks,
coverage measurement, build, packed-package installation tests, and
browser tests.

## Stage 4: Commit

- Commit only after pre-commit verification succeeds and any required user
  approval has been obtained.
- Each commit must have one clear, independently reviewable purpose.
- Include implementation, associated tests, and necessary documentation
  together.
- Keep commits buildable and green. Do not commit intermediate red TDD states.
- Do not mix unrelated features, cleanup, refactoring, or dependency changes.
- Do not include unrelated user changes.
- Never commit `PLAN.md`. Keep it in the working tree without adding it to
  `.gitignore`.
- Do not amend or rewrite existing commits unless explicitly requested.

### Commit Schema

Use Conventional Commits:

```text
<type>(<optional-scope>): <imperative summary>

<optional body explaining intent, constraints, and verification>

<optional footers>
```

Allowed types:

| Type | Purpose |
| --- | --- |
| `feat` | Add user-visible functionality |
| `fix` | Correct existing behavior |
| `refactor` | Restructure code without changing behavior |
| `test` | Add or improve tests without a functional change |
| `docs` | Update documentation |
| `build` | Change packaging, build tooling, or dependencies |
| `ci` | Change continuous integration |
| `chore` | Repository setup or maintenance |
| `style` | Formatting-only changes, not visual features |
| `perf` | Improve performance without changing behavior |

- Use a concise English imperative summary.
- Use scopes such as `config`, `content`, `markdown`, `components`,
  `navigation`, `cli`, or `package` when helpful.
- Use `!` and a `BREAKING CHANGE:` footer for incompatible public API changes.
- Record actual verification commands in the body when useful.

Examples:

```text
feat(config): define typed course configuration
fix(navigation): keep section previews within the viewport
build(package): include frontend assets in the published package
docs: document Markdown authoring conventions
```

## Stage 5: Report and Stop

- Summarize the completed change and verification results.
- If committed, include the commit identifier.
- If awaiting approval, state that no commit was created.
- Identify remaining gaps or blockers without claiming unfinished work
  is complete.
- Do not continue into unrelated tasks without authorization.
