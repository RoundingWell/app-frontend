import { testTs, testTsSubtract } from 'helpers/test-timestamp';

import { getProgram } from 'support/api/programs';

context('program all list', function() {
  specify('display programs list', function() {
    cy
      .routePrograms(fx => {
        fx.data = [
          getProgram({
            attributes: {
              name: 'First in List',
              published_at: testTs(),
              archived_at: null,
              updated_at: testTs(),
            },
          }),
          getProgram({
            attributes: {
              name: 'Last in List',
              published_at: testTs(),
              archived_at: null,
              updated_at: testTsSubtract(2),
            },
          }),
          getProgram({
            attributes: {
              name: 'Second in List, Not Published',
              published_at: null,
              archived_at: null,
              updated_at: testTsSubtract(1),
            },
          }),
        ];

        return fx;
      })
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.table-list__item')
      .first()
      .should('contain', 'First in List')
      .should('contain', 'On')
      .next()
      .should('contain', 'Second in List, Not Published')
      .should('contain', 'Off');
  });
});
