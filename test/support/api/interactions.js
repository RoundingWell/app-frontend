import { v7 as uuid } from 'uuid';
import { contains, filter } from 'underscore';

import { getRelationship } from 'helpers/json-api';

export function getInteraction({ id = uuid(), channel = 'sms', direction = 'outbound', action, flow, reference = null, metadata = {} } = {}) {
  return {
    id,
    type: 'interactions',
    attributes: {
      channel,
      direction,
      reference,
      metadata,
      occurred_at: '2026-09-24T10:00:00+00:00',
      expected_at: null,
      created_at: '2026-09-24T10:00:00+00:00',
    },
    relationships: {
      action: getRelationship(action),
      flow: getRelationship(flow),
    },
  };
}

Cypress.Commands.add('routePatientInteractions', (body = { data: [], included: [] }) => {
  cy.intercept('GET', '/api/patients/*/interactions*', request => {
    const query = new URL(request.url).searchParams;
    const channels = query.get('filter[channel]')?.split(',');
    let data = body.data;
    if (channels) data = filter(data, interaction => contains(channels, interaction.attributes.channel));
    request.reply({ body: { ...body, data } });
  }).as('routePatientInteractions');
});
