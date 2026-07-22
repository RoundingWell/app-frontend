import _ from 'underscore';
import { v7 as uuid, v5 as uuidv5 } from 'uuid';
import { RWELL_NS } from 'js/static';
import { testTs } from 'helpers/test-timestamp';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxTestClinicians from 'fixtures/test/clinicians.json';

import { getTeam, teamNurse } from './teams';
import { getWorkspaces } from './workspaces';
import { roleManager, roleEmployee } from './roles';

const TYPE = 'clinicians';

const fxCurrentClinician = _.first(fxTestClinicians);
const fxClinicians = _.rest(fxTestClinicians);

export function getClinicianId(email) {
  return uuidv5(`clinician:${ String(email).toLowerCase() }`, RWELL_NS);
}

export function getCurrentClinician(data, { depth = 0 } = {}) {
  const defaultRelationships = {
    'role': getRelationship(roleManager),
    'team': getRelationship(teamNurse),
    'workspaces': getRelationship(getWorkspaces({}, { depth })),
  };

  const resource = getResource(fxCurrentClinician, TYPE, defaultRelationships);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

function getFixture(data) {
  if (!data) return _.sample(fxClinicians);

  if (!data.id) data = _.extend({ id: uuid() }, data);

  return _.find(fxClinicians, { id: data.id }) || _.extend({}, _.sample(fxClinicians), { id: data.id });
}

export function getClinician(data, { depth = 0 } = {}) {
  if (depth++ > 2) return;

  const defaultRelationships = {
    'role': getRelationship(_.random(1) ? roleManager : roleEmployee),
    'team': getRelationship(getTeam({}, { depth })),
    'workspaces': getRelationship(getWorkspaces({}, { depth })),
  };

  const resource = getResource(getFixture(data), TYPE, defaultRelationships);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getClinicians({ attributes, relationships, meta } = {}, { depth = 0 } = {}) {
  if (depth + 1 > 2) return [];

  const clinicians = _.map(fxClinicians, fxClinican => {
    const resource = getClinician(fxClinican, { depth });

    return mergeJsonApi(resource, { attributes, relationships, meta });
  });

  return clinicians;
}

Cypress.Commands.add('routeCurrentClinician', (mutator = _.identity) => {
  const data = getCurrentClinician({
    attributes: {
      last_active_at: testTs(),
    },
  });

  cy
    .intercept('GET', '/api/clinicians/me', {
      body: mutator({ data, included: [] }),
    })
    .as('routeCurrentClinician');
});

Cypress.Commands.add('routeClinician', (mutator = _.identity) => {
  const data = getClinician();

  cy
    .intercept('GET', /\/api\/clinicians\/[^me]+/, {
      body: mutator({ data, included: [] }),
    })
    .as('routeClinician');
});

Cypress.Commands.add('routeClinicians', (mutator = _.identity) => {
  const data = getClinicians();

  cy
    .intercept('GET', '/api/clinicians', {
      body: mutator({ data, included: [] }),
    })
    .as('routeClinicians');
});

Cypress.Commands.add('routeWorkspaceClinicians', (mutator = _.identity) => {
  const data = [{ id: fxCurrentClinician.id, type: TYPE }, ...getClinicians()];

  cy
    .intercept('GET', '/api/workspaces/**/clinicians*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeWorkspaceClinicians');
});
