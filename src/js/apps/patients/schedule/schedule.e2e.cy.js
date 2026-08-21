import _ from 'underscore';
import dayjs from 'dayjs';
import { v7 as uuidv7, v5 as uuidv5 } from 'uuid';

import formatDate from 'helpers/format-date';
import { testDate, testDateAdd, testDateSubtract } from 'helpers/test-date';
import { getRelationship } from 'helpers/json-api';

import { getAction, getActions, longActionName } from 'support/api/actions';
import { getComment } from 'support/api/comments';
import { getPatient } from 'support/api/patients';
import { getFlow } from 'support/api/flows';
import { stateTodo, stateInProgress, stateDone } from 'support/api/states';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { roleEmployee, roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { teamNurse, teamCoordinator } from 'support/api/teams';
import { getWorkspacePatient } from 'support/api/workspace-patients';
import { workspaceOne } from 'support/api/workspaces';
import { testForm } from 'support/api/forms';

const currentClinician = getCurrentClinician();

const testPatient1 = getPatient({
  attributes: {
    first_name: 'Test',
    last_name: 'Patient',
  },
});

const testPatient2 = getPatient({
  attributes: {
    first_name: 'LongTest',
    last_name: 'PatientName',
  },
});

const testFlow = getFlow({
  attributes: {
    name: 'Parent Flow',
  },
  relationships: {
    state: getRelationship(stateTodo),
  },
});

const STATE_VERSION = 'v6';

function expandFiltersSidebar() {
  cy.get('.list-page').then($layout => {
    if ($layout.hasClass('is-filters-collapsed')) {
      cy.wrap($layout).find('[data-filters-region] button').click();
    }
  });

  cy.get('[data-states-filters-region] .list-filters__section').then($section => {
    if ($section.hasClass('is-collapsed')) {
      cy.wrap($section).find('.list-filters__section-button').click();
    }
  });
}

context('schedule page', function() {
  specify('display schedule', function() {
    const testActions = [
      getAction({
        attributes: {
          name: 'Last Action',
          details: 'Last Action Details',
          due_date: testDate(),
          due_time: null,
        },
        relationships: {
          patient: getRelationship(testPatient1),
          form: getRelationship(testForm),
          state: getRelationship(stateTodo),
        },
      }),
      getAction({
        attributes: {
          name: longActionName,
          due_date: testDate(),
          due_time: '06:45:00',
        },
        relationships: {
          patient: getRelationship(testPatient2),
          form: getRelationship(testForm),
          flow: getRelationship(testFlow),
          state: getRelationship(stateInProgress),
        },
      }),
      getAction({
        attributes: {
          name: 'Second Action',
          details: null,
          due_date: testDate(),
          due_time: '10:31:00',
        },
        relationships: {
          patient: getRelationship(testPatient1),
          form: getRelationship(),
          flow: getRelationship(testFlow),
          state: getRelationship(stateInProgress),
        },
      }),
      getAction({
        attributes: {
          name: 'Third Action',
          due_date: testDate(),
          due_time: '14:00:00',
        },
        relationships: {
          patient: getRelationship(testPatient1),
          form: getRelationship(),
          state: getRelationship(stateDone),
        },
      }),
    ];

    const restoreSchedule = () => {
      cy
        .visit('/schedule')
        .wait('@routeActions');

      cy
        .get('.schedule-list__list')
        .as('scheduleList')
        .find('.schedule-list__list-row .schedule-list__day-list')
        .first()
        .as('actionList');
    };

    const testTime = dayjs().hour(12).minute(0).valueOf();

    localStorage.setItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      clinicianId: currentClinician.id,
      customFilters: {},
      dateFilters: {
        dateType: 'due_date',
        selectedDate: null,
        selectedMonth: dayjs(testDate()).startOf('month'),
        relativeDate: null,
      },
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = [
          ..._.map(testActions, getAction),
          ..._.times(20 - testActions.length, index => {
            return getAction({
              attributes: { due_date: testDateAdd(index + 1) },
              relationships: {
                patient: getRelationship(index % 2 === 0 ? testPatient1 : testPatient2),
                state: getRelationship(index % 2 === 0 ? stateTodo : stateInProgress),
              },
            });
          }),
          getAction({
            attributes: {
              name: 'Action with no due date - should be filtered out',
              due_date: null,
            },
            relationships: {
              patient: getRelationship(testPatient1),
              state: getRelationship(stateTodo),
            },
          }),
        ];

        fx.included.push(testPatient1, testPatient2, testFlow);

        return fx;
      })
      .intercept('GET', '/api/actions/*', req => {
        const action = testActions.find(({ id }) => req.url.includes(id));

        req.reply({ body: { data: getAction(action), included: [] } });
      })
      .as('routeAction')
      .routePatient(fx => {
        fx.data = testPatient1;

        return fx;
      })
      .routeWorkspacePatient(fx => {
        fx.data = getWorkspacePatient({
          id: uuidv5(testPatient1.id, workspaceOne.id),
        });

        return fx;
      })
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow()
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visitOnClock('/schedule', { now: testTime, functionNames: ['Date'] })
      .wait('@routeActions');

    cy
      .get('[data-count-region]')
      .should('contain', '20 Actions')
      .should(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));
        expect(storage.worklist).to.exist;
      });

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(testDate(), 'MMM YYYY'));

    cy
      .get('.schedule-list__list')
      .as('scheduleList')
      .find('.schedule-list__list-row')
      .last()
      .find('.schedule-list__date')
      .should('contain', formatDate(testDateAdd(20 - testActions.length), 'D'));

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__date.is-today')
      .should('contain', formatDate(testDate(), 'D'))
      .next()
      .should('contain', formatDate(testDate(), 'MMM, ddd'))
      .and('have.class', 'is-today')
      .and('have.css', 'color', 'rgb(5, 130, 218)');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .eq(1)
      .find('.schedule-list__date')
      .should('contain', formatDate(testDateAdd(1), 'D'));

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row .schedule-list__day-list')
      .first()
      .as('actionList')
      .find('.schedule-list__day-list-row')
      .first()
      .should('contain', '6:45 AM')
      .should('contain', longActionName)
      .find('.is-overdue')
      .parents('.schedule-list__day-list-row')
      .next()
      .should('contain', '10:31 AM')
      .should('contain', 'Second Action');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .eq(2)
      .should('contain', '2:00 PM')
      .should('contain', 'Third Action')
      .click();

    cy
      .url()
      .should('contain', `patient/${ testPatient1.id }/action/${ testActions[3].id }`);

    restoreSchedule();

    cy
      .get('.patient-list-page__all-filters-button')
      .find('.fa-bars-filter')
      .should('be.visible');

    cy
      .get('[data-owner-filter-region]')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__group')
      .first()
      .click();

    cy
      .get('[data-owner-filter-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-clear')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .should('contain', 'No Time')
      .should('contain', 'Last Action')
      .find('.js-patient')
      .click();

    cy
      .wait('@routePatient');

    cy
      .location('pathname')
      .should('contain', '/schedule');

    cy
      .get('.list-filters')
      .should('not.exist');

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy.viewport(640, 720);

    cy
      .get('.list-filters')
      .should('not.be.visible');

    cy
      .get('.patient-list-page__all-filters-button')
      .click();

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy.viewport(1200, 720);

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .click();

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .should('have.class', 'patient-list__patient--selected');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .get('.patient-list-page__all-filters-button')
      .click();

    cy
      .get('.list-page')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .click();

    cy
      .get('.patient-sidebar__close')
      .click();

    cy
      .get('.list-page')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('.list-filters')
      .should('not.be.visible');

    cy
      .get('.patient-list-page__all-filters-button')
      .click();

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .click();

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.patient-list-page__all-filters-button')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('.js-patient')
      .click();

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient')
      .find('.patient-sidebar__close')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.list-filters')
      .should('be.visible');

    restoreSchedule();

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__date')
      .should('contain', formatDate(testDate(), 'D'))
      .parents('.schedule-list__list-row')
      .contains('Last Action')
      .parents('.schedule-list__day-list-row')
      .find('.js-form')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient1.id }/action/${ testActions[0].id }`)
      .wait('@routeFormActionFields');

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    restoreSchedule();

    cy
      .get('@actionList')
      .contains(longActionName)
      .parents('.schedule-list__day-list-row')
      .find('.js-form')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient2.id }/flow/${ testFlow.id }/action/${ testActions[1].id }`)
      .wait('@routeFormActionFields');

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    restoreSchedule();

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .contains('Last Action')
      .click('top');

    cy
      .url()
      .should('contain', `patient/${ testPatient1.id }/action/${ testActions[0].id }`);

    restoreSchedule();

    cy
      .routeAction(fx => {
        fx.data = testActions[1];

        return fx;
      });

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .first()
      .find('.js-action')
      .focus()
      .typeEnter();

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }/action/${ testActions[1].id }`);

    restoreSchedule();

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .last()
      .find('[data-details-region] button')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Last Action')
      .should('contain', 'Last Action Details');

    cy
      .get('@actionList')
      .find('.schedule-list__day-list-row')
      .eq(1)
      .find('[data-details-region]')
      .should('be.empty');
  });

  specify('maximum list count reached', function() {
    localStorage.setItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      clinicianId: currentClinician.id,
      customFilters: {},
      dateFilters: {
        dateType: 'due_date',
        selectedDate: null,
        selectedMonth: dayjs(testDate()).startOf('month'),
        relativeDate: null,
      },
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = _.times(50, index => {
          return getAction({
            attributes: {
              name: !index ? 'First Action' : `Action ${ index + 1 }`,
            },
            relationships() {
              return {
                patient: getRelationship(index % 2 === 0 ? testPatient1 : testPatient2),
              };
            },
          });
        });

        fx.included.push(testPatient1, testPatient2);

        fx.meta = {
          actions: {
            total: 1000,
          },
        };

        return fx;
      })
      .visit('/schedule')
      .wait('@routeActions');

    cy
      .get('[data-count-region]')
      .should('contain', 'Showing 50 of 1,000 Actions.')
      .should('contain', 'Try narrowing your filters.')
      .find('span')
      .should('have.text', 'Showing 50 of 1,000 Actions. Try narrowing your filters.');

    cy
      .get('.list-page')
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
  });

  // TODO: Move to component test
  specify('filter schedule', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();

    const testClinician = getClinician({
      attributes: { name: 'Test Clinician' },
      relationships: {
        team: getRelationship(teamNurse),
        role: getRelationship(roleEmployee),
      },
    });

    cy
      .routeActions()
      .routeWorkspaceClinicians(fx => {
        fx.data[1] = testClinician;

        return fx;
      })
      .visitOnClock('/schedule', { now: testTime, functionNames: ['Date'] });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[clinicians]=${ currentClinician.id }`)
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

    cy
      .get('[data-owner-filter-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-clear')
      .should('contain', 'Clinician McTester');

    cy
      .get('.picklist')
      .find('.picklist__group')
      .first()
      .find('.js-picklist-item')
      .contains('Test Clinician')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.clinicianId).to.equal(testClinician.id);
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[clinicians]=${ testClinician.id }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'This Month')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Select from calendar')
      .click();

    cy
      .get('.datepicker')
      .find('.js-today')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.dateFilters.relativeDate).to.equal('today');
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(storage.dateFilters.selectedMonth).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ testDate() },${ testDate() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Today')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Yesterday')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.dateFilters.relativeDate).to.equal('yesterday');
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(storage.dateFilters.selectedMonth).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ testDateSubtract(1) },${ testDateSubtract(1) }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Yesterday')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Select from calendar')
      .click();

    cy
      .get('.datepicker')
      .find('.is-today')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.dateFilters.selectedDate, 'YYYY-MM-DD')).to.equal(testDate());
        expect(storage.dateFilters.relativeDate).to.be.null;
        expect(storage.dateFilters.selectedMonth).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ testDate() },${ testDate() }`);

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
      .find('.js-next')
      .click();

    cy
      .get('.datepicker')
      .find('.js-month')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(formatDate(storage.dateFilters.selectedMonth, 'MMM YYYY')).to.equal(formatDate(testDateAdd(1, 'month'), 'MMM YYYY'));
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(storage.dateFilters.relativeDate).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ formatDate(dayjs(testDateAdd(1, 'month')).startOf('month'), 'YYYY-MM-DD') },${ formatDate(dayjs(testDateAdd(1, 'month')).endOf('month'), 'YYYY-MM-DD') }`);

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
      .find('.js-current-month')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.dateFilters.selectedMonth).to.be.null;
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(storage.dateFilters.relativeDate).to.equal('thismonth');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ formatDate(dayjs(testDate()).startOf('month'), 'YYYY-MM-DD') },${ formatDate(dayjs(testDate()).endOf('month'), 'YYYY-MM-DD') }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'This Month')
      .click();

    cy
      .get('.date-filter')
      .contains('Select from calendar')
      .click();

    cy
      .get('.datepicker')
      .find('.js-current-week')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.dateFilters.selectedMonth).to.be.null;
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(storage.dateFilters.selectedWeek).to.be.null;
        expect(storage.dateFilters.relativeDate).to.equal('thisweek');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ formatDate(dayjs(testDate()).startOf('week'), 'YYYY-MM-DD') },${ formatDate(dayjs(testDate()).endOf('week'), 'YYYY-MM-DD') }`);

    cy
      .get('.date-filter')
      .should('not.exist');

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.dateFilters.selectedMonth).to.be.null;
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(formatDate(storage.dateFilters.selectedWeek, 'MM/DD/YYYY')).to.equal(formatDate(dayjs(testDateSubtract(1, 'week')).startOf('week'), 'MM/DD/YYYY'));
        expect(storage.dateFilters.relativeDate).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ formatDate(dayjs(testDateSubtract(1, 'week')).startOf('week'), 'YYYY-MM-DD') },${ formatDate(dayjs(testDateSubtract(1, 'week')).endOf('week'), 'YYYY-MM-DD') }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', formatDate(dayjs(testDateSubtract(1, 'week')).startOf('week'), 'MM/DD/YYYY'))
      .should('contain', formatDate(dayjs(testDateSubtract(1, 'week')).endOf('week'), 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('All Time')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.dateFilters.relativeDate).to.equal('alltime');
        expect(storage.dateFilters.selectedDate).to.be.null;
        expect(storage.dateFilters.selectedMonth).to.be.null;
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[due_date]');

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

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'All Time')
      .click();

    cy
      .get('.app-frame__pop-region')
      .then($el => {
        // checks that pop region doesn't show outside viewport bounds
        const elInfo = $el[0].getBoundingClientRect();
        const viewportWidth = Cypress.config('viewportWidth');
        const viewportHeight = Cypress.config('viewportHeight');

        const isOutOfBounds = elInfo.right > viewportWidth || elInfo.bottom > viewportHeight || elInfo.left < 0 || elInfo.top < 0;

        expect(isOutOfBounds).to.be.false;
      });
  });

  specify('restricted employee', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });

        return fx;
      })
      .routeActions()
      .visit('/schedule')
      .wait('@routeActions');

    cy
      .get('[data-owner-filter-region]')
      .should('be.empty');
  });

  specify('responsive card layout and accessible controls', function() {
    cy.viewport(1200, 720);

    const testActions = [
      getAction({
        attributes: {
          name: 'Follow-up - 2nd Attempt',
          details: 'Review the referral and prepare the next outreach step.',
          due_date: testDate(),
          due_time: '06:45:00',
        },
        relationships: {
          comments: getRelationship([getComment()]),
          patient: getRelationship(testPatient1),
          flow: getRelationship(testFlow),
          state: getRelationship(stateInProgress),
        },
      }),
      getAction({
        attributes: {
          details: 'Confirm the final disposition before submitting the form.',
          name: longActionName,
          due_date: testDate(),
          due_time: '10:00:00',
        },
        relationships: {
          patient: getRelationship(testPatient2),
          form: getRelationship(testForm),
          flow: getRelationship(testFlow),
          state: getRelationship(stateTodo),
        },
      }),
    ];

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient1;

        return fx;
      })
      .routeWorkspacePatient(fx => {
        fx.data = getWorkspacePatient({
          id: uuidv5(testPatient1.id, workspaceOne.id),
        });

        return fx;
      })
      .routeActions(fx => {
        fx.data = testActions;
        fx.included.push(testPatient1, testPatient2, testFlow);

        return fx;
      })
      .visit('/schedule')
      .wait('@routeActions');

    cy
      .get('.schedule-list-page')
      .as('layout');

    cy
      .get('.schedule-list__day-list-row')
      .should('have.length', 2);

    cy
      .get('[data-select-all-region] button')
      .should('not.be.disabled');

    cy
      .get('[data-filters-region] button')
      .should('have.attr', 'aria-expanded', 'true')
      .then($button => {
        $button.trigger('click');
      });

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('[data-filters-region] button')
      .as('filtersButton')
      .should('have.attr', 'aria-expanded', 'false');

    cy
      .get('.schedule-list__day-list')
      .find('.schedule-list__day-list-row')
      .as('desktopRows')
      .should('have.length', 2);

    cy
      .get('@desktopRows')
      .first()
      .find('.schedule-list__action-state')
      .should('have.class', 'action-icon--black')
      .and('have.attr', 'role', 'img')
      .and('have.attr', 'aria-label', 'State: In Progress')
      .find('.fa-circle-dot')
      .should('exist');

    cy
      .get('@desktopRows')
      .first()
      .find('.schedule-list__comments')
      .should('contain', '1')
      .and('have.attr', 'role', 'img')
      .and('have.attr', 'aria-label', '1 comment');

    cy
      .get('@desktopRows')
      .last()
      .find('.schedule-list__comments')
      .should('not.exist');

    cy.viewport(721, 720);

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized');

    cy
      .get('.schedule-list__day-list')
      .as('dayList')
      .find('.schedule-list__day-list-row')
      .as('rows')
      .should('have.length', 2);

    cy
      .get('[data-select-all-region] button')
      .should('have.attr', 'role', 'checkbox')
      .and('have.attr', 'aria-label', 'Select all actions');

    cy
      .get('@rows')
      .last()
      .find('.js-form')
      .should('match', 'button')
      .and('have.attr', 'aria-label', 'Open form');

    cy
      .get('.schedule-list__list-row')
      .first()
      .then($group => {
        expect($group.find('.schedule-list__date')).to.have.class('is-today');
      });

    cy
      .get('@rows')
      .first()
      .find('.action-details-tooltip')
      .should('match', 'button')
      .and('have.attr', 'aria-label', 'View action details')
      .invoke('attr', 'aria-describedby')
      .then(tooltipId => {
        cy.get(`[aria-describedby="${ tooltipId }"]`).focus();
        cy.get(`#${ tooltipId }`).should('have.attr', 'role', 'tooltip');
      });

    cy
      .get('.tooltip')
      .should('contain', 'Review the referral and prepare the next outreach step.');

    cy.viewport(640, 720);

    cy.get('[data-filters-region] button').click();

    cy
      .get('@layout')
      .should('not.have.class', 'is-filters-collapsed')
      .find('.patient-list-page__sidebar')
      .should('be.visible')
      .and('contain', 'Filters');

    cy
      .get('[data-filters-region] button')
      .should('have.attr', 'aria-expanded', 'true');

    cy
      .get('.js-close-sidebar-drawer')
      .click();

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy.viewport(1200, 720);

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy.viewport(1100, 720);

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy.viewport(1043, 720);

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy.viewport(641, 720);

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('.js-close-sidebar-drawer')
      .should('not.be.visible');

    cy
      .get('[data-filters-region] button')
      .click();

    cy.viewport(640, 720);

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('.js-close-sidebar-drawer')
      .should('be.visible')
      .click();

    cy.viewport(721, 720);

    cy.viewport(390, 720);

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized');

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy
      .get('@rows')
      .first()
      .should('be.visible');

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('.js-close-sidebar-drawer')
      .should('be.focused')
      .type('{esc}');

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('[data-filters-region] button')
      .should('be.focused')
      .and('have.attr', 'aria-expanded', 'false');

    cy.viewport(640, 720);

    cy.window().should(win => {
      expect(win.matchMedia('(width <= 640px)').matches).to.equal(true);
    });

    cy
      .get('@rows')
      .first()
      .find('.js-patient')
      .as('patientSidebarTrigger')
      .click();

    cy
      .wait('@routePatient')
      .get('.patient-sidebar')
      .should('be.visible');

    cy
      .get('[data-filters-region] button')
      .should('have.attr', 'aria-expanded', 'false');

    cy
      .get('.js-close-sidebar-drawer')
      .should('not.be.visible');

    cy.viewport(1200, 720);

    cy
      .get('@layout')
      .should('not.have.class', 'is-filters-collapsed');

    cy
      .get('.patient-sidebar__close')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('@rows')
      .first()
      .find('.js-patient')
      .should('not.have.class', 'patient-list__patient--selected');

    cy
      .get('@patientSidebarTrigger')
      .should('be.focused');

    cy
      .get('.schedule-list__day-list-row')
      .first()
      .find('.js-select')
      .should('have.attr', 'role', 'checkbox')
      .and('have.attr', 'aria-checked', 'false')
      .and('have.attr', 'aria-label', 'Select action')
      .click();

    cy
      .get('.schedule-list__day-list-row')
      .first()
      .find('.js-select')
      .should('have.attr', 'aria-checked', 'true')
      .and('have.attr', 'aria-label', 'Deselect action')
      .click();
  });

  specify('bulk edit', function() {
    cy.viewport(1100, 720);
    let bulkToolbarHeight;

    const testActions = _.times(20, index => {
      return getAction({
        relationships: {
          owner: getRelationship(currentClinician),
          state: getRelationship(index % 2 ? stateTodo : stateInProgress),
          flow: getRelationship(testFlow),
        },
      });
    });

    localStorage.setItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      clinicianId: currentClinician.id,
      customFilters: {},
      dateFilters: {
        dateType: 'due_date',
        selectedDate: null,
        selectedMonth: null,
        relativeDate: null,
      },
      actionsSelected: {
        [testActions[0].id]: true,
        [uuidv7()]: true,
      },
    }));

    cy
      .routeActions(fx => {
        fx.data = testActions;

        fx.included.push(testFlow);

        return fx;
      })
      .visit('/schedule')
      .wait('@routeActions');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 1 Action');

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .then($toolbar => {
        bulkToolbarHeight = $toolbar[0].getBoundingClientRect().height;
      });

    cy
      .get('@bulkEditToolbar')
      .find('[data-state-region] button')
      .click();

    cy
      .get('.picklist')
      .should('be.visible');

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .find('.js-tomorrow')
      .click();

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('@bulkEditToolbar')
      .should($toolbar => {
        expect($toolbar[0].getBoundingClientRect().height).to.equal(bulkToolbarHeight);
      });

    cy
      .get('[data-filters-region] button')
      .click();

    cy
      .get('@bulkEditToolbar')
      .should($toolbar => {
        expect($toolbar[0].getBoundingClientRect().height).to.equal(bulkToolbarHeight);
      });

    cy
      .get('.schedule-list__day-list-row:not(.is-selected)')
      .first()
      .find('.js-select')
      .click();

    cy
      .get('@bulkEditToolbar')
      .should($toolbar => {
        expect($toolbar[0].getBoundingClientRect().height).to.equal(bulkToolbarHeight);
      })
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Actions');

    cy
      .get('@bulkEditToolbar')
      .find('[data-due-date-region]')
      .should('contain', formatDate(testDateAdd(1), 'SHORT'));

    cy
      .get('.patient-list-page__summary')
      .should('not.be.visible');

    cy
      .get('.schedule-list__day-list-row.is-selected')
      .last()
      .find('.js-select')
      .click();

    cy
      .get('.schedule-list__list')
      .find('.schedule-list__list-row .is-selected')
      .should('have.length', 1)
      .first()
      .find('.js-select')
      .click();

    cy
      .get('.schedule-list__list')
      .find('.schedule-list__list-row .is-selected')
      .should('have.length', 0);

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-check');

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('.bulk-edit-inline')
      .should('not.exist');

    cy
      .get('.app-frame__content')
      .find('.schedule-list__list')
      .find('.fa-square-check')
      .should('have.length', 0);

    cy
      .get('.schedule-list__list')
      .find('.schedule-list__list-row .is-selected')
      .should('have.length', 0);

    cy
      .get('[data-select-all-region]')
      .find('.fa-square');

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('.app-frame__content')
      .find('.schedule-list__list')
      .find('.fa-square-check')
      .should('have.length', 20);

    cy
      .get('.schedule-list__list')
      .find('.schedule-list__list-row .is-selected')
      .should('have.length', 20);

    cy
      .get('.bulk-edit-inline')
      .as('bulkEditToolbar')
      .find('.bulk-edit-inline__heading')
      .should('contain', 'Edit 20 Actions');

    cy
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchFlowOwner');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchAction');

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
      .find('.js-save')
      .click()
      .wait('@patchAction')
      .wait('@routeActions');

    cy
      .get('.alert-box')
      .should('contain', '20 Actions have been updated');

    cy
      .get('.app-frame__content')
      .find('.schedule-list__list .fa-square')
      .should('have.length', 20);

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Clinician McTester')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('[data-owner-scope-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Actions + flows')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click()
      .wait('@patchFlowOwner')
      .wait('@patchAction');

    cy
      .get('.alert-box')
      .should('contain', '20 Actions have been updated');

    cy
      .get('.app-frame__content')
      .find('.schedule-list__list .fa-square')
      .should('have.length', 20);

    cy
      .get('.app-frame__content')
      .find('.schedule-list__list-row .js-select')
      .then($els => {
        _.some($els, ($el, idx) => {
          cy
            .wrap($el)
            .click();

          if (idx === 4) return true;
        });
      });

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-minus');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 400,
        body: {},
      })
      .as('patchActionFail');

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('@bulkEditToolbar')
      .find('.js-save')
      .click()
      .wait('@patchActionFail');

    cy
      .get('.alert-box')
      .should('contain', 'Something went wrong. Please try again.');
  });

  specify('empty schedule', function() {
    cy
      .routeActions(fx => {
        fx.data = [];

        return fx;
      })
      .visit('/schedule')
      .wait('@routeActions');

    cy
      .get('[data-count-region] div')
      .should('be.empty');

    cy
      .get('.schedule-list__list')
      .should('contain', 'No Scheduled Actions');

    cy
      .get('[data-select-all-region]')
      .find('button')
      .should('be.disabled');
  });

  specify('find in list', function() {
    const testActions = [
      getAction({
        attributes: {
          name: 'Last Action',
          due_date: testDate(),
          due_time: null,
        },
        relationships: {
          patient: getRelationship(testPatient1),
          state: getRelationship(stateTodo),
          form: getRelationship(testForm),
        },
      }),
      getAction({
        attributes: {
          name: 'First Action',
          due_date: testDate(),
          due_time: '06:45:00',
        },
        relationships: {
          patient: getRelationship(testPatient2),
          state: getRelationship(stateTodo),
          flow: getRelationship(testFlow),
        },
      }),
      getAction({
        attributes: {
          name: 'Second Action - Dash in Name',
          due_date: testDate(),
          due_time: '10:30:00',
        },
        relationships: {
          patient: getRelationship(testPatient1),
          state: getRelationship(stateInProgress),
          flow: getRelationship(testFlow),
        },
      }),
      getAction({
        attributes: {
          name: 'Third Action',
          due_date: testDate(),
          due_time: '14:00:00',
        },
        relationships: {
          patient: getRelationship(testPatient1),
          state: getRelationship(stateInProgress),
          flow: getRelationship(testFlow),
        },
      }),
    ];

    cy
      .routeActions(fx => {
        fx.data = [
          ..._.map(testActions, getAction),
          ..._.times(20 - testActions.length, index => {
            return getAction({
              attributes: { due_date: testDateAdd(index + 1) },
              relationships: {
                patient: getRelationship(index % 2 === 0 ? testPatient1 : testPatient2),
                state: getRelationship(index % 2 === 0 ? stateTodo : stateInProgress),
              },
            });
          }),
        ];

        fx.included.push(testPatient1, testPatient2, testFlow);

        return fx;
      })
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
      .get('.list-page')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .should('have.attr', 'placeholder', 'Find in List…')
      .focus()
      .type('abc')
      .next()
      .should('have.class', 'js-clear');

    cy
      .get('.list-page')
      .find('[data-search-region] .list-search__container')
      .should('have.class', 'is-applied');

    cy
      .get('[data-count-region] div')
      .should('be.empty');

    cy
      .get('.schedule-list__list')
      .as('scheduleList')
      .find('.schedule-list__empty')
      .should('contain', 'No results match your Find in List search');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('.list-page')
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
      .should('contain', '11 Actions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row')
      .should('have.length', 11);

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('Action');

    cy
      .get('[data-count-region]')
      .should('contain', '4 Actions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .should('have.length', 4);

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row .fa-square-check')
      .should('have.length', 4);

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-check');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 4 Actions');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-minus');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 4 Actions');

    cy
      .get('.patient-list-page__summary')
      .should('not.be.visible');

    cy
      .get('[data-select-all-region]')
      .click();

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row .fa-square-check')
      .should('have.length', 20)
      .eq(4)
      .click();

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-minus');

    cy
      .get('@listSearch')
      .type('Action');

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-check');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 4 Actions');

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@listSearch')
      .next()
      .click()
      .should('not.be.visible');

    cy
      .get('@listSearch')
      .type('Parent Flow');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Actions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row')
      .should('have.length', 3);

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('Second Action - Dash in Name');

    cy
      .get('[data-count-region]')
      .should('contain', '1 Action')
      .should('not.contain', 'Actions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row')
      .should('have.length', 1)
      .first()
      .should('contain', 'Second Action - Dash in Name');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('@listSearch')
      .type('In Progress');

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row')
      .should('contain', 'Test Patient')
      .should('contain', 'Second Action');

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev')
      .click();

    cy
      .wait('@routeActions');

    cy
      .get('@listSearch')
      .invoke('val')
      .should('equal', 'In Progress');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Owned By')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Schedule')
      .click()
      .wait('@routeActions');

    cy
      .get('@listSearch')
      .should('have.attr', 'value', 'In Progress');

    cy
      .get('.list-page')
      .find('[data-search-region] .list-search__container')
      .should('have.class', 'is-applied');
  });

  specify('click+shift multiselect', function() {
    const testActionAttrs = [
      {
        name: 'Last Action',
        due_date: testDate(),
        due_time: null,
      },
      {
        name: 'First Action',
        due_date: testDate(),
        due_time: null,
      },
      {
        name: 'Second Action',
        due_date: testDate(),
        due_time: '10:30:00',
      },
      {
        name: 'Third Action',
        due_date: testDate(),
        due_time: '14:00:00',
      },
    ];

    cy
      .routeActions(fx => {
        fx.data = [
          ..._.map(testActionAttrs, attributes => {
            return getAction({ attributes });
          }),
          ..._.times(20 - testActionAttrs.length, index => {
            return getAction({
              attributes: { due_date: testDateAdd(index + 1) },
            });
          }),
        ];

        return fx;
      })
      .visitOnClock('/schedule');

    cy
      .tick(60) // tick past debounce
      .get('.schedule-list__list')
      .as('scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .first()
      .as('firstActionRow')
      .find('.js-select')
      .click();

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .eq(2)
      .find('.schedule-list__day-list-row')
      .first()
      .as('sixthActionRow')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row.is-selected')
      .should('have.length', 6);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 6 Actions');

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@sixthActionRow')
      .find('.js-select')
      .click();

    cy
      .get('@firstActionRow')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row.is-selected')
      .should('have.length', 6);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 6 Actions');

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstActionRow')
      .find('.js-select')
      .click();

    cy
      .get('@firstActionRow')
      .find('.js-select')
      .click();

    cy
      .get('@sixthActionRow')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row.is-selected')
      .should('have.length', 1);

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstActionRow')
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@sixthActionRow')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row.is-selected')
      .should('have.length', 1);

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstActionRow')
      .find('.js-select')
      .click();

    cy
      .get('.list-page')
      .find('[data-search-region] .js-input')
      .focus()
      .type('abcd');

    cy
      .get('.list-page')
      .find('[data-search-region] .js-input')
      .next()
      .click();

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .eq(2)
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row.is-selected')
      .should('have.length', 2);

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstActionRow')
      .find('.js-select')
      .click();

    cy
      .navigate('/worklist')
      .wait('@routeActions');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .get('@scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .eq(2)
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('@scheduleList')
      .find('.schedule-list__day-list-row.is-selected')
      .should('have.length', 2);
  });

  specify('bulk editing with work:owned:manage permission', function() {
    const testActions = [
      getAction({
        attributes: {
          name: 'Last Action',
          due_date: testDate(),
          due_time: null,
        },
        relationships: {
          owner: getRelationship(currentClinician),
        },
      }),
      getAction({
        attributes: {
          name: 'First Action',
          due_date: testDate(),
          due_time: null,
        },
        relationships: {
          owner: getRelationship(teamNurse),
        },
      }),
      getAction({
        attributes: {
          name: 'Second Action',
          due_date: testDateAdd(3),
          due_time: '10:30:00',
        },
        relationships: {
          owner: getRelationship(teamNurse),
        },
      }),
      getAction({
        attributes: {
          name: 'Third Action',
          due_date: testDateAdd(3),
          due_time: '14:00:00',
        },
        relationships: {
          owner: getRelationship(currentClinician),
        },
      }),
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
      .visit('/schedule');

    cy
      .intercept('PATCH', '/api/actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('patchAction');

    cy
      .get('.schedule-list__list')
      .as('scheduleList')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .first()
      .as('firstActionRow')
      .find('.js-select')
      .click();

    cy
      .get('.schedule-list__list')
      .as('scheduleList')
      .find('.schedule-list__list-row')
      .last()
      .find('.schedule-list__day-list-row')
      .last()
      .as('lastActionRow')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Actions');

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
      .wait(['@patchAction', '@patchAction']);

    cy
      .get('.alert-box')
      .should('contain', '2 Actions have been updated');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 2 Actions');

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
      .wait(['@patchAction', '@patchAction']);

    cy
      .get('.alert-box')
      .should('contain', '2 Actions have been updated');

    cy
      .get('[data-select-all-region] button:disabled');
  });

  specify('bulk editing with work:team:manage permission', function() {
    const testCurrentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamNurse),
      },
    });

    const testNonTeamMemberClincian = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamCoordinator),
      },
    });

    const testActions = [
      getAction({
        attributes: {
          name: 'Owned by another team',
          due_date: testDateAdd(1),
          due_time: '9:00:00',
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          state: getRelationship(stateInProgress),
        },
      }),
      getAction({
        attributes: {
          name: 'Owned by non team member',
          due_date: testDateAdd(1),
          due_time: '10:00:00',
        },
        relationships: {
          owner: getRelationship(testNonTeamMemberClincian),
          state: getRelationship(stateInProgress),
        },
      }),
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = testCurrentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [testCurrentClinician, testNonTeamMemberClincian];

        return fx;
      })
      .routeActions(fx => {
        fx.data = _.map(testActions, getAction);

        return fx;
      })
      .visit('/schedule');

    cy
      .get('.schedule-list__list')
      .find('.schedule-list__list-row')
      .first()
      .find('.schedule-list__day-list-row')
      .as('actionDayListRows')
      .first()
      .find('.js-select')
      .should('not.exist');

    cy
      .get('@actionDayListRows')
      .last()
      .find('.js-select')
      .should('not.exist');
  });

  specify('actions on a done-flow', function() {
    const doneFlow = getFlow({
      relationships: {
        state: getRelationship(stateDone),
      },
    });

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = getActions({
          relationships: {
            flow: getRelationship(doneFlow),
          },
        });

        fx.included.push(doneFlow);

        return fx;
      })
      .visit('/schedule');

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'fields[flows]=name,state');

    cy
      .get('.app-frame__content')
      .find('.schedule-list__list-row .js-select')
      .should('not.exist');
  });

  specify('400 error - set default filter state', function() {
    localStorage.setItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'schedule',
      customFilters: {
        invalid_filter: 'Medicare',
      },
      states: [stateTodo.id, stateInProgress.id],
      flowStates: [stateTodo.id, stateInProgress.id],
    }));

    cy
      .routesForPatientAction()
      .routeActions()
      .visit('/schedule')
      .wait('@routeActions');

    cy
      .intercept('GET', /\/api\/actions.*filter\[%40invalid_filter\]/, {
        statusCode: 400,
        body: {},
      })
      .as('routeActionsError');

    expandFiltersSidebar();

    cy
      .get('.list-filters')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(0)
      .click()
      .wait('@routeActionsError');

    cy
      .get('.list-page')
      .find('[data-filters-region]')
      .find('button')
      .should('not.contain', '2')
      .should(() => {
        const storage = JSON.parse(localStorage.getItem(`schedule_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters).to.deep.equal({});
        expect(storage.states).to.deep.equal([stateTodo.id, stateInProgress.id]);
      });
  });

  specify('500 error', function() {
    cy
      .routesForPatientAction()
      .routeActions()
      .visit('/schedule')
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

    expandFiltersSidebar();

    cy
      .get('.list-filters')
      .find('[data-states-filters-region]')
      .find('[data-check-region]')
      .eq(0)
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'include=patient,flow')
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
