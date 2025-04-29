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

function getStateByName(name) {
  return _.find(states, state => {
    return state.attributes.name === name;
  });
}

export const stateTodo = getStateByName('To Do');
export const stateInProgress = getStateByName('In Progress');
export const stateDone = getStateByName('Done');
export const stateUnableToComplete = getStateByName('Unable to Complete');
export const stateThmgTransfered = getStateByName('THMG Transfered');

Cypress.Commands.add('routeStates', (mutator = _.identity) => {
  const data = getStates();

  cy
    .intercept('GET', '/api/states', {
      body: mutator({ data, included: [] }),
    })
    .as('routeStates');
});
