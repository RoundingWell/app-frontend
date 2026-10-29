import { testTs } from 'helpers/test-timestamp';
import { getRelationship } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramFlow } from 'support/api/program-flows';
import { getProgramAction } from 'support/api/program-actions';
import { teamNurse } from 'support/api/teams';

context('program workflow documentation', function() {
  const program = getProgram({
    attributes: { name: 'Care transitions', details: 'Support patients after discharge.', published_at: testTs(), archived_at: null },
  });
  const flow = getProgramFlow({
    attributes: { name: 'Assessment flow', details: 'Understand patient needs.', behavior: 'standard', published_at: testTs(), archived_at: null },
    relationships: { program: getRelationship(program), owner: getRelationship(teamNurse) },
  });
  const firstAction = getProgramAction({
    attributes: { name: 'Initial assessment', details: 'Review discharge instructions.', sequence: 10, behavior: 'standard', days_until_due: 0, published_at: testTs(), archived_at: null },
    relationships: { 'program': getRelationship(program), 'program-flow': getRelationship(flow), 'owner': getRelationship() },
  });
  const secondAction = getProgramAction({
    attributes: { name: 'Confirm plan', sequence: 20, behavior: 'conditional', days_until_due: 3, weekdays_only: true, published_at: testTs(), archived_at: null },
    relationships: { 'program': getRelationship(program), 'program-flow': getRelationship(flow), 'owner': getRelationship(teamNurse) },
  });
  const standalone = getProgramAction({
    attributes: { name: 'Patient check-in', details: 'Record a patient concern.', behavior: 'automated', days_until_due: null, published_at: null, archived_at: null },
    relationships: { program: getRelationship(program), owner: getRelationship() },
  });

  beforeEach(function() {
    cy
      .routeProgram(fx => {
        fx.data = program;
        return fx;
      })
      .routeProgramByProgramFlow(fx => {
        fx.data = program;
        fx.included = [];
        return fx;
      })
      .routeProgramFlows(fx => {
        fx.data = [flow];
        return fx;
      })
      .routeProgramFlow(fx => {
        fx.data = flow;
        return fx;
      })
      .routeProgramActions(fx => {
        fx.data = [standalone];
        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = [secondAction, firstAction];
        return fx;
      });
  });

  specify('documents standalone work and ordered flow actions with contextual links and history', function() {
    cy
      .visit(`/program/${ program.id }`)
      .wait('@routeProgramActions');

    cy
      .get('.program-report__action')
      .should('have.length', 1)
      .should('contain', 'Patient check-in')
      .should('contain', 'Record a patient concern.')
      .should('contain', 'Unassigned')
      .should('contain', 'No due date')
      .should('contain', 'Automated')
      .should('contain', 'Unpublished');

    cy
      .get('.program-report__navigation')
      .contains('a', 'Assessment flow')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/program-flow/${ flow.id }`);

    cy
      .get('.program-report__action')
      .first()
      .should('contain', 'Initial assessment')
      .should('contain', 'Review discharge instructions.')
      .should('contain', 'Flow Owner')
      .should('contain', 'Nurse')
      .should('contain', 'Same day');

    cy
      .get('.program-report__action')
      .last()
      .should('contain', 'Confirm plan')
      .should('contain', 'Conditional')
      .should('contain', '3 days')
      .should('contain', 'Weekdays only')
      .find('a')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/program-flow/${ flow.id }/action/${ secondAction.id }`);

    cy
      .focused()
      .should('contain', 'Confirm plan');

    cy
      .go('back');

    cy
      .location('pathname')
      .should('equal', `/one/program-flow/${ flow.id }`);

    cy
      .get('.program-report__navigation')
      .contains('a', 'Overview')
      .click();

    cy
      .get('.program-report__action')
      .should('have.length', 1)
      .should('contain', 'Patient check-in');
  });

  specify('handles missing actions, empty flows, and failed requests', function() {
    cy
      .visit(`/program-flow/${ flow.id }/action/missing`)
      .wait('@routeProgramFlowActions');

    cy
      .get('.program-report__notice')
      .should('be.visible')
      .should('contain', 'This action is not in this report.');

    cy
      .get('.program-report__action')
      .should('have.length', 2);

    cy
      .routeProgramFlowActions(fx => {
        fx.data = [];
        return fx;
      })
      .visit(`/program-flow/${ flow.id }`)
      .wait('@routeProgramFlowActions');

    cy
      .get('.program-report')
      .should('contain', 'No actions are configured here.');

    cy
      .intercept('GET', `/api/program-flows/${ flow.id }/actions`, { statusCode: 500, body: { errors: [] } })
      .as('failedActions')
      .visit(`/program-flow/${ flow.id }`)
      .wait('@failedActions');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');
  });

  specify('keeps unpublished and archived programs unavailable through direct links', function() {
    cy
      .routeProgram(fx => {
        fx.data = { ...program, attributes: { ...program.attributes, published_at: null } };
        return fx;
      })
      .visit(`/program/${ program.id }`)
      .wait('@routeProgram');

    cy
      .get('.error-page')
      .should('be.visible');

    cy
      .get('.program-report')
      .should('not.exist');

    cy
      .routeProgramByProgramFlow(fx => {
        fx.data = { ...program, attributes: { ...program.attributes, archived_at: testTs() } };
        return fx;
      })
      .visit(`/program-flow/${ flow.id }`)
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.error-page')
      .should('be.visible');

    cy
      .get('.program-report')
      .should('not.exist');
  });
});
