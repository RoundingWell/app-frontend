// Shared suite invoked inside each runner's context, not a standalone spec.
/* eslint-disable mocha/no-exports, mocha/no-top-level-hooks */
export function apiGuardContract(prepare) {
  let expectedFailure;
  let guardFailure;
  let abortRequest;

  beforeEach(function() {
    expectedFailure = undefined;
    guardFailure = undefined;
    abortRequest = undefined;
    prepare();
  });

  afterEach(function() {
    if (expectedFailure) {
      expect(guardFailure, 'the API guard must fail before an unstubbed response completes').to.be.an.instanceOf(Error);
    }
  });

  function expectFailure(method, pathname) {
    expectedFailure = true;
    const title = Cypress.currentTest.titlePath.join(' > ');

    cy.on('fail', error => {
      if (!error.message.includes('Unstubbed API request:')) throw error;

      expect(error.message).to.contain(`Unstubbed API request: ${ method } ${ pathname }`);
      expect(error.message).to.contain(`Test: ${ title }`);
      expect(error.message).to.contain('cy.intercept() stub matching this method and API path');
      expect(error.message).to.contain('req.reply({ body: ... })');
      expect(error.message).not.to.contain('private-identifier');
      expect(error.message).not.to.contain('private-query-value');
      expect(error.message).not.to.contain('private-header-value');
      expect(error.message).not.to.contain('private-body-value');
      guardFailure = error;
      abortRequest();

      return false;
    });
  }

  function request(url, method = 'GET') {
    return cy.window().then(win => {
      const options = { method };
      const controller = new win.AbortController();
      options.signal = controller.signal;
      abortRequest = () => controller.abort();
      if (method === 'POST') {
        options.headers = { authorization: 'Bearer private-header-value' };
        options.body = 'private-body-value';
      }
      const response = win.fetch(url, options).catch(() => undefined);

      // The expected-failure listener aborts this fetch after asserting the
      // diagnostic. A real response still settles and fails the afterEach check.
      return response;
    });
  }

  specify('keeps endpoint stubs ahead of the fallback and observing middleware', function() {
    cy
      .intercept({ pathname: '/api/actions/private-identifier', middleware: true }, () => {})
      .intercept('GET', '/api/actions/private-identifier*', { body: { source: 'static' } });

    request('/api/actions/private-identifier?filter=private-query-value')
      .then(response => response.json())
      .should('deep.equal', { source: 'static' });

    cy
      .intercept('GET', '/api/actions/private-identifier*', async req => {
        await Promise.resolve();
        req.reply({ body: { source: 'handler' } });
      });

    request('/api/actions/private-identifier')
      .then(response => response.json())
      .should('deep.equal', { source: 'handler' });
  });

  specify('fails a missing endpoint stub with sanitized method, path and test title', function() {
    cy
      .intercept('GET', '/api/actions/private-identifier*', { body: 'wrong method' });

    expectFailure('POST', '/api/actions/[redacted] (query omitted)');

    request('/api/actions/private-identifier?token=private-query-value', 'POST');
  });

  specify('matches the bare API path with query parameters', function() {
    expectFailure('GET', '/api (query omitted)');

    request('/api?token=private-query-value');
  });

  specify('rejects an observer that does not provide a response', function() {
    cy
      .intercept('GET', '/api/actions/private-identifier*').as('observer');

    expectFailure('GET', '/api/actions/[redacted]');

    request('/api/actions/private-identifier');
  });

  specify('rejects explicit upstream continuation before the request can escape', function() {
    cy
      .intercept('GET', '/api/actions/private-identifier*', async req => {
        await Promise.resolve();
        req.continue(() => {});
      });

    expectFailure('GET', '/api/actions/[redacted]');

    request('/api/actions/private-identifier');
  });

  specify('rejects middleware pass-through even when a later endpoint stub exists', function() {
    cy
      .intercept({ pathname: '/api/actions/private-identifier', middleware: true }, req => req.continue())
      .intercept('GET', '/api/actions/private-identifier*', { body: 'unreachable' });

    expectFailure('GET', '/api/actions/[redacted]');

    request('/api/actions/private-identifier');
  });

  specify('rejects reply without a stub response', function() {
    cy
      .intercept('GET', '/api/actions/private-identifier*', req => req.reply());

    expectFailure('GET', '/api/actions/[redacted]');

    request('/api/actions/private-identifier');
  });

  specify('leaves non-API path boundaries outside the guard', function() {
    cy
      .intercept('GET', '/apiary*', req => {
        req.url = new URL('/', req.url).href;
        req.continue();
      }).as('outsideBoundary')
      .intercept('GET', '/nested/api*', req => {
        req.url = new URL('/', req.url).href;
        req.reply();
      }).as('nestedBoundary');

    request('/apiary?token=private-query-value')
      .then(response => {
        expect(response.status).to.be.oneOf([200, 404]);
      });

    cy
      .wait('@outsideBoundary');

    request('/nested/api')
      .then(response => {
        expect(response.status).to.be.oneOf([200, 404]);
      });

    cy
      .wait('@nestedBoundary');
  });

  specify('installs a stub scoped to one test', function() {
    cy
      .intercept('GET', '/api/actions/private-identifier*', { body: 'scoped' });

    request('/api/actions/private-identifier')
      .then(response => response.text())
      .should('equal', 'scoped');
  });

  specify('does not retain the previous test stub or failure handler', function() {
    expectFailure('GET', '/api/actions/[redacted]');

    request('/api/actions/private-identifier');
  });
}
