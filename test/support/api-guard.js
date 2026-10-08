import _ from 'underscore';

const apiPath = /^\/api(?:\/|$)/;
const publicSegments = new Set([
  'api', 'actions', 'activity', 'clinicians', 'comments', 'dashboards', 'definition',
  'events', 'fields', 'files', 'filters', 'flows', 'form', 'form-responses', 'forms',
  'guest-token', 'history', 'latest', 'me', 'panels', 'patients', 'program',
  'program-actions', 'program-flows', 'programs', 'roles', 'settings', 'states',
  'submitted', 'tags', 'teams', 'values', 'websockets', 'widgets',
  'workspace-patients', 'workspaces',
]);

function failRequest(req, title) {
  const url = new URL(req.url);
  const pathname = _.map(url.pathname.split('/'), segment => {
    return !segment || publicSegments.has(segment) ? segment : '[redacted]';
  }).join('/');
  const query = url.search ? ' (query omitted)' : '';

  // Terminate the intercepted request as well as failing the test. Throwing
  // alone leaves the browser fetch pending and can leak retries into teardown.
  req.destroy();

  throw new Error([
    `Unstubbed API request: ${ req.method } ${ pathname }${ query }`,
    `Test: ${ title }`,
    'Add or correct a cy.intercept() stub matching this method and API path before triggering the request.',
    'Provide a static response or call req.reply({ body: ... }). API req.continue() and req.reply() without a response are not stubs.',
  ].join('\n'));
}

// Each intercept gets its own request object, so wrap handlers at registration.
// A middleware-only wrapper would not see a later handler's explicit pass-through.
Cypress.Commands.overwrite('intercept', (originalFn, ...args) => {
  const handler = args[args.length - 1];
  if (!_.isFunction(handler)) return originalFn(...args);

  const title = Cypress.currentTest.titlePath.join(' > ');
  args[args.length - 1] = req => {
    if (apiPath.test(new URL(req.url).pathname)) {
      const reply = req.reply.bind(req);
      req.continue = () => failRequest(req, title);
      req.reply = (response, ...replyArgs) => {
        if (response === undefined || _.isFunction(response)) failRequest(req, title);

        return reply(response, ...replyArgs);
      };
    }

    return handler(req);
  };

  return originalFn(...args);
});

/* eslint-disable-next-line mocha/no-top-level-hooks */
beforeEach(function() {
  const title = Cypress.currentTest.titlePath.join(' > ');

  // Non-middleware routes run newest first: register before endpoint stubs.
  // pathname ignores queries and matches /api itself without matching /apiary.
  cy.intercept({ pathname: apiPath }, req => failRequest(req, title));
});
