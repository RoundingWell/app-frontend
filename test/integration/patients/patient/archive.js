import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { workspaceOne } from 'support/api/workspaces';
import { testForm } from 'support/api/forms';
import { stateDone, stateInProgress, stateTodo } from 'support/api/states';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { teamCoordinator, teamNurse } from 'support/api/teams';

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

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          getAction({
            id: '1',
            attributes: {
              name: 'First In List',
              details: 'Action details content.',
              duration: 0,
              due_date: null,
              due_time: null,
              updated_at: testTs(),
            },
            relationships: {
              owner: getRelationship(currentClinican),
              patient: getRelationship(testPatient),
              state: getRelationship(stateDone),
              form: getRelationship(testForm),
              files: getRelationship([{ id: '1' }], 'files'),
              comments: getRelationship([{ id: uuid() }], 'files'),
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
              patient: getRelationship(testPatient),
            },
          }),
          getFlow({
            id: '2',
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

        return fx;
      })
      .routeAction(fx => {
        fx.data = getAction({
          id: '1',
          relationships: {
            state: getRelationship(stateDone),
            form: getRelationship(testForm),
            patient: getRelationship(testPatient),
          },
        });

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
      .should('contain', 'filter[states]=55555,66666,77777');

    // Filters only done id 55555
    cy
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 4);

    cy
      .intercept('PATCH', '/api/actions/1', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .intercept('PATCH', '/api/flows/2', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .first()
      .should('contain', 'First In List')
      .next()
      .should('contain', 'Second In List')
      .next()
      .should('contain', 'Third In List')
      .next()
      .should('contain', 'Last In List');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Action details content.');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-due-date-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-due-time-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .eq(2)
      .find('.fa-paperclip')
      .should('not.exist');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .eq(2)
      .find('.fa-comment')
      .should('not.exist');

    cy
      .get('.patient__list')
      .should('contain', 'Second In List')
      .find('.patient__flow-icon');

    cy
      .get('.patient__list')
      .contains('First In List')
      .click();

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-owner-region] button')
      .should('contain', 'Clinician McTester')
      .should('be.disabled');

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-due-date-region] button')
      .should('be.disabled');

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-state-region]')
      .find('.fa-circle-check')
      .click();

    cy
      .get('.picklist')
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
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 3);

    cy
      .get('.sidebar')
      .find('.fa-circle-dot')
      .click();

    cy
      .get('.picklist')
      .contains('To Do')
      .click();

    cy
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 3);

    cy
      .get('.sidebar')
      .contains('To Do')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 4);

    cy
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .get('.patient__list')
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
      .should('contain', 'flow/2');

    cy
      .go('back');

    cy
      .get('@flowItem')
      .find('.fa-circle-check')
      .click();

    cy
      .get('.picklist')
      .contains('To Do')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
      });

    cy
      .get('@flowItem')
      .find('.fa-circle-exclamation');

    cy
      .get('.patient__list')
      .find('tr')
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
      .should('contain', `patient-action/1/form/${ testForm.id }`);
  });

  specify('work with work:owned:manage permission', function() {
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
        fx.data = getPatient({
          relationships: {
            workspaces: getRelationship(workspaceOne),
          },
        });

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          getAction({
            id: '1',
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
              files: getRelationship([{ id: '1' }], 'files'),
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
            id: '2',
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
      .visit('/patient/archive/1')
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.patient__list')
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
      id: '22222',
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
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
        fx.data = getPatient({
          relationships: {
            workspaces: getRelationship(workspaceOne),
          },
        });

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
      .visit('/patient/archive/1')
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.patient__list')
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
