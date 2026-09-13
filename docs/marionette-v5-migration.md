# Marionette 5 migration log

## Target and baseline

- Target: `marionette@5.0.0-beta.2`; published source revision
  `13f4954c352e646c413091ffdd83f6da59404573`.
- Pre-install package inspection completed before target dependency installation.
- Baseline: `npm ci` passed; 49 component specs and 248 tests passed; 35 E2E
  specs passed unchanged. ESLint and Stylelint passed; the local editor-config
  check could not find its downloaded macOS ARM binary.

## Current state

- Migration base: `feature/marionette-v5` at
  `cb3019a97697c5ef196965013422862424e9e546`.
- Completed: PR #1771 replaced `backbone.eventrouter` with a local
  Backbone.Router adapter and was merged by a human.
- Completed: PR #1772 replaced Marionette 4's implicit Region child conversion
  with explicit View instances and was merged by a human.
- Completed: PR #1773 replaced the list-search Toolkit Component with a
  Marionette View that emits query changes directly and was merged by a human.
- Completed: PR #1774 replaced the shared patient-selection Toolkit Component
  with a direct Marionette View and was merged by a human.
- Completed: PR #1775 replaced the patient action dialer Toolkit Component with
  a direct Marionette View and was merged by a human.
- Completed: PR #1776 replaced the shared due-date Toolkit Component with a
  direct Marionette View and was merged by a human.
- Completed: PR #1777 removed both Toolkit `mixinState` integrations from
  clinician and patient modals and was merged by a human.
- Completed: PR #1778 replaced the patient quick-search Toolkit Component with
  its direct Marionette View while retaining its Backbone state model and was
  merged by a human.
- Completed: PR #1779 replaced the shared Picklist and Optionlist Toolkit
  Components with direct Marionette CollectionViews and was merged by a human.
- Closed: PR #1780 converted Droplist with mutable View fields. A branch-wide
  state assessment found that this repeated the wrong pre-v5 pattern, so it was
  closed without merge.
- Active step: cut over to the exact beta.2 runtime with the Backbone data/state,
  jQuery DOM, and Morphdom DOM adapters; remove the v4 runtime, Toolkit, alias,
  and superseded custom DOM adapter; and apply the target Browserslist.
- The final routing target was changed by human direction: retain Backbone.Router
  rather than migrate to the browser Navigation API.
- Intermediate PRs keep GitHub Cypress deferred; the unchanged Cypress contract
  runs locally before publication.
- Next after human merge: migrate application and View owners directly onto the
  available v5 lifecycle and state APIs. Intermediate runtime failures are
  expected and recorded rather than hidden behind compatibility implementations.

## Active-step validation

- Runtime-cutover `npm ci` passed and the resolved top-level packages are
  `marionette@5.0.0-beta.2`, `@mnjs/adapters@5.0.0-beta.2`, and
  `morphdom@2.7.8`; Marionette 4 and Toolkit are absent.
- ESLint and Stylelint passed. Full repository lint reached the same
  pre-existing editor-config failure because `ec-darwin-arm64*` was not found.
- The test-mode build reaches application code and stops at
  `src/js/base/subrouterapp.js`: beta.2 does not export v4's private
  `normalizeMethods` helper. This is the first expected application migration
  gap, not a runtime defect. Cypress cannot run until the application builds.
- The results below belong to the preceding Picklist step, before the runtime
  cutover.
- The test-mode build passed.
- Component coverage passed: all 49 specs and 248 tests, including focused
  coverage for Picklist, Optionlist, Droplist, and date-filter state behavior.
- After replacing jQuery-wrapped positioning inputs, the 6 affected component
  specs and all 18 tests passed for Optionlist, Datepicker, Tooltip, Droplist,
  date-filter, and the no-anchor DueView Datepicker path.
- Unchanged E2E coverage passed: 2 specs and 35 tests for patient quick-search
  and patient actions, including keyboard Picklist behavior and an Optionlist
  workflow.
- Targeted ESLint and Stylelint passed. Full repository lint reached the same
  pre-existing editor-config failure because `ec-darwin-arm64*` was not found.

## Friction and corrected failures

- Closed PR #1770 copied toolkit lifecycle behavior locally. That recreated
  Marionette 4 patterns and was abandoned before merge.
- A native Navigation API implementation was completed locally, then stashed as
  `native Navigation API routing experiment` when the routing target changed.
- The first local EventRouter constructor used object-method syntax. Backbone's
  `extend` adopts that value as the subclass constructor, but native object
  methods are not constructable. Changing it to a function-valued constructor
  restored the established Backbone extension contract.
- The first modal-state replacement rendered again for deeply equal repeated
  errors and moved focus back to the first input, unlike Backbone.Model state,
  which de-duplicated the same errors. Review caught this and both modals now
  preserve the equality guard.
- The first direct Optionlist retained `ui` as the external anchor option. A
  direct Marionette View owns `ui`, so positioning received the View's bound UI
  object instead of the anchor element. The canonical option and all callers
  now use `anchor`.
- Collapsing the Picklist controller and View made its public `select` event
  collide with the keyboard behavior's internal `onSelect` handler. The
  internal keyboard event is now `transport:select`; public selection remains
  `select`. Both were app integration mistakes found by component tests, not an
  identified Marionette runtime defect.
- Review found that Optionlist anchors still used v4's `$el`. Beta.2 does not
  create `$el`, so the shared bounds contract and all affected callers now use
  native DOM elements. Position remains viewport bounds plus scroll offset,
  while size remains the untransformed layout box. The documented temporary
  jQuery wrapper was unnecessary.
- The audit prompted by PR #1780 found the same sequencing error in earlier
  stateful conversions: list search, check, due date, modal errors, patient
  search, and Picklist replaced Toolkit state with mutable View fields, mutated
  options, or UI state passed as `model`. These are not the beta.2 owner-state
  contract. The routing, explicit Region-View ownership, and stateless dialer
  steps do not share this problem.
- Further stateful conversion under Marionette 4 was stopped. Beta.2 already
  owns Application lifecycle, child Applications, state, root Region/View, and
  cancellation; the migration will use those APIs rather than recreate Toolkit
  `App`, state, running-event, or View-event mixins locally.
