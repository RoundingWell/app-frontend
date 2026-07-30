import dayjs from 'dayjs';
import { v7 as uuid } from 'uuid';

import formatDate from 'helpers/format-date';
import { testTs, testTsSubtract, testTsAdd } from 'helpers/test-timestamp';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getRelationship, getErrors } from 'helpers/json-api';
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
import { getFile } from 'support/api/files';
import { getPatientField } from 'support/api/patient-fields';

const sharedIconScript = `const symbols = [{
  id: 'far-fa-octagon-minus',
  prefix: 'far',
  iconName: 'octagon-minus',
  width: 16,
  height: 16,
  paths: ['M1 1h14v14H1z'],
}];
const attribute = 'data-care-ops-fontawesome-shared-symbols';
const svgNamespace = 'http://www.w3.org/2000/svg';

function setAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
}

function createSymbolsSvg(targetDocument) {
  const svg = targetDocument.createElementNS(svgNamespace, 'svg');

  svg.style.display = 'none';

  for (const symbolDefinition of symbols) {
    const symbol = targetDocument.createElementNS(svgNamespace, 'symbol');

    setAttributes(symbol, {
      'aria-hidden': 'true',
      'data-icon': symbolDefinition.iconName,
      'data-prefix': symbolDefinition.prefix,
      'id': symbolDefinition.id,
      'overflow': 'visible',
      'role': 'img',
      'viewBox': \`0 0 \${ symbolDefinition.width } \${ symbolDefinition.height }\`,
    });

    for (const pathData of symbolDefinition.paths) {
      const path = targetDocument.createElementNS(svgNamespace, 'path');

      setAttributes(path, {
        d: pathData,
        fill: 'currentColor',
      });
      symbol.appendChild(path);
    }

    svg.appendChild(symbol);
  }

  return svg;
}

function mountIconSymbols(options = {}) {
  const targetDocument = options.document || globalThis.document;

  if (!targetDocument?.body) return null;

  const existingContainer = targetDocument.querySelector(\`[\${ attribute }]\`);

  if (existingContainer) return existingContainer;

  const container = targetDocument.createElement('div');

  container.setAttribute(attribute, '');
  container.style.display = 'none';
  container.appendChild(createSymbolsSvg(targetDocument));
  targetDocument.body.insertBefore(container, targetDocument.body.firstChild);

  return container;
}

if (globalThis.document?.body) {
  mountIconSymbols();
} else if (globalThis.document) {
  globalThis.document.addEventListener('DOMContentLoaded', () => mountIconSymbols(), { once: true });
}

export {
  mountIconSymbols,
  symbols,
};

export default mountIconSymbols;
`;

