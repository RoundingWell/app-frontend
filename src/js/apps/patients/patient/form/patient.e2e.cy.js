import dayjs from 'dayjs';

import formatDate from 'helpers/format-date';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { getErrors, mergeJsonApi } from 'helpers/json-api';

import { getFormFields } from 'support/api/form-fields';
import { getFormResponse } from 'support/api/form-responses';
import { getPatient } from 'support/api/patients';
import { getWidget } from 'support/api/widgets';
import { getForm, testForm } from 'support/api/forms';
import { getCurrentClinician } from 'support/api/clinicians';

import { FORM_RESPONSE_STATUS } from 'js/static';

const testPatient = getPatient();
const currentClinician = getCurrentClinician();

const testReadOnlyForm = getForm({
  attributes: {
    options: {
      read_only: true,
    },
  },
});

context('Patient Form', function() {
  beforeEach(function() {
    cy
      .clearFormDrafts()
      .routeWorkspacePatient();
  });

  specify('submitting the form', function() {
    const testNewFormResponse = getFormResponse();

    cy
      .routesForPatientAction()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              weight: 200,
            },
            patient: {
              first_name: 'Joe',
              last_name: 'Johnson',
            },
          },
        });

        return fx;
      })
      .routeLatestFormResponse()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormFields');

    cy
      .get('iframe')
      .should('have.attr', 'src', '/forms/formio/index.html');

    cy
      .get('.patient__sidebar')
      .should('exist');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'Here is some typing',
          storyTime: 'Once upon a time...',
        });
      });

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        delay: 100,
        body: { data: testNewFormResponse },
      })
      .as('routePostResponse');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .click();

    cy
      .routeFormResponse()
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.action).to.be.undefined;
        expect(data.relationships.form.data.id).to.equal(testForm.id);
        expect(data.attributes.response.data.storyTime).to.equal('Once upon a time...');
        expect(data.attributes.response.data.patient.first_name).to.equal('Joe');
        expect(data.attributes.response.data.patient.last_name).to.equal('Johnson');
        expect(data.attributes.response.data.fields.weight).to.equal(200);
      });

    cy
      .get('iframe')
      .should('have.attr', 'src', `/forms/formio/index.html?responseId=${ testNewFormResponse.id }`);

    cy
      .wait('@routeFormResponse');

    cy
      .get('.patient__context-trail')
      .find('.js-patient')
      .click();

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`);

    cy
      .go('back');
  });

  specify('storing stored submission', function() {
    const draftKey = `form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }`;

    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeLatestFormResponse()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ testPatient.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        body: { data: getFormResponse() },
      })
      .as('routePostResponse');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', { fields: { foo: 'bar' } });
      });

    cy
      .waitForFormDraft(draftKey, { exists: true })
      .should(draft => {
        expect(draft, 'draft storage').to.exist;
        expect(draft.submission.fields.foo).to.equal('bar');
      });

    cy
      .get('.form__controls')
      .find('.js-expand-button')
      .should('exist');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-shield-check)')
      .as('draftStatusButton')
      .trigger('pointerover');

    // visitOnClock installs fake timers — tick past the tooltip's setTimeout(0) delay
    cy.tick(1);

    cy
      .get('.tooltip')
      .should('contain', 'See draft status');

    cy
      .get('@draftStatusButton')
      .click();

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('@draftStatusButton')
      .trigger('pointerover');

    // visitOnClock installs fake timers — tick past the tooltip's setTimeout(0) delay
    cy.tick(1);

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .tick(15000);

    cy
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.status).to.equal(FORM_RESPONSE_STATUS.DRAFT);
      });

    cy
      .tick(45000);

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a minute ago');

    cy
      .get('body')
      .type('{esc}');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', { fields: { foo: 'baz' } });
      });

    cy
      .get('@draftStatusButton')
      .click();

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');
  });

  specify('restoring draft', function() {
    cy.setFormDraft(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }`, {
      updated: testTsSubtract(1),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse(() => {
        return {
          data: getFormResponse({
            attributes: {
              status: FORM_RESPONSE_STATUS.DRAFT,
              updated_at: testTs(),
              response: {
                data: {
                  fields: { foo: 'bar' },
                },
              },
            },
          }),
        };
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ testPatient.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeForm')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-shield-check)')
      .click();

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response.args.value.storedSubmission.fields.foo).to.equal('bar');
      });
  });

  specify('restoring stored submission', function() {
    cy.setFormDraft(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }`, {
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse(() => {
        return {
          data: getFormResponse({
            attributes: {
              status: FORM_RESPONSE_STATUS.DRAFT,
              updated_at: testTsSubtract(1),
              response: {
                data: {
                  fields: { foo: 'bar' },
                },
              },
            },
          }),
        };
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ testPatient.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeForm')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-shield-check)')
      .click();

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response.args.value.storedSubmission.fields.foo).to.equal('foo');
      });
  });

  specify('discarding stored submission', function() {
    const draftKey = `form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }`;

    cy.setFormDraft(draftKey, {
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFormFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              foo: 'bar',
            },
          },
        });

        return fx;
      })
      .routeLatestFormResponse()
      .visitOnClock(`/patient/${ testPatient.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeForm')
      .wait('@routePatient');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-shield-check)')
      .click();

    cy
      .get('.form__draft-menu-saved')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('.form__draft-menu')
      .find('.js-discard')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeFormDefinition')
      .wait('@routeFormFields');

    cy
      .get('.form__controls')
      .find('[data-draft-status-region]')
      .should('be.empty');

    cy
      .waitForFormDraft(draftKey, { exists: false })
      .should(draft => {
        expect(draft).to.be.null;
      });

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response.args.value.formData.fields.foo).to.equal('bar');
      });
  });

  specify('read only form', function() {
    cy.setFormDraft(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testReadOnlyForm.id }`, {
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testReadOnlyForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              foo: 'bar',
            },
          },
        });

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/form/${ testReadOnlyForm.id }`)
      .wait('@routeForm')
      .wait('@routePatient')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields');

    cy
      .get('[data-draft-status-region]')
      .should('be.empty');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Read Only')
      .should('be.disabled');

    cy
      .get('.form-widgets')
      .should('not.exist');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response.args.value.formData.fields.foo).to.equal('bar');
      });
  });

  specify('form header widgets', function() {
    const dob = testDateSubtract(10, 'years');

    const testWidgetsForm = getForm({
      attributes: {
        options: {
          widgets: {
            fields: [],
            widgets: ['dob', 'sex', 'status', 'hbsWidget'],
          },
        },
      },
    });

    cy
      .routeForm(fx => {
        fx.data = testWidgetsForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeWidgetValues(fx => {
        fx.values = { sex: 'f' };
        return fx;
      })
      .routeLatestFormResponse()
      .routeWidgets(fx => {
        fx.data.push(getWidget({
          attributes: {
            category: 'widget',
            slug: 'hbsWidget',
            definition: {
              display_name: 'Template',
              template: `
                <hr>
                <div>{{far "calendar-days"}}Sex: <b>{{ sex }}</b></div>
                <hr>
              `,
            },
            values: {
              sex: '@patient.sex',
            },
          },
        }));

        return fx;
      })
      .routePatient(fx => {
        fx.data = mergeJsonApi(testPatient, {
          attributes: {
            first_name: 'First',
            last_name: 'Last',
            birth_date: dob,
            sex: 'f',
          },
        });

        return fx;
      })
      .routeWorkspacePatient(fx => {
        fx.data.attributes.status = 'active';
        return fx;
      });

    cy
      .visitOnClock(`/patient/${ testPatient.id }/form/${ testWidgetsForm.id }`, { now: testTs() })
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields')
      .wait('@routeWidgets')
      .wait('@routePatient')
      .wait('@routeWorkspacePatient');

    cy
      .get('.form-widgets')
      .find('.form-widgets__section')
      .first()
      .should('contain', formatDate(dob, 'LONG'))
      .should('contain', `Age ${ dayjs(testDate()).diff(dob, 'years') }`)
      .next()
      .should('contain', 'Sex')
      .should('contain', 'Female')
      .next()
      .should('contain', 'Status')
      .should('contain', 'Active')
      .next()
      .should('contain', 'Template')
      .should('contain', 'Sex: f');
  });

  specify('submit and go back button', function() {
    localStorage.setItem(`form-state_${ currentClinician.id }`, JSON.stringify({ saveButtonType: 'saveAndGoBack' }));

    cy
      .routesForPatientDashboard()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              weight: 200,
            },
            patient: {
              first_name: 'Joe',
              last_name: 'Johnson',
            },
          },
        });

        return fx;
      })
      .routeLatestFormResponse()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ testPatient.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeForm')
      .wait('@routePatient')
      .wait('@routeFormDefinition')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormFields');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'Here is some typing',
          storyTime: 'Once upon a time...',
        });
      });

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        delay: 100,
        body: { data: getFormResponse() },
      })
      .as('routePostResponse');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('not.be.disabled')
      .should('contain', 'Submit + Go Back');

    cy
      .get('.form__controls')
      .find('.button__drop-list-select')
      .should('not.be.disabled')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .first()
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`form-state_${ currentClinician.id }`));

        expect(storage.saveButtonType).to.equal('save');
      });

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit')
      .should('not.contain', 'Go Back');

    cy
      .get('.form__controls')
      .find('.button__drop-list-select')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .eq(1)
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`form-state_${ currentClinician.id }`));

        expect(storage.saveButtonType).to.equal('saveAndGoBack');
      });

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .click();

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('be.disabled');

    cy
      .get('.form__controls')
      .find('.button__drop-list-select')
      .should('be.disabled');

    cy
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.action).to.be.undefined;
        expect(data.relationships.form.data.id).to.equal(testForm.id);
        expect(data.attributes.response.data.storyTime).to.equal('Once upon a time...');
        expect(data.attributes.response.data.patient.first_name).to.equal('Joe');
        expect(data.attributes.response.data.patient.last_name).to.equal('Johnson');
        expect(data.attributes.response.data.fields.weight).to.equal(200);
      });

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient.id }/workflow`);
  });

  specify('submit and go back button - form response error', function() {
    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeLatestFormResponse()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields')
      .wait('@routeWorkspacePatient')
      .wait('@routePatient');

    const errors = getErrors({
      status: '403',
      title: 'Forbidden',
      detail: 'Insufficient permissions',
    });

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 403,
        delay: 100,
        body: { errors },
      })
      .as('postFormResponse');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'New typing',
          storyTime: 'New typing',
        });
      });

    cy
      .get('.form__controls')
      .find('.button__drop-list-select')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .eq(1)
      .click();

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .click()
      .wait('@postFormResponse');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formErrors = receivedMessages.find(m => m.message === 'form:errors');

        expect(formErrors.args.error[0]).to.equal('Insufficient permissions');
      });
  });

  specify('form error', function() {
    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeLatestFormResponse()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields')
      .wait('@routePatient');

    const errors = getErrors({
      status: '403',
      title: 'Forbidden',
      detail: 'Insufficient permissions',
    });

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 403,
        delay: 100,
        body: { errors },
      })
      .as('postFormResponse');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'New typing',
          storyTime: 'New typing',
        });
      });

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .click()
      .wait('@postFormResponse');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formErrors = receivedMessages.find(m => m.message === 'form:errors');

        expect(formErrors.args.error[0]).to.equal('Insufficient permissions');
      });
  });

  specify('hidden submit button', function() {
    const testSubmitHiddenForm = getForm({
      attributes: {
        options: {
          submit_hidden: true,
        },
      },
    });

    cy
      .routeForm(fx => {
        fx.data = testSubmitHiddenForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormFields()
      .routeLatestFormResponse()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/form/${ testSubmitHiddenForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormDefinition')
      .wait('@routeFormFields');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const definition = receivedMessages.find(m => m.message === 'fetch:form:definition');

        expect(definition.args.value.components[0].components.find(c => c.key === 'familyHistory'), 'familyHistory component').to.exist;
      });

    cy
      .get('.form__controls')
      .should('not.contain', 'Submit');
  });
});
