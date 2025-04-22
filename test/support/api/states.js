import _ from 'underscore';
import { getResource } from 'helpers/json-api';

import fxTestStates from 'fixtures/test/states';

const TYPE = 'states';

export function getStates() {
  return getResource(fxTestStates, TYPE);
}

export function getState() {
  return getResource(_.sample(fxTestStates), TYPE);
}

const states = getStates();

// Exporting one of each state.status
export const stateTodo = _.find(states, { id: '22222' });
export const stateInProgress = _.find(states, { id: '33333' });
export const stateDone = _.find(states, { id: '55555' });
export const stateUnableToComplete = _.find(states, { id: '66666' });
export const stateThmgTransfered = _.find(states, { id: '77777' });

Cypress.Commands.add('routeStates', (mutator = _.identity) => {
  const data = getStates();

  cy
    .intercept('GET', '/api/states', {
      body: mutator({ data, included: [] }),
    })
    .as('routeStates');
});
