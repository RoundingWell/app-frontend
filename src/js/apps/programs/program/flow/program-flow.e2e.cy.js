import { testTs } from 'helpers/test-timestamp';

import { getRelationship, getErrors } from 'helpers/json-api';

import { getProgramFlow } from 'support/api/program-flows';
import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api/program-actions';
import { testForm } from 'support/api/forms';
import { teamCoordinator, teamNurse } from 'support/api/teams';

context('program flow page', function() {
  const testProgram = getProgram({
    attributes: {
      name: 'Test Program',
      details: 'Program details',
      published_at: testTs(),
    },
  });

  const testProgramFlow = getProgramFlow({
    attributes: {
      name: 'Test Flow',
      details: 'Flow details',
      behavior: 'standard',
      published_at: testTs(),
      archived_at: null,
    },
    relationships: {
      'owner': getRelationship(teamNurse),
      'program': getRelationship(testProgram),
    },
  });

  function getFlowAction(attributes, relationships) {
    return getProgramAction({
      attributes,
      relationships: {
        'owner': getRelationship(),
        'form': getRelationship(),
        'program': getRelationship(testProgram),
        'program-flow': getRelationship(testProgramFlow),
        ...relationships,
      },
    });
  }

  specify('flow details and actions in sequence', function() {
    const flowActions = [
      getFlowAction({
        name: 'Automated Reminder',
        details: null,
        behavior: 'automated',
        days_until_due: null,
        sequence: 2,
      }),
      getFlowAction({
        name: 'Intake Call',
        details: 'Intake details',
        behavior: 'standard',
        days_until_due: 2,
        sequence: 0,
      }, {
        'owner': getRelationship(teamCoordinator),
        'form': getRelationship(testForm),
      }),
      getFlowAction({
        name: 'Follow Up Visit',
        details: null,
        behavior: 'conditional',
        days_until_due: 1,
        sequence: 1,
      }),
    ];

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
        fx.data = [testProgramFlow];

        return fx;
      })
      .routeProgramActions(fx => {
        fx.data = [];

        return fx;
      })
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;

        return fx;
      })
      .routeProgramByProgramFlow(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = flowActions;

        return fx;
      })
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.card-list__item')
      .contains('Test Program')
      .click()
      .wait('@routeProgram');

    cy
      .get('[data-testid="program-flows"]')
      .contains('Test Flow')
      .click()
      .wait('@routeProgramFlow')
      .wait('@routeProgramByProgramFlow')
      .wait('@routeProgramFlowActions');

    cy
      .get('.program-flow__header')
      .should('contain', 'Test Flow')
      .should('contain', 'Flow details')
      .should('contain', 'Published')
      .should('contain', 'Nurse')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--standard')
      .should('contain', 'Standard');

    cy
      .get('.program-sidebar')
      .should('contain', 'Test Program')
      .should('contain', 'Program details')
      .should('contain', 'Published');

    cy
      .get('.program-items__action')
      .as('actions')
      .should('have.length', 3);

    cy
      .get('@actions')
      .eq(0)
      .should('contain', 'Intake Call')
      .should('contain', 'Intake details')
      .should('contain', 'Coordinator')
      .should('contain', 'Due in 2 days')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--standard')
      .should('contain', 'Standard');

    cy
      .get('@actions')
      .eq(0)
      .find('.program-items__form')
      .should('contain', 'Test Form');

    cy
      .get('@actions')
      .eq(1)
      .should('contain', 'Follow Up Visit')
      .should('contain', 'Due in 1 day')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--conditional')
      .should('contain', 'Conditional');

    cy
      .get('@actions')
      .eq(1)
      .find('.program-items__form')
      .should('not.exist');

    cy
      .get('@actions')
      .eq(2)
      .should('contain', 'Automated Reminder')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--automated')
      .should('contain', 'Automated');

    cy
      .get('@actions')
      .eq(2)
      .find('.program-items__form')
      .should('not.exist');

    cy
      .get('.program-page__context-trail')
      .contains('Test Program')
      .click()
      .wait('@routeProgram');

    cy
      .url()
      .should('contain', `program/${ testProgram.id }`);

    cy
      .go('back')
      .wait('@routeProgramFlow');

    cy
      .get('.program-page__context-trail')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'programs');

    cy
      .get('.card-list__item')
      .should('contain', 'Test Program');
  });

  specify('flow without actions', function() {
    cy
      .routeProgramFlow(fx => {
        fx.data = getProgramFlow({
          attributes: {
            name: 'Empty Flow',
            details: null,
            behavior: 'automated',
            published_at: null,
          },
          relationships: {
            'owner': getRelationship(),
            'program': getRelationship(testProgram),
          },
        });

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
      .visit(`/program-flow/${ testProgramFlow.id }`)
      .wait('@routeProgramFlow')
      .wait('@routeProgramByProgramFlow')
      .wait('@routeProgramFlowActions');

    cy
      .get('.program-flow__header')
      .should('contain', 'Empty Flow')
      .should('contain', 'Draft')
      .find('.program-behavior')
      .should('have.class', 'program-behavior--automated');

    cy
      .get('.program-flow__header')
      .find('.program-items__owner')
      .should('not.exist');

    cy
      .get('.program-page__context-trail')
      .should('contain', 'Test Program');

    cy
      .get('.program-page__content')
      .should('contain', 'No actions');
  });

  specify('flow does not exist', function() {
    const errors = getErrors({
      status: '410',
      title: 'Not Found',
      detail: 'Cannot find action',
      source: { parameter: 'flowId' },
    });

    cy
      .routeProgramByProgramFlow()
      .routeProgramFlowActions()
      .intercept('GET', '/api/program-flows/1', {
        statusCode: 410,
        body: { errors },
      })
      .as('routeFlow410')
      .visit('/program-flow/1')
      .wait('@routeFlow410');

    cy
      .url()
      .should('contain', '404');
  });
});
