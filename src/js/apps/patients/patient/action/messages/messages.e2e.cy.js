import _ from 'underscore';
import dayjs from 'dayjs';

import { getResource, getRelationship } from 'helpers/json-api';
import fxTestSettings from 'fixtures/test/settings';

import { getAction } from 'support/api/actions';
import { testForm } from 'support/api/forms';
import { getFlow } from 'support/api/flows';
import { getClinician } from 'support/api/clinicians';
import { getInteraction } from 'support/api/interactions';
import { getMessage, getMessagePage } from 'support/api/messages';
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
  return new URL(req.url).pathname.endsWith('/messages');
}

function isOlderMessagesRequest(req) {
  return isMessagesRequest(req) && getQuery(req).has('page[before]');
}

function isNewestMessagesRequest(req) {
  const query = getQuery(req);
  return isMessagesRequest(req) && !query.has('page[before]') && !query.has('page[after]') && !query.has('page[at]');
}

function getText({ direction = 'outbound', sortAt = '2026-11-10T15:00:00Z', status = direction === 'inbound' ? 'received' : 'sent', body = 'Text', failureReason = null, action, author }) {
  return getMessage({
    attributes: {
      direction,
      status,
      body,
      phone: '+16155550190',
      failure_reason: failureReason,
      send_at: status === 'scheduled' ? sortAt : null,
      sort_at: sortAt,
    },
    relationships: {
      action: getRelationship(action),
      author: getRelationship(author),
    },
  });
}

function getSavedText(data, attributes, action) {
  return getMessage({
    id: data.id,
    attributes: { ...data.attributes, direction: 'outbound', ...attributes },
    relationships: { action: getRelationship(action) },
  });
}

