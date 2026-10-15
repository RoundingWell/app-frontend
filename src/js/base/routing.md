# Routing: route tree, shell, RouterApp and SubRouterApp

How URL routing maps to running apps in this codebase. Read this before changing
`src/js/routes.js`, `src/js/router.js`, `src/js/base/routerapp.js`,
`src/js/base/subrouterapp.js`, or the app frame's route handling.

## Responsibilities

- **Route tree** (`src/js/routes.js`) — the single static tree. Route names are the
  event strings (`patient:flow:action`, `programs:all`, ...). `meta.area` selects the
  area, `meta.isList` marks list routes for "Back to list". `root` and
  `workspace` (`/:workspace`) redirect to the default list. Legacy flow URLs redirect
  asynchronously. Aliases carry an `until` date.
- **Router** (`src/js/router.js`) — the app `Router`. It intercepts and owns `/` and
  URLs whose first segment is one of the user's workspace slugs. Server-owned paths
  (`/forms/**`, `/shared/**`, `/api/**`, ...) are neither intercepted nor claimed by
  not-found. `persistParams: ['workspace']` fills the workspace from the current match.
  AppFrame registers the activation `handler` through `setRouteHandler`.
- **Radio bridge** (`src/js/services/router-radio.js`) — `Radio.trigger('event-router',
  name, ...args)` requests navigation: positional `args` map to the route's params in
  path order (the current workspace fills `workspace`, except for the `workspace`
  route itself, whose arg is the slug) and the rest become `info.args`. `default`
  navigates to `root`. Names that are not routes (`notFound`, `unknownError`) are
  handled by their listeners. `Radio.request('router', 'navigate' | 'back', ...)`
  returns results.
- **AppFrameApp** (`apps/globals/app-frame/app-frame_app.js`) — plain App. It starts
  the persistent navigation, starts the router, and owns the route handler: a
  `RouteOutlet` keyed `{ workspace }` selects WorkspaceApp and the handler then awaits
  `WorkspaceApp.showRoute`. The handler awaits the whole chain, so `navigate().finished`
  and `router.start()` mean the page is ready. A URL the router does not own renders
  not-found at the current URL.
- **WorkspaceApp** (`apps/globals/app-frame/workspace_app.js`) — plain App. It owns
  the transient sidebar and a `RouteOutlet` keyed by `meta.area`. It imports the routed
  area the first time a route needs it and registers it once; a navigation superseded
  while the area loads returns without showing its page. Area styles must not depend on
  load order. A match without an area (unmatched path, failed
  redirect) stops the area content; an area the user may not use renders not-found. An error
  (`notFound`, `unknownError`) stops the area content too.
- **Workspace service** (`services/workspace.js`) — reflects the route's `workspace`
  param as the current workspace. It does not drive routing.
