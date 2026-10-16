# @mnjs/router — moving upstream

How `packages/router` moves from app-frontend into the Marionette monorepo
(`marionettejs/marionette`, default branch `master`). The package contract stays in
[`DESIGN.md`](DESIGN.md); the app migration record is
[`docs/router-migration.md`](../../docs/router-migration.md). Section 5 holds proposals
only; nothing in it is implemented.

## 1. Extraction rehearsal (Phase 4)

What was verified before writing this:

- `npm pack -w packages/router` produces `index.js`, `outlet.js`, `src/**`, `readme.md`
  and `package.json` (10 files). Installed from the tarball into a scratch project with
  `@mnjs/utils@5.0.0` and `marionette@5.0.0` only, on Node 24.15:
  - `test/` copied into the installed package: 276/276 `node:test` tests pass.
  - `test/` copied beside `node_modules`: the driver, router, router-conformance and
    outlet suites (188 tests) pass through the `@mnjs/router` and
    `@mnjs/router/outlet` exports. `matcher.test.js` is a white-box test of the
    unexported `src/matcher.js` and only runs inside the package tree.
- Installed without `marionette`: `import '@mnjs/router'` works; only
  `@mnjs/router/outlet` fails, with `ERR_MODULE_NOT_FOUND` for `marionette`, as the
  optional peer intends.
