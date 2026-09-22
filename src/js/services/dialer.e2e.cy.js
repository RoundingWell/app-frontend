import { getPatientField } from 'support/api/patient-fields';
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
    let five9Events;
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
      .routeFlowActivity()
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
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`, {
        onBeforeLoad(win) {
          let sdk;
          win.Five9 = {};
          Object.defineProperty(win.Five9, 'CrmSdk', {
            get() {
              return sdk;
            },
            set(value) {
              sdk = value;
              // Receive call notifications at the external SDK boundary.
              cy.stub(sdk.interactionApi(), 'subscribe').callsFake(events => {
                five9Events = events;
              });
            },
          });
        },
      })
      .wait('@routeFlow')
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
      .get('.workflow-page__tabs')
      .find('.js-workflow-closed')
      .click()
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.workflow-page__tabs')
      .find('.js-workflow-open')
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
      .get('.flow-card')
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
      .get('.patient__context-trail .js-patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.flow-card')
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

    cy.intercept('PATCH', '/api/artifacts/**', { statusCode: 201, body: { data: {} } }).as('saveCall');
    cy.then(() => five9Events.callFinished({
      callData: { interactionId: 'five9-completed-call', number: '+16513216543' },
      callLogData: { disposition: 'completed' },
    }));
    cy.wait('@saveCall').its('request.body.data.attributes').should('deep.include', {
      artifact: 'five9-call-log',
      identifier: 'five9-completed-call',
      values: {
        callData: { interactionId: 'five9-completed-call', number: '+16513216543' },
        callLogData: { disposition: 'completed' },
      },
    });
    cy.get('@patientButtons').should('have.length', 0);
  });

  specify('RingCentral patient links and calls while the provider loads', function() {
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
      .routeFlowActivity()
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
      .get('.workflow-page__tabs')
      .find('.js-workflow-closed')
      .click()
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.workflow-page__tabs')
      .find('.js-workflow-open')
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
      .get('.flow-card')
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
      .get('.patient__context-trail .js-patient')
      .click()
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .get('.flow-card')
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

    cy.window().then(win => {
      win.dispatchEvent(new win.MessageEvent('message', {
        origin: 'https://apps.ringcentral.com',
        data: { type: 'rc-call-start-notify', call: { direction: 'Inbound', from: '123' } },
      }));
    });
    cy.get('@patientButtons').should('have.length', 2);
    cy.intercept('PATCH', '/api/artifacts/**', { statusCode: 201, body: { data: {} } }).as('saveCall');
    cy.window().then(win => {
      win.dispatchEvent(new win.MessageEvent('message', {
        origin: 'https://apps.ringcentral.com',
        data: { type: 'rc-call-end-notify', call: { callId: 'ringcentral-completed-call' } },
      }));
    });
    cy.wait('@saveCall').its('request.body.data.attributes').should('deep.include', {
      artifact: 'ringcentral-call-log',
      identifier: 'ringcentral-completed-call',
      values: { callData: { callId: 'ringcentral-completed-call' } },
    });
    cy.get('@patientButtons').should('have.length', 0);

    cy.then(() => {
      const patient = getPatient();
      const action = getAction({ relationships: {
        patient: getRelationship(patient), state: getRelationship(stateTodo),
      } });
      const clinician = getCurrentClinician({ attributes: { settings: { dialer: 'ringcentral' } } });
      let releaseProvider;
      const providerReady = new Promise(resolve => {
        releaseProvider = resolve;
      });

      cy.intercept('GET', '**/*care-ops-ringcentral-*.js', () => providerReady).as('provider');
      cy.intercept('GET', 'https://apps.ringcentral.com/**', { body: '<html><body>Test dialer</body></html>', headers: { 'content-type': 'text/html' } });
      cy.routesForPatientAction()
        .routeCurrentClinician(fx => ({ ...fx, data: clinician }))
        .routePatient(fx => ({ ...fx, data: patient }))
        .routeAction(fx => ({ ...fx, data: action }))
        .routePatientField(fx => ({ ...fx, data: getPatientField({ attributes: {
          name: 'phones', value: [{ label: 'mobile', number: '+13215551234', preferred: true }],
        } }) }))
        .visit(`/patient/${ patient.id }/action/${ action.id }`)
        .wait('@routeAction');
      cy.get('.patient-action [data-dialer-region] button').click();
      cy.get('.picklist .js-picklist-item').contains('(321) 555-1234').click();
      cy.then(() => releaseProvider());
      cy.wait('@provider');
      cy.get('.ringcentral-panel__iframe').should('be.visible');
    });
    cy.then(() => {
      cy.routeCurrentClinician(fx => ({
        ...fx,
        data: getCurrentClinician({ attributes: { settings: { dialer: 'unavailable-provider' } } }),
      })).routeActions().visit('/worklist/owned-by');
      cy.get('.list-page').should('be.visible');
      cy.get('.ringcentral-panel__iframe').should('not.exist');
    });
  });
});
