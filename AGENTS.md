# Care Ops Frontend - AI Agent Guidelines

- Applies to: all AI agents operating in this repository
- Canonical reference: `/AGENTS.md`

Start here. Load additional docs only when referenced below.

Load a scoped overlay only when the task touches:

- `scripts/**` -> `scripts/AGENTS.md`
- `packages/care-ops-five9/**` -> `packages/care-ops-five9/AGENTS.md`
- routing infrastructure (`src/js/base/routerapp.js`, `src/js/base/subrouterapp.js`) or application route definitions -> `src/js/base/routing.md`
- data access, entities, or `src/js/entities-service/**` -> `src/js/entities-service/README.md`

## Instruction Priority

1. System and developer instructions
2. `/AGENTS.md`
3. Scoped `AGENTS.md` files in subdirectories
4. Agent-specific companion docs such as `.github/copilot-instructions.md`
5. General repo documentation

## Repository Snapshot

- Stack: Backbone, Marionette, Handlebars, SCSS, Vite, Cypress, npm workspaces.
- Core app code lives in `src/js/**`; styles live in `src/scss/**`; shared packages live in `packages/**`.
- Component Cypress specs live beside their owners as `src/**/*.component.cy.js`.
- E2E Cypress specs live beside their owners as `src/**/*.e2e.cy.js`.
- Fixtures and Cypress support files live in `test/fixtures/**` and `test/support/**`.
- Repo aliases map `js/*` to `src/js/*` in `jsconfig.json` and `vite.config.js`.

## Core Guardrails

- Stay in JavaScript. Do not introduce TypeScript or a new framework.
- Follow Marionette patterns: define `ui`, prefer `triggers` and `triggerMethod`, and keep DOM mutation scoped to the view.
- Colocate app-specific views, templates, SCSS, state, and Cypress specs under `src/js/apps/<domain>/<app>/**`.
- Keep domain-shared UI under `src/js/apps/<domain>/shared/**` and cross-domain reusable UI under `src/js/components/**`.
- Route data access through `src/js/entities-service/**` instead of introducing ad hoc fetch logic elsewhere.
- Import SCSS from the module that renders the view. Use BEM naming and do not style `.js-*` hooks.
- Keep feature flags easy to remove. Prefer guard-clause style branching.
- Reuse existing utilities and workspace packages before adding dependencies.
- Use i18n keys that match the repo's existing formatjs-style naming.

## Intentional Choices — Do Not Propose Changing or Flag in Review

These are deliberate, settled decisions. Do not suggest "modernizing" them in
generated code, and do not flag them as issues, tech debt, or risks in review.

- The Backbone + Marionette stack is the permanent direction. The team
  maintains `backbone.marionette` and `backbone.radio` upstream. Never propose
  a framework migration or describe the stack as legacy.
- `backbone.radio` stays synchronous. Do not propose Promise normalization,
  async middleware, or typed wrappers around Radio.
- String-based Radio request names (e.g. `'fetch:actions:model'`) are
  intentional: they keep test stubbing and console debugging trivial. Do not
  propose typed or constant-based replacements.
- Underscore is the default data-manipulation API, including where native
  equivalents exist (see `src/js/README.md`). Do not flag underscore usage as
  outdated or suggest native one-for-one rewrites.
- JavaScript, not TypeScript, per the guardrails above. Do not flag missing
  type annotations.

## Communication

- Keep responses short and operational.
- Put actions and results before rationale.
- Avoid preamble, filler, and repetition.
- Explain only when tradeoffs, failures, uncertainty, or required evidence make it necessary.

## Template, Style, and Import Conventions

- Prefer this import order when adding or reorganizing imports (canonical list; the worked example is in `src/js/README.md`):
  1. polyfills and third-party libraries
  2. shared SCSS modules
  3. shared utilities and i18n
  4. base classes
  5. entities and service modules
  6. apps and controllers
  7. behaviors, regions, and components
  8. views
  9. templates, then view-local SCSS last
