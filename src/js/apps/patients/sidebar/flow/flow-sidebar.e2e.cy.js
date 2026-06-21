import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { getRelationship, getErrors } from 'helpers/json-api';

import { getActivity } from 'support/api/events';
import { getFlow } from 'support/api/flows';
import { getProgram } from 'support/api/programs';
import { getPatient } from 'support/api/patients';
import { getActions } from 'support/api/actions';
import { stateTodo, stateInProgress } from 'support/api/states';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';

context('flow sidebar', function() {
  specify('display flow sidebar', function() {
    const currentClinician = getCurrentClinician();

    const testProgram = getProgram({
      attributes: {
        name: 'Test Program',
      },
    });

    const testPatient = getPatient();

    const testFlow = getFlow({
      attributes: {
        name: 'Test Flow',
        updated_at: testTs(),
      },
      relationships: {
        program: getRelationship(testProgram),
        state: getRelationship(stateInProgress),
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
      },
      meta: {
        progress: {
          complete: 0,
          total: 3,
        },
      },
    });

    cy
      .routesForPatientDashboard()
      .routeFlow(fx => {
        fx.data = testFlow;

        fx.included.push(testProgram);

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            flow: getRelationship(testFlow),
            state: getRelationship(stateInProgress),
          },
        }, { sample: 3 });

        return fx;
      })
      .routeFlowActivity(fx => {
        fx.data = [
          getActivity({
            event_type: 'FlowCreated',
            source: 'api',
          }),
          getActivity({
            event_type: 'FlowProgramStarted',
            source: 'api',
          }, {
            program: getRelationship(testProgram),
          }),
          getActivity({
            event_type: 'FlowTeamAssigned',
            source: 'api',
          }, {
            team: getRelationship(teamCoordinator),
          }),
          getActivity({
            event_type: 'FlowStateUpdated',
            source: 'api',
          }, {
            state: getRelationship(stateInProgress),
            source: 'api',
          }),
          getActivity({
            event_type: 'FlowClinicianAssigned',
            source: 'api',
          }, {
            clinician: getRelationship(currentClinician),
          }),
          getActivity({
            event_type: 'FlowNameUpdated',
            source: 'api',
            previous: 'evolve portal',
            value: 'cultivate parallelism',
          }),
          getActivity({
            event_type: 'FlowDetailsUpdated',
            source: 'api',
          }),
          getActivity({
            event_type: 'FlowProgramStarted',
            source: 'system',
          }, {
            program: getRelationship(testProgram),
          }),
          getActivity({
            event_type: 'FlowTeamAssigned',
            source: 'system',
          }, {
            team: getRelationship(teamCoordinator),
          }),
          getActivity({
            event_type: 'FlowStateUpdated',
            source: 'system',
          }, {
            state: getRelationship(stateInProgress),
            source: 'system',
          }),
          getActivity({
            event_type: 'FlowClinicianAssigned',
            source: 'system',
          }, {
            clinician: getRelationship(currentClinician),
          }),
          getActivity({
            event_type: 'FlowNameUpdated',
            source: 'system',
            previous: 'evolve portal',
            value: 'cultivate parallelism',
          }),
          getActivity({
            event_type: 'FlowDetailsUpdated',
            source: 'system',
          }),
        ];

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          currentClinician,
          getClinician({
            relationships: {
              team: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header')
      .as('flowHeader')
      .find('.patient-flow__name')
      .click();

    cy
      .intercept('PATCH', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('@flowHeader')
      .should('have.class', 'is-selected')
      .find('[data-state-region] .fa-circle-dot')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('To Do')
      .click()
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
      });

    cy
      .get('@flowHeader')
      .find('[data-owner-region]')
      .contains('CO')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click()
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar');

    cy
      .wait('@routeFlowActivity')
      .get('@flowSidebar')
      .find('[data-activity-region]')
      // source = 'api' activity events
      .should('contain', 'Clinician McTester (Nurse) added this flow from the Test Program program')
      .should('contain', 'Clinician McTester (Nurse) changed the owner to Coordinator')
      .should('contain', 'Clinician McTester (Nurse) changed State to In Progress')
      .should('contain', 'Clinician McTester (Nurse) changed the Owner to Clinician McTester')
      .should('contain', 'Clinician McTester (Nurse) updated the name of this flow from evolve portal to cultivate parallelism')
      .should('contain', 'Clinician McTester (Nurse) updated the details of this flow')
      // source = 'system' activity events
      .should('contain', 'Flow added from the Test Program program')
      .should('contain', 'Owner changed to Coordinator')
      .should('contain', 'Flow state changed to In Progress')
      .should('contain', 'Owner (Nurse) changed to Clinician McTester')
      .should('contain', 'Flow name updated from evolve portal to cultivate parallelism')
      .should('contain', 'Flow details updated');

    cy
      .get('@flowSidebar')
      .should('contain', 'Test Flow')
      .find('[data-state-region]')
      .contains('To Do');

    cy
      .get('@flowSidebar')
      .find('[data-owner-region]')
      .should('contain', 'Nurse')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Coordinator')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamCoordinator.id);
        expect(data.relationships.owner.data.type).to.equal('teams');
      });

    cy
      .get('@flowSidebar')
      .find('[data-owner-region]')
      .should('contain', 'Coordinator')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .should('contain', 'Workspace One');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Clinician McTester')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(currentClinician.id);
        expect(data.relationships.owner.data.type).to.equal('clinicians');
      });

    cy
      .get('@flowHeader')
      .find('[data-owner-region]')
      .contains('Cli');

    cy
      .get('@flowSidebar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Set Flow to Done?')
      .find('.js-submit')
      .click();

    cy
      .get('@flowSidebar')
      .find('[data-state-region]')
      .contains('Done');

    cy
      .get('@flowHeader')
      .find('[data-state-region] .fa-circle-check');

    cy
      .get('@flowHeader')
      .find('[data-owner-region] button')
      .should('be.disabled');

    cy
      .get('@flowSidebar')
      .find('[data-owner-region] button')
      .should('be.disabled');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .as('flowAction')
      .find('[data-state-region] button')
      .should('not.exist');

    cy
      .get('@flowAction')
      .find('[data-owner-region] button')
      .should('not.exist');

    cy
      .get('@flowAction')
      .find('[data-due-date-region] button')
      .should('not.exist');

    cy
      .get('@flowAction')
      .find('[data-due-time-region] button')
      .should('not.exist');

    cy
      .get('@flowSidebar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('In Progress')
      .click();

    cy
      .get('@flowHeader')
      .find('[data-owner-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('Update Owner');

    cy
      .get('@flowSidebar')
      .find('[data-owner-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('Update Owner');

    cy
      .get('@flowSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@flowHeader')
      .should('not.have.class', 'is-selected');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .each(($el, index) => {
        cy
          .wrap($el)
          .find('[data-state-region]')
          .click();

        cy
          .get('.picklist')
          .find('.js-picklist-item')
          .contains('Done')
          .click();
      });

    cy
      .get('@flowHeader')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.modal--small')
      .should('not.exist');

    cy
      .get('.patient-sidebar');

    cy
      .get('.patient-flow__header')
      .find('.patient-flow__name')
      .click();

    cy
      .get('@flowSidebar')
      .find('[data-menu-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Flow')
      .click();

    cy
      .intercept('DELETE', `/api/flows/${ testFlow.id }`, {
        statusCode: 403,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Forbidden',
            detail: 'Insufficient permissions to delete action',
          }),
        },
      })
      .as('routeDeleteFlowFailure');

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeDeleteFlowFailure');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete action');

    cy
      .get('@flowSidebar')
      .find('[data-menu-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Flow')
      .click();

    cy
      .intercept('DELETE', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlow');

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeDeleteFlow');

    cy
      .url()
      .should('contain', `patient/dashboard/${ testPatient.id }`);
  });

  specify('done actions required', function() {
    const testFlow = getFlow({
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

    cy
      .routesForPatientDashboard()
      .routeSettings('require_done_flow', true)
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            flow: getRelationship(testFlow),
            state: getRelationship(stateInProgress),
          },
        }, { sample: 3 });

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActivity()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header')
      .find('.patient-flow__name')
      .click();

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar');

    cy
      .get('@flowSidebar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Flow Actions Must Be Done')
      .find('.js-submit')
      .click();
  });

  specify('flow with work:owned: permissions', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    const testFlow = getFlow({
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(currentClinician),
      },
      meta: {
        progress: {
          complete: 0,
          total: 3,
        },
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routesForPatientDashboard()
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions(fx => {
        fx.data = getActions({
          relationships: {
            flow: getRelationship(testFlow),
            state: getRelationship(stateInProgress),
          },
        }, { sample: 3 });

        return fx;
      })
      .routeFlowActivity()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header')
      .as('flowHeader')
      .find('.patient-flow__name')
      .click();

    cy
      .intercept('PATCH', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar')
      .find('[data-menu-region]')
      .should('not.be.empty');

    cy
      .get('@flowSidebar')
      .find('[data-owner-region]')
      .contains('Clinician')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click()
      .wait('@routePatchFlow');

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar')
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@flowSidebar')
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@flowSidebar')
      .find('[data-menu-region]')
      .should('be.empty');

    cy
      .get('[data-permission-region]')
      .should('contain', 'You are not able to change settings on this flow.');
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

    const testPatient = getPatient();

    const ownedByOtherTeamFlow = getFlow({
      attributes: {
        name: 'Owned by another team',
      },
      relationships: {
        state: getRelationship(stateInProgress),
        owner: getRelationship(teamNurse),
        patient: getRelationship(testPatient),
      },
    });

    const ownedByNonTeamMemberFlow = getFlow({
      attributes: {
        name: 'Owned by non team member',
        updated_at: testTsSubtract(2),
      },
      relationships: {
        state: getRelationship(stateInProgress),
        owner: getRelationship(nonTeamMemberClinician),
        patient: getRelationship(testPatient),
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
      .routeFlow(fx => {
        fx.data = ownedByOtherTeamFlow;

        fx.included.push(testPatient);

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [ownedByOtherTeamFlow, ownedByNonTeamMemberFlow];

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [];

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActivity()
      .visit(`/flow/${ ownedByOtherTeamFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header')
      .find('.patient-flow__name')
      .click();

    cy
      .get('[data-permission-region]')
      .should('contain', 'You are not able to change settings on this flow.');

    cy
      .get('.patient-flow__context-trail .js-patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .routeFlow(fx => {
        fx.data = ownedByNonTeamMemberFlow;

        fx.included.push(testPatient);

        return fx;
      });

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .last()
      .click('top')
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header')
      .find('.patient-flow__name')
      .click();

    cy
      .intercept('PATCH', `/api/flows/${ ownedByOtherTeamFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('[data-permission-region]')
      .should('contain', 'You are not able to change settings on this flow.');
  });

  specify('flow with work:authored:delete permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const testPatient = getPatient();

    const testFlow = getFlow({
      attributes: {
        name: 'Owned by team member',
      },
      relationships: {
        state: getRelationship(stateInProgress),
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
        author: getRelationship(currentClinician),
      },
    });
    cy
      .routesForPatientDashboard()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;

        fx.included.push(testPatient);

        return fx;
      })
      .routePatientByFlow()
      .routeFlowActions()
      .routeFlowActivity()
      .visit(`/flow/${ testFlow.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .get('.patient-flow__header')
      .find('.patient-flow__name')
      .click();

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar')
      .find('[data-menu-region]')
      .should('not.be.empty');
  });
});
