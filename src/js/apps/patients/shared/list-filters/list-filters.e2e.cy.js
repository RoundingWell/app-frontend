import { NIL as NIL_UUID } from 'uuid';

import { mergeJsonApi, getRelationship, getErrors } from 'helpers/json-api';

import { workspaceOne, workspaceTwo, getWorkspace } from 'support/api/workspaces';
import { getCurrentClinician } from 'support/api/clinicians';
import { stateTodo, stateInProgress, stateDone, stateUnableToComplete } from 'support/api/states';
import { getFilter } from 'support/api/filters';

const STATE_VERSION = 'v6';

function getCustomFilterButton(label) {
  return cy
    .contains('.list-filters__custom-filter-label', label)
    .parents('.list-filters__custom-filter')
    .find('[data-filter-button]');
}

function getActiveFiltersDot() {
  return cy.get('[data-filters-region] .patient-list-page__active-filter-dot');
}

function expandFiltersSidebar() {
  cy.get('.list-page').then($layout => {
    if ($layout.hasClass('is-filters-collapsed')) {
      cy.wrap($layout).find('[data-filters-region] button').click();
    }
  });
}

function expandFilterSection(region) {
  cy.get(`${ region } .list-filters__section`).then($section => {
    if ($section.hasClass('is-collapsed')) {
      cy.wrap($section).find('.list-filters__section-button').click();
    }
  });
}

