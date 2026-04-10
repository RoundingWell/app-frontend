import { getRelationship, getErrors } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getCurrentClinician, getClinician } from 'support/api/clinicians';
import { getPatient } from 'support/api/patients';
import { getPatientField, getPatientFieldId } from 'support/api/patient-fields';
import { teamCoordinator, teamNurse } from 'support/api/teams';
import { getFormFields } from 'support/api/form-fields';
import { getForm, testForm } from 'support/api/forms';

const testPatient = getPatient();

function getTestPatientField(name, value) {
  return getPatientField({
    attributes: { name, value },
    relationships: {
      patient: getRelationship(testPatient),
    },
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
            attributes: {
              name: 'Team Member',
            },
            relationships: {
              team: getRelationship(teamCoordinator),
            },
          }),
          getClinician({
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
      .routeFormDefinition()
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
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:clinicians', {});
      })
      .should('have.length', 3);

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:clinicians', { teamId: teamCoordinator.id });
      })
      .should('have.length', 2)
      .invoke('map', clinician => clinician.name)
      .should('not.include', 'Non Team Member');
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
      .routeFormDefinition()
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
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:directory', { directoryName: 'foo', query: { filter: { foo: 'bar' } } });
      })
      .should('deep.equal', ['one', 'two']);

    cy
      .wait('@routeDirectoryFoo')
      .itsUrl()
      .should(({ search, pathname }) => {
        expect(search).to.contain('?filter[foo]=bar');
        expect(pathname).to.equal('/api/directory/foo');
      });

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:directory', { directoryName: 'bar', query: { filter: { foo: 'bar' } } })
          .then(() => ({ error: false }), () => ({ error: true }));
      })
      .should('deep.equal', { error: true });

    cy
      .wait('@routeDirectoryBar')
      .itsUrl()
      .should(({ search, pathname }) => {
        expect(search).to.contain('?filter[foo]=bar');
        expect(pathname).to.equal('/api/directory/bar');
      });
  });

  specify('getPatientsBy - identifier', function() {
    const testAction = getAction({
      relationships: {
        form: getRelationship(testForm),
      },
    });

    cy
      .intercept('GET', '/api/patients?filter*', {
        body: { data: [getPatient({ attributes: { first_name: 'Test', last_name: 'Patient' } })] },
      })
      .as('routeGetPatientsByIdentifier')
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .routeActionActivity()
      .routePatientByAction()
      .visit(`/patient-action/${ testAction.id }/form/${ testForm.id }`)
      .wait('@routeFormByAction')
      .wait('@routeAction')
      .wait('@routePatientByAction')
      .wait('@routeFormDefinition');

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:patientsBy', { type: 'MRN', identifier: '123456' });
      })
      .should('have.length', 1)
      .its('0')
      .should('include', { first_name: 'Test', last_name: 'Patient' });

    cy
      .wait('@routeGetPatientsByIdentifier')
      .itsUrl()
      .should(({ search }) => {
        expect(search).to.contain('filter[type]=MRN');
        expect(search).to.contain('filter[identifier]=123456');
      });
  });

  specify('update patient field', function() {
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
      .routePatientFieldHistory(fx => {
        fx.data = {
          attributes: {
            values: [
              {
                value: [3, 4],
              },
              {
                value: [1, 2],
              },
            ],
          },
        };
        return fx;
      }, 'foo')
      .routePatientFieldHistory(fx => {
        fx.data = {
          attributes: { values: [{ value: [5, 6] }] },
        };
        return fx;
      }, 'bar')
      .intercept('GET', `/api/patients/${ testPatient.id }/fields/bar`, {
        statusCode: 400,
        body: { errors },
      })
      .as('routePatientFieldbar')
      .intercept('PATCH', `/api/patients/${ testPatient.id }/fields/foo`, {
        body: { data: getTestPatientField('foo', ['one', 'two']) },
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
      .routeFormDefinition()
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
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:field', { fieldName: 'foo' });
      })
      .should('deep.equal', [1, 2]);

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:fieldHistory', { fieldName: 'foo', limit: 10, sort: 'newest' });
      })
      .should('have.length', 2);

    cy
      .wait('@routePatientFieldfooHistory')
      .its('request.query')
      .then(data => {
        expect(data.page.limit).to.equal('10');
        expect(data.sort).to.equal('newest');
      });

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:fieldHistory', { fieldName: 'bar', limit: 2, sort: 'oldest' });
      })
      .its('0.value')
      .should('deep.equal', [5, 6]);

    cy
      .wait('@routePatientFieldbarHistory')
      .its('request.query')
      .then(data => {
        expect(data.page.limit).to.equal('2');
        expect(data.sort).to.equal('oldest');
      });

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('fetch:field', { fieldName: 'bar' })
          .then(() => ({ error: false }), () => ({ error: true }));
      })
      .should('deep.equal', { error: true });

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('update:field', { fieldName: 'foo', value: ['one', 'two'] });
      })
      .should('deep.equal', ['one', 'two']);

    cy
      .wait('@routePatchPatientFieldFoo')
      .its('request.body.data')
      .then(data => {
        expect(data.id).to.equal(getPatientFieldId(testPatient.id, 'foo'));
        expect(data.attributes.name).to.equal('foo');
        expect(data.attributes.value).to.deep.equal(['one', 'two']);
      });

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('update:field', { fieldName: 'bar', value: ['one', 'two'] })
          .then(() => ({ error: false }), () => ({ error: true }));
      })
      .should('deep.equal', { error: true });

    cy
      .wait('@routePatchPatientFieldBar')
      .its('request.body.data.id')
      .should('equal', getPatientFieldId(testPatient.id, 'bar'));

    cy
      .iframeStub()
      .then(iframeStub => {
        return iframeStub.request('update:field', { fieldName: 'bazinga', value: ['one', 'two'] });
      })
      .should('deep.equal', ['one', 'two']);

    cy
      .wait('@routePatchPatientFieldBazinga')
      .its('request.body.data.id')
      .should('equal', getPatientFieldId(testPatient.id, 'bazinga'));
  });

  specify('form custom url', { retries: 4 }, function() {
    const testCustomForm = getForm({
      attributes: {
        url: '/images/roundingwell-logo.svg',
      },
    });

    cy
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeForm(fx => {
        fx.data = testCustomForm;

        return fx;
      })
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .visit(`/patient/${ testPatient.id }/form/${ testCustomForm.id }`)
      .wait('@routePatient')
      .wait('@routeForm');

    cy
      .get('iframe')
      .should('have.attr', 'src', '/images/roundingwell-logo.svg');
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
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response, 'fetch:form:data response').to.exist;
        expect(response.args.value.formData.fields.foo).to.equal('bar');
      });
  });
});
