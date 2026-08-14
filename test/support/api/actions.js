import _ from 'underscore';
import { v7 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxActions from 'fixtures/collections/actions';

import { getClinician } from './clinicians';
import { getFlow } from './flows';
import { getPatient, getPatients } from './patients';
import { getState, stateInProgress } from './states';
import { getTeam } from './teams';
import { getProgramAction } from './program-actions';
import { programOne } from './programs';

const TYPE = 'patient-actions';

export const longActionName = new Array(9).fill('Really Long Action name').join(' ');

export function getAction(data, { depth = 0 } = {}) {
  if (depth++ > 2) return;

  const defaultRelationships = {
    'author': getRelationship(),
    'comments': getRelationship([]),
    'files': getRelationship([]),
    'flow': getRelationship(),
    'form': getRelationship(),
    'form-responses': getRelationship(),
    'owner': _.random(1) ? getRelationship(getClinician()) : getRelationship(getTeam()),
    'patient': getRelationship(getPatient({}, { depth })),
    'program': getRelationship(programOne),
    'program-action': getRelationship(getProgramAction()),
    'recipient': getRelationship(),
    'state': getRelationship(getState()),
  };

  const resource = getResource(_.sample(fxActions), TYPE, defaultRelationships);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getActions({ attributes, relationships, meta } = {}, { sample = 3, depth = 0 } = {}) {
  if (depth + 1 > 2) return;
  return _.times(sample, () => getAction({ attributes, relationships, meta }, { depth }));
}

Cypress.Commands.add('routeAction', (mutator = _.identity) => {
  const data = getAction({
    relationships: {
      state: getRelationship(stateInProgress),
    },
  });

  cy
    .intercept('GET', '/api/actions/*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeAction');
});

function routeActions() {
  const patients = getPatients({}, { sample: 3 });

  const data = getActions({
    relationships() {
      return {
        'patient': getRelationship(_.sample(patients)),
      };
    },
  });

  const included = [...patients];

  return { data, included };
}

Cypress.Commands.add('routeActions', (mutator = routeActions) => {
  const data = {};
  const included = [];

  const body = mutator({ data, included });

  if (!body.meta) {
    body.meta = {
      actions: { total: body.data.length },
      worklist: uuid(),
    };
  }

  cy
    .intercept('GET', '/api/actions?*', { body })
    .as('routeActions');
});

function routePatientActions() {
  const patient = getPatient();

  const data = getActions({
    relationships: {
      'patient': getRelationship(patient),
    },
  });

  const included = [patient];

  return { data, included };
}

Cypress.Commands.add('routePatientActions', (mutator = routePatientActions) => {
  const data = {};
  const included = [];

  cy
    .intercept('GET', '/api/patients/**/actions*', {
      body: mutator({ data, included }),
    })
    .as('routePatientActions');
});

function routeFlowActions() {
  const patient = getPatient();
  const flow = getFlow();

  const data = getActions({
    relationships: {
      'patient': getRelationship(patient),
      'flow': getRelationship(flow),
    },
  });

  const included = [patient, flow];

  return { data, included };
}

Cypress.Commands.add('routeFlowActions', (mutator = routeFlowActions) => {
  const data = {};
  const included = [];

  cy
    .intercept('GET', '/api/flows/**/actions*', {
      body: mutator({ data, included }),
    })
    .as('routeFlowActions');
});
