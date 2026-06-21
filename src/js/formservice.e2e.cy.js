import { getAction } from 'support/api/actions';
import { getFormResponse } from 'support/api/form-responses';
import { getForm } from 'support/api/forms';

function syncIframeCoverage() {
  cy
    .get('iframe')
    .its('0.contentWindow.__coverage__')
    .should('exist')
    .then(iframeCoverage => {
      cy.task('combineCoverage', JSON.stringify(iframeCoverage), { log: false });
    });
}

context('Formservice', function() {
  afterEach(function() {
    syncIframeCoverage();
  });

  specify('action formservice makes correct api requests', function() {
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
      .intercept('GET', '/forms/custom/pdf.html*', { fixture: 'formservice-parent.html' });

    cy
      .visit('/forms/custom/pdf.html?serviceUrl=%2Fformservice%2Faction%2F1', { noWait: true, isRoot: true });

    cy
      .wait('@routeFormModelByAction')
      .wait('@routeActionFormFields')
      .wait('@routeAction')
      .wait('@routeLatestFormSubmission');
  });

  specify('action formservice fetches submitted responses by action tag', function() {
    const testAction = getAction({
      attributes: {
        tags: ['prefill-latest-response'],
      },
    });

    cy
      .intercept('GET', '/api/actions/1/form', {
        statusCode: 200,
        body: { data: getForm({
          attributes: {
            options: {
              is_report: true,
              prefill_action_tag: 'foo-tag',
            },
          },
        }) },
      })
      .as('routeFormModelByAction');

    cy
      .intercept('GET', '/api/actions/1/form/fields', {
        statusCode: 200,
        body: { data: [] },
      })
      .as('routeActionFormFields');

    cy
      .intercept('GET', '/api/actions/1*', {
        statusCode: 200,
        body: { data: testAction },
      })
      .as('routeAction');

    cy
      .intercept('GET', '/api/patients/**/form-responses/submitted*', {
        statusCode: 200,
        body: { data: getFormResponse() },
      })
      .as('routeLatestFormSubmission');

    cy
      .intercept('GET', '/forms/custom/pdf.html*', { fixture: 'formservice-parent.html' });

    cy
      .visit('/forms/custom/pdf.html?serviceUrl=%2Fformservice%2Faction%2F1', { noWait: true, isRoot: true });

    cy
      .wait('@routeFormModelByAction')
      .wait('@routeActionFormFields')
      .wait('@routeAction');

    cy
      .wait('@routeLatestFormSubmission')
      .its('request.url')
      .should('include', 'filter[action_tags]=foo-tag')
      .and('not.include', 'filter[actions]=');
  });

  specify('action formservice adds form definition for formio', function() {
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
      .intercept('GET', '/forms/formio/pdf.html*', { fixture: 'formservice-parent.html' });

    cy
      .visit('/forms/formio/pdf.html?serviceUrl=%2Fformservice%2Faction%2F1', { noWait: true, isRoot: true });

    cy
      .wait('@routeFormModelByAction')
      .wait('@routeFormDefinitionByAction')
      .wait('@routeActionFormFields')
      .wait('@routeAction')
      .wait('@routeLatestFormSubmission');
  });

  specify('formservice adds form definition for formio', function() {
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
      .intercept('GET', '/forms/formio/pdf.html*', { fixture: 'formservice-parent.html' });

    cy
      .visit('/forms/formio/pdf.html?serviceUrl=%2Fformservice%2F1%2F1%2F1', { noWait: true, isRoot: true });

    cy
      .wait('@routeFormModel')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields')
      .wait('@routeFormResponse');
  });
});
