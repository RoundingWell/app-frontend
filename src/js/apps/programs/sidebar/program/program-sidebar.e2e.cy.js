import formatDate from 'helpers/format-date';

import { getErrors } from 'helpers/json-api';
import { testTs } from 'helpers/test-timestamp';
import stateColors from 'helpers/state-colors';

import { getProgram } from 'support/api/programs';

context('program sidebar', function() {
  specify('display new program sidebar', function() {
    cy
      .routePrograms()
      .visit('/programs')
      .wait('@routePrograms');

    cy
      .get('.js-add')
      .contains('Program')
      .click();

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('be.focused')
      .should('have.attr', 'placeholder', 'New Program');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-published-region]')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-archived-region]')
      .should('not.exist');

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
      .type('Test Program');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Cancel')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('.js-add')
      .contains('Program')
      .click();

    const errors = getErrors([
      { detail: 'name error', sourceKeys: 'attributes/name' },
    ]);

    cy
      .intercept('POST', '/api/programs', {
        statusCode: 400,
        delay: 100,
        body: { errors },
      })
      .as('routePostProgramError');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('be.empty')
      .type('a{backspace}')
      .type('Test{enter} Program Name');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .click()
      .wait('@routePostProgramError');

    cy
      .get('.sidebar')
      .find('[data-name-region]')
      .should('contain', 'name error')
      .find('.js-input')
      .should('have.css', 'border-top-color', stateColors.error);

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .type('a{backspace}')
      .type('Test{enter} Details');

    cy
      .intercept('POST', '/api/programs', {
        statusCode: 201,
        body: {
          data: getProgram({
            attributes: {
              name: 'Test Program Name',
              published_at: null,
              updated_at: testTs(),
              created_at: testTs(),
            },
          }),
        },
      })
      .as('routePostProgram');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .click();

    cy
      .wait('@routePostProgram')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.not.be.null;
        expect(data.attributes.name).to.equal('Test Program Name');
        expect(data.attributes.details).to.equal('Test\n Details');
      });

    cy
      .get('.sidebar')
      .should('not.exist');

    cy
      .get('.card-list__item')
      .first()
      .should('contain', 'Test Program Name')
      .should('contain', formatDate(testTs(), 'TIME_OR_DAY'));

    cy
      .get('.js-add')
      .contains('Program')
      .click();
  });

  specify('display program sidebar', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Name',
        details: '',
        published_at: null,
        archived_at: null,
        created_at: testTs(),
        updated_at: testTs(),
      },
    });

    cy
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramActions()
      .routeProgramFlows()
      .visit(`/program/${ testProgram.id }`)
      .wait('@routeProgram');

    cy
      .intercept('PATCH', `/api/programs/${ testProgram.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchProgram');

    cy
      .get('.js-menu')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Update Program')
      .should('contain', 'Edit')
      .click();

    cy
      .get('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .clear()
      .type('cancel this text')
      .press(Cypress.Keyboard.Keys.TAB)
      .press(Cypress.Keyboard.Keys.TAB)
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-cancel')
      .typeEnter();

    cy
      .get('.sidebar')
      .find('[data-published-region] button')
      .should('contain', 'Off')
      .click();

    cy
      .wait('@routePatchProgram')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.published_at).to.not.be.null;
      });

    cy
      .get('.sidebar')
      .find('.js-close')
      .click();

    cy
      .get('.program-page__sidebar')
      .find('.program-sidebar__published')
      .should('contain', 'On');

    cy
      .get('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Edit')
      .click();

    cy
      .get('.sidebar')
      .find('[data-published-region] button')
      .should('contain', 'On')
      .click();

    cy
      .wait('@routePatchProgram')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.published_at).to.be.null;
      });

    cy
      .get('.sidebar')
      .find('.js-close')
      .click();

    cy
      .get('.program-page__sidebar')
      .find('.program-sidebar__published')
      .should('contain', 'Off');

    cy
      .get('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Edit')
      .click();

    cy
      .get('.sidebar')
      .find('[data-archived-region] button')
      .should('contain', 'Off')
      .click();

    cy
      .wait('@routePatchProgram')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.archived_at).to.not.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-archived-region] button')
      .should('contain', 'On')
      .click();

    cy
      .wait('@routePatchProgram')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.archived_at).to.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('have.value', 'Name');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .clear()
      .type('Tester McProgramington')
      .press(Cypress.Keyboard.Keys.TAB)
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-save')
      .typeEnter();

    cy
      .wait('@routePatchProgram')
      .its('request.body')
      .should(({ data }) => {
        expect(data.id).to.equal(testProgram.id);
        expect(data.attributes.name).to.equal('Tester McProgramington');
        expect(data.attributes.details).to.equal('');
        expect(data.attributes.published_at).to.be.undefined;
      });

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

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
  });
});
