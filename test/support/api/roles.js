import _ from 'underscore';
import { getResource } from 'helpers/json-api';

import fxTestRoles from 'fixtures/test/roles';

const TYPE = 'roles';

export function getRole() {
  return getResource(_.sample(fxTestRoles), TYPE);
}

export function getRoles() {
  return getResource(fxTestRoles, TYPE);
}

const roles = getRoles();

function getRoleByName(name) {
  return _.find(roles, role => {
    return role.attributes.name === name;
  });
}

export const roleAdmin = getRoleByName('admin');
export const roleManager = getRoleByName('manager');
export const roleEmployee = getRoleByName('employee');
export const roleReducedEmployee = getRoleByName('restricted_employee');
export const roleNoFilterEmployee = getRoleByName('restricted__filter_employee');
export const roleTeamEmployee = getRoleByName('liaison_employee');

Cypress.Commands.add('routeRoles', (mutator = _.identity) => {
  const data = getResource(fxTestRoles, TYPE);

  cy
    .intercept('GET', '/api/roles', {
      body: mutator({ data, included: [] }),
    })
    .as('routeRoles');
});
