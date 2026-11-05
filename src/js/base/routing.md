# Routing: named routes and owned child Applications

Read this before changing `src/js/routes.js`, `src/js/router.js`, the routing Radio bridge, or a routed app's `showRoute`.

The private `packages/router` workspace vendors the current Application-based `@mnjs/router` candidate. See [exact provenance](../../../packages/router/UPSTREAM.md) and [upstream API contracts](../../../packages/router/DESIGN.md). Marionette and its adapters use the compatible pinned 5.0.1 runtime.

## Route ownership

- `routes.js` is the single route catalog. Names remain the app's existing event strings. Named parameters identify workspace/resources; `meta.area` selects an area and `meta.isList` identifies list history. Existing URLs remain supported.
- `router.js` owns one `Router` Application and the native Navigation API driver. AppFrame registers it as a child and supplies the handler. Its preparation begins workspace prerequisites and enables the engine before awaiting them, so an initial asynchronous redirect does not block workspace startup and failures can still route. The router claims the root, permitted workspace slugs and the explicit root error URLs. Server-owned paths are outside its interception boundary. An initial unknown root URL loads the current workspace and shows not-found in place.
- `AppFrameApp` starts persistent navigation and an owned `ChildAppSwitcher` containing WorkspaceApp. Each handler selects the workspace with `key: { workspace: workspace.id }`, then awaits `WorkspaceApp.showRoute(match)`. Workspace switches update navigation controls while retaining the nav shell. Workspace activation destroys/recreates area apps: their state captures workspace-specific storage keys, filter states and transient search at construction. Ordinary navigation within one workspace reuses area/page instances.
- `WorkspaceApp` owns an independent SidebarService and an area switcher. It prepares workspace data and preloads permitted area modules in the existing order, registers area apps under that switcher when selected, checks the match signal after imports, selects the area and returns its `showRoute`. It coordinates nav selection and sidebar cleanup before area dispatch.
- Each area is a `ChildAppSwitcher` with its pages as registered children. Patient, program and flow shells reuse their resource key. Plain list/dashboard pages use `reconstruct: true` where selecting the same page must refresh it. A returned child handles match detail explicitly through `showRoute`.
- The standalone PDF `formservice.js` is a separate entry point and retains its Backbone router.

No Application owns URLs by listening to every Radio event. One engine matches and commits each route. The old EventRouter, RouterApp, SubRouterApp and copied selection implementation are removed.

## Navigation and compatibility

`Radio.trigger('event-router', name, ...args)` stays synchronous. RouterRadioService maps positional arguments onto the catalog's parameter order, excluding workspace. `workspace:<slug>` selects that workspace; `default` requests the root redirect. Additional patient action data becomes `info.entryTarget`; additional worklist options remain transient `info.worklist`. URL query strings do not select a worklist owner.

Use `Radio.request('router', 'navigate', name, params, options)` when the caller needs completion, query parameters, info or replacement history. It returns `navigate().finished`. The bridge supplies the current WorkspaceService slug when a route needs workspace and the caller omitted it, including after a root error route whose Match has no workspace. Explicit workspace parameters win. Radio navigation uses manual focus/scroll to preserve the existing Views' ownership of focus and panes. Other intercepted links and native traversals use the driver's native policy.

Root/workspace redirects select the owned-by list. Legacy flow links resolve the patient with a cancellation signal before redirecting. The three dashboard/archive patient aliases remain supported until September 2, 2027. Aliases are ordinary named redirect registrations, preserving query and hash while replacing the URL with the canonical path. Routine links/tests use canonical routes.

`notFound` navigates to `/404`; `unknownError` navigates to `/unknown-error` and carries its status in transient info. Error routes clear selected area content without requiring failed workspace prerequisites to load again. ErrorApp displays the error at those root routes and removes it on the next route. Workspace content is cleared for error routes. Back to Your Workspace uses the root redirect.

