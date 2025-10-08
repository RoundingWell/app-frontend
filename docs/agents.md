# Agents Guide

Use this playbook whenever you generate or modify files inside the Care Ops frontend repository.

## Repository Snapshot
- Stack: Backbone + Marionette views, Handlebars templates, SCSS (BEM), Vite tooling, Cypress tests.
- Key paths: `src/js` (apps, entities, Marionette regions), `src/scss` (styles), `packages/` (workspace packages), `cypress/` (component + e2e specs), `test/` (legacy helpers).
- Aliases: `js/*` → `src/js/*` plus entries in `jsconfig.json` and `vite.config.js`.

## Generation Guardrails
- Stay in JavaScript; do not introduce TypeScript or new frameworks.
- Colocate styles by importing the relevant SCSS from the module that renders the view.
- Follow Marionette patterns: define `ui`, prefer `triggers` to DOM events, keep DOM mutation scoped to the view, and keep modules under ~300 lines.
- For i18n, use formatjs-style keys (`view.directory.section.key`).

## File & Naming Conventions
- New modules belong in existing feature folders (for example `src/js/apps/patients` or `src/js/entities-service`).
- Files should remain kebab-case (`workspace-patients_view.js`, `.js-*` selectors for hooks); exported classes or views use PascalCase.
- Route network calls through the entities service and reuse utilities before creating new ones.

## Testing Expectations
- Component specs live under `cypress/component`, e2e specs under `cypress/e2e`; mirror the feature name (e.g., `workspace_patients.cy.js`).
- Stubs and fixtures are in `cypress/fixtures/`; use them to keep runs deterministic.
- Run `npm run coverage:component`, `npm run coverage:e2e`, or `npm run coverage` when coverage data is required.

## Tooling & Validation
- Run `npm run lint` before finishing edits; use `npm run lint:fix` for safe autofixes.
- Avoid adding dependencies unless absolutely necessary; prefer existing workspace packages.
- Keep feature flags simple and easy to remove (guard clauses over global toggles).

## Helpful References
- `.github/copilot-instructions.md` outlines architecture decisions and anti-patterns.
- `README.md` covers release flow and shared tooling.
- `CONTRIBUTING.md` summarizes required checks and the pull-request workflow.
