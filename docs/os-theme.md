# Experimental OS theme

Based on PR1847 at `3d69acab8d91784909e2cf3054f4041e655fb9f6`.

The browser owns the theme. `index.html` loads `core/_tokens.scss` as a blocking
stylesheet before configuration, authentication, and application JavaScript.
`color-scheme: light dark` enables native control and scrollbar theming. One
`prefers-color-scheme: dark` query changes semantic tokens automatically, including
live OS changes. There is no theme state, toggle, storage, or extra stylesheet.

The configured Browserslist currently includes Chrome 112. It supports the chosen
media query, custom properties, `color-scheme`, `:where()` and the app's existing
`color-mix()` usage, but not `light-dark()`. Using the media query avoids a second
fallback architecture. Browser targets and dependencies are unchanged.

Owned styles consume semantic surface, text, border, interaction and state tokens.
Solid actions use separate backgrounds paired with `--color-on-solid`; semantic
state text becomes lighter in dark mode without making filled buttons too bright.
Telephony wrappers pair a branded header background with its own foreground role; dark call states reuse the
contrasting solid-action fills.
The existing dark navigation, preloader, error artwork and vendor brand colors
remain intentional. Dark navigation avoids compounded text opacity. Existing
light token values, selectors, layout measurements and button sizes are preserved.
The prelogin card gains a viewport maximum width. Keyboard focus gets a shared,
low-specificity outline because the reset removes native outlines.

The component harness imports the same token module explicitly; production loads
it through HTML, so it does not depend on JavaScript starting. Component owners
continue to import their own styles. No theme selectors or mixin copies are added.

## Verification

- `npm run lint` (the cloud image needs `EC_VERSION=v3.6.0` because the npm wrapper
  cannot locate the renamed binary in the latest upstream checker release).
- `npm run build` and `npm run coverage` for production build and both test suites.
- `os-theme.e2e.cy.js` exercises early HTML, OS changes in both directions, app
  startup, desktop/mobile dialogs and preservation of entered text and focus.
  The focused test uses Chromium's media emulation through CDP; its browser
  configuration keeps Firefox nightly runs from invoking unsupported CDP calls.
- Review synthetic-data captures at 1440×960 and 390×844 in both schemes. Inspect
  worklists, schedule, patient workflow/interactions/sidebar, programs, clinician
  dialogs and menus, empty/error states, prelogin and the initial preloader.
- Check rendered text contrast and token pair contrast. Existing light-mode
  contrast issues are outside this appearance-preserving experiment.

Hosted WorkOS pages, embedded form renderer documents, analytics dashboards and
telephony vendor iframe contents are separate applications; their own theme
support is not controlled by these styles. The owning app surfaces and telephony
wrappers are themed. No live patient data or production services are needed for
verification. No deployment, PR or merge is part of this experiment.
