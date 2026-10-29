import { testTs } from 'helpers/test-timestamp';

import { getProgram } from 'support/api/programs';

context('program reports list', function() {
  specify('lists published, non-archived programs and opens their documentation', function() {
    const program = getProgram({
      attributes: { name: 'Care transitions', details: 'Support patients after discharge.', published_at: testTs(), archived_at: null },
    });
    const unpublished = getProgram({ attributes: { name: 'Unpublished program', published_at: null, archived_at: null } });
    const archived = getProgram({ attributes: { name: 'Archived program', published_at: testTs(), archived_at: testTs() } });

    cy
      .routePrograms(fx => {
        fx.data = [archived, program, unpublished];
        return fx;
      })
      .routeProgram(fx => {
        fx.data = program;
        return fx;
      })
      .routeProgramFlows(fx => {
        fx.data = [];
        return fx;
      })
      .routeProgramActions(fx => {
        fx.data = [];
        return fx;
      })
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.programs-list .card-list__item')
      .should('have.length', 1)
      .should('contain', 'Support patients after discharge.')
      .should('contain', 'Published')
      .find('a')
      .should('have.attr', 'href', `/one/program/${ program.id }`)
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/program/${ program.id }`);

    cy
      .get('.program-report')
      .should('contain', 'Care transitions')
      .should('contain', 'This program has no flows.')
      .should('contain', 'No actions are configured here.');
  });

  specify('shows an empty list and an error when programs cannot load', function() {
    cy
      .routePrograms(fx => {
        fx.data = [];
        return fx;
      })
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.programs-list')
      .should('contain', 'No published programs');

    cy
      .intercept('GET', '/api/programs', { statusCode: 400, body: { errors: [] } })
      .as('routeProgramsError')
      .visit('/programs')
      .wait('@routeProgramsError');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 400.');
  });
});
