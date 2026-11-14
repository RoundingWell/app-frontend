import { range } from 'underscore';

import { getPatient } from 'support/api/patients';
import { getAction } from 'support/api/actions';
import { getFlow } from 'support/api/flows';
import { getInteraction } from 'support/api/interactions';
import { getRelationship } from 'helpers/json-api';
import { stateTodo, stateDone } from 'support/api/states';
import { NAMESPACE, PATIENT_IDS, WORKSPACE_ID } from 'js/entities-service/messaging-prototype/contract';

const PATIENT = PATIENT_IDS[0];
const ACTION = '30000000-0000-4000-8000-000000000001';
const OTHER = '30000000-0000-4000-8000-000000000002';
const FLOW = '40000000-0000-4000-8000-000000000001';

function fixture() {
  const patient = getPatient({ id: PATIENT, attributes: { first_name: 'Demo', last_name: 'Patient SYNTHETIC' } });
  const action = getAction({ id: ACTION, attributes: { name: 'Synthetic current conversation', details: 'SYNTHETIC messaging action', options: { embed: 'compose' } }, relationships: { patient: getRelationship(patient), state: getRelationship(stateTodo), flow: { data: null } } });
  const other = getAction({ id: OTHER, attributes: { name: 'Synthetic previous conversation', details: 'SYNTHETIC historical action', options: { embed: 'compose' } }, relationships: { patient: getRelationship(patient), state: getRelationship(stateTodo), flow: { data: null } } });
  const row = (index, overrides = {}, wrapper = {}) => getInteraction({
    attributes: {
      channel: 'sms', direction: index % 3 ? 'outbound' : 'inbound', expected_at: null,
      occurred_at: new Date(Date.UTC(2026, 10, 1 + Math.floor(index / 6), 12, index % 6)).toISOString(),
      metadata: { prototype_fixture: {
        synthetic: true, contract_version: 1, namespace: NAMESPACE, kind: 'message', auto_reply: 'none',
        body: `SYNTHETIC history ${ index }`, origin: 'clinician_manual', delivery: { outcome: 'delivered' }, ...wrapper,
      } }, ...overrides,
    }, relationships: { action: getRelationship(index % 2 ? action : other), flow: { data: null } },
  });
  const rows = range(60).map(index => row(index));
  rows.push(...range(15).map(index => {
    const scheduled = row(index, { occurred_at: null, expected_at: `2099-11-${ String(index + 1).padStart(2, '0') }T12:00:00Z` }, { body: 'UNRELATED FUTURE MUST BE HIDDEN' });
    scheduled.relationships.action = getRelationship(other);
    return scheduled;
  }));
  rows.push(row(61, { occurred_at: null, expected_at: '2099-11-20T12:00:00Z' }, { body: 'SYNTHETIC current scheduled' }));
  rows.push(row(57, {}, { body: 'SYNTHETIC long note https://example.org/demo '.repeat(30) }));
  rows.push(row(58, {}, { delivery: { outcome: 'not_delivered', reason_code: 'cannot_receive_sms', recipient_number: '+12025550190' } }));
  rows.push(row(59, {}, { kind: 'consent_audit', audit: { event: 'opted_out', number: '+12025550142', source: 'patient_stop', actor: null } }));
  const value = {
    synthetic: true, contract_version: 1, namespace: NAMESPACE, patient_id: PATIENT, revision: 0, messaging_enabled: true, dnc: false,
    recipients: [{ number: '+12025550142', state: 'opted_in', eligible: true, staff_change_allowed: true }, { number: '+12025550190', state: 'opted_out', eligible: false, disabled_reason: 'opted_out', staff_change_allowed: false, source: { kind: 'patient_stop' } }],
    interactions_composer: { enabled: true },
    actions: {
      [ACTION]: { state_id: stateTodo.id, composer: { enabled: true }, message_count: 31, latest_text: 'SYNTHETIC action-owned preview' },
      [OTHER]: { state_id: stateTodo.id, composer: { enabled: true }, message_count: 30 },
    },
  };
  return { patient, action, other, rows, value };
}

function withFlow(data) {
  data.flow = getFlow({ id: FLOW, attributes: { name: '[SYNTHETIC] Demo workflow context illustration' }, relationships: {
    patient: getRelationship(data.patient), state: getRelationship(stateTodo), actions: getRelationship([data.action]),
  } });
  data.action.relationships.flow = getRelationship(data.flow);
  return data;
}

function setup(data) {
  cy.on('window:before:load', win => {
    win.__MESSAGING_PROTOTYPE_TEST__ = true;
  });
  cy.routesForPatientAction()
    .routeCurrentClinician(fx => {
      fx.data.relationships.workspaces = getRelationship([{ id: WORKSPACE_ID, type: 'workspaces' }]);
      return fx;
    })
    .routeWorkspaces(fx => {
      fx.data[0].id = WORKSPACE_ID;
      return fx;
    })
    .routePatient(fx => ({ ...fx, data: data.patient }))
    .routePatientByAction(fx => ({ ...fx, data: data.patient }))
    .routeAction(fx => ({ ...fx, data: data.action, included: [data.patient, data.other, stateTodo, stateDone, ...(data.flow ? [data.flow] : [])] }))
    .routePatientActions(fx => ({ ...fx, data: [data.action, data.other].filter(action => !action.relationships.flow.data), included: [data.patient, stateTodo] }))
    .routePatientInteractions(fx => ({ ...fx, data: data.rows, included: [data.action, data.other] }));
  cy.intercept('GET', '/appconfig.json*', { app: { stage: 'dev', organization: 'demo', name: 'Synthetic test organization', version: 'test' } });
  cy.intercept('GET', `/api/patients/${ PATIENT }/fields/prototype_messaging`, req => req.reply({
    body: { data: { id: 'field', type: 'patient-fields', attributes: { name: 'prototype_messaging', value: data.value } } },
  })).as('context');
  if (data.flow) cy.routeFlow(fx => ({ ...fx, data: data.flow, included: [stateTodo] }));
}

