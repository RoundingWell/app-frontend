import Radio from 'backbone.radio';

import { AuthProvider } from '@roundingwell/care-ops-auth/AuthProvider.js';

import { auth } from 'js/auth'; // registers the 'auth' channel replies
import { getDraft, setDraft, clearDrafts } from 'js/services/form-drafts';

context('auth', function() {
  context('getUserId', function() {
    afterEach(function() {
      Radio.stopReplying('auth', 'getUserId');
    });

    specify('exposes a synchronous getUserId reply that consumers can override', function() {
      Radio.reply('auth', 'getUserId', () => 'user_test');
      expect(Radio.request('auth', 'getUserId')).to.equal('user_test');
    });
  });

  context('draft cleanup', function() {
    beforeEach(function() {
      return clearDrafts();
    });

    afterEach(function() {
      window.history.pushState({}, '', '/');
      return clearDrafts();
    });

    specify('clears form drafts on explicit logout', function() {
      cy.stub(AuthProvider.prototype, 'auth').callsFake(success => success());
      cy.stub(AuthProvider.prototype, 'getUserId').resolves('user_A');

      return setDraft('form-subm-user_A-patient-form', { updated: 'a' })
        .then(() => {
          window.history.pushState({}, '', AuthProvider.PATH_LOGOUT);
          return auth();
        })
        .then(() => getDraft('form-subm-user_A-patient-form'))
        .then(draft => {
          expect(draft).to.be.null;
        });
    });

    specify('keeps current-user drafts and prunes other-user drafts on auth', function() {
      cy.stub(AuthProvider.prototype, 'auth').callsFake(success => success());
      cy.stub(AuthProvider.prototype, 'getUserId').resolves('user_A');

      return Promise.all([
        setDraft('form-subm-user_A-patient-form', { updated: 'a' }),
        setDraft('form-subm-user_B-patient-form', { updated: 'b' }),
      ])
        .then(() => auth())
        .then(() => Promise.all([
          getDraft('form-subm-user_A-patient-form'),
          getDraft('form-subm-user_B-patient-form'),
        ]))
        .then(([currentUserDraft, otherUserDraft]) => {
          expect(currentUserDraft).to.not.be.null;
          expect(otherUserDraft).to.be.null;
        });
    });
  });
});
