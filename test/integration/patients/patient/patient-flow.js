import _ from 'underscore';
import dayjs from 'dayjs';

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

const tomorrow = testDateAdd(1);

context('patient flow page', function() {
  const testFlow = getFlow({
    attributes: {
      name: 'Test Flow',
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
      .routesForPatientDashboard();
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
      .routePatientByFlow()
      .routeFlowActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.table-list')
      .find('.table-list__item')
      .first()
      .click('top')
      .wait('@routeFlow')
      .wait('@routePatientByFlow');

    cy
      .get('.patient-flow__context-trail')
      .should('contain', 'Test Flow')
      .contains('Test Patient')
      .click();

    cy
      .url()
      .should('contain', `/patient/dashboard/${ testPatient.id }`);

    cy
      .go('back');

    cy
      .get('.patient-flow__context-trail')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', '/worklist/owned-by');
  });

  specify('patient flow action sidebar', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testFlowAction = getAction({
      attributes: {
        name: 'Test Action',
        duration: 10,
        outreach: 'disabled',
        sharing: 'disabled',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        flow: getRelationship(testFlow),
        state: getRelationship(stateTodo),
        owner: getRelationship(teamNurse),
        form: getRelationship(testForm),
        patient: getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = mergeJsonApi(testFlow, {
          relationships: {
            state: getRelationship(stateTodo),
          },
        });

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [testFlowAction];

        return fx;
      })
      .routePatientByFlow(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeActionActivity()
      .visit(`/flow/${ testFlow.id }/action/${ testFlowAction.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions')
      .wait('@routeActionActivity')
      .wait('@routeActionComments')
      .wait('@routeActionFiles');

    cy
      .get('.sidebar')
      .find('[data-action-region] .action-sidebar__name')
      .should('contain', 'Test Action');

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: 'patient-actions',
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          name: 'New Websocket Name',
        },
      },
    });

    cy
      .get('.sidebar')
      .find('[data-action-region] .action-sidebar__name')
      .should('contain', 'New Websocket Name');

    cy
      .get('.sidebar')
      .find('.sidebar__footer')
      .contains('Updated')
      .next()
      .should('contain', formatDate(dayjs.utc().format(), 'AT_TIME'));

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .clear()
      .type('User manually added details.');

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: 'patient-actions',
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          details: 'New websocket details.',
        },
      },
    });

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .should('have.value', 'User manually added details.');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Cancel')
      .click();

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: 'patient-actions',
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          details: 'New websocket details.',
        },
      },
    });

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .should('have.value', 'New websocket details.');

    cy.sendWs({
      category: 'ActionDurationChanged',
      resource: {
        type: 'patient-actions',
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          duration: 20,
        },
      },
    });

    cy
      .get('.sidebar')
      .find('[data-duration-region]')
      .should('contain', '20 mins');

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
      .should('be.empty');

    cy.sendWs({
      category: 'SharingUpdated',
      resource: {
        type: 'patient-actions',
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          sharing: 'enabled',
          outreach: 'patient',
        },
      },
    });

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
      .find('.action-sidebar__sharing-state')
      .should('contain', 'Waiting for Response');

    cy.sendWs({
      category: 'SharingUpdated',
      resource: {
        type: 'patient-actions',
        id: testFlowAction.id,
      },
      payload: {
        attributes: {
          sharing: 'responded',
          outreach: 'patient',
        },
      },
    });

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
      .find('.action-sidebar__sharing-state')
      .should('contain', 'Response Saved');
  });

  specify('done patient flow action sidebar', function() {
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
      .routeFlowActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routePatientByFlow()
      .routeActionActivity()
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.sidebar')
      .find('[data-action-region] .sidebar__label')
      .should('not.contain', 'Permissions');
  });

  specify('flow actions list', function() {
    const testListAction = mergeJsonApi(testAction, {
      attributes: {
        name: 'Third In List',
        due_date: testDateAdd(1),
        created_at: testTsSubtract(3),
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
              due_date: testDateSubtract(1),
              created_at: testTsSubtract(1),
              sequence: 1,
              outreach: 'patient',
              sharing: 'sent',
            },
            relationships: {
              flow: getRelationship(testFlow),
              state: getRelationship(stateTodo),
              owner: getRelationship(teamNurse),
              form: getRelationship(testForm),
              files: getRelationship([{ id: '1' }], 'files'),
            },
          }),
          testListAction,
          getAction({
            attributes: {
              name: 'Second In List',
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__list')
      .as('actionsList')
      .find('.table-list__item')
      .should('have.length', 3);

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .first()
      .should($action => {
        expect($action.find('.fa-circle-exclamation')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('NUR');
        expect($action.find('[data-due-date-region] .is-overdue')).to.exist;
        expect($action.find('[data-form-region]')).not.to.be.empty;
        expect($action.find('.fa-paperclip')).to.exist;
      });

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .first()
      .next()
      .should($action => {
        expect($action.find('.fa-circle-dot')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('OT');
        expect($action.find('.fa-paperclip')).to.not.exist;
      });

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .last()
      .should($action => {
        expect($action.find('.fa-circle-check')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('OT');
        expect($action.find('[data-owner-region] button')).to.be.disabled;
        expect($action.find('[data-due-date-region] button')).to.be.disabled;
        expect($action.find('[data-due-time-region] button')).to.be.disabled;
      })
      .find('.fa-circle-check')
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
      .find('.table-list__item')
      .last()
      .as('lastAction')
      .should($action => {
        expect($action.find('.fa-circle-dot')).to.exist;
        expect($action.find('[data-owner-region] button')).not.to.be.disabled;
        expect($action.find('[data-due-date-region] button')).not.to.be.disabled;
        expect($action.find('[data-due-time-region] button')).not.to.be.disabled;
      })
      // Trigger the click on the table-list__item clicks the owner button
      .find('.patient__action-icon')
      .click();

    cy
      .get('@lastAction')
      .should('have.class', 'is-selected')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click()
      .wait('@routePatchAction');

    cy
      .get('@lastAction')
      .find('[data-owner-region]')
      .contains('NUR');

    cy
      .get('@lastAction')
      .find('[data-due-date-region]')
      .click();

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
          .get('.sidebar')
          .find('[data-due-date-region]')
          .should('contain', `${ dueMonth } ${ dueDay }`);
      });

    cy
      .get('@lastAction')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('11:15 AM')
      .click();

    cy
      .get('@lastAction')
      .find('[data-due-time-region]')
      .should('contain', '11:15 AM');

    cy
      .intercept('DELETE', `/api/actions/${ testListAction.id }`, {
        statusCode: 403,
        body: {
          errors: getErrors({
            status: 403,
            title: 'Forbidden',
            detail: 'Insufficient permissions to delete action',
          }),
        },
      })
      .as('routeDeleteFlowActionFailure');

    cy
      .get('.sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Action')
      .click()
      .wait('@routeDeleteFlowActionFailure');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete action');


    cy
      .intercept('DELETE', `/api/actions/${ testListAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlowAction');

    cy
      .get('.sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Action')
      .click()
      .wait('@routeDeleteFlowAction');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .should('have.length', 2);
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
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

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
      .intercept('POST', '/api/flows/**/relationships/actions', {
        statusCode: 201,
        body: {
          data: conditionalAction,
        },
      })
      .as('routePostAction');

    cy
      .get('.patient-flow__actions')
      .contains('Add')
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
      .should('not.contain', 'Draft');

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
      });

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }/action/${ conditionalAction.id }`);

    cy
      .get('[data-content-region]')
      .find('.is-selected')
      .contains('Conditional');

    const otherAction = getAction({
      attributes: {
        name: 'Socket Action',
      },
      relationships: {
        'flow': getRelationship(testFlow),
      },
    });

    cy
      .routeAction(fx => {
        fx.data = otherAction;

        return fx;
      });

    cy.sendWs({
      category: 'ResourceCreated',
      resource: {
        type: 'flows',
        id: testFlow.id,
      },
      payload: {
        resource: {
          type: 'patient-actions',
          id: otherAction.id,
        },
      },
    });

    cy.wait('@routeAction');

    cy
      .get('[data-content-region]')
      .find('.is-selected')
      .next()
      .contains('Socket Action');
  });

  specify('failed flow', function() {
    const errors = getErrors({
      status: '410',
      title: 'Not Found',
      detail: 'Cannot find flow',
    });

    cy
      .routesForPatientAction()
      .routePatientByFlow()
      .routeFlowActions()
      .intercept('GET', `/api/flows/${ testFlow.id }**`, {
        statusCode: 410,
        body: { errors },
      })
      .visit(`/flow/${ testFlow.id }`);

    cy
      .url()
      .should('contain', '/404');
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__empty-list')
      .contains('No Actions');
  });

  specify('flow owner assignment', function() {
    cy
      .routeWorkspaceClinicians(fx => {
        const currentClinician = getCurrentClinician();
        const otherClinician = getClinician({
          id: '22222',
          attributes: {
            name: 'Other Clinician',
          },
        });

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
              owner: getRelationship('22222', 'clinicians'),
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__list')
      .as('actionsList');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .first()
      .find('[data-owner-region]')
      .should('contain', 'NUR');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .should('contain', 'Other');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .eq(2)
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('@actionsList')
      .find('.table-list__item')
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
        expect(data.relationships.owner.data.id).to.equal('11111');
        expect(data.relationships.owner.data.type).to.equal('clinicians');
      });

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .first()
      .find('[data-owner-region]')
      .should('contain', 'McTester');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .should('contain', 'Other');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .eq(2)
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('@actionsList')
      .find('.table-list__item')
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
      .find('.table-list__item')
      .first()
      .find('[data-owner-region]')
      .should('contain', 'McTester');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .should('contain', 'Other');

    cy
      .get('@actionsList')
      .find('.table-list__item')
      .eq(2)
      .find('[data-owner-region]')
      .should('contain', 'CO');

    cy
      .get('@actionsList')
      .find('.table-list__item')
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .should('contain', 'NU')
      .find('button')
      .should('not.exist');
  });

  specify('flow with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      id: '22222',
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
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('.patient__action-name')
      .click()
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .go('back');

    cy
      .routeFlow(fx => {
        fx.data = getFlow({
          attributes: {
            name: 'Owned by non team member',
            updated_at: testTsSubtract(2),
          },
          relationships: {
            state: getRelationship(stateInProgress),
            owner: getRelationship('22222', 'clinicians'),
          },
        });

        return fx;
      });

    cy
      .get('@listItems')
      .last()
      .find('.patient__action-name')
      .click()
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .find('button')
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__progress')
      .should('have.value', 0)
      .should('have.attr', 'max', '3');

    cy
      .get('.table-list__item')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.patient-flow__progress')
      .should('have.value', 1);

    cy
      .get('.table-list__item')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('To Do')
      .click();

    cy
      .get('.patient-flow__progress')
      .should('have.value', 0);

    cy
      .get('.table-list__item')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click();

    cy
      .get('.patient-flow__progress')
      .should('have.value', 0);

    cy
      .get('.table-list__item')
      .first()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.table-list__item')
      .last()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.patient-flow__progress')
      .should('have.value', 2);

    cy
      .get('.table-list__item')
      .last()
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Unable to Complete')
      .click();

    cy
      .get('.patient-flow__progress')
      .should('have.value', 2);

    cy
      .get('.table-list__item')
      .first()
      .click('top');

    cy
      .get('.sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Delete Action')
      .click();

    cy
      .get('.patient-flow__progress')
      .should('have.value', 1)
      .and('have.attr', 'max', '2');
  });

  specify('bulk edit actions', function() {
    const testFlowActions = [
      getAction({
        attributes: {
          name: 'First In List',
          due_date: testDateSubtract(1),
          created_at: testTsSubtract(1),
          sequence: 1,
        },
        relationships: {
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
            state: getRelationship(stateInProgress),
            actions: getRelationship(testFlowActions),
          },
        });

        return fx;
      })
      .routePatientByFlow()
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
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
      .routeAction(fx => {
        fx.data = testFlowActions[0];

        return fx;
      });

    cy
      .get('@firstRow')
      .find('.patient__action-icon')
      .click();

    cy
      .get('@firstRow')
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
      .get('[data-app-sidebar-region]')
      .find('.js-close')
      .click();

    cy
      .get('@firstRow')
      .should('have.class', 'is-selected');

    cy
      .get('[data-header-region]')
      .next()
      .find('.button--checkbox')
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
      .get('[data-header-region]')
      .next()
      .find('.js-bulk-edit')
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
      .get('[data-header-region]')
      .next()
      .find('.js-bulk-edit')
      .click();

    cy
      .get('.modal--sidebar')
      .as('bulkEditSidebar')
      .find('.js-submit')
      .click()
      .wait(['@routePatchAction', '@routePatchAction', '@routePatchAction']);

    cy
      .get('[data-header-region]')
      .next()
      .find('.button--checkbox')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.button--checkbox')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.button--checkbox')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.js-cancel')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.button--checkbox')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.js-bulk-edit')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('.sidebar__heading')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('@bulkEditSidebar')
      .find('[data-state-region]')
      .should('contain', 'Multiple States...');

    cy
      .get('@bulkEditSidebar')
      .find('[data-owner-region]')
      .should('contain', 'Multiple Owners...');

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-date-region]')
      .should('contain', 'Multiple Dates...');

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-time-region]')
      .should('contain', 'Multiple Times...');

    cy
      .get('@bulkEditSidebar')
      .find('[data-duration-region]')
      .should('contain', 'Multiple Durations...');

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
      .get('@bulkEditSidebar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('To Do')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-date-region]')
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
      .get('@bulkEditSidebar')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('10:00 AM')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-date-region]')
      .find('.is-overdue');

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-time-region]')
      .find('.is-overdue');

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .find('.js-tomorrow')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-date-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-time-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('@bulkEditSidebar')
      .find('[data-duration-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('5 mins')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('.js-submit')
      .click();

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
      .get('.table-list')
      .find('.table-list__item .js-select')
      .click({ multiple: true });

    cy
      .get('.table-list')
      .find('.table-list__item .js-select')
      .last()
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.js-bulk-edit')
      .click();

    cy
      .intercept('DELETE', '/api/actions/*', {
        statusCode: 204,
        body: {},
      });

    cy
      .get('.modal--sidebar')
      .find('.modal__header--sidebar')
      .should('contain', 'Edit 2 Actions')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Actions')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Delete Actions?')
      .should('contain', 'Are you sure you want to delete the selected Actions? This cannot be undone.')
      .find('.js-submit')
      .click();

    cy
      .get('.alert-box')
      .should('contain', '2 Actions have been deleted');

    cy
      .get('.modal--small')
      .should('not.exist');

    cy
      .get('.modal--sidebar')
      .should('not.exist');

    cy
      .get('[data-header-region]')
      .next()
      .find('.js-bulk-edit')
      .should('not.exist');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .should('have.length', 1)
      .first()
      .find('.js-select')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.js-bulk-edit')
      .click();

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 404,
        body: {},
      })
      .as('failedPatchAction');

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('10:00 AM')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .find('.js-clear')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('.js-submit')
      .click();

    cy
      .get('.alert-box')
      .should('contain', 'Something went wrong. Please try again.');
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions')
      .wait('@routeWorkspacePatient');

    cy
      .tick(60) // tick past debounce
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('.patient-flow__actions')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('.patient-flow__actions')
      .find('.js-cancel')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('.patient-flow__actions')
      .find('.js-bulk-edit')
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchAction');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('button')
      .should('have.length', 6);

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .eq(1)
      .find('button')
      .should('have.length', 0);

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .eq(2)
      .find('button')
      .should('have.length', 1);

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('button')
      .should('have.length', 5);

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 2);

    cy
      .get('.patient-flow__actions')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 2 Actions')
      .click();

    cy
      .get('.modal--sidebar')
      .as('bulkEditSidebar')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@bulkEditSidebar')
      .find('.js-submit')
      .click();

    cy
      .get('[data-header-region]')
      .next()
      .find('.button--checkbox:disabled');

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
      id: '22222',
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
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
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions')
      .interceptWs('Subscribe')
      .its('resources')
      .should('deep.equal', [
        getRelationship(testSocketFlow).data,
        getRelationship(testSocketAction).data,
      ]);

    cy
      .get('[data-header-region]')
      .click('top')
      .tick(300);

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: 'flows',
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

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar')
      .find('[data-name-region]')
      .should('contain', 'New Flow Name');

    cy
      .get('.app-frame__sidebar')
      .find('.sidebar__footer')
      .contains('Updated')
      .next()
      .should('contain', formatDate(testTs(), 'AT_TIME'));

    cy
      .get('.app-frame__sidebar')
      .find('.js-close')
      .click();

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: 'flows',
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
      .contains('New flow details');

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: 'patient-actions',
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
      .find('.table-list__item .patient__action-name')
      .contains('New Action Name');

    cy
      .get('.patient-flow__list')
      .find('.table-list__item .patient__action-ts')
      .should('contain', formatDate(testTs(), 'TIME_OR_DAY'));

    cy.sendWs({
      category: 'ActionDueChanged',
      resource: {
        type: 'patient-actions',
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
      .find('.table-list__item')
      .should($action => {
        expect($action.find('[data-due-date-region]')).to.contain(formatDate(testDateAdd(1), 'SHORT'));
        expect($action.find('[data-due-time-region]')).to.contain('7:00 AM');
      });

    cy
      .get('.patient-flow__list')
      .find('.table-list__item .patient__action-icon')
      .find('.fa-file-lines');

    cy.sendWs({
      category: 'SharingUpdated',
      resource: {
        type: 'patient-actions',
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          sharing: 'pending',
          outreach: 'patient',
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.table-list__item .patient__action-icon')
      .find('.fa-share-from-square');

    cy
      .get('.patient-flow__progress')
      .should('have.value', 0);

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: 'patient-actions',
        id: testSocketAction.id,
      },
      payload: {
        owner: {
          type: 'teams',
          id: teamCoordinator.id,
        },
      },
    });

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: 'flows',
        id: testSocketFlow.id,
      },
      payload: {
        owner: {
          type: 'teams',
          id: teamCoordinator.id,
        },
      },
    });

    cy
      .get('.patient-flow__progress')
      .should('have.value', 0);

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: 'patient-actions',
        id: testSocketAction.id,
      },
      payload: {
        state: {
          type: 'states',
          id: stateDone.id,
        },
      },
    });

    cy
      .get('.patient-flow__progress')
      .should('have.value', 1);

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: 'flows',
        id: testSocketFlow.id,
      },
      payload: {
        state: {
          type: 'states',
          id: stateDone.id,
        },
      },
    });

    cy
      .get('.patient-flow__list')
      .find('.table-list__item')
      .should($action => {
        expect($action.find('.fa-circle-check')).to.exist;
        expect($action.find('[data-owner-region]')).to.contain('CO');
      });

    cy
      .get('[data-header-region]')
      .find('[data-owner-region]')
      .contains('CO');

    cy
      .get('[data-header-region]')
      .find('[data-state-region] .fa-circle-check');
  });
});
