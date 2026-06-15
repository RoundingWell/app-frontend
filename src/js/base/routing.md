# Routing: RouterApp and SubRouterApp

How URL routing maps to running apps in this codebase. Read this before changing
`src/js/base/routerapp.js`, `src/js/base/subrouterapp.js`, or any application route
definitions.

## Responsibilities

- **RouterApp** (`src/js/base/routerapp.js`) — owns URL ↔ event mapping for a
  top-level area (Patients, Programs, Clinicians, Dashboards, Forms, Nav, Error).
  It registers routes with `backbone.eventrouter`, builds a normalized route
  context on each match, manages the single current child app, and fires the
  `before:appRoute` / `appRoute` lifecycle hooks.
- **AppFrameApp** (`src/js/apps/globals/app-frame_app.js`) — owns the global app
  shell and the area RouterApps it instantiates. It responds to area route
  transitions by selecting the nav item, closing the transient sidebar, and
  forwarding route metadata to the latest-list service. It also passes the
  current workspace slug into area RouterApps when they are created.
- **SubRouterApp** (`src/js/base/subrouterapp.js`) — a child app that dispatches a
  route to a local handler without owning any URLs. It carries declarative scope
  identity, retains the latest route while loading, and re-dispatches after its
  async startup completes.
- **page App** — a plain `js/base/app` (e.g. worklist, schedule, dashboard, form).
  It renders a view and has no route dispatch or scope. RouterApp starts these via
  `startCurrent` and never asks them for a route or scope.

## Route definitions (RouterApp `eventRoutes`)

```js
eventRoutes: {
  'patient:dashboard': {
    action: 'showPatient',          // method name or function (positional handler)
    route: 'patient/dashboard/:id', // string, or array of aliases (first is canonical)
    // root: true,                  // skip the workspace-slug prefix
    meta: { isList: true },         // behavioral flags live under meta
  },
}
```

Structural fields: `action`, `route`, `root`. Behavioral flags go under `meta`
(`isList`, `clearLatestList`). `action` is a method name (resolved on the RouterApp)
or a function; `route` is a string or a non-empty array of alias strings; non-root
routes are prefixed with the `workspaceSlug` supplied by AppFrame, so they must not
begin with `/`.

### Aliases

`route` may be an array. Every alias is registered (each prefixed with the workspace
slug unless `root`), and the **first** alias is canonical for URL generation
(`translateEvent` / `replaceRoute`). EventRouter supports this natively.

## Route context

Each match is normalized before any hook runs:

```js
{
  event,            // 'patient:dashboard'
  eventArgs,        // ['patient-id', ...] — positional, as the action receives them
  definition: { action, route, root, meta },
}
```

- `getCurrentRoute()` returns this object; `getCurrentRouteMeta()` returns its `meta`.
- `before:appRoute` and `appRoute` receive the RouterApp followed by the context
  object: `(router, routeContext)`.
- Action handlers still receive **positional** arguments (`showPatient(patientId)`).

Side-effect order during an area route transition (deliberate — the current route
is set first so it is observable in `before:appRoute`):

```text
set current route → before:appRoute
  → AppFrame selects nav, stops sidebar, applies latest-list metadata
  → action handler → appRoute
```

Router-specific `onBeforeAppRoute` / `onAppRoute` hooks use the same
`(router, routeContext)` signature. Root/workspace routing in `NavApp` and global
error routing are not coordinated by AppFrame because they are not area routers
instantiated through `AppFrameApp.initRouter()`.

## Scope identity (which child is "the same")

Every `SubRouterApp` reached through `RouterApp.startRoute()` declares a `routeScope`:

```js
routeScope: ['patientId']   // PatientApp
routeScope: ['flowId']      // PatientFlowApp, ProgramFlowApp
routeScope: ['programId']   // ProgramApp
routeScope: []              // CliniciansAllApp — always "the same" instance
```

`getRouteScope(options = {})` returns `pick(options, routeScope)`. RouterApp compares
scope objects with `isEqual` — **never** the full startup options:

- **Same app + equal scope** → reuse the running (or loading) child; forward the
  newest route to it.
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
  the child *before* `startChildApp`, so it is available in `beforeStart()`,
  `onFail()`, and `onStart()`. Read route data via `getCurrentRoute().eventArgs`;
  do **not** read `currentRoute` from startup options.
- `startRoute(routeContext)` — records the newest route; dispatches immediately only
  if already running. While loading or stopped it just stores (latest wins).
- `startCurrentRoute()` — synchronously dispatches the current route to its
  `routeActions` handler. **Subclasses call this from `onStart()` after building
  their shell.**

This is why same-scope navigation arriving during an in-flight load does not restart
the app: the route is retained and dispatched once `onStart` runs.

```js
onStart(options, data) {
  // build the shared shell / set views
  this.startCurrentRoute();
}
```

`routeActions` (not `eventRoutes`) maps a route event to a local dispatch handler:

```js
routeActions: {
  'flow:action': 'showActionSidebar',
  'flow:details': 'showFlowDetails',
}
```

## Stop and restart

- RouterApp keeps exactly one stop listener per current child. A child that stops
  **itself** clears RouterApp's current-child references.
- A Toolkit `restart()` emits `stop` then `start`. RouterApp ignores the restart-stop
  (`child.isRestarting()`), so a child that restarts itself (e.g. a worklist applying
  filter state) **stays current**. Treating a restart as a teardown would desync
  tracking and leave two apps in one region.
- A `SubRouterApp` clears its `_currentRoute` on a normal stop but preserves it across
  `restart()` (also guarded by `isRestarting()`), so the route re-dispatches after
  re-fetching. Rely on this instead of threading `currentRoute` through restart
  options.

## Async ownership

Async loading belongs in `beforeStart()` (return a promise / array of promises). The
base App lifecycle sets `isLoading()` true until it resolves, then runs `onStart`.
Route dispatch stays synchronous — do not add another async layer.

## Common mistakes

- Putting route-specific IDs (action IDs, sub-route detail) in `routeScope`. Scope is
  resource identity; extra keys force needless restarts or block legitimate ones.
- Reading `currentRoute` from startup options. Use `getCurrentRoute()`.
- Forgetting `startCurrentRoute()` in a `SubRouterApp`'s `onStart()` — the route never
  dispatches.
- Accessing the private `_routes` / `_currentRoute` instead of `getCurrentRoute()` /
  `getCurrentRouteMeta()`.
- A non-root `route` beginning with `/` (the workspace slug is prepended, producing a
  double slash).
- Leaving `isList` / `clearLatestList` at the top level of a definition instead of
  under `meta` (silently stops updating the latest-list history).
- Adding global shell effects directly to RouterApp. AppFrame owns nav selection,
  transient-sidebar cleanup, and latest-list metadata handling for area routes.

## AI checklist for adding or changing a route

1. Add/extend the `RouterApp` `eventRoutes` entry: `action`, `route` (string or alias
   array), and `meta` for any behavioral flag. Keep IDs out of `meta`.
2. Implement the positional action handler; route to a child via `startRoute(appName,
   options)` (scoped child) or `startCurrent(appName, options)` (plain page app).
3. If the child is a `SubRouterApp`: declare `routeScope`, add the event to
   `routeActions`, read route data via `getCurrentRoute()`, and call
   `startCurrentRoute()` in `onStart()`.
4. Do not change existing URLs unless that is the explicit task.
5. Add/extend specs in `src/js/base/*.cy.js` for base-class behavior and run targeted
   `npm run coverage:e2e` specs for the affected area, plus `npm run lint`.
