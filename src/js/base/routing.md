# Application routing

Use the published `@mnjs/router` package with this app's Marionette runtime.
Read its installed [README](../../../node_modules/@mnjs/router/readme.md) and
[design/API reference](../../../node_modules/@mnjs/router/DESIGN.md) for library
contracts. This document covers application policy.

## Ownership

- `router.js` creates the shared Router and declares root, error and workspace
  URLs. Features declare their own `routes` alongside `childApps`.
- `areas.js` lists feature permissions, navigation identities and loaders. It
  loads permitted feature classes in the established stylesheet order and
  compiles their native route tables without constructing UI instances.
- AppFrame owns that session registration. It survives UI stop/restart and is
  unmounted by owner destruction. Workspace changes do not replace the table.
- AppFrame selects the current workspace explicitly. Workspace fetches its data
  before constructing area apps, because they capture workspace-specific stores
  and filters. Switching workspaces destroys those area instances.
- Native `mount` entries then select resource shells and call their local leaf
  handlers. The patient mount supplies the `patient` namespace. Aliases that
  introduce patient IDs stay outside that mount.
- Restricted features are not loaded or registered. Their direct URLs show
  not-found; their absent names are ignored by the event bridge. Server-side
  authorization remains independent.

`RouteApp` only supplies the app's cleanup-error reporter. Use the published
`switchTo` API directly for ordinary page selection. Keep domain loading,
sidebar operations and failure presentation in the owning feature.

## Startup, completion and errors

Workspace preparation must run while an initial legacy resource lookup may
still be pending. AppFrame observes the initial workspace selection and Router
activation together. The initial selection's exact failure belongs to root
startup; other navigation failures use browser error reporting.

Return required work from route handlers, including detail/sidebar completion.
Keep match authority checks after awaited domain work. Handle mounted startup
failures through `handleRouteError` with `phase: 'start'`; unexpected detail
failures retain their rejection instead of entering startup recovery.

Patient Interactions is an independently retained child because it owns its
loading/error shell and refreshes itself. Its stable first-presentation promise
covers filter replacements before initial content or a handled error is shown.
Stopping settles that promise. Other patient content uses normal selection.

Legacy flow lookup failures clear the current area and sidebar without starting
Patients solely to clear it. Root error commits use the same cleanup without
reloading failed workspace prerequisites. The outgoing patients area releases
its dialer context through its stop hook.

## Existing navigation callers

`Radio.trigger('event-router', name, ...args)` stays synchronous. The bridge
maps positional arguments to each registered route's parameter order, fills the
current workspace, and retains transient worklist/action/error options. It uses
manual focus/scroll because Views own pane focus and scrolling.

`Radio.request('router', 'navigate', name, params, options)` returns the original
completion promise. `navigate:event` observes fire-and-forget rejection using a
per-call reporting token: AppFrame reports the exact failure once, while the
bridge still reports driver/setup failures that never reached route handling.
The token is transient and never stored in browser history.

HistoryService calls the shared Router directly for Back, with the caller's
synchronous empty-history fallback. It observes completion and emits modal cleanup only
once the changed page completes or reports a current committed failure. It
keeps no separate stack. LatestListService stores the committed list's name,
parameters, query and transient options for Back to List.

Automatic notFound recovery uses replacement history to avoid retry loops on
Back. Ordinary navigation and unknownError retain their normal history behavior;
unknownError also represents background errors on otherwise valid pages.

## Compatibility

The three patient dashboard/archive aliases remain through September 2, 2027.
Use native named redirect objects; omitted parameters, query and hash are
forwarded by the package. Root/workspace and resolved legacy-flow redirects
explicitly clear query/hash to retain this app's default destinations.

The PDF formservice remains a separate Backbone-router entry point. The shared
Router uses native Navigation when available and otherwise dynamically imports
the official History driver. Other required browser APIs are checked before the
application import. The History-only chunk is excluded from eager preload and
service-worker precache; existing runtime script caching can retain it after use.
First offline use therefore requires a previously cached copy. Preserve
shared/domain stylesheet order when changing area loads.

Native clients use explicit pathname-based Datadog view boundaries;
History-driver clients retain the SDK's automatic History tracking.
Its query-only native URL context limitation and Back destination duplicate
reporting remain separate compatibility limitations. Do not mirror history or
add global error-identity deduplication to conceal them.

## Tests

Keep application URL/name/positional-argument checks beside area registration,
service adapter contracts beside their services, and existing user journeys in
feature E2E specs. Router matching, keys, redirects and driver conformance are
owned by the upstream package; this repository has no separate router test suite.
