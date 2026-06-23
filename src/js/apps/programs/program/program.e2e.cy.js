import { testTs } from 'helpers/test-timestamp';

import { getRelationship } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api//program-actions';

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
      .get('.table-list__item')
      .contains('Test Program')
      .click();

    cy
      .url()
      .should('contain', `program/${ testProgram.id }`);

    cy
      .get('.program__context-trail')
      .should('contain', 'Test Program')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'programs');
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
      .get('.program__context-trail')
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
        outreach: 'disabled',
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
      .get('.table-list__item')
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
      .get('.table-list__item')
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
});
