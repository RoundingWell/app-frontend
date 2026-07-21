import _ from 'underscore';
import { v4 as uuid } from 'uuid';

import { testTs } from 'helpers/test-timestamp';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getAction } from './actions.js';

const TYPE = 'files';

const fxFile = {
  path: '/dir/path/file.pdf',
  created_at: testTs(),
};

export function getFile(data) {
  const defaultRelationships = {
    'actions': getRelationship(getAction()),
  };

  const resource = getResource(fxFile, TYPE, defaultRelationships);

  resource.meta = {
    view: 'https://www.bucket_name.s3.amazonaws.com/view/file.pdf',
    download: 'https://www.bucket_name.s3.amazonaws.com/download/file.pdf',
  };

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

Cypress.Commands.add('routeActionFiles', (mutator = _.identity) => {
  cy
    .intercept('GET', '/api/actions/**/files?urls=download,view', {
      body: mutator({ data: [], included: [] }),
    })
    .as('routeActionFiles');
});
