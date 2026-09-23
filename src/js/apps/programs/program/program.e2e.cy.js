import { testTs } from 'helpers/test-timestamp';

import { getRelationship } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api/program-actions';

context('program page', function() {
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
      .get('.program-page__context-trail')
      .should('contain', 'Test Program')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'programs');

    cy.then(() => {
      const program = getProgram();

      cy
        .routesForDefault()
        .intercept('GET', `/api/programs/${ program.id }`, { statusCode: 400, body: {} })
        .as('failedProgram')
        .visit(`/program/${ program.id }`)
        .wait('@failedProgram');

      cy.get('.error-page').should('contain', 'Error code: 400.');

      cy
        .routesForDefault()
        .routeProgram(fx => ({ ...fx, data: program }))
        .routeProgramFlows()
        .intercept('GET', `/api/programs/${ program.id }/actions*`, { statusCode: 400, body: {} })
        .as('failedActions')
        .visit(`/program/${ program.id }`)
        .wait('@failedActions');

      cy.get('.error-page').should('contain', 'Error code: 400.');
    });
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

    const latestProgramAction = getProgramAction({
      attributes: { ...testProgramAction.attributes, name: 'Z Latest Action' },
      relationships: testProgramAction.relationships,
    });

    cy
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlows()
      .routeProgramActions(fx => {
        fx.data = [testProgramAction, latestProgramAction];

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

    cy.get('.sidebar .js-close').first().click();
    cy.intercept('GET', `/api/program-actions/${ latestProgramAction.id }*`, {
      body: { data: latestProgramAction },
    }).as('latestProgramAction');
    // Exercise child-stop microtask boundaries before network responses can run.
    // The held-request scenario below covers the later fetch boundary.
    [0, 1, 2, 4].forEach(turns => {
      cy.get('.action-card').then(async cards => {
        [...cards].find(card => card.textContent.includes('Test Action')).click();
        for (let turn = 0; turn < turns; turn++) await Promise.resolve();
        [...cards].find(card => card.textContent.includes('Z Latest Action')).click();
      });
      cy.get('.sidebar [data-name-region] textarea').should('have.value', 'Z Latest Action');
      cy.get('.sidebar .js-close').first().click();
    });
    let releaseSupersededAction;
    let supersededRequested = false;
    const supersededResponse = new Cypress.Promise(resolve => {
      releaseSupersededAction = resolve;
    });
    cy.intercept({ method: 'GET', url: `/api/program-actions/${ testProgramAction.id }*`, times: 1 }, req => {
      supersededRequested = true;
      return supersededResponse.then(() => req.reply({ body: { data: testProgramAction } }));
    }).as('supersededProgramAction');
    cy.intercept('GET', `/api/program-actions/${ latestProgramAction.id }*`, {
      body: { data: latestProgramAction },
    }).as('latestSupersedingProgramAction');
    cy.get('.action-card').contains('Test Action').click();
    cy.wrap(null).should(() => expect(supersededRequested).to.equal(true));
    cy.get('.action-card').contains('Z Latest Action').click();
    cy.wait('@latestSupersedingProgramAction');
    cy.get('.sidebar [data-name-region] textarea').should('have.value', 'Z Latest Action');
    cy.then(() => releaseSupersededAction());
    cy.wait('@supersededProgramAction');
    cy.waitForAppRequests();
    cy.get('.sidebar [data-name-region] textarea').should('have.value', 'Z Latest Action');
    cy.get('.sidebar .js-close').first().click();
    let releaseAction;
    let requested = false;
    const response = new Cypress.Promise(resolve => {
      releaseAction = resolve;
    });
    cy.intercept('GET', `/api/program-actions/${ testProgramAction.id }*`, req => {
      requested = true;
      return response.then(() => req.reply({ body: { data: testProgramAction } }));
    }).as('heldProgramAction');
    cy.get('.action-card').contains('Test Action').click();
    cy.wrap(null).should(() => expect(requested).to.equal(true));
    cy.routePrograms();
    cy.get('.app-nav').contains('Admin Tools').click();
    cy.get('.picklist').contains('Programs').click();
    cy.location('pathname').should('equal', '/one/programs');
    cy.get('.card-list').should('be.visible').then(() => releaseAction());
    cy.wait('@heldProgramAction');
    cy.waitForAppRequests();
    cy.get('.sidebar').should('not.exist');
  });
});
