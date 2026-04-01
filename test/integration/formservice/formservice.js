import { testTs } from 'helpers/test-timestamp';
import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getFormFields } from 'support/api/form-fields';
import { getFormResponse } from 'support/api/form-responses';
import { getForm, testForm } from 'support/api/forms';

const testPatient = getPatient();

context('Formservice', function() {
  specify('display form with a response', function() {
    const testFormResponse = getFormResponse({
      attributes: {
        response: {
          data: {
            fields: {
              insurance: {
                name: 'Test Insurance Name',
              },
            },
          },
        },
      },
    });

    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition(fx => {
        return {
          display: 'form',
          components: [
            {
              key: 'fields.insurance',
              type: 'container',
              input: true,
              label: 'Insurance',
              tableView: false,
              components: [
                {
                  key: 'name',
                  type: 'textfield',
                  input: true,
                  label: 'Insurance Name',
                  tableView: true,
                },
              ],
            },
          ],
        };
      })
      .routeFormFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              insurance: {
                name: 'Show the form submission',
              },
            },
          },
        });

        return fx;
      })
      .routeFormResponse(() => {
        return {
          data: testFormResponse,
        };
      });

    cy
      .visit(`/formapp/index.html?pdf=1&formId=${ testForm.id }&patientId=${ testPatient.id }&responseId=${ testFormResponse.id }`, { noWait: true, isRoot: true })
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields')
      .wait('@routeFormResponse');

    cy
      .get('[name="data[fields.insurance][name]"]')
      .should('have.value', 'Show the form submission');
  });

  specify('formservice iframe makes correct api requests', function() {
    cy
      .intercept('GET', '/api/forms/1', {
        statusCode: 200,
        body: {},
      })
      .as('routeFormModel');

    cy
      .intercept('GET', '/api/forms/1/definition', {
        statusCode: 200,
        body: {},
      })
      .as('routeFormDefinition');

    cy
      .intercept('GET', '/api/forms/1/fields?filter[patient]=1', {
        statusCode: 200,
        body: { data: {} },
      })
      .as('routeFormPatientFields');

    cy
      .intercept('GET', '/api/form-responses/1', {
        statusCode: 200,
        body: {},
      })
      .as('routeFormResponse');

    cy
      .visit('/formservice/1/1/1', { noWait: true, isRoot: true })
      .wait('@routeFormModel')
      .wait('@routeFormDefinition')
      .wait('@routeFormPatientFields')
      .wait('@routeFormResponse');
  });

  specify('action formservice latest response from action tags', function() {
    const createdAt = testTs();

    const testFlow = getFlow();

    const testReportForm = getForm({
      attributes: {
        options: {
          is_report: true,
          prefill_action_tag: 'foo-tag',
        },
      },
    });

    const testAction = getAction({
      attributes: {
        created_at: createdAt,
        tags: ['prefill-latest-response'],
      },
      relationships: {
        'form': getRelationship(testReportForm),
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routeFormByAction(fx => {
        fx.data = testReportForm;

        return fx;
      })
      .routeFormActionDefinition()
      .routeLatestFormResponse()
      .routeFormActionFields()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeLatestFormSubmission()
      .visit(`/formapp/index.html?pdf=1&actionId=${ testAction.id }`, { noWait: true, isRoot: true });

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[action_tags]=foo-tag')
      .should('contain', `filter[flows]=${ testFlow.id }`)
      .should('contain', `filter[submitted_at]=<=${ createdAt }`);
  });

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

  specify('action non-report formservice iframe makes correct api requests', function() {
    cy
      .intercept('GET', '/api/actions/1/form', {
        statusCode: 200,
        body: { data: getForm({
          attributes: {
            options: {
              is_report: false,
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
});
