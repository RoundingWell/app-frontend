# Router migration: Backbone.history → @mnjs/router

Branch: `feature/mnjs-router` (off `develop`). Package contract:
[`packages/router/DESIGN.md`](../packages/router/DESIGN.md). This document is the
application plan, the source of truth for every phase, and the brief for every agent.
When reality contradicts it, update this file in the same commit.

## Decisions

| # | Decision |
| --- | --- |
| D1 | `Radio.trigger('event-router', name, ...args)` stays the primary fire-and-forget navigation API, as a navigation request only. A `router` request channel is added for results: `navigate` (returns the navigation promise) and `back` in Phase 2; `url` arrives with its first caller (Phase 3d); `current` was cut in Phase 3b because no converted caller needed it, and every line needs an E2E-reachable caller. |
| D2 | Aliases are a first-class, reusable router feature with an `until` date. The three patient aliases stay until 2027-09-02, default policy `canonicalize` (URL is replaced with the canonical URL). A spec fails once any alias is past `until`. Legacy flow URLs use async `redirect`. |
| D3 | `notFound` and `unknownError` render at the current URL. No `/404` or `/unknown-error` pushes. |
| D4 | The intercept handler awaits activation, so `navigation.transition.finished` / `router.navigate().finished` mean the page is ready. |
| D5 | The worklist clinician selection is a query parameter (`?clinicianId=`), shareable and reload-safe. |
| D6 | Route names keep the current event strings (`patient:flow:action`, `programs:all`, …). |
| D7 | Navigation API only, behind the driver seam; manual focus/scroll, policy owned by the app. |

## Current system (develop at 7f191c52e)

- `src/js/base/event-router.js` — Backbone.Router ↔ Radio `event-router` bridge; mutates
  `Backbone.history.handlers`.
- `src/js/base/routerapp.js`, `subrouterapp.js`, `route-base-app.js` — see
  `src/js/base/routing.md`.
- `src/js/app.js` — `Backbone.history.start({ pushState: true })` on AppFrame
  `before:start`.
- `src/js/apps/globals/app-frame/workspace_app.js` — recreates area RouterApps per
  workspace, then `Backbone.history.loadUrl()`; triggers `notFound` if nothing matched.
- `src/js/apps/globals/nav/nav_app.js` — root and `workspace:<slug>` routes,
  `defer(replaceUrl(default))`, `'default'` event handling.
- `src/js/apps/globals/error/error_app.js` — `notFound` (`/404`), `unknownError`
  (`/unknown-error`), `*unknown` catch-all.
- `src/js/services/history.js` — patches `Backbone.history.navigate`; `go:back`;
  `change:route` (root view empties pop/modal regions on it).
- `src/js/services/latest-list.js` — stores list event + args for "Back to list".
- `src/js/formservice.js` — separate entry using a plain `Backbone.Router`.
- `test/support/commands.js` — `cy.navigate` calls `Backbone.history.navigate`.

Known defects to remove, not preserve:

- Route priority depends on construction order (ErrorApp first, Nav before areas).
- Areas deactivate via `noMatch` broadcast on every Radio event.
- Workspace switch relies on `defer(replaceUrl)` finishing before the workspace fetch.
- Backbone appends the query string (or `null`) as a trailing positional argument
  (FE-216 patched one symptom).
- HistoryService guesses back vs. new entry from `popstate`.
- `program/:id/action/:id` duplicates a parameter name (invalid in URLPattern).

### Route inventory

Non-root routes are prefixed with the workspace slug today.

| Name | Path(s) | Owner today | Notes |
| --- | --- | --- | --- |
| `root` | `` (root) | NavApp | → default `/:slug/worklist/owned-by` |
| `workspace:<slug>` | `<slug>`, `<slug>/*route` (root) | NavApp | switches workspace |
| `notFound` | `404` (root) | ErrorApp | D3: in place |
| `unknownError` | `unknown-error` (root), status arg | ErrorApp | D3: in place |
| `worklist` | `worklist/:id` | PatientsMainApp | `meta.isList`; extra `{ clinicianId }` arg → D5 |
| `schedule` | `schedule` | PatientsMainApp | `meta.isList` |
| `patient:workflow` | `patient/:patientId/workflow`; alias `patient/dashboard/:patientId` | PatientApp | alias until 2027-09-02 |
| `patient:workflow:closed` | `patient/:patientId/workflow/closed`; alias `patient/archive/:patientId` | PatientApp | alias until 2027-09-02 |
| `patient:interactions` | `patient/:patientId/interactions` | PatientApp | merged from `develop`; covered by `interactions.e2e.cy.js` |
| `patient:interaction` | `patient/:patientId/interactions/:interactionId` | PatientApp | same |
| `patient:action` | `patient/:patientId/action/:actionId`; alias `patient/archive/:patientId/action/:actionId` | PatientApp | extra `entryTarget` arg → `info` |
| `patient:flow` | `patient/:patientId/flow/:flowId` | PatientApp | |
| `patient:flow:focus` | `patient/:patientId/flow/:flowId/focus/:actionId` | PatientApp | opens the flow and focuses the action (see `routing.md`) |
| `patient:flow:action` | `patient/:patientId/flow/:flowId/action/:actionId` | PatientApp | extra `entryTarget` arg → `info` |
| `patient:form` | `patient/:patientId/form/:formId` | PatientApp | |
| `legacy:patient:flow` | `flow/:flowId`, `flow/:flowId/details` | PatientsMainApp | async redirect → `patient:flow` |
| `legacy:patient:flow:action` | `flow/:flowId/action/:actionId` | PatientsMainApp | async redirect → `patient:flow:action` |
| `programs:all` | `programs` | ProgramsMainApp | `meta.isList` |
| `program:details` | `program/:id` | ProgramApp | rename `:programId` |
| `program:action` | `program/:id/action/:id` | ProgramApp | rename `:programId/:actionId` |
| `program:action:new` | `program/:id/action` | ProgramApp | |
| `programFlow:new` | `program/:id/flow` | ProgramApp | |
| `programFlow` | `program-flow/:id` | ProgramFlowApp | rename `:flowId` |
| `programFlow:action` | `program-flow/:id/action/:id` | ProgramFlowApp | rename `:flowId/:actionId` |
| `programFlow:action:new` | `program-flow/:id/action` | ProgramFlowApp | |
| `dashboards:all` | `dashboards` | DashboardsMainApp | `meta.isList` |
| `dashboard` | `dashboards/:id` | DashboardsMainApp | |
| `clinicians:all` | `clinicians` | CliniciansAllApp | `meta.isList` |
| `clinician` | `clinicians/:id` | CliniciansAllApp | |
| formservice | `formservice/action/:actionId`, `formservice/:formId/:patientId(/:responseId)` | formservice.js | separate entry |

