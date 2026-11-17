import _ from 'underscore';
import dayjs from 'dayjs';

import { getResource, getRelationship } from 'helpers/json-api';
import fxTestSettings from 'fixtures/test/settings';

import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getInteraction } from 'support/api/interactions';
import { getPatient } from 'support/api/patients';
import { stateTodo } from 'support/api/states';

function routeOrganizationMessaging(value) {
  const settings = getResource(fxTestSettings, 'settings');
  settings.push({ id: 'messaging_enabled', type: 'settings', attributes: { value } });

  cy
    .intercept('GET', '/api/settings', {
      body: { data: settings, included: [] },
    })
    .as('routeSettings');
}

function getDayTs(daysAgo, hour, minute = 0) {
  return dayjs().subtract(daysAgo, 'day').hour(hour).minute(minute).second(0).format();
}

function getDateLabel(timestamp) {
  const date = dayjs(timestamp);
  return `${ date.format('dddd') }, ${ date.format(date.isSame(dayjs(), 'year') ? 'MMM D' : 'll') }`;
}

function getQuery(req) {
  return new URL(req.url).searchParams;
}

function isMessagesRequest(req) {
  return String(getQuery(req).get('filter[channel]')).startsWith('sms');
}

function isOlderMessagesRequest(req) {
  return isMessagesRequest(req) && getQuery(req).has('page[before]');
}

function getText({ direction = 'outbound', occurredAt = '2026-11-10T15:00:00Z', expectedAt = null, cancelledAt = null, metadata, action, flow }) {
  return getInteraction({
    attributes: {
      channel: 'sms',
      direction,
      occurred_at: occurredAt,
      expected_at: expectedAt,
      cancelled_at: cancelledAt,
      metadata,
    },
    relationships: {
      action: getRelationship(action),
      flow: getRelationship(flow),
    },
  });
}

