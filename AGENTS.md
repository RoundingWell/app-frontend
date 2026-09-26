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
- Underscore is the default data-manipulation API, including where native equivalents exist. Do not replace it mechanically or flag its use as outdated.
- Define parent-owned template element selectors in the View's `ui` hash and access them through `getUI`; do not scatter selector queries through View methods. Do not bind a CollectionView's `ui` to dynamic child View DOM: cached elements become stale as children render or filter. Keep DOM mutation with its owning View.
- Prefer View `triggers` over `events`, and `triggerMethod` over `trigger`.
- Prefer composition when sharing application behavior: owned child apps for independent UI lifetimes, focused objects for stateful coordination, and functions for stateless work. Keep each domain's startup, refresh, and error policy explicit. Avoid application base classes that orchestrate subclass hooks or mixins that implicitly depend on the consuming app's fields. Modest duplication is preferable to a configurable lifecycle engine. Inheritance remains appropriate for a genuine specialization with a small, stable contract, such as a shared layout View.
- Choose app boundaries around independently managed UI or asynchronous workflows, not the existing directory or ownership tree. Let a visual app own a complete View in one Region; compose its internal controls as Views and focused objects rather than borrowing several regions from its parent. Give child apps explicit regions, data sources, and events rather than the parent layout View or callbacks that navigate its view tree. The page coordinates siblings and handles host destruction; Views own DOM, responsive layout, and focus within their own elements. Treat host lifetime, Application lifetime, and request lifetime separately: losing a host must invalidate its effects even when Application teardown is still pending.
- Keep `preinitialize` and `initialize` available as safe extension points on generic components. Put mandatory internal setup in the constructor when it must run even if a subclass defines either hook.
- Colocate app-specific views, templates, SCSS, state, and Cypress specs under `src/js/apps/<domain>/<app>/**`.
- Keep domain-shared UI under `src/js/apps/<domain>/shared/**` and cross-domain reusable UI under `src/js/components/**`.
- Route data access through `src/js/entities-service/**` instead of introducing ad hoc fetch logic elsewhere.
- Import SCSS from the module that renders the view. Use BEM naming and do not style `.js-*` hooks.
- Keep feature flags easy to remove. Prefer guard-clause style branching.
- Never use `silent: true` to suppress model/state notifications. Seed initial values before observers attach, or compute a complete update and apply it with a normal `set`; use lifecycle ownership for cleanup.
- Avoid prototype-method `.call()`/`.apply()` chains outside constructor delegation. Prefer lifecycle hooks, supported extension points, or shared helpers; retain a parent-method call only when its behavior is required and no suitable hook exists.
- Reuse existing utilities and workspace packages before adding dependencies.
- Use i18n keys that match the repo's existing formatjs-style naming.

## Marionette Application Context

Use the `marionette` skill supplied by Marionette's upstream plugin for Marionette
work. It selects the version-matched framework docs; this file records the app's
integration choices and verification policy.

- Contract: the repository root's `package.json` and `package-lock.json` pin
  `marionette` and `@mnjs/adapters` to published `5.0.0-rc.1` packages.
- Packaged docs: `node_modules/marionette/dist/docs`, version `5.0.0-rc.1`, source
  `469e790fea03993a5c063e39028445ac3610c9e4`, `sourceDirty: false`, content
  SHA-256 `64ac5cf775715975ac62d3373b4618f833b9376d406dd0128f151132945e3a98`.
  Verify the installed package against this release before relying on its APIs.
- Runtime: the shared named exports from `marionette`; `src/js/base/setup.js`
  registers Backbone for DataApi and StateApi, and Morphdom for DomApi. DOM event
  delegation uses Marionette's native default.
- Renderer: `src/js/i18n/index.js` registers the Handlebars renderer with `@intl`
  template data. `src/js/app.js` imports both setup modules before app consumers.
- Events/routing: use `Radio` from `marionette`. The local
  `src/js/base/event-router.js` extends `Backbone.Router`; `Backbone.history` owns
  URL/history handling. AppFrame and the local RouterApp/SubRouterApp classes own
  feature selection and loading; see `src/js/base/routing.md` for app policy.
- Ownership entrypoint: `src/js/app.js` owns the `#root` Region, RootView, and
  bootstrap/dialer/app-frame child Applications. It configures shared popup Regions
  and owns its document/window listeners. Follow each feature's existing owner.
- Patient lists: Schedule and Worklist keep their page controls and sidebar separate
  from the results Application. Each page and results app extends `App` directly;
  shared selection and sidebar objects live under `src/js/apps/patients/shared`.
  Loading, grouping, sorting, and error policy stay with their feature.
  `src/js/utils/latest-request.js` coordinates replaceable data requests without
  restarting the page.
- Verification: run this repo's commands from the root using the boundaries in
  **Validation** below; generic units use component specs, app flows use E2E.

The upstream plugin supplies the consumer skill and hosted documentation MCP.
Follow that workflow for retrieval and verification. Keep framework API
instructions upstream; keep this section limited to application decisions.

