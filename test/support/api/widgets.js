import _ from 'underscore';
import { getResource, mergeJsonApi } from 'helpers/json-api';

import fxTestWidgets from 'fixtures/test/widgets';

const TYPE = 'widgets';

export function getWidget(data) {
  const resource = getResource(_.sample(fxTestWidgets), TYPE);

  return mergeJsonApi(resource, data);
}

Cypress.Commands.add('routeWidgets', (mutator = _.identity) => {
  const data = getResource(fxTestWidgets, TYPE);

  cy
    .intercept('GET', '/api/widgets*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeWidgets');
});

Cypress.Commands.add('routeWidgetValues', (mutator = _.identity) => {
  cy
    .intercept('GET', '/api/widgets/*/values*', {
      body: mutator({ values: {} }),
    })
    .as('routeWidgetValues');
});

export {
  fxTestWidgets,
};
