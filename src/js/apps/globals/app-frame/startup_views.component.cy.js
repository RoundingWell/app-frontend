import { StartupView } from './startup_views';

context('StartupView', function() {
  beforeEach(function() {
    cy.clock();
  });

  specify('keeps fast startup visually quiet', function() {
    let view;

    cy
      .mount(() => {
        view = new StartupView();

        return view;
      })
      .get('.startup')
      .should('have.attr', 'aria-busy', 'true')
      .and('have.attr', 'role', 'status')
      .and('not.have.class', 'is-visible');

    cy.tick(549);

    cy
      .get('.startup')
      .should('not.have.class', 'is-visible');

    cy.then(() => view.dismiss());

    cy
      .get('.startup')
      .should('not.exist');
  });

  specify('reveals only when startup remains pending', function() {
    cy.mount(() => new StartupView());

    cy.tick(550);

    cy
      .get('.startup')
      .should('have.class', 'is-visible')
      .find('.startup__mark-image')
      .should('have.attr', 'src', '/rwell-logo.svg')
      .and('have.attr', 'alt', '');

    cy
      .get('.startup__status-text')
      .should('contain', 'Loading RoundingWell');
  });

  specify('finishes a revealed transition without flashing', function() {
    let view;

    cy.mount(() => {
      view = new StartupView();

      return view;
    });

    cy.tick(550);
    cy.then(() => view.dismiss());

    cy
      .get('.startup')
      .should('have.class', 'is-visible')
      .and('not.have.class', 'is-exiting');

    cy.tick(199);

    cy
      .get('.startup')
      .should('not.have.class', 'is-exiting');

    cy.tick(1);

    cy
      .get('.startup')
      .should('have.class', 'is-exiting');

    cy.tick(160);

    cy
      .get('.startup')
      .should('not.exist');
  });

  specify('shows a persistent recovery state and retries', function() {
    const reload = cy.stub().as('reload');
    let view;

    cy.mount(() => {
      view = new StartupView({ reload });

      return view;
    });

    cy.then(() => view.showError());

    cy
      .get('.startup')
      .should('have.class', 'is-error')
      .and('have.class', 'is-visible')
      .and('have.attr', 'aria-busy', 'false');

    cy
      .get('.startup__error')
      .should('be.visible')
      .and('contain', 'We couldn\'t load your workspace')
      .find('.js-retry')
      .should('be.visible')
      .click()
      .should('be.disabled');

    cy
      .get('.startup__loading')
      .should('not.be.visible');

    cy
      .get('@reload')
      .should('have.been.calledOnce');
  });
});
