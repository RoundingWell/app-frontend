# @mnjs/router — design (incubating in app-frontend)

Status: incubating at `packages/router`; every app-frontend area runs on it. Extraction
to the Marionette monorepo as `@mnjs/router` is Phase 4 of the migration. The application
migration plan lives in [`docs/router-migration.md`](../../docs/router-migration.md).

## Goals

- Replace `Backbone.Router` / `Backbone.history` with named, nested routes over the
  [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
  and [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern).
- Simple applications use only the core `Router`.
- Applications composed of many asynchronous Marionette Applications use the optional
  `@mnjs/router/outlet` layer (`RouteOutlet`) — composition, not base classes.
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
  outlet.js           Marionette layer: RouteOutlet (optional peer dep: marionette)
  src/**              implementation
  test/**             node:test suites (`npm test`); test/browser: Playwright conformance page
  playwright.config.js  `npm run test:browser` (Chromium, Firefox, WebKit)
  readme.md           published overview
  DESIGN.md
  UPSTREAM.md         extraction plan for the Marionette monorepo
```

- `exports`: `"."` → `index.js`, `"./outlet"` → `outlet.js`, `"./package.json"`.
- Core dependencies: `@mnjs/utils` only (`Events`, `extend`). No `backbone`,
  `underscore`, `marionette`, `js/*`, or app imports. The outlet layer may import
  `marionette` and `@mnjs/utils`. `marionette` is a peer dependency, declared optional
  in `peerDependenciesMeta` because only `@mnjs/router/outlet` needs it.
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
- A malformed percent-escape in a matched segment makes `match()` return `null`.
- Unmounting a parent route deactivates mounts nested under it; they return if a
  parent with that name is mounted again.
- `branch[].path` is the node's full resolved path.
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
  matches the target instead. Redirect chains are capped (`maxRedirects`, default 5);
  beyond that the last source match emits `route` then `route:error` and `finished`
  rejects. A throwing synchronous `redirect` is reported as `route:error`.
- Redirects and canonicalizing aliases are performed as a `replace` navigation, because
  an intercept handler cannot rewrite its own URL. The original navigation is
  superseded by the driver; the router resolves the caller's `committed`/`finished`
  with the outcome of the final hop, so they mean "the final page is ready", not
  `false`. `back()` does not follow redirect chains.
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
  navigationType,                   // 'push' | 'replace' | 'traverse'; never 'reload' (see Intercept rules)
  initial,                          // true for the start() dispatch
  info,                             // per-navigation transient data (not persisted)
  state,                            // persisted entry state (driver getState())
  key,                              // history entry key
  signal,                           // aborted when the next match commits, the navigation is
                                    // superseded, or the router stops (also after `finished`)
  userInitiated,
}
```

`notFound` matches have `name` equal to the configured not-found name, empty `meta`
and `branch`, and the params of the deepest unnamed prefix node whose path contains the
URL (`workspace` for `/w1/unknown` under `/:workspace`), so `persistParams` keeps
working while not-found is current. Without a containing prefix node, `params` is empty.

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
| `start()` | Matches the current URL, applies alias/redirect policy, dispatches with `initial: true` (`navigationType` is `'push'`; `initial` carries through redirect hops). Resolves the initial `Promise<boolean>` outcome: `false` when superseded or stopped, and also without dispatching when the URL is not the router's (`intercept` false, or no route outside the not-found scope). Rejects with the handler failure after emitting `route:error`. Idempotent while started; may be called again after `stop()`. Navigation does not emit `navigate` for the initial document load; `start()` is the only initial dispatch. |
| `stop()` | Removes driver listeners, aborts the in-flight navigation signal. Idempotent. |
| `navigate(nameOrUrl, params?, options?)` | A string starting with `/` or a scheme plus `//` is a URL and the second argument is `options` (`navigate(url, options)`); anything else is a route name (`navigate(name, params, options)`), since names such as `patient:flow` look like schemes. Options: `history` (`'auto' \| 'push' \| 'replace'`), `query`, `info`, `state`. Omitted `state` on a navigation that replaces the current entry (explicit `replace`, or `auto` to the same URL) on the same path keeps that entry's plain-object state and adds only the router marker; a push starts with the marker alone; explicit `state` replaces the entry's state (see [Entry state](#entry-state)). Returns `{ committed, finished }`; both resolve `false` when superseded or aborted and never reject with `AbortError`. `finished` resolves `true` after the handler resolves and rejects with handler failure. |
| `url(name, params?, { query })` | Canonical URL string. Throws for unknown names, missing params, a value that is the dot segment `.` or `..` (URL parsing would resolve it away and name another route; wildcard values are checked per segment) and a value whose encoded form fails the param's own regex (`:id(\\d+)`). What `url()` builds, `match()` returns as the same route and params (aliases excepted: an alias URL matches the canonical name and `url()` builds the canonical path). |
| `match(url)` | Pure match (no redirect side effects) of routes and aliases; the not-found scope is dispatch policy and is not included. Returns a match or `null`. Navigation-only fields (`navigationType`, `signal`) are `null`, `initial` is `false`, `key` is `''`. |
| `getCurrent()` | The committed current match. |
| `refresh()` | Re-matches the current URL and dispatches with `navigationType: 'replace'` without adding an entry. Use after the route table changes. |
| `mount(routes, { parent })` | Adds routes (optionally under a named parent) and returns `unmount()`. Mounting does not dispatch; call `refresh()` if needed. |
| `getAliases()` | `[{ name, path, until, policy }]`. |
| `getParamNames(name)` | Parameter names of the canonical path, in path order (for positional bridges). |
| `hasRoute(name)` | Whether a mounted route has this name. |
| `canGoBack` / `back()` | Only counts entries this router created or dispatched (marked in entry state), so pre-application entries such as auth redirects are excluded. `back()` resolves `false` when there is no router-owned entry. |
| `updateState(state)` | Merges into the current entry's persisted state. State must be a plain object. |

The router marks entries it creates or dispatches with a reserved `'@mnjs/router'` key
in entry state (merged, never overwriting caller keys). The key is stripped from
`match.state`; a marked entry without caller state reports `{}`. `canGoBack` is true
only when the entry before the current one is marked.

Events (`Events` from `@mnjs/utils`, so `listenTo(router, …)` works):

| Event | Timing | Arguments |
| --- | --- | --- |
| `route` | URL committed, before `handler` runs | `(match)` |
| `route:ready` | `handler` resolved and the match is still current | `(match)` |
| `route:error` | `handler` or async redirect rejected and the match is still current | `(error, match)` |

Superseded navigations emit nothing after their `route`.

A match is installed as current, and its controller as the current controller, before the
previous controller is aborted. A navigation or `stop()` started from an abort listener of
the previous match or from a `route` listener therefore supersedes the navigation being
committed: the router rechecks that it is still current after the abort and after the
`route` event, skips the handler and `route:ready`, and settles `finished` as `false`
(an `AbortError` thrown from the intercept handler).

### Navigate, repeat, refresh and reflect

Four ways to reach a URL, all dispatching through the handler unless noted:

- **navigate**: `navigate(name | url, ...)` builds the target and asks the driver for a
  `push` (default `auto`). The handler runs and `finished` settles when the page is ready.
- **repeat**: navigating to the URL that is already current (`auto`) replaces the entry
  and dispatches again with `navigationType: 'replace'`. The application decides whether
  that reloads (nav re-selection reloads lists) or no-ops. The entry's state is kept.
- **refresh**: `refresh()` replaces the current entry with its own URL and state and
  dispatches again; use it after the route table changes.
- **reflect** (not built): a URL change that updates the address bar and entry without
  re-dispatching, for state the page already shows (a filter the page itself changed).
  It would be a `navigate` option that commits the driver entry and emits no `route`.
  It is added when an application caller needs it; until then pages navigate (repeat) or
  keep the state out of the URL.

### Entry state

Entry state is a plain object persisted by the driver per history entry. The router
reserves one marker key (`'@mnjs/router'`) and never exposes it in `match.state`.

- `navigate()` with `state` stores exactly that state (plus the marker).
- `navigate()` without `state` keeps the existing state when the navigation replaces the
  current entry (explicit `history: 'replace'`, or `auto` to the same URL) and stays on the
  same path, so a repeat or a query/hash update does not wipe what `updateState()` or an
  earlier navigation saved. A replace to another path starts with the marker only, as the
  native API clears state, so one page's state never follows the user to another. State
  that is not a plain object is dropped. A push creates a new entry with the marker only.
- `refresh()` and redirect hops carry the entry's state through.

### Intercept rules

The router intercepts a `navigate` event only when all of the following hold:

- `canIntercept` is true; not `hashChange`; not `navigationType: 'reload'`; no `downloadRequest`; no `formData`.
- The destination is same-origin and `intercept(url)` returns true.
- The destination matches a route, alias, or falls `within` the not-found scope.

A `downloadRequest` of `''` (a bare `download` attribute) counts as a download.
A `reload` navigation (`location.reload()`, `navigation.reload()`) asks for a new
document, so it is never intercepted; `refresh()` is the router's soft reload and
navigates with `replace`. Everything else proceeds as ordinary browser navigation. A router whose `intercept`
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
  capabilities: { cancelTraverse: boolean, interceptsLinks: boolean }, // navigationDriver: cancelTraverse false
                                                // (browsers cancel traversals only with user
                                                // activation; read event.cancelable)
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

- `entry.url` and `destination.url` are absolute URL strings, as in the native API.
  `destination.key` is `''` and `destination.index` is `-1` for non-traverse
  navigations; read `driver.currentEntry` after commit. Superseded or canceled
  navigations reject with an error named `AbortError`.
- A new navigation aborts the ongoing navigation's `signal` before its own `navigate`
  event dispatches, even if a listener then cancels the new navigation (shared
  conformance scenario).
- The memory driver also offers test helpers `simulate(url, opts)` (link click,
  `pushState`, form submission) and `documentNavigations` (URLs no listener
  intercepted). It does not record `focusReset`/`scroll`.
- The memory driver implements the same event sequence synchronously enough for
  deterministic tests, including supersession (a new `navigate` aborts the previous
  event's `signal`) and traversal.
- One shared conformance suite runs against every driver. The navigation driver's
  conformance run happens in browsers: the package's Playwright run on Chromium,
  Firefox and WebKit (`npm run test:browser`), and the app's Cypress component spec
  until extraction.

## Marionette layer: `@mnjs/router/outlet`

### `RouteOutlet`

A focused object owned by an Application that keeps exactly one selected child
Application. It does not read the match: the host passes the child what it needs as
start options, then activates the match with an explicit, awaited call.

```js
initialize() { this.content = new RouteOutlet({ owner: this }); },

async showRoute(match) {
  const { patientId } = match.params;
  const patientApp = await this.content.show('patient', {
    key: { patientId },                           // identity; omitted = always the same
    restart: false,                               // true = always stop + start
    options: { patientId, region: this.getView().getRegion('content') },
  });

  if (!patientApp) return;                        // superseded

  return patientApp.showRoute(match);
},
```

`show(appName, { key, restart, options })` → `Promise<Application | undefined>`:

- The child must be registered with the owner (`childApps` / `addChildApp`).
- **Reuse**: same `appName`, `isEqual(key)`, `restart` false → keep the running child;
  start it with `options` if it stopped independently.
- **Replace**: stop the current child and start it with `options`. Marionette 5.0.0
  `stop()` is synchronous and returns `true`, so replacement never waits for the old
  child; only starting is asynchronous.
- Newest call wins; superseded calls resolve `undefined`, including a call made
  obsolete re-entrantly while the old child stops.
- A `stop()` that throws (for example an `onBeforeStop` hook) keeps the selection and
  rejects the newest `show`.
- Startup failure: stop partially started descendants, clear the selection, then reject
  with the original error. Cleanup failures go to the `onCleanupError(error, app)`
  option and never replace the original error. Failed cleanup retains the selection.
- Owner lifecycle events invalidate pending selection: `before:stop`, `before:destroy`,
  and `before:start` of a running owner (a restart). The owner's `stop` clears the
  selection; its `destroy` clears it and destroys the outlet.
- `stop()` invalidates and stops the current child. `getCurrent()` returns the selected
  Application or `null`.
- Rejections only reach the caller for the newest selection, so callers handle errors
  with an ordinary `.catch` instead of an `onRouteError` hook.

`onCleanupError` defaults to a no-op. The outlet only listens to the owner and never
replaces its methods. Owner restart invalidates pending selection but leaves the
selected child running. Key equality is structural (primitives, arrays, plain objects).

A child whose first start is superseded by that child's own `restart()` (a feed that
reloads itself while its initial load is pending) resolves `false` while it is not yet
running, so the outlet stops it. Such a child is started by its host without an outlet.

Known gaps of event-based invalidation:

- Stopping an already-stopped owner emits nothing. Marionette still stops its children,
  which cancels their pending starts (so a pending `show` resolves `undefined`), but the
  outlet keeps its stopped selection; the next `show` reuses or replaces it like any
  independently stopped child.
- Starting a stopped owner emits the same `before:start` as restarting it, so only a
  restart of a running owner invalidates; a `show` begun from the owner's own
  `onBeforeStart` is not canceled.

Activation is the host's explicit call. `show` resolves with the running child once its
shell is ready (a patient, a program); the host then calls a method on it with the match
(`child.showRoute(match)`) and returns that promise. The router handler awaits it, so
`finished` settles when the detail is ready. Supersession of the detail is the child's
own outlet or lifecycle (starting a newer detail, or stopping the child), so an obsolete
detail never commits DOM or focus. A page with no per-match detail needs no method:
`show` resolving means it is ready.

Child Applications use no base class. Error, loading, and refresh policy stay in each
Application.

## Focus and scroll

The router always intercepts with manual focus and scroll so every driver behaves the
same. It supplies the facts — `navigationType`, `key`, `url.hash`, `initial`, and the
`route:ready` timing — and the application owns the policy (views own focus within
their DOM). Recommended application policy:

- push/replace to a new page: after `route:ready`, focus the page heading or main region
  (`tabindex="-1"`) and scroll the content region to the top; honor `#fragment`.
  Not on the initial load, where the document load already announces the page.
- in-place navigation (e.g. opening a sidebar): per-route `meta.focus: false` opts out
  of the focus move; the route owns focus.
- traverse: restore region scroll positions saved per entry `key` (owned by the Views
  that scroll).

app-frontend v1 (`AppView`) implements the focus part for the content region as the main
region: a new page takes focus there except on the initial load. No route needs the
`meta.focus` opt-out yet (pages that focus their own targets do so after `route:ready`).
Scroll is not managed: every page scrolls inside its own region, never the content
region, so per-entry scroll restoration belongs to the Views that own those regions.
Fragment handling is not implemented.

## Testing strategy

- Unit: `npm test -w packages/router` (`node --test "test/*.test.js"`) with `memoryDriver`.
  The public-surface suites import `@mnjs/router` and `@mnjs/router/outlet`, so they also
  run against a packed install.
- Driver and router conformance: shared suites, run against `memoryDriver` in Node and
  `navigationDriver` in real browsers (Playwright and the app's Cypress spec).
- Outlet: `node --test` with Marionette Applications that have no Region (no DOM shim).
- Application behavior: app E2E (the app's invariants, not the package's).