Non-route Radio names on `event-router`: `default` (go to default route).

Paths the app must **not** intercept: `/login`, `/logout`, `/authenticated`, `/rw`,
`/formservice/**` (separate entry), attachment and other download links, `/api/**`.

## Invariants (protected by Phase 0 E2E)

| ID | Behavior |
| --- | --- |
| I1 | Direct load of each canonical route renders its page (one representative per area). |
| I2 | Each legacy alias routes to its page; after Phase 2 the URL is canonical (D2). |
| I3 | Legacy flow URLs resolve to the patient flow/action route with the URL replaced. |
| I4 | Back/forward within a workspace and across a workspace switch restore the right page and workspace. |
| I5 | Switching workspace while the previous one loads: the latest choice wins. |
| I6 | Unknown path under a workspace and unknown slug show not-found. Specs assert the error page, not the URL, so D3 does not break them. |
| I7 | `/logout` link performs a full document navigation. |
| I8 | Clicking the current nav item re-dispatches (list reloads). |
| I9 | Form button opens the action with the form expanded (`entryTarget`); reload/back do not force it. |
| I10 | Clinician sidebar → owned-by worklist filtered to that clinician (D5: survives reload after Phase 3b). |
| I11 | "Back to list" returns to the last list with its arguments. |
| I12 | Form app `go:back` returns to the previous in-app page, or its fallback with no in-app history. |
| I13 | Nav selection is correct on direct load, nav click, and back/forward. |
| I14 | Patient sidebar closes before routing to another list. |
| I15 | Patient A → patient B quickly: only B renders. |
| I16 | Route errors: patient 410 → not-found; program flow failure → not-found; dashboard failure → alert + dashboards list; other failures → unknown-error view. |
| I17 | Pop/modal regions close on route change. |
| I18 | Attachment download links are not intercepted. |

Prefer extending existing specs (`default-route.e2e.cy.js`, `app-nav.e2e.cy.js`,
`error.e2e.cy.js`, `patient.e2e.cy.js`, the alias compatibility spec) over new files.

## Target application shape (end of Phase 3)

```text
src/js/routes.js                    static route tree (names = D6), meta { area, isList }
src/js/router.js                    new Router(...), intercept/notFound predicates, persistParams ['workspace']
src/js/services/router-radio.js     event-router trigger bridge + 'router' request channel
AppFrameApp                         router.handler owner → RouteOutlet keyed { workspace }
  WorkspaceApp                      RouteOutlet keyed by meta.area (each area imported on first use)
    PatientsArea / ProgramsArea …   plain App + RouteOutlet; explicit name → child map; .catch error policy
      PatientApp / ProgramApp …     plain App; plain options; showRoute(match) for per-match detail; nested RouteOutlet
NavApp, SidebarService, LatestList, HistoryService  listenTo(router, 'route')
ErrorApp                            renders notFound / unknownError at the current URL
```

