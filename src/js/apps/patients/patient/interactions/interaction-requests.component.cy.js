import { createResponseGate, trackInteractionRequests, drainInteractionRequests } from 'helpers/interaction-requests';

context('Interaction request completion', function() {
  specify('drains a response aborted after headers without reading its body', function() {
    const completions = [];
    const restores = [];

    cy
      .intercept('GET', '/api/probe/interactions', { body: { data: [] } });

    cy
      .window()
      .then(async win => {
        trackInteractionRequests(win, completions, restores);
        const controller = new win.AbortController();
        const response = await win.fetch('/api/probe/interactions', { signal: controller.signal });
        controller.abort();
        expect(response.status, 'headers arrived').to.equal(200);
        return Promise.race([
          drainInteractionRequests(completions).then(() => 'drained'),
          new Promise(resolve => setTimeout(() => resolve('pending'), 100)),
        ]).finally(() => {
          for (const restore of restores) restore();
        });
      })
      .should('equal', 'drained');
  });

  specify('keeps response gates drainable after a waiter is cancelled', function() {
    const gate = createResponseGate([]);
    const reply = cy.stub();
    gate.reply({ reply }, { data: [] });
    const waiter = Cypress.Promise.all([gate.drain]);
    waiter.cancel();

    cy
      .then(() => {
        gate.release();
        return Promise.race([
          Promise.resolve(gate.drain).then(() => 'drained', () => 'cancelled'),
          new Promise(resolve => setTimeout(() => resolve('pending'), 100)),
        ]);
      })
      .should('equal', 'drained')
      .then(() => {
        expect(reply).to.have.been.calledOnce;
      });
  });
});
