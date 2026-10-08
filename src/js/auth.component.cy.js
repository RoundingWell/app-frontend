import { Radio } from 'marionette';

import { AuthProvider } from '@roundingwell/care-ops-auth/AuthProvider.js';
import { fetchConfig } from '@roundingwell/care-ops-config';

import { auth } from 'js/auth'; // registers the 'auth' channel replies
import { getDraft, setDraft, clearDrafts } from 'js/services/form-drafts';

context('auth', function() {
  beforeEach(function() {
    cy.intercept('GET', '/appconfig.json', { body: { auth: {} } });
    cy.then(() => fetchConfig());
  });

  context('getUserId', function() {
    specify('exposes the authenticated user synchronously and updates it on reauthentication', function() {
      cy.stub(AuthProvider.prototype, 'auth').callsFake(success => success());
      const getUserId = cy.stub(AuthProvider.prototype, 'getUserId');
      getUserId.onFirstCall().resolves('user_A');
      getUserId.onSecondCall().resolves('user_B');

      cy
        .then(() => auth())
        .then(() => {
          expect(Radio.request('auth', 'getUserId'), 'production synchronous identity').to.equal('user_A');
        });

      cy
        .then(() => auth())
        .then(() => {
          expect(Radio.request('auth', 'getUserId'), 'updated synchronous identity').to.equal('user_B');
        });
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