context('native action-page Messaging integration', function() {
  let releaseContext;

  afterEach(function() {
    if (!releaseContext) return;
    releaseContext();
    releaseContext = null;
    cy.wait('@heldContext');
  });

  specify('includes eligible flow-linked actions from native hydration without changing provenance or drafts', function() {
    const data = withFlow(fixture());
    setup(data);
    cy.intercept('GET', `/api/actions/${ OTHER }*`, { body: { data: data.other, included: [data.patient, stateTodo] } });
    cy.viewport(1280, 720);
    cy.visit(`/patient/${ PATIENT }/flow/${ FLOW }/action/${ ACTION }`, { noWait: true });
    cy.get('.message-composer .js-body').should('be.enabled').type('SYNTHETIC flow action draft', { scrollBehavior: false });
    cy.get(`.messaging-widget .js-open-action[data-action-id="${ ACTION }"]`).should('be.visible');
    cy.get(`.messaging-widget .js-open-action[data-action-id="${ OTHER }"]`).click();
    cy.location('pathname').should('equal', `/one/patient/${ PATIENT }/action/${ OTHER }`);
    cy.get('.message-composer .js-body').should('be.enabled').type('SYNTHETIC standalone draft');
    cy.get(`.messaging-widget .js-open-action[data-action-id="${ ACTION }"]`).click();
    cy.location('pathname').should('equal', `/one/patient/${ PATIENT }/flow/${ FLOW }/action/${ ACTION }`);
    cy.get('.message-composer .js-body').should('have.value', 'SYNTHETIC flow action draft');
    cy.get('.patient__context-trail .js-flow').should('contain', data.flow.attributes.name);
    cy.get(`.messaging-widget .js-open-action[data-action-id="${ OTHER }"]`).click();
    cy.get('.message-composer .js-body').should('have.value', 'SYNTHETIC standalone draft');
    cy.intercept('GET', `/api/actions/${ ACTION }*`, { statusCode: 422, body: { errors: [{ detail: 'SYNTHETIC action unavailable' }] } });
    cy.reload();
    cy.get('.messaging-widget [role="status"]').should('contain', 'Open message actions could not be loaded');
    cy.get('.messaging-widget .js-open-action').should('not.exist');
    cy.get('.message-composer .js-body').should('be.enabled').and('have.value', 'SYNTHETIC standalone draft');
  });

  ['action', 'interactions'].forEach(surface => {
    const title = `releases the ${ surface } shell after failed preparation and permits a clean reentry`;

    specify(title, function() {
      const data = fixture();
      setup(data);
      cy.routeActions(fx => ({ ...fx, data: [] })).routeFlows();
      let failHistory = true;
      let hold = false;
      let reading;
      let started;
      const path = surface === 'action' ? `/patient/${ PATIENT }/action/${ ACTION }` : `/patient/${ PATIENT }/interactions`;
      const frame = { category: 'InteractionCompleted', resource: { id: data.rows[0].id, type: 'interactions' }, payload: { patient: { id: PATIENT }, attributes: { occurred_at: data.rows[0].attributes.occurred_at } } };
      cy.intercept('GET', `/api/patients/${ PATIENT }/interactions*`, req => {
        if (failHistory && !new URL(req.url).searchParams.has('filter[action]')) req.reply({ statusCode: 422, body: { errors: [{ detail: 'SYNTHETIC initial history failure' }] } });
      });
      cy.intercept('GET', `/api/patients/${ PATIENT }/fields/prototype_messaging`, req => {
        const body = { data: { id: 'field', type: 'patient-fields', attributes: { value: data.value } } };
        if (!hold) return req.reply({ body });
        hold = false;
        req.alias = 'heldContext';
        started();
        return new Cypress.Promise(resolve => {
          releaseContext = () => {
            req.reply({ body });
            resolve();
          };
        });
      });
      cy.visit(path, { noWait: true });
      if (surface === 'action') {
        cy.get('.messaging-history .js-status').should('contain', 'Messages could not be refreshed');
        cy.get('.messaging-history').should('have.attr', 'aria-busy', 'false');
      } else cy.get('.patient-interactions__status').should('contain', 'Interactions could not be loaded');
      cy.get('.messaging-widget .js-message-patient').should('be.enabled');
      if (surface === 'interactions') {
        cy.then(() => {
          failHistory = false;
        });
        cy.get('.patient-interactions__status .js-retry').click();
        cy.get('.message-composer .js-body').should('be.enabled');
        cy.get('[data-worklists-region] .app-nav__link').first().click();
        cy.get('.worklist-list-page').should('be.visible');
        cy.then(() => {
          failHistory = true;
        });
        cy.navigate(path);
        cy.get('.patient-interactions__status').should('contain', 'Interactions could not be loaded');
      }
      cy.then(() => {
        failHistory = false;
        hold = true;
        reading = new Cypress.Promise(resolve => {
          started = resolve;
        });
      });
      cy.sendWs(frame);
      cy.then(() => reading);
      cy.get('[data-worklists-region] .app-nav__link').first().click();
      cy.get('.worklist-list-page').should('be.visible');
      cy.then(() => {
        releaseContext();
        releaseContext = null;
      });
      cy.wait('@heldContext');
      cy.get('.message-composer').should('not.exist');
      const delivered = cy.spy();
      cy.getRadio(Radio => {
        Radio.channel('ws').once('message:interactions', delivered);
        cy.spy(Radio, 'request').as('departedRequests');
      });
      cy.sendWs(frame);
      cy.wrap(delivered).should('have.been.calledOnce');
      cy.get('@departedRequests').then(requests => {
        expect(requests.getCalls().filter(call => call.args[0] === 'entities' && call.args[1] === 'fetch:messagingPrototype:context'), 'no departed context reacts after the frame was delivered').to.have.length(0);
      });
      cy.navigate(path);
      cy.get('.message-composer .js-body').should('be.enabled').type(`SYNTHETIC ${ surface } reentry draft`);
      cy.get('[data-worklists-region] .app-nav__link').first().click();
      cy.get('.worklist-list-page').should('be.visible');
      cy.get('@departedRequests').invoke('resetHistory');
      cy.getRadio(Radio => Radio.channel('ws').once('message:interactions', delivered));
      cy.sendWs(frame);
      cy.wrap(delivered).should('have.been.calledTwice');
      cy.get('@departedRequests').then(requests => {
        expect(requests.getCalls().filter(call => call.args[0] === 'entities' && call.args[1] === 'fetch:messagingPrototype:context'), 'ordinary stop also releases its context').to.have.length(0);
      });
      cy.navigate(path);
      cy.get('.message-composer .js-body').should('be.enabled').and('have.value', `SYNTHETIC ${ surface } reentry draft`);
    });
  });

  specify('retains typing selection and an open recipient picker during an ordinary inbound refresh', function() {
    const data = fixture();
    setup(data);
    let hold = false;
    let started;
    cy.intercept('GET', `/api/patients/${ PATIENT }/fields/prototype_messaging`, req => {
      const body = { data: { id: 'field', type: 'patient-fields', attributes: { value: data.value } } };
      if (!hold) return req.reply({ body });
      hold = false;
      req.alias = 'heldContext';
      started();
      return new Cypress.Promise(resolve => {
        releaseContext = () => {
          req.reply({ body });
          resolve();
        };
      });
    });
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.message-composer .js-body').should('be.enabled').type('SYNTHETIC draft selection')
      .then($body => $body[0].setSelectionRange(0, 5));
    cy.get('.message-composer .js-body').should($body => {
      expect($body[0].selectionStart).to.equal(0);
      expect($body[0].selectionEnd).to.equal(5);
    });
    const incoming = getInteraction({ attributes: { ...data.rows[0].attributes, direction: 'inbound', occurred_at: '2026-11-12T12:00:00Z' }, relationships: data.rows[0].relationships });
    let reading;
    cy.then(() => {
      hold = true;
      reading = new Cypress.Promise(resolve => {
        started = resolve;
      });
      data.rows.push(incoming);
      data.value.recipients[1].disabled_reason = 'cannot_receive_sms';
    });
    cy.sendWs({ category: 'InteractionCompleted', resource: { id: incoming.id, type: 'interactions' }, payload: { patient: { id: PATIENT }, attributes: { occurred_at: incoming.attributes.occurred_at } } });
    cy.then(() => reading);
    cy.get('.message-composer .js-body').should($body => {
      expect($body[0].ownerDocument.activeElement).to.equal($body[0]);
      expect($body[0].selectionStart).to.equal(0);
      expect($body[0].selectionEnd).to.equal(5);
      expect($body[0].disabled).to.equal(false);
    });
    cy.then(() => {
      releaseContext();
      releaseContext = null;
    });
    cy.wait('@heldContext');
    cy.get('.message-composer .js-body').should('have.value', 'SYNTHETIC draft selection');
    cy.focused().should('have.class', 'message-composer__input');
    cy.get('.message-composer .js-number').click();
    cy.get('.picklist').should('be.visible');
    const next = getInteraction({ attributes: { ...incoming.attributes, metadata: { prototype_fixture: { ...incoming.attributes.metadata.prototype_fixture, body: 'SYNTHETIC picker incoming' } } }, relationships: incoming.relationships });
    cy.then(() => {
      data.rows.push(next);
      data.value.recipients[1].disabled_reason = 'opted_out';
    });
    cy.sendWs({ category: 'InteractionCompleted', resource: { id: next.id, type: 'interactions' }, payload: { patient: { id: PATIENT }, attributes: { occurred_at: next.attributes.occurred_at } } });
    cy.get('.messaging-history__list').should('contain', 'SYNTHETIC picker incoming');
    cy.get('.picklist').should('be.visible');
    cy.get('body').type('{esc}');
  });

  specify('removes preference controls when a current context refresh fails', function() {
    const data = fixture();
    setup(data);
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.messaging-widget .js-scenarios summary').click();
    cy.get('.messaging-widget .js-consent').first().should('be.enabled');
    cy.intercept('GET', `/api/patients/${ PATIENT }/fields/prototype_messaging`, {
      statusCode: 422, body: { errors: [{ detail: 'SYNTHETIC context read unavailable' }] },
    }).as('failedContext');
    cy.sendWs({ category: 'FieldUpdated', resource: { type: 'patients', id: PATIENT }, payload: {} });
    cy.wait('@failedContext');
    cy.get('.messaging-widget .js-consent').should('not.exist');
    cy.get('.messaging-widget .js-dnc').should('not.exist');
    cy.get('.messaging-widget .js-message-patient').should('be.disabled');
  });

  specify('keeps non-SMS Activity when more than a page of newer texts exists', function() {
    const data = fixture();
    data.rows.push(...range(110).map(index => getInteraction({ attributes: {
      channel: 'sms', direction: 'outbound', expected_at: null, occurred_at: new Date(Date.UTC(2026, 10, 12, 12, index)).toISOString(),
      metadata: { prototype_fixture: { ...data.rows[0].attributes.metadata.prototype_fixture, body: `SYNTHETIC newer text ${ index }` } },
    }, relationships: { action: getRelationship(data.action), flow: { data: null } } })));
    data.value.actions[ACTION].message_count += 110;
    data.rows.push(getInteraction({ attributes: {
      channel: 'voice', direction: 'outbound', occurred_at: '2026-09-01T12:00:00Z', expected_at: null,
      metadata: { note: 'SYNTHETIC older non-SMS Activity retained' },
    }, relationships: { action: getRelationship(data.action), flow: { data: null } } }));
    setup(data);
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.patient-action__activity').should('contain', 'SYNTHETIC older non-SMS Activity retained');
  });

  specify('forwards the Messages entry target from a workflow action count', function() {
    const data = fixture();
    setup(data);
    cy.routePatientFlows(fx => ({ ...fx, data: [] }));
    cy.visit(`/patient/${ PATIENT }/workflow`, { noWait: true });
    const navigation = cy.spy();
    cy.getRadio(Radio => Radio.channel('event-router').once('patient:action', navigation));
    cy.contains('.action-card', data.action.attributes.name).find('.messaging-summary__count').click();
    cy.wrap(navigation).should('have.been.calledWith', PATIENT, ACTION, { section: 'messages' });
    cy.location('pathname').should('equal', `/one/patient/${ PATIENT }/action/${ ACTION }`);
    cy.get('.messaging-history__row').should('have.length', 10);
  });

  specify('renders the shared history, loads older by real upward scrolling and records an action-bound send without echo', function() {
    const data = fixture();
    setup(data);
    cy.viewport(1280, 720);
    let posts = 0;
    let sentId;
    cy.intercept('POST', `/api/patients/${ PATIENT }/interactions`, req => {
      posts++;
      expect(req.body.data.attributes.metadata).to.have.all.keys('prototype_fixture');
      expect(req.body.data.relationships).to.deep.equal({ action: { data: { id: ACTION, type: 'patient-actions' } } });
      data.rows.push(req.body.data);
      sentId = req.body.data.id;
      data.value.actions[ACTION].message_count++;
      req.reply({ statusCode: 201, body: { data: req.body.data } });
    }).as('send');
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.get('.messaging-history__row').should('have.length', 10);
    cy.get('.message-composer').should('be.visible');
    cy.get('.messaging-history').should($view => {
      const viewport = $view[0].querySelector('.messaging-history__viewport');
      const composer = $view[0].querySelector('.message-composer');
      expect(viewport.clientHeight, 'desktop readable message viewport').to.be.at.least(120);
      expect(viewport.getBoundingClientRect().bottom).to.be.at.most(composer.getBoundingClientRect().top + 1);
      expect(composer.getBoundingClientRect().bottom).to.be.at.most($view[0].ownerDocument.defaultView.innerHeight);
    });
    cy.get('.patient-action__title').should($title => {
      expect($title[0].getBoundingClientRect().top).to.be.at.least($title[0].closest('.patient-action').getBoundingClientRect().top);
    });
    cy.get('.messaging-history').should('not.contain', 'UNRELATED FUTURE MUST BE HIDDEN');
    cy.get('.messaging-history').should('contain', 'SYNTHETIC current scheduled');
    cy.get('.messaging-consent-audit').should('contain', 'Demo Patient SYNTHETIC').and('contain', 'by texting STOP');
    cy.get('.patient-action__activity').should('contain', 'Activity');
    cy.get('.messaging-widget__opted-out').should('contain', '(202) 555-0190').and('contain', 'Opted Out');
    cy.get('.messaging-widget__stop-reason').should('contain', 'Only the patient can opt back in by texting START');
    cy.window().then(win => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve))));
    cy.get('.messaging-history__row').should('have.length', 10);
    let anchor;
    cy.get('.messaging-history__row').first().then($row => {
      const viewport = $row[0].closest('.messaging-history__viewport');
      anchor = $row[0].dataset.interactionId;
      const top = viewport.scrollTop + $row[0].getBoundingClientRect().top - viewport.getBoundingClientRect().top - 40;
      cy.get('.messaging-history__viewport').scrollTo(0, top);
    });
    cy.get('.messaging-history__row').should('have.length', 20);
    cy.get('.messaging-history__viewport').then($view => {
      const row = $view[0].querySelector(`[data-interaction-id="${ anchor }"]`);
      expect(Math.abs(row.getBoundingClientRect().top - $view[0].getBoundingClientRect().top - 40)).to.be.lessThan(4);
    });
    cy.contains('.messaging-history__row', 'SYNTHETIC long note').within(() => {
      cy.get('.js-show-more').should('be.visible').click();
      cy.get('.js-show-more').should('not.exist');
      cy.get('.messaging-card__body').should('have.class', 'js-body').and('not.have.class', 'messaging-card__body--collapsed');
      cy.get('a[href="https://example.org/demo"]').should('have.attr', 'rel', 'noopener noreferrer');
    });
    cy.get('.messaging-history .js-latest').click();
    cy.get('.message-composer .js-body').type('SYNTHETIC persisted own response');
    cy.get('.message-composer .js-send').click().wait('@send');
    cy.get('.messaging-history__list').should('contain', 'SYNTHETIC persisted own response');
    cy.get('.patient-action__activity').should('not.contain', 'SYNTHETIC persisted own response');
    cy.get('.message-composer .js-body').should('have.value', '');
    cy.get('.patient-action__title .messaging-summary__count').should('contain', '32');
    cy.then(() => expect(posts).to.equal(1));
    cy.get('.messaging-history').should('have.attr', 'aria-busy', 'false');
    cy.get('.messaging-history__viewport').scrollTo('bottom');
    cy.get('.patient-action').scrollTo('top');
    cy.then(() => {
      data.rows.splice(data.rows.findIndex(row => row.id === sentId), 1);
      data.value.actions[ACTION].message_count--;
    });
    cy.intercept('GET', `/api/patients/${ PATIENT }/interactions*`, req => {
      req.alias = 'deletionRead';
    });
    cy.then(() => {
      cy.sendWs({ category: 'ResourceDeleted', resource: { type: 'interactions', id: sentId }, payload: { patient: { id: PATIENT }, attributes: {} } });
    });
    cy.wait('@deletionRead');
    cy.get('.messaging-history').should('have.attr', 'aria-busy', 'false');
    cy.get('.messaging-history__list').should('not.contain', 'SYNTHETIC persisted own response');
  });

  specify('reconciles a confirmed actionless send across a historical gap without replacing the selected window', function() {
    const data = fixture();
    setup(data);
    const selected = data.rows[25];
    cy.intercept('POST', `/api/patients/${ PATIENT }/interactions`, req => {
      expect(req.body.data).not.to.have.property('relationships');
      data.rows.push(req.body.data);
      req.reply({ statusCode: 201, body: { data: req.body.data } });
    }).as('send');
    cy.visit(`/patient/${ PATIENT }/interactions/${ selected.id }`, { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.get('.messaging-timeline-row.is-selected').should('contain', 'SYNTHETIC history 25');
    cy.get('.message-composer .js-number').click();
    cy.get('.picklist [data-choice-id="+12025550142"]').click();
    cy.get('.message-composer .js-body').type('SYNTHETIC own text beyond historical window');
    let top;
    cy.get('.message-composer .js-body').should('be.enabled');
    cy.window().then(win => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve))));
    cy.get('.messaging-timeline-row.is-selected').then($row => {
      top = $row[0].getBoundingClientRect().top;
    });
    cy.get('.message-composer .js-send').click({ scrollBehavior: false }).wait('@send');
    cy.get('.patient-interactions__list').should('contain', 'SYNTHETIC own text beyond historical window');
    cy.get('.messaging-timeline-row.is-selected').should($row => {
      expect(Math.abs($row[0].getBoundingClientRect().top - top)).to.be.lessThan(4);
    });
    cy.location('pathname').should('equal', `/one/patient/${ PATIENT }/interactions/${ selected.id }`);
    cy.get('.patient-interactions__list').should('contain', 'SYNTHETIC history 40');
    cy.get('.message-composer .js-body').should('have.value', '');
  });

  specify('reads and inserts an unloaded websocket interaction once without an action or ownership change', function() {
    const data = fixture();
    setup(data);
    cy.visit(`/patient/${ PATIENT }/interactions/${ data.rows[25].id }`, { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.get('.messaging-timeline-row.is-selected').should('contain', 'SYNTHETIC history 25');
    const inbound = getInteraction({ attributes: {
      direction: 'inbound', channel: 'sms', expected_at: null, occurred_at: '2026-11-12T14:00:00Z',
      metadata: { prototype_fixture: { synthetic: true, namespace: NAMESPACE, contract_version: 1,
        kind: 'message', body: 'SYNTHETIC external unloaded inbound', origin: 'patient_reply', auto_reply: 'none', delivery: { outcome: 'unconfirmed' } } },
    } });
    cy.then(() => {
      data.rows.push(inbound);
    });
    let reads = 0;
    cy.intercept('GET', `/api/patients/${ PATIENT }/interactions*`, req => {
      if (new URL(req.url).searchParams.get('page[at]') !== inbound.id) return;
      reads++;
      if (reads === 1) req.reply({ body: { data: [], included: [] } });
    });
    const send = category => cy.sendWs({ category, resource: { id: inbound.id, type: 'interactions' },
      payload: { patient: { id: PATIENT }, attributes: category === 'ResourceCreated' ? {} : { occurred_at: inbound.attributes.occurred_at } } });
    send('ResourceCreated');
    send('InteractionCompleted');
    cy.get('.patient-interactions__list').should('contain', 'SYNTHETIC external unloaded inbound');
    send('InteractionCompleted');
    cy.get('.messaging-timeline-row').filter((index, row) => row.textContent.includes('SYNTHETIC external unloaded inbound')).should('have.length', 1);
    cy.get('.messaging-timeline-row.is-selected').should('contain', 'SYNTHETIC history 25');
    cy.location('pathname').should('equal', `/one/patient/${ PATIENT }/interactions/${ data.rows[25].id }`);
    cy.then(() => expect(reads).to.be.at.least(2));
    const inside = getInteraction({ attributes: { ...inbound.attributes, occurred_at: '2026-11-05T12:00:30Z',
      metadata: { prototype_fixture: { ...inbound.attributes.metadata.prototype_fixture, body: 'SYNTHETIC inserted inside coverage' } } } });
    let top;
    cy.get('.message-composer .js-body').should('be.enabled');
    cy.window().then(win => new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve))));
    cy.get('.messaging-timeline-row.is-selected').then($row => {
      top = $row[0].getBoundingClientRect().top;
    });
    cy.then(() => {
      data.rows.push(inside);
    });
    cy.sendWs({ category: 'InteractionCompleted', resource: { id: inside.id, type: 'interactions' },
      payload: { patient: { id: PATIENT }, attributes: { occurred_at: inside.attributes.occurred_at } } });
    cy.get('.patient-interactions__list').should('contain', 'SYNTHETIC inserted inside coverage');
    cy.get('.messaging-timeline-row.is-selected').should($row => {
      expect(Math.abs($row[0].getBoundingClientRect().top - top)).to.be.lessThan(4);
    });
  });

  specify('keeps Messages disabled after a confirmed send and reconciles it when the same filter is re-enabled', function() {
    const data = fixture();
    setup(data);
    cy.intercept('POST', `/api/patients/${ PATIENT }/interactions`, req => {
      data.rows.push(req.body.data);
      req.reply({ statusCode: 201, body: { data: req.body.data } });
    }).as('send');
    cy.visit(`/patient/${ PATIENT }/interactions`, { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.get('.js-filter[data-filter="messages"]').click();
    cy.get('.message-composer .js-number').click();
    cy.get('.picklist [data-choice-id="+12025550142"]').click();
    cy.get('.message-composer .js-body').type('SYNTHETIC recorded while Messages filtered out');
    cy.get('.message-composer .js-send').click().wait('@send');
    cy.get('.js-filter[data-filter="messages"]').should('not.have.class', 'is-selected');
    cy.get('.patient-interactions__list').should('not.contain', 'SYNTHETIC recorded while Messages filtered out');
    cy.get('.patient-interactions__recorded-status').should('contain', 'Text recorded');
    cy.get('.js-filter[data-filter="messages"]').click();
    cy.get('.patient-interactions__list').should('contain', 'SYNTHETIC recorded while Messages filtered out');
    cy.get('.patient-interactions__recorded-status').should('be.empty');
  });

  specify('keeps an authoritative action send visible when later raw history exceeds the reviewed budget', function() {
    const data = fixture();
    setup(data);
    let sent = false;
    let reads = 0;
    cy.intercept('GET', `/api/patients/${ PATIENT }/interactions*`, req => {
      if (sent && new URL(req.url).searchParams.get('page[limit]') === '10') reads++;
    });
    cy.intercept('POST', `/api/patients/${ PATIENT }/interactions`, req => {
      data.rows.push(req.body.data);
      data.rows.push(...range(300).map(index => getInteraction({ attributes: {
        channel: 'sms', direction: 'outbound', occurred_at: null, expected_at: new Date(Date.UTC(2100, 0, index + 1)).toISOString(),
        metadata: { prototype_fixture: { ...data.rows[0].attributes.metadata.prototype_fixture, body: 'SYNTHETIC hidden budget row' } },
      }, relationships: { action: getRelationship(data.other) } })));
      sent = true;
      req.reply({ statusCode: 201, body: { data: req.body.data } });
    }).as('send');
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.messaging-history__row').should('have.length', 10);
    cy.get('.message-composer .js-body').type('SYNTHETIC confirmed before background scan fails');
    cy.get('.message-composer .js-send').click().wait('@send');
    cy.get('.messaging-history__list').should('contain', 'SYNTHETIC confirmed before background scan fails');
    cy.get('.messaging-history').should('contain', 'Messages could not be refreshed');
    cy.get('.messaging-history').should('have.attr', 'aria-busy', 'false');
    cy.then(() => expect(reads).to.equal(30));
    cy.get('.messaging-history__list').should('contain', 'SYNTHETIC confirmed before background scan fails');
    cy.get('.message-composer .js-body').should('have.value', '');
  });

  specify('opens actionless Interactions composition from the sidebar and preserves uncertain IDs across reload', function() {
    const data = fixture();
    setup(data);
    let posts = 0;
    cy.intercept('POST', `/api/patients/${ PATIENT }/interactions`, req => {
      posts++;
      expect(req.body.data).not.to.have.property('relationships');
      expect(req.body.data.attributes.metadata).to.have.all.keys('prototype_fixture');
      data.rows.push(req.body.data);
      req.destroy();
    }).as('uncertain');
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.get(`.messaging-widget .js-open-action[data-action-id="${ ACTION }"]`).should('be.visible');
    cy.get('.messaging-widget .js-message-patient').should('be.enabled').click();
    cy.location('pathname').should('equal', `/one/patient/${ PATIENT }/interactions`);
    cy.focused().should('have.class', 'message-composer__input');
    cy.get('.messaging-timeline-row').last().should($row => {
      const composer = $row[0].closest('.patient-interactions').querySelector('.message-composer');
      expect($row[0].getBoundingClientRect().bottom).to.be.at.most(composer.getBoundingClientRect().top + 1);
    });
    cy.get('.message-composer .js-number').click();
    cy.get('.picklist [data-choice-id="+12025550142"]').click();
    cy.get('.message-composer .js-body').type('SYNTHETIC uncertain response');
    cy.get('.message-composer .js-send').click().wait('@uncertain');
    cy.get('.messaging-recovery').should('be.visible');
    cy.reload();
    cy.get('.messaging-recovery').should('be.visible');
    cy.get('.message-composer .js-send').should('be.disabled');
    cy.get('.messaging-recovery .js-check').click();
    cy.get('.messaging-recovery').should('not.be.visible');
    cy.get('.patient-interactions').should('contain', 'SYNTHETIC uncertain response');
    cy.then(() => expect(posts).to.equal(1));
  });

  specify('shows compact action-owned counts beside workflow titles with a full-text tooltip', function() {
    const data = fixture();
    const latest = data.rows.find(row => row.attributes.metadata.prototype_fixture.body?.startsWith('SYNTHETIC long note'));
    data.value.actions[ACTION].latest_interaction_id = latest.id;
    data.value.actions[ACTION].latest_text = latest.attributes.metadata.prototype_fixture.body.slice(0, 280);
    data.value.actions[OTHER].message_count = 0;
    setup(data);
    cy.viewport(1280, 720);
    cy.visit(`/patient/${ PATIENT }/workflow`, { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.contains('.action-card', 'Synthetic current conversation').within(() => {
      cy.get('.work-card__heading .messaging-summary__count').should('contain', '31').trigger('pointerover');
      cy.root().should('not.contain', 'SYNTHETIC long note');
    });
    cy.get('.tooltip').should('contain', latest.attributes.metadata.prototype_fixture.body);
    cy.contains('.action-card', 'Synthetic previous conversation').find('.messaging-summary__count').should('contain', '0');
    cy.routeActions(fx => ({ ...fx, data: [data.action, data.other], included: [data.patient, stateTodo] }));
    cy.visit('/worklist/owned-by', { noWait: true });
    cy.get('.startup').should('not.exist');
    cy.contains('.worklist-list__action-item', 'Synthetic current conversation').within(() => {
      cy.get('.work-card__title-row .messaging-summary__count').should('contain', '31').trigger('pointerover');
      cy.root().should('not.contain', 'SYNTHETIC long note');
    });
    cy.get('.tooltip').should('contain', latest.attributes.metadata.prototype_fixture.body);
    cy.contains('.worklist-list__action-item', 'Synthetic previous conversation').find('.messaging-summary__count').should('contain', '0');
    cy.viewport(390, 844);
    cy.document().should(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));
  });

  specify('keeps configured scheduled and Done actions readable without an enabled Send control', function() {
    const data = fixture();
    const scheduled = data.rows.find(row => row.attributes.expected_at === '2099-11-20T12:00:00Z');
    data.value.actions[ACTION].composer = { enabled: false, disabled_reason: 'scheduled', scheduled_interaction_id: scheduled.id };
    setup(data);
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.messaging-history__row').should('have.length', 10);
    cy.get('.message-composer .js-body').should('be.disabled').and('have.attr', 'placeholder').and('contain', 'This message is scheduled for');
    cy.get('.message-composer .js-send').should('not.be.visible');
    cy.get('.message-composer__reason').should('be.empty');
    cy.get('.messaging-history__list').should('contain', 'SYNTHETIC current scheduled');
    cy.then(() => {
      data.action.relationships.state = getRelationship(stateDone);
      data.value.actions[ACTION].state_id = stateDone.id;
      data.value.actions[ACTION].composer = { enabled: false, disabled_reason: 'action_done', scheduled_interaction_id: null };
    });
    cy.reload();
    cy.get('.messaging-history__row').should('have.length', 10);
    cy.get('.message-composer .js-body').should('be.disabled').and('have.attr', 'placeholder', 'This action is done.');
    cy.get('.message-composer .js-send').should('be.disabled');
    cy.get('.messaging-history__list').should('contain', 'SYNTHETIC history');
  });

  specify('renders native synthetic API lifecycle and delivery states through the common presentation adapter', function() {
    const data = fixture();
    const actor = { source: 'authenticated_staff', synthetic: false, actor_id: 'native-editor', display_name: 'Demo Staff SYNTHETIC', role_id: 'role', role_name: 'administrator', role_label: 'Administrator' };
    const base = data.rows[0];
    const row = (body, wrapper = {}, attributes = {}) => getInteraction({
      attributes: { ...base.attributes, direction: 'outbound', occurred_at: '2026-11-10T12:00:00Z', ...attributes,
        metadata: { prototype_fixture: { ...base.attributes.metadata.prototype_fixture, body, ...wrapper } },
      }, relationships: base.relationships,
    });
    data.rows = [
      row('SYNTHETIC received', {}, { direction: 'inbound' }),
      row('SYNTHETIC delivery illustration', { provenance: { synthetic: true, display_name: 'Historical Example SYNTHETIC' }, delivery: { outcome: 'delivered' } }),
      row('SYNTHETIC delivery unconfirmed', { delivery: { outcome: 'unconfirmed' } }),
      row('SYNTHETIC permanent failure', { delivery: { outcome: 'not_delivered', reason_code: 'cannot_receive_sms', recipient_number: '+12025550190' } }),
      row('SYNTHETIC blocked automatic text', { origin: 'flow_automation', delivery: { outcome: 'not_sent', reason_code: 'do_not_contact' } }),
      row('SYNTHETIC successful acknowledgement', { auto_reply: 'acknowledgement' }),
      row('SYNTHETIC failed acknowledgement', { auto_reply: 'acknowledgement', delivery: { outcome: 'not_delivered', reason_code: 'opted_out' } }),
      row('SYNTHETIC cancelled future request', { delivery: { outcome: 'unconfirmed' } }, { occurred_at: null, expected_at: '2099-11-20T12:00:00Z', cancelled_at: '2026-11-09T12:00:00Z' }),
      row('SYNTHETIC authenticated staff record', { provenance: actor, delivery: { outcome: 'unconfirmed' } }),
      row('', { kind: 'consent_audit', audit: { event: 'opted_out', number: '+12025550142', source: 'staff', actor } }),
    ];
    setup(data);
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.messaging-history__row').should('have.length', 10);
    cy.get('.messaging-history__viewport').scrollTo('top');
    cy.get('.messaging-history__beginning').should('be.visible');
    cy.contains('.messaging-card', 'SYNTHETIC received').should('have.class', 'messaging-card--patient').and('contain', 'Demo Patient SYNTHETIC');
    cy.contains('.messaging-card', 'SYNTHETIC delivery illustration').find('.messaging-card__status').should('not.exist');
    cy.contains('.messaging-card', 'SYNTHETIC delivery illustration').should('contain', 'Historical Example SYNTHETIC');
    cy.contains('.messaging-card', 'SYNTHETIC authenticated staff record').find('.messaging-card__headline').should('contain', actor.display_name).and('not.contain', 'Administrator').and('not.contain', 'Demo Persona');
    cy.get('.messaging-consent-audit').should('contain', `${ actor.display_name } recorded that Demo Patient SYNTHETIC opted out`).and('contain', 'Phone number').and('not.contain', '[object Object]').and('not.contain', 'Administrator');
    cy.contains('.messaging-card', 'SYNTHETIC delivery unconfirmed').find('.messaging-card__status').should('contain', 'Recorded · delivery unconfirmed');
    cy.contains('.messaging-card', 'SYNTHETIC permanent failure').within(() => {
      cy.get('.messaging-card__reason').should('contain', 'cannot receive texts').and('contain', '(202) 555-0190');
      cy.get('.messaging-card__bubble').should('have.css', 'border-top-style', 'solid');
    });
    cy.contains('.messaging-card', 'SYNTHETIC blocked automatic text').should('contain', 'Not sent: Do Not Contact');
    cy.contains('.messaging-card', 'SYNTHETIC successful acknowledgement').should('have.class', 'messaging-card--auto-reply');
    cy.contains('.messaging-card', 'SYNTHETIC failed acknowledgement').should('have.class', 'messaging-card--auto-reply').find('.messaging-card__reason').should('contain', 'opted out');
    cy.contains('.messaging-card', 'SYNTHETIC cancelled future request').should('have.class', 'messaging-card--cancelled').find('.messaging-card__bubble').should('have.css', 'border-top-style', 'dashed');
    cy.get('.messaging-card--scheduled').should('not.exist');
    cy.get('.messaging-history__row').first().should('contain', 'SYNTHETIC cancelled future request');
    cy.contains('.messaging-card', 'SYNTHETIC authenticated staff record').scrollIntoView().should('be.visible');
    cy.get('.messaging-consent-audit').scrollIntoView().should('be.visible');
  });

  specify('keeps the one action viewport, composer and Activity reachable on mobile without overlap', function() {
    const data = withFlow(fixture());
    data.patient.attributes.last_name = '[SYNTHETIC] Thread Lifecycle';
    data.action.attributes.name = '[SYNTHETIC] Long conversation example - Urgent';
    data.action.attributes.details = '[SYNTHETIC] Generic conversation fixture';
    setup(data);
    cy.viewport(390, 844);
    cy.visit(`/patient/${ PATIENT }/flow/${ FLOW }/action/${ ACTION }`, { noWait: true });
    cy.get('.messaging-history__row').should('have.length', 10);
    cy.get('.message-composer').should('be.visible');
    cy.get('.patient__context-trail').should($trail => {
      expect($trail[0].getBoundingClientRect().height, 'compact hierarchy leaves reading space').to.be.at.most(80);
      expect($trail.text()).to.include(data.patient.attributes.last_name).and.include(data.flow.attributes.name).and.include(data.action.attributes.name);
    });
    cy.get('.patient-action').should($view => {
      expect($view[0].scrollWidth - $view[0].clientWidth).to.be.at.most(1);
      const composer = $view[0].querySelector('.message-composer');
      expect(getComputedStyle($view[0].querySelector('.messaging-history__list')).overflowY).to.equal('visible');
      const viewport = $view[0].querySelector('.messaging-history__viewport');
      expect(viewport.scrollHeight).to.be.greaterThan(viewport.clientHeight);
      expect(viewport.clientHeight, 'room to read multiple message cards with long names').to.be.at.least(240);
      expect(viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight, 'Latest reaches the physical message end').to.be.lessThan(2);
      expect(composer.getBoundingClientRect().bottom).to.be.at.most($view[0].ownerDocument.defaultView.innerHeight);
      expect(viewport.getBoundingClientRect().bottom).to.be.at.most(composer.getBoundingClientRect().top + 1);
    });
    cy.document().should(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));
    cy.get('.message-composer .js-body').type('SYNTHETIC unsent mobile draft retained through resizing', { scrollBehavior: false });
    cy.get('.messaging-history__viewport').should($viewport => {
      const viewport = $viewport[0].getBoundingClientRect();
      const doc = $viewport[0].ownerDocument;
      expect(viewport.top, 'reading area remains on screen while typing').to.be.at.least(doc.querySelector('.patient__context-trail').getBoundingClientRect().bottom);
      expect(doc.querySelector('.message-composer').getBoundingClientRect().bottom).to.be.at.most(doc.defaultView.innerHeight);
    });
    cy.viewport(1280, 720);
    cy.get('.message-composer .js-body').should('have.value', 'SYNTHETIC unsent mobile draft retained through resizing');
    cy.viewport(390, 844);
    cy.get('.messaging-history .js-latest').click();
    cy.get('.message-composer .js-body').should('have.value', 'SYNTHETIC unsent mobile draft retained through resizing');
    cy.get('.messaging-history__viewport').should($viewport => expect($viewport[0].clientHeight).to.be.at.least(240));
    cy.get('.patient-action').scrollTo('top');
    cy.get('.patient-action__title').should($title => {
      const viewport = $title[0].closest('.patient-action').getBoundingClientRect();
      const title = $title[0].getBoundingClientRect();
      expect(title.top, 'full title remains reachable above the thread').to.be.at.least(viewport.top);
      expect(title.bottom).to.be.at.most(viewport.bottom);
    });
    cy.get('.messaging-history .js-latest').click();
    cy.get('.message-composer .js-body').clear();
    cy.get('.patient-action').scrollTo('bottom');
    cy.get('.patient-action__activity').should('be.visible');
    cy.routeActions(fx => ({ ...fx, data: [] })).routeFlows();
    cy.get('[data-worklists-region] .app-nav__link').first().click();
    cy.get('.worklist-list-page').should('be.visible');
    cy.navigate(`/patient/${ PATIENT }/flow/${ FLOW }/action/${ ACTION }`);
    cy.get('.messaging-history[aria-busy="false"] .messaging-history__row').should('have.length', 10);
    cy.get('.message-composer .js-body').should('be.enabled');
    cy.get('.patient__context-trail .js-back').should('be.visible');
    cy.get('.patient__context-trail').should($trail => expect($trail[0].getBoundingClientRect().height).to.be.at.most(80));
    cy.get('.messaging-history__viewport').should($viewport => expect($viewport[0].clientHeight).to.be.at.least(240));
    cy.get('.patient__context-trail .js-back').click();
    cy.get('.worklist-list-page').should('be.visible');
  });

  specify('persists a revisioned synthetic DNC intent, keeps the draft and renders one native audit line', function() {
    const data = fixture();
    setup(data);
    cy.intercept('PATCH', `/api/patients/${ PATIENT }/fields/prototype_messaging`, req => {
      expect(req.body.data).to.include({ id: 'field', type: 'patient-fields' });
      const intent = req.body.data.attributes.value;
      expect(intent.revision).to.equal(data.value.revision);
      let audit;
      if (intent.operation === 'set_consent') {
        expect(intent.number).to.equal('+12025550142');
        const recipient = data.value.recipients[0];
        recipient.state = intent.state;
        recipient.eligible = intent.state === 'opted_in';
        recipient.disabled_reason = recipient.eligible ? null : 'opted_out';
        audit = { event: intent.state, number: recipient.number, actor: null, source: 'staff' };
        req.alias = 'consent';
      } else {
        expect(intent).to.deep.equal({ operation: 'set_dnc', revision: 2, dnc: true });
        data.value.dnc = true;
        data.value.recipients.forEach(row => {
          row.eligible = false;
        });
        audit = { event: 'dnc_on', number: null, actor: null, source: 'staff' };
        req.alias = 'dnc';
      }
      data.value.revision++;
      data.rows.push(getInteraction({ attributes: { channel: 'sms', occurred_at: new Date().toISOString(), metadata: { prototype_fixture: {
        synthetic: true, namespace: NAMESPACE, contract_version: 1, kind: 'consent_audit', audit,
      } } } }));
      req.reply({ statusCode: 200, body: { data: { id: 'field', type: 'patient-fields', attributes: { value: data.value } } } });
    });
    cy.visit(`/patient/${ PATIENT }/action/${ ACTION }`, { noWait: true });
    cy.get('.message-composer .js-body').should('be.enabled').type('SYNTHETIC draft retained');
    cy.get('.messaging-widget .js-open-action').should('have.length', 2);
    cy.get('.messaging-widget .js-scenarios summary').click();
    cy.get('.messaging-widget .js-consent').last().should('be.disabled');
    cy.get('.messaging-widget .js-consent').first().click();
    cy.get('.picklist [data-choice-id="opted_out"]').click().wait('@consent');
    cy.get('.message-composer .js-body').should('be.disabled').and('have.attr', 'placeholder', 'This number is opted out of texts.');
    cy.get('.messaging-widget .js-consent').first().click();
    cy.get('.picklist [data-choice-id="opted_in"]').click().wait('@consent');
    cy.get('.message-composer .js-body').should('be.enabled').and('have.value', 'SYNTHETIC draft retained');
    cy.get('.messaging-widget .js-dnc').click().wait('@dnc');
    cy.get('.message-composer .js-body').should('be.disabled').and('have.value', 'SYNTHETIC draft retained');
    cy.get('.messaging-widget .js-message-patient').should('be.disabled');
    cy.get('.messaging-widget__number').should('not.exist');
    cy.get('.messaging-history .messaging-consent-audit').should('contain', 'enabled Do Not Contact');
    cy.get('.patient-action__title .messaging-summary__count').should('contain', '31');
    cy.reload();
    cy.get('.message-composer .js-body').should('be.disabled').and('have.value', 'SYNTHETIC draft retained');
  });
});
