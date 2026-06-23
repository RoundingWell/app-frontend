import dayjs from 'dayjs';
import { NIL as NIL_UUID } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getRelationship, mergeJsonApi } from 'helpers/json-api';
import formatDate from 'helpers/format-date';

import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { workspaceOne } from 'support/api/workspaces';
import { testForm } from 'support/api/forms';
import { stateDone, stateInProgress, stateTodo, stateUnableToComplete, stateThmgTransferred } from 'support/api/states';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { getComment } from 'support/api/comments';
import { getFile } from 'support/api/files';

context('patient archive page', function() {
  const currentClinican = getCurrentClinician({
    relationships: {
      role: getRelationship(roleTeamEmployee),
      team: getRelationship(teamCoordinator),
    },
  });

  specify('action, flow and events list', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();

    const testPatient = getPatient({
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testActions = [
      getAction({
        attributes: {
          name: 'First In List',
          details: 'Action details content.',
          duration: 0,
          due_date: null,
          due_time: null,
          updated_at: testTs(),
          options: {
            icon: 'caret-down',
            iconType: 'fas',
            color: 'red',
          },
        },
        relationships: {
          owner: getRelationship(currentClinican),
          patient: getRelationship(testPatient),
          state: getRelationship(stateDone),
          form: getRelationship(testForm),
          files: getRelationship([getFile()]),
          comments: getRelationship([getComment()]),
        },
      }),
      getAction({
        attributes: {
          name: 'Not In List',
          updated_at: testTsSubtract(6),
        },
        relationships: {
          state: getRelationship(stateInProgress),
          patient: getRelationship(testPatient),
        },
      }),
      getAction({
        attributes: {
          name: 'Third In List',
          details: null,
          updated_at: testTsSubtract(2),
          outreach: 'patient',
          due_time: '09:00:00',
          due_date: testDateSubtract(2),
        },
        relationships: {
          state: getRelationship(stateDone),
          patient: getRelationship(testPatient),
        },
      }),
    ];

    const testFlows = [
      getFlow({
        attributes: {
          name: 'Second In List',
          updated_at: testTsSubtract(1),
        },
        relationships: {
          state: getRelationship(stateDone),
          patient: getRelationship(testPatient),
        },
      }),
      getFlow({
        attributes: {
          name: 'Last In List',
          updated_at: testTsSubtract(6),
        },
        relationships: {
          state: getRelationship(stateDone),
          patient: getRelationship(testPatient),
        },
      }),
      getFlow({
        attributes: {
          name: 'Not In List',
          updated_at: testTsSubtract(6),
        },
        relationships: {
          state: getRelationship(stateInProgress),
          patient: getRelationship(testPatient),
        },
      }),
    ];

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = testActions;

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = testFlows;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testActions[0];

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormActionFields()
      .visitOnClock(`/patient/archive/${ testPatient.id }`, { now: testTime, functionNames: ['Date'] })
      .wait('@routePatient')
      .wait('@routePatientFlows');

    cy
      .wait('@routePatientActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateDone.id },${ stateUnableToComplete.id },${ stateThmgTransferred.id }`);

    // Filters only done id 55555
    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .should('have.lengthOf', 4);

    cy
      .intercept('PATCH', `/api/actions/${ testActions[0].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .intercept('PATCH', `/api/flows/${ testFlows[1].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .should('contain', 'First In List')
      .find('.table-list__icon--large')
      .find('.action-icon--red .fa-caret-down');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(1)
      .should('contain', 'Second In List');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .should('contain', 'Third In List')
      .find('.table-list__icon--large')
      .find('.fa-share-from-square');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .last()
      .should('contain', 'Last In List');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Action details content.');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-due-date-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-due-time-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .find('.fa-paperclip')
      .should('not.exist');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .find('.fa-comment')
      .should('not.exist');

    cy
      .get('.list-page__list')
      .should('contain', 'Second In List')
      .find('.patient__flow-icon');

    cy
      .get('.list-page__list')
      .contains('First In List')
      .click();

    cy
      .get('.list-page__list')
      .find('.is-selected')
      .find('[data-owner-region] button')
      .should('contain', 'Clinician McTester')
      .should('be.disabled');

    cy
      .get('.list-page__list')
      .find('.is-selected')
      .find('[data-due-date-region] button')
      .should('be.disabled');

    cy
      .get('.list-page__list')
      .find('.is-selected')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('.list-page__list')
      .find('.is-selected')
      .find('[data-state-region]')
      .find('.fa-circle-check')
      .click();

    cy
      .get('.picklist', { timeout: 10000 })
      .contains('In Progress')
      .click()
      .tick(800); // the length of the animation

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateInProgress.id);
      });

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .should('have.lengthOf', 3);

    cy
      .get('.sidebar')
      .find('.fa-circle-dot')
      .click();

    cy
      .get('.picklist', { timeout: 10000 })
      .contains('To Do')
      .click();

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .should('have.lengthOf', 3);

    cy
      .get('.sidebar')
      .contains('To Do')
      .click();

    cy
      .get('.picklist', { timeout: 10000 })
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .should('have.lengthOf', 4);

    cy
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .last()
      .as('flowItem');

    cy
      .get('@flowItem')
      .click('top')
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .url()
      .should('contain', `flow/${ testFlows[1].id }`);

    cy
      .go('back');

    cy
      .get('@flowItem')
      .find('.fa-circle-check')
      .click();

    cy
      .get('.picklist', { timeout: 10000 })
      .contains('To Do')
      .click()
      .tick(800); // the length of the animation

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
      });

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .should('have.lengthOf', 3);

    cy
      .get('.table-list__item')
      .first()
      .next()
      .next()
      .find('[data-form-region]')
      .should('be.empty');

    cy
      .get('.table-list__item')
      .first()
      .find('.fa-paperclip')
      .should('exist');

    cy
      .get('.table-list__item')
      .first()
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy
      .get('.table-list__item')
      .first()
      .find('[data-form-region]')
      .click();

    cy
      .url()
      .should('contain', `patient-action/${ testActions[0].id }/form/${ testForm.id }`);
  });

  specify('flow list - socket notifications', function() {
    const testDateTime = testTs();

    const testPatient = getPatient({
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testSocketFlow = getFlow({
      attributes: {
        name: 'Test Flow - Subscribed on Page Load',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - Created Elsewhere',
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewStateSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - State Updated to Match Current Filter',
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
      meta: {
        progress: {
          complete: 0,
          total: 2,
        },
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [testSocketFlow];

        return fx;
      })
      .visitOnClock(`/patient/archive/${ testPatient.id }`, { now: testDateTime })
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routeWorkspacePatient')
      .wait('@routePatientFlows');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const patient = testPatient.id;
        const states = [stateDone.id, stateUnableToComplete.id, stateThmgTransferred.id].join();

        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          actions: { states, patient, flow: NIL_UUID },
          flows: { states, patient },
        });

        expect(resources).to.deep.equal([
          getRelationship(testSocketFlow).data,
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
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.patient__action-ts')
      .should('contain', formatDate(testDateTime, 'TIME_OR_DAY'));

    // state was set to be not done, which means it's removed from the list
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    // wait for fade-out animation to completely finish
    cy.tick(1000);

    cy
      .get('.table-list__empty-list')
      .should('contain', 'No Archive');

    cy
      .routeFlow(fx => {
        fx.data = testNewSocketFlow;

        return fx;
      });

    cy.sendWs({
      category: 'ResourceCreated',
      resource: {
        type: testNewSocketFlow.type,
        id: testNewSocketFlow.id,
      },
      payload: {},
    });

    cy
      .wait('@routeFlow')
      .its('request.url')
      .should('contain', testNewSocketFlow.id);

    // verify the new flow is added to the ws subscription resources
    cy
      .get('@wsHandleMessage')
      .should('have.been.calledTwice')
      .then(stub => {
        const secondCallData = stub.getCall(1).args[0].data;
        const { resources } = secondCallData;

        expect(resources).to.deep.include({
          id: testNewSocketFlow.id,
          type: testNewSocketFlow.type,
        });
      });

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - Created Elsewhere');

    cy
      .routeFlow(fx => {
        fx.data = testNewStateSocketFlow;

        return fx;
      });

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that flow
    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .wait('@routeFlow')
      .its('request.url')
      .should('contain', testNewStateSocketFlow.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - State Updated to Match Current Filter');

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    // ensures we subscribe correctly to models added to the worklist via ws
    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('@firstRow')
      .should('contain', 'New Name Via Websocket');

    cy.sendWs({
      category: 'FlowProgressChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        attributes: {
          progress: {
            complete: 1,
            total: 3,
          },
        },
      },
    });

    cy
      .get('@firstRow')
      .find('.patient__flow-progress')
      .should('have.value', 1)
      .should('have.attr', 'max', 3);

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {},
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .should('have.length', 1);
  });

  specify('action list - socket notifications', function() {
    const testDateTime = testTs();

    const testPatient = getPatient({
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testSocketAction = getAction({
      attributes: {
        name: 'Test Action - Subscribed on Page Load',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewSocketAction = getAction({
      attributes: {
        name: 'New Action - Created Elsewhere',
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewStateSocketAction = getAction({
      attributes: {
        name: 'New Action - State Updated to Match Current Filter',
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testSocketAction];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .visitOnClock(`/patient/archive/${ testPatient.id }`, { now: testDateTime })
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const patient = testPatient.id;
        const states = [stateDone.id, stateUnableToComplete.id, stateThmgTransferred.id].join();

        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          actions: { states, patient, flow: NIL_UUID },
          flows: { states, patient },
        });

        expect(resources).to.deep.equal([
          getRelationship(testSocketAction).data,
        ]);
      });

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.patient__action-ts')
      .should('contain', formatDate(testDateTime, 'TIME_OR_DAY'));

    // state was set to done, which means it's removed from the list
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    // wait for fade-out animation to completely finish
    cy.tick(1000);

    cy
      .get('.table-list__empty-list')
      .should('contain', 'No Archive');

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

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewSocketAction.id);

    // verify the new action is added to the ws subscription resources
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
      .get('@firstRow')
      .should('contain', 'New Action - Created Elsewhere');

    cy
      .routeAction(fx => {
        fx.data = testNewStateSocketAction;

        return fx;
      });

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that flow
    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewStateSocketAction.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Action - State Updated to Match Current Filter');

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    // ensures we subscribe correctly to models added to the worklist via ws
    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('@firstRow')
      .should('contain', 'New Name Via Websocket');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {},
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .should('have.length', 1);
  });

  specify('work with work:owned:manage permission', function() {
    const testPatient = getPatient({
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = mergeJsonApi(currentClinican, {
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });

        return fx;
      })
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'First In List',
              details: null,
              duration: 0,
              due_date: null,
              due_time: null,
              updated_at: testTs(),
            },
            relationships: {
              owner: getRelationship(currentClinican),
              state: getRelationship(stateDone),
              form: getRelationship(testForm),
              files: getRelationship([getFile()]),
            },
          }),
          getAction({
            attributes: {
              name: 'Third In List',
              updated_at: testTsSubtract(2),
              due_time: '09:00:00',
              due_date: testDateSubtract(2),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              name: 'Second In List',
              updated_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(currentClinican),
            },
          }),
          getFlow({
            attributes: {
              name: 'Last In List',
              updated_at: testTsSubtract(6),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .visit(`/patient/archive/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('[data-state-region]')
      .find('button');

    cy
      .get('@listItems')
      .eq(1)
      .find('[data-state-region]')
      .find('button');

    cy
      .get('@listItems')
      .eq(2)
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@listItems')
      .eq(3)
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');
  });

  specify('work with work:team:manage permission', function() {
    const nonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

    const testPatient = getPatient({
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinican, nonTeamMemberClinician];

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'Owned by another team',
              updated_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(teamNurse),
            },
          }),
          getAction({
            attributes: {
              name: 'Owned by non team member',
              updated_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(nonTeamMemberClinician),
            },
          }),
        ];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/archive/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@listItems')
      .last()
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');
  });
});
