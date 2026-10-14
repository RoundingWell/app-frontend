# Routing: show, specify, verify

## Show

Routing is composed from independent objects under `base/routing/`:

| Object | Responsibility | Depends on an Application? |
| --- | --- | --- |
| `createRouteTable` | Workspace prefix, canonical generation, aliases, route context | No |
| `EventRouter` | Backbone matching, raw query/splat arguments, synchronous Radio bridge | No |
| `createRouteDispatch` | Latest navigation authority, optional preparation, error policy | No |
| `createChildSelection` | Single selected destination, replacement, cleanup | No; takes public child callbacks |
| `createRouteDelivery` | Latest detail over shared resource readiness | No; takes start/read/write/dispatch callbacks |
| `createRouteActions` | Bound action dispatch and synchronous before/after notifications | No |

`NavApp` and `PatientApp` are real plain Applications using these objects.
`RouterApp`, `SubRouterApp`, and `RouteBaseApp` remain optional convenience adapters
for the other areas. They delegate to the same objects; consumers may use the
objects directly or supply their own selection/readiness policy. No URL nesting
creates an Application owner or requires a particular superclass.

For a plain Application, build definitions separately, bind actions explicitly,
and connect the URL adapter to dispatch:

```js
const table = createRouteTable({
  'patient:workflow': {
    route: ['patient/:patientId/workflow', 'patient/dashboard/:patientId'],
    action: patientId => patient.start({ patientId, region }),
  },
}, { workspaceSlug });
const dispatch = createRouteDispatch({
  dispatch: ({ route }) => route.definition.action(...route.eventArgs),
  onError: showRouteError,
});
const router = new EventRouter({ channel, routeTriggers: table.triggers });
router.listenTo(channel, 'patient:workflow', (...args) => {
  dispatch.accept(table.context('patient:workflow', args));
});
// The containing lifetime explicitly disposes both objects:
// dispatch.dispose(); router.destroy();
```

The example chooses unconditional `start`. For retained resource loading, use
`createRouteDelivery`, as PatientApp does. Connect `activated()` to the
Application's `start` event, `invalidate()` to departure/stop, and dispatch the
current route from `onStart` after building its shell. Same-resource detail changes
join one preparation and dispatch the newest route once. Do not connect the
navigation signal to that shared preparation's stop method.

The optional adapters retain the existing declarative shorthand:

```js
// RouterApp
childApps: { patient: PatientApp },
eventRoutes: {
  'patient:workflow': {
    action: 'showPatient',
    route: 'patient/:patientId/workflow',
  },
},
showPatient(patientId) {
  return this.startRoute('patient', { patientId });
},
```

A scoped child supplies `getRouteScope(options)` and `startRoute(context, options)`;
SubRouterApp supplies these from `routeScope` and `routeActions`. Plain PatientApp
supplies them explicitly using route delivery. Plain pages use `startCurrent`.
Use `routeScope: []` for a deliberately global scope; an omitted scope is an error
in SubRouterApp. Resource scope excludes detail IDs. The workspace owns fresh area
instances, so equal resource IDs in different workspaces cannot share old state.

## Specify

Baseline: develop `7f191c52e`. This change preserves the following product contract.

| Behavior | Existing owner and preserved result |
| --- | --- |
| Boot/auth | Auth handles full-document provider paths before main routing; formservice is a separate entrypoint/router |
| Workspace roots/splats | Nav registers `''`, workspace slug and `slug/*route`; a root workspace selection chooses its default worklist |
| Workspace transition | AppFrame retains Nav, replaces Workspace; Workspace fetches resources, rebuilds area routers, replays the URL |
| Permissions | Workspace only registers dashboards/clinicians/programs when permitted; unmatched protected paths reach error routing |
| Precedence | Backbone's existing reverse registration order; available area routes precede Nav's workspace splat and Error's catch-all |
| Patient routes | Workflow/open/closed, action, flow, flow focus/action and form all retain the same patient shell within scope |
| Patient flow | Plain page App; page replacement is distinct from shared patient preparation. Program flow remains scoped by flow ID |
| Program/clinician/dashboard | Existing page/sidebar selection, program/flow scope, clinician global scope and domain error mapping |
| Aliases | Three patient bookmark aliases remain supported through September 2, 2027; generation uses first/canonical route |
| Legacy flow URLs | Fetch patient identity, replace legacy URL, dispatch canonical event; obsolete resolvers cannot redirect |
| Radio arguments | Synchronous string events; positional IDs and transient `entryTarget`/clinician options remain intact |
| Query/encoding | Backbone extracts decoded positional path/splat arguments and a final raw query or null; filters are not query state |
| History | Backbone is the sole native owner. Event writes do not redispatch; matching URL callbacks do not create another entry |
| Silent writes | `replaceRoute` replaces without dispatch; `navigateRoute` pushes without dispatch. Existing product HistoryService still observes writes |
| Return to list | `meta.isList` feeds LatestListService; its named event/args differ from HistoryService's custom submit-back stack |
| Transition effects | Set current route → before:appRoute → nav/sidebar/latest-list effects → action → appRoute, before async readiness |
| Cancellation/errors | Latest selection wins; stop cancels Application preparation. Current route failures use domain policy; stale failures are observed and ignored |
| Unsaved work | Existing editor save/draft policies remain local. There is no new universal veto, URL rollback or automatic save on navigation |
| Focus/scroll | Views retain existing flow focus, missing-target fallback, sidebar focus and scroll policy; routing adds no global restoration |

