import _ from 'underscore';
import { createTestScope } from '@mnjs/test/scope';
import dayjs from 'dayjs';
import { v7 as uuid, NIL as NIL_UUID } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateAdd, testDateSubtract } from 'helpers/test-date';
import { getRelationship, mergeJsonApi } from 'helpers/json-api';
import formatDate from 'helpers/format-date';
import { createResponseGate, trackInteractionRequests, drainInteractionRequests, observeInteractionMessage } from 'helpers/interaction-requests';

import { getAction, longActionName } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api/program-actions';
import { getProgramFlow } from 'support/api/program-flows';
import { teamCoordinator, teamNurse, teamOther } from 'support/api/teams';
import { stateTodo, stateInProgress, stateDone } from 'support/api/states';
import { testForm } from 'support/api/forms';
import { workspaceOne } from 'support/api/workspaces';
import { roleEmployee, roleAdmin, roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { getComment } from 'support/api/comments';
import { getFile } from 'support/api/files';
import { getInteraction, getPage } from 'support/api/interactions';

context('patient workflow page', function() {
  const testPatient = getPatient();
  let cleanupNativeHistory;

  afterEach(function() {
    const cleanup = cleanupNativeHistory;
    cleanupNativeHistory = undefined;
    return cleanup?.();
  });

  specify('shows the workflow loading state', function() {
    const delayedResponse = {
      delay: 30000,
      body: { data: [], included: [] },
    };

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .intercept('GET', '/api/programs', delayedResponse)
      .as('routeDelayedPrograms')
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .intercept('GET', '/api/patients/**/actions*', delayedResponse)
      .as('routeDelayedPatientActions')
      .intercept('GET', '/api/patients/**/flows*', delayedResponse)
      .as('routeDelayedPatientFlows');

    cy
      .get('.workflow-page__actions .add-workflow__button')
      .should('have.class', 'js-loading')
      .and('contain', 'Loading...')
      .find('.fa-circle-plus')
      .should('exist');

    cy
      .get('.js-workflow-closed')
      .click();

    cy
      .get('.workflow-page__loader')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true')
      .and('have.attr', 'role', 'status');
  });

  function createActionPostRoute(name) {
    const actionData = getAction({
      attributes: {
        name,
        updated_at: testTs(),
        due_time: null,
      },
      relationships: {
        author: getRelationship(getCurrentClinician()),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .intercept('POST', '/api/actions', {
        statusCode: 201,
        body: {
          data: actionData,
        },
      })
      .as('routePostAction');

    cy.routeAction(fx => {
      fx.data = actionData;
      return fx;
    });

    return actionData.id;
  }

  specify('action and flow list', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();

    const testAction = getAction({
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
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
        form: getRelationship(testForm),
        files: getRelationship([getFile()]),
        comments: getRelationship([getComment()]),
      },
    });

    const testFlow = getFlow({
      attributes: {
        name: 'Last In List',
        updated_at: testTsSubtract(5),
      },
      relationships: {
        state: getRelationship(stateInProgress),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const doneFlow = getFlow({
      attributes: {
        name: 'Done Flow',
        updated_at: testTsSubtract(5),
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = mergeJsonApi(testPatient, {
          relationships: {
            workspaces: getRelationship(workspaceOne),
          },
        });

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          testAction,
          getAction({
            attributes: {
              name: longActionName,
              details: 'Long action details.',
              updated_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
          }),
          getAction({
            attributes: {
              details: null,
              name: 'Third In List',
              updated_at: testTsSubtract(3),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
          }),
          getAction({
            attributes: {
              name: 'Done Action',
              updated_at: testTsSubtract(5),
            },
            relationships: {
              state: getRelationship(stateDone),
              patient: getRelationship(testPatient),
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
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
            meta: {
              progress: {
                complete: 1,
                total: 4,
              },
            },
          }),
          testFlow,
          doneFlow,
        ];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .visitOnClock(`/patient/${ testPatient.id }/workflow`, { now: testTime, functionNames: ['Date'] })
      .wait('@routePatient')
      .wait('@routePatientFlows');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`);

    cy
      .wait('@routePatientActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

    // Filters out done id 55555
    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .should('have.lengthOf', 5);

    cy
      .get('.workflow-page__list .flow-card')
      .first()
      .then($item => {
        const chips = $item.find('.flow-card__controls')[0];
        const progressSummary = $item.find('.patient-list__flow-progress')[0];
        const dates = $item.find('.work-card__timestamps')[0];

        expect(progressSummary.parentElement).to.equal(chips);
        expect(dates.parentElement).to.have.class('work-card__meta');
      });

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .intercept('PATCH', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .intercept('PATCH', `/api/flows/${ doneFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchDoneFlow');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .first()
      .should('contain', 'First In List')
      .find('.work-card__state[data-state-region]')
      .find('.fa-circle-exclamation');

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .first()
      .should('contain', 'Second In List')
      .and('contain', '1 / 4 Actions')
      .find('.work-card__state[data-state-region]')
      .should('not.be.empty');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .eq(1)
      .should('contain', longActionName);

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .eq(2)
      .should('contain', 'Third In List');

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .last()
      .should('contain', 'Last In List');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Action details content.');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .eq(2)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .first()
      .should($item => {
        const identity = $item.find('.work-card__heading')[0];
        const form = $item.find('[data-form-region]')[0];
        const secondaryChildren = [...$item.find('.work-card__meta')[0].children];
        const dates = $item.find('.work-card__timestamps')[0];
        const counts = $item.find('.action-card__counts')[0];
        const countChildren = [...counts.children];
        const comment = $item.find('.fa-comment')[0].parentElement;
        const attachment = $item.find('.fa-paperclip')[0].parentElement;

        expect(identity.contains(form)).to.be.true;
        expect(secondaryChildren.indexOf(dates)).to.be.lessThan(secondaryChildren.indexOf(counts));
        expect(countChildren.indexOf(attachment)).to.be.lessThan(countChildren.indexOf(comment));
      });

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-state-region]')
      .find('.fa-circle-exclamation')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateInProgress.id);
      });

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-owner-region]')
      .find('.owner-component--compact')
      .should('contain', 'CO')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
        expect(data.relationships.owner.data.type).to.equal(teamNurse.type);
      });

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .contains('Today')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        // Datepicker doesn't use timestamp so due_date is local.
        expect(data.attributes.due_date).to.equal(testDate());
      });

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('9:45 AM')
      .click();

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-due-time-region] .is-overdue');

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('09:45:00');
      });

    cy
      .get('.workflow-page__tabs')
      .find('.js-workflow-closed')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.flow-card', 'Done Flow')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click();

    cy
      .wait('@routePatchDoneFlow')
      .its('request.body.data.relationships.state.data.id')
      .should('equal', stateInProgress.id);

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .last()
      .as('flowItem');

    cy
      .get('@flowItem')
      .find('.fa-circle-dot');

    cy
      .get('@flowItem')
      .find('[data-owner-region]')
      .find('.owner-component--compact')
      .should('contain', 'CO')
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
      .get('.action-card')
      .eq(1)
      .find('[data-form-region]')
      .should('be.empty');

    cy
      .get('.action-card')
      .eq(1)
      .find('.fa-paperclip')
      .should('not.exist');

    cy
      .get('.action-card')
      .eq(1)
      .find('.fa-comment')
      .should('not.exist');

    cy.routeAction(fx => {
      fx.data = mergeJsonApi(testAction, {
        relationships: {
          'form': getRelationship(),
          'form-responses': getRelationship([]),
        },
      });

      return fx;
    });

    cy
      .contains('.action-card', 'First In List')
      .find('.work-card__surface')
      .click(5, 5)
      .wait('@routeAction');

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.action-card', 'First In List')
      .find('.work-card__title')
      .focus()
      .typeEnter()
      .wait('@routeAction');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    // dirty hack to make sure the form button isn't offscreen
    cy
      .get('.action-card')
      .first()
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .contains('Clear')
      .click();

    cy
      .get('.action-card')
      .first()
      .find('.fa-paperclip')
      .should('exist')
      .next()
      .should('contain', '1');

    cy
      .get('.action-card')
      .first()
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormActionFields()
      .routeFormResponse();

    cy
      .get('.action-card')
      .first()
      .find('[data-form-region]')
      .find('button')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');
  });

  specify('add action and flow', function() {
    const currentClinican = getCurrentClinician({
      relationships: {
        team: getRelationship(teamNurse),
        role: getRelationship(roleEmployee),
      },
    });

    const testProgramIds = _.times(5, () => uuid());

    const testProgramActions = [
      getProgramAction({
        attributes: {
          name: 'One of One',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: 'details',
          days_until_due: 1,
          options: {
            icon: 'caret-down',
            iconType: 'fas',
            color: 'red',
          },
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          form: getRelationship(testForm),
          teams: getRelationship([teamNurse]),
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'One of Two',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: 0,
        },
        relationships: {
          owner: getRelationship(null),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Two of Two',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Visible - restricted to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: null,
        },
        relationships: {
          teams: getRelationship([teamNurse]),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Visible - restricted to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: null,
        },
        relationships: {
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - unpublished',
          behavior: 'standard',
          published_at: null,
          archived_at: null,
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - archived',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: testTs(),
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - automated behavior',
          behavior: 'automated',
          published_at: testTs(),
          archived_at: null,
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - not visible to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: 1,
        },
        relationships: {
          teams: getRelationship([teamCoordinator]),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - not visible to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: 1,
        },
        relationships: {
          roles: getRelationship([roleAdmin]),
        },
      }),
    ];

    const testProgramFlows = [
      getProgramFlow({
        attributes: {
          name: '1 Flow',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[0], 'programs'),
          state: getRelationship(stateTodo),
          owner: getRelationship(teamOther),
          teams: getRelationship([teamNurse]),
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramFlow({
        attributes: {
          name: '2 Flow',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getProgramFlow({
        attributes: {
          name: '3 Flow',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Visible - restricted to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          teams: getRelationship([teamNurse]),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Visible - restricted to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Should not show - unpublished',
          behavior: 'standard',
          published_at: null,
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Should not show - archived',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: testTs(),
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Should not show - automated behavior',
          behavior: 'automated',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Should not show - not visible to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          teams: getRelationship([teamCoordinator]),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Should not show - not visible to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          roles: getRelationship([roleAdmin]),
        },
      }),
    ];

    const testPrograms = [
      getProgram({
        id: testProgramIds[0],
        attributes: {
          name: 'Two Actions, One Published, One Flow',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship([{ id: testProgramFlows[0].id }], 'flows'),
          'program-actions': getRelationship(
            [
              { id: testProgramActions[0].id },
              { id: testProgramActions[3].id },
              { id: testProgramActions[4].id },
              { id: testProgramActions[5].id },
              { id: testProgramActions[6].id },
            ], 'actions',
          ),
        },
      }),
      getProgram({
        id: testProgramIds[1],
        attributes: {
          name: 'Two Published Actions and Flows',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship(
            [
              { id: testProgramFlows[1].id },
              { id: testProgramFlows[2].id },
              { id: testProgramFlows[3].id },
              { id: testProgramFlows[4].id },
              { id: testProgramFlows[5].id },
              { id: testProgramFlows[6].id },
              { id: testProgramFlows[7].id },
              { id: testProgramFlows[8].id },
              { id: testProgramFlows[9].id },
            ], 'flows',
          ),
          'program-actions': getRelationship(
            [
              { id: testProgramActions[1].id },
              { id: testProgramActions[2].id },
              { id: testProgramActions[3].id },
              { id: testProgramActions[4].id },
              { id: testProgramActions[5].id },
              { id: testProgramActions[6].id },
              { id: testProgramActions[7].id },
              { id: testProgramActions[8].id },
              { id: testProgramActions[9].id },
            ], 'actions',
          ),
        },
      }),
      getProgram({
        id: testProgramIds[2],
        attributes: {
          name: 'No Actions, No Flows',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship([]),
          'program-actions': getRelationship([]),
        },
      }),
      getProgram({
        id: testProgramIds[3],
        attributes: {
          name: 'Should not show - unpublished',
          published_at: null,
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship([]),
          'program-actions': getRelationship([]),
        },
      }),
      getProgram({
        id: testProgramIds[4],
        attributes: {
          name: 'Should not show - archived',
          published_at: testTs(),
          archived_at: testTs(),
        },
        relationships: {
          'program-flows': getRelationship([]),
          'program-actions': getRelationship([]),
        },
      }),
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

        return fx;
      })
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePrograms(fx => {
        fx.data = testPrograms;

        return fx;
      })
      .routeAllProgramActions(fx => {
        fx.data = testProgramActions;

        return fx;
      })
      .routeAllProgramFlows(fx => {
        fx.data = testProgramFlows;

        return fx;
      })
      .routeFlowActivity()
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePrograms')
      .wait('@routeAllProgramActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[behavior]=standard')
      .wait('@routeAllProgramFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[behavior]=standard');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    const headingOrder = [
      'Add Flow or Action',
      'No Actions, No Flows',
      'Two Actions, One Published, One Flow',
      'Two Published Actions and Flows',
    ];

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .then($headings => {
        $headings.each((idx, $heading) => {
          expect($heading).to.contain(headingOrder[idx]);
        });
      });

    cy
      .get('.picklist')
      .contains('No Actions, No Flows')
      .next()
      .find('.picklist__item')
      .first()
      .find('.fa-file-lines');

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .find('.picklist__item')
      .first()
      .should('contain', '1 Flow')
      .find('.fa-folder');

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .find('.picklist__item')
      .eq(1)
      .should('contain', 'One of One')
      .find('.action-icon--red.fa-caret-down');

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .find('.picklist__item')
      .eq(2)
      .should('contain', 'Visible - restricted to current user role')
      .parent()
      .find('.picklist__item')
      .last()
      .should('contain', 'Visible - restricted to current user team');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .should('contain', '2 Flow')
      .should('contain', '3 Flow');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .find('.picklist__item')
      .eq(2)
      .should('contain', 'One of Two')
      .find('.fa-file-lines');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .find('.picklist__item')
      .eq(3)
      .should('contain', 'Two of Two')
      .find('.fa-file-lines');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .should('contain', 'Visible - restricted to current user team')
      .should('contain', 'Visible - restricted to current user role');

    cy
      .get('.picklist')
      .contains('No Actions, No Flows')
      .next()
      .should('contain', 'No Published Actions')
      .click();

    cy
      .get('.picklist')
      .should('not.contain', 'Should not show');

    const testOne = createActionPostRoute('One of One');

    cy
      .get('.picklist')
      .contains('One of One')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('One of One');
        expect(data.attributes.details).to.be.undefined;
        expect(data.attributes.duration).to.be.undefined;
        expect(data.attributes.due_date).to.be.undefined;
        expect(data.attributes.due_time).to.be.undefined;
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[0].id);
        expect(data.relationships.owner).to.be.undefined;
      });

    cy
      .get('@wsHandleMessage')
      .should(stub => {
        const subscribedResources = _.flatten(stub.getCalls().map(call => call.args[0].data.resources));

        expect(subscribedResources).to.deep.include({
          id: testOne,
          type: 'patient-actions',
        });
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/${ testOne }`);

    cy
      .get('.patient-action')
      .should('contain', 'One of One');

    cy
      .get('.patient-action')
      .find('.js-menu')
      .should('not.exist');

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    const testTwo = createActionPostRoute('One of Two');

    cy
      .get('.picklist')
      .contains('One of Two')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('One of Two');
        expect(data.attributes.details).to.be.undefined;
        expect(data.attributes.duration).to.be.undefined;
        expect(data.attributes.due_date).to.be.undefined;
        expect(data.attributes.due_time).to.be.undefined;
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[1].id);
        expect(data.relationships.owner).to.be.undefined;
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/${ testTwo }`);

    cy
      .get('.patient-action')
      .should('contain', 'One of Two');

    cy
      .get('.patient-action')
      .find('.js-menu')
      .should('not.exist');

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    const testThree = createActionPostRoute('Two of Two');

    cy
      .get('.picklist')
      .contains('Two of Two')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('Two of Two');
        expect(data.attributes.due_date).to.be.undefined;
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[2].id);
        expect(data.relationships.owner).to.be.undefined;
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/${ testThree }`);

    cy
      .get('.patient-action')
      .should('contain', 'Two of Two');

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    const testFlow = getFlow({
      attributes: { updated_at: testTs() },
    });

    cy
      .intercept('POST', '/api/flows*', {
        statusCode: 201,
        body: {
          data: testFlow,
        },
      })
      .as('routePostFlow');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    cy
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .get('.picklist')
      .contains('1 Flow')
      .click();

    cy
      .wait('@routePostFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships['program-flow'].data.id).to.be.equal(testProgramFlows[0].id);
        expect(data.relationships.owner).to.be.undefined;
      });

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }`);

    cy
      .get('.patient-flow__header-container')
      .find('.js-menu')
      .should('not.exist');
  });

  specify('flow list - socket notifications', function() {
    const testDateTime = testTs();

    const testSocketFlow = getFlow({
      attributes: {
        name: 'Test Flow - Subscribed on Page Load',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
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

    const testNewSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - Created Elsewhere',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewStateSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - State Updated to Match Current Filter',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = mergeJsonApi(testPatient, {
          relationships: {
            workspaces: getRelationship(workspaceOne),
          },
        });

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
      .visitOnClock(`/patient/${ testPatient.id }/workflow`, { now: testDateTime })
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@wsHandleMessage')
      .should(stub => {
        expect(stub).to.have.been.called;
        const states = [stateTodo.id, stateInProgress.id].join();
        const patient = testPatient.id;

        const { filters, resources } = stub.lastCall.args[0].data;

        expect(filters).to.deep.equal({
          actions: { states, patient, flow: NIL_UUID },
          flows: { states, patient },
        });

        expect(resources).to.deep.equal([
          getRelationship(testPatient).data,
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
      .find('.flow-card')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.work-card__meta')
      .should('contain', formatDate(testDateTime, 'TIME_OR_DAY'));

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    cy.sendWs({
      category: 'FlowProgressChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
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

    // state was set to done, which means it's removed from the list
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

    // wait for fade-out animation to completely finish
    cy.tick(1000);

    cy
      .get('.card-list__empty')
      .should('contain', 'No Open Workflows');

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
      .should(stub => {
        expect(stub).to.have.been.called;
        const { resources } = stub.lastCall.args[0].data;

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
      category: 'ResourceDeleted',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {},
    });

    cy
      .get('.app-frame__content')
      .find('.flow-card')
      .should('have.length', 1);
  });

  specify('action list - socket notifications', function() {
    const testDateTime = testTs();
    const currentClinician = getCurrentClinician();
    const testSocketComment = getComment();
    const testSocketFileId = uuid();

    const testSocketAction = getAction({
      attributes: {
        name: 'Test Action - Subscribed on Page Load',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewSocketAction = getAction({
      attributes: {
        name: 'New Action - Created Elsewhere',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewStateSocketAction = getAction({
      attributes: {
        name: 'New Action - State Updated to Match Current Filter',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = mergeJsonApi(testPatient, {
          relationships: {
            workspaces: getRelationship(workspaceOne),
          },
        });

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
      .visitOnClock(`/patient/${ testPatient.id }/workflow`, { now: testDateTime })
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@wsHandleMessage')
      .should(stub => {
        expect(stub).to.have.been.called;
        const states = [stateTodo.id, stateInProgress.id].join();
        const patient = testPatient.id;

        const { filters, resources } = stub.lastCall.args[0].data;

        expect(filters).to.deep.equal({
          actions: { states, patient, flow: NIL_UUID },
          flows: { states, patient },
        });

        expect(resources).to.deep.equal([
          getRelationship(testPatient).data,
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
      .find('.action-card')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.work-card__meta')
      .should('contain', formatDate(testDateTime, 'TIME_OR_DAY'));

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          details: '',
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-details-region]')
      .should('be.empty');

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

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
      .get('@firstRow')
      .should($action => {
        expect($action.find('[data-due-date-region]')).to.contain(formatDate(testDateAdd(1), 'SHORT'));
        expect($action.find('[data-due-time-region]')).to.contain('7:00 AM');
      });

    cy.sendWs({
      category: 'ActionCommentAdded',
      author: currentClinician.id,
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        comment: {
          type: testSocketComment.type,
          id: testSocketComment.id,
        },
        attributes: {
          message: 'New websocket comment.',
        },
      },
    });

    cy
      .get('@firstRow')
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy.sendWs({
      category: 'AttachmentAdded',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        clinician: {
          type: currentClinician.type,
          id: currentClinician.id,
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
      .get('@firstRow')
      .find('.fa-paperclip')
      .should('exist')
      .next()
      .should('contain', '1');

    // state was set to done, which means it's removed from the list
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

    // wait for fade-out animation to completely finish
    cy.tick(1000);

    cy
      .get('.card-list__empty')
      .should('contain', 'No Open Workflows');

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
      .should(stub => {
        expect(stub).to.have.been.called;
        const { resources } = stub.lastCall.args[0].data;

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
      .find('.action-card')
      .should('have.length', 1);
  });

  specify('non work:own clinician', function() {
    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          attributes: {
            enabled: true,
          },
          relationships: {
            role: getRelationship(roleAdmin),
          },
        });

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('[data-add-workflow-region]')
      .should('be.empty');
  });

  specify('work with work:owned:manage permission', function() {
    const currentClinican = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    cy
      .routesForPatientWorkflow()
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

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
              name: 'First In List',
              details: null,
              duration: 0,
              due_date: null,
              due_time: null,
              updated_at: testTs(),
            },
            relationships: {
              owner: getRelationship(currentClinican),
              state: getRelationship(stateTodo),
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
              state: getRelationship(stateTodo),
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
              state: getRelationship(stateTodo),
              owner: getRelationship(currentClinican),
            },
          }),
          getFlow({
            attributes: {
              name: 'Last In List',
              updated_at: testTsSubtract(6),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(teamCoordinator),
            },
          }),
          getFlow({
            attributes: {
              name: 'Done Flow',
              updated_at: testTsSubtract(7),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .first()
      .find('button')
      .should('have.length', 6);

    cy
      .get('@listItems')
      .eq(1)
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('@listItems')
      .eq(2)
      .find('button')
      .should('have.length', 2)
      .filter('.action-details-tooltip')
      .should('have.length', 1);

    cy
      .get('@listItems')
      .eq(3)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('.workflow-page__tabs')
      .find('.js-workflow-closed')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.flow-card', 'Done Flow')
      .find('[data-state-region]')
      .find('.fa-circle-check')
      .should('exist')
      .parents('[data-state-region]')
      .find('button')
      .should('not.exist');
  });

  specify('work with work:team:manage permission', function() {
    const currentClinican = getCurrentClinician({
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
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinican, nonTeamMemberClinician];

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
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamNurse),
            },
          }),
          getAction({
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
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.workflow-page__list')
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

  specify('410 patient not found error', function() {
    cy
      .intercept('GET', '/api/patients/1*', {
        statusCode: 410,
        body: {},
      })
      .as('routePatient')
      .visit('/patient/1/workflow');

    cy
      .get('.error-page')
      .should('contain', 'This page doesn\'t exist.')
      .and('contain', 'Please check the URL.');

    cy
      .url()
      .should('contain', '/404');
  });

  specify('reads patient-wide native Messages on a compose action without a fixture contract or write controls', function() {
    const action = getAction({ attributes: { name: 'Text check-in', options: { embed: 'compose' } }, relationships: {
      patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: { data: null },
    } });
    const other = getAction({ attributes: { name: 'Previous outreach' }, relationships: {
      patient: getRelationship(testPatient), state: getRelationship(stateDone), flow: { data: null },
    } });
    const rows = _.range(365).map(index => getInteraction({ attributes: {
      channel: 'sms', direction: index % 2 ? 'outbound' : 'inbound', expected_at: null,
      occurred_at: new Date(Date.UTC(2026, 10, 1, 12, index)).toISOString(),
      metadata: index % 2 ? { message: `Outgoing history ${ index }` } : { body: `Incoming history ${ index }`, from: '+12025550142' },
    }, relationships: { action: getRelationship(index % 2 ? action : other), flow: { data: null } } }));
    const otherMessages = ['email', 'mail', 'fax', 'portal'].map((channel, index) => {
      const row = rows[361 + index];
      row.attributes.channel = channel;
      row.attributes.metadata = { note: `Native ${ channel } message` };
      row.relationships.action = getRelationship(action);
      return row;
    });
    const latest = getInteraction({ attributes: { channel: 'sms', direction: 'outbound', occurred_at: '2026-11-12T15:00:00Z', expected_at: null,
      metadata: { message: `Latest native outgoing\n${ 'A complete conversation note.\n'.repeat(30) }Visit https://example.org/help?q=1&x=2. Also (https://example.org/Foo_(bar)).`, sent_message_id: 'accepted-not-delivered', disposition: 'Text Sent' } },
    relationships: { action: getRelationship(action), flow: { data: null } } });
    const missing = getInteraction({ attributes: { channel: 'sms', direction: 'inbound', occurred_at: '2026-11-12T14:00:00Z', expected_at: null, metadata: { body: '   ' } },
      relationships: { action: { data: null }, flow: { data: null } } });
    const scheduled = getInteraction({ attributes: { channel: 'sms', direction: 'outbound', occurred_at: null, expected_at: '2099-11-20T15:00:00Z',
      metadata: { message: `Current scheduled text\n${ 'A long scheduled note.\n'.repeat(50) }` } }, relationships: { action: getRelationship(action), flow: { data: null } } });
    rows.push(latest, missing, scheduled, ..._.range(12).map(index => getInteraction({ attributes: {
      channel: 'sms', direction: 'outbound', occurred_at: null, expected_at: `2099-12-${ String(index + 1).padStart(2, '0') }T12:00:00Z`,
      metadata: { message: 'Other-action upcoming text' },
    }, relationships: { action: getRelationship(other), flow: { data: null } } })));
    const contextFlow = getFlow({ attributes: { name: 'Care follow-up' }, relationships: {
      patient: getRelationship(testPatient), state: getRelationship(stateTodo),
    } });
    const flowAction = getAction({ attributes: { name: 'Flow outreach with a longer conversation title', options: { embed: 'compose' } }, relationships: {
      patient: getRelationship(testPatient), state: getRelationship(stateDone), flow: getRelationship(contextFlow),
    } });
    const linked = getInteraction({ attributes: { channel: 'sms', direction: 'outbound', occurred_at: '2026-11-12T13:30:00Z', expected_at: null,
      metadata: { message: 'A text from the flow action' } }, relationships: { action: getRelationship(flowAction), flow: { data: null } } });
    rows.push(linked);
    rows.push(getInteraction({ attributes: { channel: 'sms', direction: 'outbound', occurred_at: '2026-11-12T13:00:00Z', expected_at: null,
      metadata: { message: 'Flow-linked context' } }, relationships: { action: { data: null }, flow: getRelationship(contextFlow) } }));
    rows.push(getInteraction({ attributes: { channel: 'voice', direction: 'outbound', occurred_at: '2026-10-31T16:00:00Z', expected_at: null,
      metadata: { note: 'Call remains in Activity' } }, relationships: { action: getRelationship(action), flow: { data: null } } }));
    let organizationEnabled = true;
    let writes = 0;

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routePatientByAction(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routeAction(fx => {
        fx.data = action;
        fx.included = [testPatient, stateTodo];
        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [action, other];
        fx.included = [stateTodo, stateDone];
        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];
        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = rows;
        fx.included = [action, other, flowAction, contextFlow];
        return fx;
      })
      .routeFlow(fx => {
        fx.data = contextFlow;
        fx.included = [testPatient, stateTodo];
        return fx;
      })
      .routePatientByFlow(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [flowAction];
        fx.included = [stateDone];
        return fx;
      })
      .routeFlowActivity(fx => {
        fx.data = [];
        return fx;
      })
      .routeWorkspaces(fx => {
        fx.data[0].attributes.settings = { messaging_enabled: true };
        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data.attributes.settings = { messaging_enabled: true };
        return fx;
      });

    cy
      .intercept('GET', '/api/actions/*', req => {
        const id = new URL(req.url).pathname.split('/').pop();
        req.reply({ body: { data: [action, other, flowAction].find(row => row.id === id), included: [testPatient, stateTodo, stateDone, contextFlow] } });
      });

    cy
      .fixture('test/settings')
      .then(settings => {
        cy.intercept('GET', '/api/settings', req => req.reply({ body: { data: settings.map(row => ({ id: row.id, type: 'settings', attributes: { value: row.value } }))
          .concat([{ id: 'messaging_enabled', type: 'settings', attributes: { value: organizationEnabled } }]) } }));
      });

    cy
      .intercept('POST', '/api/patients/*/interactions', req => {
        writes++;
        req.reply({ statusCode: 409, body: { errors: [{ detail: 'Writes are unavailable' }] } });
      });

    cy
      .visit(`/patient/${ testPatient.id }/workflow`);

    cy
      .contains('.action-card', 'Text check-in')
      .find('.message-action__button')
      .should('be.visible')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ action.id }`);

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Latest native outgoing')
      .and('contain', 'Message content is unavailable.')
      .and('contain', 'Current scheduled text')
      .and('not.contain', 'Other-action upcoming text')
      .and('not.contain', 'Incoming history 0')
      .and('contain', 'delivery unconfirmed');

    cy
      .get('.patient-action__activity-layout')
      .should('contain', 'Call remains in Activity');

    cy
      .get('.messaging-history')
      .should('not.contain', 'Call remains in Activity');

    for (const row of otherMessages) {
      cy
        .contains('.messaging-history .messaging-card', row.attributes.metadata.note)
        .should('contain', `via ${ row.attributes.channel }`)
        .and('not.contain', 'via SMS');

      cy
        .get('.patient-action__activity-layout')
        .should('not.contain', row.attributes.metadata.note);
    }

    cy
      .get('.messaging-history .js-send')
      .should('not.exist');

    cy
      .contains('.messaging-card', 'Latest native outgoing')
      .should('contain', 'Outbound SMS • Text Sent')
      .find('.js-show-more')
      .should('be.visible')
      .click();

    cy
      .focused()
      .should('have.class', 'messaging-card__body')
      .and('contain', 'A complete conversation note.')
      .find('a')
      .should('have.length', 2)
      .first()
      .should('have.attr', 'href', 'https://example.org/help?q=1&x=2');

    cy
      .contains('.messaging-card', 'Flow-linked context')
      .find('.js-flow')
      .should('contain', 'Care follow-up')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ contextFlow.id }`);

    cy
      .get('.patient-flow__header')
      .should('contain', 'Care follow-up');

    cy
      .contains('.patient-flow__action-item', 'Flow outreach')
      .find('.message-action__button')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ contextFlow.id }/action/${ flowAction.id }`);

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Latest native outgoing');

    cy
      .viewport(390, 844);

    cy
      .get('.patient-action__title .message-action__button')
      .click();

    cy
      .get('.messaging-history__viewport')
      .should('be.visible')
      .and($viewport => expect($viewport[0].clientHeight, 'mobile history remains readable').to.be.greaterThan(120));

    cy
      .document()
      .should(doc => expect(doc.documentElement.scrollWidth, 'no horizontal overflow').to.be.at.most(doc.documentElement.clientWidth));

    cy
      .viewport(1280, 768);

    cy
      .visit(`/patient/${ testPatient.id }/workflow`);

    cy
      .get('.js-interactions')
      .click();

    for (const row of otherMessages) {
      cy
        .contains('.messaging-timeline-row', row.attributes.metadata.note)
        .should('contain', `via ${ row.attributes.channel }`)
        .and('not.contain', 'via SMS');
    }

    cy
      .contains('.messaging-timeline-row', 'Flow-linked context')
      .find('.js-flow')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ contextFlow.id }`);

    cy
      .get('.patient-flow__header')
      .should('contain', 'Care follow-up');

    cy
      .visit(`/patient/${ testPatient.id }/interactions/${ linked.id }`);

    cy
      .get('.messaging-timeline-row.is-selected')
      .should('contain', 'A text from the flow action')
      .and('have.focus')
      .find('.js-action')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ contextFlow.id }/action/${ flowAction.id }`);

    cy
      .get('.patient-action__name')
      .should('contain', 'Flow outreach');

    cy
      .visit(`/patient/${ testPatient.id }/interactions/${ rows[62].id }`);

    cy
      .get('.messaging-timeline-row.is-selected')
      .should('contain', 'Incoming history 62')
      .find('.js-action')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ other.id }`);

    cy
      .get('.patient-action__name')
      .should('contain', 'Previous outreach');

    cy
      .routeActions(fx => {
        fx.data = [action];
        fx.included = [testPatient, stateTodo];
        return fx;
      })
      .visit('/worklist/owned-by');

    cy
      .contains('.action-card', 'Text check-in')
      .find('.message-action__button')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ action.id }`);

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Latest native outgoing');

    cy
      .contains('.messaging-card', 'A text from the flow action')
      .find('.js-action')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ contextFlow.id }/action/${ flowAction.id }`);

    cy
      .get('.patient-action__name')
      .should('contain', 'Flow outreach');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ action.id }`);

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Latest native outgoing');

    cy
      .get('.messaging-history .js-earlier')
      .click();

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Incoming history 342');

    function loadEarlier(remaining = 40) {
      cy
        .get('.messaging-history__list')
        .then($list => {
          if ($list.text().includes('Incoming history 62')) return;
          expect(remaining, 'older pages reach the loaded boundary').to.be.greaterThan(0);
          cy.get('.messaging-history .js-earlier').click();
          cy.get('.messaging-history[aria-busy="false"]', { timeout: 15000 }).should('be.visible');
          loadEarlier(remaining - 1);
        });
    }
    loadEarlier();

    let visibleAnchor;
    const firstVisibleId = viewport => {
      const top = viewport.getBoundingClientRect().top;
      return [...viewport.querySelectorAll('.messaging-history__row')].find(row => row.getBoundingClientRect().bottom > top)?.dataset.interactionId;
    };

    cy
      .get('.messaging-history__viewport')
      .then($viewport => {
        visibleAnchor = firstVisibleId($viewport[0]);
      });

    const inbound = getInteraction({ attributes: { channel: 'sms', direction: 'inbound', occurred_at: '2026-11-13T15:00:00Z', expected_at: null,
      metadata: { body: 'New native patient reply', from: '+12025550142' } }, relationships: { action: getRelationship(other), flow: { data: null } } });

    cy
      .get('@wsHandleMessage')
      .should('have.been.called');

    cy
      .then(() => rows.push(inbound));

    cy
      .sendWs({ category: 'InteractionCompleted', resource: { id: inbound.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { occurred_at: inbound.attributes.occurred_at } } });

    cy
      .get('.messaging-history[aria-busy="false"]', { timeout: 15000 })
      .should('contain', 'New native patient reply')
      .and('contain', 'Incoming history 62');

    cy
      .get('.messaging-history__row')
      .filter((index, row) => row.textContent.includes('New native patient reply'))
      .should('have.length', 1);

    cy
      .get('.messaging-history__viewport')
      .should($viewport => expect(firstVisibleId($viewport[0])).to.equal(visibleAnchor));

    cy
      .get('.patient-action__title .message-action__button')
      .click();

    cy
      .get('.messaging-history__viewport')
      .should($viewport => {
        const viewport = $viewport[0];
        expect(viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop, 'title button reveals the latest texts').to.be.lessThan(2);
      });

    cy
      .contains('.messaging-card', 'Current scheduled text')
      .find('.js-show-more')
      .click();

    cy
      .get('.patient-action__title .message-action__button')
      .click();

    cy
      .get('.messaging-history__viewport')
      .should($viewport => expect(firstVisibleId($viewport[0]), 'reader is inside the expanded upcoming text').to.equal(scheduled.id))
      .then($viewport => {
        cy.wrap($viewport).scrollTo(0, $viewport[0].scrollTop - 8);
      });

    cy
      .then(() => {
        scheduled.relationships.action = getRelationship(other);
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: scheduled.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { action_id: other.id, metadata: scheduled.attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="false"]', { timeout: 15000 })
      .should('not.contain', 'Current scheduled text')
      .and('not.contain', 'Messages could not be loaded.')
      .and('contain', 'New native patient reply');

    cy
      .contains('.messaging-card', 'Incoming history 62')
      .find('.js-action')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ other.id }`);

    cy
      .get('.patient-action__name')
      .should('contain', 'Previous outreach');

    cy
      .get('.patient__context-trail .js-patient')
      .click();

    cy
      .contains('.action-card', 'Text check-in')
      .find('.message-action__button')
      .click();

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Latest native outgoing');

    cy
      .then(() => {
        organizationEnabled = false;
      });

    cy
      .reload();

    cy
      .get('.patient-action__name')
      .should('contain', 'Text check-in');

    cy
      .get('.messaging-history')
      .should('not.exist');

    cy
      .then(() => expect(writes).to.equal(0));
  });

  specify('retains native history through failed reads, navigation, and malformed cursor responses', function() {
    const responses = createTestScope();
    const fixtures = createTestScope();
    const requestCompletions = [];
    let releaseFrames = () => Promise.resolve([]);
    cleanupNativeHistory = () => responses.cleanup()
      .finally(() => releaseFrames())
      .finally(() => drainInteractionRequests(requestCompletions))
      .finally(() => fixtures.cleanup());
    cy.on('window:before:load', win => trackInteractionRequests(win, requestCompletions, fixtures));

    function holdHistory(body) {
      const gate = createResponseGate(responses);
      cy.intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (gate.started || query.get('filter[channel]') !== 'sms,email,mail,fax,portal' || query.get('page[limit]') !== '10') return;
        return gate.reply(req, body());
      }).as('heldNativeHistory');
      return gate;
    }
    const action = getAction({ attributes: { name: 'Conversation history', options: { embed: 'compose' } }, relationships: {
      patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: { data: null },
    } });
    const received = getInteraction({ attributes: { channel: 'sms', direction: 'inbound', expected_at: null,
      occurred_at: '2026-11-12T15:00:00Z', metadata: { body: 'History remains available', from: '+12025550142' } },
    relationships: { action: getRelationship(action), flow: { data: null } } });
    const cancelled = getInteraction({ attributes: { channel: 'sms', direction: 'outbound', occurred_at: null,
      expected_at: '2099-11-20T15:00:00Z', cancelled_at: '2026-11-12T14:00:00Z', metadata: { message: 'Cancelled reminder', clinician_name: 'Demo Staff' } },
    relationships: { action: getRelationship(action), flow: { data: null } } });
    let mode = 'failed';
    let reads = 0;
    const rows = [cancelled, received];
    const tied = Array.from({ length: 12 }, (entry, index) => getInteraction({ id: `00000000-0000-4000-8000-${ String(index < 6 ? index + 100 : index - 6).padStart(12, '0') }`, attributes: {
      channel: 'sms', direction: 'inbound', expected_at: null, occurred_at: `2026-11-12T15:00:00.12345${ index < 6 ? 0 : 1 }Z`,
      metadata: { body: `Precise-order message ${ index }` },
    }, relationships: { action: getRelationship(action), flow: { data: null } } }));
    const pending = Array.from({ length: 10 }, (entry, index) => getInteraction({ attributes: {
      channel: 'sms', direction: 'outbound', occurred_at: null, expected_at: new Date(Date.UTC(2099, 11, 20, 12, 10 - index)).toISOString(),
      metadata: { message: `Unlinked upcoming text ${ index }` },
    }, relationships: { action: { data: null }, flow: { data: null } } }));
    function tiedPage(query) {
      const older = query.get('page[before]');
      if (older) expect(older, 'native timestamp-and-ID cursor').to.equal(tied.at(-10).id);
      if (older && mode === 'missingCursor') return [];
      return older ? tied.slice(0, -10).reverse() : tied.slice(-10).reverse();
    }
    const malformed = {
      empty: [],
      stalled: pending,
      nonMessage: [{ ...received, attributes: { ...received.attributes, channel: 'voice', metadata: { note: 'Not an SMS message' } } }],
      repeated: Array(10).fill(received),
      invalid: [{ ...received, attributes: { ...received.attributes, occurred_at: 'invalid' } }],
      untimed: [{ ...received, attributes: { ...received.attributes, occurred_at: null } }],
      reversed: [received, cancelled],
    };

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routePatientByAction(fx => {
        fx.data = testPatient;
        return fx;
      })
      .routeAction(fx => {
        fx.data = action;
        fx.included = [testPatient, stateTodo];
        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [action];
        fx.included = [stateTodo];
        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];
        return fx;
      });

    cy
      .fixture('test/settings')
      .then(settings => {
        cy.intercept('GET', '/api/settings', { body: { data: settings.map(row => ({ id: row.id, type: 'settings', attributes: { value: row.value } }))
          .concat([{ id: 'messaging_enabled', type: 'settings', attributes: { value: true } }]) } });
      });

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (query.get('filter[channel]') !== 'sms,email,mail,fax,portal') return;
        reads++;
        if (mode === 'failed') {
          req.reply({ statusCode: 422, body: { errors: [{ status: '422', detail: 'History temporarily unavailable' }] } });
        } else if (malformed[mode]) {
          req.reply({ body: { data: malformed[mode], included: [action] } });
        } else if (['ties', 'missingCursor'].includes(mode)) {
          req.reply({ body: { data: tiedPage(query), included: [action] } });
        } else if (mode === 'moving') {
          req.reply({ body: { data: query.has('page[before]') ? [received] : pending, included: [action] } });
        } else if (mode === 'hidden') {
          const page = Array.from({ length: 10 }, (entry, index) => getInteraction({ attributes: {
            channel: 'sms', occurred_at: null, expected_at: new Date(Date.UTC(2099, 10, 20, 12, 0, 0, 1000 - reads * 10 - index)).toISOString(),
            metadata: { message: 'Other-action future text' },
          }, relationships: { action: { data: null }, flow: { data: null } } }));
          req.reply({ body: { data: page, included: [] } });
        } else {
          req.reply({ body: { data: getPage(rows, query, rows), included: [action] } });
        }
      })
      .as('nativeHistory');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ action.id }`);

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Messages could not be loaded.');

    cy
      .then(() => {
        mode = 'ready';
      });

    cy
      .get('.patient__context-trail .js-patient')
      .click();

    const duringStartup = getInteraction({ attributes: { channel: 'sms', direction: 'inbound', expected_at: null,
      occurred_at: '2026-11-12T16:00:00Z', metadata: { body: 'Arrived while opening history' } },
    relationships: { action: getRelationship(action), flow: { data: null } } });
    const startup = holdHistory(() => JSON.parse(JSON.stringify({ data: getPage(rows, new URLSearchParams('page[limit]=10'), rows), included: [action] })));

    cy
      .contains('.action-card', 'Conversation history')
      .find('.message-action__button')
      .click();

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(startup.started).to.equal(true));

    cy
      .get('.patient-action__title .message-action__button')
      .click();

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should('be.visible');

    cy
      .get('@wsHandleMessage')
      .should('have.been.called');

    cy
      .then(() => rows.push(duringStartup));

    cy
      .sendWs({ category: 'ResourceCreated', resource: { id: duringStartup.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: duringStartup.attributes } });

    cy
      .then(startup.release);

    cy
      .wait('@heldNativeHistory');

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Arrived while opening history');

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'History remains available')
      .and('contain', 'Cancelled')
      .and('contain', 'Demo Staff');

    cy
      .then(() => {
        mode = 'failed';
      });

    cy
      .sendWs({ category: 'InteractionCompleted', resource: { id: received.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { occurred_at: received.attributes.occurred_at } } });

    cy
      .wait('@nativeHistory');

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'History remains available')
      .and('contain', 'Messages could not be loaded.');

    cy
      .then(() => {
        mode = 'ready';
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: received.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: received.attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'History remains available')
      .and('not.contain', 'Messages could not be loaded.');

    const whileRefreshing = getInteraction({ attributes: { channel: 'sms', direction: 'inbound', expected_at: null,
      occurred_at: '2026-11-12T17:00:00Z', metadata: { body: 'Arrived during another refresh' } },
    relationships: { action: getRelationship(action), flow: { data: null } } });
    const refresh = holdHistory(() => JSON.parse(JSON.stringify({ data: getPage(rows, new URLSearchParams('page[limit]=10'), rows), included: [action] })));

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: received.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: received.attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(refresh.started).to.equal(true));

    cy
      .then(() => rows.push(whileRefreshing));

    cy
      .sendWs({ category: 'ResourceCreated', resource: { id: whileRefreshing.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: whileRefreshing.attributes } });

    cy
      .then(refresh.release);

    cy
      .wait('@heldNativeHistory');

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Arrived during another refresh');

    cy
      .get('.messaging-history__row')
      .filter((index, row) => row.textContent.includes('Arrived during another refresh'))
      .should('have.length', 1);

    const leaving = holdHistory(() => JSON.parse(JSON.stringify({ data: getPage(rows, new URLSearchParams('page[limit]=10'), rows), included: [action] })));
    let leavingRead;

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: received.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: received.attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(leaving.started).to.equal(true))
      .then(() => {
        leavingRead = _.find([...requestCompletions].reverse(), request => {
          const query = new URL(request.requestUrl, 'http://localhost').searchParams;
          return query.get('filter[channel]') === 'sms,email,mail,fax,portal' && query.get('page[limit]') === '10';
        });
        expect(leavingRead.requestSignal.aborted, 'the visible history owns a pending native read').to.equal(false);
      });

    cy
      .get('.patient__context-trail .js-patient')
      .click();

    cy
      .get('.workflow-page__list')
      .should('be.visible')
      .then(() => expect(leavingRead.requestSignal.aborted, 'leaving history cancels its pending native read').to.equal(true));

    cy
      .then(() => {
        leaving.release();
        return Promise.all([leaving.drain, drainInteractionRequests(requestCompletions)]);
      });

    let stoppedFrame;
    let readsBeforeStoppedFrame;
    cy
      .window()
      .then(win => {
        readsBeforeStoppedFrame = reads;
        stoppedFrame = observeInteractionMessage(win, received.id, fixtures);
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: received.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: received.attributes.metadata } } });

    cy
      .then(() => stoppedFrame)
      .then(() => drainInteractionRequests(requestCompletions));

    cy
      .get('.workflow-page__list')
      .should('contain', 'Conversation history')
      .and(() => expect(reads, 'stopped history owns no frame listener').to.equal(readsBeforeStoppedFrame));

    cy
      .get('.messaging-history')
      .should('not.exist');

    // A background tab may defer painting until after the user leaves the page.
    // Hold only the browser frame scheduler; navigation and requests remain real.
    cy
      .window()
      .then(win => {
        const frames = new Map();
        const schedule = win.requestAnimationFrame.bind(win);
        const cancelNative = win.cancelAnimationFrame.bind(win);
        let nextFrame = 0;
        const request = cy.stub(win, 'requestAnimationFrame').callsFake(callback => {
          frames.set(--nextFrame, callback);
          return nextFrame;
        });
        const cancel = cy.stub(win, 'cancelAnimationFrame').callsFake(id => {
          if (!frames.delete(id)) cancelNative(id);
        });
        releaseFrames = _.once(() => {
          request.restore();
          cancel.restore();
          return Promise.allSettled([...frames.values()].map(callback => new Promise((resolve, reject) => {
            schedule(time => {
              try {
                callback(time);
                resolve();
              } catch(error) {
                reject(error);
              }
            });
          })));
        });
      });

    cy
      .contains('.action-card', 'Conversation history')
      .find('.message-action__button')
      .click();

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Arrived during another refresh');

    cy
      .get('.patient__context-trail .js-patient')
      .click();

    cy
      .get('.workflow-page__list')
      .should('be.visible');

    cy
      .then(() => releaseFrames())
      .then(results => expect(_.where(results, { status: 'rejected' }), 'deferred frames do not update a closed history').to.be.empty);

    cy
      .get('.workflow-page__list')
      .should('contain', 'Conversation history');

    cy
      .get('.messaging-history')
      .should('not.exist');

    cy
      .contains('.action-card', 'Conversation history')
      .find('.message-action__button')
      .click();

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Arrived during another refresh');

    let reentryFrame;
    let readsBeforeReentryFrame;
    cy
      .window()
      .then(win => {
        readsBeforeReentryFrame = reads;
        received.attributes.metadata.body = 'History refreshed after reentry';
        reentryFrame = observeInteractionMessage(win, received.id, fixtures);
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: received.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: received.attributes.metadata } } });

    cy
      .then(() => reentryFrame)
      .then(() => drainInteractionRequests(requestCompletions));

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'History refreshed after reentry')
      .and(() => expect(reads, 'one refresh per frame after reentry').to.equal(readsBeforeReentryFrame + 1));

    const foreign = getInteraction();
    const foreignPatient = getPatient();
    let foreignFrame;
    let readsBeforeForeignFrame;
    cy
      .window()
      .then(win => {
        readsBeforeForeignFrame = reads;
        foreignFrame = observeInteractionMessage(win, foreign.id, fixtures);
      });

    cy
      .sendWs({ category: 'ResourceCreated', resource: { id: foreign.id, type: 'interactions' },
        payload: { patient: { id: foreignPatient.id }, attributes: foreign.attributes } });

    cy
      .then(() => foreignFrame)
      .then(() => drainInteractionRequests(requestCompletions));

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Arrived during another refresh')
      .and(() => expect(reads, 'other-patient frames do not refresh this history').to.equal(readsBeforeForeignFrame));

    cy
      .then(() => {
        mode = 'ties';
      });

    cy
      .reload();

    cy
      .get('.messaging-history[aria-busy="false"] .messaging-history__row')
      .should('have.length', 10);

    cy
      .get('.messaging-history__viewport')
      .should($viewport => expect($viewport[0].scrollTop, 'the initial latest position is applied before scrolling upward').to.be.greaterThan(0))
      .scrollTo('top');

    cy
      .get('.messaging-history[aria-busy="false"] .messaging-history__row')
      .should('have.length', 12)
      .find('.messaging-card__body')
      .should($bodies => expect($bodies.map((index, body) => body.textContent).get())
        .to.deep.equal(tied.map(row => row.attributes.metadata.body)));

    cy
      .then(() => {
        mode = 'missingCursor';
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: tied[11].id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: tied[11].attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Messages could not be loaded.')
      .find('.messaging-history__row')
      .should('have.length', 12)
      .find('.messaging-card__body')
      .should($bodies => expect($bodies.map((index, body) => body.textContent).get())
        .to.deep.equal(tied.map(row => row.attributes.metadata.body)));

    cy
      .then(() => {
        mode = 'ties';
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: tied[11].id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: tied[11].attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('not.contain', 'Messages could not be loaded.')
      .find('.messaging-history__row')
      .should('have.length', 12);

    const deletedDuringRefresh = tied[0];
    const deletionRefresh = holdHistory(() => JSON.parse(JSON.stringify({ data: tied.slice(-10).reverse(), included: [action] })));
    const afterDeletion = createResponseGate(responses);
    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (!deletionRefresh.started || afterDeletion.started || query.get('filter[channel]') !== 'sms,email,mail,fax,portal'
          || query.get('page[limit]') !== '10' || query.has('page[before]')) return;
        return afterDeletion.reply(req, { data: tied.slice(-10).reverse(), included: [action] });
      });

    cy
      .sendWs({ category: 'MetadataUpdated', resource: { id: tied[11].id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { metadata: tied[11].attributes.metadata } } });

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(deletionRefresh.started).to.equal(true));

    let deletionFrame;
    cy
      .window()
      .then(win => {
        deletionFrame = observeInteractionMessage(win, deletedDuringRefresh.id, fixtures);
        tied.shift();
      });

    cy
      .sendWs({ category: 'ResourceDeleted', resource: { id: deletedDuringRefresh.id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: {} } });

    cy
      .then(() => deletionFrame)
      .then(deletionRefresh.release);

    // Hold the follow-up triggered by deletion so it cannot conceal the first result.
    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(afterDeletion.started).to.equal(true))
      .then($history => {
        try {
          expect($history).not.to.contain('Messages could not be loaded.');
          expect($history.find('.messaging-history__row')).to.have.length(11);
        } finally {
          afterDeletion.release();
        }
      });

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('not.contain', 'Messages could not be loaded.')
      .and('not.contain', deletedDuringRefresh.attributes.metadata.body)
      .find('.messaging-history__row')
      .should('have.length', 11);

    const removed = [...tied];
    cy
      .then(() => {
        tied.length = 0;
      });

    for (const row of removed) {
      cy
        .sendWs({ category: 'ResourceDeleted', resource: { id: row.id, type: 'interactions' },
          payload: { patient: { id: testPatient.id }, attributes: {} } });
    }

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'No messages yet.')
      .find('.messaging-history__row')
      .should('not.exist');

    cy
      .then(() => {
        mode = 'moving';
      });

    const moving = createResponseGate(responses);
    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        const query = new URL(req.url).searchParams;
        if (moving.started || query.get('filter[channel]') !== 'sms,email,mail,fax,portal' || query.get('page[before]') !== pending[9].id) return;
        return moving.reply(req, { data: [received], included: [action] });
      })
      .reload();

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(moving.started).to.equal(true));

    let movedFrame;
    cy
      .window()
      .then(win => {
        movedFrame = observeInteractionMessage(win, pending[0].id, fixtures);
      });

    cy
      .then(() => {
        pending[0].attributes.expected_at = '2099-12-21T12:00:00Z';
      });

    cy
      .sendWs({ category: 'InteractionScheduled', resource: { id: pending[0].id, type: 'interactions' },
        payload: { patient: { id: testPatient.id }, attributes: { expected_at: '2099-12-21T12:00:00Z' } } });

    cy
      .then(() => movedFrame)
      .then(() => {
        moving.release();
        return Promise.all([moving.drain, drainInteractionRequests(requestCompletions)]);
      });

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Messages could not be loaded.');

    cy
      .then(() => {
        mode = 'stalled';
        reads = 0;
      });

    const stalled = holdHistory(() => ({ data: pending, included: [] }));
    cy
      .reload();

    cy
      .get('.messaging-history[aria-busy="true"]')
      .should(() => expect(stalled.started).to.equal(true));

    let deletedFrame;
    cy
      .window()
      .then(win => {
        deletedFrame = observeInteractionMessage(win, pending[9].id, fixtures);
      });

    for (const row of pending) {
      cy
        .sendWs({ category: 'ResourceDeleted', resource: { id: row.id, type: 'interactions' },
          payload: { patient: { id: testPatient.id }, attributes: {} } });
    }

    cy
      .then(() => deletedFrame)
      .then(() => {
        stalled.release();
        return Promise.all([stalled.drain, drainInteractionRequests(requestCompletions)]);
      });

    cy
      .get('.messaging-history[aria-busy="false"]')
      .should('contain', 'Messages could not be loaded.')
      .and(() => expect(reads, 'a repeated raw cursor stops after its first older response').to.equal(1));

    for (const next of ['empty', 'nonMessage', 'repeated', 'invalid', 'untimed', 'reversed', 'hidden']) {
      cy
        .then(() => {
          mode = next;
          reads = 0;
        });

      cy
        .reload();

      cy
        .get('.messaging-history[aria-busy="false"]', { timeout: 15000 })
        .should('contain', ['empty', 'nonMessage'].includes(next) ? 'No messages' : 'Messages could not be loaded.');
    }

    cy
      .then(() => expect(reads, 'hidden-only cursor scanning is visibly bounded').to.equal(30));

    const undated = getInteraction({ attributes: { channel: 'sms', direction: 'inbound', occurred_at: null, expected_at: null, metadata: null },
      relationships: { action: { data: null }, flow: { data: null } } });

    cy
      .routePatientInteractions(fx => {
        fx.data = [undated];
        return fx;
      })
      .visit(`/patient/${ testPatient.id }/interactions`);

    cy
      .get('.messaging-timeline-row')
      .should('contain', 'Message content is unavailable.')
      .find('time')
      .should('not.exist');
  });
});
