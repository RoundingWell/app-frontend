import dayjs from 'dayjs';
import { v7 as uuid } from 'uuid';

import formatDate from 'helpers/format-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getRelationship, getErrors } from 'helpers/json-api';
import { getActivity } from 'support/api/events';
import { getAction, longActionName } from 'support/api/actions';

import { workspaceOne } from 'support/api/workspaces';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { teamCoordinator, teamOther, teamNurse } from 'support/api/teams';
import { getPatient } from 'support/api/patients';
import { stateTodo, stateDone, stateInProgress } from 'support/api/states';
import { testForm } from 'support/api/forms';
import { getProgramAction } from 'support/api/program-actions';
import { getComment } from 'support/api/comments';
import { getProgram } from 'support/api/programs';
import { roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { getFlow } from 'support/api/flows';
import { getFile } from 'support/api/files';
import { getPatientField } from 'support/api/patient-fields';

context('patient action page', { scrollBehavior: 'center' }, function() {
  specify('display patient action', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();

    const currentClinician = getCurrentClinician();
    const testClinician = getClinician({
      attributes: {
        name: 'Another Clinician',
      },
      relationships: {
        team: getRelationship(teamCoordinator),
      },
    });

    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testAction = getAction({
      attributes: {
        name: longActionName,
        details: 'Details',
        duration: 5,
        due_date: testDateSubtract(2),
        due_time: '06:01:00',
        updated_at: testTs(),
        sharing: true,
      },
      relationships: {
        owner: getRelationship(currentClinician),
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientAction()
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinician, testClinician];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routeActionActivity(fx => {
        fx.data = [
          getActivity({
            event_type: 'ActionCreated',
            source: 'api',
            date: testTs(),
          }),
          getActivity({
            event_type: 'ActionClinicianAssigned',
            source: 'api',
          }, {
            clinician: getRelationship(testClinician),
          }),
          getActivity({
            event_type: 'ActionDetailsUpdated',
            source: 'api',
          }),
          getActivity({
            event_type: 'ActionDueDateUpdated',
            source: 'api',
            previous: null,
            value: '2019-09-10',
          }),
          getActivity({
            event_type: 'ActionDueDateUpdated',
            source: 'api',
            previous: null,
            value: null,
          }),
          getActivity({
            event_type: 'ActionDurationUpdated',
            source: 'api',
            previous: 0,
            value: 10,
          }),
          getActivity({
            event_type: 'ActionDurationUpdated',
            source: 'api',
            previous: 0,
            value: null,
          }),
          getActivity({
            event_type: 'ActionNameUpdated',
            source: 'api',
            previous: 'New Action',
            value: 'New Action Name Updated',
          }),
          getActivity({
            event_type: 'ActionTeamAssigned',
            source: 'api',
          }, {
            team: getRelationship(teamOther),
          }),
          getActivity({
            event_type: 'ActionStateUpdated',
            source: 'api',
          }, {
            state: getRelationship(stateDone),
          }),
          getActivity({
            event_type: 'ActionFormUpdated',
            source: 'api',
          }, {
            form: getRelationship(testForm),
          }),
          getActivity({
            event_type: 'ActionFormResponded',
            source: 'api',
          }, {
            form: getRelationship(testForm),
          }),
          getActivity({
            event_type: 'ActionDueTimeUpdated',
            source: 'api',
            previous: null,
            value: '11:12:13',
          }),
          getActivity({
            event_type: 'ActionDueTimeUpdated',
            source: 'api',
            previous: null,
            value: null,
          }),
          getActivity({
            event_type: 'ActionSharingUpdated',
            source: 'api',
            value: 'sent',
          }, {
            recipient: getRelationship(testPatient),
          }),
          getActivity({
            event_type: 'ActionSharingUpdated',
            source: 'api',
            value: 'canceled',
          }, {
            recipient: getRelationship(testPatient),
          }),
          getActivity({
            event_type: 'ActionFormResponded',
            source: 'api',
          }, {
            editor: getRelationship(),
            recipient: getRelationship(testPatient),
            form: getRelationship(testForm),
          }),
          getActivity({
            event_type: 'ActionSharingUpdated',
            source: 'api',
            value: 'pending',
          }, {
            recipient: getRelationship(testPatient),
          }),
          getActivity({
            event_type: 'ActionCreated',
            source: 'system',
          }, {
            editor: getRelationship(testClinician),
          }),
          getActivity({
            event_type: 'ActionClinicianAssigned',
            source: 'system',
          }, {
            clinician: getRelationship(testClinician),
          }),
          getActivity({
            event_type: 'ActionDetailsUpdated',
            source: 'system',
          }),
          getActivity({
            event_type: 'ActionDueDateUpdated',
            source: 'system',
            previous: null,
            value: '2019-09-10',
          }),
          getActivity({
            event_type: 'ActionDueDateUpdated',
            source: 'system',
            previous: null,
            value: null,
          }),
          getActivity({
            event_type: 'ActionDurationUpdated',
            source: 'system',
            previous: 0,
            value: 10,
          }),
          getActivity({
            event_type: 'ActionDurationUpdated',
            source: 'system',
            previous: 0,
            value: null,
          }),
          getActivity({
            event_type: 'ActionNameUpdated',
            source: 'system',
            previous: 'New Action',
            value: 'New Action Name Updated',
          }),
          getActivity({
            event_type: 'ActionTeamAssigned',
            source: 'system',
          }, {
            team: getRelationship(teamOther),
          }),
          getActivity({
            event_type: 'ActionStateUpdated',
            source: 'system',
          }, {
            state: getRelationship(stateDone),
          }),
          getActivity({
            event_type: 'ActionFormUpdated',
            source: 'system',
          }, {
            form: getRelationship(testForm),
          }),
          getActivity({
            event_type: 'ActionFormResponded',
            source: 'system',
          }, {
            editor: getRelationship(),
            recipient: getRelationship(testPatient),
            form: getRelationship(testForm),
          }),
          getActivity({
            event_type: 'ActionFormResponded',
            source: 'system',
          }, {
            form: getRelationship(testForm),
          }),
          getActivity({
            event_type: 'ActionDueTimeUpdated',
            source: 'system',
            previous: null,
            value: '11:12:13',
          }),
          getActivity({
            event_type: 'ActionDueTimeUpdated',
            source: 'system',
            previous: null,
            value: null,
          }),
          getActivity({
            event_type: 'ActionSharingUpdated',
            source: 'system',
            value: 'sent',
          }, {
            recipient: getRelationship(testPatient),
          }),
          getActivity({
            event_type: 'ActionSharingUpdated',
            source: 'system',
            value: 'canceled',
          }, {
            recipient: getRelationship(testPatient),
          }),
          getActivity({
            event_type: 'ActionSharingUpdated',
            source: 'system',
            value: 'pending',
          }, {
            recipient: getRelationship(testPatient),
          }),
          getActivity({
            event_type: 'UnsupportedActionEvent',
            source: 'system',
          }),
        ];

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientFlows()
      .visitOnClock(`/patient/${ testPatient.id }/action/${ testAction.id }`, { now: testTime, functionNames: ['Date'] })
      .wait('@routeAction')
      .wait('@routeActionActivity')
      .wait('@routePatient')
      .tick(350); // since this test uses visitOnClock, we need this for the sidebar animation

    cy.viewport(1048, 785);

    cy
      .get('.patient-action__menu')
      .should('have.class', 'button--menu');

    cy
      .get('.patient__context-trail')
      .contains(testAction.attributes.name)
      .should('have.class', 'patient__context-current')
      .and('not.have.class', 'patient__context-link');

    cy
      .get('.patient-action__chips')
      .should('be.visible');

    cy.viewport(1920, 900);

    cy
      .get('.patient-action__header')
      .should($header => {
        expect($header[0].getBoundingClientRect().width).to.equal(1200);
      });

    cy.viewport(1280, 720);

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .focus()
      .parents('.textarea-flex')
      .should('have.class', 'is-editing')
      .find('.js-input')
      .blur()
      .parents('.textarea-flex')
      .should('not.have.class', 'is-editing');

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .clear();

    cy
      .get('.patient-action__details-actions')
      .should('be.visible');

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .contains('Save')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships).to.be.undefined;
        expect(data.id).to.equal(testAction.id);
        expect(data.attributes.details).to.equal('');
        expect(data.attributes.due_date).to.not.exist;
        expect(data.attributes.due_time).to.not.exist;
        expect(data.attributes.duration).to.not.exist;
      });

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .focus()
      .should('have.css', 'overflow-y', 'auto')
      .parents('.textarea-flex')
      .should('have.class', 'is-editing')
      .find('.js-input')
      .type('First line{enter}Second line')
      .should('have.value', 'First line\nSecond line')
      .blur()
      .parents('.textarea-flex')
      .should('have.class', 'is-editing');

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .contains('Cancel')
      // Need force because Cypress does not recognize the element is typeable
      .type('{enter}', { force: true });

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .should('have.value', '');

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-state-region]')
      .contains('To Do')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateInProgress.id);
      });

    cy
      .get('.patient-action')
      .find('[data-owner-region]')
      .contains('Clinician McTester')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse NUR')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(teamNurse.id);
        expect(data.relationships.owner.data.type).to.equal(teamNurse.type);
      });

    cy
      .get('.patient-action')
      .find('[data-owner-region]')
      .contains('NUR')
      .click();

    cy
      .get('.picklist')
      .contains('Clinician McTester')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.owner.data.id).to.equal(currentClinician.id);
        expect(data.relationships.owner.data.type).to.equal(currentClinician.type);
      });

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .contains('6:01 AM')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Time')
      .click();

    cy
      .wait('@routePatchAction');

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .find('button')
      .should('exist')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('7:00 AM')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('07:00:00');
      });

    cy
      .get('.patient-action')
      .find('[data-due-date-region]')
      .contains(formatDate(testDateSubtract(2), 'SHORT'))
      .click();

    cy
      .get('.datepicker')
      .contains('Today')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_date).to.equal(testDate());
      });

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .find('.is-overdue');

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('1:30 PM')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('13:30:00');
      });

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.patient-action')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Clear Time')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.be.null;
      });

    cy
      .get('.patient-action')
      .find('[data-due-date-region]')
      .contains(formatDate(testDate(), 'SHORT'))
      .click();

    cy
      .get('.datepicker')
      .contains('Clear')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_date).to.be.null;
        expect(data.attributes.due_time).to.be.null;
      });

    cy
      .get('.patient-action')
      .find('[data-duration-region]')
      .contains('5')
      .click();

    cy
      .get('.picklist')
      .contains('Clear')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.duration).to.equal(0);
      });

    cy
      .get('.patient-action')
      .find('[data-duration-region]')
      .find('button')
      .should('not.contain', 'Select Duration')
      .click();

    cy
      .get('.picklist')
      .contains('3 mins')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.duration).to.equal(3);
      });

    cy
      .get('.patient-action')
      .find('[data-state-region]')
      .contains('In Progress')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.patient-action')
      .find('[data-form-sharing-region]')
      .should('contain', 'Share Form');

    cy
      .get('.patient-action')
      .find('[data-dialer-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .should('be.empty');

    cy
      .get('[data-activity-region]')
      // source = 'api' activity events
      .should('contain', 'Clinician McTester (Nurse) added this action')
      .should('contain', 'Clinician McTester (Nurse) changed the owner to Another Clinician')
      .should('contain', 'Clinician McTester (Nurse) updated the details of this action')
      .should('contain', 'Clinician McTester (Nurse) changed the due date to Sep 10, 2019')
      .should('contain', 'Clinician McTester (Nurse) cleared the due date')
      .should('contain', 'Clinician McTester (Nurse) updated the duration to 10')
      .should('contain', 'Clinician McTester (Nurse) cleared duration')
      .should('contain', 'Clinician McTester (Nurse) updated the name of this action from New Action to New Action Name Updated')
      .should('contain', 'Clinician McTester (Nurse) changed the owner to Other')
      .should('contain', 'Clinician McTester (Nurse) changed the state to Done')
      .should('contain', 'Clinician McTester (Nurse) added the form Test Form')
      .should('contain', 'Clinician McTester (Nurse) worked on the form Test Form')
      .should('contain', 'Clinician McTester (Nurse) changed the due time to 11:12 AM')
      .should('contain', 'Clinician McTester (Nurse) cleared the due time')
      .should('contain', 'Form shared with Test Patient. Waiting for response.')
      .should('contain', 'Clinician McTester (Nurse) cancelled form sharing')
      .should('contain', 'Test Patient completed the form Test Form')
      // source = 'system' activity events
      .should('contain', 'Owner changed to Another Clinician')
      .should('contain', 'Action details updated')
      .should('contain', 'Due Date changed to Sep 10, 2019')
      .should('contain', 'Due Date cleared')
      .should('contain', 'Duration updated to 10')
      .should('contain', 'Duration cleared')
      .should('contain', 'Action name updated from New Action to New Action Name Updated')
      .should('contain', 'Owner changed to Other')
      .should('contain', 'State changed to Done')
      .should('contain', 'Form Test Form added')
      .should('contain', 'Form Test Form completed')
      .should('contain', 'Form Test Form worked on')
      .should('contain', 'Due Time changed to 11:12 AM')
      .should('contain', 'Due Time cleared')
      .should('contain', 'Form shared with Test Patient. Waiting for response.')
      .should('contain', 'Form sharing (Nurse) cancelled');

    cy
      .get('[data-activity-region] .patient-action__activity-item')
      .each($item => {
        expect($item.text().trim()).not.to.equal('');
      });

    cy
      .intercept('DELETE', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlowAction');

    cy
      .get('.patient-action__menu')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Delete Action')
      .click()
      .wait('@routeDeleteFlowAction');

    cy
      .url()
      .should('not.contain', '/action/');
  });

  specify('action phone dialer', function() {
    const testFlow = getFlow({
      relationships: {
        state: getRelationship(stateTodo),
      },
    });

    const testAction = getAction({
      relationships: {
        state: getRelationship(stateTodo),
        flow: getRelationship(testFlow),
      },
    });

    cy
      .routeSettings('dialer', 'five9')
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routePatientField(fx => {
        fx.data = getPatientField({
          attributes: {
            name: 'phones',
            value: [
              {
                label: 'home',
                number: '+16195561434',
                preferred: false,
              },
              {
                label: 'mobile',
                number: '+13215551234',
                preferred: true,
              },
            ],
          },
        });

        return fx;
      })
      .routePatientByFlow()

      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow');

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .intercept('PATCH', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .get('.patient-action')
      .find('[data-dialer-region] button')
      .as('actionDialerButton')
      .click()
      .wait('@routePatientField');

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .should('have.length', 2)
      .first()
      .should('contain', '(321) 555-1234');

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('@actionDialerButton')
      .click();

    cy
      .get('@routePatientField.all')
      .should('have.length', 1);

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .first()
      .click();

    cy
      .get('.five9-wrapper')
      .should('have.class', 'is-open');

    cy
      .get('.five9-panel__header')
      .find('[data-status-region]')
      .click();

    cy
      .get('.patient-action')
      .find('[data-state-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('Complete')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-action')
      .find('[data-dialer-region] button')
      .should('be.disabled');

    cy
      .get('.patient-action')
      .find('[data-state-region] button')
      .click();

    cy
      .get('.picklist')
      .contains('To Do')
      .click()
      .wait('@routePatchAction');

    cy
      .get('@actionDialerButton')
      .should('not.be.disabled');

    cy
      .get('.patient-action')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Complete')
      .click()
      .wait('@routePatchAction');

    cy
      .get('@actionDialerButton')
      .should('be.disabled');
  });

  specify('action attachments', function() {
    const testPatient = getPatient();

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testFiles = [
      getFile({
        attributes: {
          path: `patients/${ testPatient.id }/HRA.pdf`,
          created_at: testTsSubtract(1),
        },
        meta: {
          view: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/view/HRA.pdf`,
          download: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/download/HRA.pdf`,
        },
      }),
      getFile({
        attributes: {
          path: `patients/${ testPatient.id }/HRA v2.pdf`,
          created_at: testTs(),
        },
        meta: {
          view: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/view/HRA%20v2.pdf`,
          download: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/download/HRA%20v2.pdf`,
        },
      }),
    ];

    const testAction = getAction({
      relationships: {
        'files': getRelationship(testFiles),
        'patient': getRelationship(testPatient),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings('upload_attachments', true)
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = testFiles;

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .children()
      .as('attachmentItems')
      .should('have.length', 2);

    cy
      .get('.patient-action__attachment-control.js-add')
      .should('be.visible')
      .and('have.attr', 'aria-label', 'Add an Attachment...');

    cy
      .get('@attachmentItems')
      .first()
      .contains('HRA v2.pdf')
      .as('attachmentItem')
      .should('have.attr', 'href')
      .and('contain', `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/view/HRA%20v2.pdf`);

    cy
      .get('@attachmentItem')
      .should('have.attr', 'target')
      .and('contain', '_blank');

    cy
      .get('@attachmentItems')
      .first()
      .find('.js-download')
      .as('attachmentDownload')
      .should('have.attr', 'aria-label', 'Download')
      .should('have.attr', 'href')
      .and('contain', `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/download/HRA%20v2.pdf`);

    cy
      .get('@attachmentDownload')
      .should('have.attr', 'target')
      .and('contain', '_blank');

    cy
      .get('@attachmentDownload')
      .should('have.attr', 'download');

    cy
      .get('@attachmentItems')
      .first()
      .find('.js-remove')
      .should('have.attr', 'aria-label', 'Remove')
      .click();

    cy
      .get('.modal--small')
      .find('.js-close')
      .first()
      .click();

    cy
      .get('@attachmentItems')
      .first()
      .contains('HRA v2.pdf');

    cy
      .intercept('DELETE', '/api/files/*', {
        statusCode: 422,
        body: {
          errors: getErrors({
            status: '422',
            title: 'Unprocessable Entity',
            detail: 'Unable to remove file',
          }),
        },
      })
      .as('routeDeleteFileFailure');

    cy
      .get('@attachmentItems')
      .first()
      .find('.js-remove')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteFileFailure');

    cy
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 2)
      .first()
      .should('contain', 'HRA v2.pdf');

    cy
      .intercept('DELETE', '/api/files/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFile');

    cy
      .get('@attachmentItems')
      .first()
      .find('.js-remove')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteFile')
      .itsUrl()
      .its('pathname')
      .should('contain', `/api/files/${ testFiles[1].id }`);

    const putFileURL = '/api/actions/**/relationships/files?urls=upload';

    let firstCall = true;
    let fileId;

    cy
      .intercept('PUT', putFileURL, req => {
        if (firstCall) {
          expect(req.body.data.attributes.path).to.include('test.pdf');
          firstCall = false;
          req.reply({
            statusCode: 400,
            body: {
              errors: getErrors({
                status: '400',
                title: 'Bad Request',
                detail: 'Another file exists for that path',
                source: {
                  pointer: '/data/attributes/path',
                },
              }),
            },
          });
          return;
        }
        expect(req.body.data.attributes.path).to.include('test-copy.pdf');
        fileId = req.body.data.id;
        req.reply({
          statusCode: 201,
          body: {
            data: {
              id: fileId,
              attributes: {
                path: req.body.data.attributes.path,
                created_at: testTs(),
              },
              meta: {
                upload: '/upload-test',
              },
            },
          },
        });
      }).as('routePutFile');

    cy
      .intercept('PUT', '/upload-test', req => {
        req.reply({
          statusCode: 200,
          throttleKbps: 10,
        });
      }).as('routeUploadFile');

    cy
      .intercept('GET', '/api/files/*', req => {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              id: fileId,
              attributes: {
                path: '/dir/test-copy.pdf',
                created_at: testTs(),
              },
              meta: {
                download: '/download-test',
                view: '/view-test',
              },
            },
          },
        });
      }).as('routeGetFile');

    cy
      .get('#upload-attachment')
      .selectFile({
        contents: Cypress.Buffer.from('test'),
        fileName: 'test.pdf',
      }, { force: true });

    cy
      .wait('@routeGetFile')
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .children()
      .first()
      .contains('test-copy.pdf');

    cy
      .intercept('PUT', '/upload-test', req => {
        req.reply({
          statusCode: 400,
        });
      }).as('routeUploadFail');

    cy
      .get('#upload-attachment')
      .selectFile({
        contents: Cypress.Buffer.from('test-fail'),
        fileName: 'test-copy.pdf',
      }, { force: true });

    cy
      .wait('@routeUploadFail')
      .get('.alert-box')
      .should('contain', 'File failed to upload');

    cy
      .wait('@routeDeleteFile')
      .itsUrl()
      .its('pathname')
      .then(pathname => {
        expect(pathname).to.contain(`/api/files/${ fileId }`);
      });
  });

  specify('action attachments - show/hide icon in action list items', function() {
    const testPatient = getPatient();
    const testFileId = uuid();

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testAction = getAction({
      relationships: {
        'files': getRelationship([]),
        'patient': getRelationship(testPatient),
        'program-action': getRelationship(testProgramAction),
        'state': getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings('upload_attachments', true)
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .intercept('PUT', '/api/actions/**/relationships/files?urls=upload', req => {
        req.reply({
          statusCode: 201,
          body: {
            data: {
              id: testFileId,
              attributes: {
                path: '/dir/test.pdf',
                created_at: testTs(),
              },
              meta: {
                upload: '/upload-test',
              },
            },
          },
        });
      });

    cy
      .intercept('PUT', '/upload-test', req => {
        req.reply({
          statusCode: 200,
          throttleKbps: 10,
        });
      });

    cy
      .intercept('GET', '/api/files/*', req => {
        req.reply({
          statusCode: 200,
          body: {
            data: {
              id: testFileId,
              attributes: {
                path: '/dir/test.pdf',
                created_at: testTs(),
              },
              meta: {
                download: '/download-test',
                view: '/view-test',
              },
            },
          },
        });
      });

    cy
      .intercept('DELETE', '/api/files/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFile');

    cy
      .get('#upload-attachment')
      .selectFile({
        contents: Cypress.Buffer.from('test'),
        fileName: 'test.pdf',
      }, { force: true });

    cy
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .first()
      .find('.js-remove')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteFile');
  });

  specify('action attachments - uploads not allowed on program action', function() {
    const testFile = getFile();

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: [],
      },
    });

    const testAction = getAction({
      relationships: {
        'files': getRelationship([testFile]),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings('upload_attachments', true)
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [testFile];

        return fx;
      })
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 1);

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('not.exist');
  });

  specify('action attachments - uploads not allowed without edit permission', function() {
    const testFile = getFile();
    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });
    const testAction = getAction({
      relationships: {
        'files': getRelationship([testFile]),
        'owner': getRelationship(teamNurse),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings('upload_attachments', true)
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });
        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;
        fx.included.push(testProgramAction);
        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [testFile];
        return fx;
      })
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('[data-attachments-region]')
      .find('.js-add')
      .should('not.exist');
  });

  specify('action attachments - uploads not allowed for org', function() {
    const testPatient = getPatient();
    const testFile = getFile();

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testAction = getAction({
      relationships: {
        'files': getRelationship([testFile]),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [testFile];

        return fx;
      })

      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 1);

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('not.exist');
  });

  specify('action comments', function() {
    cy
      .routesForPatientAction()
      .routeActionActivity(fx => {
        fx.data = [
          getActivity({
            date: testTsSubtract(8),
            event_type: 'ActionCreated',
          }),
          getActivity({
            date: testTs(),
          }),
        ];

        return fx;
      })
      .routeActionComments(fx => {
        fx.data = [
          getComment({
            attributes: {
              edited_at: null,
              created_at: testTsSubtract(2),
              message: 'Least Recent Message from Clinician McTester',
            },
            relationships: {
              clinician: getRelationship(getCurrentClinician()),
            },
          }),
          getComment({
            attributes: {
              edited_at: testTs(),
              created_at: testTsSubtract(1),
              message: 'Most Recent Message from Clinician McTester',
            },
            relationships: {
              clinician: getRelationship(getCurrentClinician()),
            },
          }),
          getComment({
            attributes: {
              edited_at: null,
              created_at: testTsSubtract(4),
              message: 'Message from Someone Else',
            },
            relationships: {
              clinician: getRelationship(getClinician()),
            },
          }),
        ];

        return fx;
      })
      .visit('/patient/1/action/1')
      .wait('@routeActionActivity')
      .wait('@routeActionComments');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .eq(2)
      .should('contain', 'CM')
      .should('contain', 'Clinician McTester')
      .should('contain', 'Edit')
      .should('contain', 'Most Recent Message from Clinician McTester')
      .should('contain', '(Edited)');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .eq(2)
      .find('.js-edit')
      .as('editIcon')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Last edited on');

    cy
      .get('@editIcon')
      .trigger('mouseout');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .eq(1)
      .should('contain', 'CM')
      .should('contain', 'Clinician McTester')
      .should('contain', 'Edit')
      .should('contain', 'Least Recent Message from Clinician McTester')
      .should('not.contain', '(Edited)');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .eq(1)
      .as('activityComment')
      .find('.js-edit')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .eq(0)
      .should('not.contain', 'CM')
      .should('not.contain', 'Clinician McTester')
      .should('not.contain', 'Edit')
      .should('contain', 'Message from Someone Else')
      .should('not.contain', '(Edited)');

    cy
      .get('@activityComment')
      .find('.js-edit')
      .click();

    cy
      .get('[data-activity-region]')
      .find('[data-comment-activity-region] .js-post')
      .should('contain', 'Save')
      .should('be.disabled');

    cy
      .get('[data-activity-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('[data-activity-region]')
      .contains('.comment__item', 'Least Recent Message from Clinician McTester')
      .should('contain', 'Least Recent Message from Clinician McTester')
      .should('not.contain', '(Edited)');

    cy
      .get('[data-activity-region]')
      .contains('.comment__item', 'Least Recent Message from Clinician McTester')
      .find('.js-edit')
      .click();

    cy
      .intercept('PATCH', '/api/comments/*', {
        statusCode: 204,
        body: {},
      })
      .as('routePatchComment');

    cy
      .get('[data-activity-region]')
      .find('[data-comment-activity-region] .js-input')
      .clear()
      .type('An edited comment');

    cy
      .get('[data-activity-region]')
      .find('[data-comment-activity-region] .js-post')
      .click();

    cy
      .wait('@routePatchComment')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.message).to.equal('An edited comment');
      });

    cy
      .get('[data-activity-region]')
      .contains('.comment__item', 'An edited comment')
      .should('contain', 'An edited comment')
      .find('.comment__edited');

    cy
      .intercept('DELETE', '/api/comments/*', {
        statusCode: 422,
        body: {
          errors: getErrors({
            status: '422',
            title: 'Unprocessable Entity',
            detail: 'Unable to remove comment',
          }),
        },
      })
      .as('routeDeleteCommentFailure');

    cy
      .get('[data-activity-region]')
      .contains('.comment__item', 'An edited comment')
      .find('.js-edit')
      .click();

    cy
      .get('[data-activity-region]')
      .find('.js-delete')
      .click();

    cy
      .get('.modal--small')
      .should('contain', 'Are you sure you want to delete this comment?')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteCommentFailure');

    cy
      .get('[data-activity-region]')
      .find('[data-comment-activity-region] .js-input')
      .should('have.value', 'An edited comment');

    cy
      .intercept('DELETE', '/api/comments/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteComment');

    cy
      .get('[data-activity-region]')
      .find('[data-comment-activity-region] .js-delete')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteComment');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .should('have.length', 2);

    cy
      .get('.patient-action')
      .find('[data-comment-form-region]')
      .last()
      .as('commentRegion')
      .find('[data-post-region] .js-post')
      .should('be.disabled');

    cy
      .get('@commentRegion')
      .find('.js-input')
      .type('Test comment');

    cy
      .get('@commentRegion')
      .find('.js-cancel')
      .click();

    cy
      .get('@commentRegion')
      .find('.js-input')
      .should('have.value', '');

    cy
      .get('@commentRegion')
      .find('.js-post')
      .should('be.disabled');

    cy
      .get('@commentRegion')
      .find('.js-input')
      .type('Test comment')
      .clear();

    cy
      .get('@commentRegion')
      .find('.js-input')
      .type('Test comment')
      .type('{enter}')
      .type('more comment');

    cy
      .intercept('POST', '/api/actions/*/relationships/comments', {
        statusCode: 422,
        body: {
          errors: getErrors({
            status: '422',
            title: 'Unprocessable Entity',
            detail: 'Unable to post comment',
          }),
        },
      })
      .as('routePostCommentFailure');

    cy
      .get('@commentRegion')
      .find('.js-post')
      .should('contain', 'Post')
      .click()
      .wait('@routePostCommentFailure');

    cy
      .get('@commentRegion')
      .find('.js-input')
      .should('have.value', 'Test comment\nmore comment');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .should('have.length', 2);

    cy
      .intercept('POST', '/api/actions/*/relationships/comments', {
        delay: 100,
        statusCode: 204,
        body: {},
      })
      .as('routePostComment');

    cy
      .get('@commentRegion')
      .find('.js-post')
      .click();

    cy
      .get('@commentRegion')
      .find('.js-post')
      .should('be.disabled');

    cy
      .wait('@routePostComment')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.message).to.equal('Test comment\nmore comment');
      });

    cy
      .get('@routePostComment.all')
      .should('have.length', 1);

    cy
      .get('[data-activity-region]')
      .find('.comment__item .comment__message')
      .last()
      .should('contain', 'Test comment')
      .should('contain', 'more comment');
  });

  specify('action comments - show/hide icon in action list items', function() {
    const testPatient = getPatient();

    const testAction = getAction({
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
        comments: getRelationship([]),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [];

        return fx;
      })
      .routeActionComments(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles')
      .wait('@routeActionComments');

    cy
      .get('.patient-action')
      .find('[data-comment-form-region]')
      .last()
      .as('postCommentRegion')
      .find('.js-input')
      .type('Test comment');

    cy
      .intercept('POST', '/api/actions/*/relationships/comments', {
        statusCode: 201,
        body: {
          data: getComment({
            attributes: {
              message: 'Test comment',
              edited_at: null,
              created_at: testTs(),
            },
            relationships: {
              clinician: getRelationship(getCurrentClinician()),
            },
          }),
        },
      })
      .as('routePostComment');

    cy
      .get('@postCommentRegion')
      .find('.js-post')
      .click()
      .wait('@routePostComment');

    cy
      .get('@postCommentRegion')
      .find('.js-input')
      .type('Another test comment');

    cy
      .intercept('POST', '/api/actions/*/relationships/comments', {
        statusCode: 201,
        body: {
          data: getComment({
            attributes: {
              message: 'Another test comment',
              edited_at: null,
              created_at: testTs(),
            },
            relationships: {
              clinician: getRelationship(getCurrentClinician()),
            },
          }),
        },
      })
      .as('routePostComment');

    cy
      .get('@postCommentRegion')
      .find('.js-post')
      .click()
      .wait('@routePostComment');

    cy
      .intercept('DELETE', '/api/comments/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteComment');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .first()
      .find('.js-edit')
      .click();

    cy
      .get('[data-activity-region]')
      .find('.js-delete')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteComment');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .first()
      .find('.js-edit')
      .click();

    cy
      .get('[data-activity-region]')
      .find('.js-delete')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteComment');
  });

  specify('display action from program action', function() {
    const testProgram = getProgram({
      attributes: {
        name: 'Test Program',
      },
    });

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testAction = getAction({
      attributes: {
        name: 'Program Action Name',
        options: {
          color: 'red',
          icon: 'caret-down',
          iconType: 'fas',
        },
      },
      relationships: {
        'form': getRelationship(testForm),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings('upload_attachments', true)
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionActivity(fx => {
        fx.data = [
          getActivity({
            event_type: 'ActionCreated',
            date: testTs(),
          }),
          getActivity(),
          getActivity({
            date: testTs(),
            event_type: 'ActionCopiedFromProgramAction',
            source: 'api',
          }, {
            'program': getRelationship(testProgram),
            'program-action': getRelationship(testProgramAction),
            'editor': getRelationship(getCurrentClinician()),
          }),
        ];

        fx.included.push(testProgram);

        return fx;
      })
      .routeFormByAction()
      .routeForm()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeFormFields()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__name')
      .should('contain', 'Program Action Name');

    cy
      .get('.patient-action__title-icon')
      .find('.action-icon--red')
      .find('.fa-caret-down');

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .find('[data-attachments-files-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('exist')
      .and('have.attr', 'aria-label', 'Add an Attachment...');

    cy
      .get('.patient-action')
      .find('.form__frame--embedded')
      .should('contain', 'Test Form');

    cy
      .get('.patient__sidebar')
      .should('be.visible');

    cy
      .get('.patient-action__name')
      .should('be.visible');

    cy
      .get('[data-activity-region]')
      .find('[data-activities-region]')
      .children()
      .its('length')
      .as('activityCount');

    cy
      .get('.js-expand-button')
      .click();

    cy
      .wait('@routeAction');

    cy
      .url()
      .should('contain', `/action/${ testAction.id }/form`);

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--form-expanded');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar')
      .should('not.be.visible');

    cy
      .get('.patient-action__details')
      .should('not.be.visible');

    cy
      .get('.form__title')
      .should('not.be.visible');

    cy
      .get('.form__actions-icon--expand')
      .should('be.visible')
      .find('.fa-down-left-and-up-right-to-center')
      .should('exist');

    cy
      .get('.tooltip')
      .should('not.exist');

    cy
      .get('.js-sidebar-button')
      .should('have.attr', 'aria-expanded', 'false')
      .click();

    cy
      .get('.patient__frame')
      .should('not.have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar')
      .should('be.visible');

    cy
      .get('.js-sidebar-button')
      .should('have.attr', 'aria-expanded', 'true');

    cy
      .get('.form__content')
      .find('iframe')
      .should('be.visible');

    cy.viewport(720, 720);

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar-toggle')
      .click();

    cy
      .get('.patient__sidebar')
      .should('be.visible');

    cy.viewport(1280, 720);

    cy
      .get('.patient__sidebar')
      .should('be.visible');

    cy
      .get('.js-expand-button')
      .click();

    cy
      .wait('@routeAction');

    cy
      .url()
      .should('contain', `/action/${ testAction.id }`)
      .should('not.contain', `/action/${ testAction.id }/form`);

    cy
      .get('.patient__frame')
      .should('not.have.class', 'patient__frame--sidebar-hidden')
      .and('not.have.class', 'patient__frame--form-expanded');

    cy
      .get('@activityCount')
      .then(activityCount => {
        cy
          .get('[data-activity-region]')
          .find('[data-activities-region]')
          .should('contain', 'Clinician McTester (Nurse) added this action from the Test Program program')
          .children()
          .its('length')
          .should('equal', activityCount);
      });

    cy.getRadio(Radio => {
      Radio.trigger('event-router', 'patient:form', '1', testForm.id);
    });

    cy
      .wait('@routeForm')
      .url()
      .should('contain', `/patient/1/form/${ testForm.id }`);

    cy.getRadio(Radio => {
      Radio.trigger('event-router', 'patient:action', '1', testAction.id);
    });

    cy
      .get('.patient-action .js-expand-button')
      .should('have.attr', 'aria-label', 'Increase Width')
      .click();

    cy
      .url()
      .should('contain', `/action/${ testAction.id }/form`);

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    cy
      .get('.patient-action .js-expand-button')
      .should('have.attr', 'aria-label', 'Decrease Width')
      .click();

    cy
      .url()
      .should('contain', `/action/${ testAction.id }`)
      .and('not.contain', `/action/${ testAction.id }/form`);

    cy
      .intercept('GET', '/api/actions/*', {
        delay: 1000,
        body: { data: testAction, included: [] },
      })
      .as('routeDelayedExpandedAction')
      .visit(`/patient/1/action/${ testAction.id }/form`)
      .wait('@routePatient');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--form-expanded')
      .and('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.patient__sidebar')
      .should('not.be.visible');

    cy
      .wait('@routeDelayedExpandedAction');

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    cy
      .get('.patient__frame')
      .should('have.class', 'patient__frame--sidebar-hidden');

    cy
      .get('.js-sidebar-button')
      .should('have.attr', 'aria-expanded', 'false');

    cy
      .get('[data-worklists-region] .app-nav__link')
      .first()
      .click();

    cy
      .url()
      .should('contain', '/worklist/owned-by');

    cy
      .get('.app-nav')
      .should('not.have.class', 'is-minimized')
      .should('have.class', 'is-full-nav-visible');
  });

  specify('deleted action', function() {
    const testPatient = getPatient({ id: '1' });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .intercept('GET', '/api/actions/1*', {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find action',
            source: { parameter: 'actionId' },
          }),
        },
      })
      .as('routeAction')
      .visit('/patient/1/action/1')
      .wait('@routeAction');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .url()
      .should('contain', '/patient/1/workflow')
      .should('not.contain', '/action/');
  });

  specify('action server error', function() {
    const testPatient = getPatient({ id: '1' });

    cy.on('uncaught:exception', () => false);

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .intercept('GET', '/api/actions/1*', {
        statusCode: 500,
        body: {
          errors: getErrors({
            status: '500',
            title: 'Server Error',
            detail: 'Cannot load action',
          }),
        },
      })
      .as('routeAction')
      .visit('/patient/1/action/1')
      .wait('@routeAction');

    cy
      .get('.error-page')
      .should('contain', 'Error code: 500.');
  });

  specify('action unexpected client error', function() {
    const testPatient = getPatient({ id: '1' });
    const errorStub = cy.stub();

    cy.on('uncaught:exception', error => {
      errorStub(error);

      return false;
    });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .intercept('GET', '/api/actions/1*', {
        statusCode: 404,
        body: {
          errors: getErrors({
            status: '404',
            title: 'Unexpected Client Error',
            detail: 'Cannot load action',
          }),
        },
      })
      .as('routeAction')
      .visit('/patient/1/action/1')
      .wait('@routeAction');

    cy
      .wrap(null)
      .should(() => {
        expect(errorStub).to.be.calledOnce;
        expect(errorStub.firstCall.args[0].message).to.contain('Error Status: 404');
      });
  });

  specify('outreach form', function() {
    const testFlow = getFlow();
    const testAction = getAction({
      attributes: {
        outreach: 'patient',
        sharing: 'responded',
      },
      relationships: {
        flow: getRelationship(testFlow),
        form: getRelationship(testForm),
        state: getRelationship(stateDone),
      },
    });

    cy
      .routesForPatientAction()
      .routeFlow(fx => {
        fx.data = testFlow;
        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .routePatientByFlow()
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action')
      .find('.form__frame--embedded')
      .should('contain', 'Test Form');

    cy
      .get('.patient-action__title-icon')
      .find('.fa-share-from-square');

    cy
      .get('.patient-action__form')
      .find('.js-response')
      .click();

    cy
      .location('pathname')
      .should('contain', `/flow/${ testFlow.id }/action/${ testAction.id }`);
  });

  specify('outreach form outside a flow', function() {
    const testAction = getAction({
      attributes: {
        outreach: 'patient',
        sharing: 'responded',
      },
      relationships: {
        form: getRelationship(testForm),
        state: getRelationship(stateDone),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .get('.patient-action__form .js-response')
      .click();

    cy
      .location('pathname')
      .should('contain', `/action/${ testAction.id }`);
  });

  specify('outreach pending sharing state', function() {
    const testAction = getAction({
      attributes: { sharing: 'pending' },
      relationships: { form: getRelationship(testForm) },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .get('.patient-action__sharing-state')
      .should('contain', 'Waiting for Response')
      .find('.fa-circle-dot')
      .should('exist');
  });

  specify('outreach canceled sharing state', function() {
    const testAction = getAction({
      attributes: { sharing: 'canceled' },
      relationships: { form: getRelationship(testForm) },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .get('.patient-action__sharing-state')
      .should('contain', 'Form Sharing Canceled')
      .find('.fa-octagon-minus')
      .should('exist');
  });

  specify('live comments and attachments', function() {
    const currentClinician = getCurrentClinician();
    const commentId = uuid();
    const fileId = uuid();
    const testAction = getAction({
      relationships: {
        comments: getRelationship([]),
        files: getRelationship([]),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .routeActionComments(fx => {
        fx.data = [];
        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [];
        return fx;
      })
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('@wsHandleMessage')
      .should('have.been.called');

    cy.sendWs({
      category: 'ActionCommentAdded',
      author: currentClinician.id,
      resource: { type: testAction.type, id: testAction.id },
      payload: {
        comment: { type: 'comments', id: commentId },
        attributes: { message: 'Comment delivered live' },
      },
    });

    cy
      .get('[data-activity-region]')
      .should('contain', 'Comment delivered live');

    cy.sendWs({
      category: 'CommentEdited',
      resource: { type: 'comments', id: commentId },
      payload: {
        attributes: { message: 'Comment updated live' },
      },
    });

    cy
      .get('[data-activity-region]')
      .should('contain', 'Comment updated live')
      .and('contain', '(Edited)');

    cy.sendWs({
      category: 'AttachmentAdded',
      resource: { type: testAction.type, id: testAction.id },
      payload: {
        file: { type: 'files', id: fileId },
        attributes: {
          path: 'patient/live-file.pdf',
          urls: {
            view: '/files/live-file/view',
            download: '/files/live-file/download',
          },
        },
      },
    });

    cy
      .get('[data-attachments-region]')
      .should('contain', 'live-file.pdf');

    cy.sendWs({
      category: 'FileReplaced',
      resource: { type: 'files', id: fileId },
      payload: {
        attributes: {
          path: 'patient/replaced-live-file.pdf',
          urls: {
            view: '/files/replaced-live-file/view',
            download: '/files/replaced-live-file/download',
          },
        },
      },
    });

    cy
      .get('[data-attachments-region]')
      .contains('a', 'replaced-live-file.pdf')
      .should('have.attr', 'href', '/files/replaced-live-file/view');

    cy.sendWs({
      category: 'AttachmentAdded',
      resource: { type: testAction.type, id: testAction.id },
      payload: {
        file: { type: 'files', id: uuid() },
        attributes: {
          path: 'patient/second-live-file.pdf',
          urls: {
            view: '/files/second-live-file/view',
            download: '/files/second-live-file/download',
          },
        },
      },
    });

    cy
      .get('[data-attachments-region]')
      .should('contain', 'second-live-file.pdf');
  });

  specify('action with work:owned:manage permission', function() {
    const testFile = getFile();

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testAction = getAction({
      attributes: {
        outreach: 'disabled',
        sharing: 'disabled',
        details: '',
        duration: 0,
      },
      relationships: {
        'owner': getRelationship(getCurrentClinician()),
        'state': getRelationship(stateTodo),
        'form': getRelationship(testForm),
        'files': getRelationship([testFile]),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      // NOTE: Tests upload attachments with canEdit permissions
      .routeSettings('upload_attachments', true)
      .routeSettings('dialer', 'five9')
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          relationships: {
            role: getRelationship(roleNoFilterEmployee),
          },
        });
        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [testFile];

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.patient-action__menu')
      .should('exist');

    cy
      .get('[data-action-region]')
      .find('.js-input');

    cy
      .get('[data-action-region]')
      .find('button')
      .should('have.length', 6);

    cy
      .get('[data-action-region]')
      .contains('Clinician McTester')
      .click();

    cy
      .get('.picklist')
      .contains('Nurse')
      .click()
      .wait('@routePatchAction');

    cy
      .get('.patient-action__menu')
      .should('not.exist');

    cy
      .get('[data-action-region]')
      .find('button')
      .should('have.length', 1)
      .and('have.class', 'dialer-component__button');

    cy
      .get('[data-action-region]')
      .find('.js-input')
      .should('not.exist');

    cy
      .get('[data-action-region]')
      .should('contain', 'No Duration')
      .find('.patient-action__no-results')
      .should('contain', 'No details');

    cy
      .get('[data-action-region]')
      .find('[data-dialer-region] button')
      .should('exist');

    cy
      .get('.patient-action')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 1)
      .find('.js-remove')
      .should('not.exist');

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('not.exist');

    cy
      .get('.patient-action')
      .find('[data-action-region]')
      .should('contain', 'You are not able to change settings on this action.');
  });

  specify('action with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

    const otherTeamAction = getAction({
      attributes: {
        name: 'Owned by another team',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(teamNurse),
      },
    });

    const nonTeamMemberAction = getAction({
      attributes: {
        name: 'Owned by non team member',
        updated_at: testTsSubtract(2),
      },
      relationships: {
        states: getRelationship(stateTodo),
        owner: getRelationship(nonTeamMemberClinician),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinician, nonTeamMemberClinician];

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [otherTeamAction, nonTeamMemberAction];

        return fx;
      })
      .routeAction(fx => {
        fx.data = otherTeamAction;

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeActionFiles()
      .visit(`/patient/1/action/${ otherTeamAction.id }`)
      .wait('@routeAction')
      .wait('@routePatient');

    cy
      .get('[data-action-region]')
      .should('contain', 'You are not able to change settings on this action.');

    cy
      .routeAction(fx => {
        fx.data = nonTeamMemberAction;

        return fx;
      });

    cy
      .visit(`/patient/1/action/${ nonTeamMemberAction.id }`)
      .wait('@routeAction');

    cy
      .get('[data-action-region]')
      .should('contain', 'You are not able to change settings on this action.');
  });

  specify('action with work:authored:delete permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const authoredByCurrentUserAction = getAction({
      attributes: {
        name: 'Authored by Current User',
      },
      relationships: {
        author: getRelationship(currentClinician),
        owner: getRelationship(teamCoordinator),
        state: getRelationship(stateInProgress),
      },
    });

    const notAuthoredByCurrentUserAction = getAction({
      attributes: {
        name: 'Not authored by Current User',
      },
      relationships: {
        author: getRelationship(getClinician()),
        state: getRelationship(stateInProgress),
        owner: getRelationship(teamCoordinator),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeAction(fx => {
        fx.data = authoredByCurrentUserAction;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [authoredByCurrentUserAction, notAuthoredByCurrentUserAction];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .routeActionFiles()
      .visit(`/patient/1/action/${ authoredByCurrentUserAction.id }`)
      .wait('@routeAction')
      .wait('@routePatient');

    cy
      .get('.patient-action__menu')
      .should('exist');

    cy
      .routeAction(fx => {
        fx.data = notAuthoredByCurrentUserAction;

        return fx;
      });

    cy
      .visit(`/patient/1/action/${ notAuthoredByCurrentUserAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__menu')
      .should('not.exist');
  });

  specify('flow action with work:owned:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    const otherClinician = getClinician();

    const testFlow = getFlow({
      relationships: {
        state: getRelationship(stateTodo),
        owner: getRelationship(currentClinician),
      },
    });

    const testAction = getAction({
      attributes: {
        details: 'Test Details',
        duration: 5,
        due_date: testDateSubtract(2),
        due_time: '07:15:00',
      },
      relationships: {
        owner: getRelationship(otherClinician),
        state: getRelationship(stateTodo),
        form: getRelationship(testForm),
        flow: getRelationship(testFlow),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [testAction];

        return fx;
      })
      .routePatientByFlow()
      .visit(`/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeFlow');

    cy
      .intercept('PATCH', `/api/flows/${ testFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchFlow');

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('[data-action-region]')
      .should('contain', 'Test Details')
      .and('contain', formatDate(testDateSubtract(2), 'SHORT'))
      .and('contain', '7:15 AM')
      .and('contain', '5 mins');

    cy
      .get('.patient-action')
      .find('[data-action-region] .patient-action__info')
      .should('contain', 'You are not able to change settings on this action.');
  });

  specify('flow action with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      attributes: {
        name: 'Non Team Member',
      },
      relationships: {
        team: getRelationship(teamNurse),
      },
    });

    const testFlow = getFlow({
      relationships: {
        state: getRelationship(stateInProgress),
      },
    });

    const ownedByAnotherTeamAction = getAction({
      attributes: {
        name: 'Owned by another team',
        sequence: 0,
      },
      relationships: {
        owner: getRelationship(teamNurse),
        state: getRelationship(stateInProgress),
        flow: getRelationship(testFlow),
      },
    });

    const ownedByNonTeamMemberAction = getAction({
      attributes: {
        name: 'Owned by non team member',
        sequence: 1,
      },
      relationships: {
        owner: getRelationship(nonTeamMemberClinician),
        state: getRelationship(stateInProgress),
        flow: getRelationship(testFlow),
      },
    });

    cy
      .routesForPatientAction()
      .routeCurrentClinician(fx => {
        fx.data = currentClinician;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinician, nonTeamMemberClinician];

        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [ownedByAnotherTeamAction, ownedByNonTeamMemberAction];

        return fx;
      })
      .routeAction(fx => {
        fx.data = ownedByAnotherTeamAction;
        return fx;
      })
      .routePatientByFlow()
      .visit(`/flow/${ testFlow.id }/action/${ ownedByAnotherTeamAction.id }`)
      .wait('@routeFlow')
      .wait('@routeAction');

    cy
      .get('[data-action-region]')
      .should('contain', 'You are not able to change settings on this action.');

    cy
      .routeAction(fx => {
        fx.data = ownedByNonTeamMemberAction;
        return fx;
      })
      .window()
      .then(win => {
        win.Radio.trigger(
          'event-router',
          'patient:flow:action',
          testFlow.relationships.patient.data.id,
          testFlow.id,
          ownedByNonTeamMemberAction.id,
        );
      })
      .wait('@routeAction');

    cy
      .get('[data-action-region]')
      .should('contain', 'You are not able to change settings on this action.');
  });

  // A patient action route can coalesce into a still-loading PatientApp (scope is the
  // patient, not the action). The action model is therefore not fetched by patient
  // startup and is not in the dashboard list, so the dispatch must fetch it on demand
  // rather than report it missing.
  specify('loads an action navigated to while the patient is still loading', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testAction = getAction({
      attributes: {
        name: 'Coalesced Action',
        updated_at: testTs(),
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    cy
      .routesForPatientAction()
      .routePatientActions(fx => {
        // action is NOT in the dashboard list, so it is not cached that way
        fx.data = [];

        return fx;
      })
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      });

    // delay the patient model so PatientApp stays in its loading state
    cy.intercept('GET', '/api/patients/**?*', {
      body: { data: testPatient, included: [] },
      delay: 1000,
    });

    cy.visit(`/patient/dashboard/${ testPatient.id }`);

    // while PatientApp is loading (preloader shown), navigate to the action
    cy.get('.loader').should('exist');
    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, testAction.id);
    });

    // the action is fetched on demand and the sidebar renders (rather than "not found")
    cy
      .wait('@routeAction')
      .wait('@routeActionActivity');

    cy
      .get('.patient-action__name')
      .should('contain', 'Coalesced Action');
  });

  specify('ignores stale on-demand action fetches after a newer action route', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    const staleAction = getAction({
      id: 'stale-action',
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    const currentAction = getAction({
      id: 'current-action',
      attributes: {
        name: 'Current Action',
        updated_at: testTs(),
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    let replyToStaleAction;

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routeActionActivity()
      .routeActionComments()
      .routeActionFiles()
      .intercept('GET', `/api/actions/${ staleAction.id }*`, req => new Cypress.Promise(resolve => {
        replyToStaleAction = () => {
          req.reply({
            statusCode: 410,
            body: {
              errors: getErrors({
                status: '410',
                title: 'Not Found',
                detail: 'Cannot find action',
                source: { parameter: 'actionId' },
              }),
            },
          });
          resolve();
        };
      }))
      .as('routeStaleAction')
      .intercept('GET', `/api/actions/${ currentAction.id }*`, {
        body: { data: currentAction, included: [] },
      })
      .as('routeCurrentAction');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient');

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, staleAction.id);
    });

    cy
      .wrap(null)
      .should(() => {
        expect(replyToStaleAction).to.be.a('function');
      });

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, currentAction.id);
    });

    cy
      .wait('@routeCurrentAction')
      .wait('@routeActionActivity');

    cy
      .get('.patient-action__name')
      .should('contain', 'Current Action');

    cy.then(() => replyToStaleAction());

    cy.wait('@routeStaleAction');

    cy
      .get('.alert-box__body')
      .should('not.exist');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/action/${ currentAction.id }`);
  });

  specify('ignores a stale on-demand action fetch that succeeds after a newer route', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    const staleAction = getAction({
      id: 'stale-action',
      attributes: {
        name: 'Stale Action',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    const currentAction = getAction({
      id: 'current-action',
      attributes: {
        name: 'Current Action',
        updated_at: testTs(),
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    let replyToStaleAction;

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routeActionActivity()
      .routeActionComments()
      .routeActionFiles()
      // the stale fetch succeeds, but resolves after the newer route
      .intercept('GET', `/api/actions/${ staleAction.id }*`, req => new Cypress.Promise(resolve => {
        replyToStaleAction = () => {
          req.reply({ body: { data: staleAction, included: [] } });
          resolve();
        };
      }))
      .as('routeStaleAction')
      .intercept('GET', `/api/actions/${ currentAction.id }*`, {
        body: { data: currentAction, included: [] },
      })
      .as('routeCurrentAction');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient');

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, staleAction.id);
    });

    cy
      .wrap(null)
      .should(() => {
        expect(replyToStaleAction).to.be.a('function');
      });

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, currentAction.id);
    });

    cy.wait('@routeCurrentAction');

    cy
      .get('.patient-action__name')
      .should('contain', 'Current Action');

    cy.then(() => replyToStaleAction());

    cy.wait('@routeStaleAction');

    // the stale fetch resolved last, but its sidebar is suppressed
    cy
      .get('.patient-action__name')
      .should('contain', 'Current Action');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/action/${ currentAction.id }`);
  });

  // The on-demand fetch must honor the same status-aware handling as beforeStart:
  // a 410 shows "not found" and redirects to the patient dashboard rather than
  // leaving the URL on a dead action route.
  specify('redirects to the patient dashboard when an on-demand action is gone', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .intercept('GET', '/api/actions/*', {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find action',
            source: { parameter: 'actionId' },
          }),
        },
      })
      .as('routeGoneAction');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient');

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, '1');
    });

    cy
      .wait('@routeGoneAction');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`)
      .should('not.contain', '/action/');
  });

  specify('redirects to the flow when an on-demand flow action is gone', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    const testFlow = getFlow({
      attributes: {
        name: 'Test Flow',
      },
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routeFlow(fx => {
        fx.data = testFlow;
        fx.included = [];

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [];
        fx.included = [];

        return fx;
      })
      .routeFlowActivity()
      .intercept('GET', '/api/actions/deleted-action*', {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find action',
            source: { parameter: 'actionId' },
          }),
        },
      })
      .as('routeGoneAction');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient');

    cy.window().then(win => {
      win.Radio.trigger('event-router', 'patient:flow:action', testPatient.id, testFlow.id, 'deleted-action');
    });

    cy
      .wait('@routeGoneAction');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/flow/${ testFlow.id }`)
      .should('not.contain', '/action/');
  });

  specify('redirects to the workflow when an action route flow is gone', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship([workspaceOne]),
      },
    });

    const testFlow = getFlow({
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
      },
    });

    const testAction = getAction({
      relationships: {
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .intercept('GET', `/api/flows/${ testFlow.id }*`, {
        statusCode: 410,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find flow',
            source: { parameter: 'flowId' },
          }),
        },
      })
      .as('routeGoneFlow')
      .visit(`/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ testAction.id }`)
      .wait('@routeGoneFlow');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Flow you requested does not exist.');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/workflow`)
      .should('not.contain', '/flow/');
  });
});
