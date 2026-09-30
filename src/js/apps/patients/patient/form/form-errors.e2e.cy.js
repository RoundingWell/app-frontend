import { getErrors, getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';
import { getPatient } from 'support/api/patients';
import { stateTodo } from 'support/api/states';

const testPatient = getPatient();

context('Patient Form Errors', function() {
  beforeEach(function() {
    cy
      .clearFormDrafts()
      .routeWorkspacePatient()
      .routesForDefault();
  });

  specify('deleted standalone form', function() {
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
  });

  specify('keeps the action visible when its form returns an unexpected error', function() {
    const patient = getPatient();
    const action = getAction({ relationships: {
      patient: getRelationship(patient), form: getRelationship(testForm), state: getRelationship(stateTodo),
    } });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routeAction(fx => {
        fx.data = action;

        return fx;
      })
      .routeLatestFormResponse()
      .intercept('GET', '/api/actions/*/form', { statusCode: 400, body: { errors: [] } })
      .as('failedForm')
      .visit(`/patient/${ patient.id }/action/${ action.id }`)
      .wait('@failedForm');

    cy
      .get('.patient-action')
      .should('contain', action.attributes.name);

    cy
      .get('[data-form-viewport-iframe]')
      .should('not.exist');
  });
});
