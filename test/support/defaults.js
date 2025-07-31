Cypress.on('window:before:load', function(win) {
  win.onerror = function() {
    cy.onUncaughtException.apply(cy, arguments);
  };

  cy.stub(win, 'open');
});

/* eslint-disable-next-line mocha/no-top-level-hooks */
beforeEach(function() {
  // https://docs.cypress.io/api/commands/intercept#cyintercept-and-request-caching
  cy.intercept(
    '/api/**/*',
    { middleware: true },
    req => {
      req.on('before:response', res => {
        // force all API responses to not be cached
        res.headers['cache-control'] = 'no-store';
      });
    },
  );

  cy
    .intercept('GET', '/appconfig.json', {
      body: {
        app: {
          env: 'develop',
          name: 'Cypress Clinic',
        },
        versions: {
          frontend: 'develop',
        },
      },
    });

  cy
    .intercept('GET', '/api/websockets', {
      body: {
        data: {
          is_enabled: true,
          endpoint: 'ws://cypress-websocket/ws',
        },
      },
    });

  cy
    .routeCurrentClinician()
    .routeRoles()
    .routeTeams()
    .routeDirectories()
    .routeSettings()
    .routeWorkspaces()
    .routeWidgets()
    .routeWorkspaceClinicians()
    .routeWorkspacePrograms()
    .routeStates()
    .routeForms();
});
