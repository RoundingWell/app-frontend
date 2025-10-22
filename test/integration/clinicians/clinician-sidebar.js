import { getErrors, getRelationship } from 'helpers/json-api';

import stateColors from 'helpers/state-colors';

import { teamCoordinator, teamNurse } from 'support/api/teams';
import { roleAdmin, roleEmployee, roleManager } from 'support/api/roles';
import { workspaceOne } from 'support/api/workspaces';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';

const testClinician = getClinician({
  attributes: {
    name: 'Test Clinician',
    email: 'test.clinician@roundingwell.com',
  },
  relationships: {
    team: getRelationship(teamCoordinator),
    role: getRelationship(roleEmployee),
  },
});

context('clinician sidebar', function() {
  specify('edit clinician', function() {
    cy
      .routeClinicians(fx => {
        fx.data = [testClinician];

        return fx;
      })
      .visit(`/clinicians/${ testClinician.id }`)
      .wait('@routeClinicians');

    cy
      .get('.sidebar')
      .as('clinicianSidebar');

    cy
      .get('@clinicianSidebar')
      .find('[data-name-region] .js-input')
      .should('have.value', 'Test Clinician')
      .should('be.disabled');

    cy
      .get('@clinicianSidebar')
      .find('[data-email-region] .js-input')
      .should('have.value', 'test.clinician@roundingwell.com')
      .should('be.disabled');

    cy
      .get('@clinicianSidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .intercept('PATCH', `/api/clinicians/${ testClinician.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchClinician');

    cy
      .intercept('POST', `/api/workspaces/${ workspaceOne.id }/relationships/clinicians`, {
        statusCode: 204,
        body: {},
      })
      .as('routeAddWorkspaceClinician');

    cy
      .intercept('DELETE', `/api/workspaces/${ workspaceOne.id }/relationships/clinicians`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteWorkspaceClinician');

    cy
      .get('@clinicianSidebar')
      .find('[data-state-region]')
      .contains('Active')
      .click();

    cy
      .get('.picklist')
      .contains('Disabled')
      .click();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.enabled).to.be.false;
      });

    cy
      .get('@clinicianSidebar')
      .find('[data-team-region] button')
      .should('be.disabled');

    cy
      .get('@clinicianSidebar')
      .find('[data-role-region] button')
      .should('be.disabled');

    cy
      .get('@clinicianSidebar')
      .find('[data-state-region]')
      .contains('Disabled')
      .click();

    cy
      .get('.picklist')
      .contains('Active')
      .click();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.enabled).to.be.true;
      });

    cy
      .get('@clinicianSidebar')
      .find('[data-role-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('not.contain', 'Admin');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Manager')
      .click();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.role.data.id).to.equal(roleManager.id);
      });

    cy
      .get('@clinicianSidebar')
      .find('[data-team-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.team.data.id).to.equal(teamNurse.id);
      });

    cy
      .get('[data-workspaces-region]')
      .as('clinicianWorkspaces')
      .find('.list-manager__item')
      .first()
      .should('contain', 'Workspace One')
      .next()
      .should('contain', 'Workspace Two');

    cy
      .get('@clinicianWorkspaces')
      .find('.list-manager__droplist')
      .should('be.disabled');

    cy
      .get('@clinicianWorkspaces')
      .find('.list-manager__item')
      .first()
      .find('.js-remove')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Remove From Workspace?')
      .should('contain', 'Any flow or action owned by this clinician in Workspace One will be set to their team, which is Nurse. Are you sure you want to proceed?')
      .find('.js-submit')
      .contains('Remove From Workspace')
      .click();

    cy
      .wait('@routeDeleteWorkspaceClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data[0].id).to.equal(testClinician.id);
        expect(data[0].type).to.equal('clinicians');
      });

    cy
      .get('.table-list')
      .find('.table-list__item')
      .first()
      .children()
      .eq(1)
      .as('clinicianListItemWorkspaces')
      .should('not.contain', 'Workspace One');

    cy
      .get('@clinicianWorkspaces')
      .find('.list-manager__item')
      .should('have.length', 1);

    cy
      .get('@clinicianWorkspaces')
      .find('.list-manager__droplist')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Workspace One')
      .click();

    cy
      .wait('@routeAddWorkspaceClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data[0].id).to.equal(testClinician.id);
        expect(data[0].type).to.equal('clinicians');
      });

    cy
      .get('@clinicianWorkspaces')
      .find('.list-manager__item')
      .contains('Workspace One');

    cy
      .get('@clinicianListItemWorkspaces')
      .should('contain', 'Workspace One, Workspace Two');

    cy
      .get('.sidebar')
      .find('.js-close')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('.table-list')
      .find('.table-list__item')
      .first()
      .should('contain', 'Test Clinician')
      .should('have.not.class', 'is-selected');

    cy
      .url()
      .should('contain', 'clinicians')
      .should('not.contain', `clinicians/${ testClinician.id }`);
  });

  specify('link to owned by worklist', function() {
    cy
      .routeClinicians(fx => {
        fx.data = [testClinician];

        return fx;
      })
      .routeActions()
      .visit(`/clinicians/${ testClinician.id }`)
      .wait('@routeClinicians');

    cy
      .get('.sidebar')
      .as('clinicianSidebar');

    cy
      .get('@clinicianSidebar')
      .find('[data-worklist-region]')
      .get('.sidebar__heading')
      .should('contain', 'Workspace One Workspace');

    cy
      .get('@clinicianSidebar')
      .find('[data-worklist-region]')
      .get('.js-button')
      .should('contain', 'Owned By Test Clinician Worklist')
      .click();

    cy
      .wait('@routeActions');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('[data-owner-filter-region]')
      .should('contain', 'Test Clinician');
  });

  specify('admin clinician', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleAdmin),
          },
        });

        return fx;
      })
      .routeClinicians(fx => {
        fx.data = [testClinician];

        return fx;
      })
      .visit(`/clinicians/${ testClinician.id }`)
      .wait('@routeClinicians');

    cy
      .get('.sidebar')
      .as('clinicianSidebar');

    cy
      .get('@clinicianSidebar')
      .find('[data-role-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('contain', 'Admin');
  });

  specify('incomplete clinician', function() {
    const incompleteClinician = getClinician({
      attributes: {
        name: 'Test Clinician',
        email: 'test.clinician@roundingwell.com',
        last_active_at: null,
      },
      relationships: {
        team: getRelationship(),
        workspaces: getRelationship(),
        role: getRelationship(roleEmployee),
      },
    });

    cy
      .routeClinicians(fx => {
        fx.data = [incompleteClinician];

        return fx;
      })
      .visit(`/clinicians/${ incompleteClinician.id }`)
      .wait('@routeClinicians');

    cy
      .get('.sidebar')
      .find('.sidebar__info');
  });

  specify('never active clinician', function() {
    const inactiveClinician = getClinician({
      attributes: {
        name: 'Test Clinician',
        email: 'test.clinician@roundingwell.com',
        last_active_at: null,
      },
      relationships: {
        team: getRelationship(teamCoordinator),
        role: getRelationship(roleEmployee),
      },
    });

    cy
      .routeClinicians(fx => {
        fx.data = [inactiveClinician];

        return fx;
      })
      .visit(`/clinicians/${ inactiveClinician.id }`)
      .wait('@routeClinicians');

    cy
      .get('.sidebar')
      .as('clinicianSidebar')
      .find('[data-save-region]')
      .as('saveRegion')
      .find('button')
      .should('not.exist');

    cy
      .get('@clinicianSidebar')
      .find('[data-state-region]')
      .contains('Pending');

    cy
      .get('@clinicianSidebar')
      .find('[data-name-region] .js-input')
      .clear()
      .type('Edited Clinician Name');

    cy
      .get('@clinicianSidebar')
      .find('[data-email-region] .js-input')
      .clear()
      .type('edited.email@roundingwell.com')
      .press(Cypress.Keyboard.Keys.TAB)
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-cancel')
      .typeEnter();

    cy
      .get('@saveRegion')
      .find('button')
      .should('not.exist');

    cy
      .get('@clinicianSidebar')
      .find('[data-name-region] .js-input')
      .should('have.value', 'Test Clinician')
      .clear()
      .type('Edited Clinician Name');

    cy
      .intercept('PATCH', `/api/clinicians/${ inactiveClinician.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchClinician');

    cy
      .get('@clinicianSidebar')
      .find('[data-email-region] .js-input')
      .should('have.value', 'test.clinician@roundingwell.com')
      .clear()
      .type('edited.email@roundingwell.com')
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-save')
      .typeEnter();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('Edited Clinician Name');
        expect(data.attributes.email).to.equal('edited.email@roundingwell.com');
      });

    cy
      .get('@saveRegion')
      .find('button')
      .should('not.exist');

    const errors = getErrors([
      { detail: 'name error', sourceKeys: 'attributes/name' },
      { detail: 'email error', sourceKeys: 'attributes/email' },
    ]);

    cy
      .intercept('PATCH', `/api/clinicians/${ inactiveClinician.id }`, {
        statusCode: 400,
        delay: 100,
        body: { errors },
      })
      .as('routePatchClinicianError');

    cy
      .get('@clinicianSidebar')
      .find('[data-email-region] .js-input')
      .clear()
      .type('edited.email@roundingwell.com')
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .typeEnter()
      .wait('@routePatchClinicianError');

    cy
      .get('@clinicianSidebar')
      .find('[data-save-region] button')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-name-region]')
      .should('contain', 'name error')
      .find('.js-input')
      .should('have.css', 'border-top-color', stateColors.error);

    cy
      .get('.sidebar')
      .find('[data-email-region]')
      .should('contain', 'email error')
      .find('.js-input')
      .should('have.css', 'border-top-color', stateColors.error);
  });

  specify('clinician does not exist', function() {
    cy
      .routeClinicians()
      .visit('/clinicians/foo')
      .wait('@routeClinicians');

    cy
      .get('.alert-box')
      .contains('The Clinician you requested does not exist.');

    cy
      .url()
      .should('contain', 'clinicians')
      .should('not.contain', 'clinicians/foo');
  });
});
