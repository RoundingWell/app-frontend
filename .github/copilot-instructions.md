# Copilot Instructions for RoundingWell Care Ops Frontend

## Tech Stack & Architecture
- Backbone + Marionette for application structure and view lifecycle
- Handlebars templates (`*.hbs`) paired with Marionette views
- SCSS following BEM conventions and imported from the JS files that render the views
- Vite build pipeline with flat ESLint (`eslint.config.mjs`) and Stylelint (`.stylelintrc`)
- Cypress component specs (`src/**/*.cy.js`) and e2e specs (`test/integration/**`) with NYC coverage reporting

## Project Structure & Naming
- Views live in `*_views.js`; accompanying templates (`*.hbs`) and styles (`*.scss`) share the folder
- Apps live in `*_app.js` and orchestrate data + views
- Entities and network access stay inside `src/js/entities-service/**`
- Components provide generic, configurable widgets; behaviors encapsulate reusable DOM interactions; utilities host shared helpers
- Aliases available: `js/*` → `src/js/*`, configured in `jsconfig.json` and `vite.config.js`
- Directory conventions: `app-name/app-name_app.js`, `view-name/view-name_views.js`, templates and SCSS colocated with their JS

## Import Order
1. Third-party libraries and polyfills
2. CSS/SCSS modules (including component styles)
3. Shared utilities and base classes
4. Apps that wire data and views
5. Views/components
6. Templates (`*.hbs`)
7. Additional local CSS/SCSS overrides

## Domain Context
- Core domain objects: Patients, Actions, Forms, Workflows, Teams, Organizations, Care Plans
- Key services: Five9 dialer integrations, sidebar/task workflows, artifacts and tags entity services
- Feature flags control incremental rollouts; default behaviour should match current production unless explicitly toggled

## SCSS Standards
- Follow BEM naming (`.block`, `.block__element`, `.block__element--modifier`)
- Use `.js-*` classes for JavaScript hooks but never style them directly
- State helpers use `.is-*` / `.has-*` as adjoining classes only
- Keep selectors shallow; prefer new blocks over deep nesting (>3 levels)

## Handlebars Templates
- Variable spacing: `{{ something }}`; logic helpers: `{{#if something}}{{else}}{{/if}}`
- Attributes use double quotes with order: class, id/name, src/for/type/href/value, title/alt, role/aria-*, boolean
- Use `{{ }}` for escaped content and `{{{ }}}` only for safe HTML snippets
- Keep templates focused; break large templates into partials

## Internationalization
- Use formatjs key naming: `view.directory.fileViews.viewName.stringContext`
- HTML strings get an `HTML` suffix
- Access strings via Handlebars helpers: `{{ @intl.path.to.key }}`
- Use `dayjs` for date formatting instead of formatjs date helpers

## Common Patterns & Guardrails
- Define a `ui` hash and use `triggers`/`triggerMethod`; avoid manual DOM queries or `events`
- Functions should accomplish one task in <10 lines when practical; break out helpers otherwise
- Use guard clauses to short-circuit early; keep modules under ~300 lines
- Store state on Backbone models, not ad-hoc properties
- Keep AJAX/fetch logic inside entities-service; other modules communicate via Backbone.Radio/state models
- Favor object composition over inheritance unless extending Marionette/Base classes

## Testing Expectations
- UI changes should include/upate Cypress component specs alongside the module
- Flow or integration changes need e2e specs under `test/integration/**`
- Run `npm run lint`, `npm run coverage:component`, and `npm run coverage:e2e` before opening a PR

## Sensitive Areas
- Five9 SDK files under `packages/five9/**/sdk/**` are generated via `packages/five9/update-sdk.js`; avoid editing by hand
- Release automation lives under `release/`; changes must respect `npm run release` conventions (release branches never merge back into `develop`)
- Formio and FontAwesome packages are maintained separately; prefer extending via their public APIs instead of modifying vendored bundles

## Helpful Commands
- `npm run dev` – start Vite dev server (port 8081)
- `npm run test` – launch Cypress GUI with Vite in test mode
- `npm run coverage` – run both component and e2e coverage suites
- `npm run stop` – kill stray Vite processes and clear caches

Use these notes when prompting Copilot so suggestions stay aligned with current tooling, domain concepts, and architectural boundaries.