- **Route listeners** — NavApp (selection), SidebarService (stop), LatestListService
  (stores the list's route name, params without `workspace`, and `match.info`; "Back to
  list" navigates by name, so the current workspace is kept),
  HistoryService (`change:route`) and ErrorApp listen to the router's `route` event.
- **RouterApp** (`src/js/base/routerapp.js`) — temporary adapter for an area (Patients,
  Programs, Clinicians, Dashboards) until the area is converted to outlets (Phase 3b).
  `showRoute(match)` calls the action registered in `eventRoutes` with the route's
  params by position, then `info.args`. It owns no URLs.
- **SubRouterApp** (`src/js/base/subrouterapp.js`) — a child app that dispatches a
  route to a local handler without owning any URLs. It carries declarative scope
  identity, retains the latest route while loading, and re-dispatches after its
  async startup completes.
- **page App** — a plain `js/base/app` (e.g. worklist, schedule, dashboard, form).
  It renders a view and has no route dispatch or scope. RouterApp starts these via
  `startCurrent` and never asks them for a route or scope.

## Area actions (RouterApp `eventRoutes`)

```js
eventRoutes: {
  'patient:workflow': { action: 'showPatient' },   // method name
},
```

The path lives in `routes.js`. An area's `eventRoutes` maps every route name with
`meta.area` equal to the area to the method that handles it. Handlers take the route's
params by position (`showPatient(patientId)`), then the trailing `info.args`.

### Aliases

An alias is a full path in `routes.js` (`aliases: [{ path: '/:workspace/...', until }]`)
that declares the same params as its canonical path. The router replaces an alias URL
with the canonical URL before dispatch. The patient app carries three —
`patient/dashboard/:patientId`, `patient/archive/:patientId`, and
`patient/archive/:patientId/action/:actionId` — supported until September 2, 2027.
New code, and routine test setup, must use the canonical route or the event name; a
legacy alias appears only in the one compatibility spec that proves the aliases still
route.

An event with no route, `notFound` and `unknownError`, renders in place with no URL
change: ErrorApp shows the error over the current URL and removes it on the next route.

### Patient flow action targets

`patient:flow:focus` generates `patient/:patientId/flow/:flowId/focus/:actionId`.
It opens the flow page and focuses the matching action after the list attaches.
PatientApp passes `focusActionId` separately from action-detail context. A target
missing from the fetched flow collection leaves the normal flow page visible.
Direct loads, refresh, and browser history apply the URL target on each page
activation; live updates do not reapply it. Plain `patient:flow` links have no
target. `patient:flow:action` continues to open the action detail page.

## Focus

The router intercepts with manual focus and scroll. `AppView` (the owner of the content
region) focuses the region on `route:ready` for a new page, not on the initial load.
Scroll is not managed by the shell: pages scroll inside their own regions, so restoring
scroll on back/forward belongs to the Views that own those regions.

## Route context

Each match is normalized before its action runs:

```js
{
  event,            // 'patient:workflow'
  eventArgs,        // ['patient-id', ...] — positional, as the action receives them
  definition: { action },
}
```

- `getCurrentRoute()` returns this object.
- Action handlers receive **positional** arguments (`showPatient(patientId)`).

Shell effects of a route (nav selection, sidebar stop, latest-list metadata) are
router `route` listeners; areas do not coordinate them.

## Route failures

Return the activation promise from top-level route handlers. Put user-facing error
presentation in `onRouteError(error, routeContext)`: RouterApp invokes it only for
the current route, including failures that finish cleanup after navigation.
Avoid duplicating route-identity checks in individual handler catches. If an error
hook starts asynchronous reporting, handle that promise's rejection explicitly. A
workspace load failure rejects the router handler; Radio-triggered navigations report
it with `addError`.

## Scope identity (which child is "the same")

Every `SubRouterApp` reached through `RouterApp.startRoute()` declares a `routeScope`:

```js
routeScope: ['patientId']   // PatientApp
routeScope: ['flowId']      // PatientFlowApp, ProgramFlowApp
routeScope: ['programId']   // ProgramApp
routeScope: []              // CliniciansAllApp — always "the same" instance
```

An omitted or non-array `routeScope` is an error; use `[]` for a global scope.
`getRouteScope(options = {})` returns `pick(options, routeScope)`. RouterApp compares
scope objects with `isEqual` — **never** the full startup options:

- **Same app + equal scope** → reuse the selected child; forward the newest route
  and start it if it was stopped.
- **Different app or scope** → stop the current child and start the replacement.

Scope identity is workspace/resource identity, **not** route-specific detail. Put the
ID that determines "same workspace" in `routeScope` (the patient, the flow). Do not
put action IDs or sub-route detail there — those change within a scope and must not
force a restart.

`startCurrent()` is the unconditional path (always stop + start); it does not consult
scope. Plain page Apps are always started this way.

## Loading and dispatch (SubRouterApp)

A `SubRouterApp` separates "record the route" from "dispatch the route":

- `setCurrentRoute(routeContext)` / `getCurrentRoute()` — RouterApp sets the route on
  the child before starting it, so it is available throughout preparation and
  startup. Read route data via `getCurrentRoute().eventArgs`;
  do **not** read `currentRoute` from startup options.
- `startRoute(routeContext, options)` — records the newest route and passes options
  to the idempotent Application `start()`. A stable active run dispatches the route;
  while loading, the newest route waits for successful activation and
  is dispatched once by that run's `onStart()`. A later stop invalidates pending
  route dispatch, so route and stop ordering remains latest-intent-wins.
- `startCurrentRoute()` — synchronously dispatches the current route to its
  `routeActions` handler. **Subclasses call this from `onStart()` after building
  their shell.**

This is why same-scope navigation arriving during an in-flight load does not restart
the app: the route is retained and dispatched once `onStart` runs.

```js
onStart(app, options, data) {
  // build the shared shell / set views
  this.startCurrentRoute();
}
```

`routeActions` (not `eventRoutes`) maps a route event to a local dispatch handler:

```js
routeActions: {
  'patient:flow:action': 'showAction',
  'patient:flow': 'showFlow',
}
```

## Stop and restart

RouterApp and SubRouterApp use the internal `RouteBaseApp` base for child selection
(until Phase 3b replaces it with `RouteOutlet`). AppFrame and WorkspaceApp select their
children with `RouteOutlet` from `@mnjs/router/outlet`. Neither has URL, Radio-channel,
resource-scope comparison, or error-presentation policy; keep those concerns in the
routing adapters and application subclasses.

- Selection stops the previous child synchronously before starting the replacement.
  Startup remains asynchronous, and only the newest selection can complete.
- Owner stop, restart, and destroy invalidate pending selection even when the owner
  is already stopped. A failed child startup stops partially started descendants
  before clearing the selection. Cleanup errors are reported separately through
  `child:cleanup:error`; callers receive the original activation error.
- Navigation permission and required saves happen before teardown. Synchronous
  teardown failures abort the operation. Failed cleanup retains the selected child
  so a later selection can retry teardown.
- RouterApp stops its selected child synchronously and starts it asynchronously.
  A newer route cancels prior preparation.
- Route children are registered as owned Application instances. Owner stop and
  destruction clean them up; RouterApp clears its selection after its own stop.
  A selected child that stopped independently is restarted when the next matching
  route arrives.
- Area routers register their children explicitly and supply per-route startup
  data through the Application lifecycle. Keep ownership and startup data together
  when extending a route tree.
- A `SubRouterApp` owns its current route in Marionette state and re-dispatches it
  after restarting. For framework lifecycle contracts, use the upstream
  `marionette` skill.

## Async ownership

Async loading belongs in `prepareStart(options, { signal })`. Return the prepared
value for `onStart(app, options, result)`, and pass the lifecycle signal through to
cancelable requests. Route handlers should return their activation promise, which the
router handler awaits. Code after an `await` in a route handler checks the match
`signal` (`signal.throwIfAborted()`) before starting children. Synchronous throws and returned async failures are observed through
`onRouteError(error, routeContext)` (the browser error channel by default, also observed by Datadog), including initial
SubRouterApp dispatch from `onStart`. Domain handlers may handle expected errors
before returning. Radio stays synchronous: a trigger only requests navigation.

## Common mistakes

- Putting route-specific IDs (action IDs, sub-route detail) in `routeScope`. Scope is
  resource identity; extra keys force needless restarts or block legitimate ones.
- Reading `currentRoute` from startup options. Use `getCurrentRoute()`.
- Forgetting `startCurrentRoute()` in a `SubRouterApp`'s `onStart()` — the route never
  dispatches.
- Accessing the private `_routes` / `_currentRoute` instead of `getCurrentRoute()`.
- Leaving `isList` or `area` out of a route's `meta` in `routes.js`: the list is not
  remembered for "Back to list", or the route renders nothing.
- Adding global shell effects directly to RouterApp. Nav selection, sidebar cleanup,
  and latest-list metadata are `route` listeners in their services.

## AI checklist for adding or changing a route

1. Add the route to `src/js/routes.js` (name, path, aliases, `meta.area`, `meta.isList`) and its action to the area `RouterApp` `eventRoutes`. Keep IDs out
   of `meta`.
2. Declare static children with `childApps`; use `addChildApp()` for configured or
   dynamically created instances. Implement the positional
   action handler and return `startRoute(appName, options)` (scoped child) or
   `startCurrent(appName, options)` (plain page app).
3. If the child is a `SubRouterApp`: declare `routeScope`, add the event to
   `routeActions`, read route data via `getCurrentRoute()`, and call
   `startCurrentRoute()` in `onStart()`.
4. Do not change existing URLs unless that is the explicit task.
5. Add/extend specs in `src/js/base/*.component.cy.js` for generic base-class behavior
   and E2E scenarios for the affected application flow. Use the focused Cypress
   commands and full-suite validation boundary in [AGENTS.md](../../../AGENTS.md#validation),
   plus `npm run lint`.
