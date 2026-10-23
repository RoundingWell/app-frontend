import formatDate from 'helpers/format-date';
import { testTs } from 'helpers/test-timestamp';
import { getRelationship } from 'helpers/json-api';

import { fxCurrentClinician, getClinician } from 'support/api/clinicians';
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
      .get('[data-status-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Enabled')
      .click();

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
      .get('[data-status-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Active')
      .click();

    cy
      .get('.card-list')
      .find('.card-list__item')
      .should('have.length', 1)
      .first()
      .as('firstItem')
      .should('contain', 'Aaron Aaronson');

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
      .get('.card-list')
      .should('not.contain', 'Aaron Aaronson');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Disabled')
      .click();

    cy
      .get('.card-list')
      .find('.card-list__item')
      .should('have.length', 1)
      .first()
      .as('firstItem');

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
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Active')
      .click();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.enabled).to.be.true;
      });

    cy
      .get('.card-list')
      .should('not.contain', 'Aaron Aaronson');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Active')
      .click();

    cy
      .get('.card-list')
      .find('.card-list__item')
      .first()
      .as('firstItem')
      .click();

    cy
      .url()
      .should('contain', `clinicians/${ testClinicians[0].id }`);

    cy
      .get('@firstItem')
      .should('contain', 'Aaron Aaronson')
      .should('have.class', 'is-selected');
  });

  specify('empty and failed clinicians list', function() {
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

    cy
      .intercept('GET', '/api/clinicians', {
        statusCode: 422,
        body: { errors: [] },
      })
      .as('routeCliniciansError')
      .visit('/clinicians')
      .wait('@routeCliniciansError');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 422.');
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
      .should('have.prop', 'tagName', 'BUTTON')
      .should('have.attr', 'type', 'button')
      .should('have.attr', 'aria-label', 'Clear Search')
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

  specify('filter clinicians by status', function() {
    const clinicians = [
      getClinician({
        attributes: {
          name: 'Quinn Active',
          enabled: true,
          last_active_at: testTs(),
        },
        relationships: {
          role: getRelationship(roleEmployee),
          team: getRelationship(teamCoordinator),
          workspaces: getRelationship([workspaceOne]),
        },
      }),
      getClinician({
        attributes: {
          name: 'Sam Active',
          enabled: true,
          last_active_at: testTs(),
        },
        relationships: {
          role: getRelationship(roleEmployee),
          team: getRelationship(teamCoordinator),
          workspaces: getRelationship([workspaceOne]),
        },
      }),
      getClinician({
        attributes: {
          name: 'Sam Pending',
          enabled: true,
          last_active_at: null,
        },
        relationships: {
          role: getRelationship(roleEmployee),
          team: getRelationship(teamCoordinator),
          workspaces: getRelationship([workspaceOne]),
        },
      }),
      getClinician({
        attributes: {
          name: 'Sam Disabled',
          enabled: false,
          last_active_at: testTs(),
        },
        relationships: {
          role: getRelationship(roleEmployee),
          team: getRelationship(teamCoordinator),
          workspaces: getRelationship([workspaceOne]),
        },
      }),
    ];

    cy
      .routeClinicians(fx => {
        fx.data = clinicians;

        return fx;
      })
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('.list-page__topbar')
      .find('[data-search-region] + [data-status-filter-region] button')
      .as('statusFilter')
      .should('contain', 'Active');

    cy
      .get('.list-page__list')
      .as('cliniciansList')
      .should('contain', 'Quinn Active')
      .should('contain', 'Sam Active')
      .should('not.contain', 'Sam Pending')
      .should('not.contain', 'Sam Disabled');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 2);

    cy
      .get('@statusFilter')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Filter by Status')
      .and('contain', 'Pending');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 4)
      .first()
      .should('contain', 'Active')
      .should('have.class', 'is-selected');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .eq(1)
      .should('contain', 'Pending');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .eq(2)
      .should('contain', 'Enabled');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .eq(3)
      .should('contain', 'Disabled')
      .click();

    cy
      .get('@statusFilter')
      .should('contain', 'Disabled');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 1)
      .should('contain', 'Sam Disabled');

    cy
      .get('@statusFilter')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Enabled')
      .click();

    cy
      .get('@statusFilter')
      .should('contain', 'Enabled');

    cy
      .get('@cliniciansList')
      .should('contain', 'Quinn Active')
      .should('contain', 'Sam Active')
      .should('contain', 'Sam Pending')
      .should('not.contain', 'Sam Disabled');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 3);

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .type('Sam');

    cy
      .get('@cliniciansList')
      .should('contain', 'Sam Active')
      .should('contain', 'Sam Pending')
      .should('not.contain', 'Quinn Active')
      .should('not.contain', 'Sam Disabled');

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 2);

    cy
      .get('@statusFilter')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Active')
      .click();

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 1)
      .should('contain', 'Sam Active');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@statusFilter')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Disabled')
      .click();

    cy
      .get('@cliniciansList')
      .find('.card-list__item')
      .should('have.length', 1)
      .should('contain', 'Sam Disabled');

    cy
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .go('back')
      .wait('@routeClinicians');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .should('contain', 'Disabled');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .should('have.length', 1)
      .should('contain', 'Sam Disabled');

    cy
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .should('contain', 'Disabled');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .should('have.length', 1)
      .should('contain', 'Sam Disabled');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Pending')
      .click();

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .should('contain', 'Pending');

    cy
      .get('.list-page__list')
      .should('contain', 'Sam Pending')
      .should('not.contain', 'Quinn Active')
      .should('not.contain', 'Sam Active')
      .should('not.contain', 'Sam Disabled');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .should('have.length', 1);

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .type('Sam');

    cy
      .get('.list-page__list')
      .should('contain', 'Sam Pending')
      .should('not.contain', 'Sam Active')
      .should('not.contain', 'Sam Disabled')
      .should('not.contain', 'Quinn Active');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .should('have.length', 1);

    cy
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .should('contain', 'Pending');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .should('have.length', 1)
      .should('contain', 'Sam Pending');

    cy
      .intercept('PATCH', '/api/clinicians/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchClinician');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .find('[data-state-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Disabled')
      .click();

    cy
      .wait('@routePatchClinician')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.enabled).to.be.false;
      });

    cy
      .get('.list-page__list')
      .should('not.contain', 'Sam Pending');

    cy
      .get('.list-page__list')
      .find('.card-list__item')
      .should('have.length', 0);

    cy.window().then(win => {
      win.localStorage.setItem(`cliniciansStatusFilter_${ fxCurrentClinician.id }`, JSON.stringify('nope'));
    });

    cy
      .visit('/clinicians')
      .wait('@routeClinicians');

    cy
      .get('[data-status-filter-region]')
      .find('button')
      .should('contain', 'Active');

    cy
      .get('.list-page__list')
      .should('contain', 'Quinn Active')
      .should('contain', 'Sam Active')
      .should('not.contain', 'Sam Pending')
      .should('not.contain', 'Sam Disabled');
  });
});
