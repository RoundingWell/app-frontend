# Marionette 5 application architecture

This guide records the app's integration choices. Framework API contracts belong
in the version-matched Marionette documentation; use the upstream Marionette
consumer skill to retrieve them. Repository policy and validation commands live in
[AGENTS.md](../AGENTS.md).

## Runtime and rendering

`package.json` and `package-lock.json` pin `marionette` and `@mnjs/adapters` to
`5.0.0-beta.6`. `src/js/base/app.js` exports the framework Application directly.
There is no Toolkit lifecycle wrapper or patched framework runtime.

`src/js/base/setup.js` installs the Backbone DataApi and StateApi adapters and the
Morphdom DomApi adapter. Views use native DOM elements and Marionette UI
collections. `src/js/i18n/index.js` registers the Handlebars renderer and provides
`@intl` template data. The main entry point imports both setup modules before its
application consumers.

Radio comes from `marionette`, so applications, services, and the local event router
share one channel registry. Backbone remains the model, collection, and browser
history implementation.

## Application and view ownership

`src/js/app.js` owns the replacing `#root` Region and its RootView. It prepares the
shell before displaying it, configures the shared popup Regions, and registers
BootstrapService, DialerService, and AppFrameApp as children. Browser activity
listeners live for the page lifetime; the component harness owns its own cleanup.

AppFrameApp owns persistent navigation and a WorkspaceApp child. WorkspaceApp
restarts workspace-specific routers and the transient sidebar while navigation
stays attached. It supplies the workspace slug and shell Regions to those children.
Feature Applications own their layouts, and the layouts own their child Regions
and Views. Shared controls such as Datepicker, Droplist, and Tooltip are direct
Views; Picklist and Optionlist are direct CollectionViews.

Reusable children remain registered while start and stop control activation.
Recreated layouts supply their current Region when starting a child. Static child
constructors use `childApps`; configured, lazy, and dynamically imported children
are explicitly registered with their owner. WorkspaceApp replaces its dynamically
selected routers during the next startup, after the previous run has stopped;
stop preparation does not destroy routers needed by a still-running workspace.

DialerService loads and owns the selected Five9 or RingCentral Application. It
supplies the overlay Region and retains the latest requested call until startup
completes. Provider construction does not initiate a call or start the provider.

## Routing, data, and asynchronous work

URL handling stays in the local Backbone.Router-based EventRouter. RouterApp and
SubRouterApp share RouteBaseApp's selected-child coordination; area effects remain
in WorkspaceApp. Resource scope determines whether a nested route reuses its child.
See [the routing guide](../src/js/base/routing.md) for route definitions, selection,
cancellation, and error handling.

Application preparation performs asynchronous loading and passes its lifecycle
signal to cancelable entity requests. A continuation that manually starts children
after an await checks cancellation before creating further effects. Prepared data
is consumed by the owning run rather than stored in a parallel readiness pipeline.
Data access continues through [entities-service](../src/js/entities-service/README.md).

Application state uses the Backbone adapter. Initialize state before observers
attach, or apply a complete update with normal notifications; do not suppress
notifications with silent mutations. Keep run-specific subscriptions and request
controllers alive until a stop succeeds, and release them with their owning run
or View. A rejected stop must leave the running feature usable.

## Test boundaries

Generic reusable infrastructure, components, and behaviors have colocated Cypress
component specs. `test/support/component.js` mounts them with a small test
Application and the real RootView, and awaits Application destruction between
mounts. It does not bootstrap the authenticated product app.

Application flows, services, and entity access are exercised through E2E scenarios.
Component coverage for those areas is excluded from combined coverage evidence.
Use reachable UI flows to cover application behavior, and investigate unreachable
code instead of preserving it with a component-only test.

The migration acceptance boundary is the E2E suite from develop. Expanded and
consolidated E2E coverage belongs in the follow-up change. Passing acceptance,
passing component tests, and meeting combined coverage targets are separate checks;
report their results for the exact revision tested. This guide makes no claim about
the validation status of a particular branch or release.
