/* eslint-disable-next-line mocha/no-top-level-hooks */
beforeEach(function() {
  const appOrigin = new URL(Cypress.config('baseUrl') || window.location.href).origin
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Register first so later endpoint stubs take precedence.
  cy.intercept({
    url: new RegExp(`^${ appOrigin }/api(?:[/?]|$)`),
  }, req => {
    req.destroy();

    throw new Error(
      `Unstubbed API request: ${ req.method } ${ new URL(req.url).pathname }. `
      + 'Add a matching cy.intercept() response stub before triggering this request.',
    );
  });
});
