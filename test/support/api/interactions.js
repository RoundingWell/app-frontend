import { v7 as uuid } from 'uuid';
import { contains, filter, find, findIndex, identity, sortBy } from 'underscore';

import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxInteractions from 'fixtures/collections/interactions.json';

export function getInteraction(data = {}) {
  const resource = getResource({ ...fxInteractions[0], id: uuid() }, 'interactions', {
    action: getRelationship(),
    flow: getRelationship(),
  });

  return mergeJsonApi(resource, data);
}

function getPage(data, query) {
  data = sortBy(sortBy(data, 'id'), interaction => Date.parse(interaction.attributes.occurred_at || interaction.attributes.expected_at));
  const before = query.get('page[before]');
  const after = query.get('page[after]');
  const at = query.get('page[at]');
  const limit = Number(query.get('page[limit]')) || 25;
  const cursor = find([before, after, at], Boolean);
  const index = findIndex(data, { id: cursor });
  if (cursor && index < 0) return [];
  if (at) {
    const leading = Math.floor(limit / 2);
    return data.slice(Math.max(0, index - leading), index).concat(data.slice(index, index + limit - leading));
  }
  if (before) return data.slice(0, index).reverse().slice(0, limit);
  if (after) return data.slice(index + 1, index + limit + 1);
  return data.reverse().slice(0, limit);
}

Cypress.Commands.add('routePatientInteractions', (mutator = identity) => {
  const body = mutator({ data: [], included: [] });
  cy
    .intercept('GET', '/api/patients/*/interactions*', request => {
      const query = new URL(request.url).searchParams;
      const channels = query.get('filter[channel]')?.split(',');
      const actionId = query.get('filter[action]');
      const flowId = query.get('filter[flow]');
      const data = filter(body.data, interaction => {
        return (!channels || contains(channels, interaction.attributes.channel))
          && (!actionId || interaction.relationships.action.data?.id === actionId)
          && (!flowId || interaction.relationships.flow.data?.id === flowId);
      });
      request.reply({ body: { ...body, data: getPage(data, query) } });
    })
    .as('routePatientInteractions');
});
