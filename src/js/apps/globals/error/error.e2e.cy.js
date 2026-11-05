import { getErrors, getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getPatient } from 'support/api/patients';

context('Global Error Page', function() {
  beforeEach(function() {
    cy.routesForDefault();
  });

  specify('404 not found', function() {
    cy
      .visit('/route-does-not-exist');

    cy
      .get('.error-page')
      .should('contain', 'This page doesn\'t exist.')
      .and('contain', 'Please check the URL.');

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist');
  });

  specify('404 not found - root routes', function() {
    cy
      .visit('/route-does-not-exist', { isRoot: true });

    cy
      .get('.error-page')
      .should('contain', 'This page doesn\'t exist.')
      .and('contain', 'Please check the URL.');

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist');
  });

  specify('401 token error keeps the current workspace route', function() {
    cy
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 401,
        body: {
          errors: getErrors({
            status: '401',
            code: '4400',
            title: 'Unauthorized',
            detail: 'Access token is required',
          }),
        },
      })
      .as('routeCurrentClinician')
      .visit({ noWait: true });

    cy
      .wait('@routeCurrentClinician');

    cy
      .url()
      .should('contain', '/one/');
  });

  specify('non-json bootstrap error shows startup recovery', function() {
    cy
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 403,
        body: '<html><body>403 Forbidden</body></html>',
      })
      .as('routeCurrentClinician')
      .visit({ noWait: true })
      .wait('@routeCurrentClinician');

    cy
      .get('.startup__error')
      .should('be.visible')
      .and('contain', 'We couldn\'t load your workspace')
      .find('.js-retry')
      .should('be.visible')
      .and('not.be.disabled');
  });

  specify('workspace error', function() {
    cy.on('uncaught:exception', () => {
      return false;
    });

    cy
      .intercept('GET', '/api/states', {
        statusCode: 500,
        body: {},
      })
      .as('routeStates')
      .visit({ noWait: true })
      .wait('@routeStates');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');
  });

  specify('recovers from a workspace error and still reports a later patient startup failure', function() {
    const errorStub = cy.stub();
    const patient = getPatient();
    const action = getAction({ relationships: { patient: getRelationship(patient) } });

    cy.on('uncaught:exception', error => {
      errorStub(error);

      return false;
    });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routeActions(fx => {
        fx.data = [action];
        fx.included = [patient];

        return fx;
      })
      .intercept('GET', '/api/workspaces/**/clinicians*', {
        statusCode: 500,
        body: {},
      })
      .as('routeWorkspaceClinicians')
      .visit();

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');

    cy
      .routeStates()
      .routeWorkspaceClinicians();

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .get('.error-page')
      .should('not.exist')
      .then(() => {
        expect(errorStub).to.be.calledOnce;
      });

    cy
      .get('.worklist-list-page')
      .should('be.visible');

    cy
      .get('.js-patient')
      .first()
      .click()
      .wait('@routePatient');

    cy
      .intercept('GET', '/api/patients/*?*', {
        statusCode: 422,
        body: { errors: getErrors({ status: '422', title: 'Patient unavailable' }) },
      })
      .as('failedPatientStartup');

    cy
      .get('.patient-sidebar__name')
      .click()
      .wait('@failedPatientStartup');

    cy.wrap(errorStub).should('have.callCount', 2);

    cy.then(() => {
      expect(errorStub.lastCall.args[0].message).to.contain('Error Status: 422');
    });

    cy
      .get('.patient__context-trail')
      .should('not.exist');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Owned By"]')
      .click()
      .wait('@routeActions');

    cy
      .get('.worklist-list-page')
      .should('be.visible');
  });
});
