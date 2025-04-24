import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import formatDate from 'helpers/format-date';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { getRelationship, getErrors } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getCurrentClinician, getClinician } from 'support/api/clinicians';
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
      .routeWorkspacePatient()
      .routesForDefault();
  });

  const currentClinician = getCurrentClinician();

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
      .routePatientByAction()
      .routeFormByAction()
      .routeLatestFormResponse()
      .visit(`/patient-action/${ deletedActionId }/form/${ testForm.id }`)
      .wait('@routePatientByAction')
      .wait('@routeActionError');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .url()
      .should('not.contain', `/patient-action/${ deletedActionId }/form/${ testForm.id }`);
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
      .routePatientByAction()
      .routeLatestFormResponse(() => {
        return {
          data: testFormResponse,
        };
      })
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .get('[data-form-updated-region]')
      .should('be.empty');

    cy
      .get('.form__controls')
      .contains('Update')
      .click()
      .wait('@routeFormActionFields');

    cy
      .iframe();
  });

  specify('storing stored submission', function() {
    const testPatient = getPatient();

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
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        body: { data: getFormResponse() },
      })
      .as('routePostResponse');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .type('bar');

    cy
      .wait(300) // NOTE: must wait due to debounce in iframe
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`));

        expect(storage.submission.fields.foo).to.equal('bar');
      });

    cy
      .get('.form__controls')
      .find('.form__submit-status-text')
      .should('contain', 'Last edit was a few seconds ago');

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
      .get('.form__controls')
      .find('.form__submit-status-text')
      .should('contain', 'Last edit was a minute ago');
  });

  specify('restoring stored submission', function() {
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
      },
    });

    localStorage.setItem(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`, JSON.stringify({
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    }));

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
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routePatientByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'Last edit was a few seconds ago');

    cy
      .get('.form__content')
      .should('contain', `Last edit was ${ formatDate(testTs(), 'TIME_OR_DAY') }`)
      .find('.js-submit')
      .click();

    cy
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'foo');
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

    localStorage.setItem(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`, JSON.stringify({
      updated: testTsSubtract(1),
      submission: {
        fields: { foo: 'foo' },
      },
    }));

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
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routePatientByAction');

    cy
      .intercept('PATCH', `/api/form-responses/${ formResponse.id }`, {
        statusCode: 201,
        body: { data: getFormResponse({ id: formResponse.id }) },
      })
      .as('routePatchResponse');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'Last edit was a few seconds ago');

    cy
      .get('.form__content')
      .should('contain', `Last edit was ${ formatDate(testTs(), 'TIME_OR_DAY') }`)
      .find('.js-submit')
      .click();

    cy
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .type('baz');

    cy
      .wait(300); // NOTE: must wait due to debounce in iframe

    cy
      .get('.form__controls')
      .find('.form__submit-status-text')
      .should('contain', 'Last edit was a few seconds ago');

    cy
      .tick(15000);

    cy
      .wait('@routePatchResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.equal(formResponse.id);
        expect(data.attributes.status).to.equal('draft');
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

    localStorage.setItem(`form-subm-${ currentClinician.id }-${ testPatient.id }-${ testForm.id }-${ testAction.id }`, JSON.stringify({
      updated: testTs(),
      submission: {
        fields: { foo: 'foo' },
      },
    }));

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
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeLatestFormResponse');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        body: { data: getFormResponse() },
      })
      .as('routePostResponse');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'Your work is stored automatically.')
      .should('contain', 'Last edit was a few seconds ago');

    cy
      .get('.form__content')
      .should('contain', `Last edit was ${ formatDate(testTs(), 'TIME_OR_DAY') }`)
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
      .find('.form__submit-status')
      .should('contain', 'Your work is stored automatically.')
      .should('not.contain', 'Last edit was');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .type('baz');

    cy
      .wait(300); // NOTE: must wait due to debounce in iframe

    cy
      .get('.form__controls')
      .find('.form__submit-status-text')
      .should('contain', 'Last edit was a few seconds ago');

    cy
      .tick(15000);

    cy
      .wait('@routePostResponse')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.not.equal(formResponse.id);
        expect(data.attributes.status).to.equal('draft');
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
      .routePatientByAction(fx => {
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
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', `filter[forms]=${ testForm.id }`)
      .should('contain', `filter[flows]=${ testFlow.id }`);

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('have.value', 'Prefilled family history');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('have.value', 'Prefilled story time');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar');
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
      .routePatientByAction(fx => {
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
      .visit(`/patient-action/${ testAction.id }/form/${ testPrefillForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .wait('@routeLatestFormSubmission')
      .itsUrl()
      .its('search')
      .should('contain', `filter[forms]=${ testForm.id }`)
      .should('not.contain', 'filter[flows]');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('have.value', 'Prefilled family history');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('have.value', 'Prefilled story time');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar');
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
      .routePatientByAction(fx => {
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
      .visit(`/patient-action/${ testAction.id }/form/${ testPrefillActionTagForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
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
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('have.value', 'Prefilled family history');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('have.value', 'Prefilled response story time');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar');
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
      .routePatientByAction()
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition')
      .wait('@routeFormResponse');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar');

    cy
      .get('.form__controls')
      .contains('Update')
      .click()
      .wait('@routeFormActionFields');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar');
  });

  specify('submitting the form', function() {
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

        fx.included.push(...testFormResponses);

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
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition')
      .wait('@routeWorkspacePatient')
      .wait('@routeFormResponse');

    cy
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .should('contain', 'Family Medical History');

    cy
      .get('@iframe')
      .should('contain', 'Here is some typing');

    cy
      .get('@iframe')
      .find('textarea')
      .should('not.exist');

    cy
      .get('@iframe')
      .find('button')
      .should('not.be.visible');

    cy
      .get('.form__title')
      .should('contain', 'Testin Mctester')
      .should('contain', 'Test Form');

    cy
      .get('.js-expand-button')
      .as('expandButton')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Decrease Width');

    cy
      .get('@expandButton')
      .trigger('mouseout')
      .click()
      .wait('@routeActionActivity')
      .wait('@routeWorkspacePatient')
      .wait('@routeActionComments')
      .wait('@routeActionFiles');

    cy
      .get('@expandButton')
      .find('.icon')
      .should('have.class', 'fa-up-right-and-down-left-from-center');

    cy
      .get('@expandButton')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Increase Width');

    cy
      .get('@expandButton')
      .trigger('mouseout');

    cy
      .get('.sidebar')
      .should('exist');

    cy
      .get('.js-history-button')
      .as('historyBtn')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'See Form Response History');

    cy
      .get('@historyBtn')
      .click();

    cy
      .get('@expandButton')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('@expandButton')
      .click();

    cy
      .get('@historyBtn')
      .click();

    cy
      .get('@historyBtn')
      .click();

    cy
      .get('.form__controls')
      .as('metaRegion');

    cy
      .get('@historyBtn')
      .should('have.class', 'is-selected')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Back to Current Version');

    cy
      .get('@metaRegion')
      .find('.button-filter')
      .should('contain', formatDate(testUpdatedAt, 'AT_TIME'))
      .should('contain', 'By Clinician McTester')
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
      .should('have.attr', 'src', `/formapp/${ testFormResponses[2].id }`);

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
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .find('textarea[name="data[familyHistory]"]')
      .clear()
      .type('New typing');

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
      .get('iframe')
      .should('have.attr', 'src', `/formapp/${ testNewFormResponse.id }`);

    cy
      .wait('@routeFormResponse');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Update')
      .click();

    cy
      .get('.js-sidebar-button')
      .as('sidebarButton')
      .should('have.class', 'is-selected')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Hide Action Sidebar');

    cy
      .get('@expandButton')
      .trigger('mouseout')
      .click();

    cy
      .get('@sidebarButton')
      .trigger('mouseout')
      .click();

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .find('button')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('.js-close')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('@sidebarButton')
      .should('not.have.class', 'is-selected');

    cy
      .get('@expandButton')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('@expandButton')
      .click();

    cy
      .get('.patient-sidebar');

    cy
      .get('@sidebarButton')
      .click();

    cy
      .get('.sidebar');

    cy
      .get('@sidebarButton')
      .should('have.class', 'is-selected')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('@sidebarButton')
      .should('not.have.class', 'is-selected')
      .click();

    cy
      .get('.sidebar')
      .find('.js-menu')
      .click();

    cy
      .intercept('DELETE', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteAction');

    cy
      .get('.picklist')
      .contains('Delete Action')
      .click();

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action was deleted successfully.');

    cy
      .url()
      .should('not.contain', `patient-action/${ testAction.id }/form/${ testForm.id }`);
  });

  specify('action locked form', function() {
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
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeFormResponse')
      .wait('@routeFormDefinition');

    cy
      .get('[data-form-updated-region]')
      .should('be.empty');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .iframe()
      .find('.formio-read-only')
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('be.disabled');

    cy
      .get('.form__frame')
      .should('contain', 'Last submitted')
      .and('contain', formatDate(testTs(), 'LONG'));

    cy
      .get('.js-history-button')
      .click();

    // NOTE: History functionality tested elsewhere
    cy
      .get('.js-current')
      .should('exist');
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
      .routePatientByAction()
      .routeFormActionFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: { foo: 'bar' },
          },
        });

        return fx;
      })
      .visit(`/patient-action/${ testAction.id }/form/${ testReadOnlyForm.id }`)
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routeFormActionFields');

    cy
      .get('[data-form-updated-region]')
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
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('be.disabled');
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
      .routePatientByAction()
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
      .get('.table-list')
      .find('.table-list__item')
      .first()
      .find('[data-form-region]')
      .click()
      .wait('@routeAction')
      .wait('@routePatientByAction');

    cy
      .get('[data-nav-region]')
      .should('not.be.visible');

    cy
      .get('iframe')
      .should('have.attr', 'src', `/formapp/${ testFormResponse.id }`);

    cy
      .get('.form__frame')
      .should('contain', 'Last submitted')
      .and('contain', formatDate(updatedAt, 'AT_TIME'))
      .find('button')
      .contains('Update')
      .click();

    cy
      .get('iframe')
      .should('have.attr', 'src', '/formapp/');

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

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testForm),
        'flow': getRelationship(testFlow),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeActionActivity()
      .routePatientByAction()
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
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routePatientByAction');

    cy
      .get('[data-nav-region]')
      .should('not.be.visible');

    cy
      .get('.js-history-button')
      .should('not.exist');

    cy
      .get('.form__content')
      .should('not.contain', 'Last submitted');

    cy
      .get('iframe')
      .should('have.attr', 'src', '/formapp/');

    cy
      .get('.js-back')
      .click();

    cy
      .url()
      .should('contain', `/flow/${ testFlow.id }`);
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
      .routePatientByAction(fx => {
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
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routePatientByAction');

    cy
      .get('.js-back')
      .click();

    cy
      .url()
      .should('contain', `/patient/dashboard/${ testPatient.id }`);
  });

  specify('store expanded state in localStorage', function() {
    localStorage.setItem(`form-state_${ currentClinician.id }`, JSON.stringify({ isExpanded: false }));

    const testAction = getAction({
      relationships: {
        'form': getRelationship(testReadOnlyForm),
        'form-responses': getRelationship([]),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .visit(`/patient-action/${ testAction.id }/form/${ testReadOnlyForm.id }`)
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy
      .get('.sidebar')
      .should('exist');

    cy
      .get('.js-sidebar-button')
      .as('sidebarButton')
      .should('have.class', 'is-selected')
      .trigger('mouseover');

    cy
      .get('.js-expand-button')
      .as('expandButton')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Increase Width');

    cy
      .get('@expandButton')
      .find('.icon')
      .should('have.class', 'fa-up-right-and-down-left-from-center');

    cy
      .get('@expandButton')
      .trigger('mouseout')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`form-state_${ currentClinician.id }`));

        expect(storage.isExpanded).to.be.true;
      });

    cy
      .get('@expandButton')
      .trigger('mouseout')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`form-state_${ currentClinician.id }`));

        expect(storage.isExpanded).to.be.false;
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
      .routePatientByAction(fx => {
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
      .visit(`/patient-action/${ testAction.id }/form/${ testWidgetsForm.id }`)
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition')
      .wait('@routePatientByAction')
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

  specify('submit and go back button', function() {
    localStorage.setItem(`form-state_${ currentClinician.id }`, JSON.stringify({ saveButtonType: 'saveAndGoBack' }));

    const testPatient = getPatient();

    const testFlow = getFlow();

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
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
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
      .find('.button__drop-list-select')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2);

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .type('Here is some typing');

    cy
      .wait(200) // Account for iframe debounce
      .get('.picklist')
      .should('not.exist');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .type('Once upon a time...');

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
        expect(data.relationships.action.data.id).to.equal(testAction.id);
        expect(data.relationships.form.data.id).to.equal(testForm.id);
        expect(data.attributes.response.data.familyHistory).to.equal('Here is some typing');
        expect(data.attributes.response.data.storyTime).to.equal('Once upon a time...');
      });

    cy
      .wait(200)
      .url()
      .should('contain', `/flow/${ testFlow.id }`);
  });

  specify('submit and go back button - action without a flow', function() {
    localStorage.setItem(`form-state_${ currentClinician.id }`, JSON.stringify({ saveButtonType: 'saveAndGoBack' }));

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
      .routePatientByAction(fx => {
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
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
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
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .type('Here is some typing');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .type('Once upon a time...');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .click();

    cy
      .wait('@routePostResponse');

    cy
      .wait(200)
      .url()
      .should('contain', `/patient/dashboard/${ testPatient.id }`);
  });

  specify('submit and go back button - form response error', function() {
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
      .routePatientByAction()
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
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
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .find('textarea[name="data[familyHistory]"]')
      .clear()
      .type('New typing');

    cy
      .get('@iframe')
      .find('textarea[name="data[storyTime]"]')
      .clear()
      .type('New typing');

    cy
      .get('.form__controls')
      .find('.button__drop-list-select')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .eq(1)
      .click();

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .click()
      .wait('@postFormResponse');

    cy
      .get('@iframe')
      .find('.alert')
      .contains('Insufficient permissions');
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
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`, { now: testTs() })
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
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .find('textarea[name="data[familyHistory]"]')
      .clear()
      .type('New typing');

    cy
      .get('@iframe')
      .find('textarea[name="data[storyTime]"]')
      .clear()
      .type('New typing');

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
      .get('@iframe')
      .find('.alert')
      .contains('Insufficient permissions');

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
      .get('@iframe')
      .find('.alert')
      .contains('Invalid request parameters');
  });

  specify('hidden submit button', function() {
    cy
      .routeAction()
      .routeFormByAction(fx => {
        fx.data = testSubmitHiddenForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .routePatientByAction()
      .visit(`/patient-action/1/form/${ testSubmitHiddenForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Submit')
      .should('not.exist');
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
      .routePatientByAction()
      .visit(`/patient-action/${ testAction.id }/form/${ testSubmitHiddenForm.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition')
      .wait('@routeFormResponse');

    cy
      .get('.form__controls')
      .find('button')
      .contains('Update')
      .click();

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]');

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

    const otherClinician = getClinician({ id: uuid() });

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
      .routePatientByAction()
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
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('[data-form-region] button')
      .click()
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('exist');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('exist');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('exist');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('not.be.disabled');

    cy
      .get('.form__context-trail')
      .find('.js-back')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeAction(fx => {
        fx.data = testActionTwo;

        return fx;
      });

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .last()
      .find('[data-form-region] button')
      .click();

    cy
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('not.exist');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('not.exist');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('be.disabled');
  });

  specify('user has work:team:submit permission', function() {
    const testCurrentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamClinician = getClinician({
      id: uuid(),
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
      .routePatientByAction()
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
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('[data-form-region] button')
      .click()
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction');

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('exist');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('exist');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('exist');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('not.be.disabled');

    cy
      .get('.form__context-trail')
      .find('.js-back')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeAction(fx => {
        fx.data = testActionTwo;

        return fx;
      });

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .eq(1)
      .find('[data-form-region] button')
      .click();

    cy
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('not.exist');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('not.exist');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('be.disabled');

    cy
      .get('.form__context-trail')
      .find('.js-back')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeAction(fx => {
        fx.data = testActionThree;

        return fx;
      });

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .last()
      .find('[data-form-region] button')
      .click();

    cy
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction');

    cy
      .get('.form__controls')
      .find('.form__submit-status')
      .should('contain', 'You don’t have permission to edit or submit this form.');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('not.exist');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('not.exist');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar')
      .should('be.disabled');
  });

  specify('report form', function() {
    const createdAt = testTs();

    const testAction = getAction({
      attributes: {
        created_at: createdAt,
        tags: ['prefill-latest-response'],
      },
    });

    const testReportForm = getForm({
      attributes: {
        options: {
          is_report: true,
          prefill_action_tag: 'foo-tag',
        },
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
      .routePatientByAction()
      .routeLatestFormSubmission()
      .visit(`/patient-action/${ testAction.id }/form/${ testReportForm.id }`)
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]');

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
      .routePatientByAction()
      .visitOnClock(`/patient-action/${ testAction.id }/form/${ testForm.id }`, { now: testTs() })
      .wait('@routeAction')
      .wait('@routeFormByAction')
      .wait('@routeLatestFormResponse')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy.wait(300);

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('be.empty');

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
      .wait('@routePatientByAction');

    cy
      .get('.form__content')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy.wait(300);

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .should('contain', 'Submit');

    cy
      .iframe()
      .find('textarea[name="data[familyHistory]"]')
      .should('contain', 'Form draft work done in another tab.');

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
      .wait('@routePatientByAction')
      .wait('@routeFormByAction')
      .wait('@routeFormDefinition');

    cy.wait(300);

    cy
      .get('.form__controls')
      .find('button')
      .contains('Update');

    cy
      .iframe()
      .should('contain', 'Form work submitted in another tab.');

    cy
      .iframe()
      .find('textarea')
      .should('not.exist');
  });
});
