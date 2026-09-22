import { testTs, testTsSubtract } from 'helpers/test-timestamp';

import { getProgram } from 'support/api/programs';

context('program all list', function() {
  specify('display programs list', function() {
    cy.viewport(2200, 900);

    const firstProgram = getProgram({
      attributes: {
        name: 'First in List',
        published_at: testTs(),
        archived_at: null,
        updated_at: testTs(),
      },
    });

    const lastProgram = getProgram({
      attributes: {
        name: 'Last in List',
        published_at: testTs(),
        archived_at: null,
        updated_at: testTsSubtract(2),
      },
    });

    const secondProgram = getProgram({
      attributes: {
        name: 'Second in List, Not Published',
        published_at: null,
        archived_at: null,
        updated_at: testTsSubtract(1),
      },
    });

    cy
      .routeWorkspacePrograms(fx => {
        fx.data = [firstProgram, lastProgram, secondProgram];

        return fx;
      })
      .routePrograms(fx => {
        fx.data = [firstProgram, lastProgram, secondProgram];

        return fx;
      })
      .routeProgram(fx => {
        fx.data = firstProgram;

        return fx;
      })
      .routeProgramActions()
      .routeProgramFlows()
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.js-add')
      .should('be.visible');

    cy
      .get('.card-list__item', { timeout: 10000 })
      .should('have.length', 3);

    cy
      .get('.card-list__item')
      .first()
      .within(() => {
        cy.get('[data-testid="program-list-name"]').should('contain', 'First in List');
        cy.contains('On');
      });

    cy
      .get('.card-list__item')
      .eq(1)
      .within(() => {
        cy.get('[data-testid="program-list-name"]').should('contain', 'Second in List, Not Published');
        cy.contains('Off');
      });

    cy
      .get('.card-list__item')
      .first()
      .click()
      .wait('@routeProgram')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows');

    cy
      .location('pathname')
      .should('contain', `/program/${ firstProgram.id }`);

    cy.then(() => {
      const label = 'Programs';
      const url = '/api/programs';
      const admin = true;
      cy.routesForDefault().visit('/worklist/owned-by').wait('@routeActions');
      cy.intercept('GET', url, { statusCode: 400, body: {} }).as('failedRoute');

      if (admin) {
        cy.get('.app-nav__bottom-button').contains('Admin Tools').click();
        cy.get('.js-picklist-item').contains(label).click();
      } else {
        cy.get('.app-nav__link').contains(label).click();
      }

      cy.wait('@failedRoute');
      cy.get('.error-page').should('contain', 'Error code: 400.');
      cy.get('.error-page').contains('Back to Your Workspace').click();
      cy.location('pathname').should('include', '/worklist/owned-by');
      cy.get('.worklist-list__list').should('be.visible');
      cy.get('.error-page').should('not.exist');
    });
  });
});