- `npm run test:browser -w packages/router` runs both conformance suites against the
  native Navigation API in Playwright 1.63.0 (the version Marionette's
  `config/release-profile.json` pins): Chromium 153 37/37, Firefox 155 37/37,
  WebKit 26.6 36/37 (see [WebKit](#webkit-traverse-destination-state)).

Workspace-only assumptions found and fixed: the public-surface suites imported
`../src/*` instead of the package's exports, and the router conformance suite imported
`../../src/router.js`, which only resolves inside this source tree. They now import
`@mnjs/router` / `@mnjs/router/outlet`, so any runner that resolves the package can host
them.

Still workspace-dependent, by design while incubating:

- `outlet.test.js` needs `marionette` installed. Upstream, list it in the package's
  `devDependencies` (or rely on the monorepo root, where core is the root package).
- `src/js/base/router-driver.component.cy.js` (app) imports the conformance suites by
  repo-relative path. Test files are not published, so after extraction the app spec
  is deleted; the three-engine run in the monorepo replaces it. App E2E keeps covering
  the app's invariants.

### WebKit: traverse destination state

WebKit 26.6 returns `undefined` from `NavigateEvent.destination.getState()` for a
traversal, while `navigation.entries()[i].getState()` and, after commit,
`navigation.currentEntry.getState()` return the entry's state. A raw Navigation API
reproduction (no router code) shows the same result; Chromium 153 and Firefox 155
return the state. The router reads `destination.getState()` when it builds a match
(`src/router.js`, `#navigationFor`), so in WebKit a traversal's `match.state` is `{}` and
a redirect hop after a traversal drops the entry's state. app-frontend reads no entry
state, so the app is unaffected.

Classification: browser engine bug, with a package-level effect on Safari-class
engines. Candidate fix (not made): `navigationDriver` reads a traverse destination's
state from the entry whose `key` matches `destination.key`. It needs a decision because
it changes Safari behavior. Report it to WebKit with the reproduction, and confirm on
Safari 26.2, since Playwright WebKit is the closest available signal, not Safari.

## 2. Monorepo placement and build

Place the package at `packages/router`, next to `packages/utils` and `packages/radio`,
and add it to the root `workspaces` after `packages/radio` (utils → radio → router; the
router depends on utils only, and the outlet's `marionette` import is the root package).

Build it like radio, wrapping the ESM source, which stays the source of truth:

- `rollup.config.mjs` with two inputs, `index.js` and `outlet.js`, externals
  `@mnjs/utils` and `marionette`, each emitted as `dist/<entry>.js` (ES) and
  `dist/<entry>.cjs` (CJS, `exports: 'named'`) with source maps, through
  `build/babel.js` like radio.
- Types: `tsconfig.declarations.json` with `allowJs`, `declaration` and
  `emitDeclarationOnly` over the JSDoc in `src/**` (the typedefs `Match`, `Driver`,
  `RouteDefinition` and the outlet options already exist), and add `router` to the
  package allowlist in `build/declarations.mjs` so it writes `dist/types/esm` and
  `dist/types/cjs`. Whether upstream converts the source to TypeScript, as radio and
  utils are, is upstream's decision. This repo stays JavaScript.
- `package.json` after the build exists:

  ```json
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/types/esm/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/types/esm/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/types/cjs/index.d.ts", "default": "./dist/index.cjs" },
      "default": "./dist/index.js"
    },
    "./outlet": {
      "import": { "types": "./dist/types/esm/outlet.d.ts", "default": "./dist/outlet.js" },
      "require": { "types": "./dist/types/cjs/outlet.d.ts", "default": "./dist/outlet.cjs" },
      "default": "./dist/outlet.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist/", "readme.md", "license.txt"],
  "scripts": {
    "build": "node ../../build/clean.js && rollup -c rollup.config.mjs && node ../../build/declarations.mjs router",
    "prepack": "npm run build"
  },
  "repository": { "type": "git", "url": "https://github.com/marionettejs/marionette.git", "directory": "packages/router" }
  ```

  Remove `"private": true`. `publishConfig`, `sideEffects`, `engines`, `keywords` and
  `license` are already aligned with radio.
- CJS caveat for the docs: the router holds no module-level state, but `RouteOutlet`
  extends `MnObject`, so an ESM owner Application should use the ESM outlet (the
  same "do not mix formats" note radio's readme carries).
- Tests: the monorepo runs Vitest. The conformance suites take `describe`, `it` and a
  Chai-style `assert` as arguments, so Vitest (whose `assert` is Chai's) can run them
  as-is. Port the `node:test` unit suites to Vitest or keep a `node --test` script, as
  the root already does for other suites. Move `test/browser` under the root
  Playwright config (`npm run test:browser`) as a project for this package.
- License: the package declares MIT, but this host repository is CC BY-NC 4.0 and
  ships no MIT text for the package. Before extraction, the copyright holder for
  `license.txt` has to be settled (RoundingWell contribution to the MIT monorepo). That
  decision is open.

App side, after the first publish: depend on the exact published version, drop
`packages/router` from the root `workspaces`, delete the ESLint boundary blocks for
`packages/router/**`, remove the package tests from the CI lint job, and delete
`router-driver.component.cy.js`.

## 3. Version alignment with Marionette 5.x

Radio, utils, data, adapters and core are versioned and released together. The router
joins that lockstep instead of publishing `0.1.0`:

- The first public release is the Marionette 5.x minor that ships it (the next minor
  after 5.0.0, so 5.1.0 if nothing else claims it), with `@mnjs/utils` pinned exactly to
  that version and the optional `marionette` peer at that same exact version, matching
  how the family pins `@mnjs/utils`.
- The outlet relies on Marionette 5.0.0 behavior (synchronous `stop()` returning
  `true`; superseded starts resolving `false`; `before:start`, `before:stop` and
  `before:destroy` ordering). A core change to those contracts is a router change and
  needs its outlet tests in the same release.
- app-frontend pins `marionette` 5.0.0 today, so adopting the published router means
  moving to the release that contains it.

## 4. Browser floor and Marionette documentation

### Floor

- The Navigation API is Baseline "Newly available" (Chrome/Edge 102, Firefox 147,
  Safari 26.2, January 2026). URLPattern: Chrome 95, Firefox 142, Safari 26.0. Neither
  is "Widely available" yet; the Navigation API reaches it about 30 months after
  January 2026.
- Marionette core targets "Widely available" (`transpilationQuery: baseline widely
  available` in `config/release-profile.json`; `docs/guides/production.md`). The router
  declares its own, narrower floor, and core stays unaffected: core neither imports nor
  re-exports the router.
- No polyfill is shipped or recommended. The driver seam allows a History API driver
  later (see 5c), which is the path to a Widely available floor.
- Node: `>=24.15.0` (global `URLPattern`), narrower than the family's
  `^22.22.2 || >=24.15.0`. Node 22 lacks a global `URLPattern`.

### Changes to Marionette's routing docs

The routing guide on `master` is `docs/guides/routing.md`, identical to the copy in
`marionette@5.0.0`. It says "Choose browser navigation or a separate router", and its
examples are hand-rolled `hashchange` listeners. Its "Choose the URL owner" section
describes hand-rolling the History API (`popstate`, explicit dispatch after
`pushState`). The older `docs/routing.md` on the `next` branch (v4 era: core holds no
opinion on routing, plus a list of community routers) should not be revived. Concrete
changes:

1. Intro: name `@mnjs/router` as the family's router for path-based applications, and
   keep "Connect route decisions to the owner" as the rule. A router is still optional:
   the fragment example stays for a small single-page tool.
2. "Keep a shell while changing its content": keep the fragment example, retitled
   "Without a router (fragments)".
3. "Choose the URL owner": replace the History API paragraph with when to choose
   `@mnjs/router` (nested routes, redirects, aliases, supersession, awaited readiness),
   its browser floor versus core's, server fallback for direct links, and the
   one-URL-owner rule (one `Router` per document; embedded features take routes from the
   host). Link `docs/packages/router.md`.
4. "Route to asynchronous features": replace the hand-rolled `showRoute`, `currentRoute`
   bookkeeping, manual child `stop()` and not-found branch with the router version:
   `new Router({ routes, notFound, handler: match => app.showRoute(match) })`, a
   `RouteOutlet` owned by the navigation Application, `show(name, { key, options })`,
   `if (!child) return` for supersession, and `.catch` at the `show` call for start
   failures. State that `navigate().finished` settles when the page is ready, and
   `false` means superseded.
5. Focus: the router intercepts with manual focus and scroll. Move focus after
   `route:ready` for push and replace navigations, except `initial`, and keep the
   existing advice about filters that keep their content.
6. "Check navigation": add `memoryDriver` for Node and Vitest tests of route tables and
   handlers, and real-browser checks for traversal and focus.
7. New `docs/packages/router.md` (mirrors `docs/packages/radio.md`): the API table,
   events, the driver contract, `RouteOutlet`, and the floor. Add it to the package
   `files`, `docs/readme.md`, the `docs/agents.md` task table, `docs/api.md` and the
   docs manifest.

## 5. Proposals (not implemented)

### a. RouteOutlet awaits page activation itself

Today each host writes the activation:

```js
const page = await this.pages.show(name, { key, options }).catch(onStartError);
if (!page) return;
return page.showRoute(match);
```

The alternative: `show()` takes the match (or an `activate` callback), calls and awaits
`child.showRoute(match)`, and resolves with that result.

- For: app-frontend repeats the three lines in five hosts (AppFrame, WorkspaceApp, and
  the Clinicians, Patients and Programs areas). Forgetting the `return` breaks D4
  (`finished` before the detail is ready) without failing anything immediately.
- Against: the outlet stopped reading the match in Phase 3c (RouteState removal) and
  would read it again. It would impose a method-name protocol on child Applications,
  and pages without per-match detail would need an opt-out (the Programs area already
  skips activation for `programsAll`). It would also merge two
  error policies that hosts keep apart today: a start failure (`.catch` at `show`) and
  a detail failure. The hosts also differ (AppFrame checks `signal.throwIfAborted()`;
  WorkspaceApp reads `getChildApp` after `show`).

Recommendation: keep host-driven activation. Document the three-line pattern in
`docs/packages/router.md` and the routing guide as the canonical D4 form. Revisit
an `activate` callback only if a second application repeats the same mistakes.

### b. Outlet as `@mnjs/router/outlet` versus a separate package

- Subpath (today): one version, one install, one docs page. The optional peer keeps
  core-only users free of `marionette`, and `sideEffects: false` keeps it out of
  bundles that never import it.
- Separate package (`@mnjs/outlet` or `@mnjs/router-outlet`): `marionette` becomes a
  required peer, which is more honest than an optional peer that npm cannot enforce.
  Notably, `RouteOutlet` imports nothing from the router: it selects a keyed child
  Application and works for any selector, not just routes.
- Cost of separating: another lockstep package to build, document and release, with no
  consumer outside routing today.

Recommendation: ship the subpath in the first release. Because the family versions in
lockstep, a later split, or a move of a generic "selected child Application" primitive
into core, is cheap. Make that move when a non-routing consumer appears.

### c. Comparison with the Marionette router prototype

Prototype:
[`packages/router/readme.md` at 950e4c6](https://github.com/marionettejs/marionette/blob/950e4c6dc67ca3e6e378267a95845dc6965eeaa4/packages/router/readme.md)
(with its `design.md`). Contract differences:

| Topic | Prototype | @mnjs/router |
| --- | --- | --- |
| Surface | `createRoutes`, `createRouter`, `createBrowserHistory`; `dispose()` is terminal | `new Router({ routes, driver, handler })`; `stop()`/`start()` restartable |
| Transport | History API driver (`read`, `write`, `subscribe`, `go`) and memory; "newer Navigation/URLPattern APIs are not required" | Navigation API driver and memory driver; History API driver possible later |
| Matching | literal and named segments, first match wins | URLPattern, nested tree, ranking by specificity, optional groups, wildcards |
| Aliases, redirects | aliases match without rewriting; no redirects | aliases with `canonicalize`/`preserve` and `until`; sync and async redirects |
| Outcome | `handled`, `failed`, `superseded`, `reflected`, `unchanged`, `disposed`; `handled` is not "content ready" | `Promise<boolean>` (`false` = superseded), rejection on failure; `finished` means the awaited handler resolved (D4) |
| Authority | `context.signal`, `isCurrent()`, `runIfCurrent(effect)` | `match.signal`; the outlet and child lifecycles fence DOM commits |
| Repeat and refresh | equal URL dispatches `repeat`; `refresh({ info })` dispatches without writing history | equal URL replaces and dispatches (`navigationType: 'replace'`); `refresh()` replaces the entry and takes no `info` |
| State | omitted state is kept on replace and reflect; explicit `null` clears | kept on a same-path replace; a replace to another path or a push starts empty |
| Links | no click interception | the Navigation API intercepts links; `intercept(url)` decides ownership |
| Errors | `onError` option | `route:error` event and a rejected `finished` |
| Tooling | TypeScript declarations, Vitest with 100% per-file thresholds, type tests, Playwright | JSDoc, `node:test`, shared conformance suites, Playwright on three engines |
| Migration | test-only Backbone bridge for family-by-family cutover | app cut over whole; no bridge |

What to adopt:

1. A History API driver built from the prototype's native-history semantics (adopt the
   initial entry with `replaceState`, keep foreign plain-object state fields, use `null`
   keys for unowned traversal entries). It is the route to core's Widely available
   floor, and the driver seam and conformance suite already define its contract;
   capabilities differ (`interceptsLinks: false`), so it also needs link-click
   delegation.
2. `refresh({ info })`, so a soft reload can carry intent, as `navigate` does.
3. The prototype's tooling bar: generated declarations, type tests, and per-file
   coverage thresholds for the package suites.
4. Not adopted: string outcomes (Marionette v5 settles on `Promise<boolean>`),
   `isCurrent()`/`runIfCurrent()` (`match.signal.aborted` covers the same need), and the
   Backbone bridge (no remaining consumer).

Where "reflect" fits: the prototype's `reflect(target)` replaces the URL without
dispatch, settles `reflected`, and invalidates older authority. Its motivating case is
this app's interactions feed: clear the deep-linked `interactionId` before the feed's
own date or filter operation. In @mnjs/router it would be a separate method,
`reflect(nameOrUrl, params?, { query, state })` → `Promise<boolean>`, not a `navigate`
option. It would:

- replace the driver entry with an intercepted navigation whose `info` carries a router
  marker, so the router's own listener commits without running the handler;
- install the re-matched URL as `getCurrent()`, so `url()` and `persistParams` follow it;
- abort the previous match's `signal`, as the prototype invalidates older authority;
- emit a distinct `route:reflect` event instead of `route`, so URL followers
  (latest-list, nav selection, analytics) can update without treating it as a page
  change;
- keep entry state like a same-path replace.

It needs a conformance scenario on both drivers, and it is added with its first
application caller, as DESIGN.md already states.
