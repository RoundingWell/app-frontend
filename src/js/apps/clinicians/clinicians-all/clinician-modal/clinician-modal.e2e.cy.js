import { getErrors } from 'helpers/json-api';
import stateColors from 'helpers/state-colors';

import { workspaceOne } from 'support/api/workspaces';
import { roleManager } from 'support/api/roles';
import { teamNurse } from 'support/api/teams';
import { getClinicianId } from 'support/api/clinicians';

context('clinicians modal', function() {
  specify('add clinician', function() {
    cy
      .routeClinicians()
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('.js-add-clinician')
      .click();

    cy
      .get('.modal')
      .as('modal')
      .find('.js-submit')
      .as('submitButton')
      .should('be.disabled');

    cy
      .get('@modal')
      .find('[data-name-region] .js-input')
      .should('be.focused')
      .should('have.attr', 'placeholder', 'Clinician First Last Name')
      .type('Test Clinician')
      .type('{enter}');

    cy
      .get('@submitButton')
      .should('be.disabled');

    cy
      .get('@modal')
      .find('[data-email-region] .js-input')
      .should('have.attr', 'placeholder', 'clinician@organization.com')
      .type('test.clinician@roundingwell.com')
      .type('{enter}');

    cy
      .get('@submitButton')
      .should('be.disabled');

    cy
      .get('@modal')
      .find('[data-role-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Manager')
      .click();

    cy
      .get('@submitButton')
      .should('be.disabled');

    cy
      .get('.modal')
      .as('modal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('@modal')
      .find('[data-team-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@submitButton')
      .should('be.disabled');

    cy
      .get('@modal')
      .get('[data-workspaces-region] .list-manager__droplist')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Workspace One')
      .click();

    cy
      .get('@submitButton')
      .should('not.be.disabled');

    cy
      .get('@modal')
      .get('[data-workspaces-region] .list-manager__droplist')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Workspace Two')
      .click();

    cy
      .get('@modal')
      .find('.list-manager__item')
      .last()
      .find('.js-remove')
      .click();

    cy
      .get('@modal')
      .get('[data-workspaces-region] .list-manager__droplist')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('contain', 'Workspace Two');

    cy
      .get('@modal')
      .find('.list-manager__item')
      .find('.js-remove')
      .click();

    cy
      .get('@submitButton')
      .should('be.disabled');

    cy
      .get('@modal')
      .get('[data-workspaces-region] .list-manager__droplist')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Workspace One')
      .click();

    cy
      .intercept('POST', '/api/clinicians', {
        statusCode: 201,
        body: {
          data: {
            enabled: true,
            last_active_at: '2021-10-18T04:25:22.961Z',
          },
        },
      })
      .as('routePostClinician');

    cy
      .get('@modal')
      .find('.js-submit')
      .click();

    cy
      .wait('@routePostClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.equal(getClinicianId('test.clinician@roundingwell.com'));
        expect(data.attributes.name).to.equal('Test Clinician');
        expect(data.attributes.email).to.equal('test.clinician@roundingwell.com');
        expect(data.relationships.role.data.id).to.equal(roleManager.id);
        expect(data.relationships.team.data.id).to.equal(teamNurse.id);
        expect(data.relationships.workspaces.data[0].id).to.equal(workspaceOne.id);
      });

    cy
      .get('.js-add-clinician')
      .click();

    cy
      .get('@modal')
      .find('[data-footer-region] .js-close')
      .click();

    cy
      .get('@modal')
      .should('not.exist');

    cy
      .get('.js-add-clinician')
      .click();

    cy
      .get('.modal')
      .as('modal');

    cy
      .get('@modal')
      .find('[data-name-region] .js-input')
      .type('Test Clinician');

    cy
      .get('@modal')
      .find('[data-email-region] .js-input')
      .type('test.clinician@roundingwell.com');

    cy
      .get('@modal')
      .find('[data-role-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Manager')
      .click();

    cy
      .get('@modal')
      .find('[data-team-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@modal')
      .get('[data-workspaces-region] .list-manager__droplist')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Workspace One')
      .click();

    const errors = getErrors([
      { detail: 'name error', sourceKeys: 'attributes/name' },
      { detail: 'email error', sourceKeys: 'attributes/email' },
    ]);

    cy
      .intercept('POST', '/api/clinicians', {
        statusCode: 400,
        delay: 100,
        body: { errors },
      })
      .as('routePostClinicianError');

    cy
      .get('@modal')
      .find('[data-footer-region]')
      .find('.js-submit')
      .click()
      .wait('@routePostClinicianError');

    cy
      .get('.alert-box')
      .should('contain', 'name error, email error');

    cy
      .get('@modal')
      .find('[data-name-region] .js-input')
      .should('have.css', 'border-top-color', stateColors.error);

    cy
      .get('@modal')
      .find('[data-email-region] .js-input')
      .should('have.css', 'border-top-color', stateColors.error);
  });
});
