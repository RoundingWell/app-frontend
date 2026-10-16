import { NIL as NIL_UUID } from 'uuid';

import { getErrors, getRelationship } from 'helpers/json-api';

import { getCurrentClinician } from 'support/api/clinicians';

context('default routes', function() {
  let releaseConfig;
  let releaseBootstrap;

  afterEach(function() {
    if (releaseConfig) {
      releaseConfig();
      cy.wait('@heldConfig');
      releaseConfig = null;
    }

    if (!releaseBootstrap) return;

    releaseBootstrap();
    cy.wait('@heldBootstrap');
    releaseBootstrap = null;
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
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');
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
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');
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
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');

    cy
      .get('.prelogin')
      .click('right');

    cy
      .get('.prelogin__message');
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
      .get('.prelogin__message')
      .contains('Hold up, your account is not set up yet. Please notify your manager or administrator to correct this issue.');
  });

  specify('keeps the loader visible until bootstrap completes', function() {
    let initialLogoVisible;
    let initialAnimationReady;
    let initialCore;
    const configResponse = new Cypress.Promise(resolve => {
      releaseConfig = resolve;
    });
    const bootstrapResponse = new Cypress.Promise(resolve => {
      releaseBootstrap = resolve;
    });

    cy
      .routesForDefault()
      .intercept('GET', '/appconfig.json*', req => {
        return configResponse.then(() => req.reply({ body: {
          app: { stage: 'dev', name: 'Cypress Clinic', version: 'dev' },
        } }));
      })
      .as('heldConfig')
      .intercept('GET', '/api/clinicians/me', req => {
        return bootstrapResponse.then(() => req.reply({ body: { data: getCurrentClinician(), included: [] } }));
      })
      .as('heldBootstrap')
      .visit({
        noWait: true,
        onBeforeLoad(win) {
          const observer = new win.MutationObserver(() => {
            const logo = win.document.querySelector('.startup-shell__logo');
            if (!logo) return;

            initialLogoVisible = Cypress.dom.isVisible(logo);
            initialCore = win.document.querySelector('[data-startup-visual] .startup__core');
            const animations = initialCore.getAnimations();
            initialAnimationReady = win.matchMedia('(prefers-reduced-motion: reduce)').matches ?
              animations.length === 0 :
              animations.some(animation => animation.playState === 'running');
            observer.disconnect();
            releaseConfig();
          });

          observer.observe(win.document, { childList: true, subtree: true });
        },
      });

    cy.then(() => {
      expect(initialLogoVisible, 'logo visible before authentication').to.equal(true);
      expect(initialAnimationReady, 'loading motion respects preference before authentication').to.equal(true);
    });

    cy.wait('@heldConfig').then(() => {
      releaseConfig = null;
    });

    cy
      .get('.startup__logo')
      .should('be.visible');

    cy
      .get('.startup-shell')
      .should('not.exist');

    cy
      .get('.startup__core')
      .should($core => {
        expect($core[0], 'initial animated core retained').to.equal(initialCore);
      });

    cy
      .get('.startup')
      .should('have.attr', 'aria-busy', 'true')
      .find('.startup__status-text')
      .should('have.text', 'Loading RoundingWell')
      .then(() => releaseBootstrap());

    cy.wait('@heldBootstrap').then(() => {
      releaseBootstrap = null;
    });

    cy
      .get('.app-nav')
      .should('be.visible');

    cy
      .get('.startup')
      .should('not.exist');
  });

  specify('bootstrap failure retains recovery after late errors and retries on reload', function() {
    let lateError;

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
      .should('not.exist');
  });
});
