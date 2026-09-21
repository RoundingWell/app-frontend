# Marionette 5 migration log

## Target and baseline

- Current candidate: Marionette PRs #551 and #554 at combined commit
  `e5073543f28d8dcd237115f3b7ad7f4131a44a15`. This is unpublished code,
  packaged with upstream's `release:artifact` workflow and installed from
  `vendor/marionette/marionette-5.0.0-beta.5-e507354.tgz` (SHA-256
  `939a03a6d7fb14815b9f3a495334c0808baef7683b0532c4c725f0e5993994e8`).
- The candidate build produced all five workspace artifacts. Only core
  Marionette differs from the published beta.5 packages, so the tracked
  candidate replaces that package; the published beta.5 adapters, Radio, and
  utils packages remain exactly pinned. Replace the tarball dependency
  atomically when a published release contains both contracts.
- The PR implementations, tests, documentation, migration guidance, package
  metadata, and companion package artifacts were inspected before installation.
- Baseline: `npm ci` passed; 49 component specs and 248 tests passed; 35 E2E
  specs passed unchanged. ESLint and Stylelint passed; the local editor-config
  check could not find its downloaded macOS ARM binary.

## Current state

- Migration base: `feature/marionette-v5` at
  `f4435dc23ba1bc686b3126e479bd1a0113db0255`.
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
- Completed: PR #1792 migrated RouterApp's selected-child lifecycle and the
  Dashboard list/detail route tree together. Dashboard children are explicitly
  owned, asynchronous fetches use `prepareStart` and cancellation, list search is
  owned Backbone state, and Application-controlled layouts are composed before
  display. It was merged by a human.
- The shared list-search path now consumes native DOM events and elements exposed
  by beta.4 instead of relying on jQuery event and `$el` methods.
- Completed: PR #1793 migrated the Clinicians route tree, the second router to
  own v5 children. Its list and sidebar children are explicitly registered, the
  clinician collection loads through `prepareStart` with its readiness signal,
  search reuses `SubRouterApp`'s owned route state, and the sidebar app receives
  its Region at construction. The step also scopes each area router to its own
  content Region and removes the sidebar service's `setRegion` handoff, both of
  which only became observable once a second router owned v5 children. It was
  merged by a human.
- Completed: PR #1794 migrated the Programs route tree as one ownership boundary. The
  area, nested route apps, content app, and globally hosted sidebar apps use
  explicit child registration; asynchronous entity preparation receives the
  lifecycle signal; and the nested selected-child path uses Application start,
  stop, and cancellation semantics instead of the removed `startChildApp` API.
  It was merged by a human.
- The final routing target was changed by human direction: retain Backbone.Router
  rather than migrate to the browser Navigation API.
- Intermediate PRs keep GitHub Cypress deferred; the PR is published before
  running the unchanged Cypress contract locally and addressing regressions.
- Completed: PR #1795 migrated the Patients Schedule, Worklist, shared
  list-page, filters, bulk-edit, and sidebar ownership boundary.
- Completed: PR #1797 consumes the published beta.5 contract. Reusable route,
  patient-page, filter-sidebar, and global-sidebar Applications remain
  registered while start/stop controls activation. Routers and recreated
  layouts pass their current Region at start; loading roots are app-owned; and
  the beta.4 duplicate-Region and remove/re-add workarounds are removed. Static,
  no-argument children use `childApps`; dynamically imported, lazy, configured,
  and route-created children retain explicit registration.
- Completed: PR #1803 moved the patient Action/Form page subtree from removed
  Toolkit readiness, state helpers, named Application Regions, and
  `startChildApp` to candidate Application preparation, active-run state-event
  delivery, owned Backbone state, root View Regions, and explicit child
  activation. Existing E2E specifications remained unchanged.
- Completed: PR #1804 centralized RouterApp and SubRouterApp child selection.
  A previous child remains selected until teardown succeeds, only the latest
  route intent may activate a replacement, and failed or canceled startup does
  not abandon live descendants. It was merged by a human.
- Completed: PR #1805 moves the Patient Flow page and its Activity child from removed
  Toolkit readiness and child-control methods to Application preparation,
  app-owned loading roots, explicit reusable-child activation, and a dynamic
  bulk-edit child that is registered once and reactivated with updated state.
  Existing E2E specifications remain unchanged.
- Completed: PR #1806 migrates the standalone Formservice entry point from Toolkit
  `beforeStart` result spreading to Application preparation. Its entity requests
  receive the active run's cancellation signal, and its existing E2E contract
  remains unchanged. It was merged by a human.
