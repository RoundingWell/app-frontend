# Copilot Instructions for Care Ops Frontend

`/AGENTS.md` is the canonical source for AI guidance in this repository.

Load a scoped overlay only when your change touches `scripts/**` or `packages/care-ops-five9/**`.

## Key Rules

- JavaScript only. Do not generate TypeScript.
- Use the Marionette application context in `/AGENTS.md` and Marionette's version-matched upstream docs.
- Define template selectors in `ui`, access them through `getUI`, and keep DOM mutation with its owning View.
- Prefer View `triggers` over `events`, and `triggerMethod` over `trigger`.
- Route data access through `src/js/entities-service/**`.
- Colocate app-owned views, templates, SCSS, state, and Cypress specs under the owning `src/js/apps/**` directory.
- Import SCSS from the module that renders the view. Use BEM naming and do not style `.js-*` hooks.
- Prefer this import order: third-party libraries, shared SCSS modules, all JavaScript dependencies, templates, app-shared SCSS, shared domain SCSS, then view-local SCSS last. Shared modules must load before JavaScript dependencies that may import styles; domain SCSS must load after them.
- Keep Handlebars spacing tight: `{{ value }}` and `{{#if}}{{else}}{{/if}}`.
- Keep template attribute order predictable: class, id or name, src or for or type or href or value, title or alt, role or aria-*, then boolean attributes.
- Component specs live beside their owners as `src/**/*.component.cy.js`.
- E2E specs live beside their owners as `src/**/*.e2e.cy.js`.
- Reserve component specs for generic reusable units; cover application behavior with E2E. Component coverage does not establish reachability: verify and remove dead application code rather than preserving it with component specs.
- Fixtures live in `test/fixtures/**`.
- Do not assert exact alignment, spacing, typography, dimensions, colors, or computed CSS unless it communicates product state or proves functional geometry such as a breakpoint, overflow, reachability, popup direction, or layout stability during a state change.
- Treat `scripts/**` and `packages/care-ops-five9/sdk/**` as sensitive areas and use their scoped overlays.

## Communication

- Keep responses short and operational.
- Put actions and results before rationale.
- Avoid preamble, filler, and repetition.
- Explain only for tradeoffs, failures, uncertainty, or required evidence.

## Reviews

- Put findings first.
- Do not flag intentional choices: the Backbone/Marionette stack, synchronous string-based Radio requests, and JavaScript over TypeScript (see the Intentional Choices section in `/AGENTS.md`).
- Prioritize repo-specific risks first: `scripts/**`, `packages/care-ops-five9/sdk/**`, `src/js/entities-service/**`, Marionette view patterns, and template or SCSS coupling.
- Flag visual assertions that would fail for an equally valid design implementation without changing state or behavior.
- Keep review output concise and operational.
- Avoid low-signal comments on tiny mechanical or pure copy-only diffs unless a repo-specific risk is involved.
