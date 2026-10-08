import { getAction } from 'support/api/actions';
import { getFormFields } from 'support/api/form-fields';
import { getFormResponse } from 'support/api/form-responses';
import { getForm } from 'support/api/forms';

import fxFormDefinition from 'fixtures/test/form-definition';

function syncIframeCoverage() {
  cy
    .get('iframe')
    .its('0.contentWindow.__coverage__')
    .should('exist')
    .then(iframeCoverage => {
      cy.task('combineCoverage', JSON.stringify(iframeCoverage), { log: false });
    });
}

function assertPdfPayload({ formData, responseData, formSubmission, options, definition }) {
  const valueKeys = ['formData', 'responseData', 'formSubmission', 'options'];
  if (definition) valueKeys.push('definition');

  cy
    .window()
    .its('pdfMessages')
    .should('have.length', 1)
    .its('0.args.value')
    .should(value => {
      expect(value).to.have.all.keys(valueKeys);
      expect(value.formData).to.deep.include(formData);
      expect(value.responseData).to.deep.equal(responseData);
      expect(value.formSubmission).to.deep.equal(formSubmission);
      expect(value.options).to.deep.equal(options);
      if (definition) expect(value.definition).to.deep.equal(definition);
    });
}

context('Formservice', function() {
  beforeEach(function() {
    this.form = getForm({ attributes: { options: { is_report: true } } });
    this.formFields = getFormFields({ attributes: {
      patient: { first_name: 'PDF patient', last_name: 'Example' },
      fields: { weight: 175 },
    } });
    this.submission = { familyHistory: 'Submitted PDF response', submit: true };
    this.responseData = { metadata: { timezone: 'Etc/UTC' }, state: 'submitted' };
    this.response = getFormResponse({ attributes: {
      response: { ...this.responseData, data: this.submission },
    } });
    this.definition = fxFormDefinition;
  });

  afterEach(function() {
    syncIframeCoverage();
  });

  specify('action formservice makes correct api requests', function() {
    cy
      .intercept('GET', '/api/actions/1/form', {
        statusCode: 200,
        body: { data: this.form },
      })
      .as('routeFormModelByAction');

    cy
      .intercept('GET', '/api/actions/1/form/fields', {
        statusCode: 200,
        body: { data: this.formFields },
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
        body: { data: this.response },
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

    assertPdfPayload({
      formData: { id: this.formFields.id, ...this.formFields.attributes },
      responseData: this.responseData,
      formSubmission: this.submission,
      options: this.form.attributes.options,
    });
  });

  specify('action formservice fetches submitted responses by action tag', function() {
    this.form.attributes.options.prefill_action_tag = 'foo-tag';

    const testAction = getAction({
      attributes: {
        tags: ['prefill-latest-response'],
      },
    });

    cy
      .intercept('GET', '/api/actions/1/form', {
        statusCode: 200,
        body: { data: this.form },
      })
      .as('routeFormModelByAction');

    cy
      .intercept('GET', '/api/actions/1/form/fields', {
        statusCode: 200,
        body: { data: this.formFields },
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
        body: { data: this.response },
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

    assertPdfPayload({
      formData: { id: this.formFields.id, ...this.formFields.attributes },
      responseData: this.responseData,
      formSubmission: this.submission,
      options: this.form.attributes.options,
    });
  });

  specify('action formservice adds form definition for formio', function() {
    cy
      .intercept('GET', '/api/actions/1/form', {
        statusCode: 200,
        body: { data: this.form },
      })
      .as('routeFormModelByAction');

    cy
      .intercept('GET', '/api/actions/1/form/definition', {
        statusCode: 200,
        body: this.definition,
      })
      .as('routeFormDefinitionByAction');

    cy
      .intercept('GET', '/api/actions/1/form/fields', {
        statusCode: 200,
        body: { data: this.formFields },
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
        body: { data: this.response },
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

    assertPdfPayload({
      formData: { id: this.formFields.id, ...this.formFields.attributes },
      responseData: this.responseData,
      formSubmission: this.submission,
      options: this.form.attributes.options,
      definition: this.definition,
    });
  });

  specify('formservice adds form definition for formio', function() {
    this.form = getForm();

    cy
      .intercept('GET', '/api/forms/1', {
        statusCode: 200,
        body: { data: this.form },
      })
      .as('routeFormModel');

    cy
      .intercept('GET', '/api/forms/1/definition', {
        statusCode: 200,
        body: this.definition,
      })
      .as('routeFormDefinition');

    cy
      .intercept('GET', '/api/forms/1/fields*', {
        statusCode: 200,
        body: { data: this.formFields },
      })
      .as('routeFormFields');

    cy
      .intercept('GET', '/api/form-responses/1', {
        statusCode: 200,
        body: { data: this.response },
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

    assertPdfPayload({
      formData: { id: this.formFields.id, ...this.formFields.attributes },
      responseData: this.responseData,
      formSubmission: this.submission,
      options: this.form.attributes.options,
      definition: this.definition,
    });
  });
});
