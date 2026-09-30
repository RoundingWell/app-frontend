import { v4 as uuid } from 'uuid';

import { getErrors, getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getFilter } from 'support/api/filters';
import { getDashboard } from 'support/api/dashboards';
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
          errors: getErrors([
            { status: '410', detail: 'Cannot find patient' },
            { status: '410', detail: 'Patient access was removed' },
          ]),
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
      .should('have.length', 2)
      .and('contain', 'Cannot find patient');

    cy
      .get('.alert-box')
      .first()
      .find('.js-dismiss')
      .click();

    cy
      .get('.alert-box')
      .should('have.length', 1)
      .and('contain', 'Patient access was removed');
  });

  specify('closes the patient sidebar when its request loses the network', function() {
    cy
      .routesForPatientAction()
      .intercept('GET', '/api/actions?*', { body: getActionsResponse() })
      .as('routeActions')
      .intercept('GET', '/api/patients/**?*', { forceNetworkError: true })
      .as('routePatientNetworkError')
      .visit('/worklist/owned-by')
      .wait('@routeActions')
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

    cy
      .get('.worklist-list__error')
      .find('.js-retry')
      .click()
      .wait('@routeActions');

    cy
      .get('.worklist-list__error')
      .should('contain', 'The worklist could not be loaded.');

    cy
      .then(() => {
        shouldFail = false;
      });

    cy
      .get('.worklist-list__error .js-retry')
      .click()
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .should('exist');

    cy
      .routesForDefault()
      .intercept('GET', '/api/actions?*', { statusCode: 400, body: {} })
      .as('failedWorklist')
      .visit('/worklist/owned-by')
      .wait('@failedWorklist')
      .wait('@failedWorklist');

    cy
      .get('.worklist-list__error')
      .should('be.visible');

    // A failed initial list must also allow navigation away and back before retrying.
    cy.routeDashboards();

    cy
      .get('.app-nav__link')
      .contains('Dashboards')
      .click()
      .wait('@routeDashboards');

    cy
      .location('pathname')
      .should('equal', '/one/dashboards');

    cy
      .go('back')
      .wait('@failedWorklist')
      .wait('@failedWorklist');

    cy
      .get('.worklist-list__error')
      .should('be.visible');

    cy.routeActions();

    cy
      .get('.worklist-list__error')
      .find('.js-retry')
      .click();

    cy
      .wait('@routeActions');

    cy
      .get('.worklist-list__error')
      .should('not.exist');

    cy
      .get('.worklist-list__list')
      .should('be.visible');

    // Date refresh does not change the default state/custom-filter selection.
    cy
      .intercept('GET', '/api/actions?*', {
        statusCode: 400,
        body: { errors: [] },
      })
      .as('failedDefaultFiltersRefresh');
    chooseLastWeek();

    cy
      .wait('@failedDefaultFiltersRefresh');

    cy
      .get('.worklist-list__error')
      .should('contain', 'The worklist could not be updated.');

    cy
      .get('.list-page__list')
      .should('have.attr', 'aria-busy', 'false');

    cy
      .get('.worklist-list__item')
      .should('exist');

    cy.routeActions();

    cy
      .get('.worklist-list__error')
      .find('.js-retry')
      .click()
      .wait('@routeActions');

    cy
      .get('.worklist-list__error')
      .should('not.exist');

    cy
      .get('.list-page__list')
      .should('have.attr', 'aria-busy', 'false');

    cy
      .get('.worklist-list__updating')
      .should('not.exist');

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

  specify('ignores a replaced worklist filter response', function() {
    cy
      .intercept('GET', '/api/actions?*', { body: getActionsResponse() })
      .as('routeActions')
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    let releaseOldFilter;
    let oldFilterRequested = false;
    const oldFilterResponse = new Cypress.Promise(resolve => {
      releaseOldFilter = resolve;
    });

    cy
      .intercept('GET', '/api/actions?*', req => {
        if (oldFilterRequested) {
          req.reply({ body: getActionsResponse() });
          return;
        }
        oldFilterRequested = true;
        req.alias = 'oldFilter';
        const response = getActionsResponse();
        response.data = [{ ...action, attributes: { ...action.attributes, name: 'Outdated filter result' } }];
        return oldFilterResponse.then(() => req.reply({ body: response }));
      });

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click();

    cy
      .wrap(null)
      .should(() => expect(oldFilterRequested).to.equal(true));

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click();

    cy
      .get('.list-page__list')
      .should('have.attr', 'aria-busy', 'false')
      .then(() => releaseOldFilter());

    cy
      .wait('@oldFilter');

    cy.waitForAppRequests();

    cy
      .get('.list-page__list')
      .should('contain', 'Loading State Action')
      .and('not.contain', 'Outdated filter result');
  });

  specify('ignores initial worklist responses after navigating away', function() {
    const filter = getFilter({ attributes: { name: 'Facility', slug: 'facility', values: [{ value: 'Test Facility', total: 1 }] } });

    cy
      .routeSettings('custom_filters', ['facility'])
      .intercept('GET', '/api/filters/facility/**', { body: { data: filter, included: [] } });

    let releaseInitialActions;
    let initialActionsRequested = false;
    const initialActionsResponse = new Cypress.Promise(resolve => {
      releaseInitialActions = resolve;
    });

    cy
      .routeDashboards(fx => {
        fx.data = [getDashboard({ attributes: { name: 'Destination Dashboard' } })];

        return fx;
      });

    cy
      .intercept('GET', '/api/actions?*', req => {
        initialActionsRequested = true;
        return initialActionsResponse.then(() => req.reply({ body: getActionsResponse() }));
      })
      .as('abandonedInitialActions');

    cy
      .visit('/worklist/owned-by');

    cy
      .wrap(null)
      .should(() => expect(initialActionsRequested).to.equal(true));

    cy
      .get('.worklist-list__skeleton')
      .should('be.visible');
    // The controls belong to the page, so initial results must not block them.
    cy
      .get('[data-owner-filter-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Clinician McTester')
      .click();

    cy
      .get('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.list-page')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.list-page')
      .should('not.have.class', 'is-filters-collapsed');

    cy
      .get('.list-filters__skeleton')
      .should('have.attr', 'aria-busy', 'true');

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click();

    cy
      .intercept('GET', '/api/flows?*', req => {
        return initialActionsResponse.then(() => req.reply({
          body: { data: [], included: [], meta: { flows: { total: 0 }, worklist: uuid() } },
        }));
      });

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click();

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .click();

    cy
      .get('.worklist-list__skeleton')
      .should('be.visible');

    cy
      .get('.app-nav__link')
      .contains('Dashboards')
      .click()
      .wait('@routeDashboards');

    cy
      .location('pathname')
      .should('equal', '/one/dashboards');

    cy
      .get('.card-list__item')
      .should('contain', 'Destination Dashboard');

    cy
      .then(() => releaseInitialActions());

    cy
      .wait('@abandonedInitialActions');

    cy.waitForAppRequests();

    cy
      .location('pathname')
      .should('equal', '/one/dashboards');

    cy
      .get('.card-list__item')
      .should('contain', 'Destination Dashboard');

    cy
      .get('.worklist-list__list')
      .should('not.exist');
  });

  specify('reopens the sidebar during close and viewport transitions', function() {
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

    [0, 1, 2, 4, 8].forEach(turns => {
      cy
        .get('.patient-sidebar__close')
        .then(async $close => {
          const document = $close[0].ownerDocument;
          $close[0].click();
          for (let turn = 0; turn < turns; turn++) await Promise.resolve();
          document.querySelector('.patient-list__patient').click();
        });

      cy
        .get('.patient-sidebar__card:not(.patient-sidebar__loader-card)')
        .first()
        .should('be.visible');
    });
    // Reopen as resize removes the old sidebar, before filters finish mounting.
    let reopened;

    cy
      .window()
      .then(win => {
        reopened = new Cypress.Promise(resolve => {
          const observer = new win.MutationObserver(() => {
            if (win.document.querySelector('.patient-sidebar')) return;
            observer.disconnect();
            win.document.querySelector('.patient-list__patient').click();
            resolve();
          });
          observer.observe(win.document.querySelector('.list-page'), { childList: true, subtree: true });
        });
      });

    cy.viewport(640, 720);

    cy
      .then(() => reopened);

    cy
      .get('.patient-sidebar__card:not(.patient-sidebar__loader-card)')
      .first()
      .should('be.visible');

    cy
      .get('.patient-sidebar__close')
      .then($close => {
        const doc = $close[0].ownerDocument;
        $close[0].dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        doc.querySelector('.patient-list__patient').click();
      });

    cy
      .get('.patient-sidebar__card:not(.patient-sidebar__loader-card)')
      .first()
      .should('be.visible');

    cy
      .get('.patient-sidebar__close')
      .focus()
      .type('{esc}');

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.patient-list__patient')
      .first()
      .should('be.focused');

    cy
      .get('.patient-list__patient')
      .first()
      .click();

    cy
      .get('.patient-sidebar__card:not(.patient-sidebar__loader-card)')
      .first()
      .should('be.visible');

    cy.viewport(1440, 720);

    cy
      .get('.patient-sidebar__close')
      .click();

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

  specify('ignores a previous patient failure after opening another sidebar', function() {
    cy.routesForPatientAction();

    const nextPatient = getPatient({ attributes: { first_name: 'Latest', last_name: 'Patient' } });
    const nextAction = getAction({ relationships: { patient: getRelationship(nextPatient) } });
    let releaseOldPatient;
    let oldPatientRequested = false;
    const oldPatientResponse = new Cypress.Promise(resolve => {
      releaseOldPatient = resolve;
    });

    cy
      .intercept('GET', '/api/actions?*', {
        body: {
          data: [action, nextAction],
          included: [patient, nextPatient],
          meta: { actions: { total: 2 }, worklist: uuid() },
        },
      })
      .as('twoPatients');

    cy
      .intercept('GET', `/api/patients/${ patient.id }?*`, req => {
        oldPatientRequested = true;
        return oldPatientResponse.then(() => req.reply({
          statusCode: 410,
          body: { errors: getErrors([{ status: '410', detail: 'Previous patient is unavailable' }]) },
        }));
      })
      .as('oldPatientFailure');

    cy
      .intercept('GET', `/api/patients/${ nextPatient.id }?*`, {
        body: { data: nextPatient, included: [] },
      })
      .as('latestPatient');

    cy
      .visit('/worklist/owned-by')
      .wait('@twoPatients');

    cy
      .get('.patient-list__patient')
      .contains('Test Patient')
      .click();

    cy
      .wrap(null)
      .should(() => expect(oldPatientRequested).to.equal(true));

    cy
      .get('.patient-list__patient')
      .contains('Latest Patient')
      .click();

    cy
      .wait('@latestPatient');

    cy
      .get('.patient-sidebar')
      .should('contain', 'Latest Patient');

    cy
      .then(() => releaseOldPatient());

    cy
      .wait('@oldPatientFailure');

    cy.waitForAppRequests();

    cy
      .get('.patient-sidebar')
      .should('contain', 'Latest Patient');

    cy
      .get('.list-filters')
      .should('not.exist');

    cy
      .get('body')
      .should('not.contain', 'Previous patient is unavailable');
  });
});
