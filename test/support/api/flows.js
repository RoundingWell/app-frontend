import _ from 'underscore';
import { v7 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxFlows from 'fixtures/collections/flows';

import { getActions } from './actions';
import { getClinician } from './clinicians';
import { getPatient, getPatients } from './patients';
import { getProgramActions } from './program-actions';
import { getProgramFlow } from './program-flows';
import { getProgram, programOne } from './programs';
import { getState, stateInProgress } from './states';
import { getTeam } from './teams';

const TYPE = 'flows';

export function getFlow(data, { depth = 0 } = {}) {
  if (depth++ > 2) return;

  const defaultRelationships = {
    'actions': getRelationship(getActions({}, { sample: 5, depth })),
    'author': getRelationship(),
    'owner': _.random(1) ? getRelationship(getClinician()) : getRelationship(getTeam()),
    'patient': getRelationship(getPatient({}, { depth })),
    'program': getRelationship(programOne),
    'program-flow': getRelationship(getProgramFlow()),
    'state': getRelationship(getState()),
  };

  const resource = getResource(_.sample(fxFlows), TYPE, defaultRelationships);

  resource.meta = {
    progress: { complete: 0, total: 5 },
  };

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getFlows({ attributes, relationships, meta } = {}, { sample = 3, depth = 0 } = {}) {
  if (depth + 1 > 2) return;
  return _.times(sample, () => getFlow({ attributes, relationships, meta }, { depth }));
}

Cypress.Commands.add('routeFlow', (mutator = _.identity, options = {}) => {
  const program = getProgram();
  const programActions = getProgramActions({});
  const programFlow = getProgramFlow({
    relationships: {
      'program': getRelationship(program),
      'program-actions': getRelationship(programActions),
    },
  });

  const data = getFlow({
    relationships: {
      'state': getRelationship(stateInProgress),
      'program': getRelationship(program),
      'program-flow': getRelationship(programFlow),
    },
  });

  const included = [program, ...programActions, programFlow];

  cy
    .intercept('GET', '/api/flows/*', {
      body: mutator({ data, included }),
      ...options,
    })
    .as('routeFlow');
});

function routeFlows() {
  const patients = getPatients({}, { sample: 3 });

  const data = getFlows({
    relationships() {
      return {
        'patient': getRelationship(_.sample(patients)),
      };
    },
  });

  const included = [...patients];

  return { data, included };
}

Cypress.Commands.add('routeFlows', (mutator = routeFlows) => {
  const data = {};
  const included = [];

  const body = mutator({ data, included });

  if (!body.meta) {
    body.meta = {
      flows: { total: body.data.length },
      worklist: uuid(),
    };
  }

  cy
    .intercept('GET', '/api/flows?*', { body })
    .as('routeFlows');
});

function routePatientFlows() {
  const patient = getPatient();

  const data = getFlows({
    relationships: {
      'patient': getRelationship(patient),
    },
  });

  const included = [patient];

  return { data, included };
}

Cypress.Commands.add('routePatientFlows', (mutator = routePatientFlows) => {
  const data = {};
  const included = [];

  cy
    .intercept('GET', '/api/patients/**/relationships/flows*', {
      body: mutator({ data, included }),
    })
    .as('routePatientFlows');
});