## Intentional Choices — Do Not Propose Changing or Flag in Review

These are deliberate, settled decisions. Do not suggest "modernizing" them in
generated code, and do not flag them as issues, tech debt, or risks in review.

- The Backbone + Marionette stack is the permanent direction. The team
  maintains Marionette and Radio upstream. Never propose a framework migration
  or describe the stack as legacy.
- Marionette Radio stays synchronous. Do not propose Promise normalization,
  async middleware, or typed wrappers around Radio.
- String-based Radio request names (e.g. `'fetch:actions:model'`) are
  intentional: they keep test stubbing and console debugging trivial. Do not
  propose typed or constant-based replacements.
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
  9. templates
  10. app-shared SCSS, shared domain SCSS, then view-local SCSS last
- Within third-party imports, place `hbs` from `handlebars-inline-precompile` before imports from `marionette`.
- Keep shared SCSS modules before every JavaScript dependency that may transitively import styles. Keep explicit domain SCSS after those JavaScript dependencies so domain rules win without added specificity.
- Handlebars spacing should stay tight and consistent: `{{ value }}` and `{{#if}}{{else}}{{/if}}`.
- Use `{{{ }}}` only for trusted HTML.
- Keep attribute order predictable in templates: class, id or name, src or for or type or href or value, title or alt, role or aria-*, then boolean attributes.
- Keep selectors shallow and prefer new blocks to deep nesting.

## Sensitive Areas

- `packages/care-ops-five9/sdk/**` contains downloaded vendor code plus a local patch. Update it through `packages/care-ops-five9/update-sdk.js`, not by hand.
- `scripts/**` drives release, artifact, and deploy flows. Preserve CLI flags, output shape, and release semantics when editing.
- Workspace packages under `packages/**` are shared entry points for the app. Treat public APIs as stable unless the task explicitly changes them.

## Lifecycle Review

- Verify cancellation claims against the installed Marionette version and actual callers. Superseded startup operations resolve false, but code inside an async `prepareStart` still needs `signal.throwIfAborted()` before manually starting children after awaits.
- A stopped app can be stopped without stop notifications; canceling an in-progress start can still invoke `onStop`. Scope listener cleanup by event/callback when its source may not yet be assigned.
- Internal fetch helpers require the options passed by their current callers. Do not restore hypothetical no-options consumers or removed configuration variants without finding an active caller.

For list and mutation changes, verify these ownership contracts:

- A pending write keeps its original target membership. After navigation or a new selection/editor, old success and failure callbacks cause no UI changes to the newer context.
- Release owned derived collections with `reset()`, never entity collection `destroy()`. Released selections receive no model notifications; surviving consumers still receive them.
- Catch loading failures around loading only. Rendering or commit errors reach the application error reporter instead of a retryable loading state.
- Reconcile refresh results into retained collections. Surviving rows and unrelated controls keep identity, focus, and open state; replace rows when their resource type or Schedule date group changes. Cover these interactions through the UI.

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

### AI Review PRs

- Open AI-authored PRs as ready for review, not as drafts.
- Apply the `ci:defer-cypress` label when opening an AI-authored PR. The label
  keeps the required CircleCI workflow pending at `Cypress deferred - approve
  to run` while normal review and revision continue.
- Do not apply the label to ordinary human-authored PRs. Their Cypress jobs run
  automatically on every revision as usual.
- When review feedback is resolved, approve the CircleCI hold to run the full
  E2E, component, and coverage jobs for the current commit.
- Never merge while Cypress is held or without a passing Cypress result for the
  current commit. A new commit requires a new approval and Cypress result.
- Read [`.circleci/README.md`](.circleci/README.md) before changing CircleCI
  pipeline definitions, config paths, or schedule triggers.

## Validation

- Cover behavior that users can exercise through the UI with E2E tests. Do not substitute component tests that stub application methods or state for those flows; reserve component tests for behavior that cannot be meaningfully exercised through the UI. Prefer extending an existing E2E scenario for the same flow; add a separate `specify` only when the scenario needs its own isolation.

- Use `npm run lint` for code changes that affect files covered by the repo lint setup.
- Test the current product contract, not its implementation history. When a control, class, route, or behavior is removed, delete tests whose only purpose is to prove the obsolete implementation remains absent. Keep negative assertions only when absence is a current user-facing contract, such as permissions, availability, filtering, deletion, or a state transition.
- Do not make incidental presentation a Cypress contract. Avoid exact assertions for alignment, spacing, typography, dimensions, colors, or computed CSS unless the presentation itself communicates product state or the geometry proves functional behavior such as a breakpoint mode, overflow prevention, reachability, popup direction, or layout stability during a state change.
- Keep related Cypress scenarios consolidated when their setup can be reset explicitly. Do not recommend splitting solely because an earlier assertion failure skips later steps; that is normal test behavior. Flag actual leaked intercepts, clocks, or exception handlers instead.
- During review, flag newly added visual assertions that would fail for an equally valid design implementation without changing state or behavior. Use design review or manual visual inspection for ordinary visual fidelity.
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
