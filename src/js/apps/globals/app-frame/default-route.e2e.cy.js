import { NIL as NIL_UUID } from 'uuid';

import { getErrors, getRelationship } from 'helpers/json-api';

import { getCurrentClinician } from 'support/api/clinicians';

context('default routes', function() {
  let releaseBootstrap;
  let releaseAppFrame;
  let startupObserver;

  afterEach(function() {
    startupObserver?.disconnect();
    startupObserver = null;

    if (releaseBootstrap) {
      releaseBootstrap();
      cy.wait('@heldBootstrap');
      releaseBootstrap = null;
    }

    if (releaseAppFrame) {
      releaseAppFrame();
      cy.wait('@failedAppFrame');
      releaseAppFrame = null;
    }
  });

  specify('default route', function() {
    cy
      .routesForDefault()
      .routesForPatientWorkflow()
      .visit();

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.js-patient')
      .first()
      .click()
      .wait('@routePatient');

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.patient-sidebar__name')
      .click()
      .wait('@routePatient');

    cy
      .get('.patient__context-trail')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');
  });

  specify('closes the patient sidebar before routing to another list', function() {
    cy
      .routesForDefault()
      .routesForPatientWorkflow()
      .visit();

    cy
      .get('.js-patient')
      .first()
      .click();

    cy
      .get('.patient-sidebar')
      .should('be.visible');

    cy
      .get('[data-worklists-region]')
      .find('.app-nav__link[aria-label="Shared By"]')
      .click();

    cy
      .url()
      .should('contain', 'one/worklist/shared-by');

    cy
      .get('.patient-sidebar')
      .should('not.exist');
  });

  specify('current clinician has no workspaces', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            workspaces: getRelationship([]),
          },
        });

        return fx;
      })
      .visit({ noWait: true });

    cy
      .get('.account-setup')
      .contains('Hold up, Your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });

  specify('current clinician has no team', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            team: getRelationship({ id: NIL_UUID }, 'teams'),
          },
        });

        return fx;
      })
      .visit({ noWait: true });

    cy
      .get('.account-setup')
      .contains('Hold up, Your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });

  // Server should return 403, but for good measure
  specify('current clinician is not enabled', function() {
    cy
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          attributes: {
            enabled: false,
          },
        });

        return fx;
      })
      .visit({ noWait: true });

    cy
      .get('.account-setup')
      .contains('Hold up, Your account is not set up yet. Please notify your manager or administrator to correct this issue.');

    cy
      .get('.account-setup')
      .click('right');

    cy
      .get('.account-setup');
  });

  specify('current clinician has been disabled', function() {
    cy
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 403,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Unauthorized',
            detail: 'Access token is valid, but user is disabled',
          }),
        },
      })
      .as('routeClinicianDisabled')
      .visit({ noWait: true })
      .wait('@routeClinicianDisabled');

    cy
      .get('.account-setup')
      .contains('Hold up, Your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });

  specify('keeps loading until bootstrap finishes', function() {
    let markBootstrapStarted;
    const bootstrapStarted = new Cypress.Promise(resolve => {
      markBootstrapStarted = resolve;
    });
    let releaseBootstrapResponse;
    const bootstrapResponse = new Cypress.Promise(resolve => {
      releaseBootstrapResponse = resolve;
    });

    cy
      .routesForDefault()
      .intercept('GET', '/appconfig.json*', {
        body: {
          app: { stage: 'dev', name: 'Cypress Clinic', version: 'dev' },
        },
      })
      .intercept('GET', '/api/clinicians/me', req => {
        releaseBootstrap = releaseBootstrapResponse;
        markBootstrapStarted();
        return bootstrapResponse.then(() => req.reply({ body: { data: getCurrentClinician(), included: [] } }));
      })
      .as('heldBootstrap')
      .visit({ noWait: true });

    cy.then(() => bootstrapStarted);

    cy.get('.startup')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true')
      .find('.startup__status-text')
      .should('have.text', 'Loading RoundingWell');

    cy.get('.app-nav').should('not.exist');

    cy.then(() => releaseBootstrap());

    cy.wait('@heldBootstrap').then(() => {
      releaseBootstrap = null;
    });

    cy.get('.app-nav').should('be.visible');

    cy.get('.startup').should('not.exist');
  });

  specify('dismisses startup without an exit animation when matchMedia reports reduced motion', function() {
    let didAnimateExit = false;

    cy
      .routesForDefault()
      .intercept('GET', '/api/clinicians/me', req => {
        return new Cypress.Promise(resolve => {
          releaseBootstrap = resolve;
        }).then(() => req.reply({ body: { data: getCurrentClinician(), included: [] } }));
      })
      .as('heldBootstrap')
      .visit('/worklist/owned-by', {
        noWait: true,
      });

    cy.wrap(null).should(() => {
      expect(releaseBootstrap, 'bootstrap request started').to.be.a('function');
    });

    cy
      .get('.startup')
      .should('have.attr', 'aria-busy', 'true')
      .then($startup => {
        const win = $startup[0].ownerDocument.defaultView;
        const matchMedia = win.matchMedia.bind(win);

        cy.stub(win, 'matchMedia').callsFake(query => {
          if (query === '(prefers-reduced-motion: reduce)') return { matches: true };
          return matchMedia(query);
        });

        startupObserver = new win.MutationObserver(records => {
          didAnimateExit ||= records.some(record => record.target.classList.contains('is-exiting'));
        });
        startupObserver.observe($startup[0], { attributes: true, attributeFilter: ['class'] });
        releaseBootstrap();
      });

    cy.wait('@heldBootstrap').then(() => {
      releaseBootstrap = null;
    });

    cy
      .get('.app-nav')
      .should('be.visible');

    cy
      .get('.startup')
      .should('not.exist')
      .then(() => {
        expect(didAnimateExit, 'reduced-motion startup exits without animating').to.equal(false);
      });
  });

  specify('retains recovery when the app frame fails after bootstrap has finished', function() {
    cy.intercept('GET', '**/*app-frame_app-*.js', req => {
      return new Cypress.Promise(resolve => {
        releaseAppFrame = () => {
          req.reply({ statusCode: 503 });
          resolve();
        };
      });
    }).as('failedAppFrame');

    cy.routesForDefault().visit({ noWait: true });

    cy.getRadio(Radio => {
      cy.wrap(null).should(() => {
        expect(Radio.request('bootstrap', 'currentUser'), 'bootstrap has published its clinician').to.exist;
      });
    });

    cy.then(() => releaseAppFrame());

    cy.wait('@failedAppFrame').then(() => {
      releaseAppFrame = null;
    });

    cy.get('.startup__error')
      .should('be.visible')
      .and('contain', 'We couldn\'t load your workspace');

    cy.get('.startup__retry').should('be.enabled');
  });

  specify('offers recovery when configuration fails before the app can mount', function() {
    cy.intercept('GET', '/appconfig.json*', { statusCode: 503 }).as('failedConfig');

    cy.visit({ noWait: true }).wait('@failedConfig');

    cy.get('#root')
      .should('have.attr', 'role', 'alert')
      .and('contain', 'We couldn\'t load your workspace')
      .and('have.attr', 'aria-busy', 'false')
      .should($root => {
        const bounds = $root[0].getBoundingClientRect();
        expect(bounds.top).to.equal(0);
        expect(bounds.left).to.equal(0);
        expect(bounds.height).to.equal(768);
        expect(bounds.width).to.equal(1280);
      });

    cy.get('.startup__retry').should('be.visible').and('be.enabled');

    cy.intercept('GET', '/appconfig.json*', {
      app: { stage: 'dev', name: 'Cypress Clinic', version: 'dev' },
    });

    cy.routesForDefault();

    cy.get('.startup__retry').click();

    cy.get('.app-nav').should('be.visible');
  });

  specify('bootstrap failure retains recovery after late errors and retries on reload', function() {
    let lateError;
    let retryWasDisabled;
    let retryWasPending;
    let outgoingCoverage;

    cy
      .routesForDefault()
      .intercept('GET', '/api/teams', req => {
        return new Cypress.Promise(resolve => {
          releaseBootstrap = resolve;
        }).then(() => req.reply({ statusCode: 502, body: { errors: getErrors({ status: '502' }) } }));
      })
      .as('heldBootstrap')
      .intercept('GET', '/api/clinicians/me', {
        statusCode: 500,
        body: {
          errors: getErrors({
            status: '500',
            title: 'Internal Server Error',
            detail: 'Unable to load the current clinician',
          }),
        },
      })
      .as('routeClinicianFailure')
      .visit({ noWait: true })
      .wait('@routeClinicianFailure');

    cy.getRadio(Radio => {
      lateError = new Cypress.Promise(resolve => {
        Radio.channel('event-router').once('unknownError', resolve);
      });
    });

    cy
      .get('.startup__error')
      .should('be.visible')
      .and('contain', 'We couldn\'t load your workspace')
      .then(() => releaseBootstrap());

    cy.wait('@heldBootstrap').then(() => {
      releaseBootstrap = null;
      return lateError;
    });

    cy
      .get('.startup__error')
      .should('be.visible');

    cy
      .get('.error-page')
      .should('not.exist');

    cy
      .routeCurrentClinician()
      .routeTeams();

    cy.window().then(win => {
      const retry = win.document.querySelector('.startup__error .js-retry');
      const startup = retry.closest('.startup');

      outgoingCoverage = win.__coverage__;
      win.addEventListener('beforeunload', () => {
        retryWasDisabled = retry.disabled;
        retryWasPending = startup.classList.contains('is-retrying');
      }, { once: true });
    });

    cy
      .get('.startup__error')
      .find('.js-retry')
      .click()
      .wait('@routeCurrentClinician')
      .wait('@routeTeams');

    cy
      .url()
      .should('contain', 'one/worklist/owned-by');

    cy
      .get('.app-nav')
      .should('be.visible');

    cy
      .get('.startup')
      .should('not.exist')
      .then(() => {
        expect(retryWasDisabled, 'retry is disabled before navigation').to.equal(true);
        expect(retryWasPending, 'retry communicates the pending reload').to.equal(true);

        // Retain the departing document's real coverage across the retry navigation.
        return cy.task('combineCoverage', JSON.stringify(outgoingCoverage), { log: false });
      });
  });

  function getAuthResponse() {
    const now = Date.now() / 1000;
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sid: 'startup-session', iat: now, exp: now + 3600 }));

    return {
      statusCode: 200,
      body: {
        user: {
          object: 'user',
          id: 'startup-user',
          email: 'startup@example.test',
          email_verified: true,
          first_name: 'Startup',
          last_name: 'Test',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        access_token: `${ header }.${ payload }.signature`,
        refresh_token: 'startup-refresh-token',
        authentication_method: 'password',
      },
    };
  }

  context('startup authentication readiness', function() {
    let authResponse;
    let appConfig;
    let releaseAuth;
    let authStartupObserver;
    let recoveryFrames;
    let unhandledRejections;

    function finishAuth() {
      cy.then(() => releaseAuth());

      cy.wait('@startupAuth').then(() => {
        releaseAuth = null;
      });
    }

    beforeEach(function() {
      authResponse = getAuthResponse();
      releaseAuth = null;
      recoveryFrames = 0;
      unhandledRejections = [];
      const origin = new URL(Cypress.config('baseUrl'));
      appConfig = {
        app: { stage: 'dev', name: 'Cypress Clinic', version: 'dev' },
        auth: {
          provider: 'workos',
          disableLoginPrompt: false,
          config: {
            clientId: 'startup-client',
            createClientOptions: {
              apiHostname: origin.hostname,
              port: Number(origin.port),
              https: false,
              devMode: true,
            },
          },
        },
      };

      cy.intercept('GET', '/appconfig.json*', req => req.reply(appConfig));

      cy.intercept('POST', '/user_management/authenticate', req => {
        return new Cypress.Promise(resolve => {
          releaseAuth = () => {
            req.reply(authResponse);
            resolve();
          };
        });
      }).as('startupAuth');

      cy.intercept('GET', '/user_management/authorize*', {
        headers: { 'content-type': 'text/html' },
        body: '<!DOCTYPE html><html><body><h1>Mock WorkOS sign-in</h1></body></html>',
      }).as('startupLogin');
    });

    function visitStartup() {
      let failedImportFrame;

      cy.readFile('dist/.vite/manifest.json').then(manifest => {
        cy.intercept('GET', `/${ manifest['src/js/app.js'].file }`, { statusCode: 503 }).as('failedStartupApp');
      });

      cy.visit('/', {
        isRoot: true,
        noWait: true,
        onBeforeLoad(win) {
          win.localStorage.setItem('workos:refresh-token:startup-client', 'startup-refresh-token');
          win.addEventListener('unhandledrejection', event => unhandledRejections.push(event.reason));
          failedImportFrame = new Cypress.Promise(resolve => {
            win.addEventListener('vite:preloadError', () => {
              win.requestAnimationFrame(resolve);
            }, { once: true });
          });
          authStartupObserver = new win.MutationObserver(() => {
            if (win.document.querySelector('.startup.is-error')) recoveryFrames += 1;
          });
          authStartupObserver.observe(win.document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        },
      });

      cy.wrap(null).should(() => {
        expect(releaseAuth, 'auth request is pending').to.be.a('function');
      });

      cy.wait('@failedStartupApp');

      // The failed import and a rendered frame precede either auth outcome.
      cy.then(() => failedImportFrame);
    }

    afterEach(function() {
      authStartupObserver?.disconnect();
      if (!releaseAuth) return;

      finishAuth();
    });

    specify('does not show recovery before a logged-out redirect', function() {
      authResponse = {
        statusCode: 400,
        body: { error: 'invalid_grant', error_description: 'Session has already ended.' },
      };

      visitStartup();

      cy.get('#root')
        .then($root => {
          const $status = $root.find('[role="status"]');
          expect($status).to.have.length(1);
          expect($status).to.be.visible.and.have.attr('aria-busy', 'true');
        });

      finishAuth();

      cy.contains('h1', 'Sign in to your organization').should('be.visible');
      cy.contains('button', 'Continue to sign in').click();
      cy.wait('@startupLogin');

      cy.contains('h1', 'Mock WorkOS sign-in')
        .should('be.visible')
        .then(() => {
          expect(recoveryFrames, 'no recovery before login navigation').to.equal(0);
          expect(unhandledRejections, 'speculative rejection is handled').to.deep.equal([]);
        });
    });

    specify('shows recovery for a failed import after authentication succeeds', function() {
      visitStartup();
      finishAuth();

      cy.get('.startup__error')
        .should('be.visible')
        .and('contain', 'We couldn\'t load your workspace');

      cy.get('.startup__retry')
        .should('be.enabled')
        .then(() => {
          expect(unhandledRejections, 'authenticated failure reaches recovery').to.deep.equal([]);
        });
    });

    specify('shows recovery when the authentication provider rejects', function() {
      appConfig.auth.config.clientId = '';

      cy.visit('/', {
        isRoot: true,
        noWait: true,
        onBeforeLoad(win) {
          win.addEventListener('unhandledrejection', event => unhandledRejections.push(event.reason));
        },
      });

      cy.get('.startup__error')
        .should('be.visible')
        .and('contain', 'We couldn\'t load your workspace');

      cy.get('.startup__retry')
        .should('be.enabled')
        .then(() => {
          expect(unhandledRejections, 'provider rejection reaches recovery').to.deep.equal([]);
        });
    });
  });
});
