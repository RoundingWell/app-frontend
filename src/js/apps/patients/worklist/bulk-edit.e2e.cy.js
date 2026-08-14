import formatDate from 'helpers/format-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDateAdd } from 'helpers/test-date';
import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { stateTodo, stateInProgress, stateDone } from 'support/api/states';
import { getFlow } from 'support/api/flows';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { testForm } from 'support/api/forms';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';

const tomorrow = testDateAdd(1);

context('Worklist bulk editing', function() {
  specify('date and time components', function() {
    cy
      .routeActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'First In List',
              due_date: testDateAdd(5),
              created_at: testTsSubtract(1),
              due_time: '07:00:00',
            },
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
          getAction({
            attributes: {
              name: 'Last In List',
              due_date: null,
              created_at: testTsSubtract(3),
              due_time: null,
            },
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
          getAction({
            attributes: {
              name: 'Second In List',
              due_date: testDateAdd(3),
              created_at: testTsSubtract(2),
              due_time: '07:00:00',
            },
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
          getAction({
            attributes: {
              name: 'Third In List',
              due_date: testDateAdd(3),
              created_at: testTsSubtract(2),
              due_time: '07:00:00',
            },
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
          getAction({
            attributes: {
              name: 'No Time Due',
              due_date: testDateAdd(6),
              created_at: testTsSubtract(4),
              due_time: null,
            },
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
        ];

        return fx;
      })
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .eq(1)
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .eq(2)
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-due-date-region]')
      .should('contain', formatDate(testDateAdd(3), 'SHORT'));

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .should('contain', '7:00 AM');

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .find('.js-clear')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('.js-cancel')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .eq(2)
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .eq(3)
      .find('.js-select')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .find('.js-tomorrow')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('7:00 AM')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-clear')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-cancel')
      .click();

    cy
      .get('.app-frame__content')
      .contains('.action-card', 'First In List')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .contains('.action-card', 'Second In List')
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .find('[data-due-time-region] button')
      .should('not.be.disabled');

    cy
      .get('.bulk-edit-inline .js-cancel')
      .click();

    cy
      .get('.app-frame__content')
      .contains('.action-card', 'Last In List')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .contains('.action-card', 'No Time Due')
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .find('[data-due-time-region] button')
      .should('be.disabled');
  });

  specify('bulk flows editing', function() {
    const testFlows = [
      getFlow({
        attributes: {
          name: 'First In List',
          details: null,
          created_at: testTs(),
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateTodo),
        },
        meta: {
          progress: { complete: 0, total: 2 },
        },
      }),
      getFlow({
        attributes: {
          name: 'Last In List',
          created_at: testTsSubtract(2),
        },
        relationships: {
          owner: getRelationship(teamNurse),
          state: getRelationship(stateInProgress),
        },
        meta: {
          progress: { complete: 2, total: 2 },
        },
      }),
      getFlow({
        attributes: {
          name: 'Second In List',
          details: null,
          created_at: testTsSubtract(1),
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateTodo),
        },
        meta: {
          progress: { complete: 2, total: 10 },
        },
      }),
    ];

    cy.viewport(1000, 720);

    cy
      .routesForDefault()
      .routeFlows(fx => {
        fx.data = testFlows;

        return fx;
      })
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .first()
      .as('firstRow')
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('In Progress')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .eq(1)
      .find('.js-select')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Flows');

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .should('contain', 'In Progress');

    cy
      .get('.patient-list-page__summary')
      .should('not.be.visible');

    cy
      .get('@bulkEditToolbar')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstRow')
      .find('.js-select')
      .click();

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-scope-region] button')
      .should('contain', 'Flows only');

    cy
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchFlow');

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click()
      .wait(['@patchFlow', '@patchFlow', '@patchFlow']);

    cy
      .get('@firstRow')
      .find('.js-select')
      .click();

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

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
      .find('[data-owner-scope-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('To Do')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Set Flows to Done?')
      .find('.js-submit')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-clear')
      .should('contain', 'Clinician McTester');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .first()
      .should('contain', 'Workspace One')
      .next()
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-scope-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Flows + actions')
      .click();

    cy
      .intercept('PATCH', `/api/flows/${ testFlows[0].id }`, {
        statusCode: 204,
        body: {},
        delay: 100, // give extra time to check button disabled attributes before modal is closed
      })
      .as('patchFlow1')
      .intercept('PATCH', `/api/flows/${ testFlows[2].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchFlow2')
      .intercept('PATCH', `/api/flows/${ testFlows[1].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchFlow3');

    cy
      .intercept('PATCH', `/api/flows/${ testFlows[0].id }/relationships/actions`, {
        statusCode: 204,
        body: {},
      })
      .as('patchOwner1')
      .intercept('PATCH', `/api/flows/${ testFlows[2].id }/relationships/actions`, {
        statusCode: 204,
        body: {},
      })
      .as('patchOwner2')
      .intercept('PATCH', `/api/flows/${ testFlows[1].id }/relationships/actions`, {
        statusCode: 204,
        body: {},
      })
      .as('patchOwner3');

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-scope-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .should('be.disabled');

    cy
      .wait('@patchFlow1')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateDone.id);
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchFlow2')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateDone.id);
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchFlow3')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateDone.id);
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchOwner1')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchOwner2')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .wait('@patchOwner3')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
      });

    cy
      .get('.alert-box')
      .should('contain', '3 Flows have been updated');

    cy
      .get('.app-frame__content')
      .find('.action-card .fa-circle-check, .flow-card .fa-circle-check')
      .should('have.length', 3);

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .last()
      .find('.js-select')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .contains('Done');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region]')
      .contains('NUR');

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click();
  });

  specify('bulk actions editing', function() {
    const testFlow = getFlow({
      relationships: {
        state: getRelationship(stateTodo),
      },
    });

    const testActions = [
      getAction({
        attributes: {
          name: 'First In List',
          duration: 0,
          due_date: null,
          due_time: null,
          created_at: testTs(),
        },
        relationships: {
          owner: getRelationship(getCurrentClinician()),
          state: getRelationship(stateTodo),
          flow: getRelationship(testFlow),
        },
      }),
      getAction({
        attributes: {
          name: 'Last In List',
          due_date: testDateAdd(5),
          created_at: testTsSubtract(3),
        },
        relationships: {
          state: getRelationship(stateTodo),
          flow: getRelationship(testFlow),
        },
      }),
      getAction({
        attributes: {
          name: 'Second In List',
          duration: 0,
          due_date: testDateAdd(3),
          due_time: null,
          created_at: testTsSubtract(1),
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateTodo),
          form: getRelationship(testForm),
          flow: getRelationship(testFlow),
        },
      }),
      getAction({
        attributes: {
          created_at: testTsSubtract(2),
        },
        relationships: {
          state: getRelationship(stateInProgress),
          flow: getRelationship(),
        },
      }),
    ];

    cy
      .routeActions(fx => {
        fx.data = testActions;

        fx.included.push(testFlow);

        return fx;
      })
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchAction');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .first()
      .as('firstRow')
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('actionBulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('In Progress')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .eq(1)
      .find('.js-select')
      .click();

    cy
      .get('@actionBulkEditToolbar')
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Actions');

    cy
      .get('@actionBulkEditToolbar')
      .find('[data-state-region]')
      .should('contain', 'In Progress');

    cy
      .get('@actionBulkEditToolbar')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstRow')
      .find('.js-select')
      .click();

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('.js-save')
      .click()
      .wait(['@patchAction', '@patchAction', '@patchAction', '@patchAction']);

    cy
      .get('@firstRow')
      .find('.js-select')
      .click();

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 4 Actions');

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
      .intercept('PATCH', `/api/actions/${ testActions[0].id }`, {
        statusCode: 204,
        body: {},
        delay: 100, // give extra time to check button disabled attributes before modal is closed
      })
      .as('patchAction1')
      .intercept('PATCH', `/api/actions/${ testActions[2].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchAction2')
      .intercept('PATCH', `/api/actions/${ testActions[1].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchAction3')
      .intercept('PATCH', `/api/actions/${ testActions[3].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('patchAction4');

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('To Do')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse')
      .click();

    cy
      .get('@bulkEditToolbar')
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
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
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
      .find('[data-due-date-region]')
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
      .find('[data-duration-region]')
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
      .find('.picklist__heading')
      .should('contain', 'Apply owner to');

    cy
      .get('.picklist')
      .find('.picklist__input')
      .should('not.exist');

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
      .get('@bulkEditToolbar')
      .find('[data-state-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-duration-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-scope-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .should('be.disabled');

    cy
      .wait(['@patchFlowOwner', '@patchFlowOwner', '@patchFlowOwner'])
      .get('@patchFlowOwner.all').should('have.length', 3);

    cy
      .get('@patchFlowOwner.all')
      .each(interception => {
        expect(interception.request.body.data.relationships.owner.data.id).to.equal(teamNurse.id);
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
      .wait('@patchAction4')
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
      .should('contain', '4 Actions have been updated');

    cy
      .get('.app-frame__content')
      .find('.action-card .fa-circle-exclamation, .flow-card .fa-circle-exclamation')
      .should('have.length', 4);

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .first()
      .find('.js-select')
      .click();

    cy
      .get('[data-state-region]')
      .should('contain', 'To Do');

    cy
      .get('[data-owner-region]')
      .should('contain', 'NUR');

    cy
      .get('[data-due-date-region]')
      .should('contain', formatDate(tomorrow, 'SHORT'));

    cy
      .get('[data-due-time-region]')
      .should('contain', '10:00 AM');

    cy
      .get('[data-duration-region]')
      .should('contain', '5 mins');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 404,
        body: {},
      })
      .as('failedPatchAction');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('10:00 AM')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region]')
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
      .wait('@failedPatchAction')
      .its('request.body.data.attributes')
      .should(attributes => {
        expect(attributes.due_date).to.equal(null);
        expect(attributes.due_time).to.equal(null);
      });

    cy
      .get('.alert-box')
      .should('contain', 'Something went wrong. Please try again.');

    cy
      .get('@failedPatchAction.all')
      .should('have.length', 1);
  });

  specify('bulk flow editing completed', function() {
    cy
      .routeSettings('require_done_flow', true)
      .routeFlows(fx => {
        fx.data = [
          getFlow({
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
          getFlow({
            relationships: {
              state: getRelationship(stateDone),
            },
          }),
        ];

        return fx;
      })
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .first()
      .as('firstRow')
      .find('.js-select');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar');

    cy
      .get('@bulkEditToolbar')
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

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region] button')
      .should('be.disabled');
  });

  specify('bulk action editing completed', function() {
    cy
      .routeFlows()
      .routeActions(fx => {
        fx.data = [
          getAction({
            relationships: {
              state: getRelationship(stateTodo),
            },
          }),
          getAction({
            relationships: {
              state: getRelationship(stateDone),
            },
          }),
        ];

        return fx;
      })
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .first()
      .as('firstRow')
      .find('.js-select');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-owner-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('@bulkEditToolbar')
      .find('[data-duration-region] button')
      .should('be.disabled');
  });

  specify('bulk editing with work:owned:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              created_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(currentClinician),
            },
          }),
          getFlow({
            attributes: {
              created_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(teamCoordinator),
            },
          }),
          getFlow({
            attributes: {
              created_at: testTsSubtract(3),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(teamCoordinator),
            },
          }),
          getFlow({
            attributes: {
              created_at: testTsSubtract(4),
            },
            relationships: {
              state: getRelationship(stateDone),
              owner: getRelationship(currentClinician),
            },
          }),
          getFlow({
            attributes: {
              created_at: testTsSubtract(5),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(currentClinician),
            },
          }),
        ];

        return fx;
      })
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchFlow');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .first()
      .as('firstRow')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .last()
      .as('lastRow')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@lastRow')
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Flow');

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('To Do')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click()
      .wait(['@patchFlow', '@patchFlow']);

    cy
      .get('.alert-box')
      .should('contain', '2 Flows have been updated');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Flows');

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
      .click()
      .wait(['@patchFlow', '@patchFlow']);

    cy
      .get('.alert-box')
      .should('contain', '2 Flows have been updated');

    cy
      .get('[data-select-all-region] button:disabled');
  });

  specify('bulk editing with work:team:manage permission', function() {
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
        fx.data = [currentClinician, nonTeamMemberClinician];

        return fx;
      })
      .routeFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              name: 'Owned by another team',
              created_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamNurse),
            },
          }),
          getFlow({
            attributes: {
              name: 'Owned by non team member',
              created_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(nonTeamMemberClinician),
            },
          }),
        ];

        return fx;
      })
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.action-card, .flow-card')
      .as('listItems')
      .first()
      .find('.js-select')
      .should('not.exist');

    cy
      .get('@listItems')
      .last()
      .find('.js-select')
      .should('not.exist');
  });
});
