import _ from 'underscore';
import dayjs from 'dayjs';
import { NIL as NIL_UUID } from 'uuid';

import { ACTION_OUTREACH } from 'js/static';

import formatDate from 'helpers/format-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateAdd, testDateSubtract } from 'helpers/test-date';
import { getRelationship } from 'helpers/json-api';

import { getActions, getAction } from 'support/api/actions';
import { getPatient } from 'support/api/patients';
import { getPatientField } from 'support/api/patient-fields';
import { getFlow, getFlows } from 'support/api/flows';
import { getCurrentClinician, getClinician } from 'support/api/clinicians';
import { stateTodo, stateInProgress, stateDone } from 'support/api/states';
import { getWidget } from 'support/api/widgets';
import { roleAdmin, roleEmployee, roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { workspaceOne } from 'support/api/workspaces';
import { testForm } from 'support/api/forms';
import { getComment } from 'support/api/comments';

const testPatient1 = getPatient({
  id: '1',
  attributes: {
    first_name: 'Test',
    last_name: 'Patient',
  },
});

const testPatient2 = getPatient({
  id: '2',
  attributes: {
    first_name: 'Other',
    last_name: 'Patient',
  },
});

const STATE_VERSION = 'v6';

context('worklist page', function() {
  specify('flow list', function() {
    localStorage.setItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: '11111',
      customFilters: {},
      actionsSelected: {},
      flowsSelected: {
        '1': true,
      },
    }));

    cy
      .routesForPatientAction()
      .routeFlows(fx => {
        fx.data = [
          getFlow({
            id: '1',
            attributes: {
              name: 'First In List',
              updated_at: testTs(),
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateTodo),
              patient: getRelationship(testPatient1),
            },
            meta: {
              progress: {
                complete: 0,
                total: 2,
              },
            },
          }),
          getFlow({
            attributes: {
              name: 'Last In List',
              updated_at: testTsSubtract(2),
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient2),
            },
          }),
          getFlow({
            id: '2',
            attributes: {
              name: 'Second In List',
              details: null,
              updated_at: testTsSubtract(1),
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateTodo),
              patient: getRelationship(testPatient1),
            },
            meta: {
              progress: {
                complete: 2,
                total: 10,
              },
            },
          }),
        ];

        fx.included.push(testPatient1, testPatient2);

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient1;
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
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('not.contain', 'fields[flows]=name,state');

    cy
      .get('[data-filters-region]')
      .as('filterRegion')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 1 Flow');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Flows');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .should('have.class', 'is-selected')
      .find('.js-select')
      .click();

    cy
      .get('@firstRow')
      .find('.js-select')
      .click('top');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('@firstRow')
      .find('.js-select')
      .click('top');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('@firstRow')
      .find('.js-select')
      .click('top');

    cy
      .get('[data-select-all-region] button:enabled')
      .should('not.be.checked')
      .parent()
      .next()
      .find('button')
      .should('contain', 'Edit 2 Flows')
      .next()
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 0);

    cy
      .get('.table-list')
      .find('.table-list__item')
      .first()
      .as('firstRow');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .should('not.have.class', 'button--blue')
      .should('contain', 'Actions')
      .next()
      .should('contain', 'Flows')
      .should('have.class', 'button--blue');

    cy
      .get('.list-page__header')
      .find('.table-list__header')
      .eq(2)
      .should('contain', 'Flow')
      .next()
      .should('contain', 'State, Owner');

    cy
      .intercept('PATCH', '/api/flows/1', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('@firstRow')
      .find('.worklist-list__flow-progress')
      .should('have.value', 0);

    cy
      .get('@firstRow')
      .find('.worklist-list__flow-progress')
      .should('have.attr', 'max', '2');

    cy
      .get('@firstRow')
      .find('.fa-circle-exclamation')
      .should('not.match', 'button');

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
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
      .get('@firstRow')
      .click('top')
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .url()
      .should('contain', 'flow/1');

    cy
      .go('back');

    cy
      .get('@firstRow')
      .contains('Test Patient')
      .click();

    cy
      .url()
      .should('contain', 'patient/dashboard/1')
      .wait('@routePatient');

    cy
      .go('back')
      .wait('@routeFlows');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .click()
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');
  });

  specify('done flow list', function() {
    cy
      .routeFlows(fx => {
        fx.data = getFlows({
          relationships: {
            state: getRelationship(stateDone),
          },
        }, { sample: 3 });

        return fx;
      })
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/done-last-thirty-days')
      .wait('@routeActions');


    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', `filter[updated_at]=${ dayjs(testDate()).startOf('day').subtract(30, 'days').format() }`)
      .should('contain', 'filter[states]=55555,66666,77777');

    cy
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.table-list')
      .find('.table-list__item')
      .first()
      .as('firstRow');

    cy
      .get('@firstRow')
      .find('[data-state-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal('33333');
      });
  });

  specify('action list', function() {
    const testFlow = getFlow({
      id: '1',
      attributes: {
        name: 'Test Flow',
      },
      relationships: {
        state: getRelationship(stateInProgress),
      },
    });

    const testActions = [
      getAction({
        id: '1',
        attributes: {
          name: 'First In List',
          details: 'Like the legend of the phoenix All ends with beginnings What keeps the planet spinning The force from the beginning Look We\'ve come too far To give up who we are So let\'s raise the bar And our cups to the stars',
          due_date: testDate(),
          due_time: '06:01:00',
          updated_at: testTs(),
        },
        relationships: {
          state: getRelationship(stateTodo),
          flow: getRelationship(testFlow),
          files: getRelationship([{ id: '1' }], 'files'),
          owner: getRelationship(teamCoordinator),
          patient: getRelationship(testPatient1),
          comments: getRelationship(getComment()),
        },
      }),
      getAction({
        id: '3',
        attributes: {
          name: 'Last In List',
          details: 'Details gonna detail',
          due_date: testDateAdd(5),
          due_time: null,
          updated_at: testTsSubtract(2),
          outreach: ACTION_OUTREACH.PATIENT,
        },
        relationships: {
          state: getRelationship(stateDone),
          owner: getRelationship(teamCoordinator),
          patient: getRelationship(testPatient1),
        },
      }),
      getAction({
        id: '2',
        attributes: {
          name: 'Second In List',
          details: null,
          due_date: testDateAdd(3),
          due_time: '10:00:00',
          updated_at: testTsSubtract(1),
        },
        relationships: {
          state: getRelationship(stateTodo),
          form: getRelationship(testForm),
          owner: getRelationship(teamCoordinator),
          patient: getRelationship(testPatient1),
        },
      }),
    ];

    const testTime = dayjs(testDate()).hour(12).valueOf();

    localStorage.setItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: '11111',
      customFilters: {},
      actionsSelected: {
        '1': true,
      },
      flowsSelected: {},
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = testActions;

        fx.included.push(testPatient1, testFlow);

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient1;
        return fx;
      })
      .routeAction(fx => {
        fx.data = testActions[0];
        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .visitOnClock('/worklist/owned-by', { now: testTime, functionNames: ['Date'] });

    cy
      .get('[data-filters-region]')
      .as('filterRegion')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 1 Action');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Actions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'First In List')
      .should('contain', 'Test Flow')
      .should('have.class', 'is-selected')
      .next()
      .should('contain', 'Second In List')
      .next()
      .should('contain', 'Last In List');

    cy
      .get('@firstRow')
      .find('.js-select')
      .find('.fa-square-check')
      .click();

    cy
      .get('@firstRow')
      .should('not.have.class', 'is-selected')
      .find('.js-select')
      .find('.fa-square');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .should('contain', 'Actions')
      .should('have.class', 'button--blue')
      .next()
      .should('not.have.class', 'button--blue')
      .should('contain', 'Flows');

    cy
      .get('.list-page__header')
      .find('.table-list__header')
      .eq(2)
      .should('contain', 'Action')
      .next()
      .should('contain', 'State, Owner, Due, Form')
      .next()
      .should('contain', 'Added')
      .next()
      .should('contain', 'Updated');

    cy
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .get('@firstRow')
      .click('top')
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .url()
      .should('contain', 'flow/1/action/1');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .routeAction(fx => {
        fx.data = testActions[2];
        return fx;
      });

    cy
      .get('@firstRow')
      .next()
      .as('secondRow')
      .click('top');

    cy
      .url()
      .should('contain', 'patient/1/action/2')
      .wait('@routeAction');

    cy
      .get('.patient__layout')
      .find('.patient__tab--selected')
      .contains('Dashboard');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .get('@firstRow')
      .contains('Test Patient')
      .click();

    cy
      .url()
      .should('contain', 'patient/dashboard/1')
      .wait('@routePatient');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .get('@firstRow')
      .contains('Test Flow')
      .click();

    cy
      .url()
      .should('contain', 'flow/1/action/1')
      .wait('@routeFlowActions');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .routeAction(fx => {
        fx.data = testActions[1];
        return fx;
      });

    cy
      .get('@secondRow')
      .next()
      .click('top')
      .wait('@routePatientActions');

    cy
      .get('.patient__layout')
      .find('.patient__tab--selected')
      .contains('Archive');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .intercept('PATCH', '/api/actions/1', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('@firstRow')
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
        expect(data.relationships.state.data.id).to.equal('33333');
      });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
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
      .get('@firstRow')
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
      .get('@firstRow')
      .find('[data-due-date-region] .is-overdue');

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_date).to.equal(dayjs(testDateSubtract(1, 'month')).date(1).format('YYYY-MM-DD'));
      });

    cy
      .get('@firstRow')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .contains('Today')
      .click();

    cy
      .get('@firstRow')
      .find('[data-due-date-region]')
      .should('contain', formatDate(testDate(), 'SHORT'));

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_date).to.equal(testDate());
      });

    cy
      .get('@firstRow')
      .find('[data-due-time-region]')
      .contains('6:01 AM')
      .click();

    cy
      .get('.picklist')
      .contains('9:30 AM')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('09:30:00');
      });

    cy
      .get('@firstRow')
      .find('[data-due-time-region]')
      .find('.is-overdue');

    cy
      .get('@firstRow')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .contains('Clear')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_date).to.be.equal(null);
        expect(data.attributes.due_time).to.be.equal(null);
      });

    cy
      .get('@firstRow')
      .find('[data-due-time-region] button')
      .should('be.disabled');

    cy
      .get('@firstRow')
      .find('.fa-paperclip')
      .should('exist');

    cy
      .get('@secondRow')
      .find('.fa-paperclip')
      .should('not.exist');

    cy
      .get('@firstRow')
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy
      .get('@secondRow')
      .find('.fa-comment')
      .should('not.exist');

    cy
      .get('@secondRow')
      .next()
      .find('.fa-circle-check')
      .should('not.be.disabled');

    cy
      .get('@secondRow')
      .next()
      .find('[data-owner-region] button')
      .should('be.disabled');

    cy
      .get('@secondRow')
      .next()
      .find('[data-due-date-region] button')
      .should('be.disabled');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('[data-form-region]')
      .should('be.empty');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Details gonna detail');

    cy
      .get('@secondRow')
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Test Flow')
      .should('contain', 'First In List')
      .should('contain', 'Like the legend of the phoenix All ends with beginnings What keeps the planet spinning The force from the beginning Look We\'ve come too far...');

    cy
      .routeAction(fx => {
        fx.data = testActions[2];
        return fx;
      });

    cy
      .get('@secondRow')
      .find('[data-form-region] button')
      .click()
      .wait('@routeFormByAction');

    cy
      .url()
      .should('contain', `patient-action/2/form/${ testForm.id }`);

    cy
      .go('back');
  });

  specify('actions on a done-flow list', function() {
    const testFlow = getFlow({
      id: '1',
      attributes: {
        name: 'Test Flow',
      },
      relationships: {
        state: getRelationship(stateDone),
      },
    });

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = getActions({
          relationships: {
            flow: getRelationship(testFlow),
          },
        });

        fx.included.push(testFlow);

        return fx;
      })
      .visit('/worklist/owned-by');

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'fields[flows]=name,state');

    cy
      .get('.worklist-list__meta')
      .find('button')
      .should('not.exist');
  });

  specify('maximum list count reached', function() {
    localStorage.setItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: '11111',
      customFilters: {},
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = _.times(50, n => {
          const actionName = n === 0 ? 'First Action' : `Action ${ n + 1 }`;
          const patient = n % 2 ? testPatient1 : testPatient2;

          return getAction({
            id: `${ n }`,
            attributes: {
              name: actionName,
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateTodo),
              patient: getRelationship(patient),
            },
          });
        });

        fx.included.push(testPatient1, testPatient2);

        fx.meta = {
          actions: { total: 1000 },
        };

        return fx;
      })
      .routeFlows(fx => {
        fx.data = _.times(50, n => {
          const flowName = n === 0 ? 'First Flow' : `Flow ${ n + 1 }`;
          const patient = n % 2 ? testPatient1 : testPatient2;

          return getFlow({
            id: `${ n }`,
            attributes: {
              name: flowName,
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateTodo),
              patient: getRelationship(patient),
            },
          });
        });

        fx.included.push(testPatient1, testPatient2);

        fx.meta = {
          flows: { total: 1000 },
        };

        return fx;
      })
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 50 of 1,000 Actions.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .type('First Action');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 1 of 50 Actions.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('@listSearch')
      .next()
      .click()
      .prev()
      .type('Test Patient');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 25 of 50 Actions.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('@listSearch')
      .next()
      .click()
      .prev()
      .type('Action');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 50 of 1,000 Actions.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 50 of 1,000 Flows.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .type('First Flow');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 1 of 50 Flows.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('@listSearch')
      .next()
      .click()
      .prev()
      .type('Test Patient');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 25 of 50 Flows.')
      .should('contain', 'Try narrowing your filters.');

    cy
      .get('@listSearch')
      .next()
      .click()
      .prev()
      .type('Flow');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 50 of 1,000 Flows.')
      .should('contain', 'Try narrowing your filters.');
  });

  specify('non-existent worklist', function() {
    cy
      .visit('/worklist/test')
      .url()
      .should('contain', '404');
  });

  specify('clinician filtering', function() {
    const relationships = {
      team: getRelationship(teamCoordinator),
      role: getRelationship(roleEmployee),
    };

    cy
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          getCurrentClinician({ relationships }),
          getClinician({
            id: 'test-clinician',
            attributes: { name: 'Test Clinician' },
            relationships,
          }),
          getClinician({
            id: '1',
            attributes: { name: 'C Clinician' },
            relationships,
          }),
          getClinician({
            id: '2',
            attributes: { name: 'A Clinician' },
            relationships,
          }),
          getClinician({
            id: '3',
            attributes: { name: 'B Clinician' },
            relationships,
          }),
          getClinician({
            id: '4',
            attributes: { name: 'Admin Clinician' },
            relationships: {
              team: getRelationship(teamCoordinator),
              role: getRelationship(roleAdmin),
            },
          }),
        ];

        return fx;
      })
      .routeFlows()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[clinicians]=11111')
      .should('contain', 'filter[states]=22222,33333');

    cy
      .get('[data-owner-filter-region]')
      .should('contain', 'Clinician McTester')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group .js-picklist-item')
      .should('not.contain', 'Admin Clinician');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .contains('Workspace One')
      .parent()
      .find('.js-picklist-item')
      .first()
      .should('contain', 'A Clinician')
      .next()
      .should('contain', 'B Clinician')
      .next()
      .should('contain', 'C Clinician')
      .next()
      .should('contain', 'Clinician McTester')
      .next()
      .should('contain', 'Test Clinician')
      .click();

    cy
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[clinicians]=test-clinician')
      .should('contain', 'filter[states]=22222,33333');

    cy
      .get('.list-page__title')
      .should('contain', 'Test Clinician');

    cy
      .get('[data-owner-filter-region]')
      .should('contain', 'Test Clinician')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .should('contain', 'Clinician McTester')
      .click();

    cy
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[clinicians]=11111')
      .should('contain', 'filter[states]=22222,33333');

    cy
      .get('.list-page__title')
      .should('contain', 'Clinician McTester');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-owner-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Test Clinician')
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[clinicians]=test-clinician');
  });

  specify('owner filtering', function() {
    cy
      .routeWorkspaceClinicians(fx => {
        const relationships = {
          role: getRelationship(roleEmployee),
        };

        fx.data = [
          getCurrentClinician({ relationships }),
          getClinician({
            id: 'test-clinician',
            attributes: { name: 'Test Clinician' },
            relationships: {
              team: getRelationship(teamCoordinator),
              role: getRelationship(roleEmployee),
            },
          }),
          getClinician({
            id: '1',
            attributes: { name: 'C Clinician' },
            relationships,
          }),
          getClinician({
            id: '2',
            attributes: { name: 'A Clinician' },
            relationships,
          }),
          getClinician({
            id: '3',
            attributes: { name: 'B Clinician' },
            relationships,
          }),
        ];

        return fx;
      })
      .routeFlows()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .routeActions()
      .visit('/worklist/new-past-day')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('[data-owner-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Coordinator')
      .click();

    cy
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', `filter[teams]=${ teamCoordinator.id }`);

    cy
      .get('[data-owner-filter-region]')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('C Clinician')
      .click();

    cy
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[clinicians]=1');

    cy
      .get('[data-owner-toggle-region]')
      .should('be.empty');

    cy
      .get('.app-frame__nav')
      .find('.app-nav__link')
      .contains('Shared By')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-owner-filter-region]')
      .should('contain', 'Nurse')
      .find('button')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .should('contain', 'Filter by Team');

    cy
      .get('[data-owner-toggle-region]')
      .contains('No Owner')
      .should('not.have.class', 'button--blue')
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[clinicians]=${ NIL_UUID }`)
      .should('contain', 'filter[teams]=22222');

    cy
      .get('[data-owner-toggle-region]')
      .contains('No Owner')
      .should('have.class', 'button--blue')
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', `filter[clinicians]=${ NIL_UUID }`)
      .should('contain', 'filter[teams]=22222');
  });

  // TODO: Move to component tests
  specify('date filtering', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();
    const filterDate = testDateSubtract(1);

    localStorage.setItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: '11111',
      customFilters: {},
      actionsDateFilters: {
        selectedDate: filterDate,
        dateType: 'created_at',
      },
      actionsSelected: {
        '1': true,
      },
      flowsSelected: {},
      listType: 'flows',
    }));


    cy
      .routeFlows()
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visitOnClock('/worklist/owned-by', { now: testTime, functionNames: ['Date'] })
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', `filter[created_at]=${ dayjs(testDate()).startOf('month').format() },${ dayjs(testDate()).endOf('month').format() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Added:')
      .should('contain', 'This Month')
      .click();

    cy
      .get('[data-date-type-region]')
      .should('not.contain', 'Due');

    cy
      .get('.worklist-list__toggle')
      .find('.js-toggle-actions')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Added:')
      .should('contain', formatDate(filterDate, 'MM/DD/YYYY'))
      .find('.js-prev')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateSubtract(2), 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedDate, 'YYYY-MM-DD')).to.be.equal(testDateSubtract(2));
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.selectedWeek).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateSubtract(2), 'MM/DD/YYYY'))
      .find('.js-next')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(filterDate, 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedDate, 'YYYY-MM-DD')).to.be.equal(filterDate);
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(filterDate, 'MM/DD/YYYY'))
      .click();

    cy
      .get('[data-date-type-region]')
      .contains('Updated')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Last Week')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedWeek).to.be.null;
        expect(storage.actionsDateFilters.relativeDate).to.equal('lastweek');
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Last Week')
      .find('.js-next')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(dayjs(testDate()).startOf('week'), 'MM/DD/YYYY'))
      .should('contain', formatDate(dayjs(testDate()).endOf('week'), 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Last Week')
      .find('.js-next')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedWeek, 'YYYY-MM-DD')).to.be.equal(dayjs(testDate()).startOf('week').format('YYYY-MM-DD'));
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .contains(`Updated: ${ dayjs(testDate()).startOf('week').format('MM/DD/YYYY') } - ${ dayjs(testDate()).endOf('week').format('MM/DD/YYYY') }`)
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Select from calendar')
      .click();

    cy
      .get('.app-frame__pop-region')
      .find('.js-current-month')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.equal('thismonth');
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.dateType).to.be.equal('updated_at');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[updated_at]=${ dayjs(testDate()).startOf('month').format() },${ dayjs(testDate()).endOf('month').format() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Updated:')
      .should('contain', 'This Month')
      .find('.js-prev')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateSubtract(1, 'month'), 'MMM YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedMonth, 'MMM YYYY')).to.equal(formatDate(testDateSubtract(1, 'month'), 'MMM YYYY'));
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
      });

    const lastMonth = testDateSubtract(1, 'month');
    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[updated_at]=${ dayjs(lastMonth).startOf('month').format() },${ dayjs(lastMonth).endOf('month').format() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(lastMonth, 'MMM YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('This Month')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'This Month')
      .find('.js-next')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateAdd(1, 'month'), 'MMM YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedMonth, 'MMM YYYY')).to.equal(formatDate(testDateAdd(1, 'month'), 'MMM YYYY'));
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateAdd(1, 'month'), 'MMM YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Due')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Today')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.equal('today');
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.dateType).to.equal('due_date');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ testDate() },${ testDate() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Due:')
      .should('contain', 'Today')
      .find('.js-prev')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateSubtract(1), 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedDate, 'YYYY-MM-DD')).to.equal(testDateSubtract(1));
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateSubtract(1), 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Added')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Today')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Added:')
      .should('contain', 'Today')
      .find('.js-next')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateAdd(1), 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedDate, 'YYYY-MM-DD')).to.equal(formatDate(testDateAdd(1), 'YYYY-MM-DD'));
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.dateType).to.equal('created_at');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[created_at]=${ dayjs(testDateAdd(1)).startOf('day').format() },${ dayjs(testDateAdd(1)).endOf('day').format() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateAdd(1), 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Yesterday')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.equal('yesterday');
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[created_at]=${ dayjs(testDateSubtract(1)).startOf('day').format() },${ dayjs(testDateSubtract(1)).endOf('day').format() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Yesterday')
      .find('.js-prev')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateSubtract(2), 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedDate, 'YYYY-MM-DD')).to.equal(testDateSubtract(2));
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateSubtract(2), 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Yesterday')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Yesterday')
      .find('.js-next')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDate(), 'MM/DD/YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.actionsDateFilters.selectedDate, 'YYYY-MM-DD')).to.equal(testDate());
        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDate(), 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Select from calendar')
      .click();

    cy
      .get('.datepicker')
      .find('.js-month')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(formatDate(storage.actionsDateFilters.selectedMonth, 'MMM YYYY')).to.equal(formatDate(testDate(), 'MMM YYYY'));
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[created_at]=${ dayjs(testDate()).startOf('month').format() },${ dayjs(testDate()).endOf('month').format() }`);

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDateSubtract(1, 'month'), 'MMM YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(formatDate(storage.actionsDateFilters.selectedMonth, 'MMM YYYY')).to.equal(formatDate(testDateSubtract(1, 'month'), 'MMM YYYY'));
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateSubtract(1, 'month'), 'MMM YYYY'))
      .find('.js-next')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', formatDate(testDate(), 'MMM YYYY'));

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDate(), 'MMM YYYY'))
      .find('.js-next')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.be.null;
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(formatDate(storage.actionsDateFilters.selectedMonth, 'MMM YYYY')).to.equal(formatDate(testDateAdd(1, 'month'), 'MMM YYYY'));
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDateAdd(1, 'month'), 'MMM YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Select from calendar')
      .click();

    cy
      .get('.datepicker')
      .find('.js-prev')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Updated')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Updated')
      .should('have.class', 'button--blue');

    cy
      .get('.app-frame__pop-region')
      .contains('Due')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Due')
      .should('have.class', 'button--blue');

    cy
      .get('.app-frame__pop-region')
      .contains('Added')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Added')
      .should('have.class', 'button--blue');

    cy
      .get('.datepicker')
      .find('.is-today')
      .click()
      .wait('@routeActions');

    cy
      .get('.datepicker')
      .should('not.exist');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Added:')
      .should('contain', formatDate(testDate(), 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('All Time')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.equal('alltime');
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.dateType).to.equal('created_at');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[created_at]');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'All Time');

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .should('not.exist');

    cy
      .get('[data-date-filter-region]')
      .find('.js-next')
      .should('not.exist');
  });

  specify('restricted employee', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleAdmin),
          },
        });

        return fx;
      })
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('[data-owner-filter-region]')
      .should('be.empty');
  });

  specify('restricted employee -  shared by', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleAdmin),
          },
        });
        return fx;
      })
      .routeActions()
      .visit('/worklist/shared-by')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[clinicians]=${ NIL_UUID }`);

    cy
      .get('[data-owner-filter-region]')
      .find('button');

    cy
      .get('[data-owner-toggle-region]')
      .should('be.empty');
  });

  specify('flow sorting', function() {
    // NOTE: All In Progress
    const relationships = {
      state: getRelationship(stateInProgress),
    };

    cy
      .routeFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              name: 'Updated Most Recent',
              updated_at: testTsSubtract(1),
              created_at: testTsSubtract(2),
            },
            relationships,
          }),
          getFlow({
            attributes: {
              name: 'Updated Least Recent',
              updated_at: testTsSubtract(10),
              created_at: testTsSubtract(2),
            },
            relationships,
          }),
          getFlow({
            attributes: {
              name: 'Created Most Recent',
              updated_at: testTsSubtract(2),
              created_at: testTsSubtract(1),
            },
            relationships,
          }),
          getFlow({
            attributes: {
              name: 'Created Least Recent',
              updated_at: testTsSubtract(2),
              created_at: testTsSubtract(10),
            },
            relationships,
          }),
        ];

        return fx;
      })
      .routeActions()
      .visit('/worklist/shared-by')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'include=patient.patient-fields.foo');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Created Most Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Created Least Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Added: Oldest - Newest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Created Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Updated: Oldest - Newest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Updated Least Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Updated: Newest - Oldest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Updated Least Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .should('not.contain', 'Due');
  });

  specify('flow sorting - patient', function() {
    const patientA = getPatient({
      attributes: {
        first_name: 'APatient',
        last_name: 'AName',
      },
    });

    const patientB = getPatient({
      attributes: {
        first_name: 'BPatient',
        last_name: 'AName',
      },
    });

    const patientC = getPatient({
      attributes: {
        first_name: 'APatient',
        last_name: 'BName',
      },
    });

    cy
      .routeFlows(fx => {
        fx.data = [
          getFlow({ relationships: { patient: getRelationship(patientB) } }),
          getFlow({ relationships: { patient: getRelationship(patientC) } }),
          getFlow({ relationships: { patient: getRelationship(patientA) } }),
        ];

        fx.included.push(patientA, patientB, patientC);

        return fx;
      })
      .routeActions()
      .visit('/worklist/shared-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Patient Last: A')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'APatient AName');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'APatient BName');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Patient Last: Z')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'APatient BName');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'APatient AName');
  });

  specify('flow sorting alphabetical - patient field', function() {
    const fieldA = getPatientField({
      attributes: {
        name: 'foo',
        value: { value: 'A' },
      },
    });

    const fieldB = getPatientField({
      attributes: {
        name: 'foo',
        value: { value: 'B' },
      },
    });

    const patientA = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field A',
      },
      relationships: {
        'patient-fields': getRelationship([fieldA]),
      },
    });

    const patientB = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field None',
      },
      relationships: {
        'patient-fields': getRelationship([]),
      },
    });

    const patientC = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field B',
      },
      relationships: {
        'patient-fields': getRelationship([fieldB]),
      },
    });

    cy
      .routeFlows(fx => {
        fx.data = [
          getFlow({ relationships: { patient: getRelationship(patientB) } }),
          getFlow({ relationships: { patient: getRelationship(patientC) } }),
          getFlow({ relationships: { patient: getRelationship(patientA) } }),
        ];

        fx.included.push(fieldA, fieldB, patientA, patientB, patientC);

        return fx;
      })
      .routeActions()
      .visit('/worklist/shared-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Highest - Lowest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Patient Field B');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Patient Field None');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Lowest - Highest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Patient Field None');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Patient Field B');
  });

  specify('flow sorting numerical - patient field', function() {
    const field1 = getPatientField({
      attributes: {
        name: 'foo',
        value: { value: 1 },
      },
    });

    const field2 = getPatientField({
      attributes: {
        name: 'foo',
        value: { value: 2 },
      },
    });

    const patient1 = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field 1',
      },
      relationships: {
        'patient-fields': getRelationship([field1]),
      },
    });

    const patient2 = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field None',
      },
      relationships: {
        'patient-fields': getRelationship([]),
      },
    });

    const patient3 = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field 2',
      },
      relationships: {
        'patient-fields': getRelationship([field2]),
      },
    });

    cy
      .routeSettings(fx => {
        const sortingSettings = _.find(fx.data, setting => setting.id === 'sorting');
        _.each(sortingSettings.attributes.value, function(sortMethod) {
          sortMethod.sort_type = 'numeric';
        });

        return fx;
      })
      .routeFlows(fx => {
        fx.data = [
          getFlow({ relationships: { patient: getRelationship(patient2) } }),
          getFlow({ relationships: { patient: getRelationship(patient3) } }),
          getFlow({ relationships: { patient: getRelationship(patient1) } }),
        ];

        fx.included.push(field1, field2, patient1, patient2, patient3);

        return fx;
      })
      .routeActions()
      .visit('/worklist/shared-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Highest - Lowest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Patient Field 2');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Patient Field None');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Lowest - Highest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Patient Field None');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Patient Field 2');
  });

  specify('action sorting - preload', function() {
    localStorage.setItem(`shared-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'shared-by',
      actionsSortId: 'sortNotExisting',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: '11111',
      customFilters: {},
      actionsDateFilters: {
        selectedDate: testDate(),
        dateType: 'created_at',
      },
      actionsSelected: {},
      flowsSelected: {},
      listType: 'actions',
    }));

    cy
      .routesForPatientAction()
      .intercept('GET', '/api/actions*', { delay: 1000, body: { data: [] } })
      .visit('/worklist/shared-by');

    cy
      .get('.worklist-list__filter-sort')
      .should('contain', 'Added: Newest - Oldest')
      .click()
      .get('.picklist')
      .contains('Added: Oldest - Newest')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`shared-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsSortId).to.equal('sortCreatedAsc');
      });
  });

  specify('action sorting', function() {
    const sortingActions = [
      {
        name: 'Updated Most Recent',
        due_date: testDateAdd(3),
        due_time: null,
        updated_at: testTsSubtract(1),
        created_at: testTsSubtract(8),
      },
      {
        name: 'Updated Least Recent',
        due_date: testDateAdd(3),
        due_time: null,
        updated_at: testTsSubtract(10),
        created_at: testTsSubtract(8),
      },
      {
        name: 'Due Date Least Recent',
        due_date: testDateAdd(1),
        due_time: null,
        updated_at: testTsSubtract(3),
        created_at: testTsSubtract(8),
      },
      {
        name: 'Due Date Most Recent',
        due_date: testDateAdd(10),
        due_time: null,
        updated_at: testTsSubtract(3),
        created_at: testTsSubtract(8),
      },
      {
        name: 'Due Time Most Recent',
        due_date: testDateAdd(2),
        due_time: '11:00:00',
        updated_at: testTsSubtract(3),
        created_at: testTsSubtract(8),
      },
      {
        name: 'Due Time Least Recent',
        due_date: testDateAdd(2),
        due_time: '12:15:00',
        updated_at: testTsSubtract(3),
        created_at: testTsSubtract(8),
      },
      {
        name: 'Created Most Recent',
        due_date: testDateAdd(3),
        due_time: null,
        updated_at: testTsSubtract(2),
        created_at: testTsSubtract(1),
      },
      {
        name: 'Created Least Recent',
        due_date: testDateAdd(3),
        due_time: null,
        updated_at: testTsSubtract(2),
        created_at: testTsSubtract(10),
      },
    ];

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = _.map(sortingActions, attributes => {
          return getAction({
            attributes,
            relationships: {
              state: getRelationship(stateInProgress),
            },
          });
        });

        return fx;
      })
      .visit('/worklist/shared-by');

    cy
      .get('.worklist-list__filter-sort')
      .should('contain', 'Added: Newest - Oldest')
      .click()
      .get('.picklist')
      .contains('Added: Oldest - Newest')
      .click()
      .wait('@routeActions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Created Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Updated: Oldest - Newest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Updated Least Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Updated: Newest - Oldest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Updated Least Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Added: Oldest - Newest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Added: Newest - Oldest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Created Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Due: Sooner - Later')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .next()
      .should('contain', 'Due Time Most Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .next()
      .next()
      .should('contain', 'Due Time Least Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Due: Later - Sooner')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .prev()
      .should('contain', 'Due Time Most Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .prev()
      .prev()
      .should('contain', 'Due Time Least Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Action: A - Z')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Action: Z - A')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .contains('Updated Most Recent')
      .click()
      .wait('@routeAction');

    cy
      .get('.patient__context-trail')
      .contains('Back to List')
      .click()
      .wait('@routeActions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .contains('Updated Most Recent');

    cy
      .get('.worklist-list__filter-sort')
      .contains('Action: Z - A');
  });

  specify('action sorting - patient', function() {
    const patientA = getPatient({
      attributes: {
        first_name: 'APatient',
        last_name: 'AName',
      },
    });

    const patientB = getPatient({
      attributes: {
        first_name: 'BPatient',
        last_name: 'AName',
      },
    });

    const patientC = getPatient({
      attributes: {
        first_name: 'APatient',
        last_name: 'BName',
      },
    });

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = [
          getAction({ relationships: { patient: getRelationship(patientB) } }),
          getAction({ relationships: { patient: getRelationship(patientC) } }),
          getAction({ relationships: { patient: getRelationship(patientA) } }),
        ];

        fx.included.push(patientA, patientB, patientC);

        return fx;
      })
      .visit('/worklist/shared-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Patient Last: A')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'APatient AName');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'APatient BName');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Patient Last: Z')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'APatient BName');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'APatient AName');
  });

  specify('action sorting - patient field', function() {
    const fieldA = getPatientField({
      attributes: {
        name: 'foo',
        value: { value: 'A' },
      },
    });

    const fieldB = getPatientField({
      attributes: {
        name: 'foo',
        value: { value: 'B' },
      },
    });

    const patientA = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field A',
      },
      relationships: {
        'patient-fields': getRelationship([fieldA]),
      },
    });

    const patientB = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field None',
      },
      relationships: {
        'patient-fields': getRelationship([]),
      },
    });

    const patientC = getPatient({
      attributes: {
        first_name: 'Patient',
        last_name: 'Field B',
      },
      relationships: {
        'patient-fields': getRelationship([fieldB]),
      },
    });

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = [
          getAction({ relationships: { patient: getRelationship(patientB) } }),
          getAction({ relationships: { patient: getRelationship(patientC) } }),
          getAction({ relationships: { patient: getRelationship(patientA) } }),
        ];

        fx.included.push(fieldA, fieldB, patientA, patientB, patientC);

        return fx;
      })
      .visit('/worklist/shared-by')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'include=patient.patient-fields.foo');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Highest - Lowest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Patient Field B');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Field None');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Lowest - Highest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .should('contain', 'Field None');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .should('contain', 'Patient Field B');
  });

  specify('find in list', function() {
    const lastYear = dayjs().year() - 1;

    localStorage.setItem(`owned-by_11111_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: '11111',
      customFilters: {},
      flowsDateFilters: {
        selectedMonth: `${ lastYear }-02-01`,
        dateType: 'created_at',
      },
      actionsSelected: {},
      flowsSelected: {},
      listType: 'flows',
    }));

    cy
      .routesForPatientDashboard()
      .routeFlows(fx => {
        const otherFlows = getFlows({
          attributes: {
            created_at: dayjs(`${ lastYear }-02-30`).format(),
            updated_at: dayjs(`${ lastYear }-02-31`).format(),
          },
          relationships: {
            patient: getRelationship(testPatient2),
          },
        }, { sample: 3 });

        fx.data = [
          getFlow({
            attributes: {
              name: 'Test Flow',
              updated_at: dayjs(`${ lastYear }-02-05`).format(),
              created_at: dayjs(`${ lastYear }-02-04`).format(),
            },
            relationships: {
              patient: getRelationship(testPatient1),
              owner: getRelationship('11111', 'clinicians'),
              state: getRelationship(stateInProgress),
            },
          }),
          getFlow({
            attributes: {
              name: 'Flow - Coordinator',
              updated_at: dayjs(`${ lastYear }-02-06`).format(),
              created_at: dayjs(`${ lastYear }-02-04`).format(),
            },
            relationships: {
              patient: getRelationship(testPatient1),
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateInProgress),
            },
          }),
          getFlow({
            attributes: {
              name: 'Flow - Team/State Search',
              updated_at: dayjs(`${ lastYear }-02-07`).format(),
              created_at: dayjs(`${ lastYear }-02-04`).format(),
            },
            relationships: {
              patient: getRelationship(testPatient1),
              owner: getRelationship(teamNurse),
              state: getRelationship(stateInProgress),
            },
          }),
          ...otherFlows,
        ];

        fx.included.push(testPatient1, testPatient2);

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient1;
        return fx;
      })
      .routePatientByAction()
      .routeActions()
      .visit('/worklist/owned-by');

    cy
      .get('[data-count-region]')
      .should('not.contain', '6 Flows');

    cy
      .wait('@routeFlows');

    cy
      .get('[data-count-region]')
      .should('contain', '6 Flows');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .should('have.attr', 'placeholder', 'Find in List...')
      .focus()
      .type('abcd')
      .next()
      .should('have.class', 'js-clear');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .list-search__container')
      .should('have.class', 'is-applied');

    cy
      .get('[data-count-region] div')
      .should('be.empty');

    cy
      .get('.list-page__list')
      .as('flowList')
      .find('.table-empty-list')
      .should('contain', 'No results match your Find in List search');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('.list-page__header')
      .find('[data-search-region] .list-search__container')
      .should('not.have.class', 'is-applied');

    cy
      .get('[data-count-region]')
      .should('contain', '6 Flows');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .should('have.length', 6);

    cy
      .get('@listSearch')
      .type('Test');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Flows');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .should('have.length', 3);

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('Feb 7');

    cy
      .get('[data-count-region]')
      .should('contain', '1 Flow')
      .should('not.contain', 'Flows');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .should('have.length', 1);

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('Feb 4');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Flows');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .should('have.length', 3);

    cy
      .get('[data-select-all-region]')
      .find('button')
      .click();

    cy
      .get('@flowList')
      .find('.work-list__item .fa-square-check')
      .should('have.length', 3);

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-check');

    cy
      .get('[data-filters-region]')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-minus');

    cy
      .get('[data-filters-region]')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('[data-select-all-region]')
      .find('button')
      .click();

    cy
      .get('@flowList')
      .find('.work-list__item .fa-square-check')
      .should('have.length', 6)
      .first()
      .click();

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-minus');

    cy
      .get('@listSearch')
      .type('Feb 4');

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-check');

    cy
      .get('[data-filters-region]')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('@listSearch')
      .next()
      .click()
      .should('not.be.visible');

    cy
      .get('@listSearch')
      .type('Clinician');

    cy
      .get('[data-count-region]')
      .should('contain', '1 Flow')
      .should('not.contain', 'Flows');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .should('have.length', 1)
      .first()
      .should('contain', 'Test Flow');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('Flow Coordinator');

    cy
      .get('[data-count-region]')
      .should('contain', '1 Flow')
      .should('not.contain', 'Flows');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .should('have.length', 1)
      .first()
      .should('contain', 'Flow - Coordinator');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('In Progress');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .contains('Flow - Team/State Search');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('Nurse');

    cy
      .get('@flowList')
      .find('.work-list__item')
      .contains('Flow - Team/State Search');

    cy
      .get('[data-date-filter-region]')
      .find('button.js-prev')
      .click();

    cy
      .wait('@routeFlows');

    cy
      .get('@listSearch')
      .invoke('val')
      .should('equal', 'Nurse');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Schedule')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Owned By')
      .click()
      .wait('@routeFlows');

    cy
      .get('@listSearch')
      .should('have.attr', 'value', 'Nurse');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .list-search__container')
      .should('have.class', 'is-applied');
  });

  specify('click+shift multiselect', function() {
    cy
      .routeActions(fx => {
        fx.data = getActions({}, { sample: 3 });

        return fx;
      })
      .routeFlows()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visitOnClock('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .tick(60) // tick past debounce
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .as('lastTableListItem')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('[data-filters-region]')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('[data-filters-region]')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 1);

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 1);

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .focus()
      .type('abcd');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 2);

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .click()
      .wait('@routeActions');

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 2);

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .navigate('/schedule');

    cy
      .go('back');

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.table-list__item.is-selected')
      .should('have.length', 2);
  });

  specify('patient sidebar', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
        sex: 'u',
      },
    });

    const testFlow = getFlow({
      attributes: {
        name: 'Test Flow Item',
      },
      relationships: {
        owner: getRelationship(teamCoordinator),
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlows(fx => {
        fx.data = [
          testFlow,
        ];

        fx.included.push(testPatient);

        return fx;
      })
      .routeActions(fx => {
        fx.data = [
          getAction({
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateTodo),
              patient: getRelationship(testPatient),
              flow: getRelationship(testFlow),
            },
          }),
        ];

        fx.included.push(testPatient);
        fx.included.push(testFlow);

        return fx;
      })
      .routeSettings(fx => {
        fx.data[0].attributes = {
          value: {
            widgets: ['sex', 'hbsWidget'],
          },
        };

        return fx;
      })
      .routeWidgets(fx => {
        fx.data = [
          ...fx.data,
          getWidget({
            attributes: {
              category: 'widget',
              slug: 'hbsWidget',
              definition: {
                template: '{{testField}}',
                display_name: 'Test Field Widget',
              },
              values: {
                testField: '@patient.testField',
              },
            },
          }),
        ];

        return fx;
      })
      .routeWidgetValues(fx => {
        fx.values = {
          testField: 'Test Field',
        };

        return fx;
      })
      .routeFlow()
      .routeFlowActions()
      .visit('/worklist/owned-by')
      .wait('@routeWidgets')
      .wait('@routeActions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow');

    cy
      .get('@firstRow')
      .find('.worklist-list__patient-sidebar-icon .js-patient-sidebar-button')
      .click();

    cy
      .get('.app-frame__sidebar .worklist-patient-sidebar')
      .as('patientSidebar')
      .find('.worklist-patient-sidebar__patient-name')
      .should('contain', 'Test Patient')
      .click()
      .wait('@routePrograms');

    cy
      .url()
      .should('contain', `patient/dashboard/${ testPatient.id }`);

    cy
      .get('.patient-sidebar')
      .find('.patient-sidebar__name')
      .should('contain', 'Test Patient');

    cy
      .go('back');

    cy
      .get('@firstRow')
      .find('.js-patient-sidebar-button')
      .click();

    cy
      .get('@patientSidebar')
      .contains('View Patient Dashboard')
      .click()
      .wait('@routePrograms');

    cy
      .url()
      .should('contain', `patient/dashboard/${ testPatient.id }`);

    cy
      .get('.patient-sidebar')
      .find('.patient-sidebar__name')
      .should('contain', 'Test Patient');

    cy
      .go('back');

    cy
      .get('@firstRow')
      .find('.js-patient-sidebar-button')
      .click();

    cy
      .get('@patientSidebar')
      .find('.patient-sidebar__section')
      .first()
      .should('contain', 'Sex')
      .should('contain', 'Unknown/Other')
      .next()
      .should('contain', 'Test Field Widget')
      .should('contain', 'Test Field');

    cy
      .get('@patientSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@patientSidebar')
      .should('not.exist');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .find('.js-patient-sidebar-button')
      .click();

    cy
      .get('@patientSidebar')
      .find('.worklist-patient-sidebar__patient-name')
      .should('contain', 'Test Patient');

    cy
      .get('[data-date-filter-region]')
      .find('button.js-prev')
      .click();

    cy
      .get('@patientSidebar')
      .should('not.exist');
  });

  specify('empty flows view', function() {
    cy
      .routeFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('[data-count-region] div')
      .should('be.empty');

    cy
      .get('.table-empty-list')
      .contains('No Flows');
  });

  specify('empty actions view', function() {
    cy
      .routeActions(fx => {
        fx.data = [];

        return fx;
      })
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('[data-count-region] div')
      .should('be.empty');

    cy
      .get('.table-empty-list')
      .contains('No Actions');
  });

  specify('actions with work:owned:manage permission', function() {
    const testActions = [
      {
        attributes: {
          created_at: testTs(),
          name: 'Owned',
        },
        relationships: {
          owner: getRelationship('11111', 'clinicians'),
          state: getRelationship(stateTodo),
          form: getRelationship(),
        },
      },
      {
        attributes: {
          created_at: testTsSubtract(1),
          name: 'Different Owner',
        },
        relationships: {
          owner: getRelationship('22222', 'clinicians'),
          state: getRelationship(stateTodo),
        },
      },
      {
        attributes: {
          created_at: testTsSubtract(3),
          name: 'Owned by Team',
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateTodo),
        },
      },
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });
        return fx;
      })
      .routeActions(fx => {
        fx.data = _.map(testActions, getAction);

        return fx;
      })
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('[data-filters-region]')
      .find('.js-bulk-edit')
      .should('contain', 'Edit 1 Action');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('.worklist-list__meta')
      .find('button:enabled')
      .should('have.length', 4);

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('.worklist-list__meta')
      .find('button')
      .should('not.exist');
  });

  specify('flows with work:owned:manage permission', function() {
    const testFlows = [
      {
        attributes: {
          created_at: testTsSubtract(1),
          name: 'Owned by Clinician',
        },
        relationships: {
          owner: getRelationship('11111', 'clinicians'),
          state: getRelationship(stateTodo),
        },
      },
      {
        attributes: {
          created_at: testTsSubtract(2),
          name: 'Owned by Team',
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateTodo),
        },
      },
      {
        attributes: {
          created_at: testTsSubtract(3),
          name: 'Done',
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateDone),
        },
      },
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });
        return fx;
      })
      .routeFlows(fx => {
        fx.data = _.map(testFlows, getFlow);

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
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('@firstRow')
      .next()
      .as('secondRow')
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@secondRow')
      .find('[data-state-region]')
      .find('.fa-circle-exclamation');

    cy
      .get('@secondRow')
      .find('[data-owner-region]')
      .should('contain', 'CO')
      .find('button')
      .should('not.exist');

    cy
      .get('@secondRow')
      .next()
      .as('thirdRow')
      .find('[data-state-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@thirdRow')
      .find('[data-state-region]')
      .find('.fa-circle-check');

    cy
      .get('@thirdRow')
      .find('[data-owner-region]')
      .should('contain', 'CO')
      .find('button')
      .should('not.exist');
  });

  specify('actions with work:team:manage permission', function() {
    const testActions = [
      {
        attributes: {
          name: 'Owned by current clinician’s team',
          created_at: testTsSubtract(1),
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateInProgress),
        },
      },
      {
        attributes: {
          name: 'Owned by team member',
          created_at: testTsSubtract(2),
        },
        relationships: {
          owner: getRelationship('2', 'clinicians'),
          state: getRelationship(stateInProgress),
        },
      },
      {
        attributes: {
          name: 'Owned by another team',
          created_at: testTsSubtract(3),
        },
        relationships: {
          owner: getRelationship(teamNurse),
          state: getRelationship(stateInProgress),
        },
      },
      {
        attributes: {
          name: 'Owned by non team member',
          created_at: testTsSubtract(4),
        },
        relationships: {
          owner: getRelationship('3', 'clinicians'),
          state: getRelationship(stateInProgress),
        },
      },
    ];

    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          currentClinician,
          getClinician({
            id: '2',
            attributes: {
              name: 'Team Member',
            },
            relationships: {
              team: getRelationship(teamCoordinator),
            },
          }),
          getClinician({
            id: '3',
            attributes: {
              name: 'Non Team Member',
            },
            relationships: {
              team: getRelationship(teamNurse),
            },
          }),
        ];

        return fx;
      })
      .routeActions(fx => {
        fx.data = _.map(testActions, getAction);

        return fx;
      })
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .eq(2)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  specify('flows with work:team:manage permission', function() {
    const testFlows = [
      {
        attributes: {
          name: 'Owned by current clinician’s team',
          created_at: testTsSubtract(1),
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateInProgress),
        },
      },
      {
        attributes: {
          name: 'Owned by another team',
          created_at: testTsSubtract(1),
        },
        relationships: {
          owner: getRelationship(teamNurse),
          state: getRelationship(stateInProgress),
        },
      },
      {
        attributes: {
          name: 'Owned by non team member',
          created_at: testTsSubtract(2),
        },
        relationships: {
          owner: getRelationship('2', 'clinicians'),
          state: getRelationship(stateInProgress),
        },
      },
    ];

    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          currentClinician,
          getClinician({
            id: '2',
            attributes: {
              name: 'Non Team Member',
            },
            relationships: {
              team: getRelationship(teamNurse),
            },
          }),
        ];
        return fx;
      })
      .routeFlows(fx => {
        fx.data = _.map(testFlows, getFlow);
        return fx;
      })
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .last()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  // NOTE: needs to be moved to base class component tests
  specify('change sort before list is done loading', function() {
    cy
      .routesForPatientAction()
      .routeFlows()
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .intercept('GET', '/api/actions*', { delay: 1000, body: { data: [] } })
      .visit('/worklist/owned-by');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Added:')
      .should('contain', 'This Month')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Last Week')
      .click();

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Patient Last: A')
      .click();
  });

  specify('500 error', function() {
    cy
      .routesForPatientAction()
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[states]=22222,33333');

    cy
      .intercept('GET', '/api/actions?*', {
        statusCode: 500,
        body: {},
      })
      .as('routeActions');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.app-frame__sidebar .sidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(0)
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[states]=33333');

    cy
      .routeActions();

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[states]=22222,33333');
  });
});