- Active: PR #1807 removes the temporary jQuery DOM adapter and dependency now that the
  migrated views use Marionette's native DOM collections. Application-level
  browser listeners retain explicit ownership and cleanup, and Morphdom remains
  the renderer-specific DOM adapter.

## Validation

- PR #1807 installs without jQuery and passes the test-mode build, ESLint, and
  Stylelint. The full component run reaches the pre-existing component harness
  failure where constructing the global Application calls `getAppName` without
  an Application configuration; this blocks affected mounted specs before their
  assertions run. Review found that the initial dependency sweep omitted the
  Five9 and RingCentral workspace views and that the component harness did not
  await Application destruction between repeated mounts. The workspace views
  now use native roots and `ui` collections, while the harness serializes
  Application teardown before clearing or replacing its root. These were
  consumer-sweep and test-harness mistakes, not Marionette defects.
- The local E2E run reaches a pre-existing Worklist startup race where an
  initial `change:canEdit` handler reads a null `editableCollection`, after
  which later scenarios may be covered by the global error screen. The focused
  App Nav reproduction fails identically on PR #1806's clean head with the
  jQuery adapter still active. Formservice and Dashboard E2E scenarios pass on
  PR #1807 before that shared failure; existing E2E files remain unchanged.
- PR #1806 installs cleanly from the pinned lockfile, passes targeted ESLint and
  the test-mode build, and passes all 4 unchanged Formservice E2E tests. The
  action response lookup now completes within Application preparation, so the
  PDF message is sent only after the active startup run owns every result. The
  existing E2E only observes the request sequence; parent-message payload
  coverage remains deferred by human direction rather than adding a component
  test or changing the E2E acceptance contract in this step.
- At the PR #1804 migration base, a clean `npm ci` and test-mode build pass.
  The unchanged Patient Flow E2E spec runs 29 tests: 5 Action-page and error
  boundary tests pass, while 24 Flow-page tests fail before the Flow data
  requests because that page still uses the removed lifecycle contract. This
  is the baseline for the active Flow step, not a regression from its changes.
- After the Flow migration, the unchanged Patient Flow E2E spec has 27 passing
  tests. The two remaining failures expect route-action rejections to surface
  as browser `uncaught:exception` events, while PR #1804 intentionally observes
  them through `route:error`. Resolving that acceptance-contract conflict would
  require an E2E expectation change or reversing the merged routing policy, so
  Cypress remains deferred for human direction.
- Native delegated events run in declaration order. Registering a broad
  `.js-no-click` guard before the Flow card's attachment and comment handlers
  suppressed those specific actions; ordering the specific handlers first
  restores the unchanged route-switching E2E without a `closest()` workaround.
- The focused Tooltip component spec is blocked before mount by the existing
  component bootstrap harness calling `getAppName` without an Application.
  The unchanged Flow E2E covers the native `pointerover` tooltip path and now
  passes that scenario.

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
- The Clinicians route slice passes ESLint, Stylelint, the sidebar service
  component spec, and 8 of its 10 unchanged E2E assertions: `clinician-modal`
  1/1, `clinicians-all` 2/3, and `clinician-sidebar` 5/6. Both failures are the
  final navigation of their test into `PatientsApp`, which still uses the removed
  `childApps` hash; `worklist-loading` fails all 9 tests with that same
  `setCurrentRoute` error on the migration base, independent of this step. The
  unchanged `dashboards-all` E2E still passes 3/3, confirming the per-router
  Region change causes no regression. No E2E spec was changed.
- Focused InputWatcher coverage passes for a host textarea override and an
  input-less host. The existing Picklist component spec now mounts without the
  input watcher crashing; four tests pass and three keyboard transport/selection
  assertions remain as a later post-cutover migration boundary.
- The results below belong to the preceding Picklist step, before the runtime
  cutover.
- The test-mode build passed.
- Component coverage passed: all 49 specs and 248 tests, including focused
  coverage for Picklist, Optionlist, Droplist, and date-filter state behavior.
- The Programs route slice passes the test-mode build, the focused Sidebar
  Service and SubRouterApp component specs (19 tests), and all 7 unchanged
  Programs E2E specs (26 tests). Iteration exposed and corrected removed state
  and `$el` helpers, negative nested-control click filtering, owner/child
  restart coupling, sidebar stop/start races, and canceled-navigation alerts;
  card navigation now binds only to explicit route surfaces, with no
  compatibility wrapper or E2E change.
