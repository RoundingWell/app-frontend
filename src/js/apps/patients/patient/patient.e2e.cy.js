import { getPatient } from 'support/api/patients';
import { getCurrentClinician } from 'support/api/clinicians';

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
            name: 'Care Plan',
            sequence: 1,
            widgets: ['dob'],
          },
        }, {
          ...sidebar,
          id: 'third-sidebar',
          attributes: {
            ...sidebar.attributes,
            name: 'Forms',
            sequence: 2,
            widgets: ['sex'],
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

    cy.viewport(2239, 720);

    cy
      .get('.patient__sidebar-toggle')
      .should('be.visible')
      .and('have.attr', 'aria-expanded', 'false');
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

  specify('remembers the patient sidebar across patients and reloads', function() {
    const otherPatient = getPatient();
    const currentClinician = getCurrentClinician();
    const preferenceKey = `isPatientSidebarHidden_${ currentClinician.id }`;

    cy
      .viewport(1280, 720)
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
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
      .visit(`/patient/dashboard/${ otherPatient.id }`)
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
