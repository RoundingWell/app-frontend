import { getRelationship } from 'helpers/json-api';
import { getAction } from 'support/api/actions';
import { getPatient } from 'support/api/patients';
import { getCurrentClinician } from 'support/api/clinicians';

context('patient page', function() {
  const testPatient = getPatient({
    attributes: {
      first_name: 'First',
      last_name: 'Last',
    },
  });

  specify('patient navigation, context trail, and legacy URLs', function() {
    cy
      .log('context trail');
    cy
      .routesForPatientWorkflow()
      .routeActions()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .should('contain', 'First Last')
      .should('not.contain', 'Back to List');

    cy
      .get('.app-nav')
      .contains('Owned By')
      .click();

    cy
      .go('back')
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .should('contain', 'First Last')
      .contains('Back to List')
      .click();

    cy
      .location('pathname')
      .should('equal', '/one/worklist/owned-by');

    cy.then(() => {
      // Remove this scenario with the aliases after September 2, 2027.
      cy
        .log('legacy patient URL aliases still route');
      const legacyAction = getAction({
        attributes: { name: 'Legacy Alias Action' },
        relationships: { patient: getRelationship(testPatient) },
      });

      cy
        .routesForPatientAction()
        .routePatient(fx => {
          fx.data = testPatient;

          return fx;
        })
        .routeAction(fx => {
          fx.data = legacyAction;

          return fx;
        });

      // patient/dashboard/:patientId -> Open workflow
      cy
        .visit(`/patient/dashboard/${ testPatient.id }`)
        .wait('@routePatient');

      cy
        .get('.workflow-page__tab.is-selected')
        .contains('Open');

      // patient/archive/:patientId -> Closed workflow
      cy
        .visit(`/patient/archive/${ testPatient.id }`)
        .wait('@routePatient');

      cy
        .get('.workflow-page__tab.is-selected')
        .contains('Closed');

      // patient/archive/:patientId/action/:actionId -> Action
      cy
        .visit(`/patient/archive/${ testPatient.id }/action/${ legacyAction.id }`)
        .wait('@routeAction');

      cy
        .get('.patient-action__name')
        .should('contain', 'Legacy Alias Action');
    });

    cy.then(() => {
      cy
        .log('patient routing');
      cy
        .viewport(1920, 900)
        .routesForPatientWorkflow()
        .routePatient(fx => {
          fx.data = testPatient;

          return fx;
        })
        .visit(`/patient/${ testPatient.id }/workflow`)
        .wait('@routePatient');

      cy
        .get('.patient__layout')
        .find('.workflow-page__tab.is-selected')
        .contains('Open');

      cy
        .get('.workflow-page')
        .should($page => {
          expect($page[0].getBoundingClientRect().width).to.equal(1200);
        });

      cy
        .get('.patient__layout')
        .find('.js-workflow-closed')
        .click();

      cy
        .get('.patient__layout')
        .find('.workflow-page__tab.is-selected')
        .contains('Closed');

      cy
        .get('.patient__layout')
        .find('.js-workflow-open')
        .click();

      cy
        .get('.patient__layout')
        .find('.workflow-page__tab.is-selected')
        .contains('Open');

      cy.then(() => {
        const patient = getPatient();
        const reported = cy.stub().as('reported');
        cy.on('uncaught:exception', error => {
          if (!error.message.includes('Error Status: 400')) return;
          reported(error.message);
          return false;
        });
        cy.routesForPatientAction()
          .intercept('GET', '/api/patients/**?*', { statusCode: 400, body: { errors: [] } })
          .visit(`/patient/${ patient.id }/workflow`);
        cy
          .get('@reported')
          .should('have.been.calledWithMatch', 'Error Status: 400');
      });
    });
  });

  specify('uses drawer, collapsible, and fixed wide patient sidebar modes', function() {
    cy
      .viewport(720, 720)
      .routesForPatientWorkflow()
      .routeSettings('sidebar', ['demographics', 'care-plan', 'forms'])
      .routePanels(fx => {
        const [panel] = fx.data;

        fx.data.push({
          ...panel,
          id: 'care-plan-panel',
          attributes: {
            ...panel.attributes,
            slug: 'care-plan',
            name: 'Care Plan',
            widgets: ['dob'],
          },
        }, {
          ...panel,
          id: 'forms-panel',
          attributes: {
            ...panel.attributes,
            slug: 'forms',
            name: 'Forms',
            widgets: ['sex'],
          },
        });

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .type('{esc}');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .viewport(1799, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'true')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .viewport(1800, 720);

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false')
      .click();

    cy
      .viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .viewport(2240, 720);

    cy
      .get('.patient__frame')
      .should('not.have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient-sidebar')
      .should($sidebar => {
        expect($sidebar[0].getBoundingClientRect().width).to.equal(580);
      });

    cy
      .get('.patient-sidebar__cards')
      .find('.patient-sidebar__card')
      .should($cards => {
        const first = $cards[0].getBoundingClientRect();
        const second = $cards[1].getBoundingClientRect();
        const third = $cards[2].getBoundingClientRect();

        expect(first.height).to.be.greaterThan(second.height);
        expect(first.top).to.equal(second.top);
        expect(second.left).to.equal(first.right + 16);
        expect(third.left).to.equal(second.left);
        expect(third.top).to.equal(second.bottom + 16);
        expect(third.top).to.be.lessThan(first.bottom);
      });

    cy
      .get('.patient__sidebar-toggle')
      .should('not.be.visible');

    cy
      .viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false');

    cy
      .viewport(2240, 720)
      .reload()
      .wait('@routePatient')
      .get('.patient__frame')
      .should('not.have.class', 'patient__frame--sidebar-hidden');
  });

  specify('remembers the patient sidebar across patients and reloads', function() {
    const otherPatient = getPatient();
    const currentClinician = getCurrentClinician();
    const preferenceKey = `isPatientSidebarHidden_${ currentClinician.id }`;

    cy
      .viewport(1280, 720)
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatient')
      .get('.patient__sidebar-toggle')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem(preferenceKey))).to.be.true;
    });

    cy
      .routePatient(fx => {
        fx.data = otherPatient;

        return fx;
      })
      .visit(`/patient/${ otherPatient.id }/workflow`)
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .reload()
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .click();

    cy.window().then(win => {
      expect(JSON.parse(win.localStorage.getItem(preferenceKey))).to.be.false;
    });
  });
});
