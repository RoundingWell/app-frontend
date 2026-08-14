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

function chooseLastWeek() {
  cy
    .get('[data-date-filter-region]')
    .should('contain', 'Added:')
    .click();

  cy
    .get('.app-frame__pop-region')
    .contains('Last Week')
    .click();
}

context('worklist loading states', function() {
  specify('shows content-shaped skeletons while the initial worklist and filters load', function() {
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
  });

  specify('retains the current cards while the worklist refreshes', function() {
    let requestCount = 0;

    cy
      .intercept('GET', '/api/actions?*', req => {
        requestCount += 1;
        req.reply({
          delay: requestCount > 1 ? 1000 : 0,
          body: getActionsResponse(),
        });
      })
      .as('routeActions')
      .visit('/worklist/owned-by')
      .wait('@routeActions');

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
  });

  specify('keeps the patient sidebar loader mounted while data loads', function() {
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
  });

  specify('keeps patient sidebar navigation and close actions available while loading', function() {
    cy
      .routesForPatientAction()
      .intercept('GET', '/api/actions?*', { body: getActionsResponse() })
      .as('routeActions')
      .intercept('GET', '/api/patients/**?*', {
        delay: 1000,
        body: { data: patient, included: [] },
      })
      .as('routeDelayedPatient')
      .visit('/worklist/owned-by')
      .wait('@routeActions')
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

  specify('closes the patient sidebar when its patient cannot load', function() {
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
  });

  specify('keeps the previous cards and offers retry when a refresh fails', function() {
    let shouldFail = false;

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
      .wait('@routeActions')
      .then(() => {
        shouldFail = true;
      });

    chooseLastWeek();

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
