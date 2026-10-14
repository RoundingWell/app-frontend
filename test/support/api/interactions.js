import { v7 as uuid } from 'uuid';
import { contains, filter, find, identity, sortBy } from 'underscore';

import { getResource, getRelationship, mergeJsonApi } from 'helpers/json-api';

import fxInteractions from 'fixtures/collections/interactions.json';

export function getInteraction(data = {}) {
  const resource = getResource({ ...fxInteractions[0], id: uuid() }, 'interactions', {
    action: getRelationship(),
    flow: getRelationship(),
  });

  return mergeJsonApi(resource, data);
}

function getTimestamp(interaction) {
  return interaction?.attributes.occurred_at || interaction?.attributes.expected_at;
}

function comparePosition(left, right) {
  return Date.parse(getTimestamp(left)) - Date.parse(getTimestamp(right)) || left.id.localeCompare(right.id);
}

export function getPage(data, query, allData) {
  data = sortBy(sortBy(data, 'id'), interaction => Date.parse(getTimestamp(interaction)));
  const before = query.get('page[before]');
  const after = query.get('page[after]');
  const at = query.get('page[at]');
  const limit = Number(query.get('page[limit]')) || 25;
  const cursor = find([before, after, at], Boolean);
  if (!cursor) return data.reverse().slice(0, limit);
  const pivot = find(allData, { id: cursor });
  if (!getTimestamp(pivot)) return [];
  // Match backend cursor SQL: null effective timestamps fail tuple comparisons.
  data = filter(data, getTimestamp);
  const leading = filter(data, item => comparePosition(item, pivot) < 0);
  const trailing = filter(data, item => comparePosition(item, pivot) >= 0);
  if (at) {
    const count = Math.floor(limit / 2);
    return leading.slice(Math.max(0, leading.length - count)).concat(trailing.slice(0, limit - count));
  }
  if (before) return leading.reverse().slice(0, limit);
  return filter(trailing, item => comparePosition(item, pivot) > 0).slice(0, limit);
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
      request.reply({ body: { ...body, data: getPage(data, query, body.data) } });
    })
    .as('routePatientInteractions');
});
