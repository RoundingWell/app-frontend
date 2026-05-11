import { NIL as NIL_UUID } from 'uuid';

import { mergeJsonApi, getRelationship, getErrors } from 'helpers/json-api';

import { workspaceOne, workspaceTwo, getWorkspace } from 'support/api/workspaces';
import { getCurrentClinician } from 'support/api/clinicians';
import { stateTodo, stateInProgress, stateDone, stateUnableToComplete } from 'support/api/states';
import { getFilter } from 'support/api/filters';

const STATE_VERSION = 'v6';

context('filter sidebar', function() {
  const currentClinician = getCurrentClinician();
  const testStates = [stateTodo, stateInProgress, stateDone, stateUnableToComplete];

  specify('worklist filtering', function() {
    // Handle uncaught exceptions from failed filter requests
    cy.on('uncaught:exception', () => {
      return false;
    });

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      customFilters: {
        insurance: 'Medicare',
      },
      states: [stateTodo.id, stateInProgress.id],
      flowStates: [stateTodo.id, stateInProgress.id],
    }));

    const errors = getErrors({
      status: '410',
      title: 'Not Found',
      detail: 'Cannot find filter',
    });

    cy
      .routeWorkspaces(fx => {
        fx.data = [
          getWorkspace({
            relationships: {
              'states': getRelationship(testStates),
            },
          }, { id: workspaceOne.id }),
          getWorkspace({
            relationships: {
              'states': getRelationship(testStates),
            },
          }, { id: workspaceTwo.id }),
        ];

        return fx;
      })
      .routeStates(fx => {
        fx.data = testStates;

        return fx;
      })
      .routeActions()
      .routeFlows()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .intercept('GET', '/api/filters/error/**', {
        statusCode: 410,
        body: { errors },
      })
      .as('routeFilterError')
      .routeFilter(fx => {
        fx.data = getFilter({
          attributes: {
            name: 'Team',
            slug: 'team',
            values: [
              { value: 'Coordinator', total: 2 },
              { value: 'Nurse', total: 1 },
            ],
          },
        });

        return fx;
      }, 'team')
      .routeFilter(fx => {
        fx.data = getFilter({
          attributes: {
            name: 'Insurance Plans',
            slug: 'insurance',
            values: [
              { value: 'BCBS PPO 100', total: 0 },
              { value: 'Medicare', total: 1 },
            ],
          },
        });

        return fx;
      }, 'insurance')
      .routeSettings('custom_filters', ['team', 'insurance', 'error'])
      .visit('/worklist/owned-by')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[@insurance]=Medicare')
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`)
      .should('contain', `filter[flow_states]=${ stateTodo.id },${ stateInProgress.id }`);

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click()
      .wait('@routeFilterError')
      .then(interception => {
        // Verify the error response
        expect(interception.response.statusCode).to.equal(410);
        expect(interception.response.body.errors[0].title).to.equal('Not Found');
        expect(interception.response.body.errors[0].detail).to.equal('Cannot find filter');
      });

    cy
      .get('[data-flow-states-filters-region]')
      .should('be.empty');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .click()
      .wait('@routeActions');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '1');

    cy
      .get('.app-frame__sidebar .sidebar')
      .as('filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('not.be.disabled');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .should('have.length', 2)
      .first()
      .get('.sidebar__label')
      .should('contain', 'Insurance Plans')
      .get('[data-filter-button]')
      .should('contain', 'Medicare');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .eq(1)
      .get('.sidebar__label')
      .should('contain', 'Team')
      .get('[data-filter-button]')
      .should('contain', 'All');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .first()
      .click();

    cy
      .get('.picklist')
      .find('.js-input')
      .should('have.attr', 'placeholder', 'Insurance Plans...');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .should('have.length', 2)
      .first()
      .find('.js-picklist-item')
      .contains('1');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .last()
      .find('.js-picklist-item')
      .should('have.length', 1);

    cy
      .get('.picklist__item')
      .contains('All')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters.insurance).to.be.null;
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[@insurance]');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('be.disabled');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .first()
      .click();

    cy
      .get('.picklist__item')
      .contains('BCBS PPO 100')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters.insurance).to.equal('BCBS PPO 100');
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[@insurance]=BCBS PPO 100');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters.insurance).to.be.undefined;
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[@insurance]');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .get('.sidebar__heading')
      .should('contain', 'States');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .should('contain', 'To Do')
      .should('contain', 'In Progress')
      .should('contain', 'Done')
      .should('contain', 'Unable to Complete');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .first()
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateInProgress.id }`)
      .should('not.contain', `filter[states]=${ stateTodo.id }`);

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .should('contain', 'To Do')
      .should('contain', 'In Progress')
      .should('contain', 'Done')
      .should('contain', 'Unable to Complete');

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('[data-check-region]')
      .first()
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.flowStates).to.deep.equal([stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[flow_states]=${ stateInProgress.id }`)
      .should('not.contain', `filter[flow_states]=${ stateTodo.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 1);

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 3);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(1)
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ NIL_UUID }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 0);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 4);

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('[data-check-region]')
      .eq(1)
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.flowStates).to.deep.equal([]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[flow_states]=${ NIL_UUID }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 0);

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 4);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(1)
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateInProgress.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 1);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 3);

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateTodo.id, stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[flow_states]=${ stateTodo.id },${ stateInProgress.id }`)
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@filtersSidebar')
      .should('not.exist');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('@filtersSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@filtersSidebar')
      .should('not.exist');

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('@filtersSidebar')
      .should('exist');

    cy
      .intercept('GET', '/api/filters/**').as('filterReRequest');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('@filtersSidebar')
      .should('exist');

    // if the filters sidebar is already open, it should not reload on filters button click
    cy
      .get('@filterReRequest.all')
      .should('have.length', 0);
  });

  specify('worklist filtering - done states', function() {
    cy
      .routeWorkspaces(fx => {
        fx.data[0] = getWorkspace({
          relationships: {
            'states': getRelationship(testStates),
          },
        }, { id: workspaceOne.id });

        return fx;
      })
      .routeStates(fx => {
        fx.data = testStates;

        return fx;
      })
      .routeActions()
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .visit('/worklist/done-last-thirty-days')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateDone.id },${ stateUnableToComplete.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.app-frame__sidebar .sidebar')
      .as('filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 0);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .should('not.contain', 'To Do')
      .should('not.contain', 'In Progress')
      .should('contain', 'Done')
      .should('contain', 'Unable to Complete');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .first()
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`done-last-thirty-days_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateUnableToComplete.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateUnableToComplete.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 1);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 1);

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`done-last-thirty-days_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateDone.id, stateUnableToComplete.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateDone.id },${ stateUnableToComplete.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square')
      .should('have.length', 0);
  });

  specify('schedule filtering', function() {
    localStorage.setItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      customFilters: {
        insurance: 'Medicare',
      },
      states: [stateTodo.id, stateInProgress.id],
      flowStates: [stateTodo.id, stateInProgress.id],
    }));

    cy
      .routeFilter()
      .routeFilter(fx => {
        fx.data = getFilter({
          attributes: {
            name: 'Team',
            slug: 'team',
            values: [
              { value: 'Coordinator', total: 2 },
              { value: 'Nurse', total: 1 },
            ],
          },
        });

        return fx;
      }, 'team')
      .routeFilter(fx => {
        fx.data = getFilter({
          attributes: {
            name: 'Insurance Plans',
            slug: 'insurance',
            values: [
              { value: 'BCBS PPO 100', total: 0 },
              { value: 'Medicare', total: 1 },
            ],
          },
        });

        return fx;
      }, 'insurance');

    cy
      .routeSettings('custom_filters', ['team', 'insurance'])
      .routeActions()
      .visit('/schedule')
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[clinicians]=${ currentClinician.id }`)
      .should('contain', 'filter[@insurance]=Medicare')
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`)
      .should('contain', `filter[flow_states]=${ stateTodo.id },${ stateInProgress.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '1');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click()
      .wait('@routeFilterinsurance');

    cy
      .get('.app-frame__sidebar .sidebar')
      .as('filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('not.be.disabled');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .should('have.length', 2)
      .first()
      .get('.sidebar__label')
      .should('contain', 'Insurance Plans')
      .get('[data-filter-button]')
      .should('contain', 'Medicare');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .eq(1)
      .get('.sidebar__label')
      .should('contain', 'Team')
      .get('[data-filter-button]')
      .should('contain', 'All');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .first()
      .click();

    cy
      .get('.picklist')
      .find('.js-input')
      .should('have.attr', 'placeholder', 'Insurance Plans...');

    cy
      .get('.picklist__item')
      .contains('All')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters.insurance).to.be.null;
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[@insurance]');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('be.disabled');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .first()
      .click();

    cy
      .get('.picklist__item')
      .contains('BCBS PPO 100')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters.insurance).to.equal('BCBS PPO 100');
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[@insurance]=BCBS PPO 100');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters.insurance).to.be.undefined;
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[@insurance]');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .first()
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateInProgress.id }`)
      .should('not.contain', `filter[states]=${ stateTodo.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('[data-check-region]')
      .first()
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.flowStates).to.deep.equal([stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[flow_states]=${ stateInProgress.id }`)
      .should('not.contain', `filter[flow_states]=${ stateTodo.id }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(1)
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ NIL_UUID }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-flow-states-filters-region]')
      .find('[data-check-region]')
      .eq(1)
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.flowStates).to.deep.equal([]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[flow_states]=${ NIL_UUID }`);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '2');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .first()
      .click();

    cy
      .get('.picklist__item')
      .contains('BCBS PPO 100')
      .click()
      .wait('@routeActions');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('contain', '3');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('contain', '3');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.states).to.deep.equal([stateTodo.id, stateInProgress.id]);
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`)
      .should('contain', `filter[flow_states]=${ stateTodo.id },${ stateInProgress.id }`)
      .should('not.contain', 'filter[@insurance]');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '3');

    cy
      .get('@filtersSidebar')
      .find('.sidebar__heading')
      .should('not.contain', '3');

    cy
      .get('@filtersSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@filtersSidebar')
      .should('not.exist');

    cy
      .intercept('GET', '/api/filters/team/**', {
        delay: 1000,
        body: {
          data: getFilter({
            attributes: {
              name: 'Team',
              slug: 'team',
              values: [
                { value: 'Coordinator', total: 2 },
                { value: 'Nurse', total: 1 },
              ],
            },
          }),
          included: [],
        },
      })
      .as('delayedRouteFilterTeam');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.app-frame__sidebar .sidebar')
      .as('filtersSidebar')
      .find('.js-close')
      .click();

    cy
      .wait('@delayedRouteFilterTeam');

    cy
      .get('@filtersSidebar')
      .should('not.exist');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('@filtersSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@filtersSidebar')
      .should('not.exist');

    cy
      .get('[data-filters-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('@filtersSidebar')
      .should('exist');
  });

  specify('states sorted by sequence value', function() {
    const testSequenceStates = [
      mergeJsonApi(stateTodo, {
        attributes: {
          name: 'Second In Sequence',
          sequence: 200,
          status: 'queued',
        },
      }),
      mergeJsonApi(stateInProgress, {
        attributes: {
          name: 'Third In Sequence',
          sequence: 300,
          status: 'queued',
        },
      }),
      mergeJsonApi(stateDone, {
        attributes: {
          name: 'First In Sequence',
          sequence: 100,
          status: 'queued',
        },
      }),
    ];

    cy
      .routeStates(fx => {
        fx.data = testSequenceStates;

        return fx;
      })
      .routeWorkspaces(fx => {
        fx.data[0] = getWorkspace({
          relationships: {
            'states': getRelationship(testSequenceStates),
          },
        }, { id: workspaceOne.id });

        return fx;
      })
      .routeActions()
      .routeFlows()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.app-frame__sidebar .sidebar')
      .find('[data-states-filters-region] .sidebar__section')
      .children()
      .eq(1)
      .should('contain', 'First In Sequence')
      .next()
      .should('contain', 'Second In Sequence')
      .next()
      .should('contain', 'Third In Sequence');
  });
});