context('list filters', function() {
  const currentClinician = getCurrentClinician();
  const testStates = [stateTodo, stateInProgress, stateDone, stateUnableToComplete];

  specify('empty custom filters', function() {
    cy
      .routeActions()
      .routeSettings('custom_filters', [])
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.list-filters__custom-filters')
      .should('contain', 'No custom filters available.');
  });

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

    expandFiltersSidebar();

    cy
      .wait('@routeFilterError')
      .then(interception => {
        // Verify the error response
        expect(interception.response.statusCode).to.equal(410);
        expect(interception.response.body.errors[0].title).to.equal('Not Found');
        expect(interception.response.body.errors[0].detail).to.equal('Cannot find filter');
      });

    cy
      .get('[data-states-filters-region] .list-filters__section-button')
      .should('contain', 'Flow States')
      .and('not.contain', 'Action States');

    cy
      .get('[data-flow-states-filters-region]')
      .should('be.empty');

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .click()
      .wait('@routeActions');

    getActiveFiltersDot().should('exist');

    cy
      .get('.list-filters')
      .as('filtersSidebar')
      .find('.list-filters__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('not.be.disabled');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .should('have.length', 2);

    cy
      .get('@filtersSidebar')
      .find('.list-filters__section-heading')
      .click();

    cy
      .get('@filtersSidebar')
      .find('.list-filters__custom-filters-list')
      .should('not.be.visible');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__section-heading')
      .click();

    cy
      .get('@filtersSidebar')
      .find('.list-filters__custom-filters-list')
      .should('be.visible');

    expandFilterSection('[data-states-filters-region]');
    expandFilterSection('[data-flow-states-filters-region]');

    cy.viewport(1280, 500);

    cy
      .get('.list-filters')
      .as('filtersSidebar')
      .find('.worklist-list__sidebar-controls')
      .should('be.visible')
      .then($controls => {
        const controls = $controls[0].getBoundingClientRect();
        const sortButton = $controls.find('.worklist-list__filter-sort')[0].getBoundingClientRect();

        expect(sortButton.right).to.be.at.most(controls.right);
      });

    cy
      .get('@filtersSidebar')
      .scrollTo('bottom')
      .should($sidebar => {
        expect($sidebar[0].scrollTop).to.be.greaterThan(0);
      });

    cy.viewport(1280, 720);

    getCustomFilterButton('Insurance Plans')
      .should('contain', 'Medicare');

    getCustomFilterButton('Team')
      .should('contain', 'All');

    getCustomFilterButton('Insurance Plans')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('be.disabled');

    getCustomFilterButton('Insurance Plans')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.list-filters__section-button')
      .should('contain', 'Action States');

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

    expandFilterSection('[data-states-filters-region]');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .first()
      .find('.js-select')
      .should('have.attr', 'aria-label', 'Deselect To Do filter')
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

    expandFilterSection('[data-flow-states-filters-region]');

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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    expandFiltersSidebar();

    cy
      .intercept('GET', '/api/filters/**').as('filterReRequest');

    cy
      .get('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.list-page')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.list-page')
      .should('not.have.class', 'is-filters-collapsed');

    // Toggling the mounted filters sidebar should not reload its filter data.
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

    expandFiltersSidebar();
    expandFilterSection('[data-states-filters-region]');

    cy
      .get('.list-filters')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    expandFiltersSidebar();

    cy
      .wait('@routeFilterinsurance');

    cy
      .get('.list-filters')
      .as('filtersSidebar')
      .find('.list-filters__heading')
      .should('contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('not.be.disabled');

    cy
      .get('@filtersSidebar')
      .find('[data-filter-button]')
      .should('have.length', 2);

    getCustomFilterButton('Insurance Plans')
      .should('contain', 'Medicare');

    getCustomFilterButton('Team')
      .should('contain', 'All');

    getCustomFilterButton('Insurance Plans')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('.js-clear-filters')
      .should('be.disabled');

    getCustomFilterButton('Insurance Plans')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
      .should('not.contain', '1');

    cy
      .get('@filtersSidebar')
      .find('[data-states-filters-region]')
      .find('.fa-square-check')
      .should('have.length', 2);

    expandFilterSection('[data-states-filters-region]');
    expandFilterSection('[data-flow-states-filters-region]');

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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
      .should('contain', '2');

    getCustomFilterButton('Insurance Plans')
      .click();

    cy
      .get('.picklist__item')
      .contains('BCBS PPO 100')
      .click()
      .wait('@routeActions');

    getActiveFiltersDot().should('exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
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

    getActiveFiltersDot().should('not.exist');

    cy
      .get('@filtersSidebar')
      .find('.list-filters__heading')
      .should('not.contain', '3');

    expandFiltersSidebar();

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('.list-page')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('.list-page')
      .should('not.have.class', 'is-filters-collapsed');
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

    expandFiltersSidebar();
    expandFilterSection('[data-states-filters-region]');

    cy
      .get('.list-filters')
      .find('[data-states-filters-region] .list-filters__section')
      .children()
      .eq(1)
      .should('contain', 'First In Sequence')
      .next()
      .should('contain', 'Second In Sequence')
      .next()
      .should('contain', 'Third In Sequence');
  });

  specify('latest custom filter request wins', function() {
    let releaseActionFilter;
    const actionFilter = getFilter({
      attributes: {
        name: 'Action Team',
        slug: 'team',
        values: [{ value: 'Old Action Value', total: 1 }],
      },
    });
    const flowFilter = getFilter({
      attributes: {
        name: 'Flow Team',
        slug: 'team',
        values: [{ value: 'Current Flow Value', total: 1 }],
      },
    });

    cy
      .routeActions()
      .routeFlows()
      .routeSettings('custom_filters', ['team'])
      .intercept('GET', '/api/filters/team/actions*', req => {
        return new Cypress.Promise(resolve => {
          releaseActionFilter = () => {
            req.reply({ body: { data: actionFilter, included: [] } });
            resolve();
          };
        });
      })
      .as('routeDelayedActionFilter')
      .intercept('GET', '/api/filters/team/flows*', {
        body: { data: flowFilter, included: [] },
      })
      .as('routeFlowFilter')
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows')
      .wait('@routeFlowFilter')
      .then(() => {
        releaseActionFilter();
      });

    expandFiltersSidebar();

    cy
      .get('.list-filters__custom-filters')
      .should('contain', 'Flow Team');

    cy
      .wait('@routeDelayedActionFilter')
      .get('.list-filters__custom-filters')
      .should('contain', 'Flow Team');

    getCustomFilterButton('Flow Team').click();

    cy
      .get('.picklist')
      .should('contain', 'Current Flow Value')
      .and('not.contain', 'Old Action Value');
  });
});
