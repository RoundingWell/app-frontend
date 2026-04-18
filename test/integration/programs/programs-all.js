import { testTs, testTsSubtract } from 'helpers/test-timestamp';

import { getProgram } from 'support/api/programs';

context('program all list', function() {
  specify('display programs list', function() {
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
      .get('.table-list__item', { timeout: 10000 })
      .should('have.length', 3);

    cy
      .get('.table-list__item')
      .first()
      .within(() => {
        cy.get('[data-testid="program-list-name"]').should('contain', 'First in List');
        cy.contains('On');
      });

    cy
      .get('.table-list__item')
      .eq(1)
      .within(() => {
        cy.get('[data-testid="program-list-name"]').should('contain', 'Second in List, Not Published');
        cy.contains('Off');
      });

    cy
      .get('.table-list__item')
      .first()
      .click()
      .wait('@routeProgram')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows');

    cy
      .location('pathname')
      .should('contain', `/program/${ firstProgram.id }`);
  });
});
