import { v7 as uuid } from 'uuid';
import { filter, findIndex, identity, sortBy } from 'underscore';

import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxMessages from 'fixtures/collections/messages.json';

const TYPE = 'messages';

export function getMessage(data = {}) {
  const resource = getResource({ ...fxMessages[0], id: uuid() }, TYPE, {
    patient: getRelationship(),
    action: getRelationship(),
    author: getRelationship(),
  });

  return mergeJsonApi(resource, data);
}

export function getMessagePage(data, query) {
  const sorted = sortBy(sortBy(data, 'id'), message => Date.parse(message.attributes.sort_at)).reverse();
  const before = query.get('page[before]');
  const limit = Number(query.get('page[limit]')) || 25;
  if (!before) return sorted.slice(0, limit);

  const index = findIndex(sorted, { id: before });
  if (index === -1) return [];

  return sorted.slice(index + 1, index + 1 + limit);
}

Cypress.Commands.add('routeActionMessages', (mutator = identity) => {
  const body = mutator({ data: [], included: [] });

  cy
    .intercept('GET', '/api/actions/*/messages*', request => {
      const actionId = new URL(request.url).pathname.split('/')[3];
      const data = filter(body.data, message => message.relationships.action.data?.id === actionId);

      request.reply({ body: { ...body, data: getMessagePage(data, new URL(request.url).searchParams) } });
    })
    .as('routeActionMessages');
});
