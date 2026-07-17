import _ from 'underscore';
import { v7 as uuid } from 'uuid';

import { getResource, mergeJsonApi } from 'helpers/json-api';

import fxTestDashboards from 'fixtures/collections/dashboards';

const TYPE = 'dashboards';

export function getDashboard(data) {
  const resource = getResource(_.sample(fxTestDashboards), TYPE);

  data = _.extend({ id: uuid() }, data);

  const embed_url = `https://us-west-2.quicksight.aws.amazon.com/embed/embed_id/dashboards/${ data.id }?identityprovider=quicksight`;
  data.attributes = _.extend({ embed_url }, data.attributes);

  return mergeJsonApi(resource, data);
}

export function getDashboards({ attributes } = {}, { sample = 3 } = {}) {
  return _.times(sample, () => getDashboard({ attributes }));
}

Cypress.Commands.add('routeDashboards', (mutator = _.identity) => {
  const data = getDashboards();

  cy
    .intercept('GET', '/api/dashboards', {
      body: mutator({ data, included: [] }),
    })
    .as('routeDashboards');
});

Cypress.Commands.add('routeDashboard', (mutator = _.identity) => {
  const data = getDashboard();

  cy
    .intercept('GET', '/api/dashboards/*', {
      body: mutator({ data, included: [] }),
    })
    .as('routeDashboard');
});
