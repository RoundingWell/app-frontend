import _ from 'underscore';
import { v4 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxProgramFlows from 'fixtures/collections/program-flows';

import { getTeam } from './teams';
import { getProgram, programOne } from './programs';
import { getProgramActions } from './program-actions';

const TYPE = 'program-flows';

export function getProgramFlow(data, { depth = 0 } = {}) {
  if (depth++ > 2) return;

  const defaultRelationships = {
    'owner': _.random(1) ? getRelationship(getTeam()) : getRelationship(),
    'program': getRelationship(programOne),
    'program-actions': getRelationship(getProgramActions({}, { sample: 3, depth })),
  };

  const resource = getResource(_.sample(fxProgramFlows), TYPE, defaultRelationships);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getProgramFlows({ attributes, relationships, meta } = {}, { sample = 3, depth = 0 } = {}) {
  if (depth + 1 > 2) return;
  return _.times(sample, () => getProgramFlow({ attributes, relationships, meta }, { depth }));
}

Cypress.Commands.add('routeProgramFlow', (mutator = _.identity) => {
  const data = getProgramFlow();

  cy
    .intercept('GET', '/api/program-flows/*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeProgramFlow');
});

Cypress.Commands.add('routeProgramFlows', (mutator = _.identity) => {
  const data = getProgramFlows({
    relationships: {
      'program': getRelationship(programOne),
    },
  });

  cy
    .intercept('GET', '/api/programs/**/flows*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeProgramFlows');
});

Cypress.Commands.add('routeAllProgramFlows', (mutator = _.identity) => {
  const data = getProgramFlows({
    relationships() {
      return {
        'program': getRelationship(getProgram()),
        'program-actions': getRelationship(getProgramActions({}, { sample: 3 })),
      };
    },
  });

  cy
    .intercept('GET', '/api/program-flows?*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeAllProgramFlows');
});
