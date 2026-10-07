import { getErrors, getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';
import { getPatient } from 'support/api/patients';

const testPatient = getPatient();

context('Patient Form Errors', function() {
  beforeEach(function() {
    cy
      .clearFormDrafts()
      .routeWorkspacePatient()
      .routesForDefault();
  });

  specify('standalone form load failures', function() {
    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeLatestFormResponse()
      .intercept('GET', `/api/forms/${ testForm.id }*`, {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find form',
          }),
        },
      })
      .as('routeGoneForm')
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routeGoneForm')
      .wait('@routePatient')
      .wait('@routeLatestFormResponse');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Form you requested does not exist.');

    cy
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');

    const errorStub = cy.stub().as('readinessError');

    cy.on('uncaught:exception', error => {
      if (!error.message.includes('Error Status: 422')) return;

      errorStub(error);
      return false;
    });

    cy
      .routeForm()
      .intercept('GET', '/api/clinicians/me/form-responses/latest*', {
        statusCode: 422,
        body: { errors: getErrors({ status: '422', detail: 'Cannot load form responses' }) },
      })
      .as('routeResponseError')
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routeResponseError');

    cy
      .get('@readinessError')
      .should('have.been.calledOnce');

    cy
      .get('.app-nav')
      .contains('Owned By')
      .click();

    cy
      .get('.list-page')
      .should('be.visible');
  });

  specify('action form cannot load', function() {
    const testAction = getAction({
      relationships: { form: getRelationship(testForm) },
    });
    const errors = getErrors({
      status: '404',
      title: 'Not Found',
      detail: 'Cannot find form',
    });

    cy
      .routeActionActivity()
      .routeActionComments()
      .routeActionFiles()
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routePatient()
      .routeLatestFormResponse()
      .intercept('GET', '/api/actions/*/form', {
        statusCode: 404,
        body: { errors },
      })
      .as('routeFormByActionError')
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeFormByActionError');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .wait('@routeAction');

    cy
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');

    cy
      .routeFormByAction()
      .intercept({ method: 'GET', pathname: '/api/actions/*', query: { include: '*form-responses*' } }, {
        statusCode: 410,
        body: { errors: getErrors({ status: '410', detail: 'Action no longer exists' }) },
      })
      .as('routeGoneAction')
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeGoneAction');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .intercept('GET', '/api/actions/*/form', {
        statusCode: 422,
        body: { errors: getErrors({ status: '422', detail: 'Cannot load form' }) },
      })
      .as('routeFormError')
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`, {
        onBeforeLoad(win) {
          cy.spy(win.console, 'error').as('formError');
        },
      })
      .wait('@routeFormError');

    cy
      .get('@formError')
      .should('have.been.calledWithMatch', { response: { status: 422 } });

    cy
      .get('.app-nav')
      .contains('Owned By')
      .click()
      .wait('@routeActions');

    cy
      .get('.list-page')
      .should('be.visible');
  });
});
