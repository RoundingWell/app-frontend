import { getErrors, getRelationship } from 'helpers/json-api';

import { getCurrentClinician } from 'support/api/clinicians';
import { roleEmployee } from 'support/api/roles';
import { getPatient } from 'support/api/patients';
import { getProgram } from 'support/api/programs';
import { workspaceTwo } from 'support/api/workspaces';

context('named application routing', function() {
  let releaseResponse;
  let navigationReady;

  afterEach(function() {
    releaseResponse?.();
    releaseResponse = null;
    const pending = navigationReady;
    navigationReady = null;
    if (pending) cy.then(() => pending);
  });

  specify('clears a non-patient area after a handled legacy failure without selecting patients', function() {
    const program = getProgram();
    const reports = [];
    cy.on('uncaught:exception', error => {
      if (error.message.includes('Error Status: 422')) {
        reports.push(error);
        return false;
      }
    });
    cy.routeProgram(fx => {
      fx.data = program;
      return fx;
    }).routeProgramFlows().routeProgramActions().visit(`/program/${ program.id }`);
    cy.get('.program-page__context-trail').should('be.visible');
    cy.intercept('GET', '/api/flows/legacy-unavailable*', {
      statusCode: 422,
      body: {
        errors: getErrors({
          status: '422',
          title: 'Unavailable',
        }),
      },
    }).as('unavailableLegacyFlow');
    cy.window().then(win => win.router.navigate('legacy:patient:flow', {
      flowId: 'legacy-unavailable',
    }).finished);
    cy.wait('@unavailableLegacyFlow');
    cy.get('.program-page__context-trail').should('not.exist');
    cy.get('.sidebar').should('not.exist');
    cy.get('[data-worklists-region] .app-nav__link.is-selected').should('not.exist');
    cy.contains('button', 'Admin Tools').click();
    cy.get('.picklist .is-selected').should('contain', 'Programs');
    cy.then(() => expect(reports).to.have.length(1));
  });

  specify('clears the selected area for Radio and native root error navigation', function() {
    const patient = getPatient();
    cy.routesForDefault().routesForPatientWorkflow().routePatient(fx => {
      fx.data = patient;
      return fx;
    }).visit(`/patient/${ patient.id }/workflow`);

    cy.get('.patient__context-trail').should('be.visible');
    cy.window().then(win => win.Radio.trigger('event-router', 'notFound'));
    cy.location('pathname').should('equal', '/404');
    cy.get('.error-page').should('be.visible');
    cy.get('.patient__context-trail').should('not.exist');
    cy.get('.sidebar').should('not.exist');

    cy.window().then(win => win.Radio.request('router', 'navigate', 'patient:workflow', {
      patientId: patient.id,
    }));
    cy.get('.patient__context-trail').should('be.visible');
    cy.window().then(win => win.navigation.navigate('/unknown-error').finished);
    cy.location('pathname').should('equal', '/unknown-error');
    cy.get('.error-page').should('be.visible');
    cy.get('.patient__context-trail').should('not.exist');

    cy.get('.error-page').contains('Back to Your Workspace').click();
    cy.get('.worklist-list-page').should('be.visible');
  });

  specify('clears the outgoing patient page after a handled legacy lookup failure', function() {
    const patient = getPatient();
    let completion;
    const reportedErrors = [];
    const patientChanges = [];
    cy.on('uncaught:exception', error => {
      if (error.message.includes('Error Status: 422') && error.message.includes('Unavailable')) {
        reportedErrors.push(error);
        return false;
      }
    });

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy.get('.patient__context-trail').should('be.visible');
    cy.window().then(win => {
      win.Radio.channel('dialer').on('change:currentPatientId', id => patientChanges.push(id));
    });

    cy.intercept('GET', '/api/flows/missing*', {
      statusCode: 422,
      body: {
        errors: getErrors({
          status: '422',
          title: 'Unavailable',
        }),
      },
    }).as('failedLegacyFlow');

    cy.getRadio(Radio => {
      completion = Radio.request('router', 'navigate', 'legacy:patient:flow', {
        flowId: 'missing',
      });
    });

    cy.wait('@failedLegacyFlow');
    cy.then(() => completion);

    cy.location('pathname').should('equal', '/one/flow/missing');
    cy.get('.patient__context-trail').should('not.exist');
    cy.get('.sidebar').should('not.exist');
    cy.then(() => expect(reportedErrors, 'legacy errors keep their existing reporting policy').to.have.length(1));
    cy.then(() => expect(patientChanges, 'the patients area stops and releases dialer context').to.deep.equal([null]));
  });

  specify('navigation readiness waits for the selected patient page', function() {
    const patient = getPatient();
    let readyState;

    cy
      .routesForPatientWorkflow()
      .routePatient(fx => {
        fx.data = patient;
        return fx;
      })
      .visit(`/patient/${ patient.id }/workflow`);

    cy
      .get('.workflow-page__loader')
      .should('not.exist');

    cy.window().then(win => {
      navigationReady = new Cypress.Promise(resolve => {
        win.navigation.addEventListener('navigatesuccess', () => {
          readyState = {
            loading: !!win.document.querySelector('.workflow-page__loader'),
            selected: win.document.querySelector('.workflow-page__tab.is-selected')?.textContent.trim(),
          };
          resolve();
        }, {
          once: true,
        });
      });
    });

    cy
      .intercept('GET', '/api/patients/**/actions*', req => {
        return new Cypress.Promise(resolve => {
          releaseResponse = () => {
            req.reply({
              body: {
                data: [],
                included: [],
              },
            });
            resolve();
          };
        });
      })
      .as('heldClosedActions');

    cy
      .get('.js-workflow-closed')
      .click();

    cy
      .get('.workflow-page__loader')
      .should('be.visible');

    cy.wrap(null).should(() => {
      expect(releaseResponse, 'closed-page response is held').to.be.a('function');
    });

    cy.then(() => releaseResponse());

    cy.wait('@heldClosedActions').then(() => {
      releaseResponse = null;
      return navigationReady;
    });

    cy.then(() => {
      expect(readyState, 'page state when the browser completes navigation').to.deep.equal({
        loading: false,
        selected: 'Closed',
      });
    });

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Closed');

    cy.routePatientActions();

    cy
      .go('back');

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Open');

    cy
      .go('forward');

    cy
      .get('.workflow-page__tab.is-selected')
      .should('contain', 'Closed');
  });

  specify('retains route registration through rapid workspace changes and ignores obsolete startup failure', function() {
    const readyWorkspaces = [];
    let cancelledNavigation;

    cy.routesForDefault().visit().wait('@routeActions');
    cy.get('.list-search__input').type('outgoing workspace');

    cy.intercept({
      method: 'GET',
      pathname: '/api/states',
      headers: {
        workspace: workspaceTwo.id,
      },
    }, req => {
      return new Cypress.Promise(resolve => {
        releaseResponse = () => {
          releaseResponse = null;
          req.reply({
            statusCode: 500,
            body: {
              errors: getErrors({
                status: '500',
                title: 'Obsolete workspace failure',
              }),
            },
          });
          resolve();
        };
      });
    }).as('heldWorkspaceStates');

    cy.window().then(win => {
      win.router.on('route:ready', match => readyWorkspaces.push(match.params.workspace));
    });

    cy.get('.app-nav__header').click();
    cy.get('.picklist').find('.picklist__group').first().find('.picklist__item').eq(1).click();
    cy.wrap(null).should(() => expect(releaseResponse, 'workspace B preparation is held').to.be.a('function'));

    cy.window().then(win => {
      expect(win.router.hasRoute('program:details'), 'feature registration survives outgoing UI teardown').to.equal(true);
      expect(win.router.url('program:details', {
        workspace: 'two',
        programId: 'example',
      })).to.equal('/two/program/example');
      cancelledNavigation = win.navigation.transition.finished.catch(error => error.name);
    });

    cy.get('.app-nav__header').click();
    cy.get('.picklist').find('.picklist__group').first().find('.picklist__item').eq(0).click();
    cy.location('pathname').should('equal', '/one/worklist/owned-by');
    cy.then(() => cancelledNavigation).should('equal', 'AbortError');

    cy.then(() => releaseResponse());
    cy.wait('@heldWorkspaceStates');
    cy.window().then(win => {
      navigationReady = win.navigation.transition?.finished;
      return navigationReady;
    });

    cy.get('.worklist-list-page').should('be.visible');
    cy.get('.list-search__input').should('have.value', '');
    cy.get('.error-page').should('not.exist');
    cy.location('pathname').should('equal', '/one/worklist/owned-by');
    cy.then(() => expect(readyWorkspaces, 'only the current workspace becomes ready').to.deep.equal(['one']));

    cy.get('[data-worklists-region] .app-nav__link[aria-label="Owned By"]').click();
    cy.get('@routeActions.all').should('have.length', 3);
    cy.get('.worklist-list-page').should('be.visible');
  });

  specify('rejects an unregistered restricted area and keeps Back usable', function() {
    cy
      .routesForDefault()
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleEmployee),
          },
        });
        return fx;
      })
      .routePrograms()
      .visit('/programs');

    cy
      .get('.error-page')
      .should('be.visible')
      .and('contain', 'This page doesn\'t exist.');

    cy.location('pathname').should('equal', '/one/programs');
    cy.get('@routePrograms.all').should('have.length', 0);
    cy.window().then(win => {
      expect(win.router.getCurrent().name).to.equal('notFound');
      expect(win.router.hasRoute('programs:all')).to.equal(false);
      return win.Radio.request('router', 'navigate', 'worklist', {
        worklistId: 'owned-by',
      });
    });
    cy.get('.worklist-list-page').should('be.visible');
    cy.window().then(win => win.Radio.request('router', 'navigate', 'schedule'));
    cy.get('.schedule-list-page').should('be.visible');
    cy.window().then(win => win.router.navigate('/one/programs').finished);
    cy.get('.error-page').should('be.visible');
    cy.get('@routePrograms.all').should('have.length', 0);
    cy.window().then(win => win.router.back());
    cy.location('pathname').should('equal', '/one/schedule');
    cy.get('.error-page').should('not.exist');
    cy.window().then(win => win.router.back());
    cy.location('pathname').should('equal', '/one/worklist/owned-by');
    cy.get('.worklist-list-page').should('be.visible');
  });

  specify('observes workspace startup failure while the initial legacy lookup still owns routing', function() {
    const unhandledRejections = [];
    let lookupStarted;
    const lookupPending = new Cypress.Promise(resolve => {
      lookupStarted = resolve;
    });

    // Record rejected Promises explicitly so the controlled break fails at the
    // assertion rather than letting Cypress terminate before recovery renders.
    cy.on('uncaught:exception', (error, runnable, promise) => {
      if (promise) return false;
    });

    cy.intercept('GET', '/api/states', req => {
      return lookupPending.then(() => req.reply({
        statusCode: 403,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Forbidden',
          }),
        },
      }));
    }).as('failedInitialWorkspace');

    cy.intercept('GET', '/api/flows/pending-startup*', req => {
      return new Cypress.Promise(resolve => {
        releaseResponse = () => {
          releaseResponse = null;
          req.reply({
            statusCode: 410,
            body: {
              errors: getErrors({
                status: '410',
                title: 'Not Found',
              }),
            },
          });
          resolve();
        };
        lookupStarted();
      });
    }).as('pendingInitialLegacyFlow');

    cy.visit('/flow/pending-startup', {
      noWait: true,
      onBeforeLoad(win) {
        win.addEventListener('unhandledrejection', event => unhandledRejections.push(event.reason));
      },
    }).wait('@failedInitialWorkspace');

    cy.get('.account-setup').should('be.visible').and('contain', 'Your account is not set up yet.');
    cy.location('pathname').should('equal', '/one/flow/pending-startup');
    cy.get('.startup__error').should('not.exist');

    cy.then(() => releaseResponse());
    cy.wait('@pendingInitialLegacyFlow');
    cy.window().then(win => win.router.getInitialDispatch()).its('status').should('equal', 'cancelled');
    cy.location('pathname').should('equal', '/404');
    cy.window().then(win => win.navigation.transition?.finished);

    cy.get('.account-setup').should('be.visible');
    cy.get('.startup__error').should('not.exist');
    cy.then(() => expect(unhandledRejections, 'both startup rejection paths are observed').to.deep.equal([]));
  });
});