context('patient action messages', function() {
  const testPatient = getPatient({ attributes: { first_name: 'Omar', last_name: 'Porter' } });
  const testFlow = getFlow({ attributes: { name: 'TCM Follow-up' }, relationships: { patient: getRelationship(testPatient) } });
  const testAction = getAction({
    attributes: { name: 'Message Nov 10', tags: ['message'] },
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

  const clinician = getClinician({ attributes: { name: 'Jessica Davenport' } });

  function routeMessageAction(texts, action = testAction, phones = testPhones, interactions = []) {
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
      .routePatientMessages(fx => {
        fx.data = texts;
        fx.included = [otherAction, flowAction, clinician];

        return fx;
      })
      .routePatientInteractions(fx => {
        fx.data = interactions;

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

  function sendTextWs(category, text, attributes = {}, patient = testPatient) {
    cy
      .sendWs({
        category,
        resource: { type: 'interactions', id: text.id },
        payload: { patient: { type: 'patients', id: patient.id }, attributes },
      });
  }

  specify('message history', function() {
    const inbound = getText({ direction: 'inbound', sortAt: getDayTs(1, 9), body: 'Can someone call me about my foot?', action: testAction });
    const todayText = getText({ sortAt: getDayTs(0, 0, 1), body: 'Sent first thing today.', action: testAction });
    const outbound = getText({ sortAt: getDayTs(1, 9, 30), body: 'A nurse will call you today.', action: testAction, author: clinician });
    const followUp = getText({ sortAt: getDayTs(1, 9, 45), body: 'Around noon.', action: testAction, author: clinician });
    const fromOrganization = getText({ sortAt: getDayTs(1, 10), body: 'Reply STOP to opt out.', action: testAction });
    const organization = getText({ sortAt: getDayTs(9, 9), body: 'Checking in after your visit.', action: otherAction });
    const failures = [
      ['not_opted_in', 'Patient opted out of texts.'],
      ['RECIPIENT_NOT_REACHABLE', 'This number can\'t receive texts.'],
      ['UNKNOWN_ERROR', ''],
    ];
    const undelivered = _.map(failures, ([code], index) => getText({
      sortAt: getDayTs(9, 11, index),
      status: 'failed',
      failureReason: { code },
      body: `Undelivered ${ code }`,
      action: otherAction,
    }));
    const inFlow = getText({ sortAt: getDayTs(8, 9), body: 'Welcome home!', action: flowAction });
    const actionless = getText({ sortAt: getDayTs(6, 9), body: 'Sent from Interactions' });
    const longMessage = `Long text start. ${ _.times(60, () => 'Please remember to take your medication.').join(' ') } Long text end.`;
    const long = getText({ sortAt: getDayTs(9, 9, 30), body: longMessage, action: testAction });
    const scheduled = getText({ status: 'scheduled', sortAt: '2099-11-20T15:00:00Z', body: 'Monthly check-in', action: testAction });
    const otherScheduled = getText({ status: 'scheduled', sortAt: '2099-11-21T15:00:00Z', body: 'Reminder for another action', action: otherAction });
    const draft = getText({ status: 'drafted', sortAt: getDayTs(0, 0, 2), body: 'Unsent draft' });
    const email = getInteraction({
      attributes: { channel: 'email', direction: 'outbound', occurred_at: getDayTs(1, 10, 30), expected_at: null, metadata: { note: 'Emailed discharge papers' } },
      relationships: { action: getRelationship(testAction), flow: getRelationship() },
    });
    const call = getInteraction({
      attributes: { channel: 'voice', direction: 'outbound', occurred_at: getDayTs(1, 11), expected_at: null, metadata: { note: 'Called the patient' } },
      relationships: { action: getRelationship(testAction), flow: getRelationship() },
    });

    routeOrganizationMessaging(true);
    routeMessageAction([inbound, outbound, followUp, fromOrganization, todayText, organization, long, ...undelivered, inFlow, actionless, scheduled, otherScheduled, draft], testAction, testPhones, [email, call]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .wait('@routePatientMessages')
      .itsUrl()
      .its('search')
      .should('equal', '?include=action,author&page[limit]=25');

    cy
      .get('.messaging-history')
      .should('contain', 'Messages')
      .and('not.contain', 'Reminder for another action')
      .and('not.contain', 'Unsent draft')
      .and('not.contain', 'Emailed discharge papers')
      .find('.messaging-card')
      .should('have.length', 13);

    cy
      .get('.patient-action__title')
      .find('.js-messages')
      .click();

    cy
      .get('[data-messages-region]')
      .should('be.focused');

    cy
      .get('.messaging-history__header')
      .should('contain', 'Messages')
      .and('contain', 'All messages with Omar Porter')
      .find('.messaging-history__header-date .js-date-label')
      .should('have.text', getDateLabel(organization.attributes.sort_at));

    cy
      .get('.messaging-history__header')
      .then($header => {
        cy
          .contains('.messaging-history__day', getDateLabel(actionless.attributes.sort_at))
          .scrollIntoView({ offset: { top: -$header.outerHeight() } });
      });

    cy
      .get('.messaging-history__header')
      .should($header => {
        const scrollerTop = $header.closest('.patient-action')[0].getBoundingClientRect().top;
        expect($header[0].getBoundingClientRect().top).to.be.closeTo(scrollerTop, 1);
      })
      .find('.messaging-history__header-date .js-date-label')
      .should('have.text', getDateLabel(actionless.attributes.sort_at));

    cy
      .get('.messaging-history__date')
      .should($dates => {
        expect(_.map($dates, date => date.textContent.trim())).to.deep.equal(_.map([
          organization.attributes.sort_at,
          inFlow.attributes.sort_at,
          actionless.attributes.sort_at,
          inbound.attributes.sort_at,
          todayText.attributes.sort_at,
          scheduled.attributes.sort_at,
        ], getDateLabel));
      });

    cy
      .contains('.messaging-history__day', getDateLabel(inbound.attributes.sort_at))
      .find('.messaging-card')
      .should('have.length', 4);

    cy
      .contains('.messaging-card', 'Can someone call me about my foot?')
      .should('not.have.class', 'messaging-card--continues');

    cy
      .contains('.messaging-card', 'A nurse will call you today.')
      .should('not.have.class', 'messaging-card--continuation')
      .and('have.class', 'messaging-card--continues');

    cy
      .contains('.messaging-card', 'Around noon.')
      .should('have.class', 'messaging-card--continuation')
      .and('contain', 'Jessica Davenport')
      .and('not.have.class', 'messaging-card--continues');

    cy
      .contains('.messaging-card', 'Reply STOP to opt out.')
      .should('not.have.class', 'messaging-card--continuation')
      .and('not.have.class', 'messaging-card--continues');

    cy
      .contains('.messaging-card', 'Long text start.')
      .should('not.have.class', 'messaging-card--continuation')
      .and('not.have.class', 'messaging-card--continues');

    cy
      .contains('.messaging-card', 'Undelivered RECIPIENT_NOT_REACHABLE')
      .should('not.have.class', 'messaging-card--continuation');

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
      .get('.messaging-history')
      .find('.js-show-more')
      .should('have.length', 1);

    cy
      .contains('.messaging-card', 'Long text start.')
      .find('.messaging-card__body')
      .should('have.class', 'messaging-card__body--collapsed')
      .and($body => {
        expect($body[0].scrollHeight).to.be.greaterThan($body[0].clientHeight);
      });

    cy
      .contains('.messaging-card', 'Long text start.')
      .find('.js-show-more')
      .should('have.attr', 'aria-expanded', 'false')
      .click();

    cy
      .contains('.messaging-card', 'Long text start.')
      .find('.messaging-card__body')
      .should('not.have.class', 'messaging-card__body--collapsed')
      .and('have.text', longMessage)
      .and('be.focused')
      .and($body => {
        expect($body[0].scrollHeight).to.be.at.most($body[0].clientHeight);
      });

    cy
      .contains('.messaging-card', 'Long text start.')
      .find('.js-show-more')
      .should('not.exist');

    cy
      .contains('.messaging-card', 'Monthly check-in')
      .should('have.class', 'messaging-card--scheduled')
      .and('contain', 'Scheduled');

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
      .get('.messaging-history__header')
      .find('.js-interactions')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/interactions`);
  });

  specify('send a message', function() {
    // Midnight today, so a text sent now always sorts after it.
    const text = getText({ sortAt: getDayTs(0, 0), body: 'See you soon.', action: testAction });
    const texts = [text];
    let sendFails = true;
    let releaseSend;
    let notSentCard;
    const send = new Cypress.Promise(resolve => {
      releaseSend = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('POST', `/api/actions/${ testAction.id }/messages`, req => {
        if (sendFails) {
          return send.then(() => {
            req.reply({ statusCode: 400, body: { errors: [{ detail: 'Invalid', source: { pointer: '/data/attributes/body' } }] } });
          });
        }

        const saved = getSavedText(req.body.data, { sort_at: dayjs().format() }, testAction);
        texts.push(saved);
        req.reply({ statusCode: 201, body: { data: saved } });
      })
      .as('routePostMessage');

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
      .wait('@routePostMessage')
      .its('request.body')
      .then(({ data }) => {
        expect(data.id).to.be.a('string');
        expect(data.type).to.equal('messages');
        expect(data.attributes).to.deep.equal({ body: 'Can you come in Tuesday?', status: 'queued' });
        expect(data.relationships).to.be.undefined;
      });

    cy
      .contains('.messaging-card', 'Can you come in Tuesday?')
      .should('contain', 'Not sent')
      .and('have.class', 'messaging-card--continuation')
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
      .wait('@routePostMessage');

    cy
      .contains('.messaging-card', 'Tuesday at 2 works.')
      .should('contain', 'Sending…')
      .then(() => {
        _.last(texts).attributes.status = 'sent';
      });

    sendTextWs('InteractionCompleted', getText({}), { occurred_at: dayjs().format() });

    cy
      .contains('.messaging-card', 'Tuesday at 2 works.')
      .should('not.have.class', 'messaging-card--new')
      .and('not.have.class', 'messaging-card--continuation')
      .and('have.class', 'messaging-card--outbound')
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
    const texts = [];
    let newestRequests = 0;
    let sendFails = true;
    let releaseSend;
    let send = new Cypress.Promise(resolve => {
      releaseSend = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('POST', `/api/actions/${ testAction.id }/messages`, req => {
        return send.then(() => {
          if (sendFails) {
            req.reply({ statusCode: 400, body: { errors: [{ detail: 'Invalid', source: { pointer: '/data/attributes/body' } }] } });
            return;
          }

          const saved = getSavedText(req.body.data, { sort_at: dayjs().format() }, testAction);
          texts.push(saved);
          req.reply({ statusCode: 201, body: { data: saved } });
        });
      })
      .as('routePostMessage');

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
        if (isNewestMessagesRequest(req)) newestRequests += 1;
      });

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

    sendTextWs('ResourceCreated', getText({ direction: 'inbound' }), { channel: 'message', direction: 'inbound' });

    cy
      .get('.patient__context-trail')
      .contains('Omar Porter')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`)
      .then(() => releaseSend());

    cy
      .wait('@routePostMessage');

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('have.value', '');

    cy
      .get('.messaging-history')
      .should('contain', 'No messages yet.')
      .and('not.contain', 'On my way')
      .then(() => {
        // The first visit and the return; the reply that waited for the send isn't loaded after leaving.
        expect(newestRequests).to.equal(2);

        sendFails = false;
        send = new Cypress.Promise(resolve => {
          releaseSend = resolve;
        });
      });

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('Running late');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .click();

    cy
      .get('.patient__context-trail')
      .contains('Omar Porter')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`)
      .then(() => releaseSend());

    cy
      .wait('@routePostMessage');

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 1)
      .and('contain', 'Running late')
      .and('contain', 'Sending…')
      .then(() => {
        // The second return; the send that finished after leaving doesn't load texts.
        expect(newestRequests).to.equal(3);
      });
  });

  specify('keeping an unsent text', function() {
    const composeAction = getAction({
      attributes: { name: 'Message Nov 12', tags: ['message'] },
      relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship() },
    });

    routeOrganizationMessaging(true);
    routeMessageAction([]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('{enter}Hi Omar,{enter}Call us back. ');

    cy
      .get('.patient__context-trail')
      .contains('Omar Porter')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`);

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('have.value', '\nHi Omar,\nCall us back. ');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('not.be.disabled');

    cy
      .get('.messaging-history__header')
      .find('.js-interactions')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/interactions`);

    cy
      .get('.patient-interactions .messaging-composer')
      .find('.js-input')
      .should('have.value', '')
      .type('From Interactions');

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('have.value', '\nHi Omar,\nCall us back. ');

    cy
      .go('forward');

    cy
      .get('.patient-interactions .messaging-composer')
      .find('.js-input')
      .should('have.value', 'From Interactions');

    routeMessageAction([], composeAction);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ composeAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('have.value', '');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('be.disabled');

    routeMessageAction([], testAction, [{ label: 'home', number: '+16785552384', preferred: true }]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('have.value', '')
      .and('have.attr', 'placeholder', 'Omar doesn\'t have a mobile number.');

    routeMessageAction([]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('have.value', '\nHi Omar,\nCall us back. ');
  });

  specify('expanding the form hides messages', function() {
    const text = getText({ sortAt: getDayTs(1, 9), body: 'See you soon.', action: testAction });
    const formAction = getAction({
      attributes: { name: 'Message with form', tags: ['message'] },
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
      sortAt: `2026-11-${ String(index + 1).padStart(2, '0') }T15:00:00Z`,
      body: `Text ${ index + 1 }`,
      action: testAction,
    }));
    let olderFails = true;

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('GET', '/api/patients/*/fields/phones', { forceNetworkError: true })
      .as('routePhonesError');

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
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
      .get('.messaging-history')
      .find('.js-beginning')
      .should('not.be.visible');

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

    cy
      .get('.messaging-history')
      .find('.js-beginning')
      .should('be.visible')
      .and('have.text', 'Beginning of messages with Omar Porter')
      .then(() => {
        texts.push(..._.times(25, index => getText({ status: 'drafted', sortAt: `2026-12-01T15:${ String(index).padStart(2, '0') }:00Z`, body: `Draft ${ index + 1 }` })));
      });

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
        if (isNewestMessagesRequest(req)) req.alias = 'routeRefresh';
      });

    sendTextWs('ResourceCreated', getText({}), { channel: 'message', direction: 'outbound' });

    cy
      .wait('@routeRefresh')
      .then(() => {
        texts.push(getText({ sortAt: '2026-12-02T15:00:00Z', body: 'After the drafts', action: testAction }));
      });

    // A second refresh shows its text only after the first one has been applied.
    sendTextWs('ResourceCreated', getText({}), { channel: 'message', direction: 'outbound' });

    cy
      .get('.messaging-history .messaging-card')
      .last()
      .should('contain', 'After the drafts');

    cy
      .get('.messaging-history')
      .should('not.contain', 'Draft 1')
      .find('.messaging-card')
      .should('have.length', 31);
  });

  specify('jumping to a date', function() {
    const texts = _.times(30, index => getText({
      sortAt: `2026-11-${ String(index + 1).padStart(2, '0') }T15:00:00Z`,
      body: `Text ${ index + 1 }`,
      action: testAction,
    }));

    let olderFails = true;
    let releaseOlder;
    const olderMessages = new Cypress.Promise(resolve => {
      releaseOlder = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
        if (!isOlderMessagesRequest(req)) return;
        req.alias = 'routeOlderMessages';
        if (olderFails) {
          req.reply({ forceNetworkError: true });
          return;
        }
        return olderMessages;
      })
      .intercept('POST', `/api/actions/${ testAction.id }/messages`, req => {
        const saved = getSavedText(req.body.data, { status: 'queued', sort_at: dayjs().format() }, testAction);
        texts.push(saved);
        req.reply({ statusCode: 201, body: { data: saved } });
      })
      .as('routePostMessage');

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history .messaging-card')
      .should('have.length', 25);

    cy
      .get('.messaging-history__day .js-date-button')
      .last()
      .click();

    cy
      .contains('.js-picklist-item', 'The very beginning')
      .click();

    cy
      .wait('@routeOlderMessages');

    cy
      .get('.messaging-history')
      .should('contain', 'Earlier messages could not be loaded. Try again.')
      .find('.messaging-card')
      .should('have.length', 25)
      .then(() => {
        olderFails = false;
      });

    cy
      .get('.messaging-history__day .js-date-button')
      .last()
      .click();

    cy
      .contains('.js-picklist-item', 'The very beginning')
      .click();

    cy
      .get('.messaging-history', { timeout: 1000 })
      .should('not.contain', 'Earlier messages could not be loaded.')
      .find('.js-older', { timeout: 1000 })
      .should('be.disabled');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .type('Sent while jumping');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .click();

    cy
      .wait('@routePostMessage')
      .then(() => releaseOlder());

    cy
      .wait('@routeOlderMessages');

    cy
      .get('.messaging-history .messaging-card')
      .should('have.length', 31);

    cy
      .contains('.messaging-card', 'Sent while jumping')
      .should('contain', 'Sending…')
      .then(() => {
        _.last(texts).attributes.status = 'sent';
      });

    sendTextWs('InteractionCompleted', getText({}), { occurred_at: dayjs().format() });

    cy
      .contains('.messaging-card', 'Sent while jumping')
      .should('not.contain', 'Sending…');

    cy
      .contains('.messaging-history__day', getDateLabel(texts[0].attributes.sort_at))
      .should($day => {
        const header = $day.closest('.messaging-history').find('.messaging-history__header')[0];
        expect($day[0].getBoundingClientRect().top).to.be.closeTo(header.getBoundingClientRect().bottom, 1);
      });

    cy
      .get('.messaging-history__header-date .js-date-label')
      .should('have.text', getDateLabel(texts[0].attributes.sort_at));

    cy
      .get('.messaging-history__header-date .js-date-button')
      .click();

    cy
      .contains('.js-picklist-item', 'Jump to a specific date')
      .click();

    cy
      .get('.patient-interactions__calendar-modal .datepicker__days a')
      .contains(/^20$/)
      .click();

    cy
      .contains('.messaging-history__day', getDateLabel(texts[19].attributes.sort_at))
      .should($day => {
        const header = $day.closest('.messaging-history').find('.messaging-history__header')[0];
        expect($day[0].getBoundingClientRect().top).to.be.closeTo(header.getBoundingClientRect().bottom, 1);
      });

    cy
      .get('.messaging-history__header-date .js-date-label')
      .should('have.text', getDateLabel(texts[19].attributes.sort_at));

    cy
      .get('@routeOlderMessages.all')
      .should('have.length', 2);
  });

  specify('live updates', function() {
    const oldest = getText({ sortAt: getDayTs(20, 9), body: 'Oldest text', action: testAction });
    const fillers = _.times(22, index => getText({ sortAt: getDayTs(10, 8, index), body: `Filler ${ index + 1 }`, action: testAction }));
    const sent = getText({ sortAt: getDayTs(1, 9), body: 'See you Tuesday.', action: testAction });
    const mistake = getText({ sortAt: getDayTs(1, 10), body: 'Wrong patient, sorry.', action: testAction });
    const scheduled = getText({ status: 'scheduled', sortAt: '2099-11-20T15:00:00Z', body: 'Monthly check-in', action: testAction });
    const firstReply = getText({ direction: 'inbound', sortAt: getDayTs(0, 0, 2), body: 'Is Tuesday at 2 ok?' });
    const secondReply = getText({ direction: 'inbound', sortAt: getDayTs(0, 0, 3), body: 'Or Wednesday?' });
    const thirdReply = getText({ direction: 'inbound', sortAt: getDayTs(0, 0, 4), body: 'Thursday works too.' });
    const lastReply = getText({ direction: 'inbound', sortAt: dayjs().add(1, 'minute').format(), body: 'Great, thanks!' });
    const lostReply = getText({ direction: 'inbound', sortAt: dayjs().add(2, 'minute').format(), body: 'Are you there?' });
    const nextReply = getText({ direction: 'inbound', sortAt: dayjs().add(3, 'minute').format(), body: 'Hello?' });
    const otherPatient = getPatient();
    const texts = [oldest, ...fillers, sent, mistake, scheduled];
    const created = { channel: 'message', direction: 'inbound' };
    let newestRequests = 0;
    let newestFails = false;
    let holdNewest;
    let releaseNewest;
    let markHeld;
    const held = new Cypress.Promise(resolve => {
      markHeld = resolve;
    });
    let releaseSend;
    const send = new Cypress.Promise(resolve => {
      releaseSend = resolve;
    });
    let markSaved;
    const saved = new Cypress.Promise(resolve => {
      markSaved = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
        if (!isNewestMessagesRequest(req)) return;
        newestRequests += 1;

        if (newestFails) {
          req.alias = 'routeNewestMessagesError';
          req.reply({ forceNetworkError: true });
          return;
        }

        if (!holdNewest) return;

        // The response holds the texts saved when the request arrived.
        const data = getMessagePage(texts, getQuery(req));
        markHeld();
        return holdNewest.then(() => {
          req.reply({ body: { data, included: [] } });
        });
      });

    cy
      .intercept('POST', `/api/actions/${ testAction.id }/messages`, req => {
        // The server saves the text before it responds.
        const text = getSavedText(req.body.data, { status: 'queued', sort_at: dayjs().format() }, testAction);
        texts.push(text);
        markSaved();
        return send.then(() => {
          req.reply({ statusCode: 201, body: { data: text } });
        });
      });

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .find('.js-older')
      .click();

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 26)
      .first()
      .should('contain', 'Oldest text');

    cy
      .contains('.messaging-card', 'Wrong patient, sorry.')
      .should('have.class', 'messaging-card--continuation');

    // Each update is saved on the server first, so the load it starts returns it.
    cy
      .then(() => {
        sent.attributes.status = 'failed';
        sent.attributes.failure_reason = { code: 'RECIPIENT_NOT_REACHABLE' };
      });

    sendTextWs('MetadataUpdated', sent, { metadata: { failure_reason: { code: 'RECIPIENT_NOT_REACHABLE' } } });

    cy
      .contains('.messaging-card', 'Wrong patient, sorry.')
      .should('not.have.class', 'messaging-card--continuation');

    cy
      .contains('.messaging-card', 'See you Tuesday.')
      .find('.messaging-card__error')
      .should('have.text', 'Not delivered to (615) 555-0190. This number can\'t receive texts.');

    cy
      .contains('.messaging-card', 'Monthly check-in')
      .should('have.class', 'messaging-card--scheduled');

    cy
      .then(() => {
        scheduled.attributes.status = 'sent';
        scheduled.attributes.sort_at = getDayTs(0, 0, 1);
      });

    sendTextWs('InteractionCompleted', scheduled, { occurred_at: getDayTs(0, 0, 1) });

    cy
      .contains('.messaging-card', 'Monthly check-in')
      .should('not.have.class', 'messaging-card--scheduled')
      .and('not.contain', 'Scheduled');

    cy
      .get('.messaging-history__day')
      .last()
      .should('contain', getDateLabel(getDayTs(0, 0, 1)))
      .and('contain', 'Monthly check-in');

    cy
      .get('.messaging-history')
      .should('not.contain', getDateLabel('2099-11-20T15:00:00Z'));

    cy
      .then(() => {
        texts.splice(texts.indexOf(mistake), 1);
      });

    sendTextWs('ResourceDeleted', mistake);

    cy
      .get('.messaging-history')
      .should('not.contain', 'Wrong patient, sorry.')
      .and('contain', 'Oldest text')
      .find('.messaging-card')
      .should('have.length', 25)
      .then(() => {
        texts.push(firstReply);
      });

    // Texts for another patient and calls don't load texts; the request count below checks it.
    sendTextWs('ResourceCreated', getText({}), created, otherPatient);

    sendTextWs('ResourceCreated', getText({}), { channel: 'voice', direction: 'inbound' });

    sendTextWs('ResourceCreated', firstReply, created);

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 26)
      .last()
      .should('contain', 'Is Tuesday at 2 ok?')
      .then(() => {
        texts.push(secondReply);
        holdNewest = new Cypress.Promise(resolve => {
          releaseNewest = resolve;
        });
      });

    sendTextWs('ResourceCreated', secondReply, created);

    cy
      .then(() => held)
      .then(() => {
        texts.push(thirdReply);
        texts.splice(texts.indexOf(sent), 1);
        texts.splice(texts.indexOf(secondReply), 1);
      });

    // These arrive while the held load is open; one more load follows it.
    sendTextWs('ResourceCreated', thirdReply, created);

    sendTextWs('ResourceDeleted', sent);

    sendTextWs('ResourceDeleted', secondReply);

    cy
      .then(() => {
        holdNewest = null;
        releaseNewest();
      });

    cy
      .get('.messaging-history .messaging-card')
      .last()
      .should('contain', 'Thursday works too.')
      .and('have.class', 'messaging-card--continuation');

    cy
      .get('.messaging-history .messaging-card')
      .should('have.length', 26);

    cy
      .contains('.messaging-card', 'Is Tuesday at 2 ok?')
      .should('have.class', 'messaging-card--continues');

    cy
      .get('.messaging-history')
      .should('not.contain', 'Or Wednesday?')
      .and('contain', 'Oldest text')
      .and('not.contain', 'Wrong patient, sorry.')
      .and('not.contain', 'See you Tuesday.')
      .then(() => {
        // The first visit, one per update above, the held load, and the load after it.
        expect(newestRequests).to.equal(7);
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
      .then(() => saved)
      .then(() => {
        texts.push(lastReply);
      });

    sendTextWs('ResourceCreated', lastReply, created);

    cy
      .contains('.messaging-card', 'Tuesday at 2 works.')
      .should('contain', 'Sending…')
      .then(() => releaseSend());

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 28)
      .last()
      .should('contain', 'Great, thanks!');

    cy
      .get('.messaging-history')
      .find('.messaging-card:contains("Tuesday at 2 works.")')
      .should('have.length', 1)
      .then(() => {
        _.find(texts, text => text.attributes.body === 'Tuesday at 2 works.').attributes.status = 'sent';
      });

    sendTextWs('InteractionCompleted', getText({}), { occurred_at: dayjs().format() });

    cy
      .contains('.messaging-card', 'Tuesday at 2 works.')
      .should('not.contain', 'Sending…')
      .then(() => {
        newestFails = true;
        texts.push(lostReply);
      });

    sendTextWs('ResourceCreated', lostReply, created);

    cy
      .wait('@routeNewestMessagesError')
      .then(() => {
        newestFails = false;
        texts.push(nextReply);
      });

    sendTextWs('ResourceCreated', nextReply, created);

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 30)
      .last()
      .should('contain', 'Hello?');
  });

  specify('leaving while new messages load', function() {
    const reply = getText({ direction: 'inbound', sortAt: getDayTs(0, 0, 1), body: 'Running late' });
    const texts = [];
    let releaseNewest;
    const newest = new Cypress.Promise(resolve => {
      releaseNewest = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'No messages yet.');

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
        if (!isNewestMessagesRequest(req)) return;
        return newest.then(() => {
          req.reply({ body: { data: [reply], included: [] } });
        });
      })
      .as('routeNewestMessages');

    sendTextWs('ResourceCreated', reply, { channel: 'message', direction: 'inbound' });

    cy
      .get('.patient__context-trail')
      .contains('Omar Porter')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/workflow`)
      .then(() => releaseNewest());

    cy
      .wait('@routeNewestMessages')
      .then(() => {
        texts.push(reply);
      });

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .find('.messaging-card')
      .should('have.length', 1)
      .and('contain', 'Running late');
  });

  specify('leaving while earlier messages load', function() {
    const texts = _.times(30, index => getText({
      sortAt: `2026-11-${ String(index + 1).padStart(2, '0') }T15:00:00Z`,
      body: `Text ${ index + 1 }`,
      action: testAction,
    }));

    let releaseOlderMessages;
    const olderMessages = new Cypress.Promise(resolve => {
      releaseOlderMessages = resolve;
    });

    routeOrganizationMessaging(true);
    routeMessageAction(texts);

    cy
      .intercept('GET', '/api/patients/*/messages*', req => {
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
    routeMessageAction([], testAction, [{ label: 'home', number: '+16785552384', preferred: true }], [call]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'No messages yet.')
      .find('.js-older')
      .should('not.be.visible');

    cy
      .get('.messaging-history')
      .find('.js-beginning')
      .should('not.be.visible');

    cy
      .get('.messaging-composer')
      .find('.js-input')
      .should('be.disabled')
      .and('have.attr', 'placeholder', 'Omar doesn\'t have a mobile number.');

    cy
      .get('.messaging-composer')
      .find('.js-send')
      .should('be.disabled');

    cy
      .get('.messaging-composer')
      .should('not.contain', 'To Omar Porter');

    cy
      .get('.messaging-history__header')
      .find('.js-interactions')
      .click();

    cy
      .location('pathname')
      .should('equal', `/one/patient/${ testPatient.id }/interactions`);

    cy
      .go('back')
      .wait('@routeAction');

    cy
      .intercept('GET', '/api/patients/*/messages*', { forceNetworkError: true });

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

  specify('messaging off and untagged actions', function() {
    const text = getText({ body: 'Texts stay in history', action: testAction });
    const regularAction = getAction({
      attributes: { name: 'Call patient' },
      relationships: { patient: getRelationship(testPatient), state: getRelationship(stateTodo), flow: getRelationship() },
    });
    const regularText = getInteraction({
      attributes: { channel: 'message', direction: 'outbound', occurred_at: '2026-11-10T15:00:00Z', expected_at: null, metadata: { message: 'Regular action text' } },
      relationships: { action: getRelationship(regularAction), flow: getRelationship() },
    });

    routeMessageAction([text]);

    cy
      .visit(`/patient/${ testPatient.id }/action/${ testAction.id }`)
      .wait('@routeAction');

    cy
      .get('.messaging-history')
      .should('contain', 'Texts stay in history');

    cy
      .get('.patient-action__activity')
      .should('not.contain', 'Texts stay in history');

    cy
      .get('.patient-action__title')
      .find('.js-messages')
      .should('be.visible');

    cy
      .get('.messaging-composer')
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
      .get('.messaging-history')
      .should('contain', 'Texts stay in history');

    cy
      .get('.messaging-composer')
      .should('not.exist');

    routeOrganizationMessaging(true);
    routeMessageAction([], regularAction, testPhones, [regularText]);

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

    cy
      .get('.patient-action__title')
      .find('.js-messages')
      .should('not.exist');
  });
});
