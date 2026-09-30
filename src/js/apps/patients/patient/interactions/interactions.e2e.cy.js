import { findIndex, map, range } from 'underscore';

import { getResource, getRelationship } from 'helpers/json-api';

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
    const dischargeFlow = getFlow({
      attributes: { name: 'TCM - ER Discharge' },
      relationships: { patient: getRelationship(patient) },
    });
    const actionInteraction = getInteraction({
      action,
      metadata: { message: 'Please call us to schedule your follow-up.', clinician_name: 'Alex Morgan' },
    });
    const flowInteraction = getInteraction({
      flow: dischargeFlow,
      channel: 'visit',
      metadata: {
        event: 'discharge',
        patient_class: 'Emergency',
        facility: 'Example Medical Center',
        admitted_at: '2026-09-23T10:00:00+00:00',
        discharged_at: '2026-09-24T10:00:00+00:00',
        admit_reason: 'Shortness of breath',
        discharge_disposition: 'Discharged to home',
        discharge_location: 'Home',
      },
    });
    const createdEvent = getResource({
      id: '01900000-0000-7000-8000-000000000001',
      event: { type: 'InteractionCreated' },
      recorded_at: '2026-09-23T10:00:00Z',
      channel: 'sms',
      direction: 'inbound',
      message: 'Please call us to schedule your follow-up.',
    }, 'events');
    const updatedEvent = getResource({
      id: '01900000-0000-7000-8000-000000000002',
      event: { type: 'InteractionUpdated' },
      recorded_at: '2026-09-24T10:00:00Z',
      note: 'Patient confirmed the appointment.',
      made_contact: false,
    }, 'events');
    cy
      .intercept('GET', '/api/events?*', req => {
        const cursor = new URL(req.url).searchParams.get('page[cursor]');
        req.reply({
          body: { data: cursor ? [createdEvent] : [updatedEvent], meta: { next_cursor: cursor ? null : 'older-events' } },
        });
      })
      .as('interactionEvents');

    cy
      .routesForPatientAction()
      .routeRoles(fx => ({
        ...fx,
        data: map(fx.data, role => role.attributes.name === 'manager' ? { ...role, attributes: { ...role.attributes, name: 'rw' } } : role),
      }))
      .routePatient(fx => ({ ...fx, data: patient }))
      .routePatientInteractions({ data: [actionInteraction, flowInteraction], included: [action, flow, dischargeFlow] })
      .visit(`/patient/${ patient.id }/interactions`);

    cy
      .get('.patient-interactions__item')
      .first()
      .within(() => {
        cy
          .contains('Discharged')
          .should('be.visible');
        cy
          .contains('Example Medical Center')
          .should('be.visible');
        cy
          .contains('Shortness of breath')
          .should('be.visible');
        cy
          .contains('Discharged to home')
          .should('be.visible');
      });
    cy
      .contains('.patient-interactions__item', 'Please call us to schedule your follow-up.')
      .should('contain', 'Alex Morgan');
    cy
      .contains('.patient-interactions__item', 'Please call us to schedule your follow-up.')
      .contains('Show details')
      .click();
    cy
      .wait('@interactionEvents')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[resource]')).to.equal(actionInteraction.id);
        expect(new URL(url).searchParams.get('filter[name]')).to.equal('InteractionEvent');
      });
    cy.wait('@interactionEvents');
    cy
      .get('[role="dialog"]')
      .within(() => {
        cy
          .contains('Interaction created')
          .should('be.visible');
        cy
          .contains('Interaction updated')
          .should('be.visible');
        cy
          .contains('Patient confirmed the appointment.')
          .should('be.visible');
        cy
          .contains('No')
          .should('be.visible');
        cy
          .contains('Done')
          .click();
      });
    cy
      .get('[role="dialog"]')
      .should('not.exist');
    cy.intercept('GET', '/api/events?*', { body: { data: [], meta: { next_cursor: null } } });
    cy
      .contains('.patient-interactions__item', 'Please call us to schedule your follow-up.')
      .contains('Show details')
      .click();
    cy
      .contains('No events recorded for this interaction.')
      .should('be.visible');
    cy
      .get('[role="dialog"]')
      .contains('Done')
      .click();
    cy.intercept('GET', '/api/events?*', { statusCode: 500, body: { errors: [{ title: 'Unavailable' }] } });
    cy
      .contains('.patient-interactions__item', 'Please call us to schedule your follow-up.')
      .contains('Show details')
      .click();
    cy
      .contains('Interaction details could not be loaded.')
      .should('be.visible');
    cy
      .get('[role="dialog"]')
      .contains('Done')
      .click();
    cy
      .get('.patient-interactions__action')
      .contains('Team Referral Flow: SMS Outreach')
      .click();
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/flow/${ flow.id }/action/${ action.id }`);

    cy.visit(`/patient/${ patient.id }/interactions`);
    cy
      .get('.patient-interactions__action')
      .contains('TCM - ER Discharge')
      .click();
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/flow/${ dischargeFlow.id }`);

    const grouped = map(['sms', 'sms', 'voice', 'sms', 'sms'], (channel, index) => {
      const interaction = getInteraction({ channel, metadata: { message: `Grouped message ${ index }`, note: `Grouped call ${ index }` } });
      interaction.attributes.occurred_at = new Date(Date.UTC(2026, 8, index === 4 ? 25 : 24, 10, index)).toISOString();
      return interaction;
    });
    cy.routePatientInteractions({ data: [...grouped].reverse() });
    cy.visit(`/patient/${ patient.id }/interactions`);
    cy
      .contains('.patient-interactions__item', 'Grouped message 0')
      .should('have.class', 'patient-interactions__item--continues');
    cy
      .contains('.patient-interactions__item', 'Grouped message 1')
      .should('have.class', 'patient-interactions__item--continuation');
    cy
      .get('.patient-interactions__item--continuation')
      .should('have.length', 1);
    cy
      .get('.patient-interactions__item--continues')
      .should('have.length', 1);
    cy
      .contains('.patient-interactions__item', 'Grouped message 1')
      .contains('Show details')
      .click();
    cy
      .get('[role="dialog"]')
      .contains('Done')
      .click();

    const history = map(range(80), index => {
      const interaction = getInteraction({ metadata: { message: `Follow-up message ${ index }` } });
      interaction.attributes.occurred_at = new Date(Date.UTC(2026, 4, 1 + index)).toISOString();
      return interaction;
    });
    let failOlder = true;
    cy.intercept('GET', '/api/patients/*/interactions*', req => {
      const query = new URL(req.url).searchParams;
      const before = query.get('page[before]');
      const after = query.get('page[after]');
      if (before) {
        req.alias = 'olderInteractions';
        if (failOlder) {
          failOlder = false;
          req.reply({ statusCode: 500, body: { errors: [{ title: 'Unavailable' }] } });
          return;
        }
        const index = findIndex(history, item => item.id === before);
        req.reply({ body: { data: history.slice(Math.max(0, index - 25), index).reverse() } });
        return;
      }
      if (after) {
        req.alias = 'newerInteractions';
        const index = findIndex(history, item => item.id === after);
        req.reply({ body: { data: history.slice(index + 1, index + 26) } });
        return;
      }
      req.alias = 'anchoredInteractions';
      req.reply({ body: { data: history.slice(28, 53) } });
    });
    cy.visit(`/patient/${ patient.id }/interactions/${ history[40].id }`);
    cy.wait('@anchoredInteractions');
    cy
      .get('.patient-interactions__item')
      .should('have.length', 25);
    cy
      .get('.patient-interactions')
      .scrollTo('top');
    cy.wait('@olderInteractions');
    cy
      .contains('More interactions could not be loaded.')
      .should('be.visible');
    cy
      .get('.patient-interactions__item')
      .should('have.length', 25);
    cy
      .contains('.patient-interactions__item', 'Follow-up message 28')
      .then($anchor => {
        const top = $anchor[0].getBoundingClientRect().top;
        cy
          .contains('button', 'Retry')
          .click();
        cy
          .wait('@olderInteractions')
          .its('request.url')
          .then(url => {
            expect(new URL(url).searchParams.get('page[before]')).to.equal(history[28].id);
          });
        cy
          .get('.patient-interactions__item')
          .should('have.length', 50);
        cy
          .contains('.patient-interactions__item', 'Follow-up message 28')
          .then($current => {
            expect(Math.abs($current[0].getBoundingClientRect().top - top)).to.be.lessThan(2);
          });
      });
    cy
      .get('.patient-interactions')
      .scrollTo('bottom');
    cy
      .wait('@newerInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[after]')).to.equal(history[52].id);
      });
    cy
      .get('.patient-interactions__item')
      .should('have.length', 75);
    cy
      .get('.patient-interactions')
      .scrollTo('bottom');
    cy.wait('@newerInteractions');
    cy
      .get('.patient-interactions__item')
      .should('have.length', 77);
    cy
      .get('.patient-interactions')
      .scrollTo('top');
    cy.wait('@olderInteractions');
    cy
      .get('.patient-interactions__item')
      .should('have.length', 80);
    cy
      .contains('Follow-up message 0')
      .should('exist');
    cy
      .contains('Follow-up message 79')
      .should('exist');
  });

  specify('opens from workflow and a configured sidebar, then links through an action', function() {
    const patient = getPatient();
    const action = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(patient) },
    });
    const interaction = getInteraction({
      action,
      channel: 'voice',
      metadata: {
        clinician_name: 'Alex Morgan',
        disposition: 'Left Voicemail',
        made_contact: false,
        note: 'Left a message asking the patient to call back.',
      },
    });
    const sameDay = getInteraction({
      channel: 'sms',
      direction: 'inbound',
      metadata: { message: 'I can come in tomorrow morning.' },
    });
    const previousDay = getInteraction({
      channel: 'appointment',
      metadata: { clinician_name: 'Taylor Lee', note: 'Follow-up appointment.' },
    });
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

    cy
      .wait('@routePatientInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[limit]')).to.equal('3');
      });
    cy
      .get('.patient-interactions-preview__link')
      .first()
      .should('contain', 'Outbound Call')
      .and('contain', 'Left Voicemail')
      .and('contain', 'Alex Morgan')
      .click();
    cy
      .wait('@routePatientInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[at]')).to.equal(interaction.id);
      });
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);
    cy
      .get('.patient-interactions__item.is-selected')
      .should('contain', 'Outbound Call')
      .and('contain', 'Left Voicemail')
      .and('contain', 'Left a message asking the patient to call back.');
    cy
      .get('.patient-interactions__item .js-details')
      .should('not.exist');
    cy
      .contains('.patient-interactions__item', 'I can come in tomorrow morning.')
      .should('contain', patient.attributes.first_name);
    cy
      .contains('.patient-interactions__item', 'Follow-up appointment.')
      .should('contain', 'Taylor Lee');
    cy
      .get('.patient-interactions__date-divider')
      .should('have.length', 2);
    cy
      .get('.patient-interactions__date-divider')
      .first()
      .should('have.css', 'position', 'sticky');
    cy
      .get('.patient-interactions__date-button')
      .first()
      .click();
    cy
      .get('.picklist')
      .should('be.visible')
      .within(() => {
        cy
          .contains('Today')
          .should('be.visible');
        cy
          .contains('Yesterday')
          .should('be.visible');
        cy
          .contains('Last week')
          .should('be.visible');
        cy
          .contains('Last month')
          .should('be.visible');
        cy
          .contains('The very beginning')
          .should('be.visible');
        cy
          .contains('.js-picklist-item', 'Jump to a specific date')
          .click();
      });
    cy
      .get('.patient-interactions__calendar-modal')
      .should('be.visible');
    cy
      .get('.patient-interactions__calendar-modal .datepicker__days a')
      .contains(/^23$/)
      .click();
    cy
      .get('.patient-interactions__calendar-modal')
      .should('not.exist');
    cy
      .get('.patient-interactions__date-button')
      .eq(1)
      .click();
    cy
      .get('.picklist')
      .should('be.visible')
      .and('contain', 'The very beginning');
    cy
      .get('.patient-interactions__action')
      .should('contain', 'Call patient')
      .click();
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/action/${ action.id }`);
    cy
      .wait('@routePatientInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[action]')).to.equal(action.id);
      });
    cy
      .get('.patient-action__interactions .patient-interactions-preview__link')
      .first()
      .click();
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/interactions/${ interaction.id }`);
    cy
      .get('.patient-pages .js-workflow')
      .click();
    cy
      .get('.patient-pages .js-interactions')
      .click();
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/interactions`);
    cy
      .get('.patient-interactions__item')
      .should('exist');
    cy.intercept('GET', '/api/patients/*/interactions*', req => {
      const channels = new URL(req.url).searchParams.get('filter[channel]');
      if (!channels) return req.continue();
      req.alias = channels.includes('voice') ? 'callInteractions' : 'filteredInteractions';
      req.reply({ body: { data: channels.includes('voice') ? [interaction] : [], included: [action] } });
    });
    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();
    cy
      .wait('@filteredInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[channel]')).not.to.include('voice');
      });
    cy
      .get('.patient-interactions__empty')
      .should('be.visible');
    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();
    cy
      .get('.patient-interactions__filters [data-filter="appointments"]')
      .click();
    cy
      .get('.patient-interactions__filters [data-filter="visits"]')
      .click();
    cy
      .get('.patient-interactions__empty')
      .should('be.visible');
    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();
    cy
      .wait('@callInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[channel]')).to.equal('voice,voicemail,video');
      });
    cy
      .get('.patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Left a message asking the patient to call back.');
  });
});
