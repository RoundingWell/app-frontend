import dayjs from 'dayjs';
import { v7 as uuid } from 'uuid';

import formatDate from 'helpers/format-date';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { getRelationship, getErrors } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getCurrentClinician, getClinician } from 'support/api/clinicians';
import { getFile } from 'support/api/files';
import { getFormFields } from 'support/api/form-fields';
import { getFormResponse } from 'support/api/form-responses';
import { getPatient } from 'support/api/patients';
import { getForm, testForm } from 'support/api/forms';
import { getFlow } from 'support/api/flows';
import { getWorkspacePatient } from 'support/api/workspace-patients';

import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { stateTodo, stateInProgress } from 'support/api/states';
import { teamCoordinator, teamNurse } from 'support/api/teams';

import { FORM_RESPONSE_STATUS } from 'js/static';

context('Patient Action Form', function() {
  beforeEach(function() {
    cy
      .clearFormDrafts()
      .routeWorkspacePatient()
      .routeActionActivity()
      .routeActionComments()
      .routeActionFiles()
      .routesForDefault();
  });

  const currentClinician = getCurrentClinician();
  const routePatientId = 'patient-id';

  const testReadOnlyForm = getForm({
    attributes: {
      options: {
        read_only: true,
      },
    },
  });

  const testSubmitHiddenForm = getForm({
    attributes: {
      options: {
        submit_hidden: true,
      },
    },
  });

  specify('deleted action', function() {
    const deletedActionId = uuid();

    const errors = getErrors({
      status: '410',
      title: 'Not Found',
      detail: 'Cannot find action',
    });

    cy
      .intercept('GET', '/api/actions/*', {
        statusCode: 410,
        body: { errors },
      })
      .as('routeActionError')
      .routePatient()
      .routeFormByAction()
      .routeLatestFormResponse()
      .visit(`/patient/${ routePatientId }/action/${ deletedActionId }`)
      .wait('@routePatient')
      .wait('@routeActionError');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .url()
      .should('not.contain', `/patient/${ routePatientId }/action/${ deletedActionId }`);
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
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routePatient()
      .intercept('GET', '/api/actions/*/form', {
        statusCode: 404,
        body: { errors },
      })
      .as('routeFormByActionError')
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByActionError');

    cy
      .location('pathname')
      .should('not.contain', `/action/${ testAction.id }`);

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');
  });

  specify('action deleted while its form is open', function() {
    const testPatient = getPatient();
    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([]),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .get('.js-expand-button')
      .click();

    cy.window().then(win => {
      const action = win.Radio.request('entities', 'get:store', {
        type: testAction.type,
        id: testAction.id,
      });

      action.handleMessage({
        category: 'ResourceDeleted',
        resource: {
          type: testAction.type,
          id: testAction.id,
        },
        payload: {},
      });
    });

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`);
  });

  specify('update a form', function() {
    const testFormResponse = getFormResponse();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([testFormResponse]),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormResponse(fx => {
        fx.data = testFormResponse;

        return fx;
      })
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatient()
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponse,
        };
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .get('.form__submission-status')
      .should('contain', formatDate(testFormResponse.attributes.updated_at, 'AT_TIME'));

    cy
      .get('.form__controls')
      .contains('Update')
      .click()
      .wait('@routeFormActionFields');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit');
  });

  specify('storing stored submission', function() {
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([]),
      },
    });

    const draftKey = `form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`;

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

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
      .find('.form__actions-icon:has(.fa-cloud-check)')
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
        expect(data.attributes.status).to.equal('draft');
      });

    cy
      .tick(45000);

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a minute ago');

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

  specify('restoring stored submission', function() {
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
      },
    });

    cy.setFormDraft(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`, {
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
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
      .routeFormDefinition()
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-cloud-check)')
      .click();

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(response.args.value.storedSubmission.fields.foo).to.equal('foo');
      });
  });

  specify('restoring a draft', function() {
    const formResponse = getFormResponse({
      attributes: {
        status: FORM_RESPONSE_STATUS.DRAFT,
        updated_at: testTs(),
        response: {
          data: { fields: { foo: 'bar' } },
        },
      },
    });

    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([formResponse]),
      },
    });

    cy.setFormDraft(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`, {
      updated: testTsSubtract(1),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeLatestFormResponse(() => {
        return {
          data: formResponse,
        };
      })
      .routeFormDefinition()
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .intercept('PATCH', `/api/form-responses/${ formResponse.id }`, {
        statusCode: 201,
        body: { data: getFormResponse({ id: formResponse.id }) },
      })
      .as('routePatchResponse');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-cloud-check)')
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

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', { fields: { foo: 'baz' } });
      });

    cy
      .wait(0);

    cy
      .tick(15000);

    cy
      .wait('@routePatchResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.equal(formResponse.id);
        expect(data.type).to.equal('form-responses');
        expect(data.attributes).not.to.have.any.keys('id', 'type');
        expect(data.attributes.status).to.equal(FORM_RESPONSE_STATUS.DRAFT);
        expect(data.attributes.response.data.fields.foo).to.equal('baz');
      });
  });

  specify('discarding stored submission', function() {
    const formResponse = getFormResponse({
      attributes: {
        status: FORM_RESPONSE_STATUS.DRAFT,
        updated_at: testTsSubtract(1),
        response: {
          data: { fields: { foo: 'bazinga' } },
        },
      },
    });

    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([formResponse]),
      },
    });

    const draftKey = `form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`;

    cy.setFormDraft(draftKey, {
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: { foo: 'bar' },
          },
        });

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: formResponse,
        };
      })
      .routeFormDefinition()
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeLatestFormResponse');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        body: { data: getFormResponse() },
      })
      .as('routePostResponse');

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-cloud-check)')
      .click();

    cy
      .get('.form__draft-menu')
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
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routeFormActionFields');

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
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', { fields: { foo: 'baz' } });
      });

    cy
      .get('.form__controls')
      .find('.form__actions-icon:has(.fa-cloud-check)')
      .click();

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .tick(15000);

    cy
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.not.equal(formResponse.id);
        expect(data.attributes.status).to.equal(FORM_RESPONSE_STATUS.DRAFT);
      });
  });

  specify('prefill a form with latest submission by flow', function() {
    const testPatient = getPatient();

    const testFlow = getFlow();

    const testAction = getAction({
      attributes: {
        tags: ['prefill-flow-response'],
      },
      relationships: {
        'form': getRelationship(testForm),
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeLatestFormSubmission(fx => {
        fx.data = getFormResponse({
          attributes: {
            status: FORM_RESPONSE_STATUS.SUBMITTED,
            response: {
              data: {
                familyHistory: 'Prefilled family history',
                storyTime: 'Prefilled story time',
                fields: { foo: 'bar' },
              },
            },
          },
        });

        return fx;
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', `filter[forms]=${ testForm.id }`)
      .should('contain', `filter[flows]=${ testFlow.id }`);

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(response.args.value.formSubmission.familyHistory).to.equal('Prefilled family history');
        expect(response.args.value.formSubmission.storyTime).to.equal('Prefilled story time');
        expect(response.args.value.formSubmission.fields.foo).to.equal('bar');
      });
  });

  specify('prefill a form with latest submission from another form', function() {
    const testPatient = getPatient();

    const testFlow = getFlow();

    const testAction = getAction({
      attributes: {
        tags: ['prefill-latest-response'],
      },
      relationships: {
        'form': getRelationship(testForm),
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
      },
    });

    const testPrefillForm = getForm({
      attributes: {
        name: 'fasfasdf',
        options: {
          prefill_form_id: testForm.id,
        },
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testPrefillForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeLatestFormSubmission(fx => {
        fx.data = getFormResponse({
          attributes: {
            status: FORM_RESPONSE_STATUS.SUBMITTED,
            response: {
              data: {
                familyHistory: 'Prefilled family history',
                storyTime: 'Prefilled story time',
                fields: { foo: 'bar' },
              },
            },
          },
        });

        return fx;
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', `filter[forms]=${ testForm.id }`)
      .should('not.contain', 'filter[flows]');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(response.args.value.formSubmission.familyHistory).to.equal('Prefilled family history');
        expect(response.args.value.formSubmission.storyTime).to.equal('Prefilled story time');
        expect(response.args.value.formSubmission.fields.foo).to.equal('bar');
      });
  });

  specify('prefill a form with latest submission from action tag', function() {
    const testPatient = getPatient();

    const testFlow = getFlow();

    const testAction = getAction({
      attributes: {
        tags: ['prefill-latest-response'],
      },
      relationships: {
        'form': getRelationship(testForm),
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
      },
    });

    const testPrefillActionTagForm = getForm({
      attributes: {
        options: {
          prefill_form_id: testForm.id,
          prefill_action_tag: 'foo-tag',
          reducers: [
            'formSubmission.storyTime = responseData.flow.storyTime',
          ],
        },
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testPrefillActionTagForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeLatestFormSubmission(fx => {
        fx.data = getFormResponse({
          attributes: {
            status: FORM_RESPONSE_STATUS.SUBMITTED,
            response: {
              data: {
                familyHistory: 'Prefilled family history',
                fields: { foo: 'bar' },
              },
              flow: { storyTime: 'Prefilled response story time' },
            },
          },
        });

        return fx;
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[action_tags]=foo-tag')
      .should('not.contain', 'filter[submitted_at]')
      .should('not.contain', 'filter[flows]')
      .should('not.contain', 'filter[forms]');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(response.args.value.formSubmission.familyHistory).to.equal('Prefilled family history');
        expect(response.args.value.formSubmission.fields.foo).to.equal('bar');
        expect(response.args.value.responseData.flow.storyTime).to.equal('Prefilled response story time');
      });
  });

  specify('update a form with response field', function() {
    const testFormResponse = getFormResponse({
      attributes: {
        updated_at: testTs(),
        status: FORM_RESPONSE_STATUS.SUBMITTED,
        response: { data: { fields: { foo: 'bar' } } },
      },
    });

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([testFormResponse]),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormActionFields()
      .routeFormResponse(fx => {
        fx.data = testFormResponse;

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponse,
        };
      })
      .routeActionActivity()
      .routePatient()
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition')
      .wait('@routeFormResponse');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:response');

        expect(response.args.value.formSubmission.fields.foo).to.equal('bar');
      });

    cy
      .get('.form__controls')
      .contains('Update')
      .click()
      .wait('@routeFormActionFields');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(response.args.value.formSubmission.fields.foo).to.equal('bar');
      });
  });

  specify('submitting the form and returning to workflows', function() {
    const testUpdatedAt = testTs();

    const testPatient = getPatient({
      attributes: {
        first_name: 'Testin',
        last_name: 'Mctester',
      },
    });

    const testFormResponses = [
      getFormResponse({
        attributes: {
          updated_at: testUpdatedAt,
          status: FORM_RESPONSE_STATUS.SUBMITTED,
          response: {
            data: {
              familyHistory: 'Here is some typing',
              storyTime: 'Once upon a time...',
            },
          },
        },
      }),
      getFormResponse({
        attributes: {
          updated_at: testUpdatedAt,
          status: FORM_RESPONSE_STATUS.SUBMITTED,
          response: {
            data: {
              familyHistory: 'Here is some typing by a patient',
              storyTime: 'Once upon a time...',
            },
          },
        },
        relationships: {
          editor: getRelationship(testPatient),
        },
      }),
      getFormResponse({
        attributes: {
          updated_at: testUpdatedAt,
          status: FORM_RESPONSE_STATUS.SUBMITTED,
          response: { data: { fields: { foo: 'bar' } } },
        },
      }),
    ];

    const testAction = getAction({
      relationships: {
        'flow': getRelationship(),
        'form': getRelationship(testForm),
        'form-responses': getRelationship([...testFormResponses, getFormResponse()]),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testPatient, ...testFormResponses);

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition(fx => {
        fx.components.push(
          {
            label: 'Survey',
            tableView: false,
            questions: [
              {
                label: '',
                value: '',
                tooltip: '',
              },
            ],
            values: [
              {
                label: '',
                value: '',
                tooltip: '',
              },
            ],
            key: 'fields.survey',
            type: 'survey',
            input: true,
          });
        return fx;
      })
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              foo: 'bar',
              survey: [],
            },
          },
        });

        return fx;
      })
      .routeFormResponse(fx => {
        fx.data = testFormResponses[0];

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponses[0],
        };
      })
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormResponse');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:response');

        expect(response, 'fetch:form:response response').to.exist;
        expect(response.args.value.formSubmission.familyHistory).to.equal('Here is some typing');
        expect(response.args.value.formSubmission.storyTime).to.equal('Once upon a time...');
      });

    cy
      .get('.form__title')
      .should('contain', 'Test Form');

    cy
      .get('.patient__context-trail')
      .should('contain', 'Testin Mctester');

    cy
      .get('.form__controls')
      .as('metaRegion');

    cy
      .get('@metaRegion')
      .find('.form__submission-status')
      .should('contain', formatDate(testUpdatedAt, 'AT_TIME'))
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 3);

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .eq(1)
      .should('contain', formatDate(testUpdatedAt, 'AT_TIME'))
      .should('contain', 'By Testin Mctester');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .last()
      .should('contain', formatDate(testUpdatedAt, 'AT_TIME'))
      .should('contain', 'By Clinician McTester')
      .click();

    cy
      .get('iframe')
      .should('have.attr', 'src', `/forms/formio/index.html?responseId=${ testFormResponses[2].id }`);

    cy
      .get('@metaRegion')
      .find('.form__submission-status')
      .should('contain', formatDate(testUpdatedAt, 'AT_TIME'));

    cy
      .get('@metaRegion')
      .find('.js-current')
      .should('contain', 'Back to Current Version')
      .click();

    cy
      .get('@metaRegion')
      .find('button')
      .contains('Update')
      .click()
      .wait('@routeFormActionFields');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'New typing',
        });
      });

    const testNewFormResponse = getFormResponse();

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        delay: 100,
        body: { data: testNewFormResponse },
      })
      .as('routePostResponse');

    cy
      .get('@metaRegion')
      .find('button')
      .contains('Submit')
      .click();

    cy
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.action.data.id).to.equal(testAction.id);
        expect(data.relationships.form.data.id).to.equal(testForm.id);
        expect(data.attributes.response.data.familyHistory).to.equal('New typing');
        expect(data.attributes.response.data.storyTime).to.equal('Once upon a time...');
        expect(data.attributes.response.data.patient.first_name).to.equal('John');
        expect(data.attributes.response.data.patient.last_name).to.equal('Doe');
        expect(data.attributes.response.data.fields.foo).to.equal('bar');
        expect(data.attributes.response.data.fields.survey).to.eql([]);
        expect(data.attributes.response.fields.survey).to.eql([]);
        expect(data.attributes.response.flow).to.be.undefined;
      });

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient.id }/workflow`);
  });

  specify('action locked form', function() {
    cy.viewport(900, 720);

    const testFormResponse = getFormResponse({
      attributes: {
        updated_at: testTs(),
        status: FORM_RESPONSE_STATUS.SUBMITTED,
        response: { data: { fields: { foo: 'bar' } } },
      },
    });

    const testAction = getAction({
      attributes: {
        locked_at: testTs(),
      },
      relationships: {
        'form': getRelationship(testForm),
        'state': getRelationship(stateInProgress),
        'form-responses': getRelationship([testFormResponse]),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormResponse(fx => {
        fx.data = testFormResponse;

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponse,
        };
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeFormResponse')
      .wait('@routeFormDefinition');

    cy
      .get('.form__submission-status')
      .should('contain', formatDate(testTs(), 'LONG'));

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.')
      .then(([lockedStatus]) => {
        const controls = lockedStatus.closest('.form__controls');
        const headerControls = controls.closest('.form__header-controls');

        expect(controls.getBoundingClientRect().right).to.be.at.most(headerControls.getBoundingClientRect().right);
        expect(lockedStatus.getBoundingClientRect().right).to.be.at.most(controls.getBoundingClientRect().right);
      });

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.find(m => m.message === 'fetch:form:response');

        expect(response.args.value.formSubmission.fields.foo).to.equal('bar');
      });
  });

  specify('read only form', function() {
    const testAction = getAction({
      relationships: {
        'form': getRelationship(testReadOnlyForm),
        'form-responses': getRelationship([]),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatient()
      .routeFormByAction(fx => {
        fx.data = testReadOnlyForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeActionActivity()
      .routePatient()
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: { foo: 'bar' },
          },
        });

        return fx;
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routeFormActionFields');

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
        const response = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(response.args.value.formData.fields.foo).to.equal('bar');
      });
  });

  specify('routing to form-response', function() {
    const updatedAt = testTs();

    const testFormResponse = getFormResponse({
      attributes: {
        updated_at: updatedAt,
        status: FORM_RESPONSE_STATUS.SUBMITTED,
        response: { data: { fields: { foo: 'bar' } } },
      },
    });

    const action = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([testFormResponse]),
      },
    });

    cy
      .routeActions(fx => {
        fx.data = [action];

        return fx;
      })
      .routeAction(fx => {
        fx.data = action;

        return fx;
      })
      .routeActionActivity()
      .routePatient()
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormActionFields()
      .routeFormResponse(fx => {
        fx.data = testFormResponse;

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponse,
        };
      })
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.card-list')
      .find('.action-card, .flow-card')
      .first()
      .find('[data-form-region]')
      .click()
      .wait('@routeAction')
      .wait('@routePatient');

    cy
      .get('iframe')
      .should('have.attr', 'src', `/forms/formio/index.html?responseId=${ testFormResponse.id }`);

    cy
      .get('.form__frame')
      .should('contain', formatDate(updatedAt, 'AT_TIME'))
      .find('button')
      .contains('Update')
      .click();

    cy
      .get('iframe')
      .should('have.attr', 'src', '/forms/formio/index.html');

    cy
      .get('.js-back')
      .click();

    cy
      .url()
      .should('contain', '/worklist/owned-by');

    cy
      .go('back');
  });

  specify('routing to form', function() {
    const testFlow = getFlow();
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;
        fx.included.push(testFlow);

        return fx;
      })
      .routeActionActivity()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormResponse()
      .routeFormActionFields()
      .routePatientByFlow()
      .routeFlow()
      .routeFlowActions()
      .routeFlowActivity()
      .visit(`/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .get('iframe')
      .should('have.attr', 'src', '/forms/formio/index.html');

    cy
      .get('.patient__context-trail [aria-current="page"]')
      .should('contain', testAction.attributes.name);

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ testAction.id }`);

    cy.location('pathname').as('actionPath');

    cy
      .get('.js-expand-button')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ testAction.id }`);

    cy
      .get('.js-expand-button')
      .click();

    cy.get('@actionPath').then(actionPath => {
      cy.location('pathname').should('equal', actionPath);
    });

    cy
      .get('.patient__context-trail .js-flow')
      .click();

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/flow/${ testFlow.id }`);
  });

  specify('routing to form - action without a flow', function() {
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'patient': getRelationship(testPatient),
        'form': getRelationship(testForm),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeActionActivity()
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormResponse()
      .routeLatestFormResponse()
      .routeFormActionFields()
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routePatient');

    cy
      .get('.patient__context-trail .js-patient')
      .click();

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`);

    cy
      .go('back')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .get('.patient__context-trail [aria-current="page"]')
      .should('contain', testAction.attributes.name);

    cy
      .url()
      .should('contain', `/patient/${ routePatientId }/action/${ testAction.id }`);
  });

  specify('form header widgets', function() {
    cy.viewport(900, 720);

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

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testWidgetsForm),
        'form-responses': getRelationship([]),
      },
    });

    cy
      .routeFormByAction(fx => {
        fx.data = testWidgetsForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeActionActivity()
      .routeFormActionFields()
      .routeWidgetValues()
      .routeWidgets()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatient(fx => {
        fx.data = getPatient({
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
        fx.data = getWorkspacePatient({
          attributes: {
            status: 'active',
          },
        });

        return fx;
      });

    cy
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routePatient')
      .wait('@routeAction')
      .wait('@routeWidgets')
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
      .should('contain', 'Active');
  });

  specify('embedded form keeps action content reachable', function() {
    cy.viewport(900, 720);

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([]),
      },
    });
    const testFile = getFile();

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatient()
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionFiles(fx => {
        fx.data = [testFile];

        return fx;
      })
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routeActionFiles')
      .wait('@routeActionActivity');

    cy
      .get('[data-form-viewport-frame]')
      .should('be.visible')
      .parents('[data-form-viewport-scroll-container]')
      .should('exist');

    cy.viewport(900, 900);

    cy
      .get('[data-form-viewport-frame]')
      .should('be.visible');

    cy.window().then(win => {
      const nativeMatchMedia = win.matchMedia.bind(win);
      const pane = win.document.querySelector('[data-form-viewport-scroll-container]');

      cy.spy(pane, 'scrollTo').as('formPaneScroll');
      cy.stub(win, 'matchMedia').callsFake(query => {
        if (query === '(prefers-reduced-motion: reduce)') return { matches: true };

        return nativeMatchMedia(query);
      });
    });

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('form:interact');
      });

    cy
      .get('@formPaneScroll')
      .should('have.been.calledWithMatch', {
        behavior: 'auto',
      });

    cy
      .get('.patient-action__attachments-content')
      .scrollIntoView()
      .should('be.visible')
      .find('.patient-action__attachment')
      .should('be.visible');

    cy
      .get('.patient-action__activity')
      .scrollIntoView()
      .should('be.visible')
      .and('contain', 'Activity');

    cy
      .get('.form__frame')
      .scrollIntoView()
      .should('be.visible');
  });

  specify('action form submit preference and stay on response', function() {
    localStorage.setItem(`form-state_${ currentClinician.id }`, JSON.stringify({
      saveButtonType: 'saveAndGoBack',
    }));

    const testPatient = getPatient();
    const testFlow = getFlow();
    const testFormResponse = getFormResponse();
    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatientByFlow()
      .routeFlow()
      .routeFlowActions()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient/${ routePatientId }/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFlow')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormDefinition')
      .get('.js-expand-button')
      .click();

    cy.location('pathname').as('formPath');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        delay: 100,
        body: { data: testFormResponse },
      })
      .as('routePostResponse');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('not.be.disabled')
      .should('contain', 'Submit + Go Back');

    cy
      .get('.form__controls')
      .find('.form__submit-choice')
      .should('not.be.disabled')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Your Submit Button Preference')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .first()
      .should('contain', 'Submit Form + Go Back');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('focus');
      });

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('.form__controls')
      .find('.form__submit-choice')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .eq(1)
      .should('contain', 'Submit Form')
      .click()
      .then(() => {
        const storedState = JSON.parse(localStorage.getItem(`form-state_${ currentClinician.id }`));

        expect(storedState).to.deep.equal({
          saveButtonType: 'save',
        });
      });

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit')
      .should('not.contain', 'Go Back');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'Here is some typing',
          storyTime: 'Once upon a time...',
        });
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
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.action.data.id).to.equal(testAction.id);
        expect(data.relationships.form.data.id).to.equal(testForm.id);
        expect(data.attributes.response.data.familyHistory).to.equal('Here is some typing');
        expect(data.attributes.response.data.storyTime).to.equal('Once upon a time...');
      });

    cy.get('@formPath').then(formPath => {
      cy.location('pathname').should('equal', formPath);
    });

    cy
      .get('iframe')
      .should('have.attr', 'src', `/forms/formio/index.html?responseId=${ testFormResponse.id }`);

    cy
      .get('.form__controls')
      .contains('Update');
  });

  specify('submit and go back - action without a flow', function() {
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'flow': getRelationship(),
        'form': getRelationship(testForm),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .routeActionActivity()
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormDefinition');

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
      .should('contain', 'Submit + Go Back');

    cy
      .get('.form__controls')
      .find('.form__submit-choice')
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
      .get('.form__controls')
      .find('.js-save-button')
      .click();

    cy
      .wait('@routePostResponse');

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient.id }/workflow`);
  });

  specify('submit and go back - action in a flow', function() {
    const testPatient = getPatient();
    const testFlow = getFlow({
      relationships: { patient: getRelationship(testPatient) },
    });
    const testAction = getAction({
      relationships: {
        'flow': getRelationship(testFlow),
        'form': getRelationship(testForm),
        'patient': getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;
        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [testAction];
        return fx;
      })
      .routeFlowActivity()
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routePatientByFlow()
      .routeFormByAction(fx => {
        fx.data = testForm;
        return fx;
      })
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .routeActionActivity()
      .visitOnClock(`/patient/${ testPatient.id }/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .get('.patient-flow__action-item')
      .contains(testAction.attributes.name)
      .click()
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routeFormActionFields');

    cy
      .get('.js-expand-button')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ testAction.id }`);

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        delay: 100,
        body: { data: getFormResponse() },
      })
      .as('routePostResponse');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'Here is some typing',
          storyTime: 'Once upon a time...',
        });
      });

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit + Go Back')
      .should('be.enabled')
      .click();

    cy.wait('@routePostResponse');

    cy
      .location('pathname', { timeout: 10000 })
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }`);
  });

  specify('submit and go back - form response error', function() {
    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([]),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatient()
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormDefinition');

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

  specify('form error', function() {
    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([]),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

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
      .find('.form__actions-icon:has(.fa-cloud-check)')
      .click();

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .tick(15000);

    cy
      .wait('@postFormResponse');

    // for when an update draft request returns a 403 error
    cy
      .get('.alert-box')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .click()
      .wait('@postFormResponse');

    cy
      .get('.alert-box')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formErrors = receivedMessages.find(m => m.message === 'form:errors');

        expect(formErrors, 'form:errors message').to.exist;
        expect(formErrors.args.error[0]).to.equal('Insufficient permissions');
      });

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 400,
        delay: 100,
        body: {
          errors: getErrors({
            status: '400',
            title: 'Invalid',
            detail: 'Invalid request parameters',
          }),
        },
      })
      .as('postFormResponse');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .click()
      .wait('@postFormResponse');

    cy
      .get('.alert-box')
      .should('not.exist');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formErrors = receivedMessages.filter(m => m.message === 'form:errors');

        expect(formErrors).to.have.length(2);
        expect(formErrors[1].args.error[0]).to.equal('Invalid request parameters');
      });
  });

  specify('hidden submit button', function() {
    const testAction = getAction({
      relationships: {
        'form': getRelationship(testSubmitHiddenForm),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testSubmitHiddenForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routePatient()
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

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

  specify('hidden submit button - update form', function() {
    const testFormResponse = getFormResponse();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testSubmitHiddenForm),
        'form-responses': getRelationship([testFormResponse]),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testSubmitHiddenForm;

        return fx;
      })
      .routeFormResponse(fx => {
        fx.data = testFormResponse;

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponse,
        };
      })
      .routeFormDefinition()
      .routeFormActionFields()
      .routeActionActivity()
      .routePatient()
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition')
      .wait('@routeFormResponse');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Update')
      .click();

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const definition = receivedMessages.find(m => m.message === 'fetch:form:definition');

        expect(definition.args.value.components[0].components.find(c => c.key === 'familyHistory'), 'familyHistory component').to.exist;
      });

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .should('not.exist');
  });

  specify('user has work:owned:submit permission', function() {
    const testCurrentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    const otherClinician = getClinician();

    const testPatient = getPatient();

    const testActionOne = getAction({
      attributes: {
        name: 'Owned by current clinician',
      },
      relationships: {
        patient: getRelationship(testPatient),
        owner: getRelationship(testCurrentClinician),
        state: getRelationship(stateInProgress),
        form: getRelationship(testForm),
      },
    });

    const testActionTwo = getAction({
      attributes: {
        name: 'Not owned by current clinician',
      },
      relationships: {
        patient: getRelationship(testPatient),
        owner: getRelationship(otherClinician),
        state: getRelationship(stateTodo),
        form: getRelationship(testReadOnlyForm),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = testCurrentClinician;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testActionOne, testActionTwo];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testActionOne;

        return fx;
      })
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: { foo: 'bar' },
          },
        });

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .first()
      .find('[data-form-region] button')
      .click()
      .wait('@routeAction')
      .wait('@routeFormByAction');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('exist');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const definition = receivedMessages.find(m => m.message === 'fetch:form:definition');
        const formData = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(definition.args.value.components[0].components.find(c => c.key === 'familyHistory'), 'familyHistory component').to.exist;
        expect(definition.args.value.components[1].components.find(c => c.key === 'storyTime'), 'storyTime component').to.exist;
        expect(formData.args.value.formData.fields.foo).to.equal('bar');
      });

    cy
      .get('.patient__context-trail')
      .find('.js-patient')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeAction(fx => {
        fx.data = testActionTwo;

        return fx;
      });

    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .last()
      .find('[data-form-region] button')
      .click();

    cy
      .wait('@routeAction')
      .wait('@routeFormByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formData = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(formData.args.value.isReadOnly).to.be.true;
        expect(formData.args.value.formData.fields.foo).to.equal('bar');
      });
  });

  specify('user has work:team:submit permission', function() {
    const testCurrentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

    const testPatient = getPatient();

    const testActionOne = getAction({
      attributes: {
        name: 'Owned by current clinician',
      },
      relationships: {
        patient: getRelationship(testPatient),
        owner: getRelationship(testCurrentClinician),
        state: getRelationship(stateInProgress),
        form: getRelationship(testForm),
      },
    });

    const testActionTwo = getAction({
      attributes: {
        name: 'Owned by another team',
      },
      relationships: {
        patient: getRelationship(testPatient),
        owner: getRelationship(teamNurse),
        state: getRelationship(stateTodo),
        form: getRelationship(testReadOnlyForm),
      },
    });

    const testActionThree = getAction({
      attributes: {
        name: 'Owned by non team member',
      },
      relationships: {
        patient: getRelationship(testPatient),
        owner: getRelationship(nonTeamClinician),
        state: getRelationship(stateTodo),
        form: getRelationship(testReadOnlyForm),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = testCurrentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [testCurrentClinician, nonTeamClinician];

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testActionOne, testActionTwo, testActionThree];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testActionOne;

        return fx;
      })
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: { foo: 'bar' },
          },
        });

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .first()
      .find('[data-form-region] button')
      .click()
      .wait('@routeAction')
      .wait('@routeFormByAction');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('exist');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const definition = receivedMessages.find(m => m.message === 'fetch:form:definition');
        const formData = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(definition.args.value.components[0].components.find(c => c.key === 'familyHistory'), 'familyHistory component').to.exist;
        expect(definition.args.value.components[1].components.find(c => c.key === 'storyTime'), 'storyTime component').to.exist;
        expect(formData.args.value.formData.fields.foo).to.equal('bar');
      });

    cy
      .get('.patient__context-trail')
      .find('.js-patient')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeAction(fx => {
        fx.data = testActionTwo;

        return fx;
      });

    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .eq(1)
      .find('[data-form-region] button')
      .click();

    cy
      .wait('@routeAction')
      .wait('@routeFormByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formData = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(formData.args.value.isReadOnly).to.be.true;
        expect(formData.args.value.formData.fields.foo).to.equal('bar');
      });

    cy
      .get('.patient__context-trail')
      .find('.js-patient')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeAction(fx => {
        fx.data = testActionThree;

        return fx;
      });

    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .last()
      .find('[data-form-region] button')
      .click();

    cy
      .wait('@routeAction')
      .wait('@routeFormByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formData = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(formData.args.value.isReadOnly).to.be.true;
        expect(formData.args.value.formData.fields.foo).to.equal('bar');
      });
  });

  specify('report form', function() {
    const createdAt = testTs();

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
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testReportForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routePatient()
      .routeLatestFormSubmission()
      .visit(`/patient/${ routePatientId }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatient')
      .wait('@routeFormDefinition');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const definition = receivedMessages.find(m => m.message === 'fetch:form:definition');

        expect(definition.args.value.components[0].components.find(c => c.key === 'familyHistory'), 'familyHistory component').to.exist;
      });

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', `filter[submitted_at]=<=${ createdAt }`);
  });

  specify('refresh stale form', function() {
    const testFormResponseId = uuid();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'form-responses': getRelationship([getFormResponse({ id: testFormResponseId })]),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routePatient()
      .visitOnClock(`/patient/${ routePatientId }/action/${ testAction.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeLatestFormResponse')
      .wait('@routePatient')
      .wait('@routeFormDefinition')
      .wait('@routeFormActionFields');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formData = receivedMessages.find(m => m.message === 'fetch:form:data');

        expect(formData, 'fetch:form:data').to.exist;
        expect(formData.args.value.formSubmission.familyHistory).to.not.exist;
      });

    cy
      .routeLatestFormResponse(() => {
        return {
          data: getFormResponse({
            id: testFormResponseId,
            attributes: {
              status: FORM_RESPONSE_STATUS.DRAFT,
              updated_at: testTsSubtract(1),
              response: {
                data: {
                  familyHistory: 'Form draft work done in another tab.',
                },
              },
            },
          }),
        };
      });

    cy
      .tick(1800000)
      .wait('@routeLatestFormResponse')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formData = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(formData.args.value.storedSubmission.familyHistory).to.equal('Form draft work done in another tab.');
      });

    const submission = getFormResponse({
      id: testFormResponseId,
      attributes: {
        status: FORM_RESPONSE_STATUS.SUBMITTED,
        updated_at: testTs(),
        response: {
          data: {
            familyHistory: 'Form work submitted in another tab.',
          },
        },
      },
    });

    cy
      .routeFormResponse(fx => {
        fx.data = submission;

        return fx;
      })
      .routeLatestFormResponse(() => {
        return {
          data: submission,
        };
      });

    cy
      .tick(1800000)
      .wait('@routeFormResponse')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Update');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const formResponse = receivedMessages.find(m => m.message === 'fetch:form:response');

        expect(formResponse.args.value.formSubmission.familyHistory).to.equal('Form work submitted in another tab.');
      });
  });
});
