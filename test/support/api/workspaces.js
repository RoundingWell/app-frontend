import _ from 'underscore';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxWorkspaces from 'fixtures/collections/workspaces.json';

import { getClinicians, getCurrentClinician } from './clinicians';
import { getForms } from './forms';
import { getStates } from './states';

const TYPE = 'workspaces';

const fxSampleWorkspaces = _.rest(fxWorkspaces, 2);

// Exporting only workspaces needed for testing variance
export const workspaceOne = getResource(_.extend(fxWorkspaces[0], {
  name: 'Workspace One',
  slug: 'one',
}), TYPE);

export const workspaceTwo = getResource(_.extend(fxWorkspaces[1], {
  name: 'Workspace Two',
  slug: 'two',
}), TYPE);

const testWorkspaces = [workspaceOne, workspaceTwo];

function getWorkspaceResource(id, defaultRelationships) {
  const testWorkspace = _.find(testWorkspaces, { id });

  if (testWorkspace) return mergeJsonApi(testWorkspace, { relationships: defaultRelationships });

  return getResource(_.sample(fxSampleWorkspaces), TYPE, defaultRelationships);
}

export function getWorkspace(data, { depth = 0, id } = {}) {
  if (depth++ > 2) return;

  const currentClinician = getCurrentClinician({}, { depth });

  const defaultRelationships = {
    'clinicians': getRelationship([currentClinician, ...getClinicians({}, { depth })]),
    'forms': getRelationship(getForms()),
    'states': getRelationship(getStates()),
  };

  const resource = getWorkspaceResource(id, defaultRelationships);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getWorkspaces({ attributes, relationships, meta } = {}, { depth = 0 } = {}) {
  if (depth + 1 > 2) return;

  return _.map(testWorkspaces, ({ id }) => getWorkspace({ attributes, relationships, meta }, { depth, id }));
}

// NOTE: This returns specific test workspaces and must minimally match the program.relationships.workspaces
Cypress.Commands.add('routeWorkspaces', (mutator = _.identity) => {
  const data = getWorkspaces();
  const included = [];

  cy
    .intercept('GET', '/api/workspaces', {
      body: mutator({ data, included }),
    })
    .as('routeWorkspaces');
});
