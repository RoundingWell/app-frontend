import _ from 'underscore';
import { getResource } from 'helpers/json-api';

import fxTestSidebars from 'fixtures/test/sidebars';

const TYPE = 'sidebars';

Cypress.Commands.add('routeSidebars', (mutator = _.identity) => {
  const data = getResource(fxTestSidebars, TYPE);

  cy
    .intercept('GET', '/api/sidebars*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeSidebars');
});

export {
  fxTestSidebars,
};
