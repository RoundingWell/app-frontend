import { getRelationship, getResource } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getPatient } from 'support/api/patients';
import { getFlow } from 'support/api/flows';
import { stateTodo } from 'support/api/states';

context('Dialer Service', function() {
  specify('Patient dashboard buttons', function() {
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
      },
    });

    const testAction = getAction({
      attributes: {
        name: 'Test Action',
      },
      relationships: {
        'flow': getRelationship(testFlow),
        'patient': getRelationship(testPatient),
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

    cy
      .routesForPatientAction()
      .routeSettings('dialer', 'five9')
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [testAction];

        fx.included.push(testFlow);

        return fx;
      })
      .routePatientByFlow(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeActionActivity()
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions')
      .wait('@routeActionActivity')
      .wait('@routeActionComments')
      .wait('@routeActionFiles');

    cy
      .get('.five9-wrapper')
      .find('[data-patient-buttons-region] button')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'callNumber', {
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
      .wait('@routePatient');

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'callNumber', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 0);

    cy
      .go('back');

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'callNumber', {
          actionId: testAction.id,
          number: null,
        });
      });

    cy
      .get('@patientButtons')
      .should('have.length', 1);

    cy
      .getRadio(Radio => {
        Radio.request('dialer', 'callNumber', null);
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
        Radio.request('dialer', 'callNumber', {
          actionId: null,
          number: '+16513216543 ',
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
