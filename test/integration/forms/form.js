import { v5 as uuid } from 'uuid';

import { getRelationship, getErrors } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getCurrentClinician, getClinician } from 'support/api/clinicians';
import { getPatient } from 'support/api/patients';
import { getPatientField } from 'support/api/patient-fields';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { getFormFields } from 'support/api/form-fields';
import { getForm, testForm } from 'support/api/forms';

const testPatient = getPatient();

function getTestPatientField(name, value) {
  return getPatientField({
    id: uuid(`resource:field:${ name }`, testPatient.id),
    attributes: { name, value },
  });
}

context('Noncontext Form', function() {
  beforeEach(function() {
    cy
      .routeWorkspacePatient()
      .routesForDefault();
  });

  specify('getClinicians', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        team: getRelationship(teamCoordinator),
      },
    });

    const testAction = getAction({
      relationships: {
        form: getRelationship(testForm),
      },
    });

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [
          currentClinician,
          getClinician({
            id: '2',
            attributes: {
              name: 'Team Member',
            },
            relationships: {
              team: getRelationship(teamCoordinator),
            },
          }),
          getClinician({
            id: '3',
            attributes: {
              name: 'Non Team Member',
            },
            relationships: {
              team: getRelationship(teamNurse),
            },
          }),
        ];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition(fx => {
        return {
          display: 'form',
          components: [
            {
              label: 'All Clinicians',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: 'values = getClinicians();',
              },
              template: '<span>{{ item.name }}</span>',
              refreshOn: 'data',
              key: 'select',
              type: 'select',
              input: true,
            },
            {
              label: 'Team Clinicians',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: `values = getClinicians({ teamId: ${ teamCoordinator.id } });`,
              },
              template: '<span>{{ item.name }}</span>',
              refreshOn: 'data',
              key: 'select',
              type: 'select',
              input: true,
            },
          ],
        };
      })
      .routeFormActionFields()
      .routeLatestFormResponse()
      .routeActionActivity()
      .routePatientByAction(fx => {
        fx.data = getPatient({
          attributes: { first_name: 'Testin' },
        });

        return fx;
      })
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .first()
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .should('have.length', 3)
      .first()
      .click();

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .last()
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .should('not.contain', 'Non Team Member')
      .should('have.length', 2);
  });

  specify('getDirectory', function() {
    const testAction = getAction({
      relationships: {
        form: getRelationship(testForm),
      },
    });

    cy
      .intercept('GET', '/api/directory/foo*', {
        body: { data: getTestPatientField('foo', ['one', 'two']) },
      })
      .as('routeDirectoryFoo')
      .intercept('GET', '/api/directory/bar*', {
        statusCode: 400,
        body: { data: getTestPatientField('bar', ['bar', 'baz']) },
      })
      .as('routeDirectoryBar')
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition(fx => {
        return {
          display: 'form',
          components: [
            {
              label: 'Select Foo',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: 'values = getDirectory(\'foo\', { filter: { foo: \'bar\' }})',
              },
              template: '<span>{{ item }}</span>',
              refreshOn: 'data',
              key: 'select',
              type: 'select',
              input: true,
            },
            {
              label: 'Select Bar',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: `
                  values = getDirectory(\'bar\', { filter: { foo: \'bar\' }})
                    .catch(e => {
                      return ['bar', 'error'];
                    })
                `,
              },
              template: '<span>{{ item }}</span>',
              refreshOn: 'data',
              key: 'select2',
              type: 'select',
              input: true,
            },
          ],
        };
      })
      .routeFormActionFields()
      .routeLatestFormResponse()
      .routeActionActivity()
      .routePatientByAction(fx => {
        fx.data = getPatient({
          attributes: { first_name: 'Testin' },
        });

        return fx;
      })
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .wait('@routeDirectoryBar')
      .wait('@routeDirectoryFoo')
      .itsUrl()
      .should(({ search, pathname }) => {
        expect(search).to.contain('?filter[foo]=bar');
        expect(pathname).to.equal('/api/directory/foo');
      });

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .first()
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .first()
      .should('contain', 'one')
      .next()
      .should('contain', 'two')
      .click();

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .last()
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .first()
      .should('contain', 'bar')
      .next()
      .should('contain', 'error');
  });

  specify('update patient field', { retries: 4 }, function() {
    const errors = getErrors();

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientField(fx => {
        fx.data = getTestPatientField('foo', [1, 2]);
        return fx;
      }, 'foo')
      .intercept('GET', `/api/patients/${ testPatient.id }/fields/bar`, {
        statusCode: 400,
        body: { errors },
      })
      .as('routePatientFieldbar')
      .intercept('PATCH', `/api/patients/${ testPatient.id }/fields/foo`, {
        body: { data: getTestPatientField('bar', ['one', 'two']) },
      })
      .as('routePatchPatientFieldFoo')
      .intercept('PATCH', `/api/patients/${ testPatient.id }/fields/bazinga`, {
        body: { data: getTestPatientField('bazinga', ['one', 'two']) },
      })
      .as('routePatchPatientFieldBazinga')
      .intercept('PATCH', `/api/patients/${ testPatient.id }/fields/bar`, {
        statusCode: 400,
        body: { errors },
      })
      .as('routePatchPatientFieldBar')
      .routeFormDefinition(fx => {
        return {
          display: 'form',
          components: [
            {
              label: 'Test Get Field',
              action: 'custom',
              key: 'test1',
              type: 'button',
              input: true,
              custom: `
                getField('foo')
                  .then(value => {
                    data.opts = value;
                  });
              `,
            },
            {
              label: 'Test Get Error',
              action: 'custom',
              key: 'test2',
              type: 'button',
              input: true,
              custom: `
                getField('bar')
                  .catch(value => {
                    data.opts = ['error'];
                  });
              `,
            },
            {
              label: 'Test Update Field',
              action: 'custom',
              key: 'test3',
              type: 'button',
              input: true,
              custom: `
                updateField('foo', ['one', 'two'])
                  .then(value => {
                    data.opts = value;
                  });
              `,
            },
            {
              label: 'Test Update Error',
              action: 'custom',
              key: 'test4',
              type: 'button',
              input: true,
              custom: `
                updateField('bar', ['one', 'two'])
                  .catch(value => {
                    data.opts = ['error1', 'error2'];
                  });
              `,
            },
            {
              label: 'Test Create Field',
              action: 'custom',
              key: 'test5',
              type: 'button',
              input: true,
              custom: `
                updateField('bazinga', ['one', 'two'])
                  .then(value => {
                    data.opts = value;
                  });
              `,
            },
            {
              label: 'Select Foo',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: 'values = data.opts',
              },
              template: '<span>{{ item }}</span>',
              refreshOn: 'data',
              key: 'select',
              type: 'select',
              input: true,
            },
          ],
        };
      })
      .routeLatestFormResponse()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormFields')
      .wait('@routeFormDefinition');

    // NOTE: .wait(100) account for form.io data delays

    cy
      .iframe()
      .find('button')
      .contains('Test Get Field')
      .click()
      .wait('@routePatientFieldfoo')
      .wait(100);

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .should('contain', '1')
      .should('contain', '2')
      .first()
      .click();

    cy
      .iframe()
      .find('button')
      .contains('Test Get Error')
      .click()
      .wait('@routePatientFieldbar')
      .wait(100);

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .should('contain', 'error')
      .first()
      .click();

    cy
      .iframe()
      .find('button')
      .contains('Test Update Field')
      .click()
      .wait('@routePatchPatientFieldFoo')
      .its('request.body.data')
      .then(data => {
        expect(data.id).to.equal(uuid('resource:field:foo', testPatient.id));
        expect(data.attributes.name).to.equal('foo');
        expect(data.attributes.value).to.deep.equal(['one', 'two']);
      })
      .wait(100);

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .should('contain', 'one')
      .should('contain', 'two')
      .first()
      .click();

    cy
      .iframe()
      .find('button')
      .contains('Test Update Error')
      .click()
      .wait('@routePatchPatientFieldBar')
      .its('request.body.data.id')
      .should('equal', uuid('resource:field:bar', testPatient.id))
      .wait(100);

    cy
      .iframe()
      .find('button')
      .contains('Test Create Field')
      .click()
      .wait('@routePatchPatientFieldBazinga')
      .its('request.body.data.id')
      .should('equal', uuid('resource:field:bazinga', testPatient.id))
      .wait(100);

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .should('contain', 'error')
      .first()
      .click();
  });

  specify('getIcd', function() {
    const errors = getErrors();

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .intercept('POST', '/api/graphql', {
        body: {
          data: {
            icdCodes: [
              {
                code: 'X1',
                description: 'Typhoid infection',
                hcc_v24: null,
                hcc_v28: null,
                isSpecific: false,
                parent: null,
                children: [
                  {
                    code: 'X3',
                    description: 'Typhoid fever',
                  },
                ],
              },
            ],
          },
        },
      })
      .as('routeGetIcdCode')
      .routeFormDefinition(fx => {
        return {
          display: 'form',
          components: [
            {
              label: 'Test Get Icd Code deprecated API',
              action: 'custom',
              key: 'test1',
              type: 'button',
              input: true,
              custom: `
                getIcd('X1', 2024)
                  .then(value => {
                    data.opts = [value[0].description];
                  });
              `,
            },
            {
              label: 'Test Get Icd Code',
              action: 'custom',
              key: 'test1',
              type: 'button',
              input: true,
              custom: `
                getIcd({ term: 'X1', year: 2024 })
                  .then(value => {
                    data.opts = [value[0].description];
                  });
              `,
            },
            {
              label: 'Test Get Icd Code Error',
              action: 'custom',
              key: 'test1',
              type: 'button',
              input: true,
              custom: `
                getIcd({ term: 'X1', year: 2024 })
                  .catch(e => {
                    data.opts = ['Error'];
                  });
              `,
            },
            {
              label: 'Select Icd Code',
              widget: 'choicesjs',
              tableView: true,
              dataSrc: 'custom',
              data: {
                custom: 'values = data.opts',
              },
              template: '<span>{{ item }}</span>',
              refreshOn: 'data',
              key: 'select',
              type: 'select',
              input: true,
            },
          ],
        };
      })
      .routeLatestFormResponse()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormFields')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('button')
      .contains('Test Get Icd Code')
      .click()
      .wait('@routeGetIcdCode')
      .wait(100);

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .first()
      .should('contain', 'Typhoid infection');

    cy
      .intercept('POST', '/api/graphql', {
        statusCode: 400,
        body: {
          data: { errors },
        },
      })
      .as('routeGetIcdCodeError');

    cy
      .iframe()
      .find('button')
      .contains('Test Get Icd Code Error')
      .click()
      .wait('@routeGetIcdCodeError')
      .wait(100);

    cy
      .iframe()
      .find('.formio-component-select .dropdown')
      .click();

    cy
      .iframe()
      .find('.choices__list--dropdown.is-active')
      .find('.choices__item--selectable')
      .first()
      .should('contain', 'Error');
  });

  specify('form scripts and reducers', { retries: 4 }, function() {
    const testScriptReducerForm = getForm({
      attributes: {
        options: {
          context: [
            'return { foo() { return \'foo\'; } }',
          ],
          reducers: [
            'formSubmission.storyTime = foo()\nreturn formSubmission',
          ],
        },
      },
    });

    cy
      .intercept('GET', '/appconfig.json', {
        body: { versions: { frontend: 'foo' } },
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testScriptReducerForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testScriptReducerForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormFields')
      .wait('@routeFormDefinition');

    cy
      .iframe()
      .find('textarea[name="data[storyTime]"]')
      .should('contain', 'foo');
  });

  specify('form reducer error', function() {
    const testReducerErrorForm = getForm({
      attributes: {
        options: {
          reducers: [
            'syntaxError(\'foo;',
          ],
        },
      },
    });

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testReducerErrorForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testReducerErrorForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm');

    // App root is rendered
    cy
      .iframe()
      .find('.app-root');

    cy
      .get('iframe')
      .its('0.contentWindow.console')
      .then(console => {
        cy
          .stub(console, 'error')
          .as('consoleError');

        // Query for the iframe body to ensure it's loaded
        cy
          .wait('@routeFormFields')
          .iframe()
          .find('textarea[name="data[familyHistory]"]');

        cy
          .get('@consoleError')
          .should('be.calledOnce');
      });
  });

  specify('form beforeSubmit error', function() {
    const testBeforeSubmitErrorForm = getForm({
      attributes: {
        options: {
          beforeSubmit: 'syntaxError(\'foo;',
        },
      },
    });

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testBeforeSubmitErrorForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testBeforeSubmitErrorForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormFields')
      .wait('@routeFormDefinition');

    cy
      .get('iframe')
      .its('0.contentWindow')
      .should('not.be.empty')
      .then(win => {
        cy
          .stub(win.console, 'error')
          .as('consoleError');

        cy
          .iframe()
          .find('textarea[name="data[familyHistory]"]')
          .type('familyHistory');

        cy
          .iframe()
          .find('textarea[name="data[storyTime]"]')
          .type('storyTime');
      });

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .click();

    cy
      .iframe()
      .find('.alert')
      .contains('Failed to submit form. Please try again.');

    cy
      .get('@consoleError')
      .should('be.calledTwice');
  });

  specify('form submitReducer error', function() {
    const testSubmitReducerErrorForm = getForm({
      attributes: {
        options: {
          submitReducers: [
            'syntaxError(\'foo;',
          ],
        },
      },
    });

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testSubmitReducerErrorForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testSubmitReducerErrorForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormFields')
      .wait('@routeFormDefinition');

    cy
      .get('iframe')
      .its('0.contentWindow')
      .should('not.be.empty')
      .then(win => {
        cy
          .stub(win.console, 'error')
          .as('consoleError');

        cy
          .iframe()
          .find('textarea[name="data[familyHistory]"]')
          .type('familyHistory');

        cy
          .iframe()
          .find('textarea[name="data[storyTime]"]')
          .type('storyTime');
      });

    cy
      .get('.form__controls')
      .find('.js-save-button')
      .click();

    cy
      .iframe()
      .find('.alert')
      .contains('Failed to submit form. Please try again.');

    cy
      .get('@consoleError')
      .should('be.called');
  });

  specify('duplicate form services', function() {
    cy
      .routesForPatientAction()
      .intercept('GET', '/api/forms/**/fields*', {
        delay: 2000,
        body: { data: {} },
      })
      .as('routeFormFieldsFirst');

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .visit(`/patient/${ testPatient.id }/form/${ testForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm')
      .wait('@routeFormDefinition');

    cy
      .get('.js-dashboard')
      .click();

    cy
      .routeFormFields(fx => {
        fx.data = getFormFields({
          attributes: {
            fields: {
              foo: 'bar',
            },
          },
        });

        return fx;
      });

    cy
      .go('back');

    cy
      .wait('@routeFormFields')
      .wait('@routeFormFieldsFirst');

    cy
      .iframe()
      .find('[name="data[fields.foo]"]')
      .should('have.value', 'bar');
  });
});
