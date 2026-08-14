import { getPatient } from 'support/api/patients';

context('patient page', function() {
  const testPatient = getPatient({
    attributes: {
      first_name: 'First',
      last_name: 'Last',
    },
  });

  specify('context trail', function() {
    cy
      .routesForPatientDashboard()
      .routeActions()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
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
      .url()
      .should('contain', 'worklist/owned-by');
  });

  specify('starts with the patient sidebar closed in drawer mode', function() {
    cy
      .viewport(720, 720)
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .type('{esc}');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');
  });

  specify('patient routing', function() {
    cy
      .viewport(1920, 900)
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
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
      .find('.js-archive')
      .click();

    cy
      .get('.patient__layout')
      .find('.workflow-page__tab.is-selected')
      .contains('Closed');

    cy
      .get('.patient__layout')
      .find('.js-dashboard')
      .click();

    cy
      .get('.patient__layout')
      .find('.workflow-page__tab.is-selected')
      .contains('Open');
  });
});
