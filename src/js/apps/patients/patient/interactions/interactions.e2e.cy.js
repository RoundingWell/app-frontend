import { findIndex, map, range } from 'underscore';

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
        patient_class: 'E',
        source: 'Collective',
        facility: 'Example Medical Center',
        admitted_at: '2026-09-23T10:00:00+00:00',
        discharged_at: '2026-09-24T10:00:00+00:00',
        admit_reason: 'Shortness of breath',
        discharge_disposition: 'Discharged to home',
        discharge_location: 'Home',
      },
    });
    cy
      .routesForPatientAction()
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
          .contains('Emergency')
          .should('be.visible');
        cy.contains('via Collective');
        cy.contains('LOS 1 day');
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
    const history = map(range(80), index => {
      const interaction = getInteraction({ metadata: { message: `Follow-up message ${ index }` } });
      // The oldest page boundary cuts through a day containing four entries.
      interaction.attributes.occurred_at = new Date(Date.UTC(2026, 4, Math.max(4, 1 + index), index < 4 ? index : 0)).toISOString();
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

    cy.visit(`/patient/${ patient.id }/interactions/${ history[40].id }`);
    cy.wait('@anchoredInteractions');
    cy
      .get('.patient-interactions')
      .scrollTo('top');
    cy.wait('@olderInteractions');
    cy
      .get('.patient-interactions__item')
      .should('have.length', 50);
    cy
      .contains('.patient-interactions__date-button', 'MAY 29')
      .click();
    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();
    cy
      .get('.patient-interactions__calendar-modal .datepicker__days a')
      .contains(/^4$/)
      .click();
    cy
      .wait('@olderInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('page[before]')).to.equal(history[3].id);
      });
    cy
      .get('.patient-interactions__item')
      .should('have.length', 53);
    cy
      .contains('.patient-interactions__date-button', 'MAY 4')
      .should('be.visible')
      .then($date => {
        cy.get('.patient-pages-controls').then($controls => {
          expect($date[0].getBoundingClientRect().top).to.be.at.least($controls[0].getBoundingClientRect().bottom);
        });
      });
    cy
      .contains('.patient-interactions__item', 'Follow-up message 0')
      .should('be.visible');
    cy
      .contains('.patient-interactions__date-button', 'MAY 4')
      .click();
    cy
      .contains('.js-picklist-item', 'Today')
      .click();
    cy
      .get('.patient-interactions__item')
      .should('have.length', 80);
    cy
      .contains('.patient-interactions__item', 'Follow-up message 79')
      .should('be.visible');
    cy
      .get('.patient-pages-controls')
      .should('be.visible');
    cy
      .get('.js-filter')
      .should('be.visible');
    cy
      .contains('.patient-interactions__date-button', 'JUL 19')
      .click();
    cy
      .contains('.js-picklist-item', 'The very beginning')
      .click();
    cy
      .contains('.patient-interactions__item', 'Follow-up message 0')
      .should('be.visible');
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
      .get('.patient-action__activity .js-interaction')
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
      if (!channels) {
        req.reply({ body: { data: [interaction, sameDay, previousDay], included: [action] } });
        return;
      }
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

    const portalInteraction = getInteraction({
      channel: 'portal',
      metadata: { message: 'Your care plan is available in the patient portal.' },
    });
    let releaseFiltered;
    let filteredStarted = false;
    const filteredResponse = new Cypress.Promise(resolve => {
      releaseFiltered = resolve;
    });
    cy.intercept('GET', '/api/patients/*/interactions*', req => {
      const channels = new URL(req.url).searchParams.get('filter[channel]');
      if (channels?.includes('voice')) {
        filteredStarted = true;
        return filteredResponse.then(() => {
          req.reply({ body: { data: [interaction], included: [action] } });
        });
      }
      req.alias = 'portalInteractions';
      req.reply({ body: { data: [portalInteraction] } });
    });
    cy
      .get('.patient-interactions__filters [data-filter="messages"]')
      .click();
    cy
      .get('.js-paging-loading')
      .should('be.visible')
      .should(() => {
        expect(filteredStarted).to.equal(true);
      });
    cy
      .get('.patient-interactions__item')
      .should('contain', 'Left a message asking the patient to call back.');
    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();
    cy
      .wait('@portalInteractions')
      .its('request.url')
      .then(url => {
        expect(new URL(url).searchParams.get('filter[channel]')).to.equal('sms,email,mail,fax,portal');
      });
    cy
      .focused()
      .should('have.attr', 'data-filter', 'calls');
    cy
      .get('.patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Your care plan is available in the patient portal.')
      .then(releaseFiltered);
    cy
      .get('.patient-interactions__item')
      .should('have.length', 1)
      .and('contain', 'Your care plan is available in the patient portal.');

    let releaseLeaving;
    let leavingStarted = false;
    const leavingResponse = new Cypress.Promise(resolve => {
      releaseLeaving = resolve;
    });
    cy.intercept('GET', '/api/patients/*/interactions*', req => {
      if (new URL(req.url).searchParams.get('page[limit]') === '3') {
        req.reply({ body: { data: [interaction], included: [action] } });
        return;
      }
      leavingStarted = true;
      return leavingResponse.then(() => {
        req.reply({ body: { data: [interaction], included: [action] } });
      });
    });
    cy
      .get('.patient-interactions__filters [data-filter="calls"]')
      .click();
    cy
      .get('.js-paging-loading')
      .should('be.visible')
      .should(() => {
        expect(leavingStarted).to.equal(true);
      });
    cy
      .get('.patient-pages .js-workflow')
      .click();
    cy
      .get('.patient-pages .js-interactions')
      .should('be.visible')
      .then(releaseLeaving);
    cy
      .location('pathname')
      .should('include', `/patient/${ patient.id }/workflow`);
  });
});
