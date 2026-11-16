import Backbone from 'backbone';
import { find, uniqueId } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import sessionStore from 'js/utils/session-store';

import ComposerView from './composer_view';
import { createComposerDraft, updateDraft } from './session';
import { submitDraft } from './submission';

const HostView = View.extend({
  template: hbs`
    <button class="js-leave" type="button">Leave</button>
    <button class="js-return" type="button">Return</button>
    <div data-composer-region></div>
  `,
  regions: { composer: '[data-composer-region]' },
  ui: { leave: '.js-leave', return: '.js-return' },
  triggers: { 'click @ui.leave': 'leave', 'click @ui.return': 'return' },
  onRender() {
    this.onReturn();
  },
  onLeave() {
    this.getRegion('composer').empty();
  },
  onReturn() {
    this.showChildView('composer', createComposer(this.getOption('composerOptions')));
  },
});

function createAdapter() {
  return {
    sessionScope: uniqueId('composer-test-'),
    initialNumberId: 'mobile-one',
    state: new Backbone.Model({
      enabled: true,
      canCompose: true,
      recipientName: 'Demo Patient',
      numbers: [
        { id: 'mobile-one', label: '(202) 555-0101', available: true },
        { id: 'mobile-two', label: '(202) 555-0102', available: true },
        { id: 'stopped', label: '(202) 555-0103', available: false, reason: 'Demo opted out of texts. Only Demo can undo this by texting START.' },
      ],
    }),
    refreshEligibility: cy.stub().resolves(),
    submit: cy.stub().resolves({ id: 'confirmed-interaction' }),
    reconcile: cy.stub().resolves(),
  };
}

// The host owns its drafts and requests; the form only edits and emits submit.
function getHostDraft(options) {
  const key = JSON.stringify([options.sessionScope, options.patientId, options.actionId]);
  const initial = find(options.adapter.state.get('numbers'), { id: options.adapter.initialNumberId });
  if (!options.drafts.has(key)) options.drafts.set(key, createComposerDraft({ ...options, initialNumberId: options.adapter.initialNumberId, initialNumberLabel: initial?.label }));
  return options.drafts.get(key);
}

function createComposer(options) {
  const { adapter, patientId, actionId } = options;
  const model = getHostDraft(options);
  const view = new ComposerView({ model, state: adapter.state });
  view.on('submit:message', () => submitDraft(model, {
    state: adapter.state, context: { patientId, actionId },
    refreshEligibility: adapter.refreshEligibility, submit: adapter.submit, reconcile: adapter.reconcile,
  }));
  return view;
}

// Release and drain an actual submission even when a UI assertion fails.
function holdResponse(scope, session) {
  let release;
  let finish;
  let started = false;
  const response = new Promise(resolve => {
    release = resolve;
  });
  const finished = new Promise(resolve => {
    finish = resolve;
  });
  const onPending = () => {
    if (session.get('pending')) started = true;
    else if (session.get('error')) finish();
  };
  session.on('change:pending', onPending);
  session.on('confirmed', finish);
  scope.defer(async() => {
    release({ id: 'cleanup-confirmation' });
    if (started) await finished;
    session.off('change:pending', onPending);
    session.off('confirmed', finish);
  });
  return { response, release };
}

