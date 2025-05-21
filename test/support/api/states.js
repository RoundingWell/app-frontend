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

function getStateBySlug(slug) {
  return _.find(states, state => {
    return state.attributes.slug === slug;
  });
}

export const stateTodo = getStateBySlug('to-do');
export const stateInProgress = getStateBySlug('in-progress');
export const stateDone = getStateBySlug('done');
export const stateUnableToComplete = getStateBySlug('unable-to-complete');
export const stateThmgTransferred = getStateBySlug('thmg-transferred');
export const stateEvernorth = getStateBySlug('evernorth');

Cypress.Commands.add('routeStates', (mutator = _.identity) => {
  const data = getStates();

  cy
    .intercept('GET', '/api/states', {
      body: mutator({ data, included: [] }),
    })
    .as('routeStates');
});