- After replacing jQuery-wrapped positioning inputs, the 6 affected component
  specs and all 18 tests passed for Optionlist, Datepicker, Tooltip, Droplist,
  date-filter, and the no-anchor DueView Datepicker path.
- Unchanged E2E coverage passed: 2 specs and 35 tests for patient quick-search
  and patient actions, including keyboard Picklist behavior and an Optionlist
  workflow.
- Targeted ESLint and Stylelint passed. Full repository lint reached the same
  pre-existing editor-config failure because `ec-darwin-arm64*` was not found.
- The Patients step builds successfully. Unchanged focused E2E currently passes
  Schedule 13/15, shared bulk edit 7/7, list filters 6/6, and worklist loading
  8/9. The Schedule patient-detail failure and worklist-loading failure both
  enter the not-yet-migrated Patient detail application. The remaining Schedule
  bulk-owner failure is still in scope for this step; tracing showed its owner
  scope mounts correctly, but the post-save interaction reaches a destroyed
  toolbar while collection refresh and child-app replacement overlap. This is
  currently classified as an app integration race, not a demonstrated
  Marionette defect. No E2E file is changed.

## Friction and corrected failures

- During the Patients step, calling `stopListening(undefined)` while the first
  collection was still absent removed every controller subscription. Guarding
  the collection-specific teardown restored filter, count, search, and layout
  behavior. This was an app misuse exposed by the new lifecycle, not a runtime
  defect.
- Tooltip construction during a host View's `onRender` exposed event-ordering
  friction: listening for the same host's `render` event immediately destroyed
  the newly created Tooltip. Binding cleanup to `before:render` preserves the
  intended owner lifecycle. The public lifecycle documentation did not make
  this same-dispatch consequence obvious, but no runtime defect is established.

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
- One shared content Region was handed to every area router. Because beta.4
  stops an Application asynchronously and clears its roots, an unmatched router's
  stop emptied whichever router was displayed, and the matched app found no root
  in `onStart`. This stayed invisible while Dashboard was the only router owning
  v5 children and appeared immediately with the second. Each router now owns a
  Region over the content element, so a stop clears only that router's own view.
- The sidebar service adopted a sidebar app's Region at start through v4's
  `setRegion`, which beta.4 does not expose. The service now publishes its Region
  and owners pass it at construction. Its component spec constructed the service
  the same way and was corrected with it.
- Review then caught that the service discarded both lifecycle Promises: its
  start could not be awaited, and its stop returned nothing while the app was
  still stopping, so a replacement sidebar could show before the outgoing one
  emptied the shared Region. The service now awaits the outgoing stop before
  adopting a new app, returns the app once started, and returns the stop
  Promise, which also makes `Radio.request('sidebar', 'stop')` deterministic.
  The one caller that read the former synchronous return now listens to the
  sidebar app it already holds.
- Review also caught that publishing the service's own Region gave every sidebar
  Application the same root owner, repeating the ownership race the AppFrame
  change removes. The service now builds an independent Region over the shared
  sidebar host element for each app, and its stop cleanup ignores an app that is
  no longer current.
- Awaiting the outgoing stop before recording the new app then moved the
  guard-to-assignment gap behind an await: two interleaved starts could both
  pass the guard and, with per-app Regions, attach two layouts to the host
  element. The service now claims the sidebar synchronously and drops a start
  that a later one has superseded. Focused coverage fails against the previous
  ordering.
- Review caught that the migrated `showCliniciansAll` returned its route start
  without the rejection handling the Dashboard migration applies. `routeAction`
  does not await the action, so a failed clinician fetch would have surfaced as
  an unhandled rejection with no error routing. It now routes to `unknownError`
  under the same route-context guard.
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
- Patients review found that replacing broad v4 `restart()` calls with targeted
  refreshes exposed app-owned cleanup that restart had performed implicitly:
  stale bulk editors, late collection-view events, concurrent patient-sidebar
  starts, and swallowed refresh failures. The fixes use beta.4 ownership,
  prepared roots, cancellation signals, and explicit app-level sequencing; no
  Marionette runtime defect was identified. The same review caught an agent
  mistake that replaced declared `ui` bindings with raw `querySelector` calls;
  the touched views now retain their Marionette `ui` contracts.
