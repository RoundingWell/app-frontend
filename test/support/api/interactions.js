import { v7 as uuid } from 'uuid';

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
  cy.intercept('GET', '/api/patients/*/interactions*', { body }).as('routePatientInteractions');
});
