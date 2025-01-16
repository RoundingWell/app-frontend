import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import formatDate from 'helpers/format-date';
import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getRelationship } from 'helpers/json-api';
import { getActivity } from 'support/api/events';
import { getAction } from 'support/api/actions';
import stateColors from 'helpers/state-colors';

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

// TODO: Update to mergejson api
context('action sidebar', function() {
  specify('display action sidebar', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();

    const currentClinician = getCurrentClinician();
    const testClinician = getClinician({
      id: '22222',
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
        name: 'Name',
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
        ];

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientFlows()
      .visitOnClock(`/patient/${ testPatient.id }/action/${ testAction.id }`, { now: testTime, functionNames: ['Date'] })
      .wait('@routePatientActions')
      .wait('@routePatientFlows')
      .wait('@routeAction')
      .wait('@routeActionActivity')
      .wait('@routePatient');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .clear();

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
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
        expect(data.relationships).to.be.undefined;
        expect(data.id).to.equal(testAction.id);
        expect(data.attributes.details).to.equal('');
        expect(data.attributes.due_date).to.not.exist;
        expect(data.attributes.due_time).to.not.exist;
        expect(data.attributes.duration).to.not.exist;
      });

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .type('cancel this text');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .contains('Cancel')
      // Need force because Cypress does not recognize the element is typeable
      .type('{enter}', { force: true });

    cy
      .get('.sidebar')
      .find('[data-details-region] .js-input')
      .should('have.value', '');

    cy
      .get('.sidebar')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.sidebar')
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
      .get('.sidebar')
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
      .get('.sidebar')
      .find('[data-owner-region]')
      .contains('Nurse')
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
      .get('.sidebar')
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
      .get('.sidebar')
      .find('[data-due-time-region]')
      .should('contain', 'Time')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.sidebar')
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
      .get('.sidebar')
      .find('[data-due-date-region]')
      .contains(formatDate(testDateSubtract(2), 'LONG'))
      .children()
      .should('have.css', 'color', stateColors.error)
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
      .get('.sidebar')
      .find('[data-due-time-region]')
      .find('.is-overdue');

    cy
      .get('.sidebar')
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
      .get('.sidebar')
      .find('[data-due-time-region]')
      .find('.is-overdue')
      .should('not.exist');

    cy
      .get('.sidebar')
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
      .get('.sidebar')
      .find('[data-due-date-region]')
      .contains(formatDate(testDate(), 'LONG'))
      .children()
      .should('not.have.css', 'color', stateColors.error)
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
      .get('.sidebar')
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
      .get('.sidebar')
      .find('[data-duration-region]')
      .contains('Select Duration')
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
      .get('.sidebar')
      .find('[data-state-region]')
      .contains('In Progress')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click();

    cy
      .get('.sidebar')
      .find('[data-form-sharing-region]')
      .should('contain', 'Share Form');

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
      .get('.sidebar')
      .find('.js-close')
      .click();

    cy
      .get('.sidebar')
      .should('not.exist');

    cy.go('back');

    cy
      .intercept('DELETE', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlowAction');

    cy
      .get('.sidebar')
      .find('.js-menu')
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

    cy.go('back');

    cy
      .get('.alert-box')
      .should('contain', 'The Action you requested does not exist');
  });

  specify('action attachments', function() {
    const testPatient = getPatient();

    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testAction = getAction({
      relationships: {
        'files': getRelationship([{ id: '1' }, { id: '2' }], 'files'),
        'patient': getRelationship(testPatient),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings(fx => {
        fx.data.push({ id: 'upload_attachments', attributes: { value: true } });

        return fx;
      })
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
        fx.data = [
          {
            id: '1',
            attributes: {
              path: `patients/${ testPatient.id }/HRA.pdf`,
              created_at: '2019-08-24T14:15:22Z',
            },
            meta: {
              view: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/view/HRA.pdf`,
              download: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/download/HRA.pdf`,
            },
          },
          {
            id: '2',
            attributes: {
              path: `patients/${ testPatient.id }/HRA v2.pdf`,
              created_at: '2019-08-25T14:15:22Z',
            },
            meta: {
              view: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/view/HRA%20v2.pdf`,
              download: `https://www.bucket_name.s3.amazonaws.com/patients/${ testPatient.id }/download/HRA%20v2.pdf`,
            },
          },
        ];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.sidebar')
      .find('[data-attachments-files-region]')
      .children()
      .as('attachmentItems')
      .should('have.length', 2);

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
      .contains('Download')
      .as('attachmentDownload')
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
      .contains('Remove')
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
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFile');

    cy
      .get('@attachmentItems')
      .first()
      .contains('Remove')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteFile')
      .itsUrl()
      .its('pathname')
      .should('contain', '/api/files/2');

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
              errors: [
                {
                  id: '1',
                  status: '400',
                  title: 'Bad Request',
                  detail: 'Another file exists for that path',
                  source: {
                    pointer: '/data/attributes/path',
                  },
                },
              ],
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
      .get('.sidebar')
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
        'files': getRelationship([], 'files'),
        'patient': getRelationship(testPatient),
        'program-action': getRelationship(testProgramAction),
        'state': getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings(fx => {
        fx.data.push({ id: 'upload_attachments', attributes: { value: true } });

        return fx;
      })
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
      .wait('@routePatientActions')
      .wait('@routePatientFlows')
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.patient__list')
      .find('.table-list__item .fa-paperclip')
      .should('not.exist');

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
      .get('.patient__list')
      .find('.table-list__item .fa-paperclip')
      .should('exist');

    cy
      .get('.sidebar')
      .find('[data-attachments-files-region]')
      .first()
      .contains('Remove')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click()
      .wait('@routeDeleteFile');

    cy
      .get('.patient__list')
      .find('.table-list__item .fa-paperclip')
      .should('not.exist');
  });

  specify('action attachments - uploads not allowed on program action', function() {
    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: [],
      },
    });

    const testAction = getAction({
      relationships: {
        'files': getRelationship([{ id: '1' }], 'files'),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings(fx => {
        fx.data.push({ id: 'upload_attachments', attributes: { value: true } });

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [
          {
            id: '1',
            attributes: {
              path: 'patients/1/HRA.pdf',
              created_at: '2019-08-24T14:15:22Z',
            },
            meta: {
              view: 'https://www.bucket_name.s3.amazonaws.com/patients/1/view/HRA.pdf',
              download: 'https://www.bucket_name.s3.amazonaws.com/patients/1/download/HRA.pdf',
            },
          },
        ];

        return fx;
      })
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.sidebar')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 1);

    cy
      .get('.sidebar')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('not.exist');
  });

  specify('action attachments - uploads not allowed for org', function() {
    const testProgramAction = getProgramAction({
      attributes: {
        allowed_uploads: ['pdf'],
      },
    });

    const testAction = getAction({
      relationships: {
        'files': getRelationship([{ id: '1' }], 'files'),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings(fx => {
        fx.data.push({ id: 'upload_attachments', attributes: { value: false } });

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;

        fx.included.push(testProgramAction);

        return fx;
      })
      .routeActionFiles(fx => {
        fx.data = [
          {
            id: '1',
            attributes: {
              path: 'patients/1/HRA.pdf',
              created_at: '2019-08-24T14:15:22Z',
            },
            meta: {
              view: 'https://www.bucket_name.s3.amazonaws.com/patients/1/view/HRA.pdf',
              download: 'https://www.bucket_name.s3.amazonaws.com/patients/1/download/HRA.pdf',
            },
          },
        ];

        return fx;
      })

      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction')
      .wait('@routeActionFiles');

    cy
      .get('.sidebar')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 1);

    cy
      .get('.sidebar')
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
              clinician: getRelationship('22222', 'clinicians'),
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
      .find('.js-post')
      .should('contain', 'Save')
      .should('be.disabled');

    cy
      .get('[data-activity-region]')
      .find('.js-cancel')
      .click();

    cy
      .get('@activityComment')
      .should('contain', 'Least Recent Message from Clinician McTester')
      .should('not.contain', '(Edited)');

    cy
      .get('@activityComment')
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
      .find('.js-input')
      .clear()
      .type('An edited comment');

    cy
      .get('[data-activity-region]')
      .find('.js-post')
      .click();

    cy
      .wait('@routePatchComment')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.message).to.equal('An edited comment');
      });

    cy
      .get('@activityComment')
      .should('contain', 'An edited comment')
      .find('.comment__edited');

    cy
      .intercept('DELETE', '/api/comments/*', {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteComment');

    cy
      .get('@activityComment')
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
      .wait('@routeDeleteComment');

    cy
      .get('[data-activity-region]')
      .find('.comment__item')
      .should('have.length', 2);

    cy
      .get('.sidebar')
      .find('[data-comment-region]')
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
        statusCode: 204,
        body: {},
      })
      .as('routePostComment');

    cy
      .get('@commentRegion')
      .find('.js-post')
      .should('contain', 'Post')
      .click();

    cy
      .wait('@routePostComment')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.message).to.equal('Test comment\nmore comment');
      });

    cy
      .get('[data-activity-region]')
      .find('.comment__item .comment__message')
      .last()
      .should('contain', 'Test comment')
      .should('contain', 'more comment');
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
      },
      relationships: {
        'form': getRelationship(testForm),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      .routeSettings(fx => {
        fx.data.push({ id: 'upload_attachments', attributes: { value: true } });

        return fx;
      })
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
      .routeFormDefinition()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.action-sidebar__name')
      .should('contain', 'Program Action Name');

    cy
      .get('.sidebar')
      .find('[data-attachments-region]')
      .contains('No Attachments');

    cy
      .get('.sidebar')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('exist');

    cy
      .get('[data-activity-region]')
      .find('[data-activities-region]')
      .should('contain', 'Clinician McTester (Nurse) added this action from the Test Program program')
      .children()
      .its('length')
      .should('equal', 5);

    cy
      .routePatientByAction();

    cy
      .get('[data-form-region] button')
      .should('contain', 'Test Form')
      .click();

    cy
      .url()
      .should('contain', `patient-action/${ testAction.id }/form/${ testForm.id }`);

    cy
      .go('back');
  });

  specify('deleted action', function() {
    cy
      .routesForPatientDashboard()
      .intercept('GET', '/api/actions/1*', {
        statusCode: 410,
        body: {
          errors: [{
            id: '1',
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find action',
            source: { parameter: 'actionId' },
          }],
        },
      })
      .as('routeAction')
      .visit('/patient/1/action/1')
      .wait('@routeAction');

    cy
      .get('.alert-box__body')
      .should('contain', 'The Action you requested does not exist.');

    cy
      .wait('@routePatientFlows')
      .get('.patient__list');
  });

  specify('outreach', function() {
    const testAction = getAction({
      attributes: {
        outreach: 'patient',
        sharing: 'pending',
      },
      relationships: {
        form: getRelationship(testForm),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.sidebar')
      .find('[data-form-region]')
      .contains('Test Form');

    cy
      .get('.sidebar')
      .contains('Cancel Share')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.sharing).to.equal('canceled');
      });

    cy
      .get('.sidebar')
      .contains('Undo Cancel Share')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.sharing).to.equal('pending');
      });
  });

  specify('outreach error', function() {
    const testAction = getAction({
      attributes: {
        outreach: 'patient',
        sharing: 'error_no_phone',
      },
      relationships: {
        form: getRelationship(testForm),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .intercept('PATCH', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.sidebar')
      .contains('Share Form Now')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.sharing).to.equal('pending');
      });
  });

  specify('outreach form', function() {
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
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .routePatientByAction();

    cy
      .get('.sidebar')
      .contains('View Response')
      .click();

    cy
      .url()
      .should('contain', `patient-action/${ testAction.id }/form/${ testForm.id }`);

    cy
      .go('back');
  });

  specify('action with work:owned:manage permission', function() {
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
        'files': getRelationship([{ id: '1' }], 'files'),
        'program-action': getRelationship(testProgramAction),
      },
    });

    cy
      .routesForPatientAction()
      // NOTE: Tests upload attachments with canEdit permissions
      .routeSettings(fx => {
        fx.data.push({ id: 'upload_attachments', attributes: { value: true } });

        return fx;
      })
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
        fx.data = [
          {
            id: '1',
            attributes: {
              path: 'patients/1/HRA.pdf',
              created_at: '2019-08-24T14:15:22Z',
            },
            meta: {
              view: 'https://www.bucket_name.s3.amazonaws.com/patients/1/view/HRA.pdf',
              download: 'https://www.bucket_name.s3.amazonaws.com/patients/1/download/HRA.pdf',
            },
          },
        ];

        return fx;
      })
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
      .get('[data-menu-region]')
      .find('.js-menu')
      .should('exist');

    cy
      .get('[data-action-region]')
      .find('.js-input');

    cy
      .get('[data-action-region]')
      .find('button')
      .should('have.length', 5);

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
      .get('[data-menu-region]')
      .find('.js-menu')
      .should('not.exist');

    cy
      .get('[data-action-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('[data-action-region]')
      .find('.js-input')
      .should('not.exist');

    cy
      .get('[data-action-region]')
      .should('contain', 'No details')
      .and('contain', 'No Duration');

    cy
      .get('.sidebar')
      .find('[data-attachments-files-region]')
      .children()
      .should('have.length', 1)
      .find('.js-remove')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-attachments-region]')
      .find('.js-add')
      .should('not.exist');

    cy
      .get('.sidebar')
      .find('[data-action-region]')
      .should('contain', 'Permissions')
      .and('contain', 'You are not able to change settings on this action.');
  });

  specify('action with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      id: '22222',
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
      .visit(`/patient/1/action/${ otherTeamAction }`)
      .wait('@routeAction')
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('[data-action-region]')
      .should('contain', 'Permissions')
      .and('contain', 'You are not able to change settings on this action.');

    cy
      .routeAction(fx => {
        fx.data = nonTeamMemberAction;

        return fx;
      });

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .last()
      .find('.patient__action-name')
      .click()
      .wait('@routeAction');

    cy
      .get('[data-action-region]')
      .should('contain', 'Permissions')
      .and('contain', 'You are not able to change settings on this action.');
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
        author: getRelationship('22222', 'clinicians'),
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
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar')
      .find('[data-menu-region]')
      .should('not.be.empty');

    cy
      .routeAction(fx => {
        fx.data = notAuthoredByCurrentUserAction;

        return fx;
      });

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .contains('Not authored by Current User')
      .click()
      .wait('@routeAction');

    cy
      .get('.app-frame__sidebar')
      .as('flowSidebar')
      .find('[data-menu-region]')
      .should('be.empty');
  });

  specify('flow action with work:owned:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    const otherClinician = getClinician({ id: '22222' });

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
      .get('[data-header-region]')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('Complete')
      .click();

    cy
      .get('.modal--small')
      .find('.js-submit')
      .click();

    cy
      .get('[data-action-region]')
      .should('contain', 'Test Details')
      .and('contain', formatDate(testDateSubtract(2), 'SHORT'))
      .and('contain', '7:15 AM')
      .and('contain', '5 mins');

    cy
      .get('.sidebar')
      .find('[data-action-region] .sidebar__label')
      .should('contain', 'Permissions');
  });

  specify('flow action with work:team:manage permission', function() {
    const currentClinician = getCurrentClinician({
      relationships: {
        role: getRelationship(roleTeamEmployee),
        team: getRelationship(teamCoordinator),
      },
    });

    const nonTeamMemberClinician = getClinician({
      id: '22222',
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
      .routePatientByFlow()
      .visit(`/flow/${ testFlow.id }/action/${ ownedByAnotherTeamAction.id }`)
      .wait('@routeFlow');

    cy
      .get('[data-action-region]')
      .should('contain', 'Permissions')
      .and('contain', 'You are not able to change settings on this action.');

    cy
      .get('.patient-flow__list')
      .find('.table-list__item')
      .last()
      .find('.patient__action-name')
      .click();

    cy
      .get('[data-action-region]')
      .should('contain', 'Permissions')
      .and('contain', 'You are not able to change settings on this action.');
  });
});
