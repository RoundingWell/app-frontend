import Backbone from 'backbone';
import { Radio } from 'marionette';

import { getPatientFieldId } from 'support/api/patient-fields';

import { NAMESPACE } from 'js/entities-service/messaging-prototype/contract';

import ContextSession from './context-session';

function fixtureContext(eligible = true) {
  return {
    synthetic: true, contract_version: 1, namespace: NAMESPACE, patient_id: 'patient', messaging_enabled: true,
    recipients: [{ number: '+12025550142', eligible }], interactions_composer: { enabled: true },
  };
}

context('Messaging host context lifetime', function() {
  let session;

  afterEach(function() {
    session?.destroy();
  });

  specify('disables an open composer immediately on consent notification and ignores unrelated patients', function() {
    let release;
    const value = fixtureContext();
    const read = cy.stub().resolves(value);
    session = new ContextSession({ patientId: 'patient', read });
    cy.then(() => session.refresh()).then(() => {
      expect(session.state.get('enabled')).to.equal(true);
      read.callsFake(() => new Promise(resolve => {
        release = resolve;
      }));
      const channel = Radio.channel('ws');
      channel.trigger('message', { category: 'FieldUpdated', resource: { type: 'patients', id: 'other' } });
      expect(read).to.have.been.calledOnce;
      channel.trigger('message', { category: 'FieldUpdated', resource: { type: 'patients', id: 'patient' } });
      expect(session.state.get('enabled')).to.equal(false);
      const refreshed = new Promise(resolve => session.once('context:updated', resolve));
      release(fixtureContext(false));
      return refreshed;
    });
    cy.then(() => {
      expect(session.state.get('loading')).to.equal(false);
      expect(session.state.get('enabled')).to.equal(false);
      expect(session.state.get('disabledReason')).to.equal('no_eligible_mobile');
    });
  });

  specify('rejects stale reads, preserves host draft fields and aborts after teardown', function() {
    const pending = [];
    const signals = [];
    const state = new Backbone.Model({ draft: 'Keep this draft' });
    session = new ContextSession({ patientId: 'patient', state, read: (query, { signal }) => {
      signals.push(signal);
      return new Promise(resolve => pending.push(resolve));
    } });
    cy.then(async() => {
      const old = session.refresh();
      const current = session.refresh();
      pending[1](fixtureContext(false));
      await current;
      pending[0](fixtureContext());
      expect(await old).to.equal(false);
      expect(state.get('enabled')).to.equal(false);
      expect(state.get('draft')).to.equal('Keep this draft');
      const late = session.refresh();
      session.destroy();
      expect(signals[2].aborted).to.equal(true);
      pending[2](fixtureContext());
      expect(await late).to.equal(false);
      expect(state.get('enabled')).to.equal(false);
    });
  });

  specify('refreshes on same-client confirmation without another patient or websocket echo', function() {
    const read = cy.stub().resolves(fixtureContext());
    session = new ContextSession({ patientId: 'patient', read });
    cy.then(() => session.refresh()).then(() => {
      Radio.trigger('messaging-prototype', 'interaction:recorded', { patientId: 'other' });
      expect(read).to.have.been.calledOnce;
      Radio.trigger('messaging-prototype', 'interaction:recorded', { patientId: 'patient' });
      expect(read).to.have.been.calledTwice;
    });
  });

  specify('recognizes native field IDs without requiring a hydrated notification model', function() {
    const read = cy.stub().resolves(fixtureContext());
    session = new ContextSession({ patientId: 'patient', read });
    cy.then(async() => {
      await session.refresh();
      const notify = (patientId, name) => {
        const id = getPatientFieldId(patientId, name);
        Radio.trigger('ws', 'message', { category: 'FieldUpdated', resource: { type: 'patient-fields', id } }, new Backbone.Model({ id }));
      };
      notify('other', 'phones');
      notify('patient', 'unrelated');
      expect(read).to.have.been.calledOnce;
      for (const name of ['phones', 'prototype_messaging']) {
        const updated = new Promise(resolve => session.once('context:updated', resolve));
        notify('patient', name);
        expect(session.state.get('enabled'), 'the affected field invalidates eligibility immediately').to.equal(false);
        await updated;
        expect(session.state.get('enabled')).to.equal(true);
      }
      expect(read).to.have.been.calledThrice;
    });
  });
});
