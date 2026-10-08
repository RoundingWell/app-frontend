# Cypress

Read [the agent validation policy](../AGENTS.md#validation) when authoring or
reviewing tests. This document describes how to collect evidence for that policy.

## Coverage

Use `npm run coverage` for both suites, `npm run coverage:component` for components,
or `npm run coverage:e2e` for app flows. Headless runs collect every spec's coverage
and generate HTML, text, and LCOV reports once at run completion. Interactive
`npm test` runs retain per-spec reports.

Local component runs use one process. CircleCI splits component specs across four
isolated workers without recording to Cypress Cloud and combines their coverage
with E2E coverage in Coveralls. See [the CI documentation](../.circleci/README.md#cypress-workers-and-coverage).

**Note** You will want to make sure no other build processes are run/running that may overwrite the instrumented files for the coverage reports.

Reports can be found in `coverage/`.

The configured source scope comes from [`.nycrc.json`](../.nycrc.json), shared
through [`config/coverage.cjs`](../config/coverage.cjs) with Vite instrumentation.
Component collection additionally drops `src/js/apps/**` and
`src/js/entities-service/**` in
[`scripts/cypress-coverage-events.js`](../scripts/cypress-coverage-events.js).
Component totals therefore describe a narrower scope. Full coverage combines
E2E and component data; application and entity-service coverage must come from
E2E. Neither an executed branch nor 100% coverage proves a meaningful assertion.

For full local verification, start with clean coverage output and run
`npm run coverage`, which clears `.nyc_output` and `coverage`, runs both suites,
and generates reports. Do not mix partial runs, stale data, or different source
revisions into a full-coverage claim. Inspect the complete configured aggregate
report, including covered/total lines and branches and uncovered locations;
require 100% of both, not just the changed files. The current NYC configuration
and report commands do not enforce a numeric 100% threshold automatically.
Do not narrow the scope or add ignores to reach that result without explicit
maintainer approval as required by `AGENTS.md`.

Distinguish focused iteration from full local verification and remote results.
Record the exact tested commit, any uncommitted changes, commands, suite/spec
scope, test results, and coverage counts. For remote verification, match the
current PR head to the pipeline SHA and confirm all required component/E2E
workers, coverage uploads, and the combined finalizer succeeded. A nonempty LCOV
upload or an older green pipeline alone does not establish full coverage or
validation of the current head.

Related scenarios may share a `specify`, including multiple visits. The coverage
plugin retains coverage from each loaded window and merges it after each test.
Reset scenario-specific intercepts, clocks, and exception handlers when reusing a
test. Keep a separate `specify` when a scenario needs independent isolation.

## What is a Cypress Test?

Both runners register an app-origin fallback for `/api` and `/api/**` before endpoint
stubs. An unmatched request fails with its method, path, and instructions to add
a matching `cy.intercept()` response stub before triggering the request.
Query values, origins, headers, and bodies are omitted from the error.

E2E specs exercise the built app through its user interface with stubbed server
data; they do not verify integration with the live backend. Component specs mount
isolated reusable units. Use E2E for behavior users can exercise through the UI.

## Organization

Cypress specs live beside the source they exercise:

- `*.component.cy.js` runs with Cypress component testing and is not recorded.
- `*.e2e.cy.js` runs against the built app and is recorded in branch CI.

App-owned specs live under the owning `src/js/apps/<domain>/<app>/**` directory.
Service, component, utility, and other cross-cutting specs live beside their production module.
For cross-domain E2E flows, use the primary entry route and behavior under assertion as the owner.

Keep the `.cy.js` ending for both test types because ESLint test rules and NYC coverage exclusions depend on it.
Fixtures, Cypress support, plugins, and reports remain under `test/`.

## Writing Tests

Tests should be organized as follows:
```js
context('Feature Name / App Section', function() {
  beforeEach(function() {
    // setup routes
    // init app and visit specific URL
  });

  afterEach(function() {
    // reset any variables after individual tests
  });

  specify('executing a data scenario', function() {
    // ...
  });

  specify('executing a different data scenario', function() {
    // ...
  });
});
```

## Code Style

Cypress was written by ruby/coffeescript people and follows chai-style chaining, perhaps to a fault.
This makes it difficult to understand what is the test assertion and what is test setup. Standards in unit tests such as using single assertions per `it` can't really apply in Cypress.

If groups of steps are not explicitly linked or dependent on each other, separate them into multiple lines:
```js
cy
  .get('@thingy') // Identifies the item or region this chunk is focusing on
  .find('.something').last() // logically groups commands finding an element (no need for .last() to be on its own line here)
  .click() // Explicit action
  .wait('@forSomething') // Another explicit action
  .then(function() { // And another
    cy.routeFoo(fx => {
      return {
        data: { foo: '1', },
      };
    });
  });
```

A new `cy` should be added for new parent commands, as that is implicitly what is happening under-the-hood.
```js
cy
  .get('@thingy')
  .find('.something').last()
  .click() // Explicit action

// This `get` would reset the chain
// and nothing would know about `.something` or the click
cy
  .get('@thingy')
  .find('.foo');
```

## Testing Priorities

We should be testing the **business logic: how data (and interfaces) can be created, displayed, stored, and changed**.

It is important to test all various data scenarios. What does it do when no results are returned? When the logged in user is only in a single group? When a value is null?

## Behavior Evidence

For each new or changed regression test, identify the behavioral contract and
assert its result. Confirm a narrow controlled break of that behavior fails at
the intended assertion, then restore the implementation and confirm a passing
run. Record both results and remove the temporary break. A broad mutation
campaign requires its own agreed scope. Failures in setup or
unrelated assertions do not demonstrate detection. If removing a guard leaves
the test green, that shows the test did not detect its removal; it does not prove
the guard redundant. Trace supported callers and lifecycle ordering before
removing a path or requesting an ignore.

Use realistic fixtures, actual controls, and sufficient content to reach the
state under test. For scrolling, overflow, and responsive behavior, use real
browser layout and a viewport appropriate to the scenario. Do not override
`scrollHeight`, `clientHeight`, bounding rectangles, or production layout solely
to hit a branch. Assert the functional result rather than incidental dimensions.
Cypress actions can scroll elements into view, and clicks can change
focus: capture and assert the application's automatic scroll or focus result
before a test action can produce it. When needed, disable the action's Cypress
scrolling and observe the owning scroll container and active element directly.

Before an asynchronous negative assertion, prove the operation that could cause
the forbidden effect has completed. Use an aliased response plus an observable
completion state, or an explicit response gate and completion signal; an initially
absent element or untouched spy may pass before the work runs. Avoid arbitrary
sleeps as completion evidence. For late-response races, hold the old response,
transition through the UI, release it, wait for completion, and assert both the
absence of stale effects and the presence of the correct current state.

For lifecycle changes, exercise incoming startup, outgoing host teardown, and
reentry where those transitions affect the contract. Verify that delayed work
from the outgoing owner cannot commit after its host is lost, and that the new
or reentered owner still functions. Use the version-matched upstream Marionette
docs for framework contracts; test this application's reachable ownership flow.

## Fixtures

Fixtures should be json files loaded in `test/fixtures/`.

[More Info...](https://github.com/RoundingWell/app-frontend/tree/develop/test/fixtures#test-fixtures)

## Composing APIs

In Cypress, API routes are setup in `test/support/api/`. Each added file must be imported in `test/support/e2e.js`.
API's are organized by model and collection requests. Multiple versions of the same route might be added to support different scenarios. For instance both a check-in and a clinician response share the same API, but return different data depending on what is requested from the `id`. Each route follows the same format so that in practice the data can be mutated for a particular test scenario.

```js
import fxCheckIn from 'fixtures/test/check-in';

Cypress.Commands.add('routeCheckIn', (mutator = _.identity) => {
  cy
    .intercept('GET', /ajax\/response\/\d+?/, {
      body: mutator({fxCheckIn),
    })
    .as('routeCheckIn');
});
```

Notice two things. The route is aliased by the name of the parentCommand name.
And a mutator function is passed to the command such that the data for the endpoint passes through it before returning as the response to the endpoint.

## State Colors

When checking for states like errors, rather than checking for the existence of a class, use stateColors.
The available state colors are defined in [`./helpers/state-colors.js`](./helpers/state-colors.js).

```js
context('Clinician Profile', function() {
  const stateColors = Cypress.env('stateColors');
  //...
  cy
    .get('@phoneInput')
    .parent()
    .contains('The phone number you entered does not match the expected phone number format for United States. Try re-entering the number.')
    .should('have.css', 'color', stateColors.error);
```

NOTE: When checking border colors, Firefox expects the most specific style property possible to be set. So instead of checking for the property `border-color`,
we need to check for `border-top-color`.
