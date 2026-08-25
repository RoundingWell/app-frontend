import _ from 'underscore';
import dayjs from 'dayjs';
import { v7 as uuid, NIL as NIL_UUID } from 'uuid';

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
import { stateTodo, stateInProgress, stateDone, stateUnableToComplete, stateThmgTransferred } from 'support/api/states';
import { roleAdmin, roleEmployee, roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { workspaceOne } from 'support/api/workspaces';
import { testForm } from 'support/api/forms';
import { getComment } from 'support/api/comments';
import { getFile } from 'support/api/files';

const currentClinician = getCurrentClinician();

const testPatient1 = getPatient({
  attributes: {
    first_name: 'Test',
    last_name: 'Patient',
    segment: 'Cedarwood Rehabilitation & Healthcare Center',
  },
});

const testPatient2 = getPatient({
  attributes: {
    first_name: 'Other',
    last_name: 'Patient',
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

function openPatientSidebar(sidebarCount = 1, listType = 'flows') {
  const panelSlugs = ['demographics', ...Array.from(
    { length: sidebarCount - 1 },
    (_value, index) => `test-panel-${ index }`,
  )];
  const testAction = getAction({
    relationships: {
      patient: getRelationship(testPatient1),
      state: getRelationship(stateTodo),
    },
  });
  const testFlow = getFlow({
    relationships: {
      owner: getRelationship(teamCoordinator),
      patient: getRelationship(testPatient1),
      state: getRelationship(stateTodo),
    },
  });

  cy
    .routesForPatientAction()
    .routeFlows(fx => {
      fx.data = [testFlow];
      fx.included.push(testPatient1);
      return fx;
    })
    .routePatient(fx => {
      fx.data = testPatient1;
      return fx;
    })
    .routeSettings('sidebar', panelSlugs)
    .routePanels(fx => {
      const [panel] = fx.data;

      fx.data.push(...Array.from({ length: sidebarCount - 1 }, (_value, index) => ({
        ...panel,
        id: `test-panel-${ index }`,
        attributes: {
          ...panel.attributes,
          slug: `test-panel-${ index }`,
          name: `Test Sidebar ${ index + 2 }`,
        },
      })));

      return fx;
    })
    .routeActions(fx => {
      fx.data = [testAction];
      fx.included.push(testPatient1);
      return fx;
    })
    .visit('/worklist/owned-by')
    .wait('@routeActions');

  if (listType === 'flows') {
    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');
  }

  cy
    .get('.worklist-list__item')
    .contains('Test Patient')
    .click();
}

context('worklist page', function() {
  specify('toggle filters sidebar', function() {
    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortCreatedDesc',
      flowsSortId: 'sortCreatedDesc',
      clinicianId: currentClinician.id,
      customFilters: { segment: 'active' },
    }));

    cy
      .routeActions()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.list-page')
      .as('layout')
      .should('not.have.class', 'is-filters-collapsed')
      .find('.patient-list-page__sidebar')
      .should('be.visible');

    cy
      .get('.patient-list-page__all-filters-button')
      .as('filtersButton')
      .should('have.attr', 'aria-expanded', 'true')
      .find('.fa-bars-filter')
      .should('be.visible');

    cy
      .get('@filtersButton')
      .find('.patient-list-page__active-filter-dot')
      .should('not.be.visible');

    cy.get('@filtersButton').click();

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed')
      .find('.patient-list-page__sidebar')
      .should('not.be.visible');

    cy
      .get('@filtersButton')
      .should('have.attr', 'aria-expanded', 'false')
      .find('.patient-list-page__active-filter-dot')
      .should('be.visible');

    cy
      .get('@filtersButton')
      .click()
      .should('have.attr', 'aria-expanded', 'true');

    cy
      .get('@layout')
      .should('not.have.class', 'is-filters-collapsed')
      .find('.patient-list-page__sidebar')
      .should('be.visible');

    cy.viewport(1043, 720);

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy
      .get('@filtersButton')
      .click();

    cy.viewport(641, 720);

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy
      .get('@filtersButton')
      .click();

    cy
      .get('.list-search__input')
      .click()
      .type('patient')
      .should('have.value', 'patient')
      .clear();

    cy
      .get('.js-close-sidebar-drawer')
      .should('not.be.visible');

    cy
      .get('@filtersButton')
      .click();

    cy.viewport(640, 720);

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('.app-nav')
      .should('have.class', 'is-minimized');

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy
      .get('.list-page__list')
      .should('be.visible');

    cy.get('@filtersButton').click();

    cy
      .get('@layout')
      .should('not.have.class', 'is-filters-collapsed')
      .find('.patient-list-page__sidebar')
      .should('be.visible')
      .and('have.attr', 'aria-hidden', 'false');

    cy
      .get('.worklist-list__item')
      .first()
      .find('.js-select')
      .should('have.attr', 'aria-label', 'Select action');

    cy
      .get('.js-close-sidebar-drawer')
      .should('be.focused')
      .type('{esc}');

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('@filtersButton')
      .should('be.focused')
      .and('have.attr', 'aria-expanded', 'false');

    cy.viewport(390, 720);

    cy
      .get('.list-page__topbar')
      .should('be.visible');

    cy
      .get('@filtersButton')
      .click();

    cy
      .get('.patient-list-page__sidebar')
      .should('be.visible');

    cy
      .get('.js-close-sidebar-drawer')
      .click();

    cy.viewport(1200, 720);

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy.viewport(2200, 900);

    cy
      .get('.worklist-list__list')
      .should($list => {
        expect($list[0].getBoundingClientRect().width).to.equal(1440);
      });

    cy.viewport(2240, 900);

    cy
      .get('@layout')
      .should('not.have.class', 'is-filters-collapsed');

    cy
      .get('@filtersButton')
      .should('not.be.visible');

    cy.viewport(2239, 900);

    cy
      .get('@filtersButton')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'true')
      .click();

    cy
      .get('@layout')
      .should('have.class', 'is-filters-collapsed');

    cy.viewport(2240, 900);

    cy
      .get('@layout')
      .should('not.have.class', 'is-filters-collapsed');
  });

  specify('patient sidebar desktop cards', function() {
    cy.viewport(1820, 900);

    openPatientSidebar(4);

    cy
      .window()
      .should(win => {
        expect(win.matchMedia('(width >= 1800px)').matches).to.be.true;
      });

    cy
      .get('.patient-sidebar__card')
      .should('have.length', 4)
      .then($cards => {
        const cards = [...$cards].map(card => card.getBoundingClientRect());
        const [firstCard] = cards;

        expect(firstCard.width).to.equal(260);
        expect(cards.every(card => card.width === 260)).to.be.true;
        expect(Math.max(...cards.map(card => card.left))).to.be.greaterThan(firstCard.right);
      });
  });

  specify('patient sidebar mobile scrolling', function() {
    cy.viewport(390, 400);

    openPatientSidebar(4, 'actions');

    cy
      .get('.patient-list-page__sidebar-content')
      .should(([sidebarContent]) => {
        expect(sidebarContent.scrollHeight).to.be.greaterThan(sidebarContent.clientHeight);

        sidebarContent.scrollTop = sidebarContent.scrollHeight;

        expect(sidebarContent.scrollTop).to.be.greaterThan(0);
      });
  });

  specify('keeps patient sidebar mounted while list refreshes', function() {
    const testAction = getAction({
      relationships: {
        patient: getRelationship(testPatient1),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = [testAction];
        fx.included.push(testPatient1);
        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient1;
        return fx;
      })
      .routePanels()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .contains('Test Patient')
      .click();

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('[data-date-filter-region]')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Last Week')
      .click()
      .wait('@routeActions');

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.list-filters')
      .should('not.exist');

    cy
      .get('.patient-sidebar__close')
      .click();

    cy
      .get('.list-filters')
      .should('be.visible');
  });

  specify('flow list', function() {
    const testFlows = [
      getFlow({
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
    const getFirstRow = () => cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .first();

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: currentClinician.id,
      customFilters: {},
      actionsSelected: {},
      flowsSelected: {
        [testFlows[0].id]: true,
      },
    }));

    cy
      .routesForPatientAction()
      .routeFlows(fx => {
        fx.data = testFlows;

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
      .routeFlowActivity()
      .routePatientByFlow()
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.js-patient') // Wait for list to render
      .should(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));
        expect(storage.actionsWorklist).to.exist;
      });

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'fields[patients]=first_name,last_name,patient-fields,segment')
      .should('not.contain', 'fields[flows]=name,state');

    cy
      .get('.js-patient') // Wait for list to render
      .should(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));
        expect(storage.flowsWorklist).to.exist;
      });

    cy
      .get('.worklist-list__item')
      .first()
      .find('.worklist-list__underline')
      .should('contain', 'Cedarwood Rehabilitation & Healthcare Center');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 1 Flow');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Flows');

    getFirstRow()
      .should($row => {
        expect($row).to.have.class('worklist-list__item');
        expect($row).to.have.class('worklist-list__flow-item');
        expect($row.find('.work-card__state[data-state-region]')).not.to.be.empty;
      });

    getFirstRow()
      .should('have.class', 'is-selected');

    getFirstRow()
      .find('.js-select')
      .click();

    getFirstRow()
      .find('.js-select')
      .click('bottom');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    getFirstRow()
      .find('.js-select')
      .click('bottom');

    cy
      .get('[data-select-all-region] button:enabled')
      .click();

    getFirstRow()
      .find('.js-select')
      .click('bottom');

    cy
      .get('.bulk-edit-inline')
      .should('contain', 'Edit 2 Flows');

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item.is-selected')
      .should('have.length', 0);

    cy
      .get('.worklist-list__toggle')
      .contains('Actions')
      .should('have.attr', 'aria-pressed', 'false')
      .should('contain', 'Actions')
      .next()
      .should('contain', 'Flows')
      .should('have.attr', 'aria-pressed', 'true');

    cy
      .intercept('PATCH', `/api/flows/${ testFlows[0].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    getFirstRow()
      .find('progress.progress-bar')
      .should('have.value', 0);

    getFirstRow()
      .find('progress.progress-bar')
      .should('have.attr', 'max', '2');

    cy.viewport(1600, 900);

    getFirstRow()
      .should('contain', '0 / 2 Actions')
      .should($row => {
        expect($row.find('.patient-list__flow-progress').parent()).to.have.class('flow-card__controls');
        expect($row.find('.work-card__meta progress')).to.have.lengthOf(0);
      });

    cy.viewport(1280, 720);

    getFirstRow()
      .find('.fa-circle-exclamation')
      .should('not.match', 'button');

    getFirstRow()
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

    getFirstRow()
      .find('.work-card__title')
      .focus()
      .typeEnter()
      .wait('@routeFlow')
      .wait('@routeFlowActions');

    cy
      .url()
      .should('contain', `flow/${ testFlows[0].id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeFlows');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .click();

    cy.wait('@routePatient');

    cy
      .location('pathname')
      .should('contain', '/worklist/owned-by');

    cy
      .get('.list-filters')
      .should('not.exist');

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .should('have.class', 'patient-list__patient--selected')
      .and('have.css', 'color', 'rgb(51, 51, 51)');

    cy.viewport(640, 720);

    cy
      .get('.list-page')
      .should('have.class', 'is-filters-collapsed');

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.list-filters')
      .should('not.be.visible');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .should('not.have.class', 'patient-list__patient--selected');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .as('patientSidebarTrigger')
      .click();

    cy
      .wait('@routePatient')
      .get('.patient-sidebar')
      .should('be.visible');

    cy
      .get('.patient-list-page__all-filters-button')
      .should('have.attr', 'aria-expanded', 'false');

    cy
      .get('.js-close-sidebar-drawer')
      .should('not.be.visible');

    cy.viewport(1280, 768);

    cy
      .get('.list-page')
      .should('not.have.class', 'is-filters-collapsed');

    cy
      .get('.patient-sidebar')
      .should('be.visible')
      .find('.patient-sidebar__close')
      .click();

    cy
      .get('@patientSidebarTrigger')
      .should('be.focused');

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .click();

    cy
      .wait('@routePatient')
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
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
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
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
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
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
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .click();

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.patient-sidebar__close')
      .click();

    cy
      .get('.patient-sidebar')
      .should('not.exist');

    cy
      .get('.list-filters')
      .should('be.visible');

    cy
      .visit('/worklist/owned-by')
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

  specify('flow list - socket notifications', function() {
    const testSocketFlow = getFlow({
      attributes: {
        name: 'Test Flow - Subscribed on Page Load',
        updated_at: testTsSubtract(4),
        created_at: testTsSubtract(4),
      },
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
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
        updated_at: testTsSubtract(3),
        created_at: testTsSubtract(3),
      },
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    const testNewStateSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - State Updated to Match Current Worklist Filter',
        updated_at: testTsSubtract(2),
        created_at: testTsSubtract(2),
      },
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    const testNewOwnerSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - Owner Updated to Match Current Worklist Filter',
        updated_at: testTsSubtract(1),
        created_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      listType: 'flows',
      flowsSortId: 'sortCreatedDesc',
      clinicianId: currentClinician.id,
      states: [stateTodo, stateInProgress],
      customFilters: {},
    }));

    cy
      .routesForPatientAction()
      .routeFlows(fx => {
        fx.data = [testSocketFlow];

        fx.included.push(testPatient1);

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
      .visitOnClock('/worklist/owned-by', { now: testTs() })
      .wait('@routeFlows');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const startOfMonth = dayjs().startOf('month').format();
        const endOfMonth = dayjs().endOf('month').format();

        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          flows: {
            created_at: [startOfMonth, endOfMonth].join(),
            states: NIL_UUID,
            clinicians: currentClinician.id,
          },
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
      .find('.worklist-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.work-card__meta')
      .should('contain', formatDate(testTs(), 'TIME_OR_DAY'))
      .find('.work-card__timestamps > span')
      .should('have.length', 2);

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

    cy
      .get('@firstRow')
      .find('[data-state-region] .fa-circle-dot');

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        owner: {
          type: teamCoordinator.type,
          id: teamCoordinator.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'CO');

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
      .find('progress.progress-bar')
      .should('have.value', 1)
      .should('have.attr', 'max', 3);

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

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that flow
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewSocketFlow.type,
        id: testNewSocketFlow.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
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
      .get('[data-count-region]')
      .should('contain', '2 Flows');

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - Created Elsewhere');

    cy
      .get('@firstRow')
      .find('[data-state-region] .fa-circle-dot');

    // ensures we subscribe correctly to models added to the worklist via ws
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewSocketFlow.type,
        id: testNewSocketFlow.id,
      },
      payload: {
        state: {
          type: stateDone.type,
          id: stateDone.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-state-region] .fa-circle-check');

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
          type: stateTodo.type,
          id: stateTodo.id,
        },
      },
    });

    cy
      .wait('@routeFlow')
      .its('request.url')
      .should('contain', testNewStateSocketFlow.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - State Updated to Match Current Worklist Filter');

    cy
      .routeFlow(fx => {
        fx.data = testNewOwnerSocketFlow;

        return fx;
      });

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testNewOwnerSocketFlow.type,
        id: testNewOwnerSocketFlow.id,
      },
      payload: {
        owner: {
          type: currentClinician.type,
          id: currentClinician.id,
        },
      },
    });

    cy
      .wait('@routeFlow')
      .its('request.url')
      .should('contain', testNewOwnerSocketFlow.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - Owner Updated to Match Current Worklist Filter');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewOwnerSocketFlow.type,
        id: testNewOwnerSocketFlow.id,
      },
      payload: {},
    });

    cy
      .get('[data-count-region]')
      .should('contain', '3 Flows');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .should('have.length', 3);
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
      .should('contain', `filter[states]=${ stateDone.id },${ stateUnableToComplete.id },${ stateThmgTransferred.id }`);

    cy
      .intercept('PATCH', '/api/flows/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.card-list')
      .find('.worklist-list__item')
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
        expect(data.relationships.state.data.id).to.equal(stateInProgress.id);
      });
  });

  specify('action list', function() {
    const longFlowName = 'Transitional Care Coordination Following Hospital Discharge';
    const priorYear = dayjs(testDate()).subtract(1, 'year');
    const testFlow = getFlow({
      attributes: {
        name: longFlowName,
      },
      relationships: {
        state: getRelationship(stateInProgress),
      },
    });

    const testActions = [
      getAction({
        attributes: {
          name: 'First In List',
          details: 'Like the legend of the phoenix All ends with beginnings What keeps the planet spinning The force from the beginning Look We\'ve come too far To give up who we are So let\'s raise the bar And our cups to the stars',
          due_date: testDate(),
          due_time: '06:01:00',
          updated_at: testTs(),
          options: {
            icon: 'caret-down',
            iconType: 'fas',
            color: 'red',
          },
        },
        relationships: {
          state: getRelationship(stateTodo),
          flow: getRelationship(testFlow),
          form: getRelationship(testForm),
          files: getRelationship([getFile()]),
          owner: getRelationship(teamCoordinator),
          patient: getRelationship(testPatient1),
          comments: getRelationship([getComment()]),
        },
      }),
      getAction({
        attributes: {
          name: 'Last In List',
          details: 'Details gonna detail',
          due_date: testDateAdd(5),
          due_time: null,
          created_at: priorYear.format(),
          updated_at: priorYear.add(1, 'day').format(),
          outreach: ACTION_OUTREACH.PATIENT,
        },
        relationships: {
          state: getRelationship(stateDone),
          owner: getRelationship(teamCoordinator),
          patient: getRelationship(testPatient2),
        },
      }),
      getAction({
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

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: currentClinician.id,
      customFilters: {},
      actionsSelected: {
        [testActions[0].id]: true,
      },
      flowsSelected: {},
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = testActions;

        fx.included.push(testPatient1, testPatient2, testFlow);

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
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visitOnClock('/worklist/owned-by', { now: testTime, functionNames: ['Date'] });

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 1 Action');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Actions');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .first()
      .as('firstRow')
      .should('have.class', 'is-selected')
      .should('contain', longFlowName)
      .should('contain', 'First In List')
      .should('contain', 'Cedarwood Rehabilitation & Healthcare Center')
      .find('.work-card__state[data-state-region]')
      .find('.fa-circle-exclamation');

    cy
      .get('@firstRow')
      .should('have.class', 'worklist-list__action-item');

    cy.viewport(390, 720);

    cy
      .get('@firstRow')
      .find('.worklist-list__patient-context')
      .should('be.visible');

    cy.viewport(1280, 720);

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .eq(1)
      .should('contain', 'Second In List');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .should('contain', 'Last In List')
      .find('.work-card__state[data-state-region]')
      .find('.fa-circle-check');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .find('.work-card__aside')
      .find('.work-card__meta .u-text--nowrap')
      .should('have.length', 2)
      .each($date => {
        expect($date.text()).to.contain(priorYear.year());
      });

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
      .should('have.attr', 'aria-pressed', 'true')
      .next()
      .should('have.attr', 'aria-pressed', 'false')
      .should('contain', 'Flows');

    cy
      .routeFlow()
      .routeFlowActions()
      .routeFlowActivity()
      .routePatientByFlow();

    cy
      .get('@firstRow')
      .find('.work-card__title')
      .click()
      .wait('@routeFlow');

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }/action/${ testActions[0].id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .first()
      .find('.js-flow')
      .click()
      .wait('@routeFlow');

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }`)
      .should('not.contain', `/action/${ testActions[0].id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .intercept('GET', '/api/patients/**?*', {
        delay: 1000,
        body: { data: testPatient1, included: [] },
      })
      .as('routeLoadingPatient');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .click();

    cy
      .get('.patient-sidebar__name')
      .click();

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient1.id }/workflow`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions')
      .routePatient(fx => {
        fx.data = testPatient1;

        return fx;
      });

    cy
      .get('.worklist-list__item')
      .first()
      .find('[data-form-region] button')
      .click()
      .wait('@routeFormByAction');

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient1.id }/flow/${ testFlow.id }/action/${ testActions[0].id }`);

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .routeAction(fx => {
        fx.data = testActions[2];
        return fx;
      });

    cy
      .get('.worklist-list__item')
      .eq(1)
      .as('secondRow')
      .click('bottom');

    cy
      .wait('@routeAction');

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient1.id }/action/${ testActions[2].id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .first()
      .contains('Test Patient')
      .click();

    cy
      .wait('@routePatient');

    cy
      .location('pathname')
      .should('contain', '/worklist/owned-by');

    cy
      .get('.patient-sidebar__name')
      .should('contain', 'Test Patient')
      .find('.patient-sidebar__name-chevron use')
      .should('have.attr', 'href', '#fas-fa-chevron-right');

    cy
      .get('.patient-sidebar')
      .find('.js-menu')
      .should('not.exist');

    cy
      .get('.patient-sidebar__name')
      .click();

    cy
      .wait('@routePatient');

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient1.id }/workflow`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .first()
      .click('bottom');

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }/action/${ testActions[0].id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .routeAction(fx => {
        fx.data = testActions[1];
        return fx;
      });

    cy
      .get('.worklist-list__item')
      .last()
      .find('.work-card__title')
      .click()
      .wait('@routeAction');

    cy
      .location('pathname', { timeout: 10000 })
      .should('contain', `/patient/${ testPatient2.id }/action/${ testActions[1].id }`);

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .get('.worklist-list__item')
      .first()
      .as('firstRow');

    cy
      .get('.worklist-list__item')
      .eq(1)
      .as('secondRow');

    cy
      .intercept('PATCH', `/api/actions/${ testActions[0].id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('@firstRow')
      .find('.fa-circle-exclamation')
      .click();

    cy
      .get('@firstRow')
      .find('.action-details-tooltip')
      .should('exist');

    cy
      .get('@firstRow')
      .find('.work-card__title-row [data-form-region] button')
      .should('have.class', 'action-form-button');

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
      .should('exist')
      .next()
      .should('contain', '1');

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
      .get('@firstRow')
      .should($row => {
        expect($row.find('.fa-paperclip').parent().index()).to.be.lessThan($row.find('.fa-comment').parent().index());
      });

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
      .find('.worklist-list__item')
      .last()
      .find('[data-form-region]')
      .should('be.empty');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', longFlowName)
      .should('contain', 'First In List')
      .should('contain', 'Like the legend of the phoenix All ends with beginnings What keeps the planet spinning The force from the beginning Look We\'ve come too far...');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('mouseout');

    cy
      .get('.tooltip')
      .should('not.exist');

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
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient1.id }/action/${ testActions[2].id }`);

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    cy
      .wait('@routeFormActionFields')
      .go('back')
      .wait('@routeActions');

    cy
      .intercept('GET', '/api/actions/*/form', {
        delay: 200,
        body: { data: testForm, included: [] },
      })
      .as('routeDelayedFormByAction')
      .intercept('GET', '/api/actions/**/files?urls=download,view', {
        delay: 100,
        body: { data: [getFile()], included: [] },
      })
      .as('routeDelayedActionFiles');

    cy
      .routeAction(fx => {
        fx.data = testActions[0];

        return fx;
      })
      .get('.worklist-list__action-item')
      .first()
      .find('.js-comments')
      .click()
      .wait('@routeAction')
      .wait('@routeActionActivity');

    cy
      .get('[data-activity-region]')
      .should('be.focused');

    cy
      .get('.patient-action')
      .should(([viewport]) => {
        const activity = viewport.querySelector('[data-activity-region]').getBoundingClientRect();
        const bounds = viewport.getBoundingClientRect();

        expect(viewport.scrollTop).to.be.greaterThan(0);
        expect(activity.top).to.be.at.least(bounds.top);
        expect(activity.top).to.be.lessThan(bounds.bottom);
      })
      .wait('@routeDelayedActionFiles')
      .wait('@routeDelayedFormByAction');
  });

  specify('action list - socket notifications', function() {
    const testComment = getComment();
    const testSocketFileId = uuid();

    const testFlow = getFlow({
      attributes: {
        name: 'Test Flow',
      },
      relationships: {
        state: getRelationship(stateInProgress),
      },
    });

    const testSocketAction = getAction({
      attributes: {
        name: 'Test Action - Subscribed on Page Load',
        updated_at: testTsSubtract(4),
        created_at: testTsSubtract(4),
      },
      relationships: {
        state: getRelationship(stateTodo),
        flow: getRelationship(testFlow),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    const testNewSocketAction = getAction({
      attributes: {
        name: 'New Action - Created Elsewhere',
        updated_at: testTsSubtract(3),
        created_at: testTsSubtract(3),
      },
      relationships: {
        state: getRelationship(stateTodo),
        flow: getRelationship(testFlow),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    const testNewStateSocketAction = getAction({
      attributes: {
        name: 'New Action - State Updated to Match Current Worklist Filter',
        updated_at: testTsSubtract(2),
        created_at: testTsSubtract(2),
      },
      relationships: {
        state: getRelationship(stateTodo),
        flow: getRelationship(testFlow),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    const testNewOwnerSocketAction = getAction({
      attributes: {
        name: 'New Action - Owner Updated to Match Current Worklist Filter',
        updated_at: testTsSubtract(1),
        created_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
        flow: getRelationship(testFlow),
        owner: getRelationship(currentClinician),
        patient: getRelationship(testPatient1),
      },
    });

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      listType: 'actions',
      actionsSortId: 'sortCreatedDesc',
      clinicianId: currentClinician.id,
      states: [stateTodo.id, stateInProgress.id],
      flowStates: [stateTodo.id, stateInProgress.id],
      customFilters: {},
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = [testSocketAction];

        fx.included.push(testPatient1, testFlow);

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient1;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testSocketAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .visitOnClock('/worklist/owned-by', { now: testTs() })
      .wait('@routeActions');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const startOfMonth = dayjs().startOf('month').format();
        const endOfMonth = dayjs().endOf('month').format();
        const states = [stateTodo.id, stateInProgress.id].join();

        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          actions: {
            created_at: [startOfMonth, endOfMonth].join(),
            states,
            flow_states: states,
            clinicians: currentClinician.id,
          },
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
      .find('.worklist-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.work-card__meta')
      .should('contain', formatDate(testTs(), 'TIME_OR_DAY'));

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

    cy
      .get('@firstRow')
      .find('[data-state-region] .fa-circle-dot');

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        owner: {
          type: teamCoordinator.type,
          id: teamCoordinator.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'CO');

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
          type: testComment.type,
          id: testComment.id,
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
            view: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient1.id }/view/HRA.pdf`,
            download: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient1.id }/download/HRA.pdf`,
          },
        },
      },
    });

    cy
      .get('@firstRow')
      .find('.fa-paperclip')
      .should('exist');

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

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that action
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewSocketAction.type,
        id: testNewSocketAction.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

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
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewSocketAction.id);

    cy
      .get('[data-count-region]')
      .should('contain', '2 Actions');

    cy
      .get('@firstRow')
      .should('contain', 'New Action - Created Elsewhere');

    cy
      .get('@firstRow')
      .find('[data-state-region] .fa-circle-dot');

    // ensures we subscribe correctly to models added to the worklist via ws
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewSocketAction.type,
        id: testNewSocketAction.id,
      },
      payload: {
        state: {
          type: stateDone.type,
          id: stateDone.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-state-region] .fa-circle-check');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewSocketAction.type,
        id: testNewSocketAction.id,
      },
      payload: {},
    });

    cy
      .get('[data-count-region]')
      .should('contain', '1 Action');

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

    cy
      .get('[data-count-region]')
      .should('contain', '2 Actions');

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
          type: stateTodo.type,
          id: stateTodo.id,
        },
      },
    });

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewStateSocketAction.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Action - State Updated to Match Current Worklist Filter');

    cy
      .routeAction(fx => {
        fx.data = testNewOwnerSocketAction;

        return fx;
      });

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testNewOwnerSocketAction.type,
        id: testNewOwnerSocketAction.id,
      },
      payload: {
        owner: {
          type: currentClinician.type,
          id: currentClinician.id,
        },
      },
    });

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewOwnerSocketAction.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Action - Owner Updated to Match Current Worklist Filter');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewOwnerSocketAction.type,
        id: testNewOwnerSocketAction.id,
      },
      payload: {},
    });

    cy
      .get('[data-count-region]')
      .should('contain', '3 Actions');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .should('have.length', 3);
  });

  specify('actions on a done-flow list', function() {
    const testFlow = getFlow({
      attributes: {
        name: 'Test Flow',
      },
      relationships: {
        state: getRelationship(stateDone),
      },
    });

    const missingFlow = getFlow();
    const actionMissingFlow = getAction({
      relationships: {
        flow: getRelationship(missingFlow),
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

        // Add flow relationship without including it
        fx.data.push(actionMissingFlow);

        fx.included.push(testFlow);

        return fx;
      })
      .visit('/worklist/owned-by');

    cy.window().then(win => {
      cy.stub(win.console, 'error').as('consoleError');
    });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', 'fields[patients]=first_name,last_name,patient-fields,segment')
      .should('contain', 'fields[flows]=name,state');

    cy
      .get('.action-card__controls, .flow-card__controls')
      .find('button')
      .should('not.exist');

    cy
      .get('@consoleError')
      .should('be.calledWith', `Missing flow ${ missingFlow.id } for action ${ actionMissingFlow.id }`);
  });

  specify('maximum list count reached', function() {
    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: currentClinician.id,
      customFilters: {},
    }));

    cy
      .routesForPatientAction()
      .routeActions(fx => {
        fx.data = _.times(50, n => {
          const actionName = n === 0 ? 'First Action' : `Action ${ n + 1 }`;
          const patient = n % 2 ? testPatient1 : testPatient2;

          return getAction({
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
      .get('.list-page')
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

    const testCurrentClinician = getCurrentClinician({ relationships });

    const testClinician = getClinician({
      attributes: { name: 'Test Clinician' },
      relationships,
    });

    cy
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          testCurrentClinician,
          testClinician,
          getClinician({
            attributes: { name: 'C Clinician' },
            relationships,
          }),
          getClinician({
            attributes: { name: 'A Clinician' },
            relationships,
          }),
          getClinician({
            attributes: { name: 'B Clinician' },
            relationships,
          }),
          getClinician({
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
      .should('contain', `filter[clinicians]=${ testCurrentClinician.id }`)
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

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
      .should('contain', `filter[clinicians]=${ testClinician.id }`)
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

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
      .should('contain', `filter[clinicians]=${ testCurrentClinician.id }`)
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

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
      .should('contain', `filter[clinicians]=${ testClinician.id }`);
  });

  specify('owner filtering', function() {
    const relationships = {
      role: getRelationship(roleEmployee),
    };

    const testClinicians = [
      getCurrentClinician({ relationships }),
      getClinician({
        attributes: { name: 'Test Clinician' },
        relationships: {
          team: getRelationship(teamCoordinator),
          role: getRelationship(roleEmployee),
        },
      }),
      getClinician({
        attributes: { name: 'C Clinician' },
        relationships,
      }),
      getClinician({
        attributes: { name: 'A Clinician' },
        relationships,
      }),
      getClinician({
        attributes: { name: 'B Clinician' },
        relationships,
      }),
    ];

    cy
      .routeWorkspaceClinicians(fx => {
        fx.data = testClinicians;

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
      .should('contain', `filter[clinicians]=${ testClinicians[2].id }`);

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
      .should('have.attr', 'aria-pressed', 'false')
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[clinicians]=${ NIL_UUID }`)
      .should('contain', `filter[teams]=${ teamNurse.id }`);

    cy
      .get('[data-owner-toggle-region]')
      .contains('No Owner')
      .should('have.attr', 'aria-pressed', 'true')
      .click();

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', `filter[clinicians]=${ NIL_UUID }`)
      .should('contain', `filter[teams]=${ teamNurse.id }`);
  });

  specify('date filtering', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();
    const filterDate = testDateSubtract(1);

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: currentClinician.id,
      customFilters: {},
      actionsDateFilters: {
        selectedDate: filterDate,
        dateType: 'created_at',
      },
      actionsSelected: {
        [uuid()]: true,
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
      .should('contain', 'This Month');

    cy
      .get('[data-date-filter-region]')
      .find('.js-prev, .js-next')
      .should('have.length', 2)
      .and('be.visible');

    cy
      .get('[data-date-filter-region]')
      .click();

    cy
      .get('[data-date-type-region]')
      .should('not.contain', 'Due');

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.worklist-list__toggle')
      .find('.js-toggle-actions')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Added:')
      .should('contain', formatDate(filterDate, 'MM/DD/YYYY'))
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Last Week')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.equal('lastweek');
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
      })
      .wait('@routeActions');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Last Week')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Updated')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('This Month')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.dateType).to.equal('updated_at');
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.relativeDate).to.equal('thismonth');
      })
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[updated_at]=${ dayjs(testDate()).startOf('month').format() },${ dayjs(testDate()).endOf('month').format() }`);

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'Updated:')
      .should('contain', 'This Month')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Due')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('Select from calendar')
      .click();

    cy
      .get('.app-frame__pop-region .js-current-week')
      .click()
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ dayjs(testDate()).startOf('week').format('YYYY-MM-DD') },${ dayjs(testDate()).endOf('week').format('YYYY-MM-DD') }`);

    cy
      .get('[data-date-filter-region] .js-prev')
      .click()
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[due_date]=${ dayjs(testDate()).subtract(1, 'week').startOf('week').format('YYYY-MM-DD') },${ dayjs(testDate()).subtract(1, 'week').endOf('week').format('YYYY-MM-DD') }`);

    cy
      .get('[data-date-filter-region]')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('All Time')
      .click()
      .then(() => {
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.actionsDateFilters.relativeDate).to.equal('alltime');
        expect(storage.actionsDateFilters.selectedDate).to.be.null;
        expect(storage.actionsDateFilters.selectedMonth).to.be.null;
        expect(storage.actionsDateFilters.dateType).to.equal('due_date');
      });

    cy
      .wait('@routeActions')
      .itsUrl()
      .its('search')
      .should('not.contain', 'filter[due_date]');

    cy
      .get('[data-date-filter-region]')
      .should('contain', 'All Time');
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
      .should('contain', 'include=patient,patient.patient-fields.foo');

    cy
      .get('.worklist-list__toggle')
      .contains('Flows')
      .click()
      .wait('@routeFlows');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Created Most Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Updated Least Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'APatient AName');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'APatient BName');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Patient Field B');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Patient Field None');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .routeSettings('sorting', [
        {
          id: 'sortCustomDesc',
          text: 'Foo: Highest - Lowest',
          direction: 'desc',
          field_name: 'foo',
          sort_type: 'numeric',
        },
        {
          id: 'sortCustomAsc',
          text: 'Foo: Lowest - Highest',
          direction: 'asc',
          field_name: 'foo',
          sort_type: 'numeric',
        },
      ])
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Patient Field 2');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Patient Field None');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .should('contain', 'Patient Field 2');
  });

  specify('action sorting - preload', function() {
    localStorage.setItem(`shared-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'shared-by',
      actionsSortId: 'sortNotExisting',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: currentClinician.id,
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
        const storage = JSON.parse(localStorage.getItem(`shared-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Updated Least Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .next()
      .should('contain', 'Due Time Most Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .last()
      .prev()
      .should('contain', 'Due Time Most Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Updated Most Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .should('contain', 'Created Least Recent');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'APatient AName');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'APatient BName');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .should('contain', 'include=patient,patient.patient-fields.foo');

    cy
      .get('.worklist-list__filter-sort')
      .click()
      .get('.picklist')
      .contains('Foo: Highest - Lowest')
      .click();

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Patient Field B');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .first()
      .should('contain', 'Field None');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .should('contain', 'Patient Field B');
  });

  specify('find in list', function() {
    const lastYear = dayjs().year() - 1;

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      actionsSortId: 'sortUpdateDesc',
      flowsSortId: 'sortUpdateDesc',
      clinicianId: currentClinician.id,
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
              owner: getRelationship(currentClinician),
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
      .get('.list-page')
      .find('[data-search-region] .js-input')
      .as('listSearch')
      .should('have.attr', 'placeholder', 'Find in List…')
      .focus()
      .type('abcd')
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
      .get('.list-page__list')
      .as('flowList')
      .find('.card-list__empty')
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
      .should('contain', '6 Flows');

    cy
      .get('@flowList')
      .find('.worklist-list__item')
      .should('have.length', 6);

    cy
      .get('@listSearch')
      .type('Test');

    cy
      .get('[data-count-region]')
      .should('contain', '3 Flows');

    cy
      .get('@flowList')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .should('have.length', 3);

    cy
      .get('[data-select-all-region]')
      .find('button')
      .click();

    cy
      .get('@flowList')
      .find('.worklist-list__item .fa-square-check')
      .should('have.length', 3);

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-check');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('@listSearch')
      .next()
      .click();

    cy
      .get('[data-select-all-region]')
      .find('.fa-square-minus');

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Flows');

    cy
      .get('.patient-list-page__summary')
      .should('not.be.visible');

    cy
      .get('[data-select-all-region]')
      .find('button')
      .click();

    cy
      .get('@flowList')
      .find('.worklist-list__item .fa-square-check')
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
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Flows');

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
      .type('Clinician');

    cy
      .get('[data-count-region]')
      .should('contain', '1 Flow')
      .should('not.contain', 'Flows');

    cy
      .get('@flowList')
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
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
      .find('.worklist-list__item')
      .contains('Flow - Team/State Search');

    cy
      .get('[data-date-filter-region]')
      .click();

    cy
      .get('.app-frame__pop-region')
      .contains('This Month')
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
      .get('.list-page')
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
      .find('.worklist-list__item')
      .first()
      .as('firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .as('lastTableListItem')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('.bulk-edit-inline')
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
      .find('.worklist-list__item.is-selected')
      .should('have.length', 3);

    cy
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 3 Actions');

    cy
      .get('.bulk-edit-inline')
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
      .find('.worklist-list__item.is-selected')
      .should('have.length', 1);

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click({ shiftKey: true });

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item.is-selected')
      .should('have.length', 1);

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.list-page')
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
      .find('.worklist-list__item.is-selected')
      .should('have.length', 2);

    cy
      .get('.bulk-edit-inline')
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
      .find('.worklist-list__item.is-selected')
      .should('have.length', 2);

    cy
      .get('.bulk-edit-inline')
      .find('.js-cancel')
      .click();

    cy
      .get('@firstTableListItem')
      .find('.js-select')
      .click();

    cy
      .navigate('/schedule')
      .wait('@routeActions');

    cy
      .go('back')
      .wait('@routeActions');

    cy
      .get('@lastTableListItem')
      .find('.js-select')
      .click();

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item.is-selected')
      .should('have.length', 2);
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
      .get('.card-list__empty')
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
      .get('.card-list__empty')
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
          owner: getRelationship(currentClinician),
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
          owner: getRelationship(getClinician()),
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
      .get('.bulk-edit-inline__heading')
      .should('contain', 'Edit 1 Action');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .first()
      .find('.work-card__state, .action-card__controls')
      .find('button:enabled')
      .should('have.length', 4);

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .find('.action-card__controls, .flow-card__controls')
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
          owner: getRelationship(currentClinician),
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
      .find('.worklist-list__item')
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
    const testCurrentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const testTeamMemberClinician = getClinician({
      attributes: {
        name: 'Team Member',
      },
      relationships: {
        team: getRelationship(teamCoordinator),
      },
    });

    const testNonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

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
          owner: getRelationship(testTeamMemberClinician),
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
          owner: getRelationship(testNonTeamMemberClinician),
          state: getRelationship(stateInProgress),
        },
      },
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = testCurrentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          testCurrentClinician,
          testTeamMemberClinician,
          testNonTeamMemberClinician,
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
      .find('.worklist-list__item')
      .first()
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .eq(2)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .last()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  specify('flows with work:team:manage permission', function() {
    const testCurrentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const testNonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

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
          owner: getRelationship(testNonTeamMemberClinician),
          state: getRelationship(stateInProgress),
        },
      },
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = testCurrentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          testCurrentClinician,
          testNonTeamMemberClinician,
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
      .find('.worklist-list__item')
      .first()
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
      .eq(1)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('.app-frame__content')
      .find('.worklist-list__item')
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

  specify('400 error - set default filter state', function() {
    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      customFilters: {
        invalid_filter: 'Medicare',
      },
      states: [stateTodo.id, stateInProgress.id],
      flowStates: [stateTodo.id, stateInProgress.id],
    }));

    cy
      .routesForPatientAction()
      .routeActions()
      .visit('/worklist/owned-by')
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
        const storage = JSON.parse(localStorage.getItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`));

        expect(storage.customFilters).to.deep.equal({});
        expect(storage.states).to.deep.equal([stateTodo.id, stateInProgress.id]);
      });
  });

  specify('500 error', function() {
    cy
      .routesForPatientAction()
      .routeActions()
      .visit('/worklist/owned-by')
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
