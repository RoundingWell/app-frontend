# Routing: show, specify, verify

## Show

The recommended opt-in is a binding installed in a plain Application's
`initialize`. PatientApp uses `bindRouteApplication`; PatientsMain and Nav use
`bindApplicationRouter`. Applications do not override constructors for routing.

```js
const Patient = Application.extend({
  childApps: { workflow: WorkflowApp, action: ActionApp },
  initialize() {
    this.routing = bindRouteApplication(this, {
      getScope: ({ patientId }) => ({ patientId }),
      getActions: () => ({
        'patient:workflow': () => this.routing.startCurrent('workflow'),
        'patient:action': (patientId, actionId) =>
          this.routing.startCurrent('action', { actionId }),
      }),
      getChildOptions: options => ({
        ...options, patient: this.patient,
        region: this.getView().getRegion('content'),
      }),
      onError: showPatientError,
    });
  },
  prepareStart({ patientId }, { signal }) { return loadPatient(patientId, signal); },
  onStart(app, options, patient) {
    this.patient = patient;
    this.showView(new PatientShellView({ model: patient }));
  },
});
```

The binding handles selection, shared readiness, latest-detail dispatch,
stop/restart/destroy invalidation and cleanup. `onStart` builds the shell; the
binding dispatches afterward automatically. Owners can call
`routing.dispatchCurrent()` earlier within `onStart` when presentation ordering
requires it, as PatientApp does; the binding prevents duplicate dispatch.
`readRoute`/`writeRoute` optionally connect existing observable state; otherwise
the binding retains the route itself. Notification/error callbacks keep product
policy explicit. No Application-level router methods or lifecycle forwarding
boilerplate are required.

An area binds its definitions and supplied transport:

```js
const PatientsArea = Application.extend({
  childApps: { patient: Patient },
  initialize({ workspaceSlug, routeRegion, transport }) {
    this.routing = bindApplicationRouter(this, {
      definitions: {
        'patient:workflow': {
          route: ['patient/:patientId/workflow', 'patient/dashboard/:patientId'],
          action: patientId => this.routing.startRoute('patient', { patientId }),
        },
      },
      workspaceSlug,
      region: routeRegion,
      transport,
      resolveAction: action => action,
      beforeDispatch: route => selectNavAndCloseSidebar(route),
      onError: showRouteError,
    });
  },
});
```

`createBackboneRouteTransport({ channel, history })` supplies the current
compatibility transport. It borrows the existing history owner; it never starts
a second native driver. Other transports implement the same small contract:

| Method | Contract |
| --- | --- |
| `connect(table, { onRoute, onNoMatch })` | Register matching and event dispatch once; report normalized contexts; return `{ dispose }`. Do not replay while constructing the connection |
| `write(url, { replace })` | Silent push/replace of a generated URL, preserving host history policy; no route dispatch |
| connection `dispose()` | Remove only this connection's registrations and subscriptions |

The area binding supplies `accept(context)` for explicit dispatch,
`href(event, ...args)`, `navigateRoute` for silent push, `replaceRoute` for silent
replacement/reflection, and `write` for an already-built URL. The backend owns
URL matching and inbound argument translation. The binding owns Application
coordination. Owner destruction invalidates pending activation and disposes the backend
connection. Disposing a transport subscription alone does not stop its Application. The current compatibility transport preserves synchronous Radio,
Backbone handler precedence, positional args, raw query/null and alias behavior.

`RouterApp`, `SubRouterApp`, and `RouteBaseApp` remain optional declarative
conveniences over these same bindings. Their internal constructors install
mandatory setup before overridable hooks: ErrorApp's `initialize` immediately
registers a catch-all through `this.router`. This is internal reusable adapter
setup, not an application implementation pattern. Consumers may override
`preinitialize`/`initialize` without calling a parent hook.

The binding installs once per Application and captures its public
`stop`/`restart`/`destroy` implementations. Instance wrappers cover already-stopped
owners, which emit no new stop notification; callers retain the normal public
methods and synchronous result/throw behavior. Define custom lifecycle methods
before installing the binding. There is no hidden dependency on domain fields.

### Opt out of coordination

The bindings are optional. Use independent objects with explicit callbacks, or
supply your own readiness/selection implementation:

| Object | Responsibility | Application dependency |
| --- | --- | --- |
| `createRouteTable` | App-compatible definitions, canonical generation, aliases, prefix and context | None |
| `createRouteDispatch` | Latest navigation authority, optional preparation, error policy | None |
| `createChildSelection` | Single selected destination, replacement and cleanup | Public child callbacks only |
| `createRouteDelivery` | Latest detail over shared readiness | Start/read/write/dispatch callbacks only |
| `createRouteActions` | Bound action dispatch and synchronous notifications | None |
| `createBackboneRouteTransport` / `EventRouter` | Current matching, URL writes and Radio adapter | None |

```js
const table = createRouteTable(definitions, { workspaceSlug });
const dispatch = createRouteDispatch({
  dispatch: ({ route, isCurrent }) => customOwner.accept(route, isCurrent),
  onError: showRouteError,
});
const connection = transport.connect(table, {
  onRoute: route => dispatch.accept(route),
  onNoMatch: () => customOwner.leave(),
});
// This explicit owner chooses its own lifecycle/disposal policy:
// dispatch.dispose(); connection.dispose();
```

No URL nesting creates an Application owner or requires a superclass. Scope is
resource identity, excluding detail IDs. Bound retained destinations declare
`getScope`; SubRouterApp supplies it from `routeScope` (`[]` means global).
Workspace creates fresh area instances, partitioning equal resource IDs across
workspaces. The navigation signal must not stop shared same-resource preparation.

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
owners. The optional binding supplies the mandatory lifecycle wrappers, including for
plain Applications; lower-level owners supply their own policy. Application
implementations install bindings in initialize after state/children exist. Only
reusable convenience bases use constructors for mandatory setup ordering.

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

Extract the independent authority/lifecycle objects and their optional Marionette
binding after their consumer contracts settle. The generic bindings accept a
transport; Backbone/Radio are confined to the compatibility adapter. Keep workspace prefixes, Radio positional compatibility, route
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

The Node tests exercise real Marionette 5.0.0 Applications through the assembled
bindings and actual optional adapters: initialize ordering, scope retention and
replacement, automatic/early/restarted dispatch, reentrancy, cleanup failure, late
delivery and disposal during preparation. The actual adapters are bundled for
Node with telemetry replaced. Injected Backbone history and an independent memory
transport exercise the replaceable boundary. These checks do not validate browser
history or UI behavior.

Patient E2E coverage extends the existing routing scenario with Back/Forward and
retained shell/sidebar identity, and adds departure while a patient request is
pending. Existing flow-focus, aliases, worklist loading/filter races, workspace,
permissions, error and submit-back scenarios remain applicable. Generic adapter
component specs remain applicable too.

Cypress is held by explicit task instruction. Do not run Cypress or approve its CI
hold without fresh approval. After approval, run focused patient/default-route/
filter specs first, then the relevant full E2E and component suites under AGENTS.md.
Do not claim UI behavior validated from Node checks, build or source review.
