import { v7 as uuid } from 'uuid';

import formatDate from 'helpers/format-date';
import { testTs } from 'helpers/test-timestamp';
import { getRelationship, getErrors } from 'helpers/json-api';

import { getProgram } from 'support/api/programs';
import { getProgramAction, getProgramActions } from 'support/api/program-actions';
import { getProgramFlow } from 'support/api/program-flows';
import { getCurrentClinician } from 'support/api/clinicians';
import { getForm, testForm } from 'support/api/forms';
import { roleAdmin } from 'support/api/roles';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { workspaceOne, workspaceTwo, getWorkspace } from 'support/api/workspaces';

context('program action sidebar', function() {
  specify('display new action sidebar', function() {
    const testProgram = getProgram();

    cy
      .routeSettings('upload_attachments', true)
      .routeTags()
      .routeProgramActions(fx => {
        fx.data = getProgramActions({
          relationships: {
            'program': getRelationship(testProgram),
            'program-flow': getRelationship(),
          },
        });

        return fx;
      })
      .routeProgramFlows(() => [])
      .routeProgram(fx => {
        fx.data = testProgram;

        return fx;
      })
      .routeProgramAction()
      .visit(`/program/${ testProgram.id }/action`)
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows')
      .wait('@routeProgram');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('be.focused')
      .should('have.attr', 'placeholder', 'New Program Action');

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
      .contains('Select Team...')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-due-region]')
      .contains('Select # Days')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .contains('Add Form')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .contains('Enable Attachment Uploads')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .type('Test Name')
      .press(Cypress.Keyboard.Keys.TAB)
      .press(Cypress.Keyboard.Keys.TAB)
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-cancel')
      .typeEnter();

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
      .contains('New Action')
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

    const testProgramAction = getProgramAction({
      attributes: {
        name: 'Test Name',
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        'program': getRelationship(testProgram),
      },
    });

    cy
      .intercept('POST', '/api/program-actions', {
        statusCode: 201,
        body: {
          data: testProgramAction,
        },
      })
      .as('routePostAction');

    cy
      .routeProgramAction(fx => {
        fx.data = testProgramAction;

        return fx;
      });

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .type('a{backspace}')
      .type('Test{enter} Details')
      .press(Cypress.Keyboard.Keys.TAB);

    cy
      .focused()
      .should('have.class', 'js-save')
      .typeEnter();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data).to.be.null;
        expect(data.id).to.not.be.null;
        expect(data.attributes.name).to.equal('Test Name');
        expect(data.attributes.details).to.equal('Test\n Details');
        expect(data.attributes.published_at).to.be.null;
        expect(data.attributes.archived_at).to.be.null;
        expect(data.attributes.behavior).to.equal('standard');
        expect(data.attributes.days_until_due).to.be.null;
      });

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .contains('Test Name');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
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

    cy
      .get('.sidebar')
      .find('.js-menu')
      .click();

    cy
      .intercept('DELETE', `/api/program-actions/${ testProgramAction.id }*`, {
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
      .as('routeDeleteActionFail');

    cy
      .get('.picklist')
      .contains('Delete Program Action')
      .click();

    cy
      .wait('@routeDeleteActionFail');

    cy
      .get('.alert-box')
      .should('contain', 'Insufficient permissions to delete action');

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .contains('Test Name');

    cy
      .intercept('DELETE', `/api/program-actions/${ testProgramAction.id }*`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteActionSucceed');

    cy
      .get('.sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Delete Program Action')
      .click();

    cy
      .wait('@routeDeleteActionSucceed')
      .itsUrl()
      .its('pathname')
      .should('contain', `api/program-actions/${ testProgramAction.id }`);

    cy
      .get('.table-list__list')
      .find('.table-list__item')
      .contains('Test Name')
      .should('not.exist');

    cy
      .get('.sidebar')
      .should('not.exist');
  });

  specify('display action sidebar', function() {
    const testActionId = uuid();
    const testProgramFlow = getProgramFlow({
      attributes: {
        published_at: null,
      },
      relationships: {
        'program-actions': getRelationship([{ id: testActionId }], 'program-actions'),
      },
    });

    const testProgramAction = getProgramAction({
      id: testActionId,
      attributes: {
        name: 'Name',
        details: 'Details',
        published_at: null,
        archived_at: null,
        behavior: 'standard',
        outreach: 'patient',
        allowed_uploads: [],
        days_until_due: 5,
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        'owner': getRelationship(teamCoordinator),
        'program-flow': getRelationship(testProgramFlow),
      },
    });

    const testForms = [
      getForm(testForm),
      getForm({
        attributes: {
          name: 'B Form',
        },
      }),
      getForm({
        attributes: {
          name: 'A Form',
        },
      }),
    ];

    cy
      .routeTags()
      .routeForm()
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;

        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = [
          testProgramAction,
          getProgramAction({
            relationships: {
              'program-flow': getRelationship(testProgramFlow),
            },
          }),
          getProgramAction({
            relationships: {
              'program-flow': getRelationship(testProgramFlow),
            },
          }),
        ];

        return fx;
      })
      .routeProgramAction(fx => {
        fx.data = testProgramAction;

        return fx;
      })
      .routePrograms()
      .routeProgramByProgramFlow()
      .routeForms(fx => {
        fx.data = testForms;

        return fx;
      })
      .routeWorkspaces(fx => {
        fx.data = [
          getWorkspace({
            relationships: {
              'forms': getRelationship(testForms),
            },
          }, { id: workspaceOne.id }),
          getWorkspace({
            relationships: {
              'forms': getRelationship([]),
            },
          }, { id: workspaceTwo.id }),
        ];

        return fx;
      })
      .visit(`/program-flow/${ testProgramFlow.id }`)
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramFlow');

    cy
      .get('.program-flow__list')
      .contains('Name')
      .click();

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .clear();

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .should('be.disabled');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .type('testing name');

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .clear();

    cy
      .intercept('PATCH', `/api/program-actions/${ testProgramAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Save')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships).to.not.exist;
        expect(data.id).to.equal(testProgramAction.id);
        expect(data.attributes.name).to.equal('testing name');
        expect(data.attributes.details).to.equal('');
        expect(data.attributes.published_at).to.not.exist;
        expect(data.attributes.archived_at).to.not.exist;
        expect(data.attributes.behavior).to.not.exist;
        expect(data.attributes.days_until_due).to.not.exist;
      });

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .type('cancel this text');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Cancel')
      .click();

    cy
      .get('.sidebar')
      .find('[data-name-region] .js-input')
      .should('have.value', 'testing name');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-published-region] button')
      .contains('Off')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.published_at).to.not.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-published-region] button')
      .contains('On')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.published_at).to.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-archived-region] button')
      .contains('Off')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.archived_at).to.not.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-archived-region] button')
      .contains('On')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.archived_at).to.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-behavior-region]')
      .contains('Standard')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .should('contain', 'Standard')
      .next()
      .should('contain', 'Conditional')
      .next()
      .should('contain', 'Automated')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.behavior).to.equal('automated');
      });

    cy
      .get('.sidebar')
      .find('[data-behavior-region] button')
      .should('contain', 'Automated');

    cy
      .get('.program-flow__list')
      .find('.is-selected')
      .find('[data-behavior-region] button')
      .find('svg')
      .should('have.class', 'fa-bolt');

    cy
      .get('.sidebar')
      .find('[data-owner-region]')
      .contains('Coordinator')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Nurse')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
        expect(data.relationships.owner.data.type).to.equal(teamNurse.type);
      });

    cy
      .get('.sidebar')
      .find('[data-owner-region]')
      .contains('Nurse')
      .click();

    cy
      .get('.picklist')
      .find('.js-clear')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data).to.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-due-region]')
      .contains('5 days')
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
      .get('.sidebar')
      .find('[data-due-region]')
      .contains('Same Day')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Selection')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.days_until_due).to.be.null;
      });

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .contains('Add Form...')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('contain', 'A Form')
      .next()
      .should('contain', 'B Form')
      .next()
      .should('contain', 'Test Form')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.form.data.id).to.equal(testForm.id);
      });

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Selection')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.form.data).to.be.null;
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
      .get('.sidebar')
      .find('[data-form-region]')
      .contains('Add Form...')
      .click();

    cy
      .get('.picklist')
      .contains('Test Form')
      .click();

    cy
      .navigate(`/program-flow/${ testProgramFlow.id }`, 'two')
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramFlow');

    cy
      .get('.program-flow__list')
      .contains('Name')
      .click();

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'No Available Forms');

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
      .should('exist');
  });

  specify('display action sidebar with no workspace forms', function() {
    cy
      .routeTags()
      .routeProgramAction()
      .routeProgramActions()
      .routeProgramFlows(() => [])
      .routeProgram()
      .routeWorkspaces(fx => {
        fx.data[0] = getWorkspace({
          relationships: {
            'forms': getRelationship([]),
          },
        }, { id: workspaceOne.id });

        return fx;
      })
      .visit('/program/1/action/1')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows')
      .wait('@routeProgramAction')
      .wait('@routeProgram');

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .contains('Add Form...')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'No Available Forms');
  });

  specify('deleted action', function() {
    cy
      .routeTags()
      .routeProgram()
      .routeProgramActions()
      .routeProgramFlows(() => [])
      .intercept('GET', '/api/program-actions/1', {
        statusCode: 404,
        body: {
          errors: getErrors([{
            status: '404',
            title: 'Not Found',
            detail: 'Cannot find action',
            source: { parameter: 'actionId' },
          }]),
        },
      })
      .as('routeProgramAction')
      .visit('/program/1/action/1')
      .wait('@routeProgram')
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows')
      .wait('@routeProgramAction');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .get('.sidebar')
      .should('not.exist');
  });

  specify('enable/disable attachment uploads', function() {
    const testActionId = uuid();
    const testProgramFlow = getProgramFlow({
      relationships: {
        'program-actions': getRelationship([{ id: testActionId }], 'program-actions'),
      },
    });

    const testProgramAction = getProgramAction({
      id: testActionId,
      attributes: {
        name: 'Name',
        details: 'Details',
        published_at: testTs(),
        behavior: 'standard',
        outreach: null,
        allowed_uploads: [],
        days_until_due: 5,
        created_at: testTs(),
        updated_at: testTs(),
      },
      relationships: {
        'owner': getRelationship(teamCoordinator),
        'program-flow': getRelationship(testProgramFlow),
      },
    });

    cy
      .routeSettings('upload_attachments', true)
      .routeTags()
      .routeProgramFlow(fx => {
        fx.data = testProgramFlow;
        return fx;
      })
      .routeProgramFlowActions(fx => {
        fx.data = [testProgramAction];

        return fx;
      })
      .routeProgramAction(fx => {
        fx.data = testProgramAction;

        return fx;
      })
      .routeProgramByProgramFlow()
      .routeForms()
      .visit(`/program-flow/${ testProgramFlow.id }`)
      .wait('@routeProgramFlowActions')
      .wait('@routeProgramFlow');

    cy
      .intercept({
        method: 'PATCH',
        url: `api/program-actions/${ testProgramAction.id }`,
      }, { statusCode: 204 })
      .as('routePatchAction');

    cy
      .get('.program-flow__list')
      .contains('Name')
      .click();

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .contains('Enable Attachment Uploads')
      .should('not.be.disabled')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.allowed_uploads).to.eql(['pdf']);
      });

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .contains('Enable Attachment Uploads')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .contains('Disable Uploads')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.allowed_uploads).to.eql([]);
      });

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .contains('Enable Attachment Uploads')
      .should('exist');

    cy
      .get('.sidebar')
      .find('[data-allow-uploads-region]')
      .contains('Disable Uploads')
      .should('not.exist');
  });

  specify('admin tags', function() {
    const testProgram = getProgram();

    const testProgramAction = getProgramAction({
      attributes: {
        tags: ['test-tag'],
      },
      relationships: {
        'program': getRelationship(testProgram),
      },
    });

    cy
      .routeTags()
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            'role': getRelationship(roleAdmin),
          },
        });

        return fx;
      })
      .routeProgramAction(fx => {
        fx.data = testProgramAction;

        return fx;
      })
      .routeProgramActions()
      .routeProgramFlows()
      .routeProgram()
      .visit(`/program/${ testProgram.id }/action/${ testProgramAction.id }`)
      .wait('@routeProgramActions')
      .wait('@routeProgramFlows')
      .wait('@routeProgramAction')
      .wait('@routeProgram');

    cy
      .intercept({
        method: 'PATCH',
        url: `api/program-actions/${ testProgramAction.id }`,
      }, { statusCode: 204 })
      .as('routePatchAction');

    cy
      .get('.sidebar')
      .find('[data-tags-region]')
      .contains('Add Tag')
      .click();

    cy
      .get('.picklist')
      .contains('foo-tag')
      .click()
      .wait('@routePatchAction')
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
      .wait('@routePatchAction')
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
      .wait('@routePatchAction')
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
