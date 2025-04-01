import _ from 'underscore';
import dayjs from 'dayjs';

import formatDate from 'helpers/format-date';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getResource, getRelationship } from 'helpers/json-api';

import { workspaceOne, getWorkspace } from 'support/api/workspaces';
import { getWorkspacePatient } from 'support/api/workspace-patients';
import { getPatient } from 'support/api/patients';
import { getCurrentClinician } from 'support/api/clinicians';
import { roleAdmin, roleEmployee } from 'support/api/roles';
import { getForm, testForm } from 'support/api/forms';

context('patient sidebar', function() {
  specify('display patient data', function() {
    const dob = testDateSubtract(10, 'years');

    const testPatient = getPatient({
      attributes: {
        first_name: 'First',
        last_name: 'Last',
        birth_date: dob,
        sex: 'f',
        identifiers: [
          {
            type: 'mrn',
            value: 'A5432112345',
          },
        ],
      },
    });

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

    const testReadOnlyForm = getForm({
      attributes: {
        options: {
          read_only: true,
        },
      },
    });

    const testReportForm = getForm({
      attributes: {
        options: {
          is_report: true,
        },
      },
    });

    cy
      .routesForPatientDashboard()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .routeForm(fx => {
        fx.data = testScriptReducerForm;

        return fx;
      })
      .routeWidgetValues(fx => {
        fx.values = {
          sex: 'f',
          emptyField: null,
        };

        return fx;
      })
      .routeSettings(fx => {
        fx.data = [{
          id: 'widgets_patient_sidebar',
          attributes: {
            value: {
              widgets: [
                'dob',
                'sex',
                'status',
                'divider',
                'workspaces',
                'divider',
                'formWidget',
                'formModalWidget',
                'readOnlyFormModalWidget',
                'reportFormModalWidget',
                'formModalWidgetSmall',
                'formModalWidgetLarge',
                'patientMRNIdentifier',
                'patientSSNIdentifier',
                'hbsWidget',
                'hbsEmptyWidget',
                'hbsNoRegionWidget',
                'hbsEmptyTemplateWidget',
              ],
            },
          },
        }];

        return fx;
      })
      .routeWidgets(fx => {
        const addWidget = _.partial(getResource, _, 'widgets');

        fx.data = fx.data.concat([
          addWidget({
            slug: 'formWidget',
            category: 'formWidget',
            definition: {
              display_name: 'Form',
              form_id: testForm.id,
              form_name: 'Test Form',
            },
          }),
          addWidget({
            slug: 'formModalWidget',
            category: 'formWidget',
            definition: {
              display_name: 'Modal Form',
              form_id: testScriptReducerForm.id,
              form_name: 'Test Modal Form',
              is_modal: true,
            },
          }),
          addWidget({
            slug: 'readOnlyFormModalWidget',
            category: 'formWidget',
            definition: {
              display_name: 'Modal Read Only Form',
              form_id: testReadOnlyForm.id,
              form_name: 'Test Modal Read Only Form',
              is_modal: true,
            },
          }),
          addWidget({
            slug: 'reportFormModalWidget',
            category: 'formWidget',
            definition: {
              display_name: 'Modal Report Form',
              form_id: testReportForm.id,
              form_name: 'Test Modal Report Form',
              is_modal: true,
            },
          }),
          addWidget({
            slug: 'formModalWidgetSmall',
            category: 'formWidget',
            definition: {
              display_name: 'Modal Form',
              form_id: testForm.id,
              form_name: 'Test Modal Form Small',
              is_modal: true,
              modal_size: 'small',
            },
          }),
          addWidget({
            slug: 'formModalWidgetLarge',
            category: 'formWidget',
            definition: {
              display_name: 'Modal Form',
              form_id: testForm.id,
              form_name: 'Test Modal Form Large',
              is_modal: true,
              modal_size: 'large',
            },
          }),
          addWidget({
            slug: 'patientMRNIdentifier',
            category: 'patientIdentifiers',
            definition: {
              display_name: 'Patient Identifier',
              identifier_type: 'mrn',
            },
          }),
          addWidget({
            slug: 'patientSSNIdentifier',
            category: 'patientIdentifiers',
            definition: {
              default_html: 'No Identifier Found',
              display_name: 'Patient Identifier With Empty Value',
              identifier_type: 'ssn',
            },
          }),
          addWidget({
            slug: 'hbsWidget',
            category: 'widget',
            definition: {
              template: `
                <hr>
                <div>{{far "calendar-days"}}Sex: <b>{{ sex }}</b></div>
                <hr>
              `,
              display_name: 'Template',
            },
            values: {
              sex: '@patient.sex',
            },
          }),
          addWidget({
            slug: 'hbsEmptyWidget',
            category: 'widget',
            definition: {
              template: '{{ emptyField }}',
              display_name: 'Template - Empty Widget Value',
            },
            values: {
              emptyField: '@patient.emptyField',
            },
          }),
          addWidget({
            slug: 'hbsNoRegionWidget',
            category: 'widget',
            definition: {
              template: 'Content that will not appear because the region is missing',
              // Missing <div data-content-region> on purpose
              wrapperTemplate: '<div class="no-region-wrapper">No region defined</div>',
            },
          }),
          addWidget({
            slug: 'hbsEmptyTemplateWidget',
            category: 'widget',
            definition: {
              template: 'Should be display:none',
              // Missing <div data-content-region> on purpose
              wrapperTemplate: '{{#if foo}}not foo{{/if}}',
            },
          }),
        ]);

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      });

    cy
      .routeWorkspacePatient(fx => {
        fx.data = getWorkspacePatient({
          attributes: {
            status: 'active',
          },
        });

        return fx;
      });

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routePrograms')
      .wait('@routeWidgets');

    cy
      .wait('@routeForm')
      .itsUrl()
      .its('pathname')
      .should('contain', testScriptReducerForm.id);

    cy
      .wait('@routeWidgetValues')
      .itsUrl()
      .then(({ pathname, search }) => {
        expect(pathname).to.contain('hbsWidget');
        expect(search).to.contain(`filter[patient]=${ testPatient.id }`);
      });

    cy
      .get('.patient-sidebar')
      .as('patientSidebar')
      .should('contain', 'First Last')
      .find('.patient-sidebar__section')
      .first()
      .should('contain', formatDate(dob, 'LONG'))
      .should('contain', `Age ${ dayjs(testDate()).diff(dob, 'years') }`)
      .next()
      .should('contain', 'Sex')
      .should('contain', 'Female')
      .next()
      .should('contain', 'Status')
      .find('.widgets__status-active')
      .should('contain', 'Active')
      .parents('.patient-sidebar__section')
      .next()
      .find('.widgets__divider')
      .parents('.patient-sidebar__section')
      .next()
      .should('contain', 'Workspaces')
      .next()
      .find('.widgets__divider')
      .parents('.patient-sidebar__section')
      .next()
      .should('contain', 'Form')
      .find('.widgets__form-widget')
      .should('contain', 'Test Form')
      .parents('.patient-sidebar__section')
      .next()
      .should('contain', 'Modal Form')
      .find('.widgets__form-widget')
      .should('contain', 'Test Modal Form')
      .parents('.patient-sidebar__section')
      .next()
      .should('contain', 'Modal Read Only Form')
      .find('.widgets__form-widget')
      .should('contain', 'Test Modal Read Only Form')
      .parents('.patient-sidebar__section')
      .next()
      .should('contain', 'Modal Report Form')
      .find('.widgets__form-widget')
      .should('contain', 'Test Modal Report Form')
      .parents('.patient-sidebar__section')
      .next()
      .find('.widgets__form-widget')
      .should('contain', 'Test Modal Form Small')
      .parents('.patient-sidebar__section')
      .next()
      .find('.widgets__form-widget')
      .should('contain', 'Test Modal Form Large')
      .parents('.patient-sidebar__section')
      .next()
      .should('contain', 'Patient Identifier')
      .should('contain', 'A5432112345')
      .next()
      .should('contain', 'Patient Identifier With Empty Value')
      .should('contain', 'No Identifier Found')
      .next()
      .should('contain', 'Template')
      .should('contain', 'Sex: f');

    // verifies that the ::before content ('-') is shown for empty widget values
    cy
      .get('@patientSidebar')
      .find('.patient-sidebar__section')
      .contains('Template - Empty Widget Value')
      .next()
      .find('.widgets-value')
      .hasBeforeContent('–');

    cy
      .get('@patientSidebar')
      .find('.no-region-wrapper')
      .should('contain', 'No region defined')
      .parent()
      .next('.patient-sidebar__section')
      .should('have.css', 'display', 'none');

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form')
      .click();

    cy
      .get('.modal')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .wait('@routeFormDefinition');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 403,
        delay: 300,
        body: {
          errors: [
            {
              id: '1',
              status: 403,
              title: 'Forbidden',
              detail: 'Insufficient permissions',
            },
          ],
        },
      })
      .as('postFormResponse');

    cy
      .iframe()
      .as('iframe');

    cy
      .get('@iframe')
      .find('textarea[name="data[familyHistory]"]')
      .clear()
      .type('New typing');

    cy
      .get('@iframe')
      .find('textarea[name="data[storyTime]"]')
      .should('contain', 'foo')
      .clear()
      .type('New typing');

    cy
      .get('.modal')
      .find('.js-submit')
      .should('not.be.disabled')
      .click();

    cy
      .get('.modal')
      .find('.js-submit')
      .should('be.disabled')
      .wait('@postFormResponse');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        body: { data: { id: '12345' } },
      })
      .as('postFormResponse');

    cy
      .get('.modal')
      .find('.js-submit')
      .should('not.be.disabled')
      .click()
      .wait('@postFormResponse');

    cy
      .get('.modal')
      .should('not.exist');

    cy
      .routeForm(fx => {
        fx.data = testReadOnlyForm;

        return fx;
      });

    cy
      .get('.patient-sidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Read Only Form')
      .click()
      .wait('@routeForm');

    cy
      .get('@iframe')
      .find('[name="data[fields.foo]"]')
      .should('be.disabled');

    cy
      .get('.modal')
      .find('.modal__footer-actions .js-close')
      .should('not.exist');

    cy
      .get('.modal')
      .find('.modal__footer-actions .js-submit')
      .should('contain', 'Done');

    cy
      .get('.modal')
      .find('.js-close')
      .first()
      .click();

    cy
      .routeForm(fx => {
        fx.data = testReportForm;

        return fx;
      });

    cy
      .get('.patient-sidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Report Form')
      .click()
      .wait('@routeForm');

    cy
      .get('@iframe')
      .find('[name="data[fields.foo]"]')
      .should('be.disabled');

    cy
      .get('.modal')
      .find('.modal__footer-actions .js-close')
      .should('not.exist');

    cy
      .get('.modal')
      .find('.modal__footer-actions .js-submit')
      .should('contain', 'Done');

    cy
      .get('.modal')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form Small')
      .click();

    cy
      .get('.modal')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form Large')
      .click();

    cy
      .get('.modal')
      .find('.js-close')
      .last()
      .click();

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Form')
      .click();

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/form/${ testForm.id }`);
  });

  specify('patient workspaces', function() {
    cy
      .routesForPatientDashboard()
      .visit('/patient/dashboard/1')
      .wait('@routePrograms');

    cy
      .get('.patient-sidebar')
      .contains('Workspaces')
      .next()
      .contains('Workspace One')
      .next()
      .should('contain', 'Workspace Two');

    cy
      .getRadio(Radio => {
        const patient = Radio.request('entities', 'patients:model', '1');
        patient.set({ _workspaces: [{ id: workspaceOne.id }] });
      });

    cy
      .get('.patient-sidebar')
      .contains('Workspaces')
      .next()
      .contains('Workspace One');

    cy
      .get('.patient-sidebar')
      .should('not.contain', 'Workspace Two');
  });

  specify('workspace specific widgets setting', function() {
    cy
      .routesForPatientDashboard()
      .routeWorkspaces(fx => {
        fx.data[0] = getWorkspace({
          attributes: {
            settings: {
              widgets_patient_sidebar: {
                widgets: ['divider'],
              },
            },
          },
        }, { id: workspaceOne.id });

        return fx;
      });

    cy
      .visit('/patient/dashboard/1')
      .wait('@routePatient');

    cy
      .get('.patient-sidebar')
      .as('patientSidebar')
      .find('.patient-sidebar__section')
      .should('have.length', 1)
      .first()
      .find('.widgets__divider');
  });

  specify('edit patient modal', function() {
    const testPatient = getPatient({
      attributes: {
        source: 'manual',
      },
    });

    cy
      .routesForPatientDashboard()
      .routeSettings(fx => {
        // NOTE: Ensures this button submit text and form_id for routing aren't used in this situation
        fx.data.push({
          id: 'patient_creation_form',
          attributes: {
            value: {
              form_id: testForm.id,
              submit_text: `Continue to ${ testForm.attributes.name }`,
            },
          },
        });

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePrograms')
      .wait('@routePatient');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Patient Account Menu')
      .contains('Edit Patient Details')
      .click();

    cy
      .get('.modal')
      .as('patientModal')
      .contains('Patient Account');

    cy
      .get('@patientModal')
      .find('.js-input')
      .first()
      .clear()
      .type('New Test');

    cy
      .intercept('PATCH', `/api/patients/${ testPatient.id }*`, {
        statusCode: 200,
        body: {
          data: {
            type: 'patients',
            id: testPatient.id,
          },
        },
      })
      .as('routePatchPatient');

    cy
      .get('@patientModal')
      .find('.js-submit')
      .contains('Save')
      .click()
      .wait('@routePatchPatient');

    cy
      .url()
      .should('contain', `/patient/dashboard/${ testPatient.id }`);
  });

  specify('view patient modal', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
        birth_date: '2000-01-01',
        sex: 'f',
      },
    });

    cy
      .routesForPatientDashboard()
      .routeSettings(fx => {
        // NOTE: Ensures this submit text doesn't show for the submit button in this situation
        fx.data.push({
          id: 'patient_creation_form',
          attributes: {
            value: {
              form_id: testForm.id,
              submit_text: `Continue to ${ testForm.attributes.name }`,
            },
          },
        });

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeCurrentClinician(fx => {
        // NOTE: ensures patient status menu options don't show for users without the 'patients:manage' permission
        // NOTE: in this test, the only menu option should be 'View Patient Details'
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleEmployee),
          },
        });

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePrograms')
      .wait('@routePatient');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Patient Account Menu')
      .find('.picklist__item')
      .should('have.length', 1);

    cy
      .get('.picklist')
      .contains('View Patient Details')
      .click();

    cy
      .get('.modal')
      .as('patientModal')
      .should('contain', 'Patient account managed by data integration.')
      .find('.js-input')
      .first()
      .should('have.value', 'Test')
      .should('be.disabled');

    cy
      .get('@patientModal')
      .find('.js-input')
      .last()
      .should('have.value', 'Patient')
      .should('be.disabled');

    cy
      .get('@patientModal')
      .find('[data-dob-region] button')
      .should('contain', formatDate('2000-01-01', 'MMM DD, YYYY'))
      .should('be.disabled');

    cy
      .get('@patientModal')
      .find('[data-sex-region] button')
      .should('contain', 'Female')
      .should('be.disabled');

    cy
      .get('@patientModal')
      .find('[data-workspaces-region]')
      .find('.is-disabled')
      .should('contain', 'Workspace One')
      .should('contain', 'Workspace Two')
      .find('.js-remove')
      .should('not.exist');

    cy
      .get('@patientModal')
      .find('[data-droplist-region]')
      .should('be.empty');

    cy
      .get('@patientModal')
      .find('.js-submit')
      .contains('Done')
      .click();

    cy
      .get('@patientModal')
      .should('not.exist');
  });

  specify('update patient status', function() {
    const testPatient = getPatient();

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeWorkspacePatient(fx => {
        fx.data = getWorkspacePatient({
          attributes: {
            status: 'active',
          },
        });

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleAdmin),
          },
        });
        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routeWorkspacePatient')
      .wait('@routePatient');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .find('.picklist__item')
      .should('have.length', 3);

    cy
      .intercept('PUT', '/api/workspace-patients/*', {
        statusCode: 200,
        body: {
          data: {
            status: 'inactive',
          },
        },
      })
      .as('routePutWorkspacePatient');

    cy
      .get('.picklist')
      .contains('Inactivate Patient')
      .click()
      .wait('@routePutWorkspacePatient');

    cy
      .get('.patient-sidebar')
      .find('.patient-sidebar__section')
      .contains('Status')
      .next()
      .as('sidebarStatusWidgetValue')
      .should('contain', 'Inactive');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .intercept('PUT', '/api/workspace-patients/*', {
        statusCode: 200,
        body: {
          data: {
            status: 'active',
          },
        },
      })
      .as('routePutWorkspacePatient');

    cy
      .get('.picklist')
      .contains('Activate Patient')
      .click()
      .wait('@routePutWorkspacePatient');

    cy
      .get('@sidebarStatusWidgetValue')
      .should('contain', 'Active');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .intercept('PUT', '/api/workspace-patients/*', {
        statusCode: 200,
        body: {
          data: {
            status: 'archive',
          },
        },
      })
      .as('routePutWorkspacePatient');

    cy
      .get('.picklist')
      .contains('Archive Patient')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routePutWorkspacePatient');

    cy
      .get('@sidebarStatusWidgetValue')
      .should('contain', 'Archived');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .contains('Archive Patient')
      .should('not.exist');

    cy
      .intercept('PUT', '/api/workspace-patients/*', {
        statusCode: 200,
        body: {
          data: {
            status: 'active',
          },
        },
      })
      .as('routePutWorkspacePatient');

    cy
      .get('.picklist')
      .contains('Activate Patient')
      .click()
      .wait('@routePutWorkspacePatient');

    cy
      .get('@sidebarStatusWidgetValue')
      .should('contain', 'Active');

    cy
      .get('.patient__sidebar')
      .find('.js-menu')
      .click();

    cy
      .get('.picklist')
      .should('contain', 'Inactivate Patient')
      .should('contain', 'Archive Patient');
  });
});
