# Routing: RouterApp and SubRouterApp

How URL routing maps to running apps in this codebase. Read this before changing
`src/js/base/routerapp.js`, `src/js/base/subrouterapp.js`, or any application route
definitions.

## Responsibilities

- **RouterApp** (`src/js/base/routerapp.js`) — owns URL ↔ event mapping for a
  top-level area (Patients, Programs, Clinicians, Dashboards, Forms, Nav, Error).
  It registers routes with the local EventRouter, builds a normalized route
  context on each match, manages the single current child app, and fires the
  `before:appRoute` / `appRoute` lifecycle hooks.
- **AppFrameApp** (`src/js/apps/globals/app-frame/app-frame_app.js`) — owns Nav and
  the area RouterApps it instantiates within the global app shell. It responds to area route
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
  'patient:workflow': {
    action: 'showPatient',          // method name or function (positional handler)
    route: [                        // first route is canonical
      'patient/:id/workflow',
      'patient/:id/legacy-alias',
    ],
    // root: true,                  // skip the workspace-slug prefix
    meta: { isList: true },         // behavioral flags live under meta
  },
}
```

Structural fields: `action`, `route`, `root`. Behavioral flags go under `meta`
(`isList`). `action` is a method name (resolved on the RouterApp)
or a function; `route` is a string or a non-empty array of alias strings; non-root
routes are prefixed with the `workspaceSlug` supplied by AppFrame, so they must not
begin with `/`.

### Aliases

`route` may be an array. Every alias is registered (each prefixed with the workspace
slug unless `root`), and the **first** alias is canonical for URL generation
(`translateEvent` / `replaceRoute`). EventRouter supports this natively.

The local EventRouter is a Backbone.Router adapter. RouterApp supplies the
application's `event-router` Radio channel; the adapter must not import or bridge
a separate Radio singleton.

Non-canonical aliases exist only to keep old bookmarks working during a stated
compatibility window. The patient app carries three — `patient/dashboard/:id`,
`patient/archive/:id`, and `patient/archive/:id/action/:actionId` — supported
until September 2, 2027. New code, and routine test setup, must use the
canonical route or the event name; a legacy alias appears only in the one
compatibility spec that proves the aliases still route.

## Route context

Each match is normalized before any hook runs:

```js
{
  event,            // 'patient:workflow'
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

## Route failures

Return the activation promise from top-level route handlers. Put user-facing error
presentation in `onRouteError(error, routeContext)`: RouterApp invokes it only for
the current route, including failures that finish cleanup after navigation.
Avoid duplicating route-identity checks in individual handler catches. If an error
hook starts asynchronous reporting, handle that promise's rejection explicitly.

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
  while loading or stopping, the newest route waits for successful activation and
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

Both router classes use the internal `RouteBaseApp` base for child selection.
It has no URL, Radio-channel, resource-scope comparison, or error-presentation
policy. Keep those concerns in the routing adapters and application subclasses;
this boundary allows future extraction without adding a second routing backend.

- Selection retains the previous child until its stop resolves `true`. Overlapping
  replacements share that stop, and only the newest selection can activate.
- A rejected stop keeps the selection and propagates the error. A stop resolving
  `false` is superseded/canceled and does not authorize a replacement. Returning
  `false` from `prepareStop` is not a veto; stop permission must reject or throw.
- Owner stop, restart, and destroy invalidate pending selection even when the owner
  is already stopped. A failed child startup cleans up partially started descendants
  before clearing the selection. If cleanup fails, selection is retained for retry. Cleanup errors are reported
  separately through `child:cleanup:error` (Datadog by default); callers still
  receive the original activation error or canceled result.
- This is application-selection policy, not browser navigation blocking. It does
  not roll back the URL or guarantee atomic teardown of an entire child tree.

- RouterApp starts and stops its selected child asynchronously. A newer route wins
  if it arrives while the prior child is stopping or preparing.
- Route children are registered as owned Application instances. Owner stop and
  destruction clean them up; RouterApp clears its selection after its own stop.
  A selected child that stopped independently is restarted when the next matching
  route arrives.
- Dashboard route ownership is migrated. Other area routers must move their child
  registration and per-route startup data together rather than adding a temporary
  options or lifecycle compatibility path.
- A `SubRouterApp` owns its current route in Marionette state. Application state
  persists while stopped and across `restart()`, so the route re-dispatches after
  re-fetching without restart flags or threading `currentRoute` through options.

## Async ownership

Async loading belongs in `prepareStart(options, { signal })`. Return the prepared
value for `onStart(app, options, result)`, and pass the lifecycle signal through to
cancelable requests. Route dispatch stays synchronous — do not add another async
layer. Route handlers should return their activation promise. Route completion
notifications still fire synchronously after invoking the handler; they do not
mean that async content is ready. Synchronous throws and returned async failures are observed through
`onRouteError(error, routeContext)` (the browser error channel by default, also observed by Datadog), including initial
SubRouterApp dispatch from `onStart`. Domain handlers may handle expected errors
before returning. Radio dispatch remains synchronous.

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
- Leaving `isList` at the top level of a definition instead of
  under `meta` (silently stops updating the latest-list history).
- Adding global shell effects directly to RouterApp. AppFrame owns nav selection,
  transient-sidebar cleanup, and latest-list metadata handling for area routes.

## AI checklist for adding or changing a route

1. Add/extend the `RouterApp` `eventRoutes` entry: `action`, `route` (string or alias
   array), and `meta` for any behavioral flag. Keep IDs out of `meta`.
2. Register each child instance with `addChildApp()`. Implement the positional
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
