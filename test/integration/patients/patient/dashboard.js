import _ from 'underscore';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateSubtract } from 'helpers/test-date';
import { getRelationship, mergeJsonApi } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { getProgram } from 'support/api/programs';
import { teamCoordinator, teamNurse, teamOther } from 'support/api/teams';
import { stateTodo, stateInProgress, stateDone } from 'support/api/states';
import { testForm } from 'support/api/forms';
import { workspaceOne } from 'support/api/workspaces';
import { roleEmployee, roleAdmin, roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';

import { ACTION_OUTREACH } from 'js/static';

context('patient dashboard page', function() {
  const testPatient = getPatient();

  function createActionPostRoute(id) {
    cy
      .intercept('POST', `/api/patients/${ testPatient.id }/relationships/actions*`, {
        statusCode: 201,
        body: {
          data: {
            id,
            attributes: {
              updated_at: testTs(),
              outreach: 'disabled',
              sharing: 'disabled',
              due_time: null,
            },
            relationships: {
              author: getRelationship(getCurrentClinician()),
            },
          },
        },
      })
      .as('routePostAction');
  }

  specify('action and flow list', function() {
    const testTime = dayjs(testDate()).hour(12).valueOf();

    const testAction = getAction({
      attributes: {
        name: 'First In List',
        details: 'Action details content.',
        duration: 0,
        due_date: null,
        due_time: null,
        updated_at: testTs(),
      },
      relationships: {
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
        form: getRelationship(testForm),
        files: getRelationship([{ id: '1' }], 'files'),
      },
    });

    const testFlow = getFlow({
      attributes: {
        name: 'Last In List',
        updated_at: testTsSubtract(5),
      },
      relationships: {
        state: getRelationship(stateInProgress),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = mergeJsonApi(testPatient, {
          relationships: {
            workspaces: getRelationship(workspaceOne),
          },
        });

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          testAction,
          getAction({
            attributes: {
              name: 'Third In List',
              details: null,
              updated_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
          }),
          getAction({
            attributes: {
              name: 'Outreach',
              updated_at: testTsSubtract(3),
              outreach: ACTION_OUTREACH.PATIENT,
            },
            relationships: {
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
          }),
          getAction({
            attributes: {
              name: 'Not In List',
              updated_at: testTsSubtract(5),
            },
            relationships: {
              state: getRelationship(stateDone),
              patient: getRelationship(testPatient),
            },
          }),
        ];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              name: 'Second In List',
              updated_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
          }),
          testFlow,
          getFlow({
            attributes: {
              name: 'Not In List',
              updated_at: testTsSubtract(5),
            },
            relationships: {
              state: getRelationship(stateDone),
              patient: getRelationship(testPatient),
            },
          }),
        ];

        return fx;
      })
      .routeAction(fx => {
        fx.data = testAction;
        return fx;
      })
      .visitOnClock(`/patient/dashboard/${ testPatient.id }`, { now: testTime, functionNames: ['Date'] })
      .wait('@routePatient')
      .wait('@routePatientFlows');

    cy
      .wait('@routePatientActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[state]=22222,33333');

    // Filters out done id 55555
    cy
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 5);

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
      .get('.patient__list')
      .find('.table-list__item')
      .first()
      .should('contain', 'First In List')
      .next()
      .should('contain', 'Second In List')
      .next()
      .should('contain', 'Third In List')
      .next()
      .should('contain', 'Outreach')
      .next()
      .should('contain', 'Last In List');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Action details content.');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.patient__list')
      .find('.fa-share-from-square');

    cy
      .get('.patient__list')
      .contains('First In List')
      .click();

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-state-region]')
      .find('.fa-circle-exclamation')
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
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-owner-region]')
      .should('contain', 'CO')
      .click();

    cy
      .get('.picklist')
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
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-due-date-region]')
      .click();

    cy
      .get('.datepicker')
      .contains('Today')
      .click();

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        // Datepicker doesn't use timestamp so due_date is local.
        expect(data.attributes.due_date).to.equal(testDate());
      });

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('9:45 AM')
      .click();

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-due-time-region] .is-overdue');

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('09:45:00');
      });

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .last()
      .as('flowItem');

    cy
      .get('@flowItem')
      .find('.fa-circle-dot');

    cy
      .get('@flowItem')
      .find('[data-owner-region]')
      .should('contain', 'CO')
      .click();

    cy
      .get('.picklist')
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
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .get('@flowItem')
      .find('.patient__action-name')
      .click()
      .wait('@routeFlow')
      .wait('@routePatientByFlow')
      .wait('@routeFlowActions');

    cy
      .url()
      .should('contain', `flow/${ testFlow.id }`);

    cy
      .go('back');

    cy
      .get('.patient__list')
      .find('.is-selected')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .find('.js-picklist-item')
      .contains('Done')
      .click()
      .tick(800); // the length of the animation

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateDone.id);
      });

    cy
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 4);

    cy
      .get('.sidebar')
      .find('.fa-circle-check')
      .click();

    cy
      .get('.picklist')
      .contains('To Do')
      .click();

    cy
      .get('.patient__list')
      .find('tr')
      .should('have.lengthOf', 5);

    cy
      .get('.table-list__item')
      .first()
      .next()
      .next()
      .find('[data-form-region]')
      .should('be.empty')
      .find('.fa-paperclip')
      .should('not.exist');

    // dirty hack to make sure the form button isn't offscreen
    cy
      .get('.table-list__item')
      .first()
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .contains('Clear')
      .click();

    cy
      .get('.table-list__item')
      .first()
      .find('.fa-paperclip')
      .should('exist');

    cy
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormActionFields()
      .routeFormResponse();

    cy
      .get('.table-list__item')
      .first()
      .find('[data-form-region]')
      .find('button')
      .click();

    cy
      .url()
      .should('contain', `patient-action/${ testAction.id }/form/${ testForm.id }`);
  });

  specify('add action and flow', function() {
    const currentClinican = getCurrentClinician({
      relationships: {
        role: getRelationship(roleEmployee),
      },
    });

    const testProgramIds = _.times(5, () => uuid());

    const testProgramActions = [
      getAction({
        attributes: {
          name: 'One of One',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: 'details',
          days_until_due: 1,
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          form: getRelationship(testForm),
          teams: getRelationship([teamNurse]),
        },
      }),
      getAction({
        attributes: {
          name: 'One of Two',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          outreach: 'patient',
          details: '',
          days_until_due: 0,
        },
        relationships: {
          owner: getRelationship(null),
        },
      }),
      getAction({
        attributes: {
          name: 'Two of Two',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          days_until_due: null,
        },
      }),
      getAction({
        attributes: {
          name: 'Should not show - unpublished',
          behavior: 'standard',
          published_at: null,
          archived_at: null,
          days_until_due: null,
        },
      }),
      getAction({
        attributes: {
          name: 'Should not show - archived',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: testTs(),
          days_until_due: null,
        },
      }),
      getAction({
        attributes: {
          name: 'Should not show - automated behavior',
          behavior: 'automated',
          published_at: testTs(),
          archived_at: null,
          days_until_due: null,
        },
      }),
      getAction({
        attributes: {
          name: 'Should not show - not visible to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: 1,
        },
        relationships: {
          teams: getRelationship([teamCoordinator]),
        },
      }),
    ];

    const testProgramFlows = [
      getFlow({
        attributes: {
          name: '1 Flow',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[0], 'programs'),
          state: getRelationship(stateTodo),
          owner: getRelationship(teamOther),
          teams: getRelationship([teamNurse]),
        },
      }),
      getFlow({
        attributes: {
          name: '2 Flow',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getFlow({
        attributes: {
          name: '3 Flow',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getFlow({
        attributes: {
          name: 'Should not show - unpublished',
          behavior: 'standard',
          published_at: null,
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getFlow({
        attributes: {
          name: 'Should not show - archived',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: testTs(),
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getFlow({
        attributes: {
          name: 'Should not show - automated behavior',
          behavior: 'automated',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
        },
      }),
      getFlow({
        attributes: {
          name: 'Should not show - not visible to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          teams: getRelationship([teamCoordinator]),
        },
      }),
    ];

    const testPrograms = [
      getProgram({
        id: testProgramIds[0],
        attributes: {
          name: 'Two Actions, One Published, One Flow',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship([{ id: testProgramFlows[0].id }], 'flows'),
          'program-actions': getRelationship(
            [
              { id: testProgramActions[0].id },
              { id: testProgramActions[3].id },
              { id: testProgramActions[4].id },
              { id: testProgramActions[5].id },
              { id: testProgramActions[6].id },
            ], 'actions',
          ),
        },
      }),
      getProgram({
        id: testProgramIds[1],
        attributes: {
          name: 'Two Published Actions and Flows',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship(
            [
              { id: testProgramFlows[1].id },
              { id: testProgramFlows[2].id },
              { id: testProgramFlows[3].id },
              { id: testProgramFlows[4].id },
              { id: testProgramFlows[5].id },
              { id: testProgramFlows[6].id },
            ], 'flows',
          ),
          'program-actions': getRelationship(
            [
              { id: testProgramActions[1].id },
              { id: testProgramActions[2].id },
              { id: testProgramActions[3].id },
              { id: testProgramActions[4].id },
              { id: testProgramActions[5].id },
              { id: testProgramActions[6].id },
            ], 'actions',
          ),
        },
      }),
      getProgram({
        id: testProgramIds[2],
        attributes: {
          name: 'No Actions, No Flows',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship([]),
          'program-actions': getRelationship([]),
        },
      }),
      getProgram({
        id: testProgramIds[3],
        attributes: {
          name: 'Should not show - unpublished',
          published_at: null,
          archived_at: null,
        },
        relationships: {
          'program-flows': getRelationship([]),
          'program-actions': getRelationship([]),
        },
      }),
      getProgram({
        id: testProgramIds[4],
        attributes: {
          name: 'Should not show - archived',
          published_at: testTs(),
          archived_at: testTs(),
        },
        relationships: {
          'program-flows': getRelationship([]),
          'program-actions': getRelationship([]),
        },
      }),
    ];

    cy
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

        return fx;
      })
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePrograms(fx => {
        fx.data = testPrograms;

        return fx;
      })
      .routeAllProgramActions(fx => {
        fx.data = testProgramActions;

        return fx;
      })
      .routeAllProgramFlows(fx => {
        fx.data = testProgramFlows;

        return fx;
      })
      .routeFlowActivity()
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePrograms')
      .wait('@routeAllProgramActions')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[behavior]=standard')
      .wait('@routeAllProgramFlows')
      .itsUrl()
      .its('search')
      .should('contain', 'filter[behavior]=standard');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    const headingOrder = [
      'Add Flow or Action',
      'No Actions, No Flows',
      'Two Actions, One Published, One Flow',
      'Two Published Actions and Flows',
    ];

    cy
      .get('.picklist')
      .find('.picklist__heading')
      .then($headings => {
        $headings.each((idx, $heading) => {
          expect($heading).to.contain(headingOrder[idx]);
        });
      });

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .should('contain', '1 Flow')
      .should('contain', 'One of One');


    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .should('contain', '2 Flow')
      .should('contain', '3 Flow')
      .should('contain', 'One of Two')
      .should('contain', 'Two of Two');

    cy
      .get('.picklist')
      .contains('No Actions, No Flows')
      .next()
      .should('contain', 'No Published Actions')
      .click();

    cy
      .get('.picklist')
      .should('not.contain', 'Should not show');

    createActionPostRoute('test-1');

    cy
      .get('.picklist')
      .contains('One of One')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('One of One');
        expect(data.attributes.details).to.be.undefined;
        expect(data.attributes.duration).to.be.undefined;
        expect(data.attributes.due_date).to.be.undefined;
        expect(data.attributes.due_time).to.be.undefined;
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.owner.data.id).to.equal(teamCoordinator.id);
        expect(data.relationships.owner.data.type).to.equal(teamCoordinator.type);
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/test-1`);

    cy
      .get('.patient__list')
      .find('.is-selected')
      .should('contain', 'One of One');

    cy
      .get('.sidebar')
      .find('.action-sidebar__name')
      .should('contain', 'One of One');

    cy
      .get('.sidebar')
      .find('.js-menu')
      .should('not.exist');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    createActionPostRoute('test-2');

    cy
      .get('.picklist')
      .contains('One of Two')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('One of Two');
        expect(data.attributes.details).to.be.undefined;
        expect(data.attributes.duration).to.be.undefined;
        expect(data.attributes.due_date).to.be.undefined;
        expect(data.attributes.due_time).to.be.undefined;
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships.owner.data.id).to.be.equal(currentClinican.id);
        expect(data.relationships.owner.data.type).to.be.equal(currentClinican.type);
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/test-2`);

    cy
      .get('.patient__list')
      .find('.is-selected')
      .should('contain', 'One of Two');

    cy
      .get('.sidebar')
      .find('.action-sidebar__name')
      .should('contain', 'One of Two');

    cy
      .get('.sidebar')
      .find('.js-menu')
      .should('not.exist');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    createActionPostRoute('test-3');

    cy
      .get('.picklist')
      .contains('Two of Two')
      .click();

    cy
      .wait('@routePostAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.name).to.equal('Two of Two');
        expect(data.attributes.due_date).to.be.undefined;
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/test-3`);

    cy
      .get('.patient__list')
      .find('.is-selected')
      .should('contain', 'Two of Two');

    cy
      .get('.sidebar')
      .find('.action-sidebar__name')
      .should('contain', 'Two of Two');

    cy
      .intercept('POST', `/api/patients/${ testPatient.id }/relationships/flows*`, {
        statusCode: 201,
        body: {
          data: {
            id: '1',
            attributes: { updated_at: testTs() },
          },
        },
      })
      .as('routePostFlow');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    cy
      .routeFlow()
      .routeFlowActions()
      .routePatientByFlow();

    cy
      .get('.picklist')
      .contains('1 Flow')
      .click();

    cy
      .wait('@routePostFlow')
      .its('request.body')
      .should(({ data }) => {
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships['program-flow'].data.id).to.be.equal(testProgramFlows[0].id);
      });

    cy
      .url()
      .should('contain', 'flow/1');

    cy
      .get('.patient-flow__header')
      .find('.patient-flow__name')
      .click();

    cy
      .get('.sidebar')
      .find('.js-menu')
      .should('not.exist');
  });

  specify('non work:own clinician', function() {
    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = getCurrentClinician({
          id: '123456',
          attributes: {
            enabled: true,
          },
          relationships: {
            role: getRelationship(roleAdmin),
          },
        });

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('[data-add-workflow-region]')
      .should('be.empty');
  });

  specify('work with work:owned:manage permission', function() {
    const currentClinican = getCurrentClinician({
      relationships: {
        role: getRelationship(roleNoFilterEmployee),
      },
    });

    cy
      .routesForPatientDashboard()
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'First In List',
              details: null,
              duration: 0,
              due_date: null,
              due_time: null,
              updated_at: testTs(),
            },
            relationships: {
              owner: getRelationship(currentClinican),
              state: getRelationship(stateTodo),
              form: getRelationship(testForm),
              files: getRelationship([{ id: '1' }], 'files'),
            },
          }),
          getAction({
            attributes: {
              name: 'Third In List',
              updated_at: testTsSubtract(2),
              due_time: '09:00:00',
              due_date: testDateSubtract(2),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [
          getFlow({
            attributes: {
              name: 'Second In List',
              updated_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(currentClinican),
            },
          }),
          getFlow({
            attributes: {
              name: 'Last In List',
              updated_at: testTsSubtract(6),
            },
            relationships: {
              state: getRelationship(stateTodo),
              owner: getRelationship(teamCoordinator),
            },
          }),
        ];

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('button')
      .should('have.length', 5);

    cy
      .get('@listItems')
      .eq(1)
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('@listItems')
      .eq(2)
      .find('button')
      .should('not.exist');

    cy
      .get('@listItems')
      .eq(3)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  specify('work with work:team:manage permission', function() {
    const currentClinican = getCurrentClinician({
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

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeCurrentClinician(fx => {
        fx.data = currentClinican;

        return fx;
      })
      .routeWorkspaceClinicians(fx => {
        fx.data = [currentClinican, nonTeamMemberClinician];

        return fx;
      })
      .routePatientActions(fx => {
        fx.data = [
          getAction({
            attributes: {
              name: 'Owned by another team',
              updated_at: testTsSubtract(1),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(teamNurse),
            },
          }),
          getAction({
            attributes: {
              name: 'Owned by non team member',
              updated_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              owner: getRelationship(nonTeamMemberClinician),
            },
          }),
        ];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.patient__list')
      .find('.table-list__item')
      .as('listItems')
      .first()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('@listItems')
      .last()
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');
  });

  specify('410 patient not found error', function() {
    cy
      .intercept('GET', '/api/patients/1*', {
        statusCode: 410,
        body: {},
      })
      .as('routePatient')
      .visit('/patient/dashboard/1');

    cy
      .get('.error-page')
      .should('contain', 'Something went wrong.')
      .and('contain', ' This page doesn\'t exist.');

    cy
      .url()
      .should('contain', '/404');
  });
});
