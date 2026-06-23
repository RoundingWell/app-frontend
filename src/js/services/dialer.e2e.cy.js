import { getRelationship, getResource } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getPatient } from 'support/api/patients';
import { getFlow } from 'support/api/flows';
import { stateTodo } from 'support/api/states';
import { getCurrentClinician } from 'support/api/clinicians';
import { workspaceOne } from 'support/api/workspaces';

const STATE_VERSION = 'v6';

const testPatient = getPatient({
  attributes: {
    first_name: 'Test',
    last_name: 'Patient',
  },
});

const otherTestPatient = getPatient({
  attributes: {
    first_name: 'Other',
    last_name: 'Patient',
  },
});

const testFlow = getFlow({
  attributes: {
    name: 'Test Flow',
  },
  relationships: {
    state: getRelationship(stateTodo),
    patient: getRelationship(testPatient),
  },
});

const testAction = getAction({
  attributes: {
    name: 'Test Action',
  },
  relationships: {
    state: getRelationship(stateTodo),
    flow: getRelationship(testFlow),
    patient: getRelationship(testPatient),
  },
});

const searchResults = [
  {
    id: testPatient.id,
    type: 'patient-search-results',
    attributes: {
      ...testPatient.attributes,
      match: {
        label: 'Phone Number',
        value: '+16513216543',
      },
    },
    relationships: {
      patient: getRelationship(testPatient, 'patients'),
    },
  },
  {
    id: otherTestPatient.id,
    type: 'patient-search-results',
    attributes: {
      ...otherTestPatient.attributes,
      match: {
        label: 'Phone Number',
        value: '+16513216543',
      },
    },
    relationships: {
      patient: getRelationship(otherTestPatient, 'patients'),
    },
  },
];

context('Dialer Service', function() {
  specify('five9 - patient dashboard buttons', function() {
    const currentClinician = getCurrentClinician({
      attributes: {
        settings: { dialer: 'five9' },
      },
    });

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      listType: 'flows',
      flowsSortId: 'sortCreatedDesc',
      clinicianId: currentClinician.id,
      states: [stateTodo.id],
      customFilters: {},
    }));

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlows(fx => {
        fx.data = [testFlow];

        fx.included.push(testPatient);

        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      }, { delay: 200 })
      .routeFlowActions(fx => {
        fx.data = [testAction];

        fx.included.push(testFlow);

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
      .routePatientByFlow(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [testFlow];

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routeDashboards()
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions')
      .wait('@routeActionActivity')
      .wait('@routeActionComments')
      .wait('@routeActionFiles');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Owned By')
      .as('navOwnedByLink')
      .click()
      .wait('@routeFlows');

    cy
      .get('.five9-wrapper')
      .find('[data-patient-buttons-region] button')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('.five9-wrapper')
      .find('[data-patient-buttons-region] button')
      .as('patientButtons')
      .should('have.length', 1)
      .should('contain', 'Test Patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.patient__tabs')
      .find('.js-archive')
      .click()
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.patient__tabs')
      .find('.js-dashboard')
      .click()
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@navOwnedByLink')
      .click()
      .wait('@routeFlows');

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .get('.table-list__item')
      .contains('Test Flow')
      .click()
      .wait('@routeFlow');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.patient-flow__context-trail .js-patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.table-list__item')
      .contains('Test Flow')
      .click();

    cy
      .get('@patientButtons', { timeout: 0 })
      .should('have.length', 0);

    cy
      .wait('@routeFlow');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Dashboards')
      .click()
      .wait('@routeDashboards');

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: null,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', null);
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: {
        data: searchResults,
        included: [getResource(testPatient, 'patients')],
      },
    }).as('routePatientSearch');

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: null,
          number: '+16513216543',
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 2)
      .first()
      .should('contain', 'Test Patient')
      .next()
      .should('contain', 'Other Patient');
  });

  specify('RingCentral - patient dashboard buttons', function() {
    const currentClinician = getCurrentClinician({
      attributes: {
        settings: { dialer: 'ringcentral' },
      },
    });

    localStorage.setItem(`owned-by_${ currentClinician.id }_${ workspaceOne.id }-${ STATE_VERSION }`, JSON.stringify({
      id: 'owned-by',
      listType: 'flows',
      flowsSortId: 'sortCreatedDesc',
      clinicianId: currentClinician.id,
      states: [stateTodo.id],
      customFilters: {},
    }));

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlows(fx => {
        fx.data = [testFlow];

        fx.included.push(testPatient);

        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      }, { delay: 200 })
      .routeFlowActions(fx => {
        fx.data = [testAction];

        fx.included.push(testFlow);

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
      .routePatientByFlow(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [testFlow];

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routeDashboards()
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions')
      .wait('@routeActionActivity')
      .wait('@routeActionComments')
      .wait('@routeActionFiles');

    cy
      .get('[data-nav-content-region]')
      .find('[data-worklists-region]')
      .find('.app-nav__link')
      .contains('Owned By')
      .as('navOwnedByLink')
      .click()
      .wait('@routeFlows');

    cy
      .get('.ringcentral-wrapper')
      .find('[data-patient-buttons-region] button')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('.ringcentral-wrapper')
      .find('[data-patient-buttons-region] button')
      .as('patientButtons')
      .should('have.length', 1)
      .should('contain', 'Test Patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.patient__tabs')
      .find('.js-archive')
      .click()
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.patient__tabs')
      .find('.js-dashboard')
      .click()
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@navOwnedByLink')
      .click()
      .wait('@routeFlows');

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .get('.table-list__item')
      .contains('Test Flow')
      .click()
      .wait('@routeFlow');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.patient-flow__context-trail .js-patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.table-list__item')
      .contains('Test Flow')
      .click();

    cy
      .get('@patientButtons', { timeout: 0 })
      .should('have.length', 0);

    cy
      .wait('@routeFlow');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.app-nav')
      .find('.app-nav__bottom')
      .contains('Dashboards')
      .click()
      .wait('@routeDashboards');

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: null,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', null);
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy.intercept({
      method: 'GET',
      url: '/api/patients?filter*',
    }, {
      body: {
        data: searchResults,
        included: [getResource(testPatient, 'patients')],
      },
    }).as('routePatientSearch');

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'showPatientLinks', {
          actionId: null,
          number: '+16513216543',
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 2)
      .first()
      .should('contain', 'Test Patient')
      .next()
      .should('contain', 'Other Patient');
  });
});
