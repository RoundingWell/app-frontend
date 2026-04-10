import { getAction } from 'support/api/actions';
import { getFormResponse } from 'support/api/form-responses';
import { getForm } from 'support/api/forms';

context('Formservice', function() {
  specify('action formservice iframe makes correct api requests', function() {
    cy
      .intercept('GET', '/api/actions/1/form', {
        statusCode: 200,
        body: { data: getForm({
          attributes: {
            options: {
              is_report: true,
            },
          },
        }) },
      })
      .as('routeFormModelByAction');

    cy
      .intercept('GET', '/api/actions/1/form/definition', {
        statusCode: 200,
        body: { data: {} },
      })
      .as('routeFormDefinitionByAction');

    cy
      .intercept('GET', '/api/actions/1/form/fields', {
        statusCode: 200,
        body: { data: [] },
      })
      .as('routeActionFormFields');

    cy
      .intercept('GET', '/api/actions/1*', {
        statusCode: 200,
        body: { data: getAction() },
      })
      .as('routeAction');

    cy
      .intercept('GET', '/api/patients/**/form-responses/submitted*', {
        statusCode: 200,
        body: { data: getFormResponse() },
      })
      .as('routeLatestFormSubmission');

    cy
      .visit('/formservice/action/1', { noWait: true, isRoot: true })
      .wait('@routeFormModelByAction')
      .wait('@routeFormDefinitionByAction')
      .wait('@routeActionFormFields')
      .wait('@routeAction')
      .wait('@routeLatestFormSubmission');
  });

  specify('formservice iframe makes correct api requests', function() {
    cy
      .intercept('GET', '/api/forms/1', {
        statusCode: 200,
        body: { data: getForm() },
      })
      .as('routeFormModel');

    cy
      .intercept('GET', '/api/forms/1/definition', {
        statusCode: 200,
        body: { data: {} },
      })
      .as('routeFormDefinition');

    cy
      .intercept('GET', '/api/forms/1/fields*', {
        statusCode: 200,
        body: { data: [] },
      })
      .as('routeFormFields');

    cy
      .intercept('GET', '/api/form-responses/1', {
        statusCode: 200,
        body: { data: getFormResponse() },
      })
      .as('routeFormResponse');

    cy
      .visit('/formservice/1/1/1', { noWait: true, isRoot: true })
      .wait('@routeFormModel')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields')
      .wait('@routeFormResponse');
  });
});
