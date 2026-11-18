import _ from 'underscore';
import dayjs from 'dayjs';

import { getResource, getRelationship } from 'helpers/json-api';
import fxTestSettings from 'fixtures/test/settings';

import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';
import { getFlow } from 'support/api/flows';
import { getInteraction } from 'support/api/interactions';
import { getPatientField } from 'support/api/patient-fields';
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
  const day = date.isSame(dayjs(), 'day') ? 'Today' : date.format('dddd');
  return `${ day }, ${ date.format(date.isSame(dayjs(), 'year') ? 'MMM D' : 'll') }`;
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

  const testPhones = [
    { label: 'home', number: '+16785552384', preferred: true },
    { label: 'mobile', number: '+16155550190', preferred: false },
  ];

  function routeMessageAction(interactions, action = testAction, phones = testPhones) {
    cy
      .routesForPatientAction()
      .routePatientField(fx => {
        fx.data = getPatientField({ attributes: { name: 'phones', value: phones } });

        return fx;
      }, 'phones')
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
    const todayText = getText({ occurredAt: getDayTs(0, 0, 1), metadata: { message: 'Sent first thing today.' }, action: testAction });
    const outbound = getText({ occurredAt: getDayTs(1, 9, 30), metadata: { message: 'A nurse will call you today.', clinician_name: 'Jessica Davenport' }, action: testAction });
    const organization = getText({ occurredAt: getDayTs(9, 9), metadata: { message: 'Checking in after your visit.' }, action: otherAction });
    const disposition = getText({ occurredAt: getDayTs(9, 10), metadata: { disposition: 'Text Sent' }, action: otherAction });
    const failures = [
      ['RECIPIENT_NOT_OPTED_IN', 'Patient opted out of texts.'],
      ['RECIPIENT_NOT_REACHABLE', 'This number can\'t receive texts.'],
      ['UNKNOWN_ERROR', ''],
    ];
    const undelivered = _.map(failures, ([code], index) => getText({
      occurredAt: getDayTs(9, 11, index),
      metadata: { phone_number: '+16155550190', message: `Undelivered ${ code }`, delivery: { status: 'failed', reason: { code, description: 'Failed' }, updated_at: getDayTs(9, 12) } },
      action: otherAction,
    }));
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
    routeMessageAction([inbound, outbound, todayText, organization, disposition, ...undelivered, inFlow, flowOnly, actionless, scheduled, cancelled, otherScheduled, email, call]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'Messages')
      .and('not.contain', 'Reminder for another action')
      .and('not.contain', 'Emailed discharge papers')
      .find('.messaging-card')
      .should('have.length', 13);

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
          todayText.attributes.occurred_at,
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
      .find('.js-work .messaging-card__link-text')
      .should('have.text', 'Message Nov 1');

    for (const [code, reason] of failures) {
      cy
        .contains('.messaging-card', `Undelivered ${ code }`)
        .should('contain', 'Not delivered')
        .find('.messaging-card__error')
        .should('have.text', `Not delivered to (615) 555-0190.${ reason && ` ${ reason }` }`);
    }

    cy
      .contains('.messaging-card', 'A nurse will call you today.')
      .should('not.contain', 'Not delivered')
      .find('.messaging-card__error')
      .should('not.exist');

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
      .find('.js-work .messaging-card__link-text')
      .should('have.text', 'Welcome Home Outreach')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ flowAction.id }`);

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .contains('.messaging-card', 'Flow reminder')
      .find('.js-work .messaging-card__link-text')
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
  });

  specify('messages buttons', function() {
    const text = getText({ occurredAt: getDayTs(1, 9), metadata: { message: 'See you soon.' }, action: testAction });
    const regularAction = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship() },
    });
    const flowMessageAction = getAction({
      attributes: { name: 'Flow message', options: { embed: 'compose' } },
      relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship(testFlow) },
    });

    routeOrganizationMessaging(true);
    routeMessageAction([text]);

    cy
      .routePatientActions(fx => {
        fx.data = [testAction, regularAction];
        fx.included = [testPatient];

        return fx;
      })
      .routeFlowActions(fx => {
        fx.data = [flowMessageAction];
        fx.included = [testPatient, testFlow];

        return fx;
      })
      .routeActions(fx => {
        fx.data = [testAction];
        fx.included = [testPatient];

        return fx;
      });

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'See you soon.');

    cy
      .get('.patient-action__title')
      .find('.js-messages')
      .click();

    cy
      .get('[data-messages-region]')
      .should('be.focused');

    cy
      .visit(`/patient/${ testPatient.id }/workflow`)
      .wait('@routePatientActions');

    cy
      .contains('.work-card', 'Call patient')
      .find('.js-messages')
      .should('not.exist');

    cy
      .contains('.work-card', 'Message Nov 10')
      .find('.js-messages')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .get('[data-messages-region]')
      .should('be.focused')
      .and('contain', 'See you soon.');

    cy
      .visit(`/patient/${ testPatient.id }/flow/${ testFlow.id }`)
      .wait('@routeFlowActions');

    cy
      .contains('.work-card', 'Flow message')
      .find('.js-messages')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/flow/${ testFlow.id }/action/${ flowMessageAction.id }`);

    cy
      .get('[data-messages-region]')
      .should('be.focused')
      .and('contain', 'See you soon.');

    cy
      .visit('/worklist/owned-by')
      .wait('@routeActions');

    cy
      .contains('.work-card', 'Message Nov 10')
      .find('.js-messages')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/action/${ testAction.id }`);

    cy
      .get('[data-messages-region]')
      .should('be.focused')
      .and('contain', 'See you soon.');
  });

  specify('send a message', function() {
    const text = getText({ occurredAt: getDayTs(1, 9), metadata: { message: 'See you soon.' }, action: testAction });
    let sendFails = true;
    let releaseSend;
    let notSentCard;
    const send = new Cypress.Promise(resolve => {
      releaseSend = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction([text]);

    cy
      .intercept('POST', `/api/patients/${ testPatient.id }/interactions`, req => {
        if (sendFails) {
          return send.then(() => {
            req.reply({ statusCode: 400, body: { errors: [{ detail: 'Invalid', source: { pointer: '/data/attributes/metadata' } }] } });
          });
        }

        req.reply({ statusCode: 201, body: { data: req.body.data } });
      })
      .as('routePostInteraction');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .should('contain', 'New Message')
      .and('contain', 'To Omar Porter (615) 555-0190')
      .find('.js-input')
      .should('have.attr', 'placeholder', 'Write a message to Omar…');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('be.disabled');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('Hi');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('not.be.disabled');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('Line one{enter}{enter}')
      .should($input => {
        expect($input[0].scrollHeight).to.be.at.most($input[0].clientHeight);
      });

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .clear();

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('be.disabled');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('   ');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('be.disabled');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('Can you come in Tuesday?');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .click();

    cy
      .get('.messaging-composer')
      .find('.js-input', { timeout: 1000 })
      .should('have.value', '')
      .and('be.focused');

    cy
      .contains('.messaging-card', 'Can you come in Tuesday?')
      .should('contain', 'Sending…')
      .then(() => releaseSend());

    cy
      .wait('@routePostInteraction')
      .its('request.body')
      .then(({ data }) => {
        expect(data.id).to.be.a('string');
        expect(data.type).to.equal('interactions');
        expect(data.attributes).to.have.all.keys('channel', 'direction', 'occurred_at', 'metadata');
        expect(data.attributes.channel).to.equal('sms');
        expect(data.attributes.direction).to.equal('outbound');
        expect(data.attributes.occurred_at).to.be.a('string');
        expect(data.attributes.metadata).to.deep.equal({ phone_number: '+16155550190', message: 'Can you come in Tuesday?' });
        expect(data.relationships.action.data).to.deep.equal({ id: testAction.id, type: 'patient-actions' });
      });

    cy
      .contains('.messaging-card', 'Can you come in Tuesday?')
      .should('contain', 'Not sent')
      .and('not.contain', 'Sending…')
      .find('[role="alert"]')
      .should('have.text', 'Message could not be sent.')
      .then(() => {
        sendFails = false;
      });

    cy
      .contains('.messaging-card', 'Can you come in Tuesday?')
      .then($card => {
        notSentCard = $card[0];
      });

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('Tuesday at 2 works.');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .click();

    cy
      .wait('@routePostInteraction');

    cy
      .contains('.messaging-card', 'Tuesday at 2 works.')
      .should('have.class', 'messaging-card--outbound')
      .and('contain', 'Cypress Clinic')
      .and('not.contain', 'Sending…')
      .and('not.contain', 'Message could not be sent.');

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 3)
      .last()
      .should('contain', 'Tuesday at 2 works.');

    cy
      .contains('.messaging-card', 'Can you come in Tuesday?')
      .should($card => {
        expect($card[0]).to.equal(notSentCard);
      });

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('be.disabled');
  });

  specify('leaving while a message sends', function() {
    let releaseSend;
    const send = new Cypress.Promise(resolve => {
      releaseSend = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction([]);

    cy
      .intercept('POST', `/api/patients/${ testPatient.id }/interactions`, req => {
        return send.then(() => {
          req.reply({ statusCode: 400, body: { errors: [{ detail: 'Invalid', source: { pointer: '/data/attributes/metadata' } }] } });
        });
      })
      .as('routePostInteraction');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('On my way');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .click()
      .should('be.disabled');

    cy
      .get('.patient__context-trail')
      .contains('Omar Porter')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`)
      .then(() => releaseSend());

    cy
      .wait('@routePostInteraction');

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'No messages yet.')
      .and('not.contain', 'On my way');
  });

  specify('expanding the form hides messages', function() {
    const text = getText({ occurredAt: getDayTs(1, 9), metadata: { message: 'See you soon.' }, action: testAction });
    const formAction = getAction({
      attributes: { name: 'Message with form', options: { embed: 'compose' } },
      relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship(), form: getRelationship(testForm) },
    });

    routeOrganizationMessaging(true);
    routeMessageAction([text], formAction);

    cy
      .routeFormByAction()
      .routeForm()
      .routeFormDefinition()
      .routeFormActionFields()
      .routeFormFields()
      .routeLatestFormResponse()
      .visit(`/patient/${ testPatient.id }/action/${ formAction.id }`)
      .wait('@routeAction');

    cy
      .get('.patient-action__messages')
      .should('be.visible')
      .and('contain', 'See you soon.');

    cy
      .get('.patient-action .js-expand-button')
      .click();

    cy
      .get('.patient-action')
      .should('have.class', 'patient-action--form-expanded');

    cy
      .get('.patient-action__messages')
      .should('not.be.visible');
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
      .intercept('GET', '/api/patients/*/fields/phones', { forceNetworkError: true })
      .as('routePhonesError');

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
      .get('.messaging-history .messaging-card')
      .should('have.length', 25)
      .first()
      .should('contain', 'Text 6');

    cy
      .get('.messaging-composer')
      .should('not.exist');

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
      .get('.messaging-history .js-older')
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
      .get('.messaging-history .messaging-card')
      .should('have.length', 25);

    cy
      .get('.messaging-history')
      .should('not.contain', 'Earlier messages could not be loaded.');

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
    routeMessageAction([call], testAction, [{ label: 'home', number: '+16785552384', preferred: true }]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'No messages yet.')
      .find('.js-older')
      .should('not.be.visible');

    cy
      .get('.messaging-composer')
      .should('not.exist');

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
