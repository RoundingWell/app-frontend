# Marionette 5 migration log

## Target and baseline

- Target: `marionette@5.0.0-beta.4`; published source revision
  `f4165f14198da115cc998c842fbf4b6a4886fe45`.
- Beta.4 release notes, migration guidance, package metadata, and companion
  versions were inspected before installation.
- Baseline: `npm ci` passed; 49 component specs and 248 tests passed; 35 E2E
  specs passed unchanged. ESLint and Stylelint passed; the local editor-config
  check could not find its downloaded macOS ARM binary.

## Current state

- Migration base: `feature/marionette-v5` at
  `73e95e3c9ee287819e4008c0d11572f945dd061f`.
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
- Completed: PR #1783 replaced the Tooltip Component with a direct Marionette
  View and native root-element positioning. It was merged by a human.
- Completed: PR #1784 replaced the Datepicker Component and its inner layout
  with one Marionette View that owns its Backbone state and child Regions. It
  was merged by a human.
- Completed: PR #1785 replaced Droplist and its wrapper View with one
  Marionette View that owns its Backbone state, converted its subclasses to
  direct View options and native DOM, and removed the Toolkit `viewOptions`
  and state-helper contracts. It was merged by a human.
- Completed: PR #1786 replaced Dateselect and its inner layout with one
  Marionette View that owns its Backbone state and current selection Region.
  It was merged by a human.
- Completed: PR #1787 replaced the date-filter Component and controller wrapper
  with one Marionette View that owns its Backbone state and label Region. It
  was merged by a human.
- Completed: PR #1788 backported the prepared-root Application contract from Marionette
  PR #516 at its merged head
  `1833f9223fd934b9e0c0eff6e98cd76bd6f794f2` through the single
  version-pinned `marionette+5.0.0-beta.2` package patch. The global Application
  now selects and composes its root while detached, then displays the complete
  tree from `onStart()` through its replacing root Region. It was merged by a
  human.
- Completed: PR #1789 moved the app to the published beta.4 runtime, the single
  Marionette Radio registry, and explicit root, bootstrap, AppFrame, Nav, Search,
  and area-router ownership. It removed the temporary package patch and was
  merged by a human.
- Active step: migrate RouterApp's selected-child lifecycle and the Dashboard
  list/detail route tree together. Dashboard children are explicitly owned,
  asynchronous fetches use `prepareStart` and cancellation, list search is owned
  Backbone state, and Application-controlled layouts are composed before display.
- The shared list-search path now consumes native DOM events and elements exposed
  by beta.4 instead of relying on jQuery event and `$el` methods.
- The final routing target was changed by human direction: retain Backbone.Router
  rather than migrate to the browser Navigation API.
- Intermediate PRs keep GitHub Cypress deferred; the PR is published before
  running the unchanged Cypress contract locally and addressing regressions.
- Next after human merge: migrate the next smallest area RouterApp's route-driven
  child ownership together with its per-route startup data.

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
- Datepicker now compiles as one Marionette View with owned Backbone state and
  child Regions. The test-mode build advances to the remaining Droplist
  `js/base/component` import. Its focused component spec is blocked before the
  Datepicker tests load because shared Cypress support imports the remaining
  Droplist and Dateselect Component paths.
- Droplist and its direct and indirect subclasses pass targeted ESLint as
  direct Marionette Views with owned Backbone state. The test-mode build now
  advances to Dateselect's remaining `js/base/component` import; that is the
  expected next migration boundary. The focused Droplist component run is also
  blocked before loading its tests by that Dateselect import from shared
  Cypress support; Cypress reports one generated support-load failure and zero
  Droplist assertions.
- Dateselect now compiles as one Marionette View with owned Backbone state and
  a Region-owned year, month, or day Droplist. The test-mode build advances to
  the date-filter component's remaining `js/base/component` import.
- The focused Dateselect component spec passes both tests. Exercising its
  Droplist also required converting the shared top-region positioning path and
  behavior from removed `$el` access to beta.2's native `el`; no compatibility
  wrapper was added.
- Date-filter now compiles as one Marionette View with owned Backbone state,
  and the complete test-mode build passes. Its focused component spec passes
  all 4 tests, including navigation through the View's state and construction
  of the calendar picker with its owning UI View.
- The full component run executes all 49 specs: 182 of 250 tests pass, 64 fail,
  and 4 are skipped across 17 failing specs. The focused date-filter spec is
  green; the failures remain in unmigrated services and shared components.
