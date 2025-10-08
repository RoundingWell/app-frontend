# Copilot Instructions for RoundingWell Care Ops Frontend

## Tech Stack & Architecture
- Backbone + Marionette orchestrate app structure, state, and view lifecycle
- Handlebars templates (`*.hbs`) pair with Marionette views; SCSS (BEM) is imported from the JS module that renders the view
- Vite handles builds; linting is configured via `eslint.config.mjs` and Stylelint with EditorConfig enforcement
- Cypress component specs live under `cypress/component`, e2e specs under `cypress/e2e`; NYC aggregates coverage
- Workspace packages in `packages/` extend the core app (auth, config, datadog, Five9, fontawesome)

## Project Structure & Naming
- Apps end with `_app.js` and wire data/models into views; feature directories use `feature-name/feature-name_app.js`
- Views live in `_views.js` files beside their templates (`*.hbs`) and styles (`*.scss`)
- Network and persistence logic belongs in `src/js/entities-service/**`
- Components provide reusable widgets; behaviors encapsulate DOM interactions; utilities hold shared helpers
- Aliases: `js/*` → `src/js/*` (see `vite.config.js`, `jsconfig.json`)
- Filenames stay kebab-case (`workspace-patients_view.js`; `.js-*` selectors for hooks); exported classes/views use PascalCase

## Import Order
1. Polyfills and third-party libraries
2. SCSS/CSS modules (component styles, mixins)
3. Shared utilities and base classes
4. Entities/service modules
5. Apps and controllers
6. Views/components
7. Templates (`*.hbs`) and final SCSS overrides

## Domain Context
- Core domain objects: Patients, Actions, Forms, Workflows, Teams, Organizations, Care Plans
- Integrations: Five9 dialer, Datadog instrumentation, Formio forms, FontAwesome icon package
- Feature flags manage rollouts; default behaviour must match production unless a flag flips it on

## SCSS & Handlebars Standards
- Use BEM (`.block`, `.block__element`, `.block__element--modifier`); `.js-*` classes are JS hooks only
- Keep selectors shallow (≤3 levels); prefer new blocks to deep nesting
- Template spacing: `{{ something }}`; logic helpers `{{#if}} ... {{else}} ... {{/if}}`
- Attribute order: class, id/name, src/for/type/href/value, title/alt, role/aria-*, boolean
- Use `{{ }}` for escaped output; reserve `{{{ }}}` for safe HTML injections

## Internationalization
- FormatJS key schema: `view.directory.fileViews.viewName.stringContext` (`HTML` suffix for HTML strings)
- Access strings via `@intl` helpers in templates and `intl` utilities in JS
- Use `dayjs` for dates/times instead of handcrafted formatting

## Common Patterns & Guardrails
- Define a `ui` hash; prefer `triggers`/`triggerMethod` over manual DOM queries and `events`
- Keep modules under ~300 lines; break helpers out and favor guard clauses for clarity
- Store state on Backbone models/collections; avoid arbitrary properties on views or controllers
- Route network requests through the entities service and reuse existing utilities before adding dependencies
- Keep feature flags easy to remove; isolate conditional logic and avoid leaking flag checks through the codebase

## Testing Expectations
- UI changes need/upkeep Cypress component specs in `cypress/component`; flow changes require e2e specs in `cypress/e2e`
- Leverage fixtures and mocks in `cypress/fixtures/` for determinism
- Run `npm run lint`, `npm run coverage:component`, and `npm run coverage:e2e` (or `npm run coverage`) before merging significant work

## Sensitive Areas
- Five9 SDK artifacts in `packages/care-ops-five9/**/sdk/**` are generated via `packages/care-ops-five9/update-sdk.js`; do not edit manually
- Release tooling under `release/` must preserve `npm run release` semantics (timestamped `release/YYYYMMDD` branches never merge back to `develop`)
- Formio and FontAwesome workspace packages expose public APIs—extend them through configuration instead of patching vendor code

## Helpful Commands
- `npm run dev` – launch the Vite dev server (default port 8081)
- `npm run test` – open the Cypress GUI with Vite in test mode
- `npm run coverage` – run component + e2e coverage suites and aggregate NYC reports
- `npm run stop` – terminate stray Vite processes and clear cached bundles

Use this checklist when prompting Copilot so suggestions align with current architecture, conventions, and tooling.
