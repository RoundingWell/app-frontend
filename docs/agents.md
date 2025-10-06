# Agents Guide

Use this reference when operating AI-based tooling or chat assistants inside the Care Ops frontend repository.

## Repository Quick Facts
- Framework stack: Backbone + Marionette for views, Handlebars templates, SCSS (BEM), Vite build, Cypress tests.
- Workspace aliases: `js/*` maps to `src/js/*`, additional aliases defined in `vite.config.js` and `jsconfig.json`.
- Test modes: run `npm run coverage:component` for component specs and `npm run coverage:e2e` for end-to-end specs. Both set up coverage and Vite in `test` mode.

## Expectations for Generated Code
1. Stay in JavaScript—no TypeScript conversions.
2. Import SCSS from the JS module that renders the view.
3. Use Marionette conventions: define `ui`, prefer `triggers`, and keep DOM manipulation scoped to the view.
4. Keep modules under ~300 lines and functions small with guard clauses.
5. Use formatjs keys for i18n strings (`view.directory.fileViews.subView.keyName`).

## When Modifying or Creating Files
- Update or create matching tests; feature logic lives in `src/js/`, specs in `src/js/**.cy.js` or `test/integration`.
- Route AJAX calls through the entities service (`src/js/entities-service`).
- Follow naming patterns (`*_app.js`, `*_views.js`, `.js-*` selectors for hooks).

## Safe Defaults for Tooling
- Run `npm run lint` before proposing changes.
- Prefer existing utilities over adding new dependencies.
- Keep feature flags easy to remove—use guard clauses and duplicate logic when necessary.

## Helpful References
- `.github/copilot-instructions.md` outlines architecture decisions and patterns.
- `README.md` contains release flow, coding standards, and troubleshooting tips.
- `CONTRIBUTING.md` summarizes the required checks and pull-request workflow.
