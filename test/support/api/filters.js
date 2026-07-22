import _ from 'underscore';
import { v7 as uuid } from 'uuid';
import { getResource, mergeJsonApi } from 'helpers/json-api';

import fxFilters from 'fixtures/collections/filters';

const TYPE = 'filters';

export function getFilter(data) {
  const resource = getResource(_.sample(fxFilters), TYPE);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data);
}

Cypress.Commands.add('routeFilter', (mutator = _.identity, slug) => {
  const data = getFilter();
  const alias = slug ? `routeFilter${ slug }` : 'routeFilter';

  cy
    .intercept('GET', `/api/filters/${ slug || '**' }/**`, {
      body: mutator({ data, included: [] }),
    })
    .as(alias);
});