context('patient action messages', function() {
  const testPatient = getPatient({ attributes: { first_name: 'Omar', last_name: 'Porter' } });
  const testFlow = getFlow({ attributes: { name: 'TCM Follow-up' }, relationships: { patient: getRelationship(testPatient) } });
  const testAction = getAction({
    attributes: { name: 'Message Nov 10', options: { embed: 'compose' } },
    relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship() },
  });
  const otherAction = getAction({
    attributes: { name: 'Message Nov 1' },
    relationships: { patient: getRelationship(testPatient), flow: getRelationship() },
  });
  const flowAction = getAction({
    attributes: { name: 'Welcome Home Outreach' },
    relationships: { patient: getRelationship(testPatient), flow: getRelationship(testFlow) },
  });

  function routeMessageAction(interactions, action = testAction) {
    cy
      .routesForPatientAction()
      .routeAction(fx => {
        fx.data = action;
        fx.included.push(testPatient);

        return fx;
      })
      .routePatient(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientByAction(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = interactions;
        fx.included = [otherAction, flowAction, testFlow];

        return fx;
      })
      .routeFlow(fx => {
        fx.data.id = testFlow.id;
        fx.data.attributes.name = testFlow.attributes.name;
        fx.data.relationships.patient = getRelationship(testPatient);
        fx.included.push(testPatient);

        return fx;
      })
      .routeFlowActions()
      .routePatientByFlow(fx => {
        fx.data = testPatient;

        return fx;
      })
      .routeFlowActivity();
  }

  specify('message history', function() {
    const inbound = getText({ direction: 'inbound', occurredAt: getDayTs(1, 9), metadata: { body: 'Can someone call me about my foot?' }, action: testAction });
    const outbound = getText({ occurredAt: getDayTs(1, 9, 30), metadata: { message: 'A nurse will call you today.', clinician_name: 'Jessica Davenport' }, action: testAction });
    const organization = getText({ occurredAt: getDayTs(9, 9), metadata: { message: 'Checking in after your visit.' }, action: otherAction });
    const disposition = getText({ occurredAt: getDayTs(9, 10), metadata: { disposition: 'Text Sent' }, action: otherAction });
    const inFlow = getText({ occurredAt: getDayTs(8, 9), metadata: { message: 'Welcome home!' }, action: flowAction });
    const flowOnly = getText({ occurredAt: getDayTs(7, 9), metadata: { message: 'Flow reminder' }, flow: testFlow });
    const actionless = getText({ occurredAt: getDayTs(6, 9), metadata: { message: 'Sent from Interactions' } });
    const scheduled = getText({ occurredAt: null, expectedAt: '2099-11-20T15:00:00Z', metadata: { message: 'Monthly check-in' }, action: testAction });
    const cancelled = getText({ occurredAt: null, expectedAt: getDayTs(5, 10), cancelledAt: getDayTs(6, 10), metadata: { message: 'Check-in reminder' }, action: testAction });
    const otherScheduled = getText({ occurredAt: null, expectedAt: '2099-11-21T15:00:00Z', metadata: { message: 'Reminder for another action' }, action: otherAction });
    const email = getInteraction({
      attributes: { channel: 'email', direction: 'outbound', occurred_at: getDayTs(1, 10, 30), expected_at: null, metadata: { note: 'Emailed discharge papers' } },
      relationships: { action: getRelationship(testAction), flow: getRelationship() },
    });
    const call = getInteraction({
      attributes: { channel: 'voice', direction: 'outbound', occurred_at: getDayTs(1, 11), expected_at: null, metadata: { note: 'Called the patient' } },
      relationships: { action: getRelationship(testAction), flow: getRelationship() },
    });

    routeOrganizationMessaging(true);
    routeMessageAction([inbound, outbound, organization, disposition, inFlow, flowOnly, actionless, scheduled, cancelled, otherScheduled, email, call]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'Messages')
      .and('not.contain', 'Reminder for another action')
      .and('not.contain', 'Emailed discharge papers')
      .find('.messaging-card')
      .should('have.length', 9);

    cy
      .get('.messaging-history__date')
      .should($dates => {
        expect(_.map($dates, date => date.textContent.trim())).to.deep.equal(_.map([
          organization.attributes.occurred_at,
          inFlow.attributes.occurred_at,
          flowOnly.attributes.occurred_at,
          actionless.attributes.occurred_at,
          cancelled.attributes.expected_at,
          inbound.attributes.occurred_at,
          scheduled.attributes.expected_at,
        ], getDateLabel));
      });

    cy
      .contains('.messaging-history__day', getDateLabel(inbound.attributes.occurred_at))
      .find('.messaging-card')
      .should('have.length', 2);

    cy
      .contains('.messaging-card', 'Can someone call me about my foot?')
      .should('have.class', 'messaging-card--inbound')
      .and('contain', 'Omar Porter')
      .and('contain', 'via SMS')
      .and('contain', 'View on Interactions')
      .find('.js-work')
      .should('not.exist');

    cy
      .contains('.messaging-card', 'A nurse will call you today.')
      .should('have.class', 'messaging-card--outbound')
      .and('contain', 'Jessica Davenport')
      .find('.js-work')
      .should('not.exist');

    cy
      .contains('.messaging-card', 'Checking in after your visit.')
      .should('contain', 'Cypress Clinic')
      .find('.js-work')
      .should('have.text', 'Message Nov 1');

    cy
      .contains('.messaging-card', 'Outbound SMS • Text Sent')
      .find('.messaging-card__body')
      .should('not.exist');

    cy
      .contains('.messaging-card', 'Monthly check-in')
      .should('have.class', 'messaging-card--scheduled')
      .and('contain', 'Scheduled');

    cy
      .contains('.messaging-card', 'Check-in reminder')
      .should('have.class', 'messaging-card--cancelled')
      .and('contain', 'Cancelled');

    cy
      .contains('.messaging-card', 'Sent from Interactions')
      .find('.js-work')
      .should('not.exist');

    cy
      .get('.patient-action__activity')
      .should('contain', 'Called the patient')
      .and('contain', 'Emailed discharge papers')
      .and('not.contain', 'A nurse will call you today.');

    cy
      .contains('.messaging-card', 'Welcome home!')
      .find('.js-work')
      .should('have.text', 'TCM Follow-up: Welcome Home Outreach')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ flowAction.id }`);

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .contains('.messaging-card', 'Flow reminder')
      .find('.js-work')
      .should('have.text', 'TCM Follow-up')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }`);

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .contains('.messaging-card', 'Checking in after your visit.')
      .find('.js-work')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ otherAction.id }`);

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .contains('.messaging-card', 'A nurse will call you today.')
      .find('.js-interaction')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/interactions/${ outbound.id }`);
  });

  specify('earlier messages', function() {
    const texts = _.times(30, index => getText({
      occurredAt: `2026-11-${ String(index + 1).padStart(2, '0') }T15:00:00Z`,
      metadata: { message: `Text ${ index + 1 }` },
      action: testAction,
    }));
    let olderFails = true;

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (!isOlderMessagesRequest(req) || !olderFails) return;
        req.reply({ forceNetworkError: true });
      })
      .as('routeOlderMessages');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 25)
      .first()
      .should('contain', 'Text 6');

    cy
      .get('.messaging-history')
      .find('.js-older')
      .should('be.visible')
      .click();

    cy
      .wait('@routeOlderMessages');

    cy
      .get('.messaging-history')
      .should('contain', 'Earlier messages could not be loaded. Try again.')
      .find('.messaging-card')
      .should('have.length', 25);

    cy
      .get('.messaging-history')
      .find('.js-older')
      .should('not.be.disabled')
      .then(() => {
        olderFails = false;
      });

    cy
      .get('.messaging-history')
      .find('.js-older')
      .click();

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 30)
      .first()
      .should('contain', 'Text 1');

    cy
      .get('.messaging-history')
      .should('not.contain', 'Earlier messages could not be loaded.')
      .find('.js-older')
      .should('not.be.visible');
  });

  specify('leaving while earlier messages load', function() {
    const texts = _.times(30, index => getText({
      occurredAt: `2026-11-${ String(index + 1).padStart(2, '0') }T15:00:00Z`,
      metadata: { message: `Text ${ index + 1 }` },
      action: testAction,
    }));

    let releaseOlderMessages;
    const olderMessages = new Cypress.Promise(resolve => {
      releaseOlderMessages = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (!isOlderMessagesRequest(req)) return;
        return olderMessages.then(() => {
          req.reply({ body: { data: [], included: [] } });
        });
      })
      .as('routeOlderMessages');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .find('.js-older')
      .click()
      .should('be.disabled');

    cy
      .get('.patient__context-trail')
      .contains('Omar Porter')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`)
      .then(() => releaseOlderMessages());

    cy
      .wait('@routeOlderMessages');

    cy
      .get('.messaging-history')
      .should('not.exist');

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('not.contain', 'Earlier messages could not be loaded.')
      .find('.messaging-card')
      .should('have.length', 25);

    cy
      .get('.messaging-history')
      .find('.js-older')
      .should('be.visible')
      .and('not.be.disabled');
  });

  specify('no messages and load error', function() {
    const call = getInteraction({
      attributes: { channel: 'voice', direction: 'outbound', occurred_at: '2026-11-10T16:00:00Z', expected_at: null, metadata: { note: 'Called the patient' } },
      relationships: { action: getRelationship(testAction), flow: getRelationship() },
    });

    routeOrganizationMessaging(true);
    routeMessageAction([call]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'No messages yet.')
      .find('.js-older')
      .should('not.be.visible');

    cy
      .intercept('GET', '/api/patients/*/interactions*', req => {
        if (!isMessagesRequest(req)) return;
        req.reply({ forceNetworkError: true });
      });

    cy
      .reload()
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'Messages could not be loaded.');

    cy
      .get('.patient-action__activity')
      .should('contain', 'Called the patient');
  });

  specify('messages unavailable', function() {
    const text = getText({ metadata: { message: 'Texts stay in Activity' }, action: testAction });
    const regularAction = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship() },
    });
    const regularText = getText({ metadata: { message: 'Regular action text' }, action: regularAction });

    routeMessageAction([text]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__activity')
      .should('contain', 'Texts stay in Activity');

    cy
      .get('.messaging-history')
      .should('not.exist');

    routeOrganizationMessaging(true);
    routeMessageAction([text]);

    cy
      .routeWorkspaces(fx => {
        fx.data[0].attributes.settings = { messaging_enabled: false };

        return fx;
      });

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__activity')
      .should('contain', 'Texts stay in Activity');

    cy
      .get('.messaging-history')
      .should('not.exist');

    routeOrganizationMessaging(true);
    routeMessageAction([regularText], regularAction);

    cy
      .routeWorkspaces();

    cy
      .visit(`/patient/${ testPatient.id }/action/${ regularAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__activity')
      .should('contain', 'Regular action text');

    cy
      .get('.messaging-history')
      .should('not.exist');
  });
});
