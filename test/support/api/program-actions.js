import _ from 'underscore';
import { v7 as uuid } from 'uuid';

import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxProgramActions from 'fixtures/collections/program-actions';

import { getTeam } from './teams';
import { getProgram, programOne } from './programs';
import { getProgramFlow } from './program-flows';

const TYPE = 'program-actions';

export function getProgramAction(data, { depth = 0 } = {}) {
  if (depth > 2) return;

  const defaultRelationships = {
    'owner': _.random(1) ? getRelationship(getTeam()) : getRelationship(),
    'program': getRelationship(programOne),
    'form': getRelationship(),
  };

  const resource = getResource(_.sample(fxProgramActions), TYPE, defaultRelationships);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getProgramActions({ attributes, relationships, meta } = {}, { sample = 3, depth = 0 } = {}) {
  if (depth + 1 > 2) return;
  return _.times(sample, () => getProgramAction({ attributes, relationships, meta }, { depth }));
}

Cypress.Commands.add('routeProgramAction', (mutator = _.identity) => {
  const data = getProgramAction();

  cy
    .intercept('GET', '/api/program-actions/*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeProgramAction');
});

Cypress.Commands.add('routeProgramActions', (mutator = _.identity) => {
  const data = getProgramActions({
    relationships: {
      'program': getRelationship(programOne),
    },
  });

  cy
    .intercept('GET', '/api/programs/**/actions*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeProgramActions');
});

Cypress.Commands.add('routeProgramFlowActions', (mutator = _.identity) => {
  const data = getProgramActions({
    relationships: {
      'program-flow': getRelationship(getProgramFlow()),
      'program': getRelationship(programOne),
    },
  });

  cy
    .intercept('GET', '/api/program-flows/**/actions', {
      body: mutator({ data, included: [] }),
    })
    .as('routeProgramFlowActions');
});

Cypress.Commands.add('routeAllProgramActions', (mutator = _.identity) => {
  const data = getProgramActions({
    relationships() {
      return {
        'program': getRelationship(getProgram()),
      };
    },
  });

  cy
    .intercept('GET', '/api/program-actions?*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeAllProgramActions');
});
