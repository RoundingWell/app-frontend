import _ from 'underscore';
import dayjs from 'dayjs';

import formatDate from 'helpers/format-date';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getResource, getRelationship, getErrors } from 'helpers/json-api';
import { testTs } from 'helpers/test-timestamp';

import { workspaceOne } from 'support/api/workspaces';
import { getWorkspacePatient } from 'support/api/workspace-patients';
import { getPatient } from 'support/api/patients';
import { getCurrentClinician } from 'support/api/clinicians';
import { roleAdmin, roleEmployee } from 'support/api/roles';
import { getForm, testForm } from 'support/api/forms';
import { getFormResponse } from 'support/api/form-responses';

context('patient sidebar', function() {
  specify('expands and collapses sidebar sections accessibly', function() {
    cy
      .routesForPatientDashboard()
      .routeSidebars(fx => {
        const addSidebar = _.partial(getResource, _, 'sidebars');

        fx.data = [
          addSidebar({
            id: 'demographics',
            slug: 'demographics',
            name: 'Demographics',
            sequence: 0,
            widgets: ['sex'],
          }),
          addSidebar({
            id: 'care-team',
            slug: 'care-team',
            name: 'Care & Support',
            sequence: 1,
            widgets: ['sex'],
          }),
        ];

        return fx;
      })
      .visit('/patient/dashboard/1')
      .wait('@routePatient');

    cy
      .contains('.patient-sidebar__card-toggle', 'Demographics')
      .as('demographicsToggle')
      .should('have.attr', 'aria-expanded', 'true')
      .and('have.attr', 'aria-label', 'Collapse Demographics section')
      .invoke('attr', 'aria-controls')
      .then(regionId => {
        cy.get(`#${ regionId }`).should('be.visible');
      });

    cy
      .contains('.patient-sidebar__card-toggle', 'Care & Support')
      .as('careToggle')
      .should('have.attr', 'aria-expanded', 'true')
      .and('have.attr', 'aria-label', 'Collapse Care & Support section')
      .invoke('attr', 'aria-controls')
      .then(regionId => {
        cy.get(`#${ regionId }`).should('be.visible');
      });

    cy
      .get('@demographicsToggle')
      .click()
      .should('have.attr', 'aria-expanded', 'false')
      .and('have.attr', 'aria-label', 'Expand Demographics section')
      .invoke('attr', 'aria-controls')
      .then(regionId => {
        cy.get(`#${ regionId }`).should('not.be.visible');
      });

    cy
      .get('@demographicsToggle')
      .focus()
      .should('be.focused')
      .typeEnter();

    cy
      .get('@demographicsToggle')
      .should('have.attr', 'aria-expanded', 'true')
      .and('have.attr', 'aria-label', 'Collapse Demographics section');

    cy
      .get('@careToggle')
      .focus()
      .should('be.focused')
      .typeEnter();

    cy
      .get('@careToggle')
      .should('have.attr', 'aria-expanded', 'false')
      .and('have.attr', 'aria-label', 'Expand Care & Support section')
      .invoke('attr', 'aria-controls')
      .then(regionId => {
        cy.get(`#${ regionId }`).should('not.be.visible');
      });

    cy
      .get('@careToggle')
      .typeEnter()
      .should('have.attr', 'aria-expanded', 'true')
      .and('have.attr', 'aria-label', 'Collapse Care & Support section')
      .invoke('attr', 'aria-controls')
      .then(regionId => {
        cy.get(`#${ regionId }`).should('be.visible');
      });

    cy.viewport(720, 720);

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .should('have.attr', 'aria-expanded', 'false')
      .click();

    cy
      .get('.patient__sidebar')
      .should('be.visible');

    cy
      .get('.patient__sidebar-toggle')
      .type('{esc}');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .should('be.focused')
      .and('have.attr', 'aria-expanded', 'false');

    cy.viewport(721, 720);

    cy
      .get('.patient__sidebar')
      .should('be.visible');
  });

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

    cy
      .routesForPatientDashboard()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormFields()
      .routeForm()
      .routeForm(fx => {
        fx.data = testForm;

        return fx;
      }, testForm.id)
      .routeForm(fx => {
        fx.data = testScriptReducerForm;

        return fx;
      }, testScriptReducerForm.id)
      .routeForm(fx => {
        fx.data = testReadOnlyForm;

        return fx;
      }, testReadOnlyForm.id)
      .routeWidgetValues(fx => {
        fx.values = {
          sex: 'f',
          emptyField: null,
        };

        return fx;
      })
      .routeSidebars(fx => {
        fx.data[0].attributes.widgets = [
          'dob',
          'sex',
          'status',
          'divider',
          'workspaces',
          'divider',
          'formWidget',
          'formModalWidget',
          'readOnlyFormModalWidget',
          'formModalWidgetSmall',
          'formModalWidgetLarge',
          'patientMRNIdentifier',
          'patientSSNIdentifier',
          'hbsWidget',
          'hbsEmptyWidget',
          'hbsNoRegionWidget',
          'hbsEmptyTemplateWidget',
        ];

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
      .visitOnClock(`/patient/dashboard/${ testPatient.id }`, { now: testTs() })
      .wait('@routePatient')
      .wait('@routeWorkspacePatient')
      .wait('@routePrograms')
      .wait('@routeWidgets');

    cy
      .wait(`@routeForm${ testScriptReducerForm.id }`)
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
      .find('.widgets__value')
      .hasBeforeContent('–');

    cy
      .get('@patientSidebar')
      .find('.no-region-wrapper')
      .should('contain', 'No region defined')
      .parent()
      .next('.patient-sidebar__section')
      .should('have.css', 'display', 'none');

    cy
      .intercept('GET', '/forms/formio/**', {
        delay: 200,
        fixture: 'formio-stub.html',
      })
      .as('routeFormApp')
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form')
      .click();

    cy
      .get('.modal--large')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .wait('@routeFormApp')
      .wait('@routeFormDefinition');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 403,
        delay: 300,
        body: {
          errors: getErrors({
            status: '403',
            title: 'Forbidden',
            detail: 'Insufficient permissions',
          }),
        },
      })
      .as('postFormResponse');

    cy
      .iframeStub()
      .should(iframeStub => {
        const response = iframeStub.receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response, 'fetch:form:data response').to.exist;
        expect(response.args.value.options.reducers[0]).to.contain('storyTime = foo()');
      });

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'New typing',
          storyTime: 'New typing',
        });
      });

    cy
      .get('.modal--large')
      .find('.js-submit')
      .should('not.be.disabled')
      .click();

    cy
      .get('.modal--large')
      .find('.js-submit')
      .should('be.disabled')
      .wait('@postFormResponse');

    cy
      .intercept('POST', '/api/form-responses', {
        statusCode: 201,
        body: { data: getFormResponse() },
      })
      .as('postFormResponse');

    cy
      .get('.modal--large')
      .find('.js-submit')
      .should('not.be.disabled')
      .click()
      .wait('@postFormResponse');

    cy
      .get('.modal--large')
      .should('not.exist');

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form')
      .click()
      .wait('@routeFormApp')
      .wait('@routeFormDefinition');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'New typing',
        });
      });

    cy
      .get('.modal--large')
      .find('button:has(.fa-shield-check)')
      .as('draftStatusButton')
      .trigger('pointerover');

    // visitOnClock installs fake timers — tick past the tooltip's setTimeout(0) delay
    cy.tick(1);

    cy
      .get('.tooltip')
      .should('contain', 'See draft status');

    cy
      .get('@draftStatusButton')
      .click();

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('@draftStatusButton')
      .trigger('pointerover');

    // visitOnClock installs fake timers — tick past the tooltip's setTimeout(0) delay
    cy.tick(1);

    cy
      .get('.tooltip')
      .should('not.exist');

    cy.tick(60000);

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a minute ago');

    cy
      .iframeStub()
      .then(iframeStub => {
        iframeStub.send('update:storedSubmission', {
          familyHistory: 'More new typing',
        });
      });

    cy
      .get('.form__draft-menu')
      .should('contain', 'Last saved a few seconds ago');

    cy
      .get('.form__draft-menu')
      .find('.js-discard')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeFormApp');

    cy
      .get('@draftStatusButton')
      .should('not.exist');

    cy
      .get('.modal--large')
      .find('.js-submit')
      .should('be.disabled');

    cy
      .get('.modal--large')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('.patient-sidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Read Only Form')
      .click()
      .wait(`@routeForm${ testReadOnlyForm.id }`)
      .wait('@routeFormDefinition');

    cy
      .get('iframe')
      .should(([iframe]) => {
        const { receivedMessages } = iframe.contentWindow.iframeStub;
        const response = receivedMessages.findLast(m => m.message === 'fetch:form:data');

        expect(response.args.value.isReadOnly).to.be.true;
      });

    cy
      .get('.modal--large')
      .find('.modal__footer-actions .js-close')
      .should('not.exist');

    cy
      .get('.modal--large')
      .find('.modal__footer-actions .js-submit')
      .should('contain', 'Done');

    cy
      .get('.modal--large')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form Small')
      .click();

    cy
      .get('.modal--large')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Modal Form Large')
      .click();

    cy
      .get('.modal--large')
      .should('not.exist');

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/form/${ testForm.id }`);

    cy.go('back');

    cy
      .url()
      .should('contain', `patient/dashboard/${ testPatient.id }`);

    cy
      .get('@patientSidebar')
      .find('.widgets__form-widget')
      .contains('Test Form')
      .click();

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/form/${ testForm.id }`);
  });

  specify('renders patient sidebar when widget values fail', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
        sex: 'f',
      },
    });

    cy
      .routesForPatientDashboard()
      .routeSidebars(fx => {
        fx.data[0].attributes.widgets = [
          'sex',
          'failingWidget',
          'unknownWidget',
        ];

        return fx;
      })
      .routeWidgets(fx => {
        const addWidget = _.partial(getResource, _, 'widgets');

        fx.data = fx.data.concat([
          addWidget({
            slug: 'failingWidget',
            category: 'widget',
            definition: {
              template: 'Widget value: {{ sex }}',
              display_name: 'Failing Widget',
            },
            values: {
              sex: '@patient.sex',
            },
          }),
          addWidget({
            slug: 'unknownWidget',
            category: 'customWidget',
            definition: {
              template: 'Custom widget value',
              display_name: 'Unknown Widget',
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
      .intercept('GET', '/api/widgets/failingWidget/values*', {
        statusCode: 404,
        body: {
          errors: getErrors({
            status: '404',
            title: 'Not Found',
            detail: 'Widget values failed',
          }),
        },
      })
      .as('routeFailingWidgetValues');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routeFailingWidgetValues');

    cy
      .get('.patient-sidebar')
      .should('contain', 'Test Patient');

    cy
      .get('.patient-sidebar__section')
      .should('have.length', 3);

    cy
      .get('.patient-sidebar__section')
      .first()
      .should('contain', 'Sex')
      .should('contain', 'Female');

    cy
      .get('.patient-sidebar__section')
      .eq(2)
      .should('contain', 'Unknown Widget')
      .should('contain', 'Custom widget value');
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

  specify('renders widgets from the sidebar definition', function() {
    cy
      .routesForPatientDashboard()
      .routeSidebars(fx => {
        fx.data[0].attributes.widgets = ['divider'];

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
      .routeSettings('patient_creation_form', {
        form_id: testForm.id,
        submit_text: `Continue to ${ testForm.attributes.name }`,
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
      .should('have.class', 'button--menu')
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
      .should('contain', `/patient/${ testPatient.id }/workflow`);
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
      .routeSettings('patient_creation_form', {
        form_id: testForm.id,
        submit_text: `Continue to ${ testForm.attributes.name }`,
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
