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

  specify('patient routing', function() {
    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient');

    cy
      .get('.patient__layout')
      .find('.patient__tab--selected')
      .contains('Dashboard');

    cy
      .get('.patient__layout')
      .find('.js-archive')
      .click();

    cy
      .get('.patient__layout')
      .find('.patient__tab--selected')
      .contains('Archive');

    cy
      .get('.patient__layout')
      .find('.js-dashboard')
      .click();

    cy
      .get('.patient__layout')
      .find('.patient__tab--selected')
      .contains('Dashboard');
  });
});
