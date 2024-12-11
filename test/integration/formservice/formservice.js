import { testTs } from 'helpers/test-timestamp';
import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getForm } from 'support/api/forms';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';

context('Formservice', function() {
  specify('display form with a response', function() {
    cy
      .visit('/formapp/pdf/1/1/1', { noWait: true, isRoot: true });

    cy
      .get('iframe')
      .should('have.attr', 'src', '/formservice/1/1/1');

    cy
      .window()
      .then(win => {
        win.postMessage({ message: 'form:pdf', args: {
          definition: {
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
          },
          formData: {
            fields: {
              insurance: {
                name: 'Show the form submission',
              },
            },
          },
          formSubmission: {
            fields: {
              insurance: {
                name: 'Test Insurance Name',
              },
            },
          },
          contextScripts: {},
          reducers: [],
        } }, win.origin);
      });

    cy
      .get('[name="data[fields.insurance][name]"]')
      .should('have.value', 'Test Insurance Name');
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

  specify('display action form with a response', function() {
    cy
      .visit('/formapp/pdf/action/1', { noWait: true, isRoot: true });

    cy
      .get('iframe')
      .should('have.attr', 'src', '/formservice/action/1');

    cy
      .window()
      .then(win => {
        win.postMessage({ message: 'form:pdf', args: {
          definition: {
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
          },
          formData: {
            fields: {
              insurance: {
                name: 'Use form submission',
              },
            },
          },
          formSubmission: {
            fields: {
              insurance: {
                name: 'Test Insurance Name',
              },
            },
          },
          contextScripts: {},
          reducers: [],
        } }, win.origin);
      });

    cy
      .get('[name="data[fields.insurance][name]"]')
      .should('have.value', 'Test Insurance Name');
  });

  specify('action formservice latest response from action tags', function() {
    const createdAt = testTs();

    const testFlow = getFlow();
    const testPatient = getPatient();

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
      .visit(`/formapp/pdf/action/${ testAction.id }`, { noWait: true, isRoot: true });

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
        body: { data: {} },
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
        body: { data: {} },
      })
      .as('routeActionFormFields');

    cy
      .intercept('GET', '/api/actions/1*', {
        statusCode: 200,
        body: { data: {} },
      })
      .as('routeAction');

    cy
      .intercept('GET', '/api/patients/**/form-responses/submitted*', {
        statusCode: 204,
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
