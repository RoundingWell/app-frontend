import formatDate from 'helpers/format-date';
import { testTs } from 'helpers/test-timestamp';
import { getRelationship, getErrors } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramFlow } from 'support/api/program-flows';
import { getCurrentClinician } from 'support/api/clinicians';
import { roleAdmin } from 'support/api/roles';
import { teamNurse } from 'support/api/teams';

context('program flow sidebar', function() {
  specify('display new flow sidebar', function() {
    const testProgram = getProgram();

    cy
      .routeTags()
      .routeProgramActions()
      .routeProgramFlows(() => [])
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramByProgramFlow()
      .routeProgramFlow()
      .routeProgramFlowActions()
      .visit(`/program/${ testProgram.id }/flow`)
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows')
      .wait('@routeProgram');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('be.focused')
      .should('have.attr', 'placeholder', 'New Program Flow');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-published-region]')
      .contains('Off')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-archived-region]')
      .contains('Off')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-behavior-region]')
      .contains('Standard')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-owner-region]')
      .contains('Select Team')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .type('Test Name');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Cancel')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('.program__layout')
      .get('[data-add-region]')
      .contains('Add')
      .click();

    cy
      .get('.picklist')
      .contains('New Flow')
      .click();

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('be.empty')
      .type('   ');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .type('{backspace}{backspace}{backspace}');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('be.empty')
      .type('a{backspace}')
      .type('Test{enter} Name');

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .type('a{backspace}')
      .type('Test{enter} Details');

    const testProgramFlow = getProgramFlow({
      attributes: {
        created_at: testTs(),
        updated_at: testTs(),
      },
    });

    cy
      .intercept('POST', `/api/programs/${ testProgram.id }/relationships/flows*`, {
        statusCode: 201,
        body: {
          data: testProgramFlow,
        },
      })
      .as('routePostFlow');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .click();

    cy
      .wait('@routeProgramByProgramFlow')
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions')
      .wait('@routePostFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data).to.be.null;
        expect(data.id).to.not.be.null;
        expect(data.attributes.name).to.equal('Test Name');
        expect(data.attributes.details).to.equal('Test\n Details');
        expect(data.attributes.published_at).to.be.null;
        expect(data.attributes.archived_at).to.be.null;
        expect(data.attributes.behavior).to.equal('standard');
      });

    cy
      .url()
      .should('contain', `program-flow/${ testProgramFlow.id }`);
  });

  specify('display flow sidebar', function() {
    const testProgram = getProgram();

    const testProgramFlow = getProgramFlow({
      attributes: {
        name: 'Test Flow',
        details: '',
        published_at: null,
        archived_at: null,
        behavior: 'standard',
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        program: getRelationship(testProgram),
        owner: getRelationship(null),
      },
    });

    cy
      .routeTags()
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramByProgramFlow()
      .routeProgramActions()
      .routeProgramFlows()
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;

        return fx;
      })
      .routeProgramFlowActions()
      .visit(`/program-flow/${ testProgramFlow.id }`)
      .wait('@routeProgramByProgramFlow')
      .wait('@routeProgramFlow')
      .wait('@routeProgramFlowActions');

    cy
      .intercept('PATCH', `/api/program-flows/${ testProgramFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.program-flow__header')
      .as('flowHeader')
      .click('right')
      .should('have.class', 'is-selected');

    cy
      .get('.sidebar')
      .as('flowSidebar')
      .find('.js-close')
      .click();

    cy
      .get('@flowSidebar')
      .should('not.exist');

    cy
      .get('@flowHeader')
      .should('not.have.class', 'is-selected')
      .click('right');

    cy
      .get('[data-save-region]')
      .should('be.empty');

    cy
      .get('@flowSidebar')
      .find('[data-name-region] .js-input')
      .clear()
      .type('cancel this text');

    cy
      .get('@flowSidebar')
      .find('[data-save-region] .js-cancel')
      .type('{enter}', { force: true });

    cy
      .get('@flowSidebar')
      .find('[data-name-region] .js-input')
      .should('have.value', 'Test Flow');

    cy
      .get('@flowSidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('@flowSidebar')
      .find('[data-name-region] .js-input')
      .clear()
      .type('Tester{enter} McFlowton');

    cy
      .get('@flowSidebar')
      .find('[data-details-region] textarea')
      .type('Here are some details')
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-save')
      .typeEnter();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.equal(testProgramFlow.id);
        expect(data.attributes.name).to.equal('Tester McFlowton');
        expect(data.attributes.details).to.equal('Here are some details');
        expect(data.attributes.published_at).to.not.exist;
        expect(data.attributes.archived_at).to.not.exist;
        expect(data.attributes.behavior).to.not.exist;
        expect(data.attributes.owner).to.not.exist;
      });

    cy
      .get('@flowHeader')
      .should('have.class', 'is-selected')
      .should('contain', 'Here are some details');

    cy
      .get('@flowSidebar')
      .find('[data-published-region] button')
      .contains('Off')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.published_at).to.not.be.null;
      });

    cy
      .get('@flowSidebar')
      .find('[data-published-region] button')
      .contains('On')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.published_at).to.be.null;
      });

    cy
      .get('@flowSidebar')
      .find('[data-archived-region] button')
      .contains('Off')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.archived_at).to.not.be.null;
      });

    cy
      .get('@flowSidebar')
      .find('[data-archived-region] button')
      .contains('On')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.archived_at).to.be.null;
      });

    cy
      .get('@flowSidebar')
      .find('[data-behavior-region] button')
      .contains('Standard')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .should('contain', 'Standard')
      .next()
      .should('contain', 'Automated')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.behavior).to.equal('automated');
      });

    cy
      .get('@flowSidebar')
      .find('[data-behavior-region] button')
      .contains('Automated');

    cy
      .get('@flowHeader')
      .find('[data-behavior-region] button')
      .find('svg')
      .should('have.class', 'fa-bolt');

    cy
      .get('@flowSidebar')
      .find('[data-owner-region] button')
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
        expect(data.relationships.owner.data.type).to.equal(teamNurse.type);
      });

    cy
      .get('@flowHeader')
      .find('[data-owner-region]')
      .contains('NUR')
      .click();

    cy
      .get('.picklist')
      .find('.js-clear')
      .click();

    cy
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data).to.be.null;
      });

    cy
      .get('.sidebar__footer')
      .contains('Added')
      .next()
      .should('contain', formatDate(testTs(), 'AT_TIME'));

    cy
      .get('.sidebar__footer')
      .contains('Updated')
      .next()
      .should('contain', formatDate(testTs(), 'AT_TIME'));

    cy
      .get('@flowSidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Delete Program Flow')
      .click();

    cy
      .intercept('DELETE', `/api/program-flows/${ testProgramFlow.id }`, {
        statusCode: 403,
        body: {
          errors: getErrors([
            {
              status: '403',
              title: 'Forbidden',
              detail: 'Insufficient permissions to delete action',
            },
          ]),
        },
      })
      .as('routeDeleteFlowFailure');

    cy
      .get('.modal--small')
      .should('contain', 'Confirm Delete')
      .should('contain', 'Are you sure you want to delete this Program Flow? This cannot be undone.')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeDeleteFlowFailure');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete action');

    cy
      .get('@flowSidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Delete Program Flow')
      .click();

    cy
      .intercept('DELETE', `/api/program-flows/${ testProgramFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlow');

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click();

    cy
      .wait('@routeDeleteFlow')
      .itsUrl()
      .its('pathname')
      .should('contain', `api/program-flows/${ testProgramFlow.id }`);

    cy
      .url()
      .should('contain', `program/${ testProgram.id }`);
  });

  specify('admin tags', function() {
    const testProgramFlow = getProgramFlow({
      attributes: {
        tags: ['test-tag'],
      },
    });

    cy
      .routeTags()
      .routeProgramByProgramFlow()
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            'role': getRelationship(roleAdmin),
          },
        });

        return fx;
      })
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;

        return fx;
      })
      .routeProgramFlowActions()
      .visit(`/program-flow/${ testProgramFlow.id }`)
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramFlow');

    cy
      .get('.program-flow__header')
      .as('flowHeader')
      .click('right');

    cy
      .intercept({
        method: 'PATCH',
        url: `api/program-flows/${ testProgramFlow.id }`,
      }, { statusCode: 204 })
      .as('routePatchFlow');

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .contains('Add Tag')
      .click();

    cy
      .get('.picklist')
      .contains('foo-tag')
      .click()
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.tags).to.eql(['foo-tag', 'test-tag']);
      });

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .should('contain', 'foo-tag')
      .should('contain', 'test-tag')
      .contains('Add Tag')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Want to add one?')
      .find('.js-input')
      .type('new-tag');

    cy
      .get('.picklist')
      .contains('Add new-tag')
      .click()
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.tags).to.eql(['foo-tag', 'new-tag', 'test-tag']);
      });

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .should('contain', 'foo-tag')
      .should('contain', 'new-tag')
      .should('contain', 'test-tag')
      .find('.js-remove')
      .last()
      .click()
      .wait('@routePatchFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.tags).to.eql(['foo-tag', 'new-tag']);
      });

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .should('contain', 'foo-tag')
      .should('contain', 'new-tag')
      .should('not.contain', 'test-tag');
  });
});
