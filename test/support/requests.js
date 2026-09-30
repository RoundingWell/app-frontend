// Observe the browser side of API requests. cy.wait(alias) only observes the proxy;
// a stale-response assertion must also wait for body parsing and its promise chain.
let pendingRequests;

Cypress.on('window:before:load', win => {
  const pending = new Set();
  pendingRequests = pending;
  const fetch = win.fetch.bind(win);

  win.fetch = (...args) => {
    const result = fetch(...args);
    const url = new URL(args[0].url || args[0], win.location.href);
    if (!url.pathname.startsWith('/api/')) return result;

    const request = { reads: 0 };
    pending.add(request);
    // Use the runner's real clock, including when the app uses cy.clock().
    // The next task runs after response-consumer promise continuations drain.
    const finished = () => setTimeout(() => {
      if (!request.reads) pending.delete(request);
    }, 0);
    const observeBody = response => {
      const clone = response.clone.bind(response);
      response.clone = () => observeBody(clone());
      ['json', 'text'].forEach(method => {
        const read = response[method].bind(response);
        response[method] = (...readArgs) => {
          pending.add(request);
          request.reads++;
          const body = read(...readArgs);
          const consumed = () => {
            request.reads--;
            finished();
          };
          body.then(consumed, consumed);
          return body;
        };
      });
      return response;
    };
    result.then(response => {
      observeBody(response);
      // Some responses are replaced (for example, an auth retry) without a read.
      finished();
    }, finished);
    return result;
  };
});

Cypress.Commands.add('waitForAppRequests', () => {
  // Let requests queued by the preceding UI action or clock tick reach fetch.
  cy.then(() => new Cypress.Promise(resolve => setTimeout(resolve, 0)));
  cy.wrap(null).should(() => {
    expect(pendingRequests.size, 'unsettled browser API requests').to.equal(0);
  });
});
