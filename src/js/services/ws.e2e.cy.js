import { getAction } from 'support/api/actions';

context('Websocket connection', function() {
  specify('reconnects an empty worklist subscription and keeps its heartbeat alive', function() {
    cy.routeActions(fx => ({ ...fx, data: [] }))
      .intercept('GET', '/api/websockets*', {
        body: {
          data: {
            is_enabled: true,
            endpoint: 'ws://cypress-websocket/ws',
            authentication: { token: 'test-connect-token', query_parameter: 'connect_token' },
          },
        },
      }).as('connectSocket')
      .visitOnClock('/worklist/owned-by');

    cy.get('@wsHandleMessage').should('have.been.calledOnce');
    cy.sendWs({ name: 'pong' });
    cy.sendWs({ category: 'SessionChanged' });
    cy.sendWs({ category: 'ResourceCreated', subscription_version: 'stale', resource: { type: 'patient-actions', id: 'stale-action' } });
    cy.get('.worklist-list__item').should('not.exist');

    cy.closeWs();
    // Closing is delivered by the mocked server outside the application's clock.
    cy.tick(2000);
    cy.get('@connectSocket.all').should('have.length', 2);
    cy.get('@wsHandleMessage').should('have.been.calledTwice').then(messages => {
      const initial = messages.firstCall.args[0].data;
      const reconnected = messages.secondCall.args[0].data;
      expect(reconnected.resources).to.deep.equal([]);
      expect(reconnected.filters).to.deep.equal(initial.filters);
      expect(reconnected.subscriptionVersion).not.to.equal(initial.subscriptionVersion);
    });
    cy.tick(50000);
    cy.get('@wsHandleMessage').should('have.been.calledWith', { name: 'ping' });
    cy.get('.list-page').should('be.visible');
    const pendingAction = getAction();
    let releaseAction;
    let actionRequested = false;
    const actionResponse = new Cypress.Promise(resolve => {
      releaseAction = resolve;
    });
    cy.intercept('GET', `/api/actions/${ pendingAction.id }*`, req => {
      actionRequested = true;
      return actionResponse.then(() => req.reply({ body: { data: pendingAction } }));
    });
    cy.sendWs({ category: 'ResourceCreated', resource: { type: pendingAction.type, id: pendingAction.id } });
    cy.wrap(null).should(() => expect(actionRequested).to.equal(true));
    cy.routeClinicians();
    cy.get('.app-nav').contains('Admin Tools').click();
    cy.get('.picklist').contains('Clinicians').click();
    cy.get('.card-list').should('be.visible').then(() => releaseAction());
    cy.get('@wsHandleMessage').should(messages => {
      const resources = messages.getCalls().flatMap(call => call.args[0].data?.resources || []);
      expect(resources.map(resource => resource.id)).not.to.include(pendingAction.id);
    });

    // Leaving a resource page clears its subscription before the socket closes.
    cy.routesForPatientAction().routeAction(fx => ({ ...fx, data: pendingAction }))
      .visitOnClock(`/patient/1/action/${ pendingAction.id }`);
    cy.get('.patient-action').should('be.visible');
    cy.get('@wsHandleMessage').should(messages => {
      expect(messages.lastCall.args[0].data.resources.map(resource => resource.id)).to.include(pendingAction.id);
    });
    cy.routeClinicians();
    cy.get('.app-nav').contains('Admin Tools').click();
    cy.get('.picklist').contains('Clinicians').click();
    cy.get('.card-list').should('be.visible');
    cy.tick(2000);
    cy.get('@wsHandleMessage').should(messages => {
      expect(messages.lastCall.args[0].data.resources).to.deep.equal([]);
    });
    cy.closeWs();
    cy.get('@connectSocket.all').then(requests => {
      const count = requests.length;
      cy.tick(2000);
      cy.get('@connectSocket.all').should('have.length', count);
    });

    cy.routeActions(fx => ({ ...fx, data: [] })).visit('/worklist/owned-by');
    cy.get('.list-page').should('be.visible');
    cy.get('@wsHandleMessage').should('have.been.calledWithMatch', { name: 'Subscribe' });
    cy.intercept('GET', `/api/actions/${ pendingAction.id }*`, {
      statusCode: 503, body: { errors: [] },
    });
    cy.sendWs({ category: 'ResourceCreated', resource: { type: pendingAction.type, id: pendingAction.id } });
    cy.get('.error-page').should('contain', '503');

    [
      { statusCode: 204 },
      { body: { data: { is_enabled: false } } },
    ].forEach(response => {
      cy.intercept('GET', '/api/websockets*', response).as('disabledSocket');
      cy.visit('/worklist/owned-by').wait('@disabledSocket');
      cy.get('.list-page').should('be.visible');
      cy.get('.worklist-list__item').should('not.exist');
    });
  });
});