- PR #1788 carries only PR #516's Application runtime and declaration changes
  into the installed beta.2 package. It does not feature-detect or copy other
  post-beta.2 changes. Focused contract coverage verifies detached composition,
  whole-tree attachment, isolated header replacement that preserves content
  identity/input/focus, preparing a replacement without disturbing the displayed
  tree, never-displayed cleanup, direct destruction and host detachment, and
  Region ownership after display. Without a pending prepared View, `getView()`
  now reflects the host Region's current View. A clean `npm ci` applied the
  pinned patch, the test-mode build passed, and the focused Application component
  spec passed all 7 tests.
- The global `RootView` is now a fresh detached `#root.app-root` tree. The
  Application selects it in `onBeforeStart`, and its replacing Region displays
  it at the start of `onStart`. The unchanged worklist E2E executed all 40 tests
  and failed at the same next boundary: `onStart` still receives none of the
  values that the removed Toolkit `beforeStart()` pipeline returned. No E2E
  spec was changed.
- The initial global readiness revision was authored on beta.2. The amended
  revision uses beta.4, and the root Application now owns and explicitly starts
  the bootstrap Application. Both revisions load dependencies only while their
  readiness signals remain current, and the browser entry point handles a
  rejected `start()` through the existing visible failure path. Bootstrap entity
  fetches receive the lifecycle signal through the existing fetch options
  contract. Loaded Models, Collections, and modules remain direct dependencies;
  they are not nested inside a second observable state source.
- Beta.4 publishes the prepared-root, explicit-child-activation, and preparation
  contracts used by this step.
  The active step removes the superseded beta.2 prepared-root patch, aligns
  Marionette and `@mnjs/adapters` at beta.4, removes `backbone.radio`, and
  converts all application, test, and workspace-package imports to the one
  Marionette Radio singleton. No package patch or postinstall hook remains.
  Whitespace-batched Marionette events and iframe reply cleanup were split or
  converted to map form for beta.3's literal names.
- A clean beta.3 `npm ci`, ESLint, and test-mode build passed before the beta.4
  package replacement. The full component
  run executes all 50 specs: 216 of 258 tests pass, 38 fail, and 4 are skipped
  across 10 failing specs. A detached worktree at the exact pre-beta.3 PR head
  ran those same 10 specs and produced the same 38 failures and 4 skips, so the
  beta.3 amendment adds no component regression. The failures remain the known
  child-Application, shared input, Team, and Tooltip migration boundaries.
- The unchanged worklist E2E spec executes all 40 tests and fails all 40 before
  the expected workspace-clinician request. This is the same known AppFrame/Nav
  startup boundary recorded before the beta.3 amendment; no E2E test changed.
- The AppFrame/Nav commit passes targeted ESLint, the test-mode build, and both
  Nav state component tests. The unchanged default-route E2E now passes all four
  account/setup cases and reaches the route-driven page boundary; its two
  worklist cases fail because no patient list is started. No E2E test changed.
- After replacing the package patch with published beta.4, a clean `npm ci`,
  ESLint, the test-mode build, and both Nav state component tests pass. The
  unchanged default-route E2E has the same result: four account/setup cases pass
  and two worklist cases stop at the known route-driven patient-list boundary.
- The beta.3 package patch and `patch-package` install hook were removed
  atomically when beta.4 published the preparation contract. The inspected
  beta.4 package reports source revision
  `f4165f14198da115cc998c842fbf4b6a4886fe45` and content SHA-256
  `f4a73b9e5421b5388f5e41868deb51ae2d3c0da800d10e417fa97238bae5762d`.
- The Dashboard route slice passes targeted ESLint, the RouterApp component spec
  (12 tests), the test-mode build, and both unchanged Dashboard E2E specs (7
  tests). The first E2E run exposed two migration gaps: AppFrame treated
  `isRunning()` as synchronous route-match evidence while beta.4 preparation was
  pending, and the shared list-search path expected jQuery event/UI wrappers.
  Route context now supplies the match signal and the shared input path uses the
  native event and DOM contracts.
- Focused InputWatcher coverage passes for a host textarea override and an
  input-less host. The existing Picklist component spec now mounts without the
  input watcher crashing; four tests pass and three keyboard transport/selection
  assertions remain as a later post-cutover migration boundary.
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

