import _ from 'underscore';
import { v4 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getPatient } from './patients';

const TYPE = 'outreach';

const fxOutreach = { phone_end: '1234' };

export function getOutreachStatus(data) {
  const defaultRelationships = {
    'patient': getRelationship(getPatient()),
  };

  const resource = getResource(fxOutreach, TYPE, defaultRelationships);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

Cypress.Commands.add('routeOutreachStatus', (mutator = _.identity) => {
  const data = getOutreachStatus();

  cy
    .intercept('GET', '/api/outreach?*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeOutreachStatus');
});
