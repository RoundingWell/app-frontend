import _ from 'underscore';
import dayjs from 'dayjs';
import { v7 as uuid, NIL as NIL_UUID } from 'uuid';

import { testTs, testTsSubtract } from 'helpers/test-timestamp';
import { testDate, testDateAdd, testDateSubtract } from 'helpers/test-date';
import { getRelationship, mergeJsonApi } from 'helpers/json-api';
import formatDate from 'helpers/format-date';

import { getAction, longActionName } from 'support/api/actions';
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

  specify('shows the workflow loading state', function() {
    const delayedResponse = {
      delay: 30000,
      body: { data: [], included: [] },
    };

    cy
      .routesForPatientDashboard()
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .intercept('GET', '/api/programs', delayedResponse)
      .as('routeDelayedPrograms')
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .intercept('GET', '/api/patients/**/actions*', delayedResponse)
      .as('routeDelayedPatientActions')
      .intercept('GET', '/api/patients/**/flows*', delayedResponse)
      .as('routeDelayedPatientFlows');

    cy
      .get('.workflow-page__actions .add-workflow__button')
      .should('have.class', 'js-loading')
      .and('contain', 'Loading...')
      .find('.fa-circle-plus')
      .should('exist');

    cy
      .get('.js-archive')
      .click();

    cy
      .get('.workflow-page__loader')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true')
      .and('have.attr', 'role', 'status');
  });

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
              name: longActionName,
              details: 'Long action details.',
              updated_at: testTsSubtract(2),
            },
            relationships: {
              state: getRelationship(stateInProgress),
              patient: getRelationship(testPatient),
            },
          }),
          getAction({
            attributes: {
              details: null,
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
            meta: {
              progress: {
                complete: 1,
                total: 4,
              },
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
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .should('have.lengthOf', 5);

    cy
      .get('.workflow-page__list .flow-card')
      .first()
      .then($item => {
        const chips = $item.find('.flow-card__controls')[0];
        const progressSummary = $item.find('.patient-list__flow-progress')[0];
        const dates = $item.find('.work-card__timestamps')[0];

        expect(progressSummary.parentElement).to.equal(chips);
        expect(dates.parentElement).to.have.class('work-card__meta');
      });

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
      .get('.workflow-page__list')
      .find('.action-card')
      .first()
      .should('contain', 'First In List')
      .find('.work-card__state[data-state-region]')
      .find('.fa-circle-exclamation');

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .first()
      .should('contain', 'Second In List')
      .and('contain', '1 / 4 Actions')
      .find('.work-card__state[data-state-region]')
      .should('not.be.empty');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .eq(1)
      .should('contain', longActionName);

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .eq(2)
      .should('contain', 'Outreach');

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .last()
      .should('contain', 'Last In List');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .first()
      .find('[data-details-region]')
      .trigger('pointerover');

    cy
      .get('.tooltip')
      .should('contain', 'Action details content.');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .eq(2)
      .find('[data-details-region]')
      .should('be.empty');

    cy
      .get('.workflow-page__list')
      .find('.action-card')
      .first()
      .should($item => {
        const identity = $item.find('.work-card__heading')[0];
        const form = $item.find('[data-form-region]')[0];
        const secondaryChildren = [...$item.find('.work-card__meta')[0].children];
        const dates = $item.find('.work-card__timestamps')[0];
        const counts = $item.find('.action-card__counts')[0];
        const countChildren = [...counts.children];
        const comment = $item.find('.fa-comment')[0].parentElement;
        const attachment = $item.find('.fa-paperclip')[0].parentElement;

        expect(identity.contains(form)).to.be.true;
        expect(secondaryChildren.indexOf(dates)).to.be.lessThan(secondaryChildren.indexOf(counts));
        expect(countChildren.indexOf(attachment)).to.be.lessThan(countChildren.indexOf(comment));
      });

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
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
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-owner-region]')
      .find('.owner-component--compact')
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
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
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
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-due-time-region]')
      .click();

    cy
      .get('.picklist')
      .contains('9:45 AM')
      .click();

    cy
      .get('.workflow-page__list')
      .contains('First In List')
      .parents('.action-card')
      .find('[data-due-time-region] .is-overdue');

    cy
      .wait('@routePatchAction')
      .its('request.body')
      .should(({ data }) => {
        expect(data.attributes.due_time).to.equal('09:45:00');
      });

    cy
      .get('.workflow-page__tabs')
      .find('.js-archive')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.flow-card', 'Done Flow')
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
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .get('.workflow-page__list')
      .find('.flow-card')
      .last()
      .as('flowItem');

    cy
      .get('@flowItem')
      .find('.fa-circle-dot');

    cy
      .get('@flowItem')
      .find('[data-owner-region]')
      .find('.owner-component--compact')
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
      .get('.action-card')
      .eq(1)
      .find('[data-form-region]')
      .should('be.empty');

    cy
      .get('.action-card')
      .eq(1)
      .find('.fa-paperclip')
      .should('not.exist');

    cy
      .get('.action-card')
      .eq(1)
      .find('.fa-comment')
      .should('not.exist');

    cy.routeAction(fx => {
      fx.data = mergeJsonApi(testAction, {
        relationships: {
          'form': getRelationship(),
          'form-responses': getRelationship([]),
        },
      });

      return fx;
    });

    cy
      .contains('.action-card', 'First In List')
      .find('.work-card__title')
      .focus()
      .typeEnter()
      .wait('@routeAction');

    cy
      .url()
      .should('contain', `/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .visit(`/patient/dashboard/${ testPatient.id }`)
      .wait('@routePatient')
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    // dirty hack to make sure the form button isn't offscreen
    cy
      .get('.action-card')
      .first()
      .find('[data-due-date-region] button')
      .click();

    cy
      .get('.datepicker')
      .contains('Clear')
      .click();

    cy
      .get('.action-card')
      .first()
      .find('.fa-paperclip')
      .should('exist')
      .next()
      .should('contain', '1');

    cy
      .get('.action-card')
      .first()
      .find('.fa-comment')
      .should('exist')
      .next()
      .should('contain', '1');

    cy
      .routeAction(fx => {
        fx.data = testAction;

        return fx;
      })
      .routeFormByAction()
      .routeFormDefinition()
      .routeLatestFormResponse()
      .routeFormActionFields()
      .routeFormResponse();

    cy
      .get('.action-card')
      .first()
      .find('[data-form-region]')
      .find('button')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');
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
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[0].id);
        expect(data.relationships.owner).to.be.undefined;
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
      .wait('@routePatientFlows');

    cy
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
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships['program-action'].data.id).to.equal(testProgramActions[1].id);
        expect(data.relationships.owner).to.be.undefined;
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
      .wait('@routePatientFlows');

    cy
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
        expect(data.relationships.owner).to.be.undefined;
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
      .intercept('POST', '/api/flows*', {
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
        expect(data.relationships.patient.data.id).to.equal(testPatient.id);
        expect(data.relationships.state.data.id).to.equal(stateTodo.id);
        expect(data.relationships['program-flow'].data.id).to.be.equal(testProgramFlows[0].id);
        expect(data.relationships.owner).to.be.undefined;
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
      .find('.flow-card')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.work-card__meta')
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
      .get('.card-list__empty')
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
      .find('.flow-card')
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
      .find('.action-card')
      .first()
      .as('firstRow')
      .should('contain', 'New Name Via Websocket');

    cy
      .get('@firstRow')
      .find('.work-card__meta')
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
      .should('exist')
      .next()
      .should('contain', '1');

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
      .get('.card-list__empty')
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
      .find('.action-card')
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
      .get('.workflow-page__list')
      .find('.action-card, .flow-card')
      .as('listItems')
      .first()
      .find('button')
      .should('have.length', 6);

    cy
      .get('@listItems')
      .eq(1)
      .find('[data-owner-region]')
      .find('button');

    cy
      .get('@listItems')
      .eq(2)
      .find('button')
      .should('have.length', 2)
      .filter('.action-details-tooltip')
      .should('have.length', 1);

    cy
      .get('@listItems')
      .eq(3)
      .find('[data-owner-region]')
      .find('button')
      .should('not.exist');

    cy
      .get('.workflow-page__tabs')
      .find('.js-archive')
      .click()
      .wait('@routePatientActions')
      .wait('@routePatientFlows');

    cy
      .contains('.flow-card', 'Done Flow')
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
      .get('.workflow-page__list')
      .find('.action-card')
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
