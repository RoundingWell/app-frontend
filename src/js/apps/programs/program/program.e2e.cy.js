import { testTs } from 'helpers/test-timestamp';

import { getRelationship } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api/program-actions';
import { getProgramFlow } from 'support/api/program-flows';
import { testForm } from 'support/api/forms';
import { teamCoordinator, teamNurse } from 'support/api/teams';

context('program page', function() {
  specify('program details, flows, and actions', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Test Program',
        details: 'Program details',
        published_at: testTs(),
        archived_at: null,
      },
    });

    const automatedFlow = getProgramFlow({
      attributes: {
        name: 'Automated Flow',
        details: 'Flow details',
        behavior: 'automated',
        published_at: testTs(),
        archived_at: null,
      },
      relationships: {
        'owner': getRelationship(teamNurse),
        'program': getRelationship(testProgram),
      },
    });

    const draftFlow = getProgramFlow({
      attributes: {
        name: 'Draft Flow',
        details: null,
        behavior: 'standard',
        published_at: null,
        archived_at: null,
      },
      relationships: {
        'owner': getRelationship(),
        'program': getRelationship(testProgram),
      },
    });

    const formAction = getProgramAction({
      attributes: {
        name: 'Standard With Form',
        details: 'Action details',
        behavior: 'standard',
        days_until_due: 3,
      },
      relationships: {
        'owner': getRelationship(teamCoordinator),
        'form': getRelationship(testForm),
        'program': getRelationship(testProgram),
      },
    });

    const plainAction = getProgramAction({
      attributes: {
        name: 'Standard Without Form',
        details: null,
        behavior: 'standard',
        days_until_due: null,
      },
      relationships: {
        'owner': getRelationship(),
        'form': getRelationship(),
        'program': getRelationship(testProgram),
      },
    });

    const automatedAction = getProgramAction({
      attributes: {
        name: 'Automated Action',
        details: null,
        behavior: 'automated',
        days_until_due: 0,
      },
      relationships: {
        'owner': getRelationship(),
        'form': getRelationship(),
        'program': getRelationship(testProgram),
      },
    });

    cy
      .routePrograms(fx => {
        fx.data = [testProgram];

        return fx;
      })
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlows(fx => {
        fx.data = [draftFlow, automatedFlow];

        return fx;
      })
      .routeProgramActions(fx => {
        fx.data = [plainAction, automatedAction, formAction];

        return fx;
      })
      .routeProgramFlow(fx => {
        fx.data = automatedFlow;

        return fx;
      })
      .routeProgramByProgramFlow(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = [];

        return fx;
      })
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.card-list__item')
      .contains('Test Program')
      .click()
      .wait('@routeProgram')
      .wait('@routeProgramFlows')
      .wait('@routeProgramActions');

    cy
      .get('.program-page__context-trail')
      .should('contain', 'Test Program');

    cy
      .get('.program-sidebar')
      .should('contain', 'Test Program')
      .should('contain', 'Program details')
      .should('contain', 'Published');

    cy
      .get('[data-testid="program-flows"]')
      .find('.card-list__item')
      .should('have.length', 2)
      .first()
      .should('contain', 'Automated Flow')
      .should('contain', 'Flow details')
      .should('contain', 'Published')
      .should('contain', 'Nurse')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--automated')
      .should('contain', 'Automated');

    cy
      .get('[data-testid="program-flows"]')
      .find('.card-list__item')
      .last()
      .should('contain', 'Draft Flow')
      .should('contain', 'Draft')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--standard')
      .should('contain', 'Standard');

    cy
      .get('[data-testid="program-flows"]')
      .find('.card-list__item')
      .last()
      .find('.program-items__owner')
      .should('not.exist');

    cy
      .get('[data-testid="program-standard-actions"]')
      .find('.program-items__action')
      .should('have.length', 2)
      .first()
      .should('contain', 'Standard With Form')
      .should('contain', 'Action details')
      .should('contain', 'Coordinator')
      .should('contain', 'Due in 3 days')
      .find('.program-items__form')
      .should('contain', 'Test Form');

    cy
      .get('[data-testid="program-standard-actions"]')
      .find('.program-items__action')
      .first()
      .find('.program-behavior')
      .should('have.class', 'program-behavior--standard')
      .should('contain', 'Standard');

    cy
      .get('[data-testid="program-standard-actions"]')
      .find('.program-items__action')
      .last()
      .should('contain', 'Standard Without Form')
      .within(() => {
        cy
          .get('.program-items__form')
          .should('not.exist');

        cy
          .get('.program-items__owner')
          .should('not.exist');

        cy
          .get('.program-items__due')
          .should('not.exist');
      });

    cy
      .get('[data-testid="program-automated-actions"]')
      .find('.program-items__action')
      .should('have.length', 1)
      .first()
      .should('contain', 'Automated Action')
      .should('contain', 'Due same day')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--automated')
      .should('contain', 'Automated');

    cy
      .get('[data-testid="program-flows"]')
      .contains('Draft Flow')
      .closest('.card-list__item')
      .focus()
      .type('{enter}')
      .wait('@routeProgramFlow');

    cy
      .location('pathname')
      .should('equal', `/one/program-flow/${ draftFlow.id }`);

    cy
      .go('back')
      .wait('@routeProgram');

    cy
      .get('[data-testid="program-flows"]')
      .contains('Automated Flow')
      .click()
      .wait('@routeProgramFlow');

    cy
      .location('pathname')
      .should('equal', `/one/program-flow/${ automatedFlow.id }`);

    cy
      .get('.program-flow__header')
      .should('contain', 'Automated Flow');

    cy
      .go('back')
      .wait('@routeProgram');

    cy
      .get('.program-page__context-trail')
      .contains('Back to List')
      .click();

    cy
      .location('pathname')
      .should('equal', '/one/programs');

    cy
      .get('.card-list__item')
      .should('contain', 'Test Program');
  });

  specify('empty program', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Empty Program',
        details: null,
        published_at: null,
      },
    });

    cy
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeProgramActions(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/program/${ testProgram.id }`)
      .wait('@routeProgram')
      .wait('@routeProgramFlows')
      .wait('@routeProgramActions');

    cy
      .get('.program-sidebar')
      .should('contain', 'Empty Program')
      .should('contain', 'No details given')
      .should('contain', 'Draft');

    cy
      .get('[data-testid="program-flows"]')
      .should('contain', 'No program flows');

    cy
      .get('[data-testid="program-standard-actions"]')
      .should('contain', 'No standard actions');

    cy
      .get('[data-testid="program-automated-actions"]')
      .should('contain', 'No automated actions');
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