context('patient action page', function() {
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
      .wait('@routeAction')
      .wait('@routeActionActivity')
      .wait('@routePatient')
      .tick(350); // since this test uses visitOnClock, we need this for the sidebar animation

    cy
      .get('.patient-action')
      .find('[data-save-region]')
      .should('be.empty');

    cy
      .get('.patient-action')
      .find('[data-details-region] .js-input')
      .clear();

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
      .type('cancel this text');

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
      .should('contain', 'Time')
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
      .intercept('DELETE', `/api/actions/${ testAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routeDeleteFlowAction');

    cy
      .get('.patient-action')
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
      .get('@actionDialerButton')
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
      .contains('Remove')
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
      .get('.list-page__list')
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
      .get('.list-page__list')
      .find('.table-list__item .fa-paperclip')
      .should('exist');

    cy
      .get('.patient-action')
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
      .get('.list-page__list')
      .find('.table-list__item .fa-paperclip')
      .should('not.exist');
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
        statusCode: 204,
        body: {},
      })
      .as('routePostComment');

    cy
      .get('@commentRegion')
      .find('.js-post')
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
      .get('.list-page__list')
      .find('.table-list__item .fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

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
      .get('.list-page__list')
      .find('.table-list__item .fa-comment')
      .should('exist')
      .next()
      .should('contain', '2');

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
      .get('.list-page__list')
      .find('.table-list__item .fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

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
      .get('.list-page__list')
      .find('.table-list__item .fa-comment')
      .should('not.exist');
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
      .routeFormDefinition()
      .routeLatestFormResponse()
      .visit(`/patient/1/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__name')
      .should('contain', 'Program Action Name');

    cy
      .get('.patient-action')
      .find('[data-attachments-region]')
      .contains('No Attachments');

    cy
      .get('.patient-action')
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
      .should('contain', `patient/${ testAction.relationships.patient.data.id }/form/${ testForm.id }/action/${ testAction.id }`);

    cy
      .go('back');
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

  specify('outreach', function() {
    const testPatient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
      relationships: {
        workspaces: getRelationship(workspaceOne),
      },
    });

    const testOutreachAction = getAction({
      attributes: {
        name: 'Outreach Action',
        outreach: 'patient',
        sharing: 'pending',
        updated_at: testTsAdd(2),
      },
      relationships: {
        form: getRelationship(testForm),
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    const testCanceledOutreachAction = getAction({
      attributes: {
        name: 'Canceled Outreach Action',
        outreach: 'patient',
        sharing: 'canceled',
        updated_at: testTsAdd(1),
      },
      relationships: {
        form: getRelationship(testForm),
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    const testErrorOutreachAction = getAction({
      attributes: {
        name: 'Error Outreach Action',
        outreach: 'patient',
        sharing: 'error_opt_out',
        updated_at: testTsAdd(0),
      },
      relationships: {
        form: getRelationship(testForm),
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
      },
    });

    cy
      .intercept('GET', '/icons/icons.js', {
        statusCode: 200,
        headers: { 'content-type': 'application/javascript' },
        body: sharedIconScript,
      })
      .as('routeSharedIcons');

    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = testOutreachAction;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [testOutreachAction, testCanceledOutreachAction, testErrorOutreachAction];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/${ testPatient.id }/action/${ testOutreachAction.id }`)
      .wait('@routeSharedIcons')
      .wait('@routeAction');

    cy
      .get('[data-care-ops-fontawesome-shared-symbols]')
      .find('#far-fa-octagon-minus')
      .should('have.attr', 'overflow', 'visible');

    cy
      .intercept('PATCH', `/api/actions/${ testOutreachAction.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchAction');

    cy
      .get('.patient-action')
      .find('[data-form-region]')
      .contains('Test Form');

    cy
      .get('.patient-action')
      .find('[data-form-sharing-region]')
      .should('contain', 'Share Form')
      .should('contain', 'Test Patient')
      .should('contain', 'Waiting for Response')
      .find('.fa-circle-dot')
      .should('exist');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .contains('Canceled Outreach Action')
      .click();

    cy
      .get('.patient-action')
      .find('[data-form-sharing-region]')
      .should('contain', 'Form Sharing Canceled')
      .find('.fa-octagon-minus')
      .should('exist');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .contains('Error Outreach Action')
      .click();

    cy
      .get('.patient-action')
      .find('[data-form-sharing-region]')
      .should('contain', 'Recipient Opted Out')
      .find('.fa-octagon-minus')
      .should('exist');
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
      .get('.patient-action')
      .contains('View Response')
      .click();

    cy
      .url()
      .should('contain', `patient/${ testAction.relationships.patient.data.id }/form/${ testForm.id }/action/${ testAction.id }`);

    cy
      .go('back');
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
      .should('contain', 'No Duration')
      .find('.patient-action__no-results')
      .should('contain', 'No details');

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
      .wait('@routePatient');

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
      .get('.list-page__list')
      .find('.table-list__item')
      .last()
      .click('top')
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
      .get('.patient-action')
      .as('actionPage')
      .find('[data-menu-region]')
      .should('not.be.empty');

    cy
      .routeAction(fx => {
        fx.data = notAuthoredByCurrentUserAction;

        return fx;
      });

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .contains('Not authored by Current User')
      .click()
      .wait('@routeAction');

    cy
      .get('.patient-action')
      .as('actionPage')
      .find('[data-menu-region]')
      .should('be.empty');
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
      .get('.patient-action')
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
      .get('.list-page__list')
      .find('.table-list__item')
      .last()
      .click('top');

    cy
      .get('[data-action-region]')
      .should('contain', 'Permissions')
      .and('contain', 'You are not able to change settings on this action.');
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
        workspaces: getRelationship(workspaceOne),
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
      .intercept('GET', `/api/actions/${ staleAction.id }*`, {
        statusCode: 410,
        delay: 500,
        body: {
          errors: getErrors({
            status: '410',
            title: 'Not Found',
            detail: 'Cannot find action',
            source: { parameter: 'actionId' },
          }),
        },
      })
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
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, currentAction.id);
    });

    cy
      .wait('@routeCurrentAction')
      .wait('@routeActionActivity')
      .wait('@routeStaleAction');

    cy
      .get('.patient-action__name')
      .should('contain', 'Current Action');

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
        workspaces: getRelationship(workspaceOne),
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
      .intercept('GET', `/api/actions/${ staleAction.id }*`, {
        body: { data: staleAction, included: [] },
        delay: 500,
      })
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
      win.Radio.trigger('event-router', 'patient:action', testPatient.id, currentAction.id);
    });

    cy
      .wait('@routeCurrentAction')
      .wait('@routeStaleAction');

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
        workspaces: getRelationship(workspaceOne),
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
        workspaces: getRelationship(workspaceOne),
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
