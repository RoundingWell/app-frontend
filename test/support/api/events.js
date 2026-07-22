import _ from 'underscore';
import dayjs from 'dayjs';
import { v7 as uuid } from 'uuid';
import { getResource, getRelationship } from 'helpers/json-api';

import fxTestActionEvents from 'fixtures/test/events-actions';
import fxTestFlowEvents from 'fixtures/test/events-flows';

import { getAction } from './actions';
import { getCurrentClinician } from './clinicians';

const TYPE = 'events';

export function getActivity(fxEvent, relationships) {
  const defaultRelationships = {
    'patient-action': getRelationship(getAction()),
    'editor': getRelationship(getCurrentClinician()),
  };

  const defaultData = {
    id: uuid(),
    date: dayjs.utc().format(),
    event_type: 'ActionDetailsUpdated',
    source: 'system',
  };

  const data = _.extend(defaultData, fxEvent);

  return getResource(data, TYPE, _.extend(defaultRelationships, relationships));
}

export function getActivities(fxEvents, relationships) {
  return _.map(fxEvents, fxEvent => {
    return getActivity(fxEvent, relationships);
  });
}

Cypress.Commands.add('routeActionActivity', (mutator = _.identity) => {
  const data = getActivities(fxTestActionEvents);

  cy
    .intercept('GET', '/api/actions/**/activity*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeActionActivity');
});

Cypress.Commands.add('routeFlowActivity', (mutator = _.identity) => {
  const data = getActivities(fxTestFlowEvents);

  cy
    .intercept('GET', '/api/flows/**/activity*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeFlowActivity');
});
