import _ from 'underscore';
import { v7 as uuid } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateAdd, testDateSubtract } from 'helpers/test-date';
import formatDate from 'helpers/format-date';
import { getErrors, getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getAction, getActions } from 'support/api/actions';
import { getProgramAction } from 'support/api/program-actions';
import { getProgramFlow } from 'support/api/program-flows';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { testForm } from 'support/api/forms';
import { stateInProgress, stateDone, stateTodo } from 'support/api/states';
import { teamCoordinator, teamNurse, teamOther } from 'support/api/teams';
import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { workspaceOne } from 'support/api/workspaces';
import { getComment } from 'support/api/comments';
import { getFile } from 'support/api/files';
import { getActivity } from 'support/api/events';

const tomorrow = testDateAdd(1);

context('patient flow page', function() {
  const testFlow = getFlow({
    attributes: {
      name: 'Test Flow',
    },
    relationships: {
      state: getRelationship(stateTodo),
    },
  });

  const testAction = getAction({
    attributes: {
      name: 'Test Action',
    },
    relationships: {
      flow: getRelationship(testFlow),
    },
  });

  beforeEach(function() {
    cy
      .routesForPatientDashboard()
      .routeFlowActivity();
  });

  specify('shows stable flow structure while loading', function() {
    const patient = getPatient();
    const flow = getFlow({
      relationships: {
        patient: getRelationship(patient),
      },
    });
    const actions = getActions({
      relationships: {
        flow: getRelationship(flow),
        patient: getRelationship(patient),
      },
    });

    cy
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routeFlow(fx => {
        fx.data = flow;
        fx.included = [patient];

        return fx;
      }, { delay: 1000 })
      .intercept('GET', '/api/flows/**/actions*', {
        delay: 1000,
        body: { data: actions, included: [flow, patient] },
      })
      .as('routeDelayedFlowActions')
      .visit(`/patient/${ patient.id }/flow/${ flow.id }`);

    cy
      .get('.patient-flow__loader')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true')
      .find('.patient-flow-loading__item')
      .should('have.length', 2);

    cy
      .get('.patient-flow-loading__skeleton')
      .should('contain', 'Activity')
      .find('.add-workflow__button, .button--checkbox')
      .should('not.exist');

    cy
      .wait(['@routeFlow', '@routeDelayedFlowActions'])
      .get('.patient-flow__loader')
      .should('not.exist');
  });

  specify('context trail', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
    });

    cy
      .routesForDefault()
      .routeFlows()
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            patient: getRelationship(testPatient),
          },
        });

        fx.included = [testPatient];

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routeFlowActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.card-list')
      .find('.flow-card')
      .first()
      .click('bottom')
      .wait('@routeFlow');

    cy
      .get('.patient__context-trail')
      .should('contain', 'Test Flow')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', '/worklist/owned-by');

    cy
      .get('.card-list')
      .find('.flow-card')
      .first()
      .click('bottom')
      .wait('@routeFlow');

    cy.url().as('flowUrl');

    cy
      .get('.patient__context-trail')
      .contains('Test Patient')
      .click();

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`);

    cy.go('back');

    cy.get('@flowUrl').then(flowUrl => {
      cy.url().should('equal', flowUrl);
    });
  });

  specify('activity and flow menu', function() {
    const testPatient = getPatient();
    const testPageFlow = getFlow({
      attributes: {
        name: 'Test Flow',
      },
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routeFlow(fx => {
        fx.data = testPageFlow;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions()
      .routeFlowActivity(fx => {
        fx.data = [
          getActivity({
            event_type: 'FlowNameUpdated',
            source: 'system',
            previous: 'Previous Flow',
            value: 'Test Flow',
          }),
        ];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/flow/${ testPageFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatient')
      .wait('@routeFlowActions')
      .wait('@routeFlowActivity');

    cy
      .get('.patient-flow__activity')
      .should('contain', 'Activity')
      .and('contain', 'Flow name updated from Previous Flow to Test Flow');

    cy
      .intercept('DELETE', `/api/flows/${ testPageFlow.id }`, {
        statusCode: 403,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Forbidden',
            detail: 'Insufficient permissions to delete flow',
          }),
        },
      })
      .as('routeDeleteFlowFailure');

    cy
      .get('.patient-flow__header-container .js-menu')
      .should('have.attr', 'aria-label', 'Flow Menu')
      .click();

    cy
      .get('.picklist')
      .contains('Delete Flow')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Confirm Delete')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeDeleteFlowFailure');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete flow')
      .find('.js-dismiss')
      .click();

    cy
      .intercept('DELETE', `/api/flows/${ testPageFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlow');

    cy
      .get('.patient-flow__header-container .js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Delete Flow')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteFlow');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`);
  });

  specify('patient flow action page', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testFlowAction = getAction({
      attributes: {
        name: 'Test Action',
        duration: 10,
        outreach: null,
        sharing: 'disabled',
        updated_at: testTsSubtract(1),
        allowed_uploads: ['pdf'],
      },
      relationships: {
        'flow': getRelationship(testFlow),
        'state': getRelationship(stateTodo),
        'owner': getRelationship(teamNurse),
        'form': getRelationship(testForm),
        'patient': getRelationship(testPatient),
        'program-action': getRelationship(testProgramAction),
        'files': getRelationship([]),
      },
    });

    const handleActionMessage = message => {
      cy.getRadio(Radio => {
        const action = Radio.request('entities', 'actions:model', testFlowAction.id);
        action.handleMessage(message);
      });
    };

    cy
      .routesForPatientAction()
      .routeSettings('upload_attachments', false)
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testFlowAction;
        fx.included.push(testProgramAction, testFlow);
        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [];

        return fx;
      })
      .routeActionActivity()
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visitOnClock(`/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ testFlowAction.id }`, { now: testTs() })
      .wait('@routeFlow')
      .wait('@routeAction')
      .wait('@routeActionActivity')
      .wait('@routeActionComments')
      .wait('@routeActionFiles');

    cy
      .get('.patient-action')
      .find('[data-action-region] [data-testid="patient-action-name"]')
      .should('contain', 'Test Action');

    handleActionMessage({
      category: 'NameChanged',
      resource: {
        type: testFlowAction.type,
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          name: 'New Websocket Name',
        },
      },
    });

    cy
      .get('.patient-action')
      .find('[data-action-region] [data-testid="patient-action-name"]', { timeout: 10000 })
      .should('contain', 'New Websocket Name');

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .clear()
      .type('User manually added details.');

    handleActionMessage({
      category: 'DetailsChanged',
      resource: {
        type: testFlowAction.type,
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          details: 'New websocket details.',
        },
      },
    });

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .should('have.value', 'User manually added details.');

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .contains('Cancel')
      .click();

    handleActionMessage({
      category: 'DetailsChanged',
      resource: {
        type: testFlowAction.type,
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          details: 'New websocket details.',
        },
      },
    });

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .should('have.value', 'New websocket details.');

    handleActionMessage({
      category: 'ActionDurationChanged',
      resource: {
        type: testFlowAction.type,
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          duration: 20,
        },
      },
    });

    cy
      .get('.patient-action')
      .find('[data-duration-region]')
      .should('contain', '20 mins');

    cy
      .get('.patient-action')
      .find('[data-form-sharing-region]')
      .should('be.empty');
  });

  specify('done patient flow action page', function() {
    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeActionActivity()
      .visit(`/patient/1/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow')
      .wait('@routeAction');

    cy
      .get('.patient-action')
      .should('not.contain', 'Permissions');
  });

  specify('flow actions list', function() {
    const testListAction = mergeJsonApi(testAction, {
      attributes: {
        name: 'Third In List',
        details: null,
        due_date: testDateAdd(1),
        created_at: testTsSubtract(3),
        outreach: 'patient',
        sequence: 3,
      },
      relationships: {
        flow: getRelationship(testFlow),
        state: getRelationship(stateDone),
        owner: getRelationship(teamOther),
      },
    });

    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          attributes: {
            updated_at: testTs(),
          },
          relationships: {
            state: getRelationship(stateInProgress),
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'First In List',
              details: 'Action details content.',
              due_date: testDateSubtract(1),
              created_at: testTsSubtract(1),
              sequence: 1,
              outreach: 'patient',
              sharing: 'sent',
              options: {
                icon: 'caret-down',
                iconType: 'fas',
                color: 'red',
              },
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateTodo),
              owner: getRelationship(teamNurse),
              form: getRelationship(testForm),
              files: getRelationship([getFile()]),
              comments: getRelationship([getComment()]),
            },
          }),
          testListAction,
          getAction({
            attributes: {
              name: 'Second In List',
              details: null,
              due_date: testDateAdd(2),
              created_at: testTsSubtract(2),
              sequence: 2,
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamOther),
            },
          }),
        ];

        return fx;
      })
      .intercept('PATCH', `/api/actions/${ testListAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction')
      .routeActionActivity()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy.viewport(1600, 900);

    cy
      .get('.patient-flow__list')
      .as('actionsList')
      .find('.action-card')
      .should('have.length', 3);

    cy
      .get('.patient-flow__list')
      .find('.action-card')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip', { timeout: 10000 })
      .should('contain', 'Action details content.');

    cy
      .get('.patient-flow__list')
      .find('.action-card')
      .eq(1)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('@actionsList')
      .find('.action-card')
      .first()
      .should($action => {
        expect($action.find('.work-card__state .fa-circle-exclamation')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('NUR');
        expect($action.find('[data-due-date-region] .is-overdue')).to.exist;
        expect($action.find('[data-form-region]')).not.to.be.empty;
        expect($action.find('.fa-paperclip')).to.exist;
        expect($action.find('.fa-paperclip').next()).to.contain('1');
        expect($action.find('.fa-comment')).to.exist;
        expect($action.find('.fa-comment').next()).to.contain('1');
        expect($action.find('.fa-paperclip').parent().index()).to.be.lessThan($action.find('.fa-comment').parent().index());
        expect($action.find('.work-card__heading [data-form-region]')).to.have.lengthOf(1);
        expect($action.find('.action-card__controls [data-form-region]')).to.have.lengthOf(0);
      });

    cy.viewport(1280, 720);

    cy
      .get('@actionsList')
      .find('.action-card')
      .first()
      .next()
      .should($action => {
        expect($action.find('.work-card__state .fa-circle-dot')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('OT');
        expect($action.find('.fa-paperclip')).to.not.exist;
        expect($action.find('.fa-comment')).to.not.exist;
      });

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .should($action => {
        expect($action.find('.work-card__state .fa-circle-check')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('OT');
        expect($action.find('[data-owner-region] button')).to.be.disabled;
        expect($action.find('[data-due-date-region] button')).to.be.disabled;
        expect($action.find('[data-due-time-region] button')).to.be.disabled;
      })
      .find('[data-state-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.fa-circle-dot')
      .click();

    cy
      .routeAction(fx => {
        fx.data = mergeJsonApi(testListAction, {
          relationships: {
            state: getRelationship(stateTodo),
            owner: getRelationship(teamOther),
          },
        });

        return fx;
      });

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .should($action => {
        expect($action.find('.fa-circle-dot')).to.exist;
        expect($action.find('[data-owner-region] button')).not.to.be.disabled;
        expect($action.find('[data-due-date-region] button')).not.to.be.disabled;
        expect($action.find('[data-due-time-region] button')).not.to.be.disabled;
      });

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('[data-owner-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse')
      .click()
      .wait('@routePatchAction');

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .find('.js-next')
      .click();

    cy
      .get('.datepicker')
      .find('.datepicker__days li')
      .contains('1')
      .click()
      .wait('@routePatchAction');

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('[data-due-time-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('11:15 AM')
      .click()
      .wait('@routePatchAction');

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('.work-card__title')
      .focus()
      .typeEnter()
      .wait('@routeAction');

    cy
      .get('.patient-action')
      .find('[data-owner-region]')
      .click({ scrollBehavior: 'center' });

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-action')
      .find('[data-owner-region]')
      .contains('NUR');

    cy
      .get('.patient-action')
      .find('[data-due-date-region]')
      .click({ scrollBehavior: 'center' });

    cy
      .get('.datepicker')
      .find('.js-next')
      .click()
      .then($el => {
        const dueDay = '1';
        const dueMonth = $el.text().trim();

        cy
          .get('.datepicker')
          .find('.datepicker__days li')
          .contains(dueDay)
          .click();

        cy
          .get('.patient-action')
          .find('[data-due-date-region]')
          .should('contain', `${ dueMonth } ${ dueDay }`);
      });

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .click({ scrollBehavior: 'center' });

    cy
      .get('.picklist')
      .contains('11:15 AM')
      .click();

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .should('contain', '11:15 AM');

    cy
      .wait('@routePatchAction');

    cy
      .intercept('DELETE', `/api/actions/${ testListAction.id }`, {
        statusCode: 403,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Forbidden',
            detail: 'Insufficient permissions to delete action',
          }),
        },
      })
      .as('routeDeleteFlowActionFailure');

    cy
      .get('.patient-action__menu')
      .click({ scrollBehavior: 'center' });

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Action')
      .click()
      .wait('@routeDeleteFlowActionFailure');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete action')
      .find('.js-dismiss')
      .click();

    cy
      .intercept('DELETE', `/api/actions/${ testListAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlowAction');

    cy
      .get('.patient-action__menu')
      .click({ scrollBehavior: 'center' });

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Action')
      .click()
      .wait('@routeDeleteFlowAction')
      .wait('@routeFlowActions');

    cy
      .url()
      .should('not.contain', '/action/');
  });

  specify('add action', function() {
    const testProgramAction = getProgramAction({
      attributes: {
        name: 'Conditional',
        published_at: testTs(),
        archived_at: null,
        behavior: 'conditional',
        details: '',
        days_until_due: 0,
        sequence: 0,
      },
      relationships: {
        owner: getRelationship(),
        form: getRelationship(testForm),
        teams: getRelationship([teamNurse]),
      },
    });

    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        const testProgramActions = [
          testProgramAction,
          getProgramAction({
            attributes: {
              name: 'Published',
              published_at: testTs(),
              archived_at: null,
              behavior: 'standard',
              details: 'details',
              days_until_due: 1,
              sequence: 1,
              options: {
                icon: 'caret-down',
                iconType: 'fas',
                color: 'red',
              },
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              form: getRelationship(testForm),
            },
          }),
          getProgramAction({
            attributes: {
              name: 'Should not show - unpublished',
              published_at: null,
              archived_at: null,
              behavior: 'standard',
              details: '',
              days_until_due: 1,
              sequence: 2,
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              form: getRelationship(testForm),
            },
          }),
          getProgramAction({
            attributes: {
              name: 'Should not show - archived',
              published_at: testTs(),
              archived_at: testTs(),
              behavior: 'standard',
              details: '',
              days_until_due: 1,
              sequence: 3,
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              form: getRelationship(testForm),
            },
          }),
          getProgramAction({
            attributes: {
              name: 'Should not show - automated behavior',
              published_at: testTs(),
              archived_at: null,
              behavior: 'automated',
              details: '',
              days_until_due: 1,
              sequence: 4,
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              form: getRelationship(testForm),
            },
          }),
          getProgramAction({
            attributes: {
              name: 'Should not show - not visible to current user team',
              published_at: testTs(),
              archived_at: null,
              behavior: 'standard',
              details: '',
              days_until_due: 1,
              sequence: 1,
            },
            relationships: {
              teams: getRelationship([teamCoordinator]),
            },
          }),
        ];

        const testProgramFlow = getProgramFlow({
          attributes: {
            name: 'Program Flow',
          },
          relationships: {
            'program-actions': getRelationship(testProgramActions, 'program-actions'),
          },
        });

        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            'program-flow': getRelationship(testProgramFlow),
          },
        });

        _.each(testProgramActions, programAction => {
          fx.included.push(programAction);
        });

        fx.included.push(testProgramFlow);

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              sequence: 1,
            },
            relationships: {
              flow: getRelationship(testFlow),
            },
          }),
          getAction({
            attributes: {
              sequence: 2,
            },
            relationships: {
              flow: getRelationship(testFlow),
            },
          }),
          getAction({
            attributes: {
              sequence: 3,
            },
            relationships: {
              flow: getRelationship(testFlow),
            },
          }),
        ];

        return fx;
      })
      .routeActionActivity()
      .visitOnClock(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions')
      .tick(60); // tick past debounce

    const conditionalAction = getAction({
      attributes: {
        name: 'Conditional',
        updated_at: testTs(),
        due_time: null,
        sequence: 4,
      },
      relationships: {
        'flow': getRelationship(testFlow),
      },
    });

    cy
      .intercept('POST', '/api/actions', {
        statusCode: 201,
        body: {
          data: conditionalAction,
        },
      })
      .as('routePostAction');

    cy.routeAction(fx => {
      fx.data = conditionalAction;
      return fx;
    });

    cy
      .get('.patient-flow__name')
      .should('have.css', 'font-weight', '400');

    cy
      .get('.patient-flow__actions')
      .find('.add-workflow__button')
      .find('span')
      .should('have.text', 'Add')
      .closest('button')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__item')
      .should('have.length', 2)
      .first()
      .contains('Conditional');

    cy
      .get('.picklist')
      .find('.picklist__item')
      .last()
      .should('contain', 'Published')
      .should('not.contain', 'Draft')
      .find('.action-icon--red.fa-caret-down');

    cy
      .get('.picklist')
      .find('.picklist__item')
      .first()
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('Conditional');
        expect(data.relationships['program-action'].data.id).to.equal(testProgramAction.id);
        expect(data.relationships.owner).to.be.undefined;
      });

    cy
      .get('@wsHandleMessage')
      .should(stub => {
        const subscribedResources = _.flatten(stub.getCalls().map(call => call.args[0].data.resources));

        expect(subscribedResources).to.deep.include({
          id: conditionalAction.id,
          type: conditionalAction.type,
        });
      });

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }/action/${ conditionalAction.id }`);

    cy
      .get('.patient-action')
      .contains('Conditional');
  });

  specify('failed flow', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    const errors = getErrors({
      status: '410',
      title: 'Not Found',
      detail: 'Cannot find flow',
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeFlowActions()
      .intercept('GET', new RegExp(`/api/flows/${ testFlow.id }\\?`), {
        statusCode: 410,
        body: { errors },
      })
      .as('routeGoneFlow')
      .visit(`/patient/${ testPatient.id }/flow/${ testFlow.id }`)
      .wait('@routeGoneFlow');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Flow you requested does not exist.');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`)
      .should('not.contain', '/flow/');
  });

  specify('patient-less flow route not found', function() {
    const flowId = uuid();

    cy
      .intercept('GET', new RegExp(`/api/flows/${ flowId }\\?`), {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find flow',
          }),
        },
      })
      .as('routeGoneFlow')
      .visit(`/flow/${ flowId }`)
      .wait('@routeGoneFlow');

    cy
      .get('.error-page')
      .should('contain', 'This page doesn\'t exist.');
  });

  specify('patient-less flow route server error', function() {
    const flowId = uuid();

    cy.on('uncaught:exception', () => false);

    cy
      .intercept('GET', new RegExp(`/api/flows/${ flowId }\\?`), {
        statusCode: 500,
        body: {
          errors: getErrors({
            status: '500',
            title: 'Server Error',
            detail: 'Cannot load flow',
          }),
        },
      })
      .as('routeFailedFlow')
      .visit(`/flow/${ flowId }`)
      .wait('@routeFailedFlow');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');
  });

  specify('patient-less flow route unexpected client error', function() {
    const flowId = uuid();
    const errorStub = cy.stub();

    cy.on('uncaught:exception', error => {
      errorStub(error);

      return false;
    });

    cy
      .intercept('GET', new RegExp(`/api/flows/${ flowId }\\?`), {
        statusCode: 404,
        body: {
          errors: getErrors({
            status: '404',
            title: 'Unexpected Client Error',
            detail: 'Cannot load flow',
          }),
        },
      })
      .as('routeFailedFlow')
      .visit(`/flow/${ flowId }`)
      .wait('@routeFailedFlow');

    cy
      .wrap(null)
      .should(() => {
        expect(errorStub).to.be.calledOnce;
        expect(errorStub.firstCall.args[0].message).to.contain('Error Status: 404');
      });
  });

  specify('ignores a patient-less flow resolution after leaving patient routes', function() {
    const testPatient = getPatient();
    const delayedFlow = getFlow({
      relationships: {
        patient: getRelationship(testPatient),
      },
    });
    let replyToFlow;

    cy
      .intercept('GET', new RegExp(`/api/flows/${ delayedFlow.id }\\?`), req => new Cypress.Promise(resolve => {
        replyToFlow = () => {
          req.reply({ body: { data: delayedFlow, included: [testPatient] } });
          resolve();
        };
      }))
      .as('routeDelayedFlow')
      .visit(`/flow/${ delayedFlow.id }`);

    cy
      .wrap(null)
      .should(() => {
        expect(replyToFlow).to.be.a('function');
      });

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'notFound');
    });

    cy
      .get('.error-page')
      .should('contain', 'This page doesn\'t exist.');

    cy.then(() => replyToFlow());

    cy
      .wait('@routeDelayedFlow');

    cy
      .url()
      .should('contain', '/404')
      .should('not.contain', `/patient/${ testPatient.id }/flow/${ delayedFlow.id }`);
  });

  specify('flow server error', function() {
    const testPatient = getPatient();
    const flowId = uuid();

    cy.on('uncaught:exception', () => false);

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [];

        return fx;
      })
      .intercept('GET', new RegExp(`/api/flows/${ flowId }\\?`), {
        statusCode: 500,
        body: {
          errors: getErrors({
            status: '500',
            title: 'Server Error',
            detail: 'Cannot load flow',
          }),
        },
      })
      .as('routeFailedFlow')
      .visit(`/patient/${ testPatient.id }/flow/${ flowId }`)
      .wait('@routeFailedFlow');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');
  });

  specify('flow unexpected client error', function() {
    const testPatient = getPatient();
    const flowId = uuid();
    const errorStub = cy.stub();

    cy.on('uncaught:exception', error => {
      errorStub(error);

      return false;
    });

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [];

        return fx;
      })
      .intercept('GET', new RegExp(`/api/flows/${ flowId }\\?`), {
        statusCode: 404,
        body: {
          errors: getErrors({
            status: '404',
            title: 'Unexpected Client Error',
            detail: 'Cannot load flow',
          }),
        },
      })
      .as('routeFailedFlow')
      .visit(`/patient/${ testPatient.id }/flow/${ flowId }`)
      .wait('@routeFailedFlow');

    cy
      .wrap(null)
      .should(() => {
        expect(errorStub).to.be.calledOnce;
        expect(errorStub.firstCall.args[0].message).to.contain('Error Status: 404');
      });
  });

  specify('empty view', function() {
    cy
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          attributes: {
            updated_at: testTs(),
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('.card-list__empty')
      .contains('No Actions');
  });

  specify('flow owner assignment', function() {
    const currentClinician = getCurrentClinician();
    const otherClinician = getClinician({
      attributes: {
        name: 'Other Clinician',
      },
    });

    cy
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinician, otherClinician];

        return fx;
      })
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateInProgress),
            owner: getRelationship(teamNurse),
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              sequence: 1,
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(teamNurse),
              flow: getRelationship(testFlow),
            },
          }),
          getAction({
            attributes: {
              sequence: 2,
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(otherClinician),
              flow: getRelationship(testFlow),
            },
          }),
          getAction({
            attributes: {
              sequence: 3,
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(teamCoordinator),
              flow: getRelationship(testFlow),
            },
          }),
          getAction({
            attributes: {
              sequence: 4,
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(teamNurse),
              flow: getRelationship(testFlow),
            },
          }),
        ];

        return fx;
      })
      .routeActionActivity()
      .intercept('PATCH', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow')
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__list')
      .as('actionsList');

    cy
      .get('@actionsList')
      .find('.action-card')
      .first()
      .find('[data-owner-region]')
      .should('contain', 'NUR');

    cy
      .get('@actionsList')
      .find('.action-card')
      .eq(1)
      .find('[data-owner-region]')
      .should('contain', 'Other');

    cy
      .get('@actionsList')
      .find('.action-card')
      .eq(2)
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('[data-owner-region]')
      .should('contain', 'NUR');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .contains('McTester')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(currentClinician.id);
        expect(data.relationships.owner.data.type).to.equal(currentClinician.type);
      });

    cy
      .get('@actionsList')
      .find('.action-card')
      .first()
      .find('[data-owner-region]')
      .should('contain', 'McTester');

    cy
      .get('@actionsList')
      .find('.action-card')
      .eq(1)
      .find('[data-owner-region]')
      .should('contain', 'Other');

    cy
      .get('@actionsList')
      .find('.action-card')
      .eq(2)
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('[data-owner-region]')
      .should('contain', 'NUR');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
        expect(data.relationships.owner.data.type).to.equal(teamNurse.type);
      });

    cy
      .get('@actionsList')
      .find('.action-card')
      .first()
      .find('[data-owner-region]')
      .should('contain', 'McTester');

    cy
      .get('@actionsList')
      .find('.action-card')
      .eq(1)
      .find('[data-owner-region]')
      .should('contain', 'Other');

    cy
      .get('@actionsList')
      .find('.action-card')
      .eq(2)
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('@actionsList')
      .find('.action-card')
      .last()
      .find('[data-owner-region]')
      .should('contain', 'NUR');
  });

  specify('flow with work:owned:manage permission', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });

        return fx;
      })
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateInProgress),
            owner: getRelationship(teamNurse),
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .should('contain', 'NU')
      .find('button')
      .should('not.exist');

    cy
      .get('.patient-flow__permission')
      .should('contain', 'You are not able to change settings on this flow.')
      .find('.fa-ban')
      .should('exist');
  });

  specify('flow with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinician, nonTeamMemberClinician];

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              name: 'Owned by another team',
              updated_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamNurse),
            },
          }),
          getFlow({
            attributes: {
              name: 'Owned by non team member',
              updated_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(nonTeamMemberClinician),
            },
          }),
        ];

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions()
      .routeFlowActivity()
      .visit('/patient/dashboard/1')
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeFlow(fx => {
        fx.data = getFlow({
          attributes: {
            name: 'Owned by another team',
          },
          relationships: {
            state: getRelationship(stateInProgress),
            owner: getRelationship(teamNurse),
          },
        });

        return fx;
      });

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .as('listItems')
      .first()
      .click('bottom')
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  specify('flow with work:authored:delete permission', function() {
    const testPatient = getPatient();
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });
    const authoredFlow = getFlow({
      relationships: {
        author: getRelationship(currentClinician),
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
        state: getRelationship(stateInProgress),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlow(fx => {
        fx.data = authoredFlow;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions()
      .visit(`/patient/${ testPatient.id }/flow/${ authoredFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatient')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header-container .js-menu')
      .should('exist');
  });

  specify('flow not authored by a user with work:authored:delete permission', function() {
    const testPatient = getPatient();
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });
    const otherClinician = getClinician();
    const otherAuthoredFlow = getFlow({
      relationships: {
        author: getRelationship(otherClinician),
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
        state: getRelationship(stateInProgress),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlow(fx => {
        fx.data = otherAuthoredFlow;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions()
      .visit(`/patient/${ testPatient.id }/flow/${ otherAuthoredFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatient')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header-container .js-menu')
      .should('not.exist');
  });

  specify('flow progress bar', function() {
    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateInProgress),
          },
          meta: {
            progress: {
              complete: 0,
              total: 3,
            },
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            state: getRelationship(stateTodo),
            flow: getRelationship(testFlow),
          },
        }, { sample: 3 });

        return fx;
      })
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction')
      .intercept('DELETE', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteAction')
      .routeAction(fx => {
        fx.data = getAction({
          relationships: {
            state: getRelationship(stateDone),
          },
        });

        return fx;
      })
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 0)
      .should('have.attr', 'max', '3');

    cy
      .get('.action-card')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 1);

    cy
      .get('.action-card')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('To Do')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 0);

    cy
      .get('.action-card')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 0);

    cy
      .get('.action-card')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.action-card')
      .last()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 2);

    cy
      .get('.action-card')
      .last()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Unable to Complete')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 2);
  });

  specify('completing a flow when all actions are done', function() {
    const testPatient = getPatient();
    const completableFlow = getFlow({
      meta: {
        progress: {
          complete: 2,
          total: 2,
        },
      },
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateInProgress),
      },
    });

    cy
      .routeFlow(fx => {
        fx.data = completableFlow;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            state: getRelationship(stateDone),
            flow: getRelationship(completableFlow),
          },
        }, { sample: 2 });

        return fx;
      })
      .intercept('PATCH', `/api/flows/${ completableFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchCompletableFlow')
      .visit(`/patient/${ testPatient.id }/flow/${ completableFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatient')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region] [data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .wait('@routePatchCompletableFlow')
      .its('request.body.data.relationships.state.data.id')
      .should('equal', stateDone.id);
  });

  specify('requiring all actions to be done before completing a flow', function() {
    const testPatient = getPatient();
    const incompleteFlow = getFlow({
      meta: {
        progress: {
          complete: 0,
          total: 1,
        },
      },
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateInProgress),
      },
    });

    cy
      .routeSettings('require_done_flow', true)
      .routeFlow(fx => {
        fx.data = incompleteFlow;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            state: getRelationship(stateTodo),
            flow: getRelationship(incompleteFlow),
          },
        }, { sample: 1 });

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/flow/${ incompleteFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatient')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region] [data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Flow Actions Must Be Done')
      .and('contain', 'You must set all actions to a Done state before setting this flow to a Done state.');
  });

  specify('bulk edit actions', function() {
    const testPatient = getPatient();

    const testFlowActions = [
      getAction({
        attributes: {
          name: 'First In List',
          due_date: testDateSubtract(1),
          created_at: testTsSubtract(1),
          sequence: 1,
        },
        relationships: {
          patient: getRelationship(testPatient),
          flow: getRelationship(testFlow),
          state: getRelationship(stateTodo),
          owner: getRelationship(teamNurse),
          form: getRelationship(testForm),
        },
      }),
      getAction({
        attributes: {
          name: 'Third In List',
          due_date: testDateAdd(1),
          created_at: testTsSubtract(3),
          sequence: 3,
        },
        relationships: {
          patient: getRelationship(testPatient),
          flow: getRelationship(testFlow),
          state: getRelationship(stateTodo),
          owner: getRelationship(teamOther),
        },
      }),
      getAction({
        attributes: {
          name: 'Second In List',
          due_date: testDateAdd(2),
          created_at: testTsSubtract(2),
          sequence: 3,
        },
        relationships: {
          patient: getRelationship(testPatient),
          flow: getRelationship(testFlow),
          state: getRelationship(stateInProgress),
          owner: getRelationship(teamOther),
        },
      }),
    ];

    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          attributes: {
            updated_at: testTs(),
          },
          relationships: {
            patient: getRelationship(testPatient),
            state: getRelationship(stateInProgress),
            actions: getRelationship(testFlowActions),
          },
        });

        return fx;
      })
      .routePatientByFlow(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = testFlowActions;

        return fx;
      })
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction')
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .routeActionActivity()
      .routeActionComments()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__list .action-card')
      .first()
      .find('.button.button--checkbox')
      .should('have.attr', 'aria-label', 'Select action');

    cy.viewport(981, 997);

    cy
      .get('.patient-flow__menu')
      .should('be.visible');

    cy.viewport(1280, 720);

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .as('firstRow')
      .find('.js-select')
      .click();

    cy
      .get('@firstRow')
      .should('have.class', 'is-selected');

    cy
      .get('@firstRow')
      .find('.js-select')
      .click();

    cy
      .get('@firstRow')
      .should('not.have.class', 'is-selected');

    cy
      .get('@firstRow')
      .find('.js-select')
      .click();

    cy
      .get('.patient-flow__actions-start > .button.button--checkbox')
      .as('selectAll')
      .click();

    cy
      .get('[data-header-region]')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click();

    cy
      .get('.bulk-edit-inline')
      .should('not.exist');

    cy
      .get('@firstRow')
      .should('not.have.class', 'is-selected');

    cy
      .get('[data-header-region]')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('In Progress')
      .click();

    cy
      .get('@firstRow')
      .should('have.class', 'is-selected');

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar');

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click()
      .wait(['@routePatchAction', '@routePatchAction', '@routePatchAction']);

    cy
      .get('.patient-flow__actions-start > .button.button--checkbox')
      .click();

    cy
      .get('.patient-flow__actions-start > .button.button--checkbox')
      .click();

    cy
      .get('.patient-flow__actions-start > .button.button--checkbox')
      .click();

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('.patient-flow__actions-start > .button.button--checkbox')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .should('contain', 'Multiple States...');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region]')
      .should('contain', 'Multiple Owners...');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region]')
      .should('contain', 'Multiple Dates...');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .should('contain', 'Multiple Times...');

    cy
      .get('@bulkEditToolbar')
      .find('[data-duration-region]')
      .should('contain', 'Multiple Durations...');

    cy
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchFlowOwner');

    cy
      .intercept('PATCH', `/api/actions/${ testFlowActions[0].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchAction1')
      .intercept('PATCH', `/api/actions/${ testFlowActions[1].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchAction2')
      .intercept('PATCH', `/api/actions/${ testFlowActions[2].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchAction3');

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('To Do')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .find('.datepicker__header .js-prev')
      .click();

    cy
      .get('.datepicker')
      .find('li:not(.is-other-month)')
      .first()
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('10:00 AM')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region]')
      .find('.is-overdue');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .find('.is-overdue');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .find('.js-tomorrow')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('@bulkEditToolbar')
      .find('[data-duration-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('5 mins')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-scope-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Actions + flows')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click();

    cy
      .wait('@patchFlowOwner')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchAction1')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.duration).to.equal(5);
        expect(data.attributes.due_time).to.equal('10:00:00');
        expect(data.attributes.due_date).to.equal(tomorrow);
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchAction2')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.duration).to.equal(5);
        expect(data.attributes.due_time).to.equal('10:00:00');
        expect(data.attributes.due_date).to.equal(tomorrow);
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchAction3')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.duration).to.equal(5);
        expect(data.attributes.due_time).to.equal('10:00:00');
        expect(data.attributes.due_date).to.equal(tomorrow);
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .get('.alert-box')
      .should('contain', '3 Actions have been updated');

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .find('.js-select')
      .click();

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 400,
        body: {},
      })
      .as('failedPatchAction');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('10:00 AM')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .find('.js-clear')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click();

    cy
      .get('.alert-box')
      .should('contain', 'Something went wrong. Please try again.');

    cy
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .should('have.length', 3);
  });

  specify('click+shift multiselect', function() {
    cy
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateInProgress),
            owner: getRelationship(getCurrentClinician()),
          },
        });

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            flow: getRelationship(testFlow),
            state: getRelationship(stateTodo),
          },
        }, { sample: 3 });

        return fx;
      })
      .routePatientByFlow()
      .routeActionActivity()
      .visitOnClock(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions')
      .wait('@routeWorkspacePatient');

    cy
      .tick(60) // tick past debounce
      .get('.app-frame__content')
      .find('.action-card')
      .should('have.length', 3);

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .last()
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.action-card.is-selected')
      .should('have.length', 3);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .last()
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.action-card.is-selected')
      .should('have.length', 3);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Actions');
  });

  specify('actions with work:owned:manage permission', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'First In List',
              due_date: testDateAdd(5),
              sequence: 0,
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateTodo),
              owner: getRelationship(getCurrentClinician()),
              form: getRelationship(testForm),
            },
          }),
          getAction({
            attributes: {
              name: 'Last In List',
              due_date: testDateAdd(5),
              sequence: 3,
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateTodo),
              owner: getRelationship(getCurrentClinician()),
            },
          }),
          getAction({
            attributes: {
              due_date: testDateAdd(5),
              due_time: null,
              sequence: 2,
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamCoordinator),
              form: getRelationship(testForm),
            },
          }),
          getAction({
            attributes: {
              name: '',
              due_date: null,
              due_time: null,
              sequence: 1,
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateInProgress),
            owner: getRelationship(getCurrentClinician()),
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchAction');

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .find('button:not(.action-details-tooltip)')
      .should('have.length', 7);

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .find('.action-details-tooltip')
      .should('exist');

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .eq(1)
      .find('button:not(.action-details-tooltip)')
      .should('have.length', 1)
      .and('have.class', 'js-primary');

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .eq(2)
      .find('button:not(.action-details-tooltip)')
      .should('have.length', 2);

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .last()
      .find('button:not(.action-details-tooltip)')
      .should('have.length', 6);

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .last()
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.action-card.is-selected')
      .should('have.length', 2);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Actions');

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click();

    cy
      .get('.alert-box')
      .should('contain', '2 Actions have been updated');
  });

  specify('actions with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = _.first(fx.data, 2);

        fx.data = [currentClinician, nonTeamMemberClinician];

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'Owner by another team',
              sequence: 0,
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamNurse),
              flow: getRelationship(testFlow),
            },
          }),
          getAction({
            attributes: {
              name: 'Owned by non team member',
              sequence: 1,
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(nonTeamMemberClinician),
              flow: getRelationship(testFlow),
            },
          }),
        ];

        return fx;
      })
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateInProgress),
          },
        });

        return fx;
      })
      .routePatientByFlow()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .as('listItems')
      .first()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@listItems')
      .last()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  specify('socket notifications', function() {
    const testSocketFileId = uuid();
    const testComment = getComment();

    const testClinician = getClinician();

    const testSocketFlow = getFlow({
      attributes: {
        name: 'Flow Test',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateInProgress),
        owner: getRelationship(teamNurse),
      },
    });

    const testSocketAction = getAction({
      attributes: {
        name: 'Action Test',
        details: null,
        due_date: testDate(),
        due_time: '06:00:00',
        outreach: 'disabled',
        sharing: 'disabled',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        flow: getRelationship(testSocketFlow),
        state: getRelationship(stateTodo),
        owner: getRelationship(teamOther),
        form: getRelationship(testForm),
        files: getRelationship([]),
        comments: getRelationship([]),
      },
    });

    const testNewSocketAction = getAction({
      attributes: {
        name: 'New Action - Created Elsewhere',
      },
      relationships: {
        flow: getRelationship(testSocketFlow),
        state: getRelationship(stateTodo),
        owner: getRelationship(teamOther),
      },
    });

    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = testSocketFlow;

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = [
          testSocketAction,
        ];

        return fx;
      })
      .routeActionActivity()
      .routeFlowActivity()
      .visitOnClock(`/flow/${ testSocketFlow.id }`, { now: testTs() })
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          actions: { flow: testSocketFlow.id },
        });

        expect(resources).to.deep.equal([
          getRelationship(testSocketFlow).data,
          getRelationship(testSocketAction).data,
        ]);
      });

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        attributes: {
          name: 'New Flow Name',
        },
      },
    });

    cy
      .get('[data-header-region]')
      .find('.patient-flow__name')
      .contains('New Flow Name');

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        attributes: {
          details: 'New flow details',
        },
      },
    });

    cy
      .get('[data-header-region]')
      .find('.patient-flow__details')
      .should('be.visible')
      .contains('New flow details');

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          name: 'New Action Name',
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card')
      .contains('New Action Name');

    cy
      .get('.patient-flow__list')
      .find('.action-card .work-card__meta span:last-child')
      .should('contain', formatDate(testTs(), 'TIME_OR_DAY'));

    cy
      .get('.patient-flow__list')
      .find('.action-card [data-details-region]')
      .should('be.empty');

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          details: 'New action details',
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card [data-details-region]')
      .should('not.be.empty');

    cy.sendWs({
      category: 'ActionDueChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          due_date: testDateAdd(1),
          due_time: '07:00:00',
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card')
      .should($action => {
        expect($action.find('[data-due-date-region]')).to.contain(formatDate(testDateAdd(1), 'SHORT'));
        expect($action.find('[data-due-time-region]')).to.contain('7:00 AM');
      });

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 0);

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        owner: {
          type: teamCoordinator.type,
          id: teamCoordinator.id,
        },
      },
    });

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        owner: {
          type: teamCoordinator.type,
          id: teamCoordinator.id,
        },
      },
    });

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 0);

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        state: {
          type: stateDone.type,
          id: stateDone.id,
        },
      },
    });

    cy
      .get('.patient-flow__progress progress')
      .should('have.value', 1);

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        state: {
          type: stateDone.type,
          id: stateDone.id,
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card')
      .should($action => {
        expect($action.find('.fa-circle-check')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('CO');
      });

    cy
      .get('[data-header-region]')
      .find('[data-state-region] .fa-circle-check');

    cy.sendWs({
      category: 'AttachmentAdded',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        clinician: {
          type: testClinician.type,
          id: testClinician.id,
        },
        file: {
          type: 'files',
          id: testSocketFileId,
        },
        attributes: {
          path: 'patients/1/HRA.pdf',
          bucket: 'bucket_name',
          urls: {
            view: 'https://www.bucket_name.s3.amazonaws.com/patients/1/view/HRA.pdf',
            download: 'https://www.bucket_name.s3.amazonaws.com/patients/1/download/HRA.pdf',
          },
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card .fa-paperclip')
      .should('exist')
      .next()
      .should('contain', '1');

    cy.sendWs({
      category: 'FileRemoved',
      resource: {
        type: 'files',
        id: testSocketFileId,
      },
      payload: {},
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card .fa-paperclip')
      .should('not.exist');

    cy.sendWs({
      category: 'ActionCommentAdded',
      author: getCurrentClinician().id,
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        comment: {
          type: testComment.type,
          id: testComment.id,
        },
        attributes: {
          message: 'New websocket comment.',
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card .fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy.sendWs({
      category: 'CommentRemoved',
      resource: {
        type: testComment.type,
        id: testComment.id,
      },
      payload: {},
    });

    cy
      .get('.patient-flow__list')
      .find('.action-card .fa-comment')
      .should('not.exist');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {},
    });

    cy
      .get('.card-list__empty')
      .contains('No Actions');

    cy
      .routeAction(fx => {
        fx.data = testNewSocketAction;

        return fx;
      });

    cy.sendWs({
      category: 'ResourceCreated',
      resource: {
        type: testNewSocketAction.type,
        id: testNewSocketAction.id,
      },
      payload: {},
    });

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that action
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewSocketAction.type,
        id: testNewSocketAction.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewSocketAction.id);

    // verify the new flow is added to the ws subscription resources
    cy
      .get('@wsHandleMessage')
      .should('have.been.calledTwice')
      .then(stub => {
        const secondCallData = stub.getCall(1).args[0].data;
        const { resources } = secondCallData;

        expect(resources).to.deep.include({
          id: testNewSocketAction.id,
          type: testNewSocketAction.type,
        });
      });

    cy
      .get('.app-frame__content')
      .find('.action-card')
      .first()
      .should('contain', 'New Action - Created Elsewhere')
      .find('[data-state-region] .fa-circle-dot');
  });
});