LatestListService records list name, parameters without workspace, query and transient list options from the committed Match. Back to List navigates by name with that filter and the current workspace. HistoryService emits `change:route` when a changed URL finishes its selected page or reports a current committed failure, so global modal cleanup cannot restore focus into a departing page and delegates Back to the native router, with the caller's fallback when there is no marked app entry. It does not patch Backbone.history or keep a second history stack.

## Readiness and cancellation

A Match contains `name`, named `params`, `query` (`URLSearchParams`), `info`, `meta`, `url` and `signal`. Route handlers return required activation work. Router Application `start()` enables routing; it does **not** await the initial route. Observe `getInitialDispatch()` for initial matched/unmatched/cancelled/failed status, `route:ready` for a current completed match, and `route:error` for current failures. AppFrame reports route failures. The exact initial workspace readiness failure remains owned by root startup, which presents permission/setup or startup recovery; its duplicate route notification is not reported again. Other route failures remain observable through the browser error channel. Subscribe to events directly or define prototype hooks with `.extend()`; constructor options are not triggerMethod hooks.

The returned readiness chain covers workspace data, the selected area, resource shell and selected page/detail. The program action route awaits an explicit sidebar operation, including cancellation when that sidebar is replaced. Independent patient sidebar/widgets, retained result loading, activity feeds and embedded forms keep their own loading/error lifetimes; route readiness does not promise every background request has finished.

Start a switcher before calling `switchTo`. Registration and switcher state belong to the owning Application tree. Same child and equal key join pending preparation or reuse an active child. Different keys and `reconstruct: true` stop/start the registered instance; new options alone do not update a running child. Pass `match.signal` into selection and check it after other awaits before applying effects. A superseded selection returns no child; return without dispatching stale detail. Stop/destroy clean up owned groups and cancel pending work.

Selection keys are value snapshots captured before child lifecycle effects. Keep them small: AppFrame uses a fresh `{ workspace: workspace.id }`; patient shells use `{ patientId }`; program/flow shells use `{ programId }` or `{ flowId }`. Those IDs are scalars from workspace data or named URL parameters. Area, clinician, dashboard, list and content selections omit a key, with `reconstruct: true` where refresh is required. Startup models, Regions, layout state and transient route info remain in `options`, never keys. No app caller passes a model, state tree, accessor, class instance or cross-realm container. The upstream key contract accepts same-realm acyclic plain data records/arrays and primitives; caller mutation does not change an existing selection's identity.

PatientApp owns a content switcher separate from the patient sidebar. Its interactions feed remains a direct child because it retains a loading/error shell and restarts itself. Selecting that feed clears the content switcher; selecting ordinary content stops the feed. Repeated interaction navigation calls its explicit update operation. Do not force self-refreshing retained content through a reconstructing selection.

Async preparation uses the Application lifecycle signal for fetches and checks it after awaits before starting children. Match signals and preparation signals have distinct lifetimes. A completed preparation signal is not a running-feature lifetime signal. Read the installed Marionette Application documentation for lifecycle details.

## Extending the route tree

1. Add the named path and appropriate area/list metadata to `routes.js`.
2. Map it to an area page; choose a resource key or explicit reconstruction, keeping action IDs and route-specific detail out of shell keys.
3. Pass explicit startup options and Region, then return any required page `showRoute(match)` operation. Keep sidebar/error decisions within their owning feature.
4. Preserve current URLs and test reachable UI navigation, supersession, errors, readiness and browser history. Generic service contracts may use component tests.

The browser must provide Navigation API, URLPattern and AbortSignal.any. There is no fallback or polyfill in this candidate. `window.router`, like the existing framework console exports, exposes public debugging operations. Cypress full-document visits stop the outgoing Router before visiting, so an intentional document load cannot be intercepted as same-document navigation; `cy.navigate` now uses the public navigation bridge.

Area modules retain the existing preload order because shared/domain styles currently depend on their ordering. Making area imports fully lazy is a separate stylesheet-ownership change; this branch does not change product styling to accommodate routing.
