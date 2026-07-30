import _ from 'underscore';
import dayjs from 'dayjs';
import { v7 as uuid, NIL as NIL_UUID } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateAdd, testDateSubtract } from 'helpers/test-date';
import { getRelationship, mergeJsonApi } from 'helpers/json-api';
import formatDate from 'helpers/format-date';

import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';
import { getClinician, getCurrentClinician } from 'support/api/clinicians';
import { getProgram } from 'support/api/programs';
import { getProgramAction } from 'support/api/program-actions';
import { getProgramFlow } from 'support/api/program-flows';
import { teamCoordinator, teamNurse, teamOther } from 'support/api/teams';
import { stateTodo, stateInProgress, stateDone } from 'support/api/states';
import { testForm } from 'support/api/forms';
import { workspaceOne } from 'support/api/workspaces';
import { roleEmployee, roleAdmin, roleNoFilterEmployee, roleTeamEmployee } from 'support/api/roles';
import { getComment } from 'support/api/comments';
import { getFile } from 'support/api/files';

import { ACTION_OUTREACH } from 'js/static';

context('patient workflow page', function() {
  const testPatient = getPatient();

  function createActionPostRoute(name) {
    const actionData = getAction({
      attributes: {
        name,
        updated_at: testTs(),
        outreach: 'disabled',
        sharing: 'disabled',
        due_time: null,
      },
      relationships: {
        author: getRelationship(getCurrentClinician()),
        state: getRelationship(stateTodo),
      },
    });

    cy
      .intercept('POST', '/api/actions', {
        statusCode: 201,
        body: {
          data: actionData,
        },
      })
      .as('routePostAction');

    cy.routeAction(fx => {
      fx.data = actionData;
      return fx;
    });

    return actionData.id;
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
        options: {
          icon: 'caret-down',
          iconType: 'fas',
          color: 'red',
        },
      },
      relationships: {
        owner: getRelationship(teamCoordinator),
        patient: getRelationship(testPatient),
        state: getRelationship(stateTodo),
        form: getRelationship(testForm),
        files: getRelationship([getFile()]),
        comments: getRelationship([getComment()]),
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

    const doneFlow = getFlow({
      attributes: {
        name: 'Done Flow',
        updated_at: testTsSubtract(5),
      },
      relationships: {
        state: getRelationship(stateDone),
        patient: getRelationship(testPatient),
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
              name: 'Done Action',
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
          doneFlow,
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
      .location('pathname')
      .should('equal', `/one/patient/dashboard/${ testPatient.id }`);

    cy
      .wait('@routePatientActions')
      .itsUrl()
      .its('search')
      .should('contain', `filter[states]=${ stateTodo.id },${ stateInProgress.id }`);

    // Filters out done id 55555
    cy
      .get('.list-page__list')
      .find('.table-list__item')
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
      .intercept('PATCH', `/api/flows/${ doneFlow.id }`, {
        statusCode: 204,
        body: {},
      })
      .as('routePatchDoneFlow');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .should('contain', 'First In List')
      .find('.table-list__icon--large')
      .find('.action-icon--red .fa-caret-down');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(1)
      .should('contain', 'Second In List');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .should('contain', 'Third In List')
      .find('.table-list__icon--large')
      .find('.fa-file-lines');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(3)
      .should('contain', 'Outreach')
      .find('.table-list__icon--large')
      .find('.fa-share-from-square');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .last()
      .should('contain', 'Last In List');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Action details content.');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .eq(2)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.list-page__list')
      .find('.fa-share-from-square');

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
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
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
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
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
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
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('9:45 AM')
      .click();

    cy
      .get('.list-page__list')
      .find('.table-list__item')
      .first()
      .find('[data-due-time-region] .is-overdue');

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('09:45:00');
      });

    cy
      .get('.patient__tabs')
      .find('.js-archive')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.table-list__item', 'Done Flow')
      .find('[data-state-region]')
      .click();

    cy
      .get('.picklist')
      .contains('In Progress')
      .click();

    cy
      .wait('@routePatchDoneFlow')
      .its('request.body.data.relationships.state.data.id')
      .should('equal', stateInProgress.id);

    cy
      .get('.patient__tabs')
      .find('.js-dashboard')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.list-page__list')
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
      .get('.list-page__list')
      .find('.table-list__item')
      .should('have.lengthOf', 5);

    cy
      .get('.table-list__item')
      .eq(2)
      .find('[data-form-region]')
      .should('be.empty');

    cy
      .get('.table-list__item')
      .eq(2)
      .find('.fa-paperclip')
      .should('not.exist');

    cy
      .get('.table-list__item')
      .eq(2)
      .find('.fa-comment')
      .should('not.exist');

    cy
      .get('.list-page__list')
      .contains('.table-list__item', testAction.attributes.name)
      .click('top')
      .wait('@routeAction');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy.go('back');

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
      .get('.table-list__item')
      .first()
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

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
      .should('contain', `patient/${ testPatient.id }/form/${ testForm.id }/action/${ testAction.id }`);
  });

  specify('add action and flow', function() {
    const currentClinican = getCurrentClinician({
      relationships: {
        team: getRelationship(teamNurse),
        role: getRelationship(roleEmployee),
      },
    });

    const testProgramIds = _.times(5, () => uuid());

    const testProgramActions = [
      getProgramAction({
        attributes: {
          name: 'One of One',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: 'details',
          days_until_due: 1,
          options: {
            icon: 'caret-down',
            iconType: 'fas',
            color: 'red',
          },
        },
        relationships: {
          owner: getRelationship(teamCoordinator),
          form: getRelationship(testForm),
          teams: getRelationship([teamNurse]),
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramAction({
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
      getProgramAction({
        attributes: {
          name: 'Two of Two',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Visible - restricted to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: null,
        },
        relationships: {
          teams: getRelationship([teamNurse]),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Visible - restricted to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: null,
        },
        relationships: {
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - unpublished',
          behavior: 'standard',
          published_at: null,
          archived_at: null,
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - archived',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: testTs(),
          days_until_due: null,
        },
      }),
      getProgramAction({
        attributes: {
          name: 'Should not show - automated behavior',
          behavior: 'automated',
          published_at: testTs(),
          archived_at: null,
          days_until_due: null,
        },
      }),
      getProgramAction({
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
      getProgramAction({
        attributes: {
          name: 'Should not show - not visible to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
          details: '',
          days_until_due: 1,
        },
        relationships: {
          roles: getRelationship([roleAdmin]),
        },
      }),
    ];

    const testProgramFlows = [
      getProgramFlow({
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
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramFlow({
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
      getProgramFlow({
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
      getProgramFlow({
        attributes: {
          name: 'Visible - restricted to current user team',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          teams: getRelationship([teamNurse]),
        },
      }),
      getProgramFlow({
        attributes: {
          name: 'Visible - restricted to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          roles: getRelationship([roleEmployee]),
        },
      }),
      getProgramFlow({
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
      getProgramFlow({
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
      getProgramFlow({
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
      getProgramFlow({
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
      getProgramFlow({
        attributes: {
          name: 'Should not show - not visible to current user role',
          behavior: 'standard',
          published_at: testTs(),
          archived_at: null,
        },
        relationships: {
          program: getRelationship(testProgramIds[1], 'programs'),
          roles: getRelationship([roleAdmin]),
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
              { id: testProgramFlows[7].id },
              { id: testProgramFlows[8].id },
              { id: testProgramFlows[9].id },
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
              { id: testProgramActions[7].id },
              { id: testProgramActions[8].id },
              { id: testProgramActions[9].id },
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
      .contains('No Actions, No Flows')
      .next()
      .find('.picklist__item')
      .first()
      .find('.fa-file-lines');

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .find('.picklist__item')
      .first()
      .should('contain', '1 Flow')
      .find('.fa-folder');

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .find('.picklist__item')
      .eq(1)
      .should('contain', 'One of One')
      .find('.action-icon--red.fa-caret-down');

    cy
      .get('.picklist')
      .contains('Two Actions, One Published, One Flow')
      .next()
      .find('.picklist__item')
      .eq(2)
      .should('contain', 'Visible - restricted to current user role')
      .parent()
      .find('.picklist__item')
      .last()
      .should('contain', 'Visible - restricted to current user team');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .should('contain', '2 Flow')
      .should('contain', '3 Flow');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .find('.picklist__item')
      .eq(2)
      .should('contain', 'One of Two')
      .find('.fa-share-from-square');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .find('.picklist__item')
      .eq(3)
      .should('contain', 'Two of Two')
      .find('.fa-file-lines');

    cy
      .get('.picklist')
      .contains('Two Published Actions and Flows')
      .next()
      .should('contain', 'Visible - restricted to current user team')
      .should('contain', 'Visible - restricted to current user role');

    cy
      .get('.picklist')
      .contains('No Actions, No Flows')
      .next()
      .should('contain', 'No Published Actions')
      .click();

    cy
      .get('.picklist')
      .should('not.contain', 'Should not show');

    const testOne = createActionPostRoute('One of One');

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
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[0].id);
      });

    cy
      .get('@wsHandleMessage')
      .should(stub => {
        const subscribedResources = _.flatten(stub.getCalls().map(call => call.args[0].data.resources));

        expect(subscribedResources).to.deep.include({
          id: testOne,
          type: 'patient-actions',
        });
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/${ testOne }`);

    cy
      .get('.patient-action')
      .should('contain', 'One of One');

    cy
      .get('.patient-action')
      .find('.js-menu')
      .should('not.exist');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows')
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    const testTwo = createActionPostRoute('One of Two');

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
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[1].id);
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/${ testTwo }`);

    cy
      .get('.patient-action')
      .should('contain', 'One of Two');

    cy
      .get('.patient-action')
      .find('.js-menu')
      .should('not.exist');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows')
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    const testThree = createActionPostRoute('Two of Two');

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
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[2].id);
      });

    cy
      .url()
      .should('contain', `patient/${ testPatient.id }/action/${ testThree }`);

    cy
      .get('.patient-action')
      .should('contain', 'Two of Two');

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    const testFlow = getFlow({
      attributes: { updated_at: testTs() },
    });

    cy
      .intercept('POST', `/api/patients/${ testPatient.id }/relationships/flows*`, {
        statusCode: 201,
        body: {
          data: testFlow,
        },
      })
      .as('routePostFlow');

    cy
      .get('[data-add-workflow-region]')
      .contains('Add')
      .click();

    cy
      .routeFlow()
      .routeFlowActions();

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
      .should('contain', `flow/${ testFlow.id }`);

    cy
      .get('.patient-flow__header-container')
      .find('.js-menu')
      .should('not.exist');
  });

  specify('flow list - socket notifications', function() {
    const testDateTime = testTs();

    const testSocketFlow = getFlow({
      attributes: {
        name: 'Test Flow - Subscribed on Page Load',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
      meta: {
        progress: {
          complete: 0,
          total: 2,
        },
      },
    });

    const testNewSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - Created Elsewhere',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewStateSocketFlow = getFlow({
      attributes: {
        name: 'New Flow - State Updated to Match Current Filter',
      },
      relationships: {
        state: getRelationship(stateTodo),
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
        fx.data = [];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [testSocketFlow];

        return fx;
      })
      .visitOnClock(`/patient/dashboard/${ testPatient.id }`, { now: testDateTime })
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const states = [stateTodo.id, stateInProgress.id].join();
        const patient = testPatient.id;

        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          actions: { states, patient, flow: NIL_UUID },
          flows: { states, patient },
        });

        expect(resources).to.deep.equal([
          getRelationship(testSocketFlow).data,
        ]);
      });

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.patient__action-ts')
      .should('contain', formatDate(testDateTime, 'TIME_OR_DAY'));

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    cy.sendWs({
      category: 'FlowProgressChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        attributes: {
          progress: {
            complete: 1,
            total: 3,
          },
        },
      },
    });

    cy
      .get('@firstRow')
      .find('.patient__flow-progress')
      .should('have.value', 1)
      .should('have.attr', 'max', 3);

    // state was set to done, which means it's removed from the list
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testSocketFlow.type,
        id: testSocketFlow.id,
      },
      payload: {
        state: {
          type: stateDone.type,
          id: stateDone.id,
        },
      },
    });

    // wait for fade-out animation to completely finish
    cy.tick(1000);

    cy
      .get('.table-list__empty-list')
      .should('contain', 'No Workflows');

    cy
      .routeFlow(fx => {
        fx.data = testNewSocketFlow;

        return fx;
      });

    cy.sendWs({
      category: 'ResourceCreated',
      resource: {
        type: testNewSocketFlow.type,
        id: testNewSocketFlow.id,
      },
      payload: {},
    });

    cy
      .wait('@routeFlow')
      .its('request.url')
      .should('contain', testNewSocketFlow.id);

    // verify the new flow is added to the ws subscription resources
    cy
      .get('@wsHandleMessage')
      .should('have.been.calledTwice')
      .then(stub => {
        const secondCallData = stub.getCall(1).args[0].data;
        const { resources } = secondCallData;

        expect(resources).to.deep.include({
          id: testNewSocketFlow.id,
          type: testNewSocketFlow.type,
        });
      });

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - Created Elsewhere');

    cy
      .routeFlow(fx => {
        fx.data = testNewStateSocketFlow;

        return fx;
      });

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that flow
    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .wait('@routeFlow')
      .its('request.url')
      .should('contain', testNewStateSocketFlow.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Flow - State Updated to Match Current Filter');

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    // ensures we subscribe correctly to models added to the worklist via ws
    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('@firstRow')
      .should('contain', 'New Name Via Websocket');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewStateSocketFlow.type,
        id: testNewStateSocketFlow.id,
      },
      payload: {},
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .should('have.length', 1);
  });

  specify('action list - socket notifications', function() {
    const testDateTime = testTs();
    const currentClinician = getCurrentClinician();
    const testSocketComment = getComment();
    const testSocketFileId = uuid();

    const testSocketAction = getAction({
      attributes: {
        name: 'Test Action - Subscribed on Page Load',
        updated_at: testTsSubtract(1),
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewSocketAction = getAction({
      attributes: {
        name: 'New Action - Created Elsewhere',
      },
      relationships: {
        state: getRelationship(stateTodo),
        patient: getRelationship(testPatient),
        owner: getRelationship(teamCoordinator),
      },
    });

    const testNewStateSocketAction = getAction({
      attributes: {
        name: 'New Action - State Updated to Match Current Filter',
      },
      relationships: {
        state: getRelationship(stateTodo),
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
        fx.data = [testSocketAction];

        return fx;
      })
      .routePatientFlows(fx => {
        fx.data = [];

        return fx;
      })
      .visitOnClock(`/patient/dashboard/${ testPatient.id }`, { now: testDateTime })
      .wait('@routePatient')
      .wait('@routePatientFlows')
      .wait('@routePatientActions');

    cy
      .get('@wsHandleMessage')
      .should('have.been.calledOnce')
      .then(stub => {
        const states = [stateTodo.id, stateInProgress.id].join();
        const patient = testPatient.id;

        const { filters, resources } = stub.getCall(0).args[0].data;

        expect(filters).to.deep.equal({
          actions: { states, patient, flow: NIL_UUID },
          flows: { states, patient },
        });

        expect(resources).to.deep.equal([
          getRelationship(testSocketAction).data,
        ]);
      });

    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.patient__action-ts')
      .should('contain', formatDate(testDateTime, 'TIME_OR_DAY'));

    cy.sendWs({
      category: 'DetailsChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          details: '',
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-details-region]')
      .should('be.empty');

    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    cy.sendWs({
      category: 'ActionDueChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        attributes: {
          due_date: testDateAdd(1),
          due_time: '07:00:00',
        },
      },
    });

    cy
      .get('@firstRow')
      .should($action => {
        expect($action.find('[data-due-date-region]')).to.contain(formatDate(testDateAdd(1), 'SHORT'));
        expect($action.find('[data-due-time-region]')).to.contain('7:00 AM');
      });

    cy.sendWs({
      category: 'ActionCommentAdded',
      author: currentClinician.id,
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        comment: {
          type: testSocketComment.type,
          id: testSocketComment.id,
        },
        attributes: {
          message: 'New websocket comment.',
        },
      },
    });

    cy
      .get('@firstRow')
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy.sendWs({
      category: 'AttachmentAdded',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        clinician: {
          type: currentClinician.type,
          id: currentClinician.id,
        },
        file: {
          type: 'files',
          id: testSocketFileId,
        },
        attributes: {
          path: 'patients/1/HRA.pdf',
          bucket: 'bucket_name',
          urls: {
            view: 'https://www.bucket_name.s3.amazonaws.com/patients/1/view/HRA.pdf',
            download: 'https://www.bucket_name.s3.amazonaws.com/patients/1/download/HRA.pdf',
          },
        },
      },
    });

    cy
      .get('@firstRow')
      .find('.fa-paperclip')
      .should('exist');

    // state was set to done, which means it's removed from the list
    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testSocketAction.type,
        id: testSocketAction.id,
      },
      payload: {
        state: {
          type: stateDone.type,
          id: stateDone.id,
        },
      },
    });

    // wait for fade-out animation to completely finish
    cy.tick(1000);

    cy
      .get('.table-list__empty-list')
      .should('contain', 'No Workflows');

    cy
      .routeAction(fx => {
        fx.data = testNewSocketAction;

        return fx;
      });

    cy.sendWs({
      category: 'ResourceCreated',
      resource: {
        type: testNewSocketAction.type,
        id: testNewSocketAction.id,
      },
      payload: {},
    });

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewSocketAction.id);

    // verify the new action is added to the ws subscription resources
    cy
      .get('@wsHandleMessage')
      .should('have.been.calledTwice')
      .then(stub => {
        const secondCallData = stub.getCall(1).args[0].data;
        const { resources } = secondCallData;

        expect(resources).to.deep.include({
          id: testNewSocketAction.id,
          type: testNewSocketAction.type,
        });
      });

    cy
      .get('@firstRow')
      .should('contain', 'New Action - Created Elsewhere');

    cy
      .routeAction(fx => {
        fx.data = testNewStateSocketAction;

        return fx;
      });

    cy.sendWs({
      category: 'StateChanged',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {
        state: {
          type: stateInProgress.type,
          id: stateInProgress.id,
        },
      },
    });

    // a notification that is sent for a resource we are currently fetching
    // this notification is queued until model.fetch() is done for that flow
    cy.sendWs({
      category: 'OwnerChanged',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {
        owner: {
          type: teamNurse.type,
          id: teamNurse.id,
        },
      },
    });

    cy
      .wait('@routeAction')
      .its('request.url')
      .should('contain', testNewStateSocketAction.id);

    cy
      .get('@firstRow')
      .should('contain', 'New Action - State Updated to Match Current Filter');

    cy
      .get('@firstRow')
      .find('[data-owner-region]')
      .should('contain', 'NU');

    // ensures we subscribe correctly to models added to the worklist via ws
    cy.sendWs({
      category: 'NameChanged',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {
        attributes: {
          name: 'New Name Via Websocket',
        },
      },
    });

    cy
      .get('@firstRow')
      .should('contain', 'New Name Via Websocket');

    cy.sendWs({
      category: 'ResourceDeleted',
      resource: {
        type: testNewStateSocketAction.type,
        id: testNewStateSocketAction.id,
      },
      payload: {},
    });

    cy
      .get('.app-frame__content')
      .find('.table-list__item')
      .should('have.length', 1);
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
              files: getRelationship([getFile()]),
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
          getFlow({
            attributes: {
              name: 'Done Flow',
              updated_at: testTsSubtract(7),
            },
            relationships: {
              state: getRelationship(stateDone),
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
      .get('.list-page__list')
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

    cy
      .get('.patient__tabs')
      .find('.js-archive')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.table-list__item', 'Done Flow')
      .find('[data-state-region]')
      .find('.fa-circle-check')
      .should('exist')
      .parents('[data-state-region]')
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
      .get('.list-page__list')
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
