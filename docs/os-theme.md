# Experimental OS theme

Based on PR1847 at `3d69acab8d91784909e2cf3054f4041e655fb9f6`.

The experiment defaults to dark regardless of the OS. `index.html` selects
`data-theme="dark"` and declares a dark native color scheme before loading
`core/_tokens.scss` as a blocking stylesheet. The same root attribute selects
the dark tokens before configuration, authentication, and application JavaScript.
There is no toggle, persistence, theme JavaScript, or extra stylesheet. The base
light token definitions remain available when the root dark attribute is removed.

The configured Browserslist includes Chrome 112. Custom properties, `color-scheme`
and `:where()` work without `light-dark()`. Dark scrollbars use `scrollbar-color`
and a guarded WebKit fallback for older Chrome, without authored widths. Forced
colors keep system scrollbar rendering. Browser targets and dependencies are unchanged.

Owned styles consume semantic surface, text, border, interaction and state tokens.
Solid actions use separate backgrounds paired with `--color-on-solid`; semantic
state text becomes lighter in dark mode without making filled buttons too bright.
Telephony wrappers pair a branded header background with its own foreground role; dark call states reuse the
contrasting solid-action fills.
The existing dark navigation, preloader, error artwork and vendor brand colors
remain intentional. Dark navigation avoids compounded text opacity. Existing
light token values, selectors, layout measurements and button sizes are preserved.
The prelogin card gains a viewport maximum width. Keyboard focus gets a shared,
low-specificity outline because the reset removes native outlines. Dark focus uses
a quieter semantic ring; the borderless patient search field uses an underline,
with a system outline in forced colors. Skeleton colors have dedicated tokens:
light aliases retain their original colors, while dark shimmer uses nearby shades.
Animation durations, reveal delays and reduced-motion handling are preserved.

The component harness imports the same token module explicitly; production loads
it through HTML, so it does not depend on JavaScript starting. Component owners
continue to import their own styles. The root theme selector stays in the token layer, with a scoped search focus treatment.

## Verification

- `npm run lint` (the cloud image needs `EC_VERSION=v3.6.0` because the npm wrapper
  cannot locate the renamed binary in the latest upstream checker release).
- `npm run build` and `npm run coverage` for production build and both test suites.
- `os-theme.e2e.cy.js` exercises dark early HTML under a light OS, OS changes in both directions, app
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
verification. Deploy this experiment only to the explicitly requested development environment.
