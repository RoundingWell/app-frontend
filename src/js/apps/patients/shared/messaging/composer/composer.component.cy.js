import Backbone from 'backbone';
import { uniqueId } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';
import { testScope } from '@mnjs/test/cypress';

import sessionStore from 'js/utils/session-store';

import ComposerView from './composer_view';
import { getComposerSession, updateDraft } from './session';

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
    this.showChildView('composer', new ComposerView(this.getOption('composerOptions')));
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
    options = { adapter, patientId: 'synthetic-patient', actionId: null, sessionScope: adapter.sessionScope };
    session = getComposerSession({ ...options, initialNumberId: adapter.initialNumberId });
  });

  specify('grows, selects recipients with reasons, and confirms an actionless text', function() {
    options.focus = true;
    cy
      .mount(() => new ComposerView(options));

    cy
      .focused()
      .should('have.class', 'message-composer__input');

    cy
      .get('.message-composer__send')
      .should('be.disabled');

    cy
      .get('.message-composer__input')
      .type('   ');

    cy
      .get('.message-composer__send')
      .should('be.disabled');

    cy
      .get('.message-composer__numbers')
      .focus()
      .type('{downarrow}');

    cy
      .get('.picklist [data-choice-id="stopped"]')
      .should('have.attr', 'aria-disabled', 'true')
      .and('contain', 'Demo opted out of texts')
      .click();

    cy
      .get('.message-composer__numbers')
      .should('have.value', 'mobile-one');

    cy
      .get('.picklist [data-choice-id="mobile-two"]')
      .click();

    cy
      .get('.message-composer__numbers')
      .should('have.value', 'mobile-two')
      .and('be.focused')
      .click();

    cy
      .get('body')
      .type('{esc}');

    cy
      .get('.message-composer__numbers')
      .should('be.focused')
      .and('have.attr', 'aria-expanded', 'false');

    let initialHeight;
    cy
      .get('.message-composer__input')
      .then($input => {
        initialHeight = $input[0].getBoundingClientRect().height;
      });

    cy
      .get('.message-composer__input')
      .clear()
      .type('Hello Demo{enter}Line two{enter}Line three{enter}Line four{enter}Line five{enter}Line six')
      .should($input => {
        expect($input[0].getBoundingClientRect().height, 'text box grows for entered lines').to.be.greaterThan(initialHeight);
      });

    cy
      .get('.message-composer')
      .screenshot('composer-growing-draft');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('have.text', 'Text sent.');

    cy
      .get('.message-composer__input')
      .should('have.value', '')
      .then(() => {
        const submission = adapter.submit.firstCall.args[0];
        expect(submission).to.deep.equal({ patientId: 'synthetic-patient', actionId: null, numberId: 'mobile-two', body: 'Hello Demo\nLine two\nLine three\nLine four\nLine five\nLine six' });
        expect(adapter.reconcile).to.have.been.calledOnceWithExactly({ id: 'confirmed-interaction' }, submission);
      });
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
      .mount(() => new ComposerView(options));

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
      .should('be.empty');

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
      .mount(() => new ComposerView(options));

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
      .mount(() => new ComposerView(options));

    cy
      .get('.message-composer__input')
      .type('Action draft');

    cy
      .mount(() => new ComposerView({ ...options, actionId: null }));

    cy
      .get('.message-composer__input')
      .should('have.value', '')
      .type('Interactions draft');

    cy
      .mount(() => new ComposerView({ ...options, patientId: 'another-synthetic-patient' }));

    cy
      .get('.message-composer__input')
      .should('have.value', '');

    cy
      .mount(() => new ComposerView(options));

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
    adapter.refreshEligibility.rejects(new Error('Synthetic eligibility refresh failure'));

    cy
      .mount(() => new ComposerView(options));

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
        expect(adapter.submit).to.have.been.calledOnce;
        expect(adapter.reconcile).not.to.have.been.called;
        adapter.submit.resolves({ id: 'confirmed-on-retry' });
      });

    cy
      .get('.message-composer__input')
      .should('have.value', 'Require a confirmed send');

    cy
      .get('.message-composer__send')
      .click();

    cy
      .get('.message-composer__status')
      .should('have.text', 'Text sent.');

    cy
      .get('.message-composer__input')
      .should('have.value', '')
      .then(() => {
        expect(adapter.submit).to.have.been.calledTwice;
        expect(adapter.reconcile).to.have.been.calledOnceWithExactly({ id: 'confirmed-on-retry' }, {
          patientId: 'synthetic-patient', actionId: null, numberId: 'mobile-one', body: 'Require a confirmed send',
        });
      });
  });

  specify('preserves a draft when only its recipient changes during a pending send', function() {
    const held = holdResponse(scope, session);
    adapter.submit.returns(held.response);

    cy
      .mount(() => new ComposerView(options));

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
      .mount(() => new ComposerView(options));

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

  specify('validates scope isolation and retains its in-memory draft when session storage is full', function() {
    expect(() => getComposerSession({ ...options, actionId: undefined })).to.throw('an explicit actionId');
    expect(() => getComposerSession({ ...options, sessionScope: '' })).to.throw('requires sessionScope');
    expect(() => getComposerSession({ ...options, patientId: '' })).to.throw('patientId');
    cy.stub(sessionStore, 'set').throws(new DOMException('Synthetic full session storage', 'QuotaExceededError'));

    // Storage failure is a reusable session contract, independent of a mounted UI.
    expect(() => updateDraft(session, { body: 'Retain this in memory' })).not.to.throw();
    expect(session.get('body')).to.equal('Retain this in memory');
    expect(getComposerSession(options)).to.equal(session);

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
