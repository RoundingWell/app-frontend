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
  `462cbf9fb832ac5d1c6863f2c04bd0a82ea9a5b7`.
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
- Completed: PR #1781 cut over to the exact beta.2 runtime with the Backbone
  data/state, jQuery DOM, and Morphdom DOM adapters; removed the v4 runtime,
  Toolkit, alias, and superseded custom DOM adapter; and applied the target
  Browserslist. It was merged by a human.
- Completed: PR #1782 migrated `SubRouterApp` route state and dispatch to
  beta.2's native Application lifecycle, Common API, and owned Backbone state.
  It was merged by a human.
- Active step: replace the remaining stateless Tooltip Component with a direct
  Marionette View and native root-element positioning.
- The final routing target was changed by human direction: retain Backbone.Router
  rather than migrate to the browser Navigation API.
- Intermediate PRs keep GitHub Cypress deferred; the unchanged Cypress contract
  runs locally before publication.
- Next after human merge: migrate the next remaining `js/base/component`
  consumer so the application and focused Cypress specs can build again.
  Route-driven child ownership follows when its per-route startup data moves
  with the same lifecycle change.

## Validation

- Runtime-cutover `npm ci` passed and the resolved top-level packages are
  `marionette@5.0.0-beta.2`, `@mnjs/adapters@5.0.0-beta.2`, and
  `morphdom@2.7.8`; Marionette 4 and Toolkit are absent.
- ESLint and Stylelint passed. Full repository lint reached the same
  pre-existing editor-config failure because `ec-darwin-arm64*` was not found.
- The test-mode build reaches application code and stops at
  `src/js/base/subrouterapp.js`: beta.2 does not export v4's private
  `normalizeMethods` helper. This is the first expected application migration
  gap, not a runtime defect. Cypress cannot run until the application builds.
- PR #1782 removes that private-helper dependency, stores the current
  route in owned Backbone state, uses the documented Application
  `normalizeMethods()` Common API, and uses v5 state persistence across stop
  and restart instead of `isRestarting()` branches.
- Targeted ESLint passes. The focused SubRouterApp component spec is blocked
  before loading by shared Cypress support imports of the deleted
  `js/base/component` path; this is an existing runtime-cutover boundary.
- The test-mode build now passes `SubRouterApp` and stops at that same deleted
  Toolkit Component import path.
- `SubRouterApp` temporarily retains its constructor-bound current-child stop
  listener because existing route children are not yet registered through v5
  Application ownership. Moving that binding to `initialize()` would let
  subclass initialization shadow it. The listener is removed when the next
  step makes the current child an explicitly owned Application, whose lifecycle
  Marionette stops automatically.
- A direct child-ownership step was considered immediately after PR #1782 and
  deferred. V5 owner restarts forward the parent's lifecycle options to owned
  children, while current route children still load from their own per-route
  start options. Converting ownership alone would restart children with the
  wrong patient, flow, form, or action inputs. Lifecycle data and ownership
  must move together rather than adding an options compatibility layer.
- Tooltip now compiles as a direct Marionette View. The test-mode build advances
  to the remaining Datepicker `js/base/component` import. The focused Tooltip
  component run executes zero Tooltip tests because shared Cypress support first
  imports the remaining Droplist and Datepicker Component paths; this is the
  same known module-graph boundary, not a Tooltip assertion failure.
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
- Tooltip had the same controller-to-View option collision. Its public trigger
  element and all callers now use `anchor`, allowing the direct View to retain
  Marionette's `ui` namespace. Tooltip keeps its explicit `CLASS_OPTIONS`
  promotion in its constructor so root-element options are available before
  View construction without consuming the subclass `preinitialize` or
  `initialize` extension points. Repeating this mistake on generic components
  exposed a missing repo guardrail; `AGENTS.md` now records the pattern.
- Review also caught a lifetime difference after collapsing Tooltip into its
  View: replacing one Tooltip in the shared region destroyed it and removed its
  anchor listeners. Tooltip now detaches a different incumbent before showing,
  keeping both instances reusable as the former controller did.
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
- The first `SubRouterApp` edit treated `normalizeMethods` as fully removed
  after its core named export failed. Beta.2's Common API documentation shows
  that it remains available as `this.normalizeMethods()` (and from
  `@mnjs/utils`). The PR was corrected to use the documented owner method
  instead of duplicating method-name resolution; the initial conclusion was an
  agent documentation-reading mistake, not a Marionette defect or gap.
