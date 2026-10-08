/* eslint-disable-next-line mocha/no-top-level-hooks */
beforeEach(function() {
  // Register first so later endpoint stubs take precedence.
  cy.intercept({ pathname: /^\/api(?:\/|$)/ }, req => {
    req.destroy();

    throw new Error(
      `Unstubbed API request: ${ req.method } ${ new URL(req.url).pathname }. `
      + 'Add a matching cy.intercept() response stub before triggering this request.',
    );
  });
});
