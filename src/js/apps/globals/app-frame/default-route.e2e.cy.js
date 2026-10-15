import { NIL as NIL_UUID } from 'uuid';

import { getErrors, getRelationship } from 'helpers/json-api';

import { getCurrentClinician } from 'support/api/clinicians';

context('default routes', function() {
  specify('default route', function() {
    cy
      .routesForDefault()
      .routesForPatientWorkflow()
      .visit();

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.js-patient')
      .first()
      .click()
      .wait('@routePatient');

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.patient-sidebar__name')
      .click()
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');
  });

  specify('closes the patient sidebar before routing to another list', function() {
    cy
      .routesForDefault()
      .routesForPatientWorkflow()
      .visit();

    cy
      .get('.js-patient')
      .first()
      .click();

    cy
      .get('.patient-sidebar')
      .should('be.visible');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Shared By"]')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/shared-by');

    cy
      .get('.patient-sidebar')
      .should('not.exist');
  });

  specify('selecting the current nav item reloads its list', function() {
    cy
      .routesForDefault()
      .visit()
      .wait('@routeActions');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .first()
      .should('have.class', 'is-selected');

    cy
      .get('@routeActions.all')
      .its('length')
      .then(requestCount => {
        cy
          .get('[data-worklists-region]')
          .find('.app-nav__link')
          .first()
          .click();

        cy
          .get('@routeActions.all')
          .should('have.length', requestCount + 1);
      });

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');
  });

  specify('unmatched workspace paths render not-found, including on back navigation', function() {
    cy
      .routesForDefault()
      .visit();

    cy
      .get('.list-page')
      .should('exist');

    cy
      .navigate('/not-a-page');

    cy
      .get('.error-page')
      .should('contain', ' This page doesn\'t exist.');

    cy
      .get('.list-page')
      .should('not.exist');

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist');

    cy
      .go('back');

    cy
      .get('.error-page')
      .should('contain', ' This page doesn\'t exist.');

    cy
      .location('pathname')
      .should('equal', '/one/not-a-page');

    cy
      .go('forward');

    cy
      .get('.error-page')
      .should('not.exist');

    cy
      .get('.list-page')
      .should('exist');
  });

  specify('the latest navigation wins when two arrive together', function() {
    cy
      .routesForDefault()
      .routePrograms()
      .visit();

    cy
      .get('.list-page')
      .should('exist');

    cy
      .window()
      .then(win => {
        win.navigation.navigate('/one/programs');
        win.navigation.navigate('/one/worklist/shared-by');
      });

    cy
      .location('pathname')
      .should('equal', '/one/worklist/shared-by');

    cy
      .get('.list-page__title')
      .should('contain', 'Shared By');

    // A later round trip lets any stale programs activation reach the API before asserting.
    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link')
      .first()
      .click();

    cy
      .get('.list-page__title')
      .should('contain', 'Owned By');

    cy
      .get('@routePrograms.all')
      .should('have.length', 0);
  });

  specify('a navigation superseded while its area loads never renders its page', function() {
    let releaseProgramsArea;
    const programsArea = new Cypress.Promise(resolve => {
      releaseProgramsArea = resolve;
    });

    cy
      .routesForDefault()
      .routePrograms()
      .intercept('GET', '**/*-programs-main_app-*.js', req => {
        return programsArea.then(() => req.continue());
      })
      .as('routeProgramsArea')
      .visit();

    cy
      .get('.list-page')
      .should('exist');

    cy
      .window()
      .then(win => {
        win.navigation.navigate('/one/programs');
      });

    cy
      .get('@routeProgramsArea.all')
      .should('have.length', 1);

    cy
      .navigate('/schedule');

    cy
      .get('.schedule-list-page')
      .should('exist')
      .then(() => {
        releaseProgramsArea();
      });

    cy
      .wait('@routeProgramsArea');

    // Gives the stale programs activation time to resume before asserting.
    cy
      .window()
      .then(win => new Cypress.Promise(resolve => win.setTimeout(resolve, 250)));

    cy
      .location('pathname')
      .should('equal', '/one/schedule');

    cy
      .get('.schedule-list-page')
      .should('exist');
  });

  specify('a navigation finishes once its page is ready', function() {
    cy
      .routesForDefault()
      .visit();

    cy
      .window()
      .then(win => {
        return win.navigation.navigate('/one/schedule').finished.then(() => {
          return !!win.document.querySelector('.schedule-list-page');
        });
      })
      .should('be.true');
  });

  specify('focuses the content after navigating to a new page', function() {
    cy
      .routesForDefault()
      .visit();

    cy
      .get('.list-page')
      .should('exist');

    cy
      .get('[data-content-region]')
      .should('not.be.focused');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Shared By"]')
      .click();

    cy
      .get('[data-content-region]')
      .should('be.focused');
  });

  specify('back to list returns to the last list with its arguments', function() {
    cy
      .routesForDefault()
      .routesForPatientWorkflow()
      .visit();

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Shared By"]')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/shared-by');

    cy
      .get('.js-patient')
      .first()
      .click()
      .wait('@routePatient');

    cy
      .get('.patient-sidebar__name')
      .click()
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/shared-by');

    cy
      .get('.list-page')
      .should('be.visible');
  });

  specify('closes popups and modals on route change', function() {
    cy
      .routesForDefault()
      .visit();

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Shared By"]')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/shared-by');

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .should('be.visible');

    cy.go('back');

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.picklist')
      .should('not.exist');

    cy.go('forward');

    cy
      .url()
      .should('contain', 'one/worklist/shared-by');

    cy
      .getRadio(Radio => {
        Radio.trigger('hotkey', 'search', { preventDefault() {} });
      });

    cy
      .get('.patient-search__modal')
      .should('be.visible');

    cy.go('back');

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.patient-search__modal')
      .should('not.exist');
  });

  specify('current clinician has no workspaces', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            workspaces: getRelationship([]),
          },
        });

        return fx;
      })
      .visit({ noWait: true });

    cy
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });

  specify('current clinician has no team', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            team: getRelationship({ id: NIL_UUID }, 'teams'),
          },
        });

        return fx;
      })
      .visit({ noWait: true });

    cy
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });

  // Server should return 403, but for good measure
  specify('current clinician is not enabled', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          attributes: {
            enabled: false,
          },
        });

        return fx;
      })
      .visit({ noWait: true });

    cy
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');

    cy
      .get('.prelogin')
      .click('right');

    cy
      .get('.prelogin__message');
  });

  specify('current clinician has been disabled', function() {
    cy
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 403,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Unauthorized',
            detail: 'Access token is valid, but user is disabled',
          }),
        },
      })
      .as('routeClinicianDisabled')
      .visit({ noWait: true })
      .wait('@routeClinicianDisabled');

    cy
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });
});
