import _ from 'underscore';
import { v4 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxPrograms from 'fixtures/collections/programs';

import { getProgramFlows } from './program-flows';
import { getProgramActions } from './program-actions';
import { workspaceOne, workspaceTwo } from './workspaces';

const TYPE = 'programs';

const fxSamplePrograms = _.rest(fxPrograms, 2);

// Exporting only programs needed for testing variance
export const programOne = getResource(_.extend(fxPrograms[0], {
  name: 'Program One',
}), TYPE);

export const programTwo = getResource(_.extend(fxPrograms[1], {
  name: 'Program Two',
}), TYPE);

const testPrograms = [programOne, programTwo];

function getProgramResource(id, defaultRelationships) {
  const testWorkspace = _.find(testPrograms, { id });

  if (testWorkspace) return mergeJsonApi(testWorkspace, { relationships: defaultRelationships });

  return getResource({ ..._.sample(fxSamplePrograms), id: uuid() }, TYPE, defaultRelationships);
}

export function getProgram(data, { depth = 0, id } = {}) {
  if (depth++ > 2) return;

  const defaultRelationships = {
    'workspaces': getRelationship([workspaceOne, workspaceTwo]),
    'program-actions': getRelationship(getProgramActions({}, { sample: 10, depth })),
    'program-flows': getRelationship(getProgramFlows({}, { sample: 3, depth })),
  };

  const resource = getProgramResource(id, defaultRelationships);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getPrograms({ attributes, relationships, meta } = {}, { depth = 0 } = {}) {
  if (depth + 1 > 2) return;

  return _.map(testPrograms, ({ id }) => getProgram({ attributes, relationships, meta }, { depth, id }));
}

Cypress.Commands.add('routeProgram', (mutator = _.identity) => {
  const data = getProgram();

  cy
    .intercept('GET', '/api/programs/*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeProgram');
});

Cypress.Commands.add('routePrograms', (mutator = _.identity) => {
  const data = getPrograms();

  cy
    .intercept('GET', '/api/programs', {
      body: mutator({ data, included: [] }),
    })
    .as('routePrograms');
});

Cypress.Commands.add('routeProgramByProgramFlow', (mutator = _.identity) => {
  const programFlows = getProgramFlows();

  const data = getProgram({
    relationships: {
      'program-flows': getRelationship(programFlows),
    },
  });

  const included = [...programFlows];

  cy
    .intercept('GET', '/api/program-flows/**/program', {
      body: mutator({ data, included }),
    })
    .as('routeProgramByProgramFlow');
});

Cypress.Commands.add('routeWorkspacePrograms', (mutator = _.identity) => {
  const data = getPrograms();

  cy
    .intercept('GET', '/api/workspaces/**/programs*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeWorkspacePrograms');
});
