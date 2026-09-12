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
  `9c34844b634bba5fd9a450f3c3d6ff3d8b33b7af`.
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
- Active step: replace the shared Picklist and Optionlist Toolkit Components
  with direct Marionette CollectionViews and update their dependent Droplist
  and date-filter integrations.
- The final routing target was changed by human direction: retain Backbone.Router
  rather than migrate to the browser Navigation API.
- Intermediate PRs keep GitHub Cypress deferred; the unchanged Cypress contract
  runs locally before publication.
- Next after human merge: continue replacing Toolkit Components with Marionette
  Views in bounded groups without adding a compatibility Component.

## Active-step validation

- The test-mode build passed.
- Component coverage passed: all 49 specs and 248 tests, including focused
  coverage for Picklist, Optionlist, Droplist, and date-filter state behavior.
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
