import { v7 as uuid } from 'uuid';

import { testTs } from 'helpers/test-timestamp';

import { getRelationship, mergeJsonApi, getErrors } from 'helpers/json-api';

import { getProgramFlow } from 'support/api/program-flows';
import { getProgram } from 'support/api/programs';
import { getProgramActions, getProgramAction } from 'support/api/program-actions';
import { testForm } from 'support/api/forms';
import { teamNurse, teamCoordinator } from 'support/api/teams';

context('program flow page', function() {
  const testProgramFlowId = uuid();
  const testProgramId = uuid();

  const testProgramFlowActions = getProgramActions({
    attributes: {
      published_at: null,
      archived_at: null,
      behavior: 'standard',
    },
    relationships: {
      'program-flow': getRelationship(testProgramFlowId, 'flows'),
      'program': getRelationship(testProgramId, 'programs'),
    },
  });

  const testProgram = getProgram({
    id: testProgramId,
    attributes: {
      name: 'Test Program',
    },
    relationships: {
      'program-flows': [getRelationship(testProgramFlowId, 'flows')],
      'program-actions': getRelationship(testProgramFlowActions),
    },
  });

  const testProgramFlow = getProgramFlow({
    id: testProgramFlowId,
    attributes: {
      name: 'Test Flow',
      updated_at: testTs(),
    },
    relationships: {
      'program-actions': getRelationship(testProgramFlowActions),
      'program': getRelationship(testProgram),
    },
  });

  specify('context trail', function() {
    cy
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;
        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = testProgramFlowActions;
        return fx;
      })
      .routeProgramByProgramFlow(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgram()
      .routePrograms()
      .routeProgramActions()
      .routeProgramFlows();

    let releaseFlow;
    cy.intercept({ method: 'GET', url: `/api/program-flows/${ testProgramFlowId }`, times: 1 }, req => {
      return new Cypress.Promise(resolve => {
        releaseFlow = () => {
          req.reply({ body: { data: testProgramFlow, included: [] } });
          resolve();
        };
      });
    });
    cy.visit(`/program-flow/${ testProgramFlowId }`);
    cy.wrap(null).should(() => expect(releaseFlow).to.be.a('function'));
    cy.navigate('/programs').wait('@routePrograms');
    cy.then(() => releaseFlow());

    cy
      .navigate(`/program-flow/${ testProgramFlowId }`)
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.program-page__context-trail')
      .contains('Test Program')
      .click();

    cy
      .url()
      .should('contain', `program/${ testProgramId }`);

    cy
      .go('back')
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.app-nav')
      .find('.app-nav__bottom-button')
      .contains('Admin Tools')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Programs')
      .click()
      .wait('@routePrograms')
      .go('back')
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.program-page__context-trail')
      .contains('Back to List')
      .click();

    cy
      .url()
      .should('contain', 'programs');
  });

  specify('program sidebar', function() {
    const testProgramSidebar = mergeJsonApi(testProgram, {
      attributes: {
        name: 'Test Program',
        details: '',
        published_at: testTs(),
        archived_at: null,
      },
    });

    cy
      .routeProgramFlow()
      .routeProgramFlowActions()
      .routeProgramByProgramFlow(fx => {
        fx.data = testProgramSidebar;

        return fx;
      })
      .routeProgram(fx => {
        fx.data = testProgramSidebar;

        return fx;
      })
      .intercept('PATCH', `/api/programs/${ testProgramId }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchProgram')
      .visit(`/program-flow/${ testProgramFlowId }`)
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.program-sidebar')
      .should('contain', 'Test Program')
      .should('contain', 'No details given')
      .should('contain', 'On')
      .find('.program-sidebar__header')
      .should($header => {
        const menu = $header.find('.program-sidebar__context-menu')[0];

        expect(menu.classList.contains('button--menu')).to.be.true;
      });

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
      .click();

    cy
      .get('.program-page__context-trail')
      .should('contain', 'Testing');
  });

  specify('flow header', function() {
    cy
      .routeTags()
      .routeProgramFlow(fx => {
        fx.data = mergeJsonApi(testProgramFlow, {
          attributes: {
            name: 'Test Flow',
            details: 'Test Flow Details',
            published_at: null,
            archived_at: null,
            behavior: 'standard',
            updated_at: testTs(),
          },
          relationships: {
            'owner': getRelationship(teamCoordinator),
          },
        });

        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = testProgramFlowActions;

        return fx;
      })
      .routeProgramByProgramFlow(fx => {
        fx.data = testProgram;

        return fx;
      })
      .intercept('PATCH', `/api/program-flows/${ testProgramFlowId }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow')
      .visit(`/program-flow/${ testProgramFlowId }`)
      .wait('@routeProgramByProgramFlow')
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions');

    cy
      .get('.program-flow__header')
      .as('flowHeader')
      .find('.program-flow__name')
      .contains('Test Flow');

    cy
      .get('@flowHeader')
      .find('.program-flow__details')
      .contains('Test Flow Details');

    cy
      .get('@flowHeader')
      .find('.program-action-state--standard')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Automated')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.behavior).to.equal('automated');
      });

    cy
      .get('@flowHeader')
      .find('.program-action-state--automated')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Standard')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.behavior).to.equal('standard');
      });

    cy
      .get('@flowHeader')
      .find('[data-owner-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
        expect(data.relationships.owner.data.type).to.equal('teams');
      });

    cy
      .get('@flowHeader')
      .find('[data-owner-region]')
      .contains('NUR');
  });

  specify('Flow does not exist', function() {
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
      .wait('@routeProgramByProgramFlow')
      .wait('@routeFlow410');

    cy
      .url()
      .should('contain', '404');
  });

  specify('flow actions list', function() {
    cy.viewport(2200, 900);

    cy
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeTags()
      .routeProgramFlow(fx => {
        fx.data = mergeJsonApi(testProgramFlow, {
          attributes: {
            published_at: null,
            archived_at: null,
            behavior: 'standard',
          },
        });

        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = [
          mergeJsonApi(testProgramFlowActions[0], {
            attributes: {
              sequence: 0,
              name: 'First In List',
              updated_at: testTs(),
            },
            relationships: {
              'owner': getRelationship(),
              'form': getRelationship(testForm),
            },
          }),
          mergeJsonApi(testProgramFlowActions[1], {
            attributes: {
              sequence: 2,
              name: 'Third In List',
              options: {
                icon: 'caret-down',
                iconType: 'fas',
                color: 'red',
              },
            },
          }),
          mergeJsonApi(testProgramFlowActions[2], {
            attributes: {
              sequence: 1,
              name: 'Second In List',
              days_until_due: 3,
            },
          }),
        ];

        return fx;
      })
      .routePrograms()
      .routeProgramByProgramFlow()
      .intercept('GET', '/api/program-actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeProgramAction')
      .visit(`/program-flow/${ testProgramFlowId }`)
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.program-flow__list')
      .should($list => {
        expect($list[0].getBoundingClientRect().width).to.equal(1440);
      });

    cy
      .intercept('PATCH', `api/program-flows/${ testProgramFlowId }/actions`, {
        statusCode: 204,
        body: {},
      })
      .as('routeUpdateActionSequences');

    cy
      .get('.program-flow__list')
      .as('actionList')
      .find('.action-card')
      .first()
      .find('.program-flow__sort-handle')
      .trigger('pointerdown', { button: 0, force: true })
      .trigger('dragstart', { force: true });

    cy
      .get('.action-card')
      .last()
      .find('.work-card__state')
      .find('.action-icon--red .fa-caret-down');

    cy
      .get('.js-draggable')
      .eq(1)
      .trigger('dragover', 'center')
      .trigger('drop', 'center');

    cy
      .wait('@routeUpdateActionSequences')
      .its('request.body')
      .should(({ data }) => {
        expect(data[0].id).to.equal(testProgramFlowActions[2].id);
        expect(data[0].attributes.sequence).to.equal(0);
        expect(data[1].id).to.equal(testProgramFlowActions[0].id);
        expect(data[1].attributes.sequence).to.equal(1);
        expect(data[2].id).to.equal(testProgramFlowActions[1].id);
        expect(data[2].attributes.sequence).to.equal(2);
      });

    cy
      .intercept('PATCH', '/api/program-actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    const newProgramAction = getProgramAction({
      attributes: {
        name: 'Test Name',
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        'program-flow': getRelationship(testProgramFlowId, 'flows'),
      },
    });

    cy
      .intercept('POST', '/api/program-actions', {
        statusCode: 201,
        body: {
          data: newProgramAction,
        },
      })
      .as('routePostAction');

    cy
      .intercept('POST', `/api/program-flows/${ testProgramFlowId }/actions`, {
        statusCode: 201,
        body: {},
      })
      .as('routePostFlowAction');

    cy
      .intercept('PATCH', `/api/program-flows/${ testProgramFlowId }/actions`, {
        statusCode: 201,
        body: {},
      });

    cy
      .get('.program-flow__list')
      .as('actionList')
      .find('.action-card')
      .first()
      .should('contain', 'Second In List')
      .next()
      .should('contain', 'First In List')
      .next()
      .should('contain', 'Third In List');

    cy
      .get('@actionList')
      .find('.js-sort')
      .first()
      .click({ force: true });

    cy
      .location('pathname')
      .should('contain', `/program-flow/${ testProgramFlowId }`)
      .and('not.contain', '/action/');

    cy
      .get('@actionList')
      .contains('First In List')
      .click();

    cy
      .get('@actionList')
      .find('.is-selected')
      .find('[data-behavior-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Automated')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.behavior).to.equal('automated');
      });

    cy
      .get('.sidebar')
      .as('actionSidebar')
      .find('.program-action-state--automated');

    cy
      .get('@actionList')
      .find('.is-selected')
      .find('[data-owner-region]')
      .contains('Flow Owner')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
        expect(data.relationships.owner.data.type).to.equal('teams');
      });

    cy
      .get('@actionSidebar')
      .find('[data-owner-region]')
      .contains('Nurse');

    cy
      .get('@actionList')
      .find('.is-selected')
      .find('[data-owner-region]')
      .contains('NUR');

    cy
      .get('@actionList')
      .find('.is-selected')
      .find('[data-due-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Same Day')
      .click();

    cy
      .get('@actionSidebar')
      .find('[data-due-region]')
      .contains('Same Day');

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.days_until_due).to.equal(0);
      });

    cy
      .get('@actionSidebar')
      .find('[data-form-region]')
      .should('contain', 'Test Form')
      .click();

    cy
      .get('@actionList')
      .find('.is-selected')
      .find('[data-due-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Selection')
      .click();

    cy
      .get('@actionList')
      .find('.is-selected')
      .find('[data-due-region]')
      .find('button')
      .should('not.have.text');

    cy
      .get('@actionSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@actionList')
      .find('.is-selected')
      .should('not.exist');

    cy
      .get('.js-add-action')
      .click();

    cy
      .get('@actionList')
      .find('.is-selected')
      .contains('New Flow Action')
      .click();

    cy
      .get('@actionSidebar')
      .find('[data-name-region] .js-input')
      .type('Test Name');

    cy
      .get('@actionSidebar')
      .find('.js-save')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('Test Name');
      });

    cy
      .get('.action-card')
      .first()
      .find('.fa-square-poll-horizontal')
      .should('not.exist');

    cy
      .get('.action-card')
      .first()
      .next()
      .find('.fa-square-poll-horizontal')
      .parent()
      .should('be.disabled');

    const forbiddenErrors = getErrors({
      status: '403',
      title: 'Forbidden',
      detail: 'Insufficient permissions to delete action',
    });

    cy
      .intercept('DELETE', '/api/program-actions/*', {
        statusCode: 403,
        body: {
          errors: forbiddenErrors,
        },
      })
      .as('routeDeleteFlowActionFailure');

    cy
      .get('@actionList')
      .find('.action-card')
      .first()
      .click('bottom');

    cy
      .get('@actionSidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Program Action')
      .click()
      .wait('@routeDeleteFlowActionFailure');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete action');

    cy
      .intercept('DELETE', '/api/program-actions/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlowAction');

    cy
      .get('@actionSidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Program Action')
      .click();
  });

  specify('route directly to flow action', function() {
    const actions = testProgramFlowActions.map((action, index) => mergeJsonApi(action, {
      attributes: { name: `Selection ${ index + 1 }` },
    }));
    cy
      .routeTags()
      .routeForm()
      .routeAction()
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;

        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = actions;

        return fx;
      })
      .routeProgramAction(fx => {
        fx.data = actions[0];

        return fx;
      })
      .routePrograms()
      .routeProgramByProgramFlow()
      .visit(`/program-flow/${ testProgramFlowId }/action/${ actions[0].id }`)
      .wait('@routeProgramFlow')
      .wait('@routeProgramAction')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramByProgramFlow');

    cy
      .get('.sidebar')
      .should('exist');

    cy.get('.sidebar .js-close').first().click();
    let releaseSupersededAction;
    let supersededRequested = false;
    const supersededResponse = new Cypress.Promise(resolve => {
      releaseSupersededAction = resolve;
    });
    cy.intercept({ method: 'GET', url: `/api/program-actions/${ actions[0].id }*`, times: 1 }, req => {
      supersededRequested = true;
      return supersededResponse.then(() => req.reply({ body: { data: actions[0] } }));
    }).as('supersededFlowAction');
    cy.intercept('GET', `/api/program-actions/${ actions[1].id }*`, {
      body: { data: actions[1] },
    }).as('latestFlowAction');
    cy.get('.action-card').contains('Selection 1').click();
    cy.wrap(null).should(() => expect(supersededRequested).to.equal(true));
    cy.get('.action-card').contains('Selection 2').click();
    cy.wait('@latestFlowAction');
    cy.get('.sidebar [data-name-region] textarea').should('have.value', 'Selection 2');
    cy.then(() => releaseSupersededAction());
    cy.wait('@supersededFlowAction');
    cy.waitForAppRequests();
    cy.get('.sidebar [data-name-region] textarea').should('have.value', 'Selection 2');
    cy.get('.sidebar .js-close').first().click();
    // Exercise child-stop microtask boundaries before network responses can run.
    // The held-request scenario above covers the later fetch boundary.
    [0, 1, 2, 4].forEach(turns => {
      cy.get('.action-card').then(async cards => {
        [...cards].find(card => card.textContent.includes('Selection 1')).querySelector('.js-route').click();
        for (let turn = 0; turn < turns; turn++) await Promise.resolve();
        [...cards].find(card => card.textContent.includes('Selection 2')).querySelector('.js-route').click();
      });
      cy.get('.sidebar [data-name-region] textarea').should('have.value', 'Selection 2');
      cy.get('.sidebar .js-close').first().click();
    });
    let releaseAction;
    let requested = false;
    const response = new Cypress.Promise(resolve => {
      releaseAction = resolve;
    });
    cy.intercept('GET', `/api/program-actions/${ actions[0].id }*`, req => {
      requested = true;
      return response.then(() => req.reply({ body: { data: actions[0] } }));
    }).as('heldFlowAction');
    cy.get('.action-card').contains('Selection 1').click();
    cy.wrap(null).should(() => expect(requested).to.equal(true));
    cy.get('.app-nav').contains('Admin Tools').click();
    cy.get('.picklist').contains('Programs').click();
    cy.location('pathname').should('equal', '/one/programs');
    cy.get('.card-list').should('be.visible').then(() => releaseAction());
    cy.wait('@heldFlowAction');
    cy.waitForAppRequests();
    cy.get('.sidebar').should('not.exist');

    cy.then(() => {
      [false, true].forEach(networkFailure => {
        cy.then(() => {
          const program = getProgram();
          const flow = getProgramFlow({ relationships: { program: getRelationship(program) } });
          const action = getProgramAction({ relationships: {
            'program': getRelationship(program), 'program-flow': getRelationship(flow),
          } });
          const reported = cy.stub().as('reported');
          if (networkFailure) {
            cy.on('uncaught:exception', error => {
              if (!error.message.includes('Failed to fetch')) return;
              reported(error.message);
              return false;
            });
          }
          cy.routeProgramByProgramFlow(fx => ({ ...fx, data: program }))
            .routeProgramFlow(fx => ({ ...fx, data: flow }))
            .routeProgramFlowActions(fx => ({ ...fx, data: [action] }))
            .intercept('GET', `/api/program-actions/${ action.id }*`, networkFailure ?
              { forceNetworkError: true } :
              { statusCode: 400, body: { errors: [] } })
            .as('failedAction')
            .visit(`/program-flow/${ flow.id }/action/${ action.id }`)
            .wait('@failedAction');
          cy.get('.alert-box').should('be.visible');
          if (networkFailure) cy.get('@reported').should('have.been.calledWithMatch', 'Failed to fetch');
        });
      });
    });
  });
});