Route contexts retain `{ event, eventArgs, definition: { action, route, root, meta } }`.
`getCurrentRoute()` and `getCurrentRouteMeta()` remain the adapter accessors.
Before/after adapter notifications still receive `(routerApp, routeContext)`.
They report dispatch, not page readiness. Return activation promises from handlers.
Put route failure presentation in `onRouteError`; keep async reporter failures
observed. Subroute notifications preserve their existing `(routeContext)` shape.

Selection stops the previous child synchronously before preparing a replacement.
Failed teardown retains the selection for retry. Failed activation cleans partially
started descendants; cleanup errors are reported separately from the activation
error. Owner stop/restart/destroy invalidates pending selection, including stopped
owners. RouteBaseApp supplies the mandatory lifecycle wrappers; direct users must
connect this policy themselves. PatientApp shows explicit wrappers because stopped
Applications do not repeat stop notifications. Constructors establish internal
objects without requiring subclasses to call preinitialize/initialize hooks.

Navigation authority, Application readiness and host lifetime are distinct.
`createRouteDispatch` supplies `{ route, signal, isCurrent }`; check `isCurrent()`
after awaits before effects outside Application preparation. The abort signal
invalidates route work; it does not stop a same-resource Application. Install new
authority before aborting old work so a synchronous abort callback can navigate.
Host/Region destruction still belongs to its existing owner; no generic root
View-destruction hook or speculative automatic restart has been added.

### Later extraction into mnjs/router

The inspected prototype is `950e4c6dc67ca3e6e378267a95845dc6965eeaa4`.
Its independent route/history/router primitives are the intended package boundary;
its `test/router/owner.mjs` is an ownership sketch, not an exported coordinator.
This app change does not add a dependency on unpublished code or change that repo.

Extract the independent authority and lifecycle objects only after their consumer
contracts settle. Keep workspace prefixes, Radio positional compatibility, route
meta and domain recovery in the app adapter. Align canonical definitions with the
prototype's named params/aliases when the package supports this app's splats and
optional paths. The current table deliberately retains repeated positional `:id`
patterns and Backbone grammar. Keep selection and shared route delivery optional.

A package history driver must replace Backbone's native ownership once, together
with HistoryService/registration/replay. Do not run two native history drivers.
Navigation API/URLPattern are not required by this implementation. Adopting them,
changing query/filter precedence, native versus product Back, unsaved guards,
refresh scope or entry scroll restoration requires a separate product decision
and browser verification. Current History API support remains unchanged.

## Verify

Helper/lifecycle checks (no browser and no Cypress):

```sh
npm run test:routing
npm run lint
npm run build -- --mode test
```

The Node tests use real Marionette 5.0.0 Applications for shared preparation,
replacement and cleanup, and cover authority reentrancy/error suppression. They do
not validate UI/history behavior.

Patient E2E coverage extends the existing routing scenario with Back/Forward and
retained shell/sidebar identity, and adds departure while a patient request is
pending. Existing flow-focus, aliases, worklist loading/filter races, workspace,
permissions, error and submit-back scenarios remain applicable. Generic adapter
component specs remain applicable too.

Cypress is held by explicit task instruction. Do not run Cypress or approve its CI
hold without fresh approval. After approval, run focused patient/default-route/
filter specs first, then the relevant full E2E and component suites under AGENTS.md.
Do not claim UI behavior validated from Node checks, build or source review.