context('reusable messaging composer host contract', function() {
  let scope;
  let adapter;
  let options;
  let session;

  beforeEach(function() {
    scope = testScope();
    adapter = createAdapter();
    options = { drafts: new Map(), adapter, patientId: 'synthetic-patient', actionId: null, sessionScope: adapter.sessionScope };
    session = getHostDraft(options);
  });

  specify('retains a pending guard across navigation and preserves newer edits on confirmation', function() {
    const held = holdResponse(scope, session);
    adapter.submit.returns(held.response);

    cy
      .mount(() => new HostView({ composerOptions: options }));

    cy
      .get('.message-composer__input')
      .type('Submitted draft');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.js-leave')
      .click();

    cy
      .get('.js-return')
      .click();

    cy
      .get('.message-composer__send')
      .should('be.disabled')
      .and('contain.text', 'Sending…');

    cy
      .get('.message-composer')
      .submit();

    cy
      .get('.message-composer__input')
      .should('have.value', 'Submitted draft')
      .clear()
      .type('A newer draft')
      .then(() => held.release({ id: 'confirmed-after-navigation' }));

    cy
      .get('.message-composer__status')
      .should('have.text', 'Text sent.');

    cy
      .get('.message-composer__input')
      .should('have.value', 'A newer draft')
      .then(() => {
        expect(adapter.submit).to.have.been.calledOnce;
        expect(adapter.reconcile).to.have.been.calledOnce;
      });
  });

  specify('keeps the draft on failure and reconciles after leaving the host', function() {
    adapter.submit.rejects(new Error('Synthetic submission failure'));
    cy
      .mount(() => new HostView({ composerOptions: options }));

    cy
      .get('.message-composer__input')
      .type('Keep my draft');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('contain', 'Your draft is saved');

    cy
      .get('.js-leave')
      .click();

    cy
      .get('.js-return')
      .click();

    cy
      .get('.message-composer__input')
      .should('have.value', 'Keep my draft');

    const held = holdResponse(scope, session);
    adapter.submit.onSecondCall().returns(held.response);

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.js-leave')
      .click()
      .then(() => held.release({ id: 'confirmed-without-host' }));

    cy
      .wrap(adapter.reconcile)
      .should('have.been.calledOnce');

    cy
      .get('.js-return')
      .click();

    cy
      .get('.message-composer__input')
      .should('have.value', '');
  });

  specify('retains unavailable and removed recipients and follows live host policy', function() {
    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .type('Draft survives eligibility changes')
      .then(() => adapter.state.set('numbers', [
        { id: 'mobile-one', label: '(202) 555-0101', available: false, reason: 'Demo opted out of texts' },
        { id: 'mobile-two', label: '(202) 555-0102', available: true },
      ]));

    cy
      .get('.message-composer__numbers')
      .should($select => {
        expect($select[0].value, 'disabled selection remains the recipient').to.equal('mobile-one');
      });

    cy
      .get('.message-composer__input')
      .should('be.disabled')
      .and('have.attr', 'placeholder', 'Demo opted out of texts')
      .then(() => adapter.state.set('numbers', [{ id: 'mobile-two', label: '(202) 555-0102', available: true }]));

    cy
      .get('.message-composer__numbers')
      .should($select => {
        expect($select[0].value, 'removed selection remains the recipient').to.equal('mobile-one');
      });

    cy
      .get('.message-composer__reason')
      .should('have.text', 'This number is no longer available.');

    cy
      .get('.message-composer__numbers')
      .click()
      .get('.picklist [data-choice-id="mobile-two"]')
      .click()
      .then(() => adapter.state.set({ canCompose: false, disabledReason: 'Do Not Contact' }));

    cy
      .get('.message-composer__input')
      .should('be.disabled')
      .and('have.value', 'Draft survives eligibility changes')
      .and('have.attr', 'placeholder', 'Do Not Contact')
      .then(() => adapter.state.set({ scheduled: true, disabledReason: 'This message is scheduled for Nov 13 at 8:00 AM.' }));

    cy
      .get('.message-composer__send')
      .should('not.be.visible');

    cy
      .get('.message-composer__reason')
      .should('contain', 'This message is scheduled for Nov 13 at 8:00 AM.');

    cy
      .get('.message-composer__input')
      .should('have.attr', 'placeholder', 'This message is scheduled for Nov 13 at 8:00 AM.')
      .then(() => adapter.state.set({ scheduled: false, disabledReason: 'This action is done.' }));

    cy
      .get('.message-composer__input')
      .should('have.attr', 'placeholder', 'This action is done.')
      .then(() => adapter.state.set('enabled', false));

    cy
      .get('.message-composer')
      .should('not.be.visible');
  });

  specify('rechecks eligibility before submission and never substitutes another recipient', function() {
    const held = holdResponse(scope, session);
    adapter.refreshEligibility.returns(held.response.then(() => {
      adapter.state.set({ canCompose: false, disabledReason: 'Do Not Contact' });
    }));

    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .type('Check before submitting');

    cy
      .get('.message-composer__send')
      .click()
      .then(() => held.release());

    cy
      .get('.message-composer')
      .should('have.attr', 'aria-busy', 'false')
      .then(() => {
        expect(adapter.submit).not.to.have.been.called;
        expect(adapter.reconcile).not.to.have.been.called;
      });

    cy
      .get('.message-composer__input')
      .should('have.value', 'Check before submitting')
      .and('be.disabled');
  });

  specify('isolates patient/action drafts and reports reconciliation failure without resending', function() {
    options.actionId = 'explicit-host-action';
    adapter.reconcile.rejects(new Error('Synthetic history refresh failure'));

    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .type('Action draft');

    cy
      .mount(() => createComposer({ ...options, actionId: null }));

    cy
      .get('.message-composer__input')
      .should('have.value', '')
      .type('Interactions draft');

    cy
      .mount(() => createComposer({ ...options, patientId: 'another-synthetic-patient' }));

    cy
      .get('.message-composer__input')
      .should('have.value', '');

    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .should('have.value', 'Action draft');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('contain', 'Text sent. History could not refresh');

    cy
      .get('.message-composer__input')
      .should('have.value', '')
      .then(() => {
        expect(adapter.submit).to.have.been.calledOnce;
        expect(adapter.submit.firstCall.args[0].actionId).to.equal('explicit-host-action');
      });
  });

  specify('preserves its draft when eligibility refresh fails or transport does not confirm', function() {
    adapter.refreshEligibility.callsFake(() => Promise.reject(null));

    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .type('Require a confirmed send');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('contain', 'Your draft is saved')
      .then(() => {
        expect(adapter.submit).not.to.have.been.called;
        expect(adapter.reconcile).not.to.have.been.called;
        adapter.refreshEligibility.resolves();
        adapter.submit.callsFake(() => Promise.reject(undefined));
      });

    cy
      .get('.message-composer__input')
      .should('have.value', 'Require a confirmed send');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('contain', 'Your draft is saved')
      .then(() => {
        expect(adapter.submit).to.have.been.calledOnce;
        expect(adapter.reconcile).not.to.have.been.called;
        adapter.submit.resolves(null);
      });

    cy
      .get('.message-composer__input')
      .should('have.value', 'Require a confirmed send');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('contain', 'Your draft is saved')
      .then(() => {
        expect(adapter.submit).to.have.been.calledTwice;
        expect(adapter.reconcile).not.to.have.been.called;
        adapter.submit.resolves({ id: 'confirmed-on-retry' });
      });

    cy
      .get('.message-composer__input')
      .should('have.value', 'Require a confirmed send');

    cy
      .get('.message-composer__send')
      .should('be.enabled')
      .click();

    cy
      .get('.message-composer__status')
      .should('have.text', 'Text sent.');

    cy
      .get('.message-composer__input')
      .should('have.value', '')
      .then(() => {
        expect(adapter.submit).to.have.been.calledThrice;
        expect(adapter.reconcile).to.have.been.calledOnceWithExactly({ id: 'confirmed-on-retry' }, {
          patientId: 'synthetic-patient', actionId: null, numberId: 'mobile-one', body: 'Require a confirmed send',
        });
      });
  });

  specify('preserves a draft when only its recipient changes during a pending send', function() {
    const held = holdResponse(scope, session);
    adapter.submit.returns(held.response);

    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .type('Keep this for the newly selected number');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__numbers')
      .click()
      .get('.picklist [data-choice-id="mobile-two"]')
      .click()
      .then(() => held.release({ id: 'confirmed-original-recipient' }));

    cy
      .get('.message-composer__status')
      .should('have.text', 'Text sent.');

    cy
      .get('.message-composer__input')
      .should('have.value', 'Keep this for the newly selected number');

    cy
      .get('.message-composer__numbers')
      .should('have.value', 'mobile-two')
      .then(() => {
        expect(adapter.submit).to.have.been.calledOnceWithExactly({
          patientId: 'synthetic-patient', actionId: null, numberId: 'mobile-one', body: 'Keep this for the newly selected number',
        });
        expect(adapter.reconcile.firstCall.args[1].numberId).to.equal('mobile-one');
      });
  });

  specify('requires an explicit recipient and explicitly permitted eligibility', function() {
    options.sessionScope = uniqueId('unselected-recipient-');
    adapter.initialNumberId = '';

    cy
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .should('be.disabled')
      .and('have.attr', 'placeholder', 'Choose a mobile number');

    cy
      .get('.message-composer__numbers')
      .click()
      .get('.picklist [data-choice-id="mobile-one"]')
      .click();

    cy
      .get('.message-composer__input')
      .should('be.enabled')
      .type('Do not assume eligibility')
      .then(() => adapter.state.set('numbers', [{ id: 'mobile-one', label: '(202) 555-0101' }]));

    cy
      .get('.message-composer__input')
      .should('be.disabled')
      .and('have.value', 'Do not assume eligibility')
      .and('have.attr', 'placeholder', 'Texting is unavailable.');

    cy
      .get('.message-composer__send')
      .should('be.disabled')
      .then(() => adapter.state.set({ canCompose: false, disabledReason: 'No mobile number', numbers: [] }));

    cy
      .get('.message-composer__input')
      .should('have.attr', 'placeholder', 'No mobile number')
      .then(() => {
        expect(adapter.submit).not.to.have.been.called;
      });
  });

  specify('keeps an uncertain request blocked across form recreation until its host resolves it', function() {
    adapter.submit.callsFake(() => Promise.reject({ outcome: 'uncertain' }));

    cy
      .mount(() => new HostView({ composerOptions: options }));

    cy
      .get('.message-composer__input')
      .type('Keep this until the host checks the recorded interaction');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('contain', 'Recording is unconfirmed');

    cy
      .get('.js-leave')
      .click();

    cy
      .get('.js-return')
      .click();

    cy
      .get('.message-composer__input')
      .should('have.value', 'Keep this until the host checks the recorded interaction')
      .type(' with a later edit');

    cy
      .get('.message-composer__send')
      .should('be.disabled');

    cy
      .get('.message-composer')
      .submit();

    cy
      .get('.message-composer__status')
      .should('contain', 'Recording is unconfirmed')
      .then(() => {
        expect(adapter.submit).to.have.been.calledOnce;
        expect(adapter.reconcile).not.to.have.been.called;
        // Only the host's authoritative outcome check releases this guard.
        session.set('uncertain', false);
        adapter.submit.resolves({ id: 'confirmed-after-host-check' });
      });

    cy
      .get('.message-composer__send')
      .should('be.enabled')
      .click();

    cy
      .get('.message-composer__status')
      .should('have.text', 'Text sent.')
      .then(() => expect(adapter.submit).to.have.been.calledTwice);
  });

  specify('keeps editor selection and the open picker through host updates and accepts input without keyboard events', function() {
    let input;
    adapter.state.set('recipientName', 'Alexandria Example With A Long Family Name');
    cy
      .viewport(390, 844)
      .mount(() => createComposer(options));

    cy
      .get('.message-composer__input')
      .invoke('val', 'Pasted without a keyup')
      .trigger('input', { inputType: 'insertFromPaste' })
      .focus()
      .then($input => {
        input = $input[0];
        input.setSelectionRange(7, 14);
        adapter.state.set('senderName', 'Example Staff');
      });

    cy
      .focused()
      .should($input => {
        expect($input[0]).to.equal(input);
        expect(input.selectionStart).to.equal(7);
        expect(input.selectionEnd).to.equal(14);
      });

    cy
      .get('.message-composer__send')
      .should('be.enabled');

    cy
      .get('.message-composer__numbers')
      .click();

    cy
      .get('.picklist')
      .should('be.visible')
      .then(() => adapter.state.set('numbers', adapter.state.get('numbers').map(number => ({ ...number }))));

    cy
      .get('.picklist')
      .should('be.visible');

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.picklist')
      .should('not.exist');

    cy
      .get('.message-composer__input')
      .should($input => expect($input[0]).to.equal(input))
      .focus()
      .trigger('compositionstart')
      .invoke('val', 'Composed text')
      .trigger('input', { inputType: 'insertCompositionText', isComposing: true })
      .trigger('compositionend');

    cy
      .get('.message-composer__send')
      .should('be.enabled');

    cy
      .get('.message-composer__mirror')
      .should('have.text', 'Composed text');

    cy
      .document()
      .should(doc => expect(doc.documentElement.scrollWidth, 'mobile composer has no horizontal overflow').to.be.at.most(doc.documentElement.clientWidth));
  });

  specify('validates scope isolation and retains its in-memory draft when session storage is full', function() {
    expect(() => createComposerDraft({ ...options, actionId: undefined })).to.throw('an explicit actionId');
    expect(() => createComposerDraft({ ...options, sessionScope: '' })).to.throw('requires sessionScope');
    expect(() => createComposerDraft({ ...options, patientId: '' })).to.throw('patientId');
    cy.stub(sessionStore, 'set').throws(new DOMException('Synthetic full session storage', 'QuotaExceededError'));

    // Storage failure is a reusable session contract, independent of a mounted UI.
    expect(() => updateDraft(session, { body: 'Retain this in memory' })).not.to.throw();
    expect(session.get('body')).to.equal('Retain this in memory');

    cy
      .mount(() => new HostView({ composerOptions: options }));

    cy
      .get('.message-composer__input')
      .should('have.value', 'Retain this in memory');

    cy
      .get('.js-leave')
      .click();

    cy
      .get('.js-return')
      .click();

    cy
      .get('.message-composer__input')
      .should('have.value', 'Retain this in memory');
  });
});
