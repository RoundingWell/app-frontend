import Backbone from 'backbone';
import { Radio } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import service from '../messaging-prototype';
import { NAMESPACE, WORKSPACE_ID, PATIENT_IDS } from './contract';
import { attemptScope, attemptedSend, retainAttempt } from './send-attempts';
import { acknowledgeConfirmations, pendingConfirmations, rememberConfirmation } from './confirmed-sends';

function fixtureContext() {
  return {
    synthetic: true, contract_version: 1, namespace: NAMESPACE, patient_id: PATIENT_IDS[0], messaging_enabled: true,
    recipients: [{ number: '+12025550142', eligible: true }],
    interactions_composer: { enabled: true },
  };
}

context('record-only Messaging service', function() {
  let signal;
  let now = 1800000000000;

  beforeEach(function() {
    const scope = testScope();
    const userId = `synthetic-${ now }`;
    signal = new AbortController().signal;
    cy.stub(service, 'getTarget').callsFake(patientId => ({ patientId, hostname: 'messaging-demo.invalid', stage: 'dev', organization: 'demo', workspaceId: WORKSPACE_ID }));
    cy.stub(Date, 'now').returns(now += 2000);
    scope.reply(Radio, 'workspace', 'current', () => new Backbone.Model({ id: WORKSPACE_ID }));
    scope.reply(Radio, 'auth', 'getToken', () => 'synthetic-test-token');
    scope.reply(Radio, 'bootstrap', 'currentUser', () => ({ id: userId, clientKey: 'synthetic-client' }));
  });

  specify('reads and validates the native patient-field value, with cancellation protection', function() {
    cy.intercept('GET', `/api/patients/${ PATIENT_IDS[0] }/fields/prototype_messaging`, {
      data: { id: 'field', type: 'patient-fields', attributes: { name: 'prototype_messaging', value: fixtureContext() } },
    }).as('context');
    cy.then(() => service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal }))
      .then(value => expect(value.namespace).to.equal(NAMESPACE));
    cy.wait('@context').its('request.headers').should('include', { 'workspace': WORKSPACE_ID, 'client-key': 'synthetic-client', 'authorization': 'synthetic-test-token' });
    cy.then(async() => {
      const controller = new AbortController();
      controller.abort();
      let error;
      try {
        await service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal: controller.signal });
      } catch(failure) {
        error = failure;
      }
      expect(error.name).to.equal('AbortError');
    });
  });

  specify('patches preferences using the authoritative field identity returned by GET', function() {
    const id = '50000000-0000-4000-8000-000000000001';
    const value = { ...fixtureContext(), revision: 0 };
    cy.intercept('GET', `/api/patients/${ PATIENT_IDS[0] }/fields/prototype_messaging`, {
      data: { id, type: 'patient-fields', attributes: { value } },
    });
    cy.intercept('PATCH', `/api/patients/${ PATIENT_IDS[0] }/fields/prototype_messaging`, req => {
      expect(req.body.data).to.deep.equal({ id, type: 'patient-fields', attributes: { value: { operation: 'set_dnc', revision: 0, dnc: true } } });
      req.reply({ body: { data: { id, type: 'patient-fields', attributes: { value: { ...value, revision: 1, dnc: true } } } } });
    }).as('preference');
    cy.then(() => service.updateContext({ patientId: PATIENT_IDS[0], revision: 0, operation: 'set_dnc', dnc: true }, { signal }))
      .then(updated => expect(updated).to.include({ revision: 1, dnc: true }));
    cy.wait('@preference');
  });

  specify('hydrates projected actions outside the standalone list and rejects a different patient', function() {
    const patientId = PATIENT_IDS[0];
    const flowId = '40000000-0000-4000-8000-000000000001';
    const id = '30000000-0000-4000-8000-000000000001';
    const standaloneId = '30000000-0000-4000-8000-000000000002';
    const resource = (actionId, linkedPatient, flow = null) => ({
      id: actionId, type: 'patient-actions', attributes: { name: 'SYNTHETIC native action', options: { embed: 'compose' } },
      relationships: { patient: { data: { type: 'patients', id: linkedPatient } }, flow: { data: flow && { type: 'flows', id: flow } } },
    });
    const value = { ...fixtureContext(), actions: { [id]: {}, [standaloneId]: {} } };
    let linkedPatient = patientId;
    let reads = 0;
    cy.intercept('GET', `/api/patients/${ patientId }/actions*`, { body: { data: [resource(standaloneId, patientId)] } });
    cy.intercept('GET', `/api/actions/${ id }*`, req => {
      reads++;
      expect(req.headers).to.include({ 'workspace': WORKSPACE_ID, 'authorization': 'synthetic-test-token' });
      req.reply({ body: { data: resource(id, linkedPatient, flowId) } });
    });
    cy.then(() => service.fetchActions({ patientId, value }, { signal })).then(actions => {
      expect(actions.pluck('id')).to.have.members([id, standaloneId]);
      expect(actions.get(id).getFlow().id).to.equal(flowId);
      expect(reads).to.equal(1);
      linkedPatient = PATIENT_IDS[1];
    });
    cy.then(() => service.fetchActions({ patientId, value }, { signal }).catch(error => error)).then(result => {
      expect(result, 'a foreign patient is not returned as an eligible native action').to.be.instanceOf(Error);
      expect(reads).to.equal(2);
    });
  });

  specify('shares overlapping display reads while cancelling only the departing consumer', function() {
    const first = new AbortController();
    const second = new AbortController();
    let release;
    let begin;
    const started = new Cypress.Promise(resolve => {
      begin = resolve;
    });
    let reads = 0;
    let holdNext = true;
    cy.intercept('GET', `/api/patients/${ PATIENT_IDS[0] }/fields/prototype_messaging`, req => {
      reads++;
      const body = { data: { id: 'field', type: 'patient-fields', attributes: { value: { ...fixtureContext(), revision: reads } } } };
      if (!holdNext) return req.reply({ body });
      holdNext = false;
      begin();
      return new Cypress.Promise(resolve => {
        release = () => {
          req.reply({ body });
          resolve();
        };
      });
    });
    cy.then(async() => {
      const one = service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal: first.signal }).catch(error => error);
      const two = service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal: second.signal });
      await started;
      first.abort();
      release();
      const [cancelled, value] = await Promise.all([one, two]);
      expect(reads).to.equal(1);
      expect(cancelled.name).to.equal('AbortError');
      expect(value.namespace).to.equal(NAMESPACE);
      // A later notification must not join a response captured before it.
      holdNext = true;
      const reading = new Cypress.Promise(resolve => {
        begin = resolve;
      });
      const older = service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal, readKey: {} });
      await reading;
      const readKey = {};
      const newer = service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal, readKey });
      const joined = service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal, readKey });
      release();
      const [before, after, shared] = await Promise.all([older, newer, joined]);
      expect(reads).to.equal(3);
      expect(before.revision).to.equal(2);
      expect(after.revision).to.equal(3);
      expect(shared.revision).to.equal(3);
    });
  });

  specify('reads fresh mutation eligibility after an older display read instead of reusing it', function() {
    let release;
    let begin;
    const started = new Cypress.Promise(resolve => {
      begin = resolve;
    });
    let reads = 0;
    let writes = 0;
    cy.intercept('GET', `/api/patients/${ PATIENT_IDS[0] }/fields/prototype_messaging`, req => {
      reads++;
      const body = { data: { id: 'field', type: 'patient-fields', attributes: { value: { ...fixtureContext(), dnc: reads > 1 } } } };
      if (reads > 1) return req.reply({ body });
      begin();
      return new Cypress.Promise(resolve => {
        release = () => {
          req.reply({ body });
          resolve();
        };
      });
    });
    cy.intercept('POST', `/api/patients/${ PATIENT_IDS[0] }/interactions`, req => {
      writes++;
      req.reply({ statusCode: 201, body: { data: req.body.data } });
    });
    cy.then(async() => {
      const display = service.fetchContext({ patientId: PATIENT_IDS[0] }, { signal });
      await started;
      const send = service.sendInteraction({ patientId: PATIENT_IDS[0], body: 'Synthetic', recipientNumber: '+12025550142' }, { signal }).catch(error => error);
      release();
      const [, error] = await Promise.all([display, send]);
      expect(reads).to.equal(2);
      expect(writes).to.equal(0);
      expect(error.message).to.include('cannot be recorded');
    });
  });

  specify('posts an actionless record once, preserves headers and emits only an authoritative confirmation', function() {
    cy.stub(service, 'fetchContext').resolves(fixtureContext());
    const recorded = cy.spy().as('recorded');
    const channel = Radio.channel('messaging-prototype');
    channel.on('interaction:recorded', recorded);
    testScope().defer(() => channel.off('interaction:recorded', recorded));
    cy.intercept('POST', `/api/patients/${ PATIENT_IDS[0] }/interactions`, req => {
      const { data } = req.body;
      expect(data).not.to.have.property('relationships');
      expect(data.attributes.metadata).to.have.all.keys('prototype_fixture');
      // A patient read can show our persisted row before the POST response arrives.
      acknowledgeConfirmations(PATIENT_IDS[0], [new Backbone.Model({ id: data.id })]);
      req.reply({ statusCode: 201, body: { data } });
    }).as('record');
    cy.then(() => service.sendInteraction({ patientId: PATIENT_IDS[0], body: 'A synthetic local send', recipientNumber: '+12025550142' }, { signal }))
      .then(model => {
        expect(model.get('metadata').prototype_fixture.body).to.equal('A synthetic local send');
        expect(recorded).to.have.been.calledOnce;
        expect(recorded.firstCall.args[0]).to.include({ patientId: PATIENT_IDS[0], model });
        expect(pendingConfirmations(PATIENT_IDS[0])).to.deep.equal([]);
        rememberConfirmation(PATIENT_IDS[0], model);
        expect(pendingConfirmations(PATIENT_IDS[0])).to.deep.equal([]);
      });
    cy.wait('@record').its('request.headers').should('include', { 'workspace': WORKSPACE_ID, 'client-key': 'synthetic-client' });
  });

  specify('blocks duplicate clicks during eligibility refresh and rejects changed eligibility before POST', function() {
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    cy.stub(service, 'fetchContext').returns(gate);
    cy.stub(service, 'recordInteraction').as('record');
    cy.then(async() => {
      const params = { patientId: PATIENT_IDS[0], body: 'Synthetic', recipientNumber: '+12025550142' };
      const first = service.sendInteraction(params, { signal }).catch(error => error);
      const duplicate = await service.sendInteraction(params, { signal }).catch(error => error);
      expect(duplicate.message).to.include('already');
      release({ ...fixtureContext(), dnc: true });
      const failure = await first;
      expect(failure.message).to.include('cannot be recorded');
    });
    cy.get('@record').should('not.have.been.called');
  });

  specify('returns rejected and uncertain outcomes without confirmation or automatic retry', function() {
    const recorded = cy.spy();
    const channel = Radio.channel('messaging-prototype');
    channel.on('interaction:recorded', recorded);
    testScope().defer(() => channel.off('interaction:recorded', recorded));
    cy.stub(service, 'fetchContext').resolves(fixtureContext());
    let requests = 0;
    cy.intercept('POST', `/api/patients/${ PATIENT_IDS[0] }/interactions`, req => {
      requests++;
      if (requests === 1) req.reply({ statusCode: 409, body: { errors: [{ detail: 'Rejected synthetic request' }] } });
      else if (requests === 2) req.reply({ statusCode: 413, headers: { 'content-type': 'text/html' }, body: '<p>Rejected</p>' });
      else req.reply({ forceNetworkError: true });
    });
    cy.then(async() => {
      const params = { patientId: PATIENT_IDS[0], body: 'Synthetic', recipientNumber: '+12025550142' };
      const rejected = await service.sendInteraction(params, { signal }).catch(error => error);
      expect(rejected).to.include({ outcome: 'rejected' });
      expect(rejected.interactionId).to.be.a('string');
      Date.now.returns(now += 2000);
      const htmlRejection = await service.sendInteraction(params, { signal }).catch(error => error);
      expect(htmlRejection).to.include({ outcome: 'rejected' });
      expect(attemptedSend(params.patientId)).to.equal(undefined);
      Date.now.returns(now += 2000);
      const uncertain = await service.sendInteraction(params, { signal }).catch(error => error);
      expect(uncertain).to.include({ outcome: 'uncertain' });
      expect(uncertain.interactionId).not.to.equal(rejected.interactionId);
      const repeated = await service.sendInteraction(params, { signal }).catch(error => error);
      expect(repeated).to.include({ outcome: 'uncertain', interactionId: uncertain.interactionId });
      expect(requests).to.equal(3);
      expect(recorded).not.to.have.been.called;
    });
  });

  specify('does not clear a newer uncertain send when an older recovery completes late', function() {
    const patientId = PATIENT_IDS[0];
    const first = new Backbone.Model({ id: 'first-attempt' });
    let release;
    testScope().reply(Radio, 'entities', 'fetch:interactions:collection:byPatient', () => new Cypress.Promise(resolve => {
      release = () => resolve(new Backbone.Collection([first]));
    }));
    cy.then(async() => {
      const scope = attemptScope(patientId);
      retainAttempt(scope, first.id);
      const recovery = service.reconcileSend({ patientId }, { signal });
      retainAttempt(scope, 'newer-attempt');
      release();
      expect(await recovery).to.include({ confirmed: true, model: first });
      expect(attemptedSend(patientId)).to.deep.equal({ id: 'newer-attempt' });
    });
  });

  specify('does not submit a prior session draft after the login changes during preflight', function() {
    let user = Radio.request('bootstrap', 'currentUser');
    testScope().reply(Radio, 'bootstrap', 'currentUser', () => user);
    let release;
    cy.stub(service, 'fetchContext').returns(new Cypress.Promise(resolve => {
      release = resolve;
    }));
    const record = cy.stub(service, 'recordInteraction').resolves(new Backbone.Model());

    cy.then(async() => {
      const result = service.sendInteraction({ patientId: PATIENT_IDS[0], body: 'Prior session draft', recipientNumber: '+12025550142' }, { signal }).catch(error => error);
      user = { ...user, id: `${ user.id }-next` };
      release(fixtureContext());
      const error = await result;
      expect(record).not.to.have.been.called;
      expect(error.message).to.include('session changed');
    });
  });

  specify('does not PATCH a prior session preference after its field read completes', function() {
    let user = Radio.request('bootstrap', 'currentUser');
    testScope().reply(Radio, 'bootstrap', 'currentUser', () => user);
    let release;
    cy.stub(service, 'fetchContextResource').returns(new Cypress.Promise(resolve => {
      release = resolve;
    }));
    let writes = 0;
    cy.intercept('PATCH', `/api/patients/${ PATIENT_IDS[0] }/fields/prototype_messaging`, req => {
      writes++;
      req.reply({ body: { data: { id: 'field', type: 'patient-fields', attributes: { value: fixtureContext() } } } });
    });

    cy.then(async() => {
      const result = service.updateContext({ patientId: PATIENT_IDS[0], operation: 'set_dnc', revision: 0, dnc: true }, { signal }).catch(error => error);
      user = { ...user, id: `${ user.id }-next` };
      release({ id: 'field', value: fixtureContext() });
      const error = await result;
      expect(writes).to.equal(0);
      expect(error.message).to.include('session changed');
    });
  });
});
