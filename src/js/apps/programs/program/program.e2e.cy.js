import { testTs } from 'helpers/test-timestamp';

import { getRelationship } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api//program-actions';

context('program page', function() {
  let releaseFlows;
  let obsoleteNavigation;

  afterEach(function() {
    releaseFlows?.();
    releaseFlows = null;
    const pending = obsoleteNavigation;
    obsoleteNavigation = null;
    if (pending) cy.then(() => pending);
  });

  specify('does not finish obsolete highlighting after leaving a pending workflow list', function() {
    const program = getProgram({
      attributes: {
        name: 'Pending Program',
      },
    });
    let readyCount = 0;

    cy
      .routeActions()
      .routeTags()
      .routeProgram(fx => {
        fx.data = program;
        return fx;
      })
      .routeProgramActions()
      .routeProgramFlows()
      .visit('/worklist/owned-by');

    cy.intercept({
      method: 'GET',
      url: `/api/programs/${ program.id }/flows*`,
      times: 1,
    }, req => {
      return new Cypress.Promise(resolve => {
        releaseFlows = () => {
          releaseFlows = null;
          req.reply({
            body: {
              data: [],
              included: [],
            },
          });
          resolve();
        };
      });
    }).as('heldHighlightingFlows');

    cy.window().then(win => {
      win.router.on('route:ready', match => {
        if (match.name === 'program:action:new') readyCount++;
      });
      obsoleteNavigation = win.Radio.request('router', 'navigate', 'program:action:new', {
        programId: program.id,
      });
    });

    cy.wrap(null).should(() => expect(releaseFlows).to.be.a('function'));
    cy.get('.sidebar').should('be.visible');
    cy.get('.workflows__content').should('be.visible');
    cy.then(() => expect(readyCount, 'the held workflow list is required presentation').to.equal(0));

    cy.get('.program-page__context-trail').contains('Back to List').click();
    cy.location('pathname').should('equal', '/one/worklist/owned-by');
    cy.get('.worklist-list-page').should('be.visible');
    cy.then(() => obsoleteNavigation).should('equal', false);

    cy.then(() => releaseFlows());
    cy.wait('@heldHighlightingFlows');
    cy.get('.program-page__context-trail').should('not.exist');
    cy.get('.sidebar').should('not.exist');
    cy.get('.alert-box').should('not.exist');
    cy.then(() => expect(readyCount, 'cancelled detail never reports ready').to.equal(0));

    cy.window().then(win => win.Radio.request('router', 'navigate', 'program:action:new', {
      programId: program.id,
    }));
    cy.get('.sidebar').should('be.visible');
    cy.get('.alert-box').should('not.exist');
    cy.then(() => expect(readyCount, 'a later ordinary selection still completes').to.equal(1));
  });

  specify('context trail', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Test Program',
        updated_at: testTs(),
      },
    });

    cy
      .routeWorkspacePrograms(fx => {
        fx.data = [testProgram];

        return fx;
      })
      .routePrograms(fx => {
        fx.data = [testProgram];

        return fx;
      })
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramActions()
      .routeProgramFlows()
      .visit('/programs');

    cy
      .get('.card-list__item')
      .contains('Test Program')
      .click();

    cy
      .url()
      .should('contain', `program/${ testProgram.id }`);

    cy
      .intercept('GET', '/api/program-actions/*', {
        delay: 2000,
        body: { data: getProgramAction(), included: [] },
      })
      .as('pendingAction');

    cy
      .get('.action-card')
      .first()
      .click('bottom');

    cy
      .get('@pendingAction.all')
      .should('have.length', 1);

    cy
      .get('.program-page__context-trail')
      .should('contain', 'Test Program')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'programs');

    cy
      .intercept('GET', '/api/tags', { delay: 2000, body: { data: [] } })
      .as('pendingTags');

    cy
      .get('.card-list__item')
      .contains('Test Program')
      .click();

    cy
      .get('[data-add-region]')
      .contains('Add')
      .click();

    cy
      .get('.picklist')
      .contains('New Flow')
      .click();

    cy
      .get('@pendingTags.all')
      .should('have.length', 1);

    cy
      .get('.program-page__context-trail')
      .contains('Back to List')
      .click();

    cy
      .get('.card-list__item')
      .should('contain', 'Test Program');

    cy
      .get('.sidebar')
      .should('not.exist');
  });

  specify('read only sidebar', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Test Program',
        details: null,
        published_at: testTs(),
        created_at: testTs(),
        archived_at: null,
        updated_at: testTs(),
      },
    });

    cy
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlows()
      .routeProgramActions()
      .visit(`/program/${ testProgram.id }`);

    cy
      .intercept('PATCH', `/api/programs/${ testProgram.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchProgram');

    cy
      .get('.program-sidebar')
      .should('contain', 'Test Program')
      .should('contain', 'No details given')
      .should('contain', 'On');

    cy
      .get('.js-menu')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Update Program')
      .should('contain', 'Edit')
      .click();

    cy
      .get('.sidebar')
      .find('[data-name-region]')
      .contains('Test Program')
      .clear()
      .type('Testing');

    cy
      .get('[data-save-region]')
      .contains('Save')
      .click()
      .wait('@routePatchProgram');

    cy
      .get('.program-page__context-trail')
      .should('contain', 'Testing');
  });

  specify('new flow sidebar', function() {
    const testProgram = getProgram();

    cy
      .routeTags()
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramActions(fx => [])
      .routeProgramFlows(fx => [])
      .visit(`/program/${ testProgram.id }`)
      .wait('@routeProgram')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows');

    cy
      .get('[data-add-region]')
      .contains('Add')
      .click();

    cy
      .get('.picklist')
      .contains('New Flow')
      .click();

    cy
      .get('.sidebar');
  });

  specify('action not from a flow', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Test Program',
        published_at: testTs(),
      },
    });

    const testProgramAction = getProgramAction({
      attributes: {
        name: 'Test Action',
        details: 'Details',
        published_at: null,
        archived_at: null,
        behavior: 'standard',
        allowed_uploads: [],
        days_until_due: 5,
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        'program': getRelationship(testProgram),
      },
    });

    cy
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlows()
      .routeProgramActions(fx => {
        fx.data = [testProgramAction];

        return fx;
      })
      .routeProgramAction(fx => {
        fx.data = testProgramAction;

        return fx;
      })
      .routeTags()
      .visit(`/program/${ testProgram.id }`);

    cy
      .get('.action-card')
      .first()
      .find('[data-behavior-region] button')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .contains('Conditional')
      .should('not.exist');

    cy
      .get('.action-card')
      .contains('Test Action')
      .click();

    cy
      .get('.sidebar')
      .find('[data-behavior-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .contains('Conditional')
      .should('not.exist');
  });

  specify('shows an error when program workflows cannot load', function() {
    const program = getProgram();

    cy
      .routeProgram(fx => {
        fx.data = program;

        return fx;
      })
      .routeProgramFlows()
      .intercept('GET', `/api/programs/${ program.id }/actions*`, { statusCode: 400, body: { errors: [] } })
      .as('routeProgramActionsError')
      .visit(`/program/${ program.id }`)
      .wait('@routeProgramActionsError');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 400.');
  });
});
