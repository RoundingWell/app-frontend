# Apps

`apps/` is the feature root for routed and nested Marionette applications.
An app directory owns its orchestration, views, templates, local state, SCSS, and Cypress specs.

## Organization

- Keep UI-free `*-main_app.js` router/composition files at the domain root.
- Put each leaf app in a matching directory, such as `patients/worklist/` or `dashboards/dashboard/`.
- Put UI shared only within a domain under `apps/<domain>/shared/`.
- Put styles shared only within a domain under the same `apps/<domain>/shared/` owner.
- Put reusable cross-domain UI under `src/js/components/`.
- Keep data access under `src/js/entities-service/`; colocation does not change that boundary.
- UI owned exclusively by a service or auth module lives beside that owner rather than under `apps/`.

For cross-domain E2E flows, the primary entry route and behavior under assertion determine ownership.

## Testing

- Component specs use `*.component.cy.js`.
- E2E specs use `*.e2e.cy.js`.
- Both live beside the production code they exercise.
- Keep the `.cy.js` ending because ESLint test rules and NYC coverage exclusions depend on it.
- Fixtures, Cypress support, plugins, and reports remain under `test/`.

## Templates and security

Handlebars escapes `{{ value }}` by default. Treat API data as hostile and use `{{{ value }}}`
only for trusted HTML. If HTML from data must be rendered, escape untrusted values before display.
Prefer placing static markup and character codes in templates instead of template helpers.

Keep Handlebars spacing and template attribute order consistent with `/AGENTS.md`.
Store `.hbs` files beside the view that imports them. Vite precompiles them into the built JavaScript.

Inline templates may use `handlebars-inline-precompile`:

```js
import hbs from 'handlebars-inline-precompile';

const ExampleView = View.extend({
  template: hbs`Show some {{ value }}`,
});
```

JavaScript interpolation such as `${ value }` is not available inside the `hbs` template tag.

## SCSS

Import SCSS from the module that renders the associated view:

- Shared SCSS modules follow third-party imports.
- Templates and view-local SCSS are imported last.
- Keep view-local styles in the same app directory as the view and template.
- Move styles to `src/scss/domain/` or `src/scss/modules/` only when they are intentionally reused.

Use BEM naming, keep selectors shallow, and never style `.js-*` hooks.
