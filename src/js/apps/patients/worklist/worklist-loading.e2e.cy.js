import { v4 as uuid } from 'uuid';

import { getErrors, getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getFilter } from 'support/api/filters';
import { getPatient } from 'support/api/patients';
import { getWorkspacePatient } from 'support/api/workspace-patients';

const patient = getPatient({
  attributes: {
    first_name: 'Test',
    last_name: 'Patient',
    segment: 'Test Facility',
  },
});

const action = getAction({
  attributes: {
    name: 'Loading State Action',
  },
  relationships: {
    patient: getRelationship(patient),
  },
});

function getActionsResponse() {
  return {
    data: [action],
    included: [patient],
    meta: {
      actions: { total: 1 },
      worklist: uuid(),
    },
  };
}

function chooseLastWeek(label = 'Last Week') {
  cy
    .get('[data-date-filter-region]')
    .should('contain', 'Added:')
    .click();

  cy
    .get('.app-frame__pop-region')
    .contains(label)
    .click();
}

context('worklist loading states', function() {
  specify('initial loading, refresh loading, and retry preserve worklist content', function() {
    cy.viewport(1440, 720);

    const filter = getFilter({
      attributes: {
        name: 'Facility',
        slug: 'facility',
        values: [{ value: 'Test Facility', total: 1 }],
      },
    });

    cy
      .routeSettings('custom_filters', ['facility'])
      .intercept('GET', '/api/actions?*', {
        delay: 1000,
        body: getActionsResponse(),
      })
      .as('routeDelayedActions')
      .intercept('GET', '/api/filters/facility/**', {
        delay: 1500,
        body: { data: filter, included: [] },
      })
      .as('routeDelayedFilter')
      .visit('/worklist/owned-by');

    cy
      .get('.worklist-list__count-skeleton')
      .should('be.visible');

    cy
      .get('.worklist-list__skeleton')
      .should('be.visible')
      .should('have.attr', 'aria-busy', 'true')
      .find('.worklist-list__skeleton-item')
      .should('have.length', 3);

    cy
      .get('.list-filters__skeleton')
      .should('be.visible')
      .should('have.attr', 'aria-busy', 'true')
      .find('.list-filters__skeleton-filter')
      .should('have.length', 1);

    cy
      .wait('@routeDelayedActions')
      .get('.list-page__list')
      .should('have.attr', 'aria-busy', 'false')
      .should('contain', 'Loading State Action');

    cy
      .get('.patient-list-page__count')
      .should('contain', '1 Action')
      .find('.worklist-list__count-skeleton')
      .should('not.exist');

    cy
      .get('.list-filters__skeleton')
      .should('have.attr', 'aria-busy', 'true');

    cy
      .wait('@routeDelayedFilter')
      .get('.list-filters__custom-filters')
      .should('have.attr', 'aria-busy', 'false')
      .should('contain', 'Facility');

    cy
      .intercept('GET', '/api/actions?*', req => {
        req.reply({
          delay: 1000,
          body: getActionsResponse(),
        });
      })
      .as('routeActions')
    ;

    chooseLastWeek();

    cy
      .get('.list-page__list')
      .should('be.visible')
      .should('contain', 'Loading State Action')
      .should('have.class', 'is-loading')
      .should('have.attr', 'aria-busy', 'true');

    cy
      .get('.worklist-list__updating')
      .should('be.visible')
      .should('contain', 'Updating actions')
      .parents('.patient-list-page__count')
      .should('contain', 'Updating actions')
      .should('not.contain', '1 Action');

    cy
      .wait('@routeActions')
      .get('.list-page__list')
      .should('not.have.class', 'is-loading')
      .should('have.attr', 'aria-busy', 'false')
      .should('contain', 'Loading State Action');

    let shouldFail = true;

    cy
      .intercept('GET', '/api/actions?*', req => {
        if (shouldFail) {
          req.reply({ statusCode: 422, body: { errors: [] } });
          return;
        }

        req.reply({ body: getActionsResponse() });
      })
      .as('routeActions')
    ;

    chooseLastWeek('This Week');

    cy
      .wait('@routeActions')
      .get('.list-page__list')
      .should('contain', 'Loading State Action')
      .should('have.attr', 'aria-busy', 'false');

    cy
      .get('.worklist-list__error')
      .should('contain', 'The worklist could not be updated.')
      .find('button')
      .should('contain', 'Retry')
      .then(() => {
        shouldFail = false;
      })
      .click();

    cy
      .wait('@routeActions')
      .get('.worklist-list__error')
      .should('not.exist');
  });

  specify('patient sidebar loading preserves its shell, close, and navigation controls', function() {
    let loadingElement;
    const workspacePatient = getWorkspacePatient();

    cy
      .routesForPatientAction()
      .intercept('GET', '/api/actions?*', { body: getActionsResponse() })
      .as('routeActions')
      .intercept('GET', '/api/patients/**?*', {
        delay: 1000,
        body: { data: patient, included: [] },
      })
      .as('routeDelayedPatient')
      .intercept('GET', '/api/workspace-patients/*', {
        delay: 1500,
        body: { data: workspacePatient, included: [] },
      })
      .as('routeDelayedWorkspacePatient')
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.patient-list__patient')
      .first()
      .click();

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.patient-list-page__sidebar-content > .loader')
      .should('not.exist');

    cy
      .get('.patient-sidebar__sidebars .loader__skeleton')
      .should('be.visible')
      .then($skeleton => {
        loadingElement = $skeleton[0];
      });

    cy
      .wait('@routeDelayedPatient')
      .get('.patient-sidebar__sidebars .loader__skeleton')
      .should($skeleton => {
        expect($skeleton[0]).to.equal(loadingElement);
      });

    cy
      .wait('@routeDelayedWorkspacePatient')
      .get('.patient-sidebar__card')
      .first()
      .should('be.visible');

    cy.get('.patient-sidebar__close').click();

    cy
      .get('.patient-list__patient')
      .first()
      .click();

    cy
      .get('.patient-sidebar__close')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.patient-list__patient')
      .first()
      .click();

    cy
      .get('.patient-sidebar__name')
      .click();

    cy
      .location('pathname')
      .should('contain', `/patient/${ patient.id }/workflow`);
  });

  specify('patient sidebar closes after API and network failures', function() {
    cy
      .routesForPatientAction()
      .intercept('GET', '/api/actions?*', { body: getActionsResponse() })
      .as('routeActions')
      .intercept('GET', '/api/patients/**?*', {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find patient',
          }),
        },
      })
      .as('routeMissingPatient')
      .visit('/worklist/owned-by')
      .wait('@routeActions')
      .get('.patient-list__patient')
      .first()
      .click()
      .wait('@routeMissingPatient');

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.alert-box')
      .should('contain', 'Cannot find patient');

    cy
      .intercept('GET', '/api/patients/**?*', { forceNetworkError: true })
      .as('routePatientNetworkError')

      .get('.patient-list__patient')
      .first()
      .click()
      .wait('@routePatientNetworkError');

    cy
      .get('.patient-sidebar')
      .should('not.exist');
  });

  specify('offers retry when the initial worklist load fails', function() {
    let shouldFail = true;

    cy
      .intercept('GET', '/api/actions?*', req => {
        if (shouldFail) {
          req.reply({ statusCode: 422, body: { errors: [] } });
          return;
        }

        req.reply({ body: getActionsResponse() });
      })
      .as('routeActions')
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__error')
      .should('contain', 'The worklist could not be loaded.');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Added: Oldest - Newest')
      .click();

    cy.then(() => {
      shouldFail = false;
    });

    cy
      .get('.worklist-list__error .js-retry')
      .click()
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .should('exist');

    cy.then(() => {
      cy
        .routesForDefault()
        .intercept('GET', '/api/actions?*', { statusCode: 400, body: {} })
        .as('failedWorklist')
        .visit('/worklist/owned-by')
        .wait('@failedWorklist')
        .wait('@failedWorklist');

      cy.get('.worklist-list__error').should('be.visible');

      // A failed initial list must also allow navigation away and back before retrying.
      cy.routeDashboards();
      cy.get('.app-nav__link').contains('Dashboards').click().wait('@routeDashboards');
      cy.location('pathname').should('equal', '/one/dashboards');
      cy.go('back').wait('@failedWorklist').wait('@failedWorklist');
      cy.get('.worklist-list__error').should('be.visible');

      cy.routeActions();
      cy.get('.worklist-list__error .js-retry').click();
      cy.wait('@routeActions');
      cy.get('.worklist-list__error').should('not.exist');
      cy.get('.worklist-list__list').should('be.visible');
    });
  });

  specify('shows a retryable error when custom filters cannot load', function() {
    let shouldFail = true;
    const filter = getFilter({
      attributes: {
        name: 'Facility',
        slug: 'facility',
        values: [{ value: 'Test Facility', total: 1 }],
      },
    });

    cy
      .routeSettings('custom_filters', ['facility'])
      .intercept('GET', '/api/actions?*', { body: getActionsResponse() })
      .as('routeActions')
      .intercept('GET', '/api/filters/facility/**', req => {
        if (shouldFail) {
          req.reply({ statusCode: 410, body: { errors: [] } });
          return;
        }

        req.reply({
          delay: 1000,
          body: { data: filter, included: [] },
        });
      })
      .as('routeFilter')
      .visit('/worklist/owned-by')
      .wait('@routeActions')
      .wait('@routeFilter');

    cy
      .get('.list-filters__load-error')
      .should('have.attr', 'role', 'alert')
      .should('contain', 'Custom filters could not be loaded.')
      .find('button')
      .should('contain', 'Retry')
      .then(() => {
        shouldFail = false;
      })
      .click();

    cy
      .get('.list-filters__skeleton')
      .should('have.attr', 'aria-busy', 'true');

    cy
      .wait('@routeFilter')
      .get('.list-filters__load-error')
      .should('not.exist');
  });
});
