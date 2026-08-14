import formatDate from 'helpers/format-date';
import { testTs } from 'helpers/test-timestamp';
import { getRelationship } from 'helpers/json-api';

import { getClinician } from 'support/api/clinicians';
import { roleAdmin, roleEmployee, roleManager } from 'support/api/roles';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { workspaceOne, workspaceTwo } from 'support/api/workspaces';

context('clinicians list', function() {
  specify('display clinicians list', function() {
    cy.viewport(2200, 900);

    const testClinicians = [
      getClinician({
        attributes: {
          name: 'Aaron Aaronson',
          last_active_at: testTs(),
        },
        relationships: {
          role: getRelationship(roleEmployee),
          team: getRelationship(teamCoordinator),
        },
      }),
      getClinician({
        attributes: {
          name: 'Baron Baronson',
          last_active_at: null,
        },
      }),
    ];

    cy
      .routeClinicians(fx => {
        fx.data = testClinicians;

        return fx;
      })
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('.js-add-clinician')
      .should('be.visible');

    cy
      .get('.card-list')
      .find('.card-list__item')
      .last()
      .should('contain', 'Baron Baronson');

    cy
      .get('.card-list')
      .find('.card-list__item')
      .first()
      .should('contain', 'Aaron Aaronson')
      .should('contain', 'Workspace One, Workspace Two')
      .find('.card-list__item-controls')
      .find('.clinician-state--active')
      .parents('.card-list__item-controls')
      .should('contain', formatDate(testTs(), 'TIME_OR_DAY'));

    cy
      .get('[data-role-region]')
      .contains('Employee')
      .click();

    cy
      .get('.card-list')
      .find('.card-list__item')
      .eq(1)
      .should('contain', 'Baron Baronson')
      .should('contain', 'Workspace One, Workspace Two')
      .find('.card-list__item-controls')
      .find('.clinician-state--pending')
      .parents('.card-list__item-controls')
      .contains('Never');

    cy
      .intercept('PATCH', '/api/clinicians/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchClinician');

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
      .get('.card-list')
      .find('.card-list__item')
      .find('[data-team-region]')
      .contains('CO')
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
      .get('.card-list')
      .find('.card-list__item')
      .first()
      .as('firstItem');

    cy
      .get('@firstItem')
      .find('[data-state-region]')
      .find('button')
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
      .get('@firstItem')
      .contains('NUR')
      .should('be.disabled');

    cy
      .get('@firstItem')
      .contains('Manager')
      .should('be.disabled');

    cy
      .get('@firstItem')
      .find('[data-state-region]')
      .find('button')
      .click();

    cy
      .get('@firstItem')
      .click();

    cy
      .url()
      .should('contain', `clinicians/${ testClinicians[0].id }`);

    cy
      .get('@firstItem')
      .should('contain', 'Aaron Aaronson')
      .should('have.class', 'is-selected');
  });

  specify('empty clinicians list', function() {
    cy
      .routeClinicians(fx => {
        fx.data = [];

        return fx;
      })
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('.card-list__empty')
      .contains('No Clinicians');
  });

  specify('find in list', function() {
    cy
      .routeClinicians(fx => {
        fx.data = [
          getClinician({
            attributes: {
              name: 'Aaron Aaronson',
            },
            relationships: {
              workspaces: getRelationship([workspaceOne]),
              role: getRelationship(roleEmployee),
            },
          }),
          getClinician({
            attributes: {
              name: 'Baron Baronson',
            },
            relationships: {
              workspaces: getRelationship([workspaceTwo]),
              role: getRelationship(roleAdmin),
            },
          }),
        ];

        return fx;
      })
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .type('abc');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .list-search__container')
      .should('have.class', 'is-applied');

    cy
      .get('.list-page__list')
      .as('cliniciansList')
      .find('.card-list__empty')
      .should('contain', 'No results match your Find in List search');

    cy
      .get('@listSearch')
      .next()
      .should('have.class', 'js-clear')
      .click();

    cy
      .get('.list-page__header')
      .find('[data-search-region] .list-search__container')
      .should('not.have.class', 'is-applied');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 2);

    cy
      .get('@listSearch')
      .next()
      .should('not.be.visible');

    cy
      .get('@listSearch')
      .type('Aaron');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 1)
      .first()
      .should('contain', 'Aaron Aaronson');

    cy
      .get('@listSearch')
      .clear()
      .type('Workspace One');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 1)
      .first()
      .should('contain', 'Workspace One');

    cy
      .get('@listSearch')
      .clear()
      .type('Employee');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 1)
      .first()
      .should('contain', 'Employee');

    cy
      .routeActions()
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Owned By')
      .click()
      .wait('@routeActions');

    cy
      .go('back')
      .wait('@routeClinicians');

    cy
      .get('@listSearch')
      .should('have.attr', 'value', 'Employee');
  });
});
