import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getInteraction } from 'support/api/interactions';
import { getFlow } from 'support/api/flows';
import { getPatient } from 'support/api/patients';

context('patient interactions', function() {
  specify('links an interaction to an action within a flow and directly to a flow', function() {
    const patient = getPatient();
    const flow = getFlow({
      attributes: { name: 'Team Referral Flow' },
      relationships: { patient: getRelationship(patient) },
    });
    const action = getAction({
      attributes: { name: 'SMS Outreach' },
      relationships: { patient: getRelationship(patient), flow: getRelationship(flow) },
    });
    const actionInteraction = getInteraction({ action, reference: 'Outreach sent' });
    const flowInteraction = getInteraction({ flow, reference: 'ER discharge', channel: 'visit' });

    cy
      .routesForPatientAction()
      .routePatient(fx => ({ ...fx, data: patient }))
      .routePatientInteractions({ data: [actionInteraction, flowInteraction], included: [action, flow] })
      .visit(`/patient/${ patient.id }/interactions`);

    cy.get('.patient-interactions__item').first().should('contain', 'ER discharge');
    cy.get('.patient-interactions__action').contains('SMS Outreach').click();
    cy.location('pathname').should('include', `/patient/${ patient.id }/flow/${ flow.id }/action/${ action.id }`);

    cy.visit(`/patient/${ patient.id }/interactions`);
    cy.get('.patient-interactions__action').contains('Team Referral Flow').click();
    cy.location('pathname').should('include', `/patient/${ patient.id }/flow/${ flow.id }`);
  });

  specify('opens from workflow and a configured sidebar, then links through an action', function() {
    const patient = getPatient();
    const action = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(patient) },
    });
    const interaction = getInteraction({ action, channel: 'voice', reference: 'Follow-up call' });
    const sameDay = getInteraction({ channel: 'sms', reference: 'Message reply' });
    const previousDay = getInteraction({ channel: 'appointment', reference: 'Appointment reminder' });
    previousDay.attributes.occurred_at = '2026-09-23T10:00:00+00:00';

    cy
      .routesForPatientAction()
      .routePatient(fx => ({ ...fx, data: patient }))
      .routePatientByAction(fx => ({ ...fx, data: patient }))
      .routePatientActions(fx => ({ ...fx, data: [action] }))
      .routeAction(fx => ({ ...fx, data: action }))
      .routePatientInteractions({ data: [interaction, sameDay, previousDay], included: [action] })
      .routeSettings('sidebar', ['interactions'])
      .routePanels(fx => ({
        ...fx,
        data: [{
          id: 'interactions',
          type: 'panels',
          attributes: { slug: 'interactions', name: 'Interactions', widgets: ['interactions'] },
        }],
      }))
      .routeWidgets(fx => ({
        ...fx,
        data: [{
          id: 'interactions',
          type: 'widgets',
          attributes: { category: 'interactions', slug: 'interactions', definition: {} },
        }],
      }))
      .visit(`/patient/${ patient.id }/workflow`);

    cy.wait('@routePatientInteractions').its('request.url').then(url => {
      expect(new URL(url).searchParams.get('page[limit]')).to.equal('3');
    });
    cy.get('.patient-interactions-preview__link').first().should('contain', 'Call').click();
    cy.wait('@routePatientInteractions').its('request.url').then(url => {
      expect(new URL(url).searchParams.get('page[at]')).to.equal(interaction.id);
    });
    cy.location('pathname').should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);
    cy.get('.patient-interactions__item.is-selected').should('contain', 'Follow-up call');
    cy.get('.patient-interactions__date-divider').should('have.length', 2);
    cy.get('.patient-interactions__date-divider').first().should('have.css', 'position', 'sticky');
    cy.get('.patient-interactions__date-button').first().click();
    cy.get('.patient-interactions__date-menu').first().should('be.visible').within(() => {
      cy.contains('Today').should('be.visible');
      cy.contains('Yesterday').should('be.visible');
      cy.contains('Last week').should('be.visible');
      cy.contains('Last month').should('be.visible');
      cy.contains('The very beginning').should('be.visible');
      cy.contains('Jump to a specific date').click();
    });
    cy.get('.patient-interactions__calendar-modal').should('be.visible');
    cy.get('.patient-interactions__calendar-modal .datepicker__days a').contains(/^23$/).click();
    cy.get('.patient-interactions__calendar-modal').should('not.exist');
    cy.get('.patient-interactions__date-button').eq(1).click();
    cy.get('.patient-interactions__date-menu').eq(1).should('be.visible').and('contain', 'The very beginning');
    cy.get('.patient-interactions__action').should('contain', 'Call patient').click();
    cy.location('pathname').should('include', `/patient/${ patient.id }/action/${ action.id }`);
    cy.get('.patient-action__interactions .patient-interactions-preview__link').first().click();
    cy.location('pathname').should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);
    cy.get('.patient-interactions__pages .js-workflow').click();
    cy.get('.workflow-page__pages .js-interactions').click();
    cy.location('pathname').should('include', `/patient/${ patient.id }/interactions`);
    cy.get('.patient-interactions__item').should('exist');
    cy.intercept('GET', '/api/patients/*/interactions*', req => {
      const channels = new URL(req.url).searchParams.get('filter[channel]');
      if (!channels) return req.continue();
      req.alias = 'filteredInteractions';
      req.reply({ body: { data: [], included: [] } });
    });
    cy.get('.patient-interactions__filters [data-filter="calls"]').click();
    cy.wait('@filteredInteractions').its('request.url').then(url => {
      expect(new URL(url).searchParams.get('filter[channel]')).not.to.include('voice');
    });
    cy.get('.patient-interactions__empty').should('be.visible');
  });
});