- Handlebars spacing should stay tight and consistent: `{{ value }}` and `{{#if}}{{else}}{{/if}}`.
- Use `{{{ }}}` only for trusted HTML.
- Keep attribute order predictable in templates: class, id or name, src or for or type or href or value, title or alt, role or aria-*, then boolean attributes.
- Keep selectors shallow and prefer new blocks to deep nesting.

## Sensitive Areas

- `packages/care-ops-five9/sdk/**` contains downloaded vendor code plus a local patch. Update it through `packages/care-ops-five9/update-sdk.js`, not by hand.
- `scripts/**` drives release, artifact, and deploy flows. Preserve CLI flags, output shape, and release semantics when editing.
- Workspace packages under `packages/**` are shared entry points for the app. Treat public APIs as stable unless the task explicitly changes them.

## Reviewing Changes

- Put findings first.
- Put repo-specific risks first:
  - `scripts/**` release and deploy behavior
  - `packages/care-ops-five9/sdk/**` and the SDK wrapper flow
  - `src/js/entities-service/**` data-access boundaries
  - Marionette view patterns such as `ui`, `triggers`, and scoped DOM behavior
  - template and SCSS coupling
- Keep review output concise and operational.
- Explain only when severity, tradeoffs, failures, uncertainty, or evidence require it.
- Review is most useful for non-trivial diffs, risky refactors, shared package changes, release or deploy changes, and behavior changes that may not be caught by lint.
- Review is less useful for tiny mechanical edits, pure copy changes, or changes where tests and lint already provide the meaningful signal.

## Commits and Pull Requests

- Use conventional-commit subjects, `type(scope): summary` with the scope
  optional — e.g. `feat`, `fix`, `chore`, `refactor`, `perf`, `docs`, `test`,
  `build`, `ci`, `revert`.
- Keep PR descriptions short and operational, consistent with the
  Communication rules above.

## Validation

- Use `npm run lint` for code changes that affect files covered by the repo lint setup.
- Iterate with single specs; they are much faster than the full suites:
  - Component: `npx cypress run --component --spec src/js/base/routerapp.component.cy.js`
  - E2E: build and serve the test app once (`npm run build -- --mode test`, then `npx vite preview -m test` in the background to serve on port 8090), then `npx cypress run --spec src/js/apps/<domain>/<app>/<spec>.e2e.cy.js`
  - Do not pass `--spec` through `npm run coverage:e2e`; npm appends it after the script's `exit`, so the full suite still runs unfiltered and the script then exits 1 (`exit: too many arguments`).
- Before claiming UI behavior is validated, run the full suite relevant to the change:
  - `npm run coverage:component` for component behavior
  - `npm run coverage:e2e` for app flows
  - `npm run coverage` runs both; do not stack it with the individual commands.
- Never claim validation passed unless you actually ran the command.

## Common Commands

- `npm run dev` — blocking dev server; not a validation step.
- `npm run test` — opens the interactive Cypress runner; never run it non-interactively (it hangs). Agents validate with the headless commands below instead.
- `npm run lint`
- `npm run coverage:component` — headless, agent-safe.
- `npm run coverage:e2e` — headless, agent-safe; builds and serves the test app itself.
- `npm run coverage` — full suite, slow; headless.
- `npm run stop` — kills vite and clears its cache.

## AI Docs Maintenance

- `AGENTS.md` is the canonical source for repo-wide AI guidance.
- Companion docs should summarize or scope rules, not restate them with conflicting details.
- Copilot prompt surfaces intentionally inline a small subset of rules that they must see locally, such as import order and review-output constraints.
- Prefer deleting stale AI docs over maintaining low-signal indexes or checklists.
- This repo intentionally does not maintain a dedicated AI-doc audit script. Keep AI docs accurate through same-patch updates, targeted repo inspection, AI review when warranted, and human review.
- When an AI review comment is noise or an agent makes a repo-specific mistake these docs should have prevented, patch the doc that failed in the next related change rather than letting the failure repeat.
