# Routing: route tree, shell, area Apps and outlets

How URL routing maps to running apps in this codebase. Read this before changing
`src/js/routes.js`, `src/js/router.js`, an area App's `showRoute`, or the app frame's
route handling.

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
- **Area App** (`apps/<domain>/<domain>-main_app.js`) — plain App with a `RouteOutlet`
  and an explicit route-name → child-name map. `showRoute(match)` returns
  `this.pages.show(childName, { key, match, restart, options })` and handles the area's
  error policy with `.catch` at that call.
- **Page App** — a plain App. A page that depends only on its resource reads plain
  options (`worklistId`, `dashboardId`); a page that follows the route while it runs
  (Patient, Program, Program flow, Clinicians) reads `options.route`.

## Area Apps

```js
const PAGES = {
  'clinicians:all': 'cliniciansAll',
  'clinician': 'cliniciansAll',
};

export default App.extend({
  childApps: { cliniciansAll: CliniciansAllApp },
  initialize() {
    this.pages = new RouteOutlet({ owner: this, onCleanupError: addError });
  },
  showRoute(match) {
    return this.pages.show(PAGES[match.name], {
      match,
      options: { region: this.getRegion() },
    }).catch(error => {
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
    });
  },
});
```

The path lives in `routes.js`; the map covers every route whose `meta.area` is the area.
Route params arrive as `match.params` (named, see `routes.js`), the query as
`match.query` (a `URLSearchParams`) and per-navigation data as `match.info`. Return the
`show` promise: the router handler awaits it, so `navigate().finished` means the page
is ready.

- **`key`** is resource identity (`{ patientId }`, `{ programId }`, `{ flowId }`). The
  same page and an equal key reuses the running child and forwards the newest match
  through its `RouteState`. Omit it when the page is always "the same".
- **`restart: true`** stops and starts the child on every call. List pages use it so
  selecting the current nav item reloads the list.
- Put route-specific detail (action ids, sub-routes) in the page's route handling, never
  in `key`: it would restart the page.
- **Errors** are handled with `.catch` on the `show` call. Only the newest selection
  rejects, so there is no route-identity check. A superseded call resolves `undefined`.

### Query and info

A query parameter is part of the URL and survives a reload. The worklist reads
`clinicianId` from `match.query`; the clinician sidebar navigates with
`Radio.request('router', 'navigate', 'worklist', { worklistId: 'owned-by' }, { query: { clinicianId } })`.
LatestListService stores the list's name, params without `workspace`, query and info, so
"Back to list" keeps the filter. `info` is per navigation and is not restored by reload
or traversal (the action `entryTarget` rides in `info.args[0]` from a trigger).

## Aliases

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

## Patient flow action targets

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

## Following the route (Page Apps)

A page that must react to route changes while it runs reads `options.route`, a
`RouteState` (`getName()`, `getParams()`, `getQuery()`, `getInfo()`, `getMatch()`):

```js
onStart(app, { route }, data) {
  this.route = route;
  this.listenTo(route, 'change', this.showRoute);
  // build the shell, then show the current route
  this.showRoute();
},
onStop() {
  this.stopListening(this.route);
},
showRoute() {
  const name = this.route.getName();
  // dispatch by route name; handle failures where the page is shown
},
```

A route change that arrives while the page loads is not lost: `onStart` reads the latest
match. A page that selects among child pages owns its own `RouteOutlet`; it passes the
options the children need explicitly. A child that restarts itself during its first
start (the patient interactions feed) is started directly by its host instead of
through an outlet, because an outlet stops a child whose first start is superseded.

## Route failures

Return the activation promise from `showRoute`. User-facing error presentation for the
initial page start belongs to the `.catch` at the area's `show` call; failures while a
running page handles a route change are handled by that page, where its UI is. A
workspace load failure rejects the router handler; Radio-triggered navigations report
it with `addError`.

## Stop and restart

AppFrame, WorkspaceApp, area Apps and pages that select children use `RouteOutlet` from
`@mnjs/router/outlet`; see `packages/router/DESIGN.md` for its contract. In short:
selection stops the previous child synchronously and starts the replacement
asynchronously, only the newest selection completes, owner stop/restart/destroy
invalidates pending selection, and a failed startup stops partially started descendants
before the original error reaches the caller. Keep startup data with the child that needs
it. For framework lifecycle contracts, use the upstream `marionette` skill.

## Async ownership

Async loading belongs in `prepareStart(options, { signal })`. Return the prepared value
for `onStart(app, options, result)` and pass the lifecycle signal to cancelable
requests. Code after an `await` outside `prepareStart` checks the match `signal`
(`match.signal.aborted`) before showing a page. Radio stays synchronous: a trigger only
requests navigation.

## Common mistakes

- Putting action ids or sub-route detail in an outlet `key`. It restarts the page or
  blocks a legitimate restart.
- Forgetting `restart: true` for a list page: re-selecting the current nav item no longer
  reloads it.
- Forgetting `stopListening(this.route)` in `onStop` for a page that listens to its route.
- Leaving `isList` or `area` out of a route's `meta` in `routes.js`: the list is not
  remembered for "Back to list", or the route renders nothing.
- Adding global shell effects to an area. Nav selection, sidebar cleanup and latest-list
  metadata are `route` listeners in their services.
- Area styles that depend on the order stylesheets load: areas load lazily, on first use.

## AI checklist for adding or changing a route

1. Add the route to `src/js/routes.js` (name, path, aliases, `meta.area`, `meta.isList`)
   and its name to the area App's page map. Keep IDs out of `meta`.
2. Register the page as a child App of the area and show it from `showRoute` with the
   right `key` / `restart` and explicit `options`.
3. If the page follows the route, read `options.route` and listen to its `change`.
4. Do not change existing URLs unless that is the explicit task.
5. Cover the flow with E2E scenarios (see [AGENTS.md](../../../AGENTS.md#validation)),
   plus `npm run lint`.
