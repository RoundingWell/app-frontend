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

  specify('uses drawer, collapsible, and fixed wide patient sidebar modes', function() {
    cy
      .viewport(720, 720)
      .routesForPatientDashboard()
      .routeSidebars(fx => {
        const [sidebar] = fx.data;

        fx.data.push({
          ...sidebar,
          id: 'second-sidebar',
          attributes: {
            ...sidebar.attributes,
            sequence: 1,
          },
        });

        return fx;
      })
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

    cy.viewport(1799, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'true')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.viewport(1800, 720);

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false')
      .click();

    cy.viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .click();

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy.viewport(2240, 720);

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
      .should($cards => {
        expect(getComputedStyle($cards[0]).gridTemplateColumns).to.equal('260px 260px');
      });

    cy
      .get('.patient__sidebar-toggle')
      .should('not.be.visible');

    cy.viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'true');
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
      .find('.workflow-page__tab.is-selected')
      .contains('Open');

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
