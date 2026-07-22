import _ from 'underscore';
import { v7 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getWorkspaces } from './workspaces';
import { getActions } from './actions';
import { getPatientFields } from './patient-fields';
import { getFlows } from './flows';

import fxPatients from 'fixtures/collections/patients';

const TYPE = 'patients';

export function getPatient(data, { depth = 0 } = {}) {
  if (depth++ > 2) return;

  const defaultRelationships = {
    'actions': getRelationship(getActions({}, { sample: 3, depth })),
    'flows': getRelationship(getFlows({}, { sample: 2, depth })),
    'patient-fields': getRelationship(getPatientFields({}, { sample: 3, depth })),
    'visits': getRelationship([]),
    'workspaces': getRelationship(getWorkspaces()),
  };

  const resource = getResource(_.sample(fxPatients), TYPE, defaultRelationships);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getPatients({ attributes, relationships, meta } = {}, { sample = 3, depth = 0 } = {}) {
  if (depth + 1 > 2) return;
  return _.times(sample, () => getPatient({ attributes, relationships, meta }, { depth }));
}

Cypress.Commands.add('routePatient', (mutator = _.identity) => {
  const data = getPatient();

  cy
    .intercept('GET', '/api/patients/**?*', {
      body: mutator({ data, included: [] }),
    })
    .as('routePatient');
});

Cypress.Commands.add('routePatientByAction', (mutator = _.identity) => {
  const data = getPatient();

  cy
    .intercept('GET', '/api/actions/**/patient', {
      body: mutator({ data, included: [] }),
    })
    .as('routePatientByAction');
});

Cypress.Commands.add('routePatientByFlow', (mutator = _.identity) => {
  const data = getPatient();

  cy
    .intercept('GET', '/api/flows/**/patient', {
      body: mutator({ data, included: [] }),
    })
    .as('routePatientByFlow');
});
