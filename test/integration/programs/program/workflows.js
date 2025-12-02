import { getRelationship } from 'helpers/json-api';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';

import { getProgram } from 'support/api/programs';
import { getProgramFlow } from 'support/api/program-flows';
import { getProgramAction } from 'support/api//program-actions';
import { testForm } from 'support/api/forms';
import { teamCoordinator, teamNurse } from 'support/api/teams';

context('program workflows page', function() {
  specify('actions in list', function() {
    const testProgram = getProgram();
    const testProgramAction = getProgramAction({
      attributes: {
        name: 'First In List',
        details: null,
        published_at: testTs(),
        behavior: 'standard',
        outreach: 'patient',
        days_until_due: null,
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        'program': getRelationship(testProgram),
        'owner': getRelationship(teamCoordinator),
        'form': getRelationship(testForm),
      },
    });

    cy
      .routeTags()
      .routeForm()
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramActions(fx => {
        fx.data = [
          testProgramAction,
          getProgramAction({
            attributes: {
              name: 'Third In List',
              updated_at: testTsSubtract(2),
              options: {
                icon: 'caret-down',
                iconType: 'fas',
                color: 'red',
              },
            },
          }),
          getProgramAction({
            attributes: {
              name: 'Second In List',
              updated_at: testTsSubtract(1),
            },
          }),
        ];

        return fx;
      })
      .routeProgramAction(fx => {
        fx.data = testProgramAction;

        return fx;
      })
      .routeProgramFlows(fx => {
        fx.data = [
          getProgramFlow({
            attributes: {
              name: 'Fourth In List',
              updated_at: testTsSubtract(3),
            },
            relationships: {
              owner: getRelationship(),
            },
          }),
        ];

        return fx;
      })
      .visit('/program/1')
      .wait('@routeProgram')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows');

    cy
      .intercept('PATCH', `/api/program-actions/${ testProgramAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .first()
      .should('contain', 'First In List');

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .eq(1)
      .should('contain', 'Second In List');

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .eq(2)
      .should('contain', 'Third In List')
      .find('.table-list__icon--large')
      .find('.action-icon--red .fa-caret-down');

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .last()
      .should('contain', 'Fourth In List');

    cy
      .get('.table-list__list')
      .contains('First In List')
      .click();

    cy
      .get('.table-list__list')
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
      .get('.table-list__list')
      .find('.is-selected')
      .find('[data-owner-region]')
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
      });

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .last()
      .find('[data-owner-region]')
      .find('button')
      .should('not.have.text');

    cy
      .get('.table-list__list')
      .find('.is-selected')
      .find('[data-due-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Same Day')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.days_until_due).to.equal(0);
      });

    cy
      .get('.table-list__list')
      .find('.is-selected')
      .find('[data-due-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Selection')
      .click();

    cy
      .get('.table-list__list')
      .find('.is-selected')
      .find('[data-due-region]')
      .find('button')
      .should('not.have.text');

    cy
      .get('.table-list__item')
      .first()
      .find('.fa-share-from-square');

    cy
      .get('.table-list__item')
      .first()
      .next()
      .find('.fa-file-lines');

    cy
      .get('.table-list__item')
      .first()
      .find('.fa-square-poll-horizontal')
      .parent()
      .should('be.disabled');

    cy
      .get('.table-list__item')
      .first()
      .next()
      .find('.fa-square-poll-horizontal')
      .should('not.exist');
  });

  specify('flow in list', function() {
    const testProgram = getProgram();

    const testProgramFlow = getProgramFlow({
      attributes: {
        published_at: null,
        behavior: 'standard',
      },
      relationships: {
        owner: getRelationship(),
      },
    });

    cy
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramActions(fx => [])
      .routeProgramFlows(fx => {
        fx.data = [
          testProgramFlow,
        ];

        return fx;
      })
      .routeProgramByProgramFlow()
      .routeProgramFlowActions()
      .routeProgramFlow()
      .visit(`/program/${ testProgram.id }`)
      .wait('@routeProgram')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows');

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .first()
      .as('flowItem');

    cy
      .intercept('PATCH', `/api/program-flows/${ testProgramFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('@flowItem')
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
      .get('@flowItem')
      .find('[data-owner-region]')
      .contains('NUR');

    cy
      .get('@flowItem')
      .click('top')
      .wait('@routeProgramFlow');

    cy
      .url()
      .should('contain', `program-flow/${ testProgramFlow.id }`);
  });

  specify('add action', function() {
    const testProgram = getProgram();

    cy
      .routeTags()
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramAction()
      .routeProgramActions()
      .routeProgramFlows()
      .routeActionActivity()
      .routeActionFiles()
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
      .contains('New Action')
      .click()
      .wait('@routeTags');

    cy
      .get('.program__layout')
      .find('.is-selected')
      .should('contain', 'New Program Action')
      .as('newAction');

    cy
      .get('@newAction')
      .find('[data-behavior-region]')
      .find('button')
      .should('be.disabled')
      .find('svg')
      .should('have.class', 'fa-circle-play');

    cy
      .get('@newAction')
      .find('[data-owner-region]')
      .find('button')
      .should('be.disabled')
      .find('svg')
      .should('have.class', 'fa-circle-user');

    cy
      .get('@newAction')
      .find('[data-due-region]')
      .find('button')
      .should('be.disabled')
      .find('svg')
      .should('have.class', 'fa-stopwatch');

    cy
      .get('@newAction')
      .click('top');

    cy
      .get('.sidebar')
      .find('.js-close')
      .click();

    cy
      .get('.table-list__list')
      .should('not.contain', 'New Program Action')
      .find('.is-selected')
      .should('not.exist');
  });

  specify('add flow', function() {
    const testProgram = getProgram();

    cy
      .routeTags()
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramActions()
      .routeProgramFlows(fx => [])
      .routeProgramByProgramFlow()
      .routeProgramFlowActions()
      .routeProgramFlow()
      .routeActionActivity()
      .routeActionFiles()
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
      .click()
      .wait('@routeTags');

    cy
      .get('.program__layout')
      .find('.is-selected')
      .should('contain', 'New Program Flow')
      .as('newFlow');

    cy
      .get('@newFlow')
      .find('.fa-pen-to-square');

    cy
      .get('@newFlow')
      .find('[data-owner-region]')
      .find('button')
      .should('be.disabled')
      .find('svg')
      .should('have.class', 'fa-circle-user');

    cy
      .get('@newFlow')
      .click('top');

    cy
      .get('.sidebar')
      .as('flowSidebar');

    cy
      .get('@flowSidebar')
      .find('[data-name-region] .js-input')
      .type('Test Flow');

    const testProgramFlow = getProgramFlow({
      attributes: {
        updated_at: testTs(),
        name: 'Test Flow',
      },
    });

    cy
      .intercept('POST', `/api/programs/${ testProgram.id }/relationships/flows`, {
        statusCode: 201,
        body: {
          data: testProgramFlow,
        },
      })
      .as('routePostFlow');

    cy
      .get('@flowSidebar')
      .find('.js-save')
      .click()
      .wait('@routePostFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('Test Flow');
      });

    cy
      .url()
      .should('contain', `program-flow/${ testProgramFlow.id }`);

    cy
      .go('back');

    cy
      .get('[data-add-region]')
      .contains('Add')
      .click();

    cy
      .get('.picklist')
      .contains('New Flow')
      .click();

    cy
      .get('@flowSidebar')
      .find('.js-close')
      .click();

    cy
      .get('.table-list__list')
      .should('not.contain', 'New Program Flow')
      .find('.is-selected')
      .should('not.exist');
  });
});