- PR #516 is not present in beta.2. A public Application subclass can add the
  visible methods, but cannot place prepared-root cleanup inside beta.2's
  existing stop/restart/destroy commit points without reordering lifecycle
  notifications. The temporary package patch was therefore built from the
  beta.2 source with only the merged #516 Application and declaration diffs
  applied. The final PR revision removed separate post-display Application
  ownership: preparation preserves the displayed View until Region handoff,
  after which the Region is the sole owner.
- Beta.3 still permits an already-running child to be registered synchronously
  from `onStop` after descendant draining. A published-package reproduction
  shows `await owner.stop()` resolving `true` while that newly owned child stays
  running, contrary to the documented stopped-hierarchy invariant. The app does
  not use this pattern; no local workaround was added. Upstream should reject
  ownership adoption during stop completion or drain registrations before the
  stop operation settles, with stop and restart regression coverage.
- Before beta.4, Marionette PR #533's documented
  contract leaves rejected Promises returned by synchronous lifecycle
  notifications to the host and skips an owner's `prepareStop` when that owner
  is already stopped but still has active descendants. This migration step uses
  neither pattern and adds no local divergence from the published implementation.
- A bounded Claude sequencing challenge recommended testing whether explicit
  child ownership could be migrated under beta.2 before deciding between a
  larger beta.3 PR and a revert. Published beta.2 does support instance
  ownership, but an exact-head comparison showed beta.3 did not add any of the
  current component failures. The PR therefore retained the atomic Radio and
  runtime cutovers; beta.4 now replaces the patched beta.3 package while
  leaving route-child ownership as the next coherent migration boundary.
- Closed PR #1770 copied toolkit lifecycle behavior locally. That recreated
  Marionette 4 patterns and was abandoned before merge.
- Beta.3's packaged consumer skill pointed to `marionette/scripts/docs.mjs`
  while publishing the helper under `dist/agent-skill`. Beta.4 documents the
  published helper path correctly, resolving that tooling friction.
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
- The first direct Datepicker conversion manually listened to each new Region
  child on every state-driven render. Review caught that the destroyed children
  would remain retained by the parent. Datepicker now uses `childViewEvents`, so
  Marionette owns those subscriptions and releases them with Region ownership.
- Date-filter review caught that its nested Datepicker no longer received the
  required owning `uiView` after its Toolkit wrapper was removed. The direct
  View now passes itself explicitly, and focused coverage constructs the
  calendar branch.
- Droplist's Toolkit wrapper allowed callers to inject an arbitrary nested
  `viewOptions` object. Direct View conversion exposed several bulk-edit
  consumers of that hidden contract. They now use explicit local subclasses
  for the distinct button presentations, rather than preserving an option
  channel that bypasses the View class contract.
- Review caught that a View does not receive Toolkit's component-level `show`
  event. Droplist's initial-open behavior now binds to `attach`, and the
  workspace-disabled and draft-tooltip hooks use `onAttach`.
- Review also caught early state creation from a dynamic root `className()`.
  Droplist state creation now reads the constructor-promoted `stateOptions`
  directly, and time-control classes synchronize after state initialization
  instead of reading state while the root element is being created.
- Droplist selection data is supplied to Handlebars through `serializeData()`.
  Assigning it to `this.model` would overwrite domain models used by subclasses
  such as the form draft-status control.
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
- Dateselect's first focused run reached the shared pop Region and failed before
  its assertions because both the app-frame positioning views and top-region
  behavior still expected v4 `$el`. Converting those direct DOM operations to
  `el`, `classList`, element dimensions, and element styles exposed one final
  Picklist `$el.text()` call; replacing it with `el.textContent` made the
  focused behavior pass. These were application integration gaps, not a
  Marionette runtime defect.
- The first `SubRouterApp` edit treated `normalizeMethods` as fully removed
  after its core named export failed. Beta.2's Common API documentation shows
  that it remains available as `this.normalizeMethods()` (and from
  `@mnjs/utils`). The PR was corrected to use the documented owner method
  instead of duplicating method-name resolution; the initial conclusion was an
  agent documentation-reading mistake, not a Marionette defect or gap.
- The first root-Application edit passed `document.body` directly as the
  `region` option. Beta.2 accepts a selector, Region class, definition object,
  or existing Region; a native element belongs under `{ el }`. The resulting
  `MN0004` was an agent integration mistake, corrected to the documented Region
  definition without adding an adapter.
