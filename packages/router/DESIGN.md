# @mnjs/router — design (incubating in app-frontend)

Status: incubating at `packages/router`; to be extracted to the Marionette monorepo
as `@mnjs/router` once app-frontend's Patients area runs on it. The application
migration plan lives in [`docs/router-migration.md`](../../docs/router-migration.md).

## Goals

- Replace `Backbone.Router` / `Backbone.history` with named, nested routes over the
  [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
  and [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern).
- Simple applications use only the core `Router`.
- Applications composed of many asynchronous Marionette Applications use the optional
  `@mnjs/router/outlet` layer (`RouteOutlet`, `RouteState`) — composition, not base
  classes.
- Follow Marionette v5 conventions: `Promise<boolean>` where `false` means
  superseded/canceled, `Events` + `listenTo` lifetimes, explicit ownership.

## Non-goals

- No application policy: workspaces, nav selection, latest-list, error presentation,
  analytics, and permissions stay in the application.
- No Radio dependency. String-event bridges are application code.
- No built-in focus or scroll policy (see [Focus and scroll](#focus-and-scroll)).
- No pushState driver in v1 (the driver seam allows one later).
- No reliance on `precommitHandler` (Safari 26.2 does not ship it).

## Browser and runtime floor

- Navigation API: Chrome/Edge 102, Firefox 147, Safari 26.2 (Baseline Newly available,
  January 2026). URLPattern: Chrome 95, Firefox 142, Safari 26.0.
- Node ≥ 24 for tests (global `URLPattern`); matches the repo's `.nvmrc` and `@mnjs/*`.
- This floor is narrower than Marionette core's "Widely available" target. The package
  declares its own floor; Marionette core is unaffected.

## Package boundary (enforced while incubating)

```
packages/router/
  package.json        name "@mnjs/router", type module, private until extraction
  index.js            core: Router, memoryDriver, navigationDriver
  outlet.js           Marionette layer: RouteOutlet, RouteState (peer dep: marionette)
  src/**              implementation
  test/**             node:test suites (run with `node --test`)
  DESIGN.md
```

- `exports`: `"."` → `index.js`, `"./outlet"` → `outlet.js`.
- Core dependencies: `@mnjs/utils` only (`Events`, `extend`). No `backbone`,
  `underscore`, `marionette`, `js/*`, or app imports. The outlet layer may import
  `marionette` (peer dependency) and `@mnjs/utils`.
- An ESLint `no-restricted-imports` block for `packages/router/**` enforces this.
- Package tests do not count toward app coverage (`.nycrc.json` includes only
  `src/js/**`). They are the package's own contract tests and move with it.

## Core concepts

### Route definitions

A route table is a tree of plain objects:

```js
const routes = [
  { name: 'root', path: '/', redirect: () => ({ name: 'worklist', params: defaultParams() }) },
  {
    path: '/:workspace',                       // unnamed node: prefix only
    meta: { scope: 'workspace' },
    children: [
      { name: 'worklist', path: 'worklist/:worklistId', meta: { area: 'patients', isList: true } },
      {
        name: 'patient', path: 'patient/:patientId', meta: { area: 'patients' },
        children: [
          {
            name: 'patient:workflow',
            path: 'workflow',
            aliases: [{ path: '/:workspace/patient/dashboard/:patientId', until: '2027-09-02' }],
          },
        ],
      },
      {
        name: 'legacy:patient:flow',
        path: 'flow/:flowId',
        redirect: async({ params }, { signal }) => ({ name: 'patient:flow', params: await lookup(params, signal) }),
      },
    ],
  },
];
```

| Field | Meaning |
| --- | --- |
| `name` | Unique string. A named node matches its own full path; unnamed nodes are prefixes only. |
| `path` | URLPattern pathname syntax. Relative to the parent unless it starts with `/`. |
| `children` | Nested routes. |
| `meta` | Arbitrary data, shallow-merged root → leaf (child keys win). |
| `aliases` | Alternative full paths for the same route. See [Aliases](#aliases). |
| `redirect` | `(match, { signal }) => target \| Promise<target> \| undefined`. See [Redirects](#redirects). |

Rules:

- Parameter names are unique within a branch (URLPattern rejects duplicate group
  names). `program/:id/action/:id` must become `program/:programId/action/:actionId`.
- Parameter values are decoded with `decodeURIComponent` on match and encoded with
  `encodeURIComponent` when building URLs.
- Optional segments use URLPattern groups: `{/:responseId}?`.
- Trailing slashes are normalized away before matching (except `/`).
- Only the pathname is matched. The query is exposed as `URLSearchParams`.

### Ranking (no registration-order dependence)

When several routes match, the most specific wins, compared segment by segment:
static segment > named parameter > optional group > wildcard. Ties fall back to
definition order. Registration order (including `mount()` order) never decides a match.

### Aliases

Aliases keep old URLs working for a stated compatibility window, and are a reusable
pattern.

- An alias is a full path (absolute from the router base) that declares exactly the
  canonical route's parameter names, in any order.
- An alias match produces the **canonical** `name` and `params`, with
  `match.alias` set to the alias path.
- Default policy `canonicalize`: after commit the router replaces the URL with the
  canonical URL (`history: 'replace'`), then dispatches once. Per-alias
  `policy: 'preserve'` keeps the alias URL in the address bar.
- `until` (ISO date) documents the compatibility window. `router.getAliases()` lists
  every alias with its route name and `until`, so an application test can fail once a
  window has passed.
- `router.url()` always builds the canonical URL.

### Redirects

- A synchronous `redirect` resolves before dispatch; the router replaces the URL and
  matches the target instead. Redirect chains are capped (default 5) and throw
  beyond that.
- An asynchronous `redirect` (returns a Promise) runs inside the intercept handler after
  commit with the navigation's `signal`. On resolution the router navigates to the
  target with `history: 'replace'`. A superseded navigation discards the result; a
  rejection is reported as `route:error` for that match.
- Returning `undefined` means "no redirect": the route dispatches normally.
- Targets: `{ name, params, query }` or a same-origin URL string.

### Match

```js
{
  name, params, query,              // query: URLSearchParams
  url,                              // URL instance
  meta,                             // merged root → leaf
  branch,                           // [{ name, path, params (own), meta (own) }, …] root → leaf
  alias,                            // matched alias path or null
  navigationType,                   // 'push' | 'replace' | 'traverse' | 'reload'
  initial,                          // true for the start() dispatch
  info,                             // per-navigation transient data (not persisted)
  state,                            // persisted entry state (driver getState())
  key,                              // history entry key
  signal,                           // aborted when superseded or the router stops
  userInitiated,
}
```

`notFound` matches have `name` equal to the configured not-found name and empty params.

## Router API

```js
import { Router, navigationDriver, memoryDriver } from '@mnjs/router';

const router = new Router({
  routes,
  driver: navigationDriver(),          // default when window.navigation exists
  intercept: url => isAppUrl(url),     // URLs the router may own
  notFound: { name: 'notFound', within: url => isAppUrl(url) },
  persistParams: ['workspace'],        // copied from the current match when omitted
  handler: (match, { signal }) => activate(match), // single owner of activation
});
```

`persistParams` lets callers omit ancestor parameters that rarely change (a tenant,
workspace, or locale): `url()` and `navigate()` copy them from the current match when
the target route declares them and the caller did not supply them.

| Member | Behavior |
| --- | --- |
| `start()` | Matches the current URL, applies alias/redirect policy, dispatches with `initial: true`. Resolves the initial `Promise<boolean>` outcome. Navigation does not emit `navigate` for the initial document load; `start()` is the only initial dispatch. |
| `stop()` | Removes driver listeners, aborts the in-flight navigation signal. Idempotent. |
| `navigate(nameOrUrl, params?, options?)` | Options: `history` (`'auto' \| 'push' \| 'replace'`), `query`, `info`, `state`. Returns `{ committed, finished }`; both resolve `false` when superseded or aborted and never reject with `AbortError`. `finished` resolves `true` after the handler resolves and rejects with handler failure. |
| `url(name, params?, { query })` | Canonical URL string. Throws for unknown names or missing params. |
| `match(url)` | Pure match (no redirect side effects). Returns a match or `null`. |
| `getCurrent()` | The committed current match. |
| `refresh()` | Re-matches the current URL and dispatches with `navigationType: 'replace'` without adding an entry. Use after the route table changes. |
| `mount(routes, { parent })` | Adds routes (optionally under a named parent) and returns `unmount()`. Mounting does not dispatch; call `refresh()` if needed. |
| `getAliases()` | `[{ name, path, until, policy }]`. |
| `getParamNames(name)` | Parameter names of the canonical path, in path order (for positional bridges). |
| `canGoBack` / `back()` | Only counts entries this router created or dispatched (marked in entry state), so pre-application entries such as auth redirects are excluded. `back()` resolves `false` when there is no router-owned entry. |
| `updateState(state)` | Merges into the current entry's persisted state. |

Events (`Events` from `@mnjs/utils`, so `listenTo(router, …)` works):

| Event | Timing | Arguments |
| --- | --- | --- |
| `route` | URL committed, before `handler` runs | `(match)` |
| `route:ready` | `handler` resolved and the match is still current | `(match)` |
| `route:error` | `handler` or async redirect rejected and the match is still current | `(error, match)` |

Superseded navigations emit nothing after their `route`.

### Intercept rules

The router intercepts a `navigate` event only when all of the following hold:

- `canIntercept` is true; not `hashChange`; no `downloadRequest`; no `formData`.
- The destination is same-origin and `intercept(url)` returns true.
- The destination matches a route, alias, or falls `within` the not-found scope.

Everything else proceeds as ordinary browser navigation. A router whose `intercept`
excludes `/logout` therefore lets `<a href="/logout">` perform a full document load.
`history.pushState`/`replaceState` calls also fire `navigate`; they are subject to the
same URL-based rules.

Same-URL navigations dispatch again (`navigationType: 'replace'`). Applications decide
whether that reloads or no-ops.

Intercept is always called with `focusReset: 'manual'` and `scroll: 'manual'`. The
handler promise (from `handler`) defines when `transition.finished` settles.

## Driver contract

Drivers expose a subset of the Navigation API so the router never branches on
environment. Shipped: `navigationDriver(window.navigation)` and
`memoryDriver({ url })`. A future `pushStateDriver` is possible.

```js
driver = {
  capabilities: { cancelTraverse: boolean, interceptsLinks: boolean },
  currentEntry: { url, key, index, getState() },
  entries(),                                    // same shape as currentEntry
  navigate(url, { history, state, info }),      // → { committed, finished } (native promises)
  reload({ info, state }),
  back(), traverseTo(key),
  updateCurrentEntry({ state }),
  addEventListener('navigate', listener, { signal }),
};
```

`navigate` listener events expose: `destination` (`url`, `key`, `index`, `getState()`),
`navigationType`, `canIntercept`, `hashChange`, `downloadRequest`, `formData`,
`userInitiated`, `info`, `signal`, `cancelable`, `preventDefault()`,
`intercept({ handler, focusReset, scroll })`.

- The memory driver implements the same event sequence synchronously enough for
  deterministic tests, including supersession (a new `navigate` aborts the previous
  event's `signal`) and traversal.
- One shared conformance suite runs against every driver. The navigation driver's
  conformance run happens in browsers (Cypress component spec in the app during
  incubation; Playwright Chromium/Firefox/WebKit after extraction).

## Marionette layer: `@mnjs/router/outlet`

### `RouteState`

An `MnObject` that holds the current match for one outlet's subtree.

- `getMatch()`, `getName()`, `getParams()`, `getQuery()`, `getMeta()`, `getInfo()`,
  `includes(name)` (branch contains a node named `name`).
- `set(match)` triggers `change` with `(routeState, match, previousMatch)` when the
  match object changes.
- Created by `RouteOutlet` per selected child; passed to the child as `options.route`.

A child Application reads `options.route` in `prepareStart` and `onStart` (always the
latest match) and listens to `change` while running. There is no "remember the route,
then dispatch from `onStart`" protocol: the route is state seeded before start.

### `RouteOutlet`

A focused object owned by an Application that keeps exactly one selected child
Application. It is the extraction of app-frontend's `RouteBaseApp.selectChild` policy.

```js
initialize() { this.content = new RouteOutlet({ owner: this }); },

showPage(match) {
  return this.content.show('workflow', {
    key: { patientId: match.params.patientId },   // identity; omitted = always the same
    match,
    restart: false,                               // true = always stop + start
    options: { region: this.getView().getRegion('content') },
  });
},
```

`show(appName, { key, match, restart, options })` → `Promise<Application | undefined>`:

- The child must be registered with the owner (`childApps` / `addChildApp`).
- **Reuse**: same `appName`, `isEqual(key)`, `restart` false, and not currently being
  retired → `routeState.set(match)`; start the child if it stopped independently.
- **Replace**: stop the current child; only after its stop resolves `true` create a new
  `RouteState` seeded with `match` and start the child with `{ ...options, route }`.
- Newest call wins. Overlapping replacements share the in-flight stop; superseded calls
  resolve `undefined`.
- A stop resolving `false` does not authorize replacement. A rejected stop keeps the
  selection and rejects.
- Startup failure: stop partially started descendants, clear the selection, then reject
  with the original error. Cleanup failures go to the `onCleanupError(error, app)`
  option and never replace the original error. Failed cleanup retains the selection.
- Owner stop, restart, and destroy invalidate pending selection, even when the owner is
  already stopped (Marionette permits explicit child activation beneath a stopped,
  nonterminal owner).
- `stop()` invalidates and stops the current child. `getCurrent()` returns the selected
  Application or `null`.
- Rejections only reach the caller for the newest selection, so callers handle errors
  with an ordinary `.catch` instead of an `onRouteError` hook.

Child Applications use no base class. Error, loading, and refresh policy stay in each
Application.

## Focus and scroll

The router always intercepts with manual focus and scroll so every driver behaves the
same. It supplies the facts — `navigationType`, `key`, `url.hash`, `initial`, and the
`route:ready` timing — and the application owns the policy (views own focus within
their DOM). Recommended application policy:

- push/replace to a new page: after `route:ready`, focus the page heading or main region
  (`tabindex="-1"`) and scroll the content region to the top; honor `#fragment`.
- in-place navigation (e.g. opening a sidebar): per-route `meta.focus` decides.
- traverse/reload: restore region scroll positions saved per entry `key`.

## Testing strategy

- Unit: `node --test packages/router/test` with `memoryDriver`.
- Driver conformance: shared suite, run against `memoryDriver` in Node and
  `navigationDriver` in real browsers.
- Outlet: `node --test` with Marionette Applications that have no Region. If Marionette
  cannot run there without a DOM, stop and decide before adding a DOM shim.
- Application behavior: app E2E (the app's invariants, not the package's).
