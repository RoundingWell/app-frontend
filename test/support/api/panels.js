import _ from 'underscore';
import { getResource } from 'helpers/json-api';

import fxTestPanels from 'fixtures/test/panels';

const TYPE = 'panels';

Cypress.Commands.add('routePanels', (mutator = _.identity) => {
  const data = getResource(fxTestPanels, TYPE);

  cy
    .intercept('GET', '/api/panels*', {
      body: mutator({ data, included: [] }),
    })
    .as('routePanels');
});

export {
  fxTestPanels,
};
