context('startup browser requirements', function() {
  const missingCapabilities = [
    ['URLPattern', win => {
      win.URLPattern = undefined;
    }],
    ['AbortSignal.any', win => {
      win.AbortSignal.any = undefined;
    }],
    ['Promise.withResolvers', win => {
      win.Promise.withResolvers = undefined;
    }],
    ['URL.canParse', win => {
      win.URL.canParse = undefined;
    }],
  ];

  specify('uses the History driver when Navigation API is unavailable', function() {
    cy
      .routesForDefault()
      .intercept('GET', '**/*-router-history-*.js')
      .as('historyDriver')
      .visit({
        noWait: true,
        onBeforeLoad(win) {
          Object.defineProperty(win, 'navigation', {
            value: undefined,
            configurable: true,
          });
        },
      });

    cy.wait('@historyDriver');
    cy.get('.worklist-list-page').should('be.visible');

    cy.window().then(win => win.Radio.request('router', 'navigate', 'schedule'));
    cy.get('.schedule-list-page').should('be.visible');

    cy.go('back');
    cy.get('.worklist-list-page').should('be.visible');

    cy.go('forward');
    cy.get('.schedule-list-page').should('be.visible');

    cy.visit({
      noWait: true,
      onBeforeLoad(win) {
        Object.defineProperty(win, 'navigation', {
          get() {
            throw new win.DOMException('Navigation access is blocked', 'SecurityError');
          },
          configurable: true,
        });
      },
    });
    cy.get('.worklist-list-page').should('be.visible');
    cy.wait('@historyDriver');
  });

  missingCapabilities.forEach(([name, removeCapability]) => {
    const title = `explains missing ${ name } before starting the app`;

    specify(title, function() {
      const bootstrapRequests = [];
      const unhandledRejections = [];

      cy.intercept('GET', '/api/clinicians/me', req => {
        bootstrapRequests.push(req.url);
        req.reply({
          statusCode: 503,
        });
      });

      cy.visit('/', {
        isRoot: true,
        noWait: true,
        onBeforeLoad(win) {
          removeCapability(win);
          win.addEventListener('unhandledrejection', event => unhandledRejections.push(event.reason));
        },
      });

      cy.contains('h1', 'Use a supported browser').should('be.visible');

      cy.get('#root[role="alert"][aria-busy="false"]')
        .should('be.visible')
        .and('contain', 'Use a supported browser')
        .and('contain', 'Update your browser or ask your administrator');

      // Observe a rendered frame after the entrypoint has presented the result.
      cy.window().then(win => new Cypress.Promise(resolve => win.requestAnimationFrame(resolve)).then(() => {
        // HTML modulepreload may fetch app chunks; it must not evaluate them.
        expect(win).not.to.have.property('router');
      }));

      cy.get('#root').find('button').should('not.exist');

      cy.then(() => {
        expect(bootstrapRequests, 'unsupported browser never bootstraps the application').to.deep.equal([]);
        expect(unhandledRejections, 'unsupported browser has no rejected module import').to.deep.equal([]);
      });
    });
  });
});
