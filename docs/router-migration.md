# Router migration: Backbone.history → @mnjs/router

Branch: `feature/mnjs-router` (off `develop`). Package contract:
[`packages/router/DESIGN.md`](../packages/router/DESIGN.md). This document is the
application plan, the source of truth for every phase, and the brief for every agent.
When reality contradicts it, update this file in the same commit.

## Decisions

| # | Decision |
| --- | --- |
| D1 | `Radio.trigger('event-router', name, ...args)` stays the primary fire-and-forget navigation API. A `router` request channel is added for results: `url`, `navigate` (returns the navigation promise), `current`, `back`. |
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
| `patient:interactions` | `patient/:patientId/interactions` | PatientApp | Not on this base (lives on `feature/patient-interactions`); add its E2E when it merges |
| `patient:interaction` | `patient/:patientId/interactions/:interactionId` | PatientApp | Not on this base; same |
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
src/js/routes.js                    static route tree (names = D6), meta { area, isList, focus }
src/js/router.js                    new Router(...), intercept/notFound predicates, persistParams ['workspace']
src/js/services/router-radio.js     event-router trigger bridge + 'router' request channel
AppFrameApp                         router.handler owner → RouteOutlet keyed { workspace }
  WorkspaceApp                      route: RouteState; RouteOutlet keyed by meta.area (lazy import)
    PatientsArea / ProgramsArea …   plain App + RouteOutlet; explicit name → child map; .catch error policy
      PatientApp / ProgramApp …     plain App; reads options.route; nested RouteOutlet
NavApp, SidebarService, LatestList, HistoryService  listenTo(router, 'route')
ErrorApp                            renders notFound / unknownError at the current URL
```

Deleted by the end: `event-router.js`, `routerapp.js`, `subrouterapp.js`,
`route-base-app.js`, their component specs, `Backbone.history` usage, Nav root routes,
`WorkspaceApp.initRouter`/`loadUrl`, `routeScope`, `startCurrentRoute`,
`currentAppOptions` (replaced by explicit options).

### Radio contract (D1)

- `Radio.trigger('event-router', name, ...args)`: positional `args` map to
  `router.getParamNames(name)` in order; `workspace` is filled by `persistParams`;
  remaining args become `info.args`. Pushes a new entry.
- `default` → navigate to `root` (redirects to the default list).
- `notFound` / `unknownError` (status) → ErrorApp renders in place; no URL change.
- `Radio.request('router', 'url', name, params, { query })` → string.
- `Radio.request('router', 'navigate', name, params, { history, query, info, state })` →
  `finished` promise (`false` when superseded).
- `Radio.request('router', 'current')` → match. `Radio.request('router', 'back', fallback)`.
- Callers needing query params (D5) or replace use the request form.

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
- Re-implement EventRouter on the router: each RouterApp `mount()`s its prefixed routes
  (unmount on destroy); router `route` → Radio `event-router` trigger with positional
  params + `info.args` (no trailing query arg); Radio trigger → `router.navigate` (with
  reentrancy guard). Keep the `noMatch` behavior for now.
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
- WorkspaceApp: RouteOutlet keyed by `meta.area`, lazy `import()` per area, permission
  check → not-found. Area RouterApps receive `route` through a temporary adapter that
  calls their existing action handlers.
- Nav, sidebar stop, latest-list (stores `match.url`), HistoryService:
  `listenTo(router, 'route')`. Remove `before:appRoute` coordination, Nav root routes,
  `defer(replaceUrl)`, `noMatch`, `mount`/`refresh` usage.
- D4: handler awaits the outlet chain.
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
  their component specs; remove the `backbone` router usage entirely.
- Rewrite `src/js/base/routing.md` for routes/outlets/RouteState; update the routing
  overlay pointer in `AGENTS.md`/`CLAUDE.md`.
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
- Phase 2: not started
- Phase 3a: not started
- Phase 3b: not started
- Phase 3c: not started
- Phase 4: not started
