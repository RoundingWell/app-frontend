# Cypress

## Coverage

Coverage report can be run with commands `npm run coverage` and `npm run coverage:component` for running a full reports and `npm test` for running individual reports on runs from the cypress runner.

**Note** You will want to make sure no other build processes are run/running that may overwrite the instrumented files for the coverage reports.

Reports can be found in `coverage/`.

**Note** In order to preserve coverage only _one_ `visit` should be used per `specify`.

## What is a Cypress Test?

A Cypress test is a functional test testing the built app from the user interface.
Our current usage of cypress stubs all server data so these are not end-to-end tests.

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
The available state colors are defined in [`./state-colors.js`](./state-colors.js).

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
