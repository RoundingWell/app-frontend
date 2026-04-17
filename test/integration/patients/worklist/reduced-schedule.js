import _ from 'underscore';

import { testDate, testDateAdd } from 'helpers/test-date';
import { getRelationship } from 'helpers/json-api';

import { getCurrentClinician } from 'support/api/clinicians';
import { roleReducedEmployee } from 'support/api/roles';
import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';
import { getPatient } from 'support/api/patients';
import { stateTodo, stateInProgress } from 'support/api/states';
import { getFlow } from 'support/api/flows';
import { teamCoordinator } from 'support/api/teams';
import { workspaceOne } from 'support/api/workspaces';

const STATE_VERSION = 'v6';

context('reduced schedule page', function() {
  specify('display schedule', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleReducedEmployee),
      },
    });

    const testPatient = getPatient({
      attributes: {
        first_name: 'First',
        last_name: 'Last',
      },
    });

    const testFlow = getFlow();

    const testAction = getAction({
      attributes: {
        name: 'Test Action',
        due_date: testDate(),
        due_time: null,
      },
      relationships: {
        patient: getRelationship(testPatient),
        form: getRelationship(testForm),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeActions(fx => {
        fx.data = [
          testAction,
          getAction({
            attributes: {
              name: 'Test Flow Action',
              due_date: testDateAdd(1),
              due_time: null,
            },
            relationships: {
              patient: getRelationship(testPatient),
              flow: getRelationship(testFlow),
              state: getRelationship(stateTodo),
            },
          }),
          getAction({
            attributes: {
              name: 'Action With No Due Date',
              due_date: null,
              due_time: null,
            },
            relationships: {
              patient: getRelationship(testPatient),
              state: getRelationship(stateTodo),
            },
          }),
        ];

        fx.included.push(testFlow);
        fx.included.push(testPatient);

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientByAction()
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .visit()
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'include=patient,flow')
      .should('contain', `filter[clinicians]=${ currentClinician.id }`)
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`)
      .should('contain', 'fields[flows]=name,state');

    cy
      .url()
      .should('contain', 'schedule');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .as('worklists');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .first()
      .should('contain', 'Schedule')
      .should('have.class', 'is-selected');

    cy
      .get('@worklists')
      .find('.app-nav__link')
      .should('have.length', 1);

    cy
      .get('[data-owner-filter-region]')
      .should('be.empty');

    cy
      .get('[data-select-all-region]')
      .should('not.exist');

    cy
      .get('[data-filters-region]')
      .find('button')
      .should('exist');

    cy
      .get('[data-date-filter-region]')
      .should('be.empty');

    cy
      .get('[data-count-region]')
      .should('contain', '2 Actions');

    cy
      .get('.table-list__list')
      .as('scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row .js-select')
      .should('not.exist');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.js-patient-sidebar-button')
      .click()
      .wait('@routePatient');

    cy
      .get('.worklist-patient-sidebar')
      .should('contain', 'First Last');

    cy
      .get('.worklist-patient-sidebar .js-close')
      .click();

    cy
      .get('.worklist-patient-sidebar')
      .should('not.exist');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .should('have.class', 'is-reduced')
      .click();

    cy
      .url()
      .should('contain', 'schedule');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__patient-name')
      .should('have.class', 'is-reduced')
      .should('not.have.class', 'js-patient')
      .click();

    cy
      .url()
      .should('contain', 'schedule');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .should('have.class', 'is-reduced')
      .contains('Test Action')
      .click();

    cy
      .url()
      .should('contain', 'schedule');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .find('.js-form')
      .click();

    cy
      .url()
      .should('contain', `patient-action/${ testAction.id }/form/${ testForm.id }`)
      .go('back');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .eq(1)
      .find('.schedule-list__day-list-row')
      .contains('Test Flow Action')
      .click();

    cy
      .url()
      .should('contain', 'schedule');

    cy
      .navigate(`/patient/dashboard/${ testPatient.id }`);

    cy
      .get('.patient__context-trail')
      .should('contain', 'First Last');

    cy
      .navigate(`/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .get('.sidebar')
      .find('.action-sidebar__name')
      .should('contain', 'Test Action');

    cy
      .navigate(`/patient/archive/${ testPatient.id }`);

    cy
      .get('.patient__context-trail')
      .should('contain', 'First Last');

    cy
      .navigate(`/patient/archive/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .get('.sidebar')
      .find('.action-sidebar__name')
      .should('contain', 'Test Action');

    cy
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .navigate(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow')
      .wait('@routeFlowActions')
      .wait('@routePatientByFlow')
      .wait('@routeAction');

    cy
      .get('.sidebar')
      .find('.action-sidebar__name')
      .should('contain', 'Test Action');
  });

  specify('maximum list count reached', function() {
    cy
      .routesForPatientDashboard()
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleReducedEmployee),
          },
        });

        return fx;
      })
      .routeActions(fx => {
        const testPatientOne = getPatient({
          attributes: {
            first_name: 'Test',
            last_name: 'Patient',
          },
        });

        const testPatientTwo = getPatient({
          attributes: {
            first_name: 'Other',
            last_name: 'Patient',
          },
        });

        fx.data = _.times(50, index => {
          const actionName = index === 0 ? 'First Action' : `Action ${ index + 1 }`;
          const patient = index % 2 ? testPatientOne : testPatientTwo;

          return getAction({
            attributes: {
              name: actionName,
              due_date: testDate(),
            },
            relationships: {
              owner: getRelationship(teamCoordinator),
              state: getRelationship(stateTodo),
              patient: getRelationship(patient),
            },
          });
        });

        fx.included = [testPatientOne, testPatientTwo];

        fx.meta = {
          actions: {
            total: 1000,
          },
        };

        return fx;
      })
      .visit()
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
      .click()
      .prev()
      .type('abcd');

    cy
      .get('[data-count-region] div')
      .should('be.empty');
  });

  specify('find in list', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleReducedEmployee),
          },
        });

        return fx;
      })
      .routeActions(fx => {
        const testPatientOne = getPatient({
          attributes: {
            first_name: 'Test',
            last_name: 'Patient',
          },
        });

        const testPatientTwo = getPatient({
          attributes: {
            first_name: 'Other',
            last_name: 'Patient',
          },
        });

        fx.data = _.times(20, index => {
          const patient = index % 2 ? testPatientOne : testPatientTwo;
          const dueDate = index === 0 ? testDate() : testDateAdd(index + 1);

          return getAction({
            attributes: {
              due_date: dueDate,
            },
            relationships: {
              patient: getRelationship(patient),
            },
          });
        });

        fx.included.push(testPatientOne, testPatientTwo);

        return fx;
      })
      .routeDashboards()
      .visit('/schedule');

    cy
      .get('[data-count-region]')
      .should('not.contain', '20 Actions');

    cy
      .wait('@routeActions');

    cy
      .get('[data-count-region]')
      .should('contain', '20 Actions');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .should('have.attr', 'placeholder', 'Find in List...')
      .focus()
      .type('abc')
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
      .get('.table-list__list')
      .as('scheduleList')
      .find('.table-list__empty-list')
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
      .should('contain', '20 Actions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row')
      .should('have.length', 20);

    cy
      .get('@listSearch')
      .type('Test');

    cy
      .get('[data-count-region]')
      .should('contain', '10 Actions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row')
      .should('have.length', 10);

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .click();

    cy
      .get('.app-frame__sidebar .sidebar')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(2)
      .click();

    cy
      .wait('@routeActions');

    cy
      .get('.app-frame__sidebar .sidebar')
      .find('.js-close')
      .click();

    cy
      .get('@listSearch')
      .invoke('val')
      .should('equal', 'Test');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Dashboards')
      .click()
      .wait('@routeDashboards');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Schedule')
      .click()
      .wait('@routeActions');

    cy
      .get('@listSearch')
      .should('have.attr', 'value', 'Test');

    cy
      .get('.list-page__header')
      .find('[data-search-region] .list-search__container')
      .should('have.class', 'is-applied');
  });

  specify('400 error - set default filter state', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleReducedEmployee),
      },
    });

    localStorage.setItem(`reduced-schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'reduced-schedule',
      customFilters: {
        invalid_filter: 'Medicare',
      },
      states: [stateTodo.id, stateInProgress.id],
      flowStates: [stateTodo.id, stateInProgress.id],
    }));

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeActions()
      .visit()
      .wait('@routeActions');

    cy
      .intercept('GET', /\/api\/actions.*filter\[%40invalid_filter\]/, {
        statusCode: 400,
        body: {},
      })
      .as('routeActionsError');

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
      .click()
      .wait('@routeActionsError');

    cy
      .get('.list-page__filters')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '2')
      .should(() => {
        const storage = JSON.parse(localStorage.getItem(`reduced-schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters).to.deep.equal({});
        expect(storage.states).to.deep.equal([stateTodo.id, stateInProgress.id]);
      });
  });

  specify('500 error', function() {
    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleReducedEmployee),
          },
        });

        return fx;
      })
      .routeActions()
      .visit()
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

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
      .should('contain', `filter[states]=${ stateInProgress.id }`);

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
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);
  });
});
