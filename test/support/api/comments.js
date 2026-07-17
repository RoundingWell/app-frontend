import _ from 'underscore';
import { v7 as uuid } from 'uuid';
import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getClinician } from './clinicians';

import fxComments from 'fixtures/collections/comments';

const TYPE = 'comments';

export function getComment(data) {
  const defaultRelationships = {
    'clinician': getRelationship(getClinician()),
  };

  const resource = getResource(_.sample(fxComments), TYPE, defaultRelationships);

  data = _.extend({ id: uuid() }, data);

  return mergeJsonApi(resource, data, { VALID: { relationships: _.keys(defaultRelationships) } });
}

export function getComments({ attributes, relationships, meta } = {}, { sample = 3 } = {}) {
  return _.times(sample, () => getComment({ attributes, relationships, meta }));
}

Cypress.Commands.add('routeActionComments', (mutator = _.identity) => {
  const data = getComments();

  cy
    .intercept('GET', '/api/actions/**/comments', {
      body: mutator({ data, included: [] }),
    })
    .as('routeActionComments');
});
