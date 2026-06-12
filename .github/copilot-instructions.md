# Copilot Instructions for Care Ops Frontend

`/AGENTS.md` is the canonical source for AI guidance in this repository.

Load a scoped overlay only when your change touches `scripts/**` or `packages/care-ops-five9/**`.

## Key Rules

- JavaScript only. Do not generate TypeScript.
- Follow Marionette patterns: define `ui`, prefer `triggers` and `triggerMethod`, and keep DOM mutation scoped to the view.
- Route data access through `src/js/entities-service/**`.
- Import SCSS from the module that renders the view. Use BEM naming and do not style `.js-*` hooks.
- Prefer this import order: third-party libraries, shared SCSS modules, shared utilities and i18n, base classes, entities and service modules, apps and controllers, behaviors, regions, and components, views, then templates and view-local SCSS last.
- Keep Handlebars spacing tight: `{{ value }}` and `{{#if}}{{else}}{{/if}}`.
- Keep template attribute order predictable: class, id or name, src or for or type or href or value, title or alt, role or aria-*, then boolean attributes.
- Component specs live in `src/**/*.cy.js`.
- E2E specs live in `test/integration/**/*.js`.
- Fixtures live in `test/fixtures/**`.
- Treat `scripts/**` and `packages/care-ops-five9/sdk/**` as sensitive areas and use their scoped overlays.

## Communication

- Keep responses short and operational.
- Put actions and results before rationale.
- Avoid preamble, filler, and repetition.
- Explain only for tradeoffs, failures, uncertainty, or required evidence.

## Reviews

- Put findings first.
- Do not flag intentional choices: the Backbone/Marionette stack, synchronous string-based Radio requests, underscore over native, and JavaScript over TypeScript (see the Intentional Choices section in `/AGENTS.md`).
- Prioritize repo-specific risks first: `scripts/**`, `packages/care-ops-five9/sdk/**`, `src/js/entities-service/**`, Marionette view patterns, and template or SCSS coupling.
- Keep review output concise and operational.
- Avoid low-signal comments on tiny mechanical or pure copy-only diffs unless a repo-specific risk is involved.