Deleted by the end: `event-router.js`, `routerapp.js`, `subrouterapp.js`,
`route-base-app.js`, their component specs, `Backbone.history` usage, Nav root routes,
`WorkspaceApp.initRouter`/`loadUrl`, `routeScope`, `startCurrentRoute`,
`currentAppOptions` (replaced by explicit options), and `RouteState` (no page follows
the route; each area calls the page's `showRoute(match)`).

### Radio contract (D1)

- `Radio.trigger('event-router', name, ...args)`: positional `args` map to
  `router.getParamNames(name)` in order; `workspace` is filled by `persistParams`;
  extra args are ignored. Pushes a new entry. Per-navigation data goes through the
  request form: the action form button passes `{ info: { entryTarget } }`.
- `default` → navigate to `root` (redirects to the default list).
- `notFound` / `unknownError` (status) → ErrorApp renders in place; no URL change.
- `Radio.request('router', 'navigate', name, params, { history, query, info, state })` →
  `finished` promise (`false` when superseded). Also accepts a URL: `(url, { history, info })`.
  Positional trigger args skip `workspace` (the current workspace fills it); the
  `workspace` route takes the slug: `Radio.trigger('event-router', 'workspace', slug)`.
- `Radio.request('router', 'back', fallback)` → `router.back()`, or `fallback()` when the
  router owns no previous entry.
- Phase 3d adds `Radio.request('router', 'url', name, params, { query })` → string.
- Callers needing query params (D5) or replace use the request form.
- Area Apps are never dispatched from a trigger. The router handler (AppFrame →
  WorkspaceApp, awaited, D4) calls the area's `showRoute(match)`. The bridge
  (`src/js/services/router-radio.js`) owns the channel: triggers become
  `router.navigate`; names that are not routes (`notFound`, `unknownError`) are left to
  ErrorApp and WorkspaceApp, which listen to the channel.
- The router never intercepts `reload` navigations (`location.reload()` must reload the
  document); `refresh()` is the soft reload.

## Phases

Every phase:

- Works only within its listed scope; reports anything else as follow-up.
- Runs `npm run lint` and the single Cypress specs for affected flows. Never runs
  `npm run coverage*` or the full suites locally; push for full-suite CI signal
  (approve the `ci:defer-cypress` hold for that commit if the PR carries the label).
- Ends with one or more conventional commits and an updated "Status" line below.
- Reports failures verbatim and classifies them: product bug, test bug, environment.

### Phase 0 — lock in behavior

Scope: `src/**/*.e2e.cy.js`, `test/support/**`. No runtime changes.

- Add or extend E2E coverage for I1–I18 where missing. Specs must not assert `/404` or
  `/unknown-error` URLs (D3); assert the error page instead. Use canonical routes and event
  names except in the single alias compatibility spec.
- Add a spec asserting no alias is past its `until` date (it reads the alias list from a
  route module once one exists; for now, assert the three aliases and their date).
- Exit: new/extended specs pass against the current router (CI).

### Phase 1 — core package (+ outlet) and formservice

Scope: `packages/router/**`, root `package.json` (workspace entry), `eslint.config.mjs`
(boundary rule), `src/js/formservice.js`.

Parallel tracks after interfaces in DESIGN.md are frozen (the lead commits interface stubs first; tracks run in the same worktree on disjoint files, without isolated worktrees, which may branch from `develop`; 1C starts after 1A and 1B):

- **1A matcher**: tree compile, URLPattern, ranking, decode/encode, aliases,
  `url()`, `getParamNames()`, query.
- **1B drivers**: `navigationDriver`, `memoryDriver`, shared conformance suite.
- **1C router**: dispatch, intercept rules, sync/async redirects, notFound scope,
  supersession → `false`, events, `mount`/`refresh`, `start`/`stop`, `canGoBack`/`back`,
  `persistParams`, `updateState`.
- **1D outlet**: `RouteState`, `RouteOutlet`, ported from `route-base-app.js` semantics
  and `route-base-app.component.cy.js` cases.

Then one integration pass: wire `index.js`/`outlet.js` exports, port formservice to the
core `Router` (no Backbone), and add a Cypress component spec in the app that runs the
driver conformance suite against the real Navigation API.

- Exit: package tests green on Node 24 (`npm test -w packages/router`; `node --test <directory>` does not work on Node 24); `npm run lint` green (its eslint step covers
  `packages/router`; CI's lint job also runs the package tests); formservice
  E2E/manual check; driver and router conformance component spec green in Chrome and Firefox (CI).
- Review gate (Opus): package API and outlet semantics before any app depends on them.

### Phase 2 — swap the URL layer (parity)

Scope: `src/js/base/event-router.js`, `routerapp.js`, `src/js/app.js`,
`src/js/services/history.js`, `src/js/services/router-radio.js` (new),
`src/js/router.js` (new), `src/js/apps/globals/error/**`, `nav_app.js` routing bits,
`workspace_app.js` (`loadUrl` → `router.refresh()`), program route param renames,
`test/support/commands.js`, affected specs.

- Create the app `Router` (intercept/notFound predicates from the reserved-path list).
- Replace EventRouter with the router: each RouterApp `mount()`s its prefixed routes
  (unmount on destroy). `router-radio.js` turns a Radio trigger into `router.navigate`
  only, and a router `route` into RouterApp dispatch (positional params + `info.args`,
  no trailing query arg) with `noMatch` for the others. RouterApps never dispatch from
  the trigger, so there is no reentrancy guard. `event-router.js` is deleted here, not
  in 3c. Keep the `noMatch` behavior for now.
- Area routes mount with the literal workspace slug (`/one/worklist/:worklistId`), not
  `/:workspace`; `persistParams` and the `/:workspace` tree arrive in Phase 3a. NavApp
  mounts `root` (sync redirect to the default list) and `/<slug>{/*}?` per workspace.
  `WorkspaceApp.onStart` checks `router.match(location)` against its RouterApps, then
  `router.refresh()`, or triggers `notFound` when no area owns the URL.
- Aliases via the router (D2 canonicalize); legacy flow redirects via async `redirect`.
- D3: notFound/unknownError in place. Remove `*unknown`, `/404`, `/unknown-error`.
  Extend the not-found and unknown-error specs (`error`, `worklist` non-existent
  worklist, `workflow` 404, `program-flow` 410) to assert `location.pathname` is still
  the requested URL and that `go('back')` returns to the previous page without looping.
- I18: confirm the attachment download spec fails against a temporarily broken
  intercept predicate (one that ignores `downloadRequest`). If it still passes (the link
  also has `target="_blank"`), add a same-window `download` link case that does fail.
- HistoryService: `change:route` from router `route`; `go:back` via `router.back()`.
- `cy.navigate` → `win.navigation.navigate`.
- Delete `Backbone.history.start`. `Backbone.Router` must no longer be imported.
- D4 is not yet possible (handler = bridge dispatch); `finished` settles on dispatch.
- Exit: full E2E suite green in CI (Chrome, Firefox, Edge); manual Safari 26.2 smoke of
  I1, I4, I7, I18; Datadog RUM still records view changes (verify in a dev build or
  switch to manual view tracking from `route`).
- Review gate (Opus).

### Phase 3a — shell on the route tree

Scope: `src/js/routes.js` (new, full tree), `src/js/router.js`,
`app-frame/**`, `nav/**`, `error/**`, `services/{workspace,latest-list,history,sidebar}.js`,
`router-radio.js`, temporary adapter in `routerapp.js`.

- Single static route tree with `/:workspace` parent and `persistParams: ['workspace']`.
  `root` and `/:workspace` (index) redirect to the default list.
- AppFrame owns `router.handler`: RouteOutlet keyed `{ workspace }` selects WorkspaceApp
  (passes `route`). The workspace service reflects the route param; it no longer drives
  routing. Unknown or inaccessible workspace slug → not-found.
- WorkspaceApp: RouteOutlet keyed by `meta.area`, dynamic `import()` of the areas the user may use (one set, for stylesheet order), permission
  check → not-found. Area RouterApps receive `route` through a temporary adapter that
  calls their existing action handlers.
- Nav, sidebar stop, latest-list (stores `match.url`), HistoryService:
  `listenTo(router, 'route')`. Remove `before:appRoute` coordination, Nav root routes,
  `defer(replaceUrl)`, `noMatch`, `mount`/`refresh` usage.
- D4: handler awaits the outlet chain.
- Replace the `isAppUrl` denylist with an allowlist: `/` and `/:workspace/**` for the
  user's workspace slugs. Server-owned paths (`/forms/**`, `/shared/**`, `/fonts/**`,
  `/images/**`, `/appconfig.json`, new server routes) must not be intercepted or claimed
  by not-found.
- Remove the Phase 2 two-pass dispatch (`router.match` + `refresh()` in WorkspaceApp).
  Until then, a direct load's first area match reports `navigationType: 'replace'` and
  `initial: false`; nothing (focus/scroll policy, view tracking) may rely on those values.
  After 3a, the direct-load page match must have `initial: true`.
- Fix the pre-existing gap: traversing back onto a workspace URL no route owns
  (`/one/bogus`) must render not-found.
- Focus/scroll policy v1 per DESIGN.md (content region, `meta.focus`, per-entry scroll).
- Exit: CI green; I4, I5, I13 explicitly re-verified. Review gate (Opus).

### Phase 3b — areas onto outlets

Order: Clinicians → (Dashboards ∥ Programs) → Patients. Each step converts the area
RouterApp to a plain App + RouteOutlet and its SubRouterApps to plain Apps that read
`options.route` and listen to its `change`.

- Error policy moves from `onRouteError` to `.catch` at the `outlet.show` call site.
- Positional handler args → `match.params`; `entryTarget` → `match.info`.
- Patients step: D5 — worklist reads `clinicianId` from `match.query`; clinician sidebar
  navigates with `Radio.request('router', 'navigate', 'worklist', { worklistId: 'owned-by' }, { query: { clinicianId } })`.
- Remove the Phase 3a adapter after Patients.
- Exit per area: its E2E specs green in CI. Review gate (Opus) after Patients.

### Phase 3c — delete and document

- Delete `event-router.js`, `routerapp.js`, `subrouterapp.js`, `route-base-app.js` and
  their component specs; remove the `backbone` router usage entirely (done in 3b).
- Clinicians follows the D4 completion contract: the area returns the page's
  `showRoute(match)`. With no page reading `options.route`, `RouteState` leaves the outlet.
- The action `entryTarget` travels as `info.entryTarget` through the `router` request;
  the trigger bridge maps positional args to params only.
- Rewrite `src/js/base/routing.md` for the current system; update the routing overlay
  pointer in `AGENTS.md`/`CLAUDE.md`.
- Exit: lint, CI green; no references to removed modules.

### Phase 3d (optional) — real links

Convert navigation that is semantically a link to `<a href>` built with the
`router` `url` request (a Handlebars helper). One domain per agent. Buttons that
perform actions stay buttons.

### Phase 4 — extraction rehearsal

- `npm pack -w packages/router`, install into a scratch project, run its tests on
  Node 24; run driver conformance in Playwright Chromium/Firefox/WebKit.
- Write `packages/router/UPSTREAM.md`: monorepo placement next to `radio`/`utils`,
  build (rollup, types) to match `@mnjs/radio`, docs changes to Marionette
  `docs/routing.md`, version alignment.

## Stop and ask

- A DESIGN.md contract cannot be implemented as written.
- A phase needs to touch files outside its scope, change a URL, or change a user-facing
  behavior not covered by D1–D7.
- An invariant must be weakened, or a CI failure cannot be classified.
- Adding a runtime dependency or DOM shim.

## Running this plan

Start a Claude Code session in this worktree (model Sonnet, high effort) and give it:

> Read `docs/router-migration.md` and `packages/router/DESIGN.md`, then AGENTS.md and
> `src/js/base/routing.md`. Execute Phase N only. Use subagents for the parallel tracks
> the phase lists (same worktree, one track per agent, each prompt naming this doc,
> the track, its file scope, and exit criteria). Integrate, run lint and the targeted
> single specs, commit, update the Status section, push, and stop at the review gate
> with a summary of what changed, what was verified, and what was not.

At each review gate, run a review with a stronger model (e.g. `/code-review high` in an
Opus session, or ask the lead to spawn an Opus review subagent) against the phase's diff
and DESIGN.md before starting the next phase.

Setup in a fresh worktree: `nvm use` (Node 24.15) and `npm ci`.

## Status

- Phase 0: done, awaiting review gate. Specs: `default-route` (I8, I11, I14, I17),
  `app-nav` (I4, I5, I7, I13), `patient` (alias window guard, I3, I15, closed-workflow
  direct load), `workflow` (I9 back/forward/reload), `action` (I18); existing specs cover
  I1, I2, I6, I10, I12, I16. Three `/404` URL assertions replaced by error-page
  assertions (D3). Not asserted yet, by design: alias URL canonicalization (Phase 2),
  I10 reload survival (Phase 3b). Interactions routes are not on this base.
- Phase 1: done, awaiting review gate. `packages/router` (matcher, drivers + conformance
  suite, Router, outlet) with 229 `node:test` tests green on Node 24.15; `formservice.js`
  runs on the core Router. Verified: `npm test -w packages/router`, `npx eslint packages/router`,
  `npm run lint` (eslint and stylelint), conformance component spec 21/21 in Electron, Chrome
  and Firefox, `formservice.e2e.cy.js` 4/4. Resolved ambiguities are recorded in DESIGN.md.
  Review-gate fixes: CI's lint job runs the package tests and `npm run eslint` covers
  `packages/router`; a router conformance suite (named navigation, sync/async redirects,
  alias canonicalization, supersession, handler failure, initial redirect, back, refresh,
  entry state) runs on the memory driver (240 package tests) and the real Navigation API
  (component spec 31/31 in Electron, Chrome, Firefox); `start()` no longer swallows
  initial failures and resolves `false` when a superseded initial dispatch fails;
  formservice propagates startup failures. Not verified: Safari/WebKit, Edge, the outlet
  in a browser. Follow-ups: `editorconfig-checker` binary was unavailable locally (new
  files checked manually); CLAUDE.md names marionette `5.0.0-rc.1` but the repo pins
  `5.0.0`; review findings 4–8 (notFound params with `persistParams`, `match.signal`
  after finish, outlet owner patching, outlet async-stop code under 5.0.0's synchronous
  `stop()`, memory-driver abort ordering) are open.
- Phase 2: done, awaiting review gate. `src/js/router.js` (app Router; reserved roots
  `login logout authenticated rw formservice api` are neither intercepted nor
  not-found), `services/router-radio.js` (Radio bridge, `router` requests `mount`,
  `navigate`, `back`), RouterApp mounts routes and exposes `routeEvent`/`hasRoute`;
  `event-router.js`, `Backbone.history` and `Backbone.Router` are gone from the app.
  Program routes renamed (`:programId`, `:flowId`, `:actionId`); patient aliases carry
  `until: 2027-09-02` and canonicalize; legacy flow URLs use async `redirect`;
  `notFound`/`unknownError` render in place (D3); HistoryService emits `change:route`
  from `route` (not for a replace without `info`, i.e. `refresh()` and redirect hops) and
  `go:back` uses `router.back()`; `cy.navigate` uses `win.navigation.navigate`.
  Package changes made on the way: not-found keeps prefix params; each match owns an
  AbortController; reload navigations are never intercepted (found when `cy.reload()` and
  `location.reload()` in `services/forms.js` were swallowed). `cy.visit` blanks the AUT
  first so a visit is a real load (about 0 to 30 ms per visit, within noise of a ~240 ms
  visit); it must stay after `mockWs`. I18: the existing download spec fails against an
  intercept predicate that ignores `downloadRequest`, so no same-window case was added.
  D3 specs now assert the pathname is unchanged and `back` returns without looping
  (`worklist` non-existent, `workflow` 410, `program-flow` 410; `error` asserts the
  pathname for direct loads). Alias spec asserts canonical URLs. Verified: package tests
  251/251, router-driver component spec 33/33 (Electron, Chrome, Firefox), routerapp /
  route-base-app / subrouterapp / latest-list / sidebar component specs, `npm run
  eslint` and `stylelint` (editorconfig-checker binary unavailable), and single E2E
  specs: default-route, error, app-nav, patient, workflow, action, worklist, program-flow,
  clinician-sidebar, dashboard, dashboards-all, formservice, program, workflows,
  programs-all, action/flow/program sidebars, patient-flow, schedule, patient sidebar,
  clinicians-all, patient-quick-search, all green. Not verified: the full suite (needs a
  PR), Safari 26.2 (I1, I4, I7, I18), Edge, Datadog RUM view changes (RUM follows
  history API calls; intercepted Navigation API navigations may not register, so decide
  between a dev-build check and manual `startView` from `route`). Known, pre-existing
  and unchanged: traversing back onto an entry whose URL no route owns (for example
  `/one/bogus`) shows nothing, because the per-workspace wildcard matches; Phase 3a's
  single tree fixes it. Cut until a caller exists: `router` requests `url` (3d) and
  `current` (3b).
- Phase 3a: done, awaiting review gate (not pushed to CI yet; see Not verified).
  Step 1 (package, commit `9276e3988`): `RouteOutlet` matches Marionette 5.0.0's
  synchronous `stop()` (thenable-stop tracking and its tests removed), listens to owner
  `before:start`/`before:stop`/`stop`/`before:destroy`/`destroy` instead of overwriting
  `owner.stop/restart/destroy` (two gaps documented in DESIGN.md: an already-stopped
  owner emits nothing, and a first start and a restart of a stopped owner both emit
  `before:start`); the memory driver aborts the ongoing navigation before dispatching
  the new `navigate` event, even if that one is canceled, pinned in the conformance
  suite (passes on the native API in Chrome and Firefox). Review findings 6–8 are
  resolved.
  Step 2: `src/js/routes.js` is the single static tree (`/:workspace` parent, names =
  D6, `meta.area|isList`, aliases with `until`, legacy flow async redirects moved
  out of PatientsMainApp); `src/js/router.js` has `persistParams: ['workspace']`, the
  allowlist predicate (`/` and the user's workspace slugs) and `setRouteHandler`.
  AppFrame is a plain App that owns the handler with a `RouteOutlet` keyed `{ workspace }`
  and starts the router once it is running, without blocking the shell on the first page
  (a start failure goes to `handleErrors` as before); WorkspaceApp is a plain App with a
  `RouteOutlet` keyed by `meta.area`. It `import()`s the areas the user may use together
  with the workspace data and registers them once; an area the user may not use renders
  not-found. The handler awaits AppFrame → WorkspaceApp → area (D4). Deviation from the
  Phase 3a bullet: areas are not imported on demand at route time. Importing only the
  routed area changed the stylesheet order (the programs area's `display: flex` lost to
  the shared `work-card.scss` `display: grid`, breaking `program-flow` and `workflows`
  specs against the Phase 2 baseline), so the areas still load as one set. `RouterApp` is now only the temporary
  adapter (`showRoute(match)` → positional args + `info.args`); `mount`, `refresh`,
  `noMatch`, `startOnRoute`, `before:appRoute`/`appRoute`, the bridge `dispatch` and the
  two-pass dispatch are gone. NavApp (plain App), SidebarService, LatestListService (stores
  `match.url` and `match.info`), ErrorApp (plain App; shows at the current URL, stops on
  the next route) and the workspace service (reflects the route param) listen to the router.
  The workspace menu triggers `workspace` with the slug. `/one/bogus` renders not-found
  on back/forward. AppView focuses the content region on `route:ready` for a new page
  (not on the initial load). The `meta.focus` opt-out was not needed: no spec showed a
  route losing a focus target to it, so no route sets it.
  Behavior changes, all consequences of the static tree and allowlist, none changing a
  URL: a URL outside `/` and the user's workspaces (for example `/route-does-not-exist`)
  renders not-found without loading a workspace; "Back to Your Workspace" after a failed
  workspace load retries the load; a legacy `/flow/:id` URL resolves its patient before
  the workspace loads (the router runs an async redirect before the handler); a nav click during a workspace load navigates
  instead of being ignored (the latest navigation wins); an area the user may not use
  renders not-found.
  Limits: the content region never scrolls (every page scrolls in its own region), so no
  scroll restoration was added; traversing back onto an entry whose first path segment
  is not a workspace slug (for example a directly loaded `/bogus` entry) is not
  intercepted, so it shows nothing new; `initial: true` for the direct-load page match
  is not directly observable in the UI (the focus policy depends on it and is covered by
  the focus spec).
  Verified (Node 24.15, preview on a private port): `npm run eslint`, `stylelint`, package
  tests 252/252, router-driver component spec 34/34 in Chrome and Firefox, routerapp /
  latest-list / subrouterapp / route-base-app / sidebar component specs, and all 35 E2E
  specs run one at a time (I4, I5, I6, I13 in `app-nav`, `error`, `default-route`). Guards
  were removed one at a time and the targeted spec failed each time: the initial-load
  focus skip, the unclaimed-URL not-found, the `hasRoute` bridge guard, ErrorApp stopping
  on the next route, the not-found stop of area content, the inaccessible-area not-found,
  the area permission filter and register-once. Not provable in E2E: the
  `signal.throwIfAborted()` after the workspace outlet in AppFrame (a superseded
  navigation only reports a swallowed error); the matching check after the area outlet
  was removed because the area start has no async gap until Phase 3b. Not verified: CI
  full suite, Safari, Edge, Datadog RUM view changes, `editorconfig-checker` (binary
  unavailable). Environment note: another session may serve a preview on port 8090;
  Cypress `localhost` can then hit the wrong app, so runs used `--config baseUrl` with a
  private port.
  Specs changed: `patient-flow` (the legacy URL visit does not wait for workspace data), `error` (root unknown path without waiting for a workspace; the retry
  after a failed workspace load), `app-nav` (I5 now ends on the latest navigation;
  inaccessible areas render not-found), `default-route` (not-found on back/forward,
  `finished` means ready, content focus, latest navigation wins while an area loads),
  `routerapp` and `latest-list` component specs rewritten.
- Phase 3b: done, awaiting review gate (not pushed to CI yet; see Not verified).
  Step 1 (shell fixes from the 3a review): `WorkspaceApp` imports only the routed area
  on first use (restoring the lazy `import()`; the programs controls rules are now
  compound selectors, `.work-card__controls.workflows__flow-controls` and friends, so
  they no longer depend on stylesheet order) and returns without showing a page whose
  navigation was superseded while the area loaded; Latest list stores the route name,
  params without `workspace`, query and info and goes back by name, so a page reached by
  history from another workspace keeps the current one; `isAppUrl` builds the slug set
  once; the dead `routerAppName` is gone. Deviation: the `undefined`-from-`show` check
  after `areas.show` was not added, because areas have no async start, so `show` cannot
  resolve `undefined` without the navigation signal aborting (no UI path reaches it).
  Step 2: every area is a plain App with a `RouteOutlet`, an explicit route-name → child
  map and its error policy in `.catch` at the `show` call (Clinicians, Dashboards,
  Programs, Patients). Pages that follow the route (Clinicians all, Program, Program
  flow, Patient) read `options.route`, listen to its `change` and `stopListening` in
  `onStop`; lists use `restart: true`; resource pages use `key`. `RouterApp`,
  `SubRouterApp`, `RouteBaseApp` and their component specs are deleted, with
  `routeScope`, `startCurrentRoute`, `routeActions` and `currentAppOptions`. D5: the
  worklist reads `clinicianId` from `match.query`, the clinician sidebar navigates with
  `Radio.request('router', 'navigate', 'worklist', { worklistId: 'owned-by' }, { query: { clinicianId } })`,
  and Latest list keeps the query, so "Back to List" keeps the filter. The `current`
  request was cut (no caller). The `entryTarget` still arrives as `info.args[0]` from the
  five `Radio.trigger` callers (not changed to `info.entryTarget`: that would touch the
  list, flow, schedule and shared action views). The patient interactions feed is started
  by `PatientApp` directly instead of through the outlet: the feed restarts itself during
  its first start, and the outlet stops a child whose first start is superseded (noted in
  DESIGN.md). `/one/worklist/owned-by?clinicianId=` loses its query on any direct load,
  reload included, because `AuthProvider.handleAuthedPath` replaces the URL with the
  pathname only; I10 survival of a reload therefore needs a one-line change in
  `packages/care-ops-auth/AuthProvider.js`, which is outside this phase's scope and was
  not made (see the review-gate question).
  Not provable in E2E (kept or cut): AppFrame's `signal.throwIfAborted()` after the
  workspace outlet (removing it left `default-route` and `app-nav` green, including a new
  overlapping-navigation step), `onStop` → `stopListening(this.route)` in the route-reading
  pages, and `this.content.stop()` before starting the interactions feed. Cut as
  unreachable: the Patients area and PatientApp `reportError` fallbacks (the fetch layer
  already shows every non-410 failure; failures reach the pages only as `undefined`
  because `unknownError` stops the area).
  Verified (Node 24.15, private preview on 8097, 8098, 8099): `npm run eslint` and
  `stylelint` (editorconfig-checker binary unavailable), package tests 252/252, router-driver
  component spec 34/34 and latest-list component spec 3/3 (Electron), and all 36 E2E
  specs one at a time. Guards were removed one at a time and the targeted spec failed
  each time: post-import abort check, programs CSS, Latest list workspace omission and
  query, Clinicians/Dashboards/Programs `.catch` branches and keys, the worklist
  `clinicianId` read, unknown worklist not-found, patient 410 not-found, patient `key`,
  list `restart`, page `restart`, interactions reuse and stop, `entryTarget`, the patient
  route `change` listener and the interactions flag reset. Specs added: `default-route`
  (superseded while its area loads), `app-nav` (back to list stays in the workspace;
  cross-area navigations overlap during a workspace load), `dashboards-all` and
  `programs-all` (nav reload), `program` and `program-flow` (switching, returning,
  failing workflows load), `clinician-sidebar` (query URL and Back to List keeps it),
  `interactions` (another patient's feed). Not verified: CI full suite, Safari, Edge,
  Firefox E2E, Datadog RUM, `editorconfig-checker`.
- Phase 3b follow-up: done, awaiting review gate (pushed after the full per-spec E2E run,
  see Not verified). (1) `AuthProvider.auth` passes `pathname + search + hash` to
  `handleAuthedPath` (which compares the pathname part), and `beginReauth` defaults its
  return path the same way, so `?clinicianId=` survives a direct load and a reload (I10;
  the clinician-sidebar spec clears the saved worklist state and reloads). An
  unauthenticated deep link still returns without its query (`auth()` calls
  `loginPrompt(location.pathname)`); not changed, since it was not asked for. (2)
  Completion contract (D4): `PatientApp`, `ProgramApp` and `ProgramFlowApp` no longer
  show the route from `onStart` or listen to `change`; the area resolves the shell with
  `pages.show`, returns when it is `undefined` (superseded), then returns
  `app.showRoute(match)`, so `finished` and the content focus wait for the detail.
  `ProgramApp.editList` and the interactions feed's start and reuse are part of the
  returned chain. E2E: `patient` (detail held: `finished` and focus pending until the
  action renders; selecting another detail or leaving the patient mid-load leaves no stale
  render or focus), `program`, `program-flow` and `interactions` (finished means ready),
  `workflow` and `program-flow` (a 410 shell still finishes). Removing the area `await`,
  the `!app` returns and the returned detail promises each failed a spec, except the
  interactions reuse `return` (no observable difference: the feed is already loaded). (3)
  Router reentrancy: `#commit` installs `#current` and the controller before aborting the
  previous one and rechecks after the abort and after the `route` event; a superseded
  commit throws an `AbortError` so `finished` is `false`. The planned recheck after the
  redirect call was cut: removing it failed no test, because the commit rechecks cover
  it. (4) Entry state: omitted `state` on a replace or repeat keeps the entry's
  plain-object state. (5) Round-trip tests (aliases, optional segments, nesting,
  ranking, encoding, wildcards) found no mismatch; `url()` now rejects `.` and `..` and
  values failing a param's regex. (6) `peerDependenciesMeta` marks marionette optional
  and DESIGN.md documents navigate, repeat, refresh and the unbuilt reflect.
  Verified: package tests 279/279, `npm run eslint` and `stylelint`, router-driver,
  auth and latest-list component specs in Electron, Chrome and Firefox, and all E2E
  specs one at a time. Not verified: CI, Safari, Edge, Firefox E2E, the new reentrancy
  and entry-state tests on the real Navigation API (they run on the memory driver only),
  `editorconfig-checker`, `packages/care-ops-auth` lint (the package is outside the
  lint scope and already fails `eslint`).
  Review fixes: a signed-out deep link keeps its query and hash through sign-in; a
  replace to another path starts with empty entry state (same-path replaces and repeats
  keep it); `url()` checks param regexes in Unicode mode, as URLPattern does; the
  reentrancy scenarios (navigation from an abort or `route` listener, `stop()` from a
  `route` listener) run in the router conformance suite on the real Navigation API;
  DESIGN.md and `routing.md` limit RouteState `change` to synchronous following.
  Verified: package tests 284/284, router-driver component spec 37/37 in Chrome and
  Firefox, auth component spec 6/6, `npm run eslint`; each new test fails at its
  assertion against a narrow break and passes when restored. Open: Clinicians opens its
  sidebar from a `change` listener, so `finished` does not wait for the clinician sidebar.
- Phase 3c: done, awaiting review gate (pushed; not run in CI yet). Merged `develop`
  at `1bb42694e` (no new routes). (1) Clinicians follows D4: the area awaits the list,
  then returns `CliniciansAllApp.showRoute(match)`, which settles when the clinician
  sidebar is ready; the `change` listener and `options.route` are gone. With no page
  reading `options.route`, `RouteState` was removed from `@mnjs/router/outlet` (decided
  at the 3c stop-and-ask): `RouteOutlet.show(appName, { key, restart, options })` starts
  the child with the caller's options, and hosts no longer pass `match`. (2) The action
  form button and the list, schedule and flow action cards navigate with
  `Radio.request('router', 'navigate', name, params, { info: { entryTarget } })`;
  PatientApp reads `match.info?.entryTarget`. No trigger passes extra positional args, so
  the bridge maps them to params only and `info.args` is gone; Latest list no longer
  stores `info`, which no list route receives. (3) The sweep found two stale references
  (the base README and the RouteOutlet docblock); the remaining hits are this document's
  history, the `routeActions` Cypress API command (unrelated) and the bridge's
  `onEventRouter` handler. (4) `routing.md` and DESIGN.md describe the current system.
  Verified (Node 24.15, private preview on 8097): `npm run eslint` and `stylelint`
  (editorconfig-checker binary unavailable; changed files checked by hand), package tests
  278/278 (284 minus the six RouteState tests), router-driver component spec 37/37 in
  Chrome and Firefox, latest-list component spec 3/3, and single E2E specs:
  clinicians-all, clinician-sidebar, clinician-modal, default-route, app-nav, error,
  dashboard, dashboards-all, programs-all, program, program-flow, workflows, worklist,
  schedule, patient, workflow, action, form action, form, patient-flow, interactions and
  patient sidebar, all green on each item's tree.
  Behavior evidence: the new `clinician-sidebar` step records the sidebar and content
  focus when `finished` settles. It fails at that assertion
  (`{ hasSidebar: false, isContentFocused: true }`) when the area starts the sidebar from
  a `setTimeout` instead of returning it, and passes when restored. It stays green when
  only the `return` is dropped, and against the 3b `change`-listener code: the sidebar
  start has no async work, so it renders a microtask after the list starts, before
  `finished` settles either way. The awaited chain is therefore not observable in the
  UI today; it guards any future async sidebar work. I9: reading the old
  `match.info?.args?.[0]` fails `workflow` at the form-expanded assertion; restored, it
  passes. Latest list: dropping the query fails both navigate assertions; restored, 3/3.
  Not verified: CI full suite and coverage, Safari, Edge, Firefox E2E, Datadog RUM view
  changes, `editorconfig-checker`.
  Remaining: the CI full-suite and coverage run; manual Safari 26.2 smoke (I1, I4, I7,
  I18); Edge; Datadog RUM view changes (dev-build check or manual `startView` from
  `route`); optional Phase 3d real links; Phase 4.
- Phase 4: not started