- Follow-up review caught two application integration mistakes: Schedule tried
  to repopulate its hidden bulk editor after clearing the selection, and the
  WebSocket service destructured an empty result after lifecycle cancellation.
  Both now preserve beta.4 cancellation and ownership semantics. Focused
  WebSocket coverage also exposed v4 assertions that treated the Application
  instance as start options and expected injected `state`; the assertions now
  verify beta.4's `(app, options, result)` contract and pass 20/20.
- The unchanged Schedule E2E spec currently passes 11/15. Remaining failures
  cover the known patient-detail `$el` path plus bulk-edit visibility, find-list
  refresh, and click-shift list setup; they remain migration work rather than
  test changes.
- The patient shell and workflow route now use beta.4 preparation, owned child
  Applications, detached initial composition, and cancellation-aware fetches.
  Route page Applications are created only when selected, so an unmigrated
  Action, Flow, or Form page cannot break the default workflow route during
  construction.
- Program action and flow collection services accepted a behavior argument but
  discarded fetch options. Their existing request contract now also forwards
  options so Application cancellation reaches the underlying Backbone fetch.
- Focused unchanged E2E currently passes 4/5 patient-shell cases, 7/9 workflow
  cases, and 9/10 patient-sidebar cases. The remaining patient alias and
  add-workflow failures enter the not-yet-migrated Action Application; the
  workflow tooltip assertion and sidebar `$el.prop` failure are separate
  existing integration gaps. Those belong to following route/component steps
  rather than an E2E rewrite.
- Cypress fixture generation is not concurrency-safe: three parallel focused
  runs wrote the same ignored JSON fixtures and produced trailing data. Running
  the specs serially regenerated valid fixtures; this was test tooling friction,
  not a Marionette or application failure.
- The #545/#546 candidate installed reproducibly with a clean `npm ci`; the
  test build and targeted ESLint pass. Focused SidebarService, RouterApp, and
  SubRouterApp component coverage passes 32/32, including replacement safety,
  recreated-shell Region rebinding, state preservation, route switching, and
  late-start cancellation.
- The full component sweep passes 45/50 specs (252 tests pass, 7 fail, 4 are
  pending). The five failing specs and all seven failures reproduce unchanged
  at the original PR head: Alert, Dialer, Tooltip, Picklist, and Team.
- Unchanged E2E passes 6/6 default-route cases, 9/9 worklist-loading cases, and
  8/8 focused Program cases. The workspace-switch case also passes. The
  candidate makes both app-owned worklist and patient-sidebar loading roots
  reachable; the original PR head failed those same two loading assertions.
- Patient workflow remains 7/9 and App Nav remains 16/20, matching the original
  PR head. The blockers are the not-yet-migrated Action/Form state contracts,
  an existing tooltip interaction failure, and existing nav viewport failures;
  no E2E file was changed for this candidate update.
- Initial candidate integration eagerly constructed every patient page and
  prevented default-route startup when unmigrated Action/Flow state contracts
  initialized. Registration is now lazy but one-time: selecting a page changes
  ownership once, while later route activation uses start/stop and the current
  layout Region. This was an application sequencing mistake, not evidence of a
  defect in PR #545 or #546.
- PR review caught three consumer cleanup gaps: SidebarService now awaits
  already-pending child stops, retained workflow/filter children do not stack
  listeners across restarts, and a failed patient-sidebar start clears its
  app-owned loading root before reporting the error. Suggestions to recreate
  the Program workflow child or restore per-router Region wrappers were not
  adopted: the candidate explicitly supports stopped-child Region rebinding
  and guarantees that stopping one borrower preserves another borrower's
  replacement in the shared host.
- PR #548 was based independently from the #545/#546 integration. Composing its
  four commits produced conflicts only in generated Application contract
  metadata and derived compact documentation. Regenerating those artifacts from
  the combined source preserved both contracts; the focused upstream
  Application suite passes 228/228, with lint, documentation checks, and the
  release-artifact build also passing. This was branch-integration friction,
  not a runtime defect.
- The combined #545/#546/#548 candidate installs reproducibly with `npm ci`.
  Targeted ESLint and the test-mode build pass. RouterApp, SubRouterApp,
  SidebarService, and WebSocket component coverage passes 54/54. Unchanged E2E
  passes default routes 6/6, worklist loading 9/9, and Programs 8/8. Patient
  workflow remains 7/9 and App Nav remains 16/20, matching the pre-#548 PR
  head. No E2E spec changed.
