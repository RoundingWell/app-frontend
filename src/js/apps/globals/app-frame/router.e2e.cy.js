import { getErrors, getRelationship } from 'helpers/json-api';

import { getCurrentClinician } from 'support/api/clinicians';
import { roleEmployee } from 'support/api/roles';
import { getPatient } from 'support/api/patients';

context('named application routing', function() {
  let releaseResponse;
  let navigationReady;

  afterEach(function() {
    releaseResponse?.();
    releaseResponse = null;
    if (navigationReady) cy.then(() => navigationReady);
    navigationReady = null;
  });

  specify('navigation readiness waits for the selected patient page', function() {
    const patient = getPatient();
    let readyState;

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.workflow-page__loader')
      .should('not.exist');

    cy.window().then(win => {
      navigationReady = new Cypress.Promise(resolve => {
        win.navigation.addEventListener('navigatesuccess', () => {
          readyState = {
            loading: !!win.document.querySelector('.workflow-page__loader'),
            selected: win.document.querySelector('.workflow-page__tab.is-selected')?.textContent.trim(),
          };
          resolve();
        }, { once: true });
      });
    });

    cy
      .intercept('GET', '/api/patients/**/actions*', req => {
        return new Cypress.Promise(resolve => {
          releaseResponse = () => {
            req.reply({ body: { data: [], included: [] } });
            resolve();
          };
        });
      })
      .as('heldClosedActions');

    cy
      .get('.js-workflow-closed')
      .click();

    cy
      .get('.workflow-page__loader')
      .should('be.visible');

    cy.wrap(null).should(() => {
      expect(releaseResponse, 'closed-page response is held').to.be.a('function');
    });

    cy.then(() => releaseResponse());

    cy.wait('@heldClosedActions').then(() => {
      releaseResponse = null;
      return navigationReady;
    });

    cy.then(() => {
      expect(readyState, 'page state when the browser completes navigation').to.deep.equal({ loading: false, selected: 'Closed' });
    });

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Closed');

    cy.routePatientActions();

    cy
      .go('back');

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Open');

    cy
      .go('forward');

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Closed');
  });

  specify('recovery returns to the workspace and repeated selection refreshes the page', function() {
    cy
      .routesForDefault()
      .visit('/missing-page');

    cy
      .get('.error-page')
      .should('be.visible');

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Owned By"]')
      .click();

    cy.get('@routeActions.all').should('have.length', 2);

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.error-page')
      .should('not.exist');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Owned By"]')
      .click();

    cy.get('@routeActions.all').should('have.length', 3);

    cy
      .get('.worklist-list-page')
      .should('be.visible');
  });

  specify('recreates workspace-owned page state when changing workspaces', function() {
    cy
      .routesForDefault()
      .visit()
      .wait('@routeActions');

    cy
      .get('.list-search__input')
      .type('workspace search');

    cy
      .get('.list-search__container')
      .should('have.class', 'is-applied');

    cy
      .get('.list-search__input')
      .should('have.value', 'workspace search');

    cy
      .get('.app-nav__header')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .first()
      .find('.picklist__item')
      .eq(1)
      .click()
      .wait('@routeActions');

    cy
      .url()
      .should('contain', '/two/worklist/owned-by');

    cy
      .get('.list-search__input')
      .should('have.value', '');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.list-search__input')
      .should('have.value', '');
  });


  specify('rejects a restricted area entered directly in the address bar', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({ relationships: { role: getRelationship(roleEmployee) } });
        return fx;
      })
      .routePrograms()
      .visit('/programs');

    cy
      .get('.error-page')
      .should('be.visible')
      .and('contain', 'This page doesn\'t exist.');

    cy
      .location('pathname')
      .should('equal', '/404');
  });


  specify('preserves startup recovery for a workspace permission failure', function() {
    cy
      .routeActions()
      .intercept('GET', '/api/states', {
        statusCode: 403,
        body: { errors: getErrors({ status: '403', title: 'Forbidden' }) },
      })
      .as('restrictedWorkspace')
      .visit({ noWait: true })
      .wait('@restrictedWorkspace');

    cy
      .get('.account-setup')
      .should('be.visible')
      .and('contain', 'Your account is not set up yet.');
  });

});
