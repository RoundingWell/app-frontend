import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';
import { getPatient } from 'support/api/patients';
import { getWorkspacePatient } from 'support/api/workspace-patients';

context('patient action loading state', function() {
  specify('shows stable action structure without optional sections while loading', function() {
    let releasePatient;
    const patientResponse = new Cypress.Promise(resolve => {
      releasePatient = resolve;
    });
    const patient = getPatient({
      attributes: {
        first_name: 'Test',
        last_name: 'Patient',
      },
    });
    const action = getAction({
      attributes: {
        name: 'Loading State Action',
      },
      relationships: {
        form: getRelationship(testForm),
        patient: getRelationship(patient),
      },
    });
    const workspacePatient = getWorkspacePatient();

    cy
      .routesForPatientAction()
      .routePatient(fx => {
        fx.data = patient;

        return fx;
      })
      .routeFormByAction(fx => {
        fx.data = testForm;

        return fx;
      })
      .routeLatestFormResponse()
      .routeFormDefinition()
      .routeFormActionFields()
      .intercept('GET', '/api/patients/**?*', req => {
        return patientResponse.then(() => {
          req.reply({ body: { data: patient, included: [] } });
        });
      })
      .as('routeDelayedPatient')
      .intercept('GET', '/api/workspace-patients/*', {
        delay: 5000,
        body: { data: workspacePatient, included: [] },
      })
      .as('routeDelayedWorkspacePatient')
      .intercept('GET', `/api/actions/${ action.id }/form`, {
        delay: 1000,
        body: { data: testForm, included: [] },
      })
      .as('routeDelayedForm')
      .intercept('GET', `/api/actions/${ action.id }*`, {
        delay: 1000,
        body: { data: action, included: [] },
      })
      .as('routeDelayedAction')
      .intercept('GET', `/api/actions/${ action.id }/activity*`, {
        delay: 1000,
        body: { data: [], included: [] },
      })
      .as('routeDelayedActivity')
      .intercept('GET', `/api/actions/${ action.id }/comments`, {
        delay: 1000,
        body: { data: [], included: [] },
      })
      .as('routeDelayedComments')
      .intercept('GET', `/api/actions/${ action.id }/files*`, {
        delay: 1000,
        body: { data: [], included: [] },
      })
      .as('routeDelayedFiles')
      .visit(`/patient/${ patient.id }/action/${ action.id }`);

    cy
      .get('.loader__indicator')
      .should('be.visible')
      .find('.loader__indicator-dot')
      .should('have.length', 3);

    cy
      .get('.patient__frame')
      .should('not.exist')
      .then(releasePatient);

    cy
      .wait('@routeDelayedPatient')
      .get('.patient-action__loader')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true')
      .find('.patient-action-loading__skeleton')
      .should('be.visible')
      .find('.patient-action-loading__chip')
      .should('have.length', 4);

    cy
      .get('.patient-action-loading__skeleton')
      .find('.patient-action__form, .patient-action__attachments')
      .should('not.exist');

    cy
      .get('.patient-sidebar__header')
      .should('be.visible');

    cy
      .get('.patient-sidebar__sidebars .patient-sidebar__loader')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true');

    cy
      .wait('@routeDelayedAction')
      .get('.patient-action__name')
      .should('contain', 'Loading State Action');

    cy
      .get('.patient-action__form-region .loader')
      .should('not.exist');

    cy
      .get('.patient-action__activity-loading')
      .should('be.visible')
      .and('have.attr', 'aria-busy', 'true')
      .find('.skeleton-loading__shape')
      .should('have.length', 2);

    cy
      .get('.patient-action__attachments .loader')
      .should('not.exist');

    cy
      .wait('@routeDelayedWorkspacePatient')
      .get('.patient-sidebar__header')
      .should('be.visible')
      .get('.patient-sidebar__card')
      .first()
      .should('be.visible');

    cy
      .wait('@routeDelayedForm')
      .get('.patient-action__form-region .form__frame')
      .should('exist');

    cy
      .wait(['@routeDelayedActivity', '@routeDelayedComments', '@routeDelayedFiles'])
      .get('.patient-action__activity')
      .should('contain', 'Activity')
      .find('.loader')
      .should('not.exist');
  });
});