- PR review found one remaining Toolkit-style `childApps` descriptor that #548
  correctly rejected as a non-constructor. Form now declares the child class
  once and supplies its Region and context when starting it. Review also caught
  canceled WebSocket additions that could not retry, service shutdown that did
  not await an older replacement stop, and cleanup before filter state existed.
  These were consumer integration gaps, not Marionette defects. Targeted lint,
  the test build, and Sidebar/WebSocket component coverage pass 29/29. The
  unchanged patient workflow spec remains 7/9 and now reaches the next
  unmigrated Action state-event contract instead of failing child construction.
- Beta.5 published the previously vendored #545/#546/#548 contract from
  immutable upstream commit `14153fd03fd616fdb989e210a860409853d84733`.
  PR #1797 now consumes the exact npm release and aligned companion packages;
  the candidate tarball and file dependency were removed in the same change. A
  clean `npm ci`, resolved-package check, test build, and the four lifecycle
  component specs pass 56/56. Unchanged default-route and worklist-loading E2E
  pass 6/6 and 9/9; patient workflow remains at its known 7/9 boundary.
- The Action/Form step installs cleanly and its test-mode build and targeted
  ESLint pass against the exact candidate source revision. Its unchanged Action
  E2E spec passes 28/31, including
  embedded and standalone forms, expansion across stop/restart, attachments,
  comments, cancellation, and gone-action redirects. Two remaining failures
  construct the not-yet-migrated Five9 state source; the third constructs the
  not-yet-migrated Flow Application. These are the next ownership boundaries,
  not changes to the Action/Form acceptance contract.
- The unchanged patient Form E2E spec passes 9/11. Discard and reload now pass;
  the two remaining failures are the existing stored-submission tooltip and
  hidden-submit response-id boundaries. The focused deleted-form and
  unavailable-action error spec passes 2/2. The action-form spec reaches the
  correct deleted-action redirect, then its first scenario aborts because it
  does not stub the patient-workflow requests made by that redirect. No E2E
  specification was changed.
- Form initialization originally emitted state events before selecting its
  root. PR #551 moves this active-run boundary into Application `stateEvents`,
  so Form seeds state normally without silent Backbone updates or per-handler
  running guards; initial UI remains explicit in `onStart`. PR #554 gives a
  restart requested from completion callbacks its own cycle and options.
  Native boolean attributes omit `disabled` when false instead of rendering
  HTML's still-disabled `disabled="false"`.
- Initial review placed request invalidation, subscriptions, and Form-service
  removal in `onBeforeStop`. That contradicted the candidate's documented stop
  permission contract: a rejected stop leaves the Application running. This was
  an agent integration mistake, not a documentation gap. Active effects now
  remain intact through pending or rejected permission and clean up in `onStop`.
  FormsService is now a started child, so the parent awaits its successful stop
  and effect cleanup; the stopped per-run service is destroyed before the next
  run prepares. Form's layout listener is acquired only after startup succeeds,
  so failed startup does not leave a per-run listener behind.
- Review of #551's repo-wide `isRunning()` change exposed two consumer
  assumptions rather than a framework defect. Route dispatch now awaits the
  router and selected child Applications' idempotent `start()` calls; the newest
  route dispatches only after activation succeeds. WebSocket-managed additions
  remain ordinary run-owned requests rather than temporary child Applications:
  listeners and in-flight fetches survive pending or rejected stop permission,
  and successful stop removes the listener and aborts unfinished fetches. The
  exact-candidate RouterApp, SubRouterApp, and WebSocket component specs pass
  54/54, including both stop/route orderings, rejected stop permission, late
  fetch completion, and successful-stop cancellation.
- A first pass at retained bulk-edit children added controller-owned
  `_bulkEditStart` and `_bulkEditStop` promises. Beta.5 already arbitrates
  superseding starts and stops, so Flow, Schedule, and Worklist now register
  each bulk-edit child once, use start/stop only for activation, and reset its
  run-local state after a successful stop. The duplicate controller lifecycle
  state was an agent integration mistake, not a Marionette limitation.
- Follow-up review found two remaining consequences of retaining those
  children: a repeated selection during pending startup reused the first start
  options, and Schedule refresh hid the child without completing a stop. Each
  controller now updates the live collection before its idempotent start, while
  Schedule explicitly resets the suspended edit session while preserving the
  displayed toolbar root across a list refresh. Collection changes no longer
  clear `isSaving`, which keeps an in-flight save disabled until its owning
  operation completes.
