import { getRelationship } from 'helpers/json-api';

import { getAction } from 'support/api/actions';
import { getInteraction } from 'support/api/interactions';
import { getPatient } from 'support/api/patients';

context('patient interactions', function() {
  specify('opens from workflow and a configured sidebar, then links through an action', function() {
    const patient = getPatient();
    const action = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(patient) },
    });
    const interaction = getInteraction({ action, channel: 'voice', reference: 'Follow-up call' });

    cy
      .routesForPatientAction()
      .routePatient(fx => ({ ...fx, data: patient }))
      .routePatientByAction(fx => ({ ...fx, data: patient }))
      .routePatientActions(fx => ({ ...fx, data: [action] }))
      .routeAction(fx => ({ ...fx, data: action }))
      .routePatientInteractions({ data: [interaction], included: [action] })
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
    cy.get('.patient-interactions-preview__link').should('contain', 'Call').click();
    cy.wait('@routePatientInteractions').its('request.url').then(url => {
      expect(new URL(url).searchParams.get('page[at]')).to.equal(interaction.id);
    });
    cy.location('pathname').should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);
    cy.get('.patient-interactions__item.is-selected').should('contain', 'Follow-up call');
    cy.get('.patient-interactions__action').should('contain', 'Call patient').click();
    cy.location('pathname').should('include', `/patient/${ patient.id }/action/${ action.id }`);
    cy.get('.patient-action__interactions .patient-interactions-preview__link').click();
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
