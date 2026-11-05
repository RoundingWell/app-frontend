import { getPatient } from 'support/api/patients';

context('named application routing', function() {
  let releaseResponse;
  let navigationReady;

  afterEach(function() {
    releaseResponse?.();
    releaseResponse = null;
    if (navigationReady) cy.then(() => navigationReady);
    navigationReady = null;
  });

  specify('navigation readiness waits for the selected patient page', function() {
    const patient = getPatient();
    let readyState;

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.workflow-page__loader')
      .should('not.exist');

    cy.window().then(win => {
      navigationReady = new Cypress.Promise(resolve => {
        win.navigation.addEventListener('navigatesuccess', () => {
          readyState = {
            loading: !!win.document.querySelector('.workflow-page__loader'),
            selected: win.document.querySelector('.workflow-page__tab.is-selected')?.textContent.trim(),
          };
          resolve();
        }, { once: true });
      });
    });

    cy
      .intercept('GET', '/api/patients/**/actions*', req => {
        return new Cypress.Promise(resolve => {
          releaseResponse = () => {
            req.reply({ body: { data: [], included: [] } });
            resolve();
          };
        });
      })
      .as('heldClosedActions');

    cy
      .get('.js-workflow-closed')
      .click();

    cy
      .get('.workflow-page__loader')
      .should('be.visible');

    cy.wrap(null).should(() => {
      expect(releaseResponse, 'closed-page response is held').to.be.a('function');
    });

    cy.then(() => releaseResponse());

    cy.wait('@heldClosedActions').then(() => {
      releaseResponse = null;
      return navigationReady;
    });

    cy.then(() => {
      expect(readyState, 'page state when the browser completes navigation').to.deep.equal({ loading: false, selected: 'Closed' });
    });

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Closed');

    cy.routePatientActions();

    cy
      .go('back');

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Open');

    cy
      .go('forward');

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Closed');
  });

  specify('recovery returns to the workspace and repeated selection refreshes the page', function() {
    cy
      .routesForDefault()
      .visit('/missing-page');

    cy
      .get('.error-page')
      .should('be.visible');

    cy
      .get('.error-page')
      .contains('Back to Your Workspace')
      .click()
      .wait('@routeActions');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Owned By"]')
      .click();

    cy.get('@routeActions.all').should('have.length', 2);

    cy
      .url()
      .should('contain', '/one/worklist/owned-by');

    cy
      .get('.error-page')
      .should('not.exist');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Owned By"]')
      .click();

    cy.get('@routeActions.all').should('have.length', 3);

    cy
      .get('.worklist-list-page')
      .should('be.visible');
  });
});
