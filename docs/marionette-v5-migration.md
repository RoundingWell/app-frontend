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
- Active step: replace the shared Droplist Toolkit Component and its subclasses
  with direct Marionette Views and View-owned selection/open/disabled behavior.
- The final routing target was changed by human direction: retain Backbone.Router
  rather than migrate to the browser Navigation API.
- Intermediate PRs keep GitHub Cypress deferred; the unchanged Cypress contract
  runs locally after the initial PR publication and before human merge.
- Next after human merge: continue replacing Toolkit Components with Marionette
  Views in bounded groups without adding a compatibility Component.

## Active-step validation

- The test-mode build passed.
- Component coverage passed: all 49 specs and 249 tests. Seven focused
  Droplist and descendant specs passed 25 tests while iterating; the final
  Droplist, Time, Duration, and Tooltip group passed 12 tests.
- ESLint passed. Full repository lint reached the same pre-existing
  editor-config failure because `ec-darwin-arm64*` was not found.
- The first full unchanged E2E run passed 270 of 308 tests and exposed shared
  Droplist regressions. A second full run passed 301 of 308. Targeted reruns now
  pass for programs, worklists, clinician navigation, workspace management,
  patient forms, and draft-status behavior.
- Two unchanged E2E cases remain deferred: schedule and patient-flow bulk-edit
  menus can be destroyed by a parent toolbar rerender immediately after they
  open. Toolkit left the detached menu/controller alive across that rerender;
  the direct View correctly owns and destroys its Picklist. Resolving the
  parent bulk-edit lifecycle is outside this Droplist conversion.

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
- The first Droplist conversion retained Toolkit's generic state bag on a
  direct View. Focused descendant tests exposed duplicate callbacks and option
  timing differences, and the shape still obscured the target contract. It was
  removed before publication: Droplist now owns explicit selected, open, and
  disabled values and emits View events, while a tag-entry query keeps its own
  purpose-specific Backbone model.
- Full E2E exposed three gaps that focused component coverage did not: derived
  Droplists still calling Toolkit `setState`, old nested disabled options at
  second-level consumers, and the name `isActive` colliding with clinician
  account status. The derived calls/options were removed and menu visibility is
  now the explicit `isOpen` property.
- Time and Duration defined domain-specific `getTemplate()` methods, so their
  bulk-edit instance templates needed to be handled explicitly after removing
  Toolkit's nested view options. The modal draft status had the same nested
  option gap and now passes direct View options.
- Mutable `isDisabled` shadowed the configured option returned by `getOption`
  in the workspace Droplist. The immutable configured value is now captured
  separately from the current DOM state.
- Draft status now owns pointer/focus events on its Marionette View and drives
  Tooltip manually. This removes its `$el` dependency and prevents old Tooltip
  listeners from recreating a tooltip while the draft menu is open.
- The remaining bulk-edit race showed that Toolkit's controller could outlive
  its destroyed child View, leaving a Picklist active after the parent toolbar
  rerendered. That behavior is not being copied into the v5 View migration.
