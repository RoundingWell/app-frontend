import idb from 'js/base/cache/idb';
import {
  draftKeyPrefix,
  getDraft,
  setDraft,
  removeDraft,
  clearDrafts,
  pruneOtherDrafts,
} from './form-drafts';

context('cache/form-drafts', function() {
  beforeEach(function() {
    idb.__reset();
    return clearDrafts();
  });

  afterEach(function() {
    idb.__reset();
  });

  specify('round-trips a draft by key', function() {
    const draft = { updated: '2026-06-05T00:00:00Z', submission: { fields: { foo: 'bar' } } };

    return setDraft('form-subm-user_A-patient-form', draft)
      .then(() => getDraft('form-subm-user_A-patient-form'))
      .then(value => {
        expect(value).to.deep.equal(draft);
      });
  });

  specify('returns null for a missing key', function() {
    return getDraft('form-subm-user_A-missing').then(value => {
      expect(value).to.be.null;
    });
  });

  specify('ignores empty inputs', function() {
    expect(draftKeyPrefix()).to.be.undefined;

    return Promise.all([
      getDraft(),
      setDraft(),
      setDraft('form-subm-user_A-patient-form'),
      removeDraft(),
    ]).then(([draft]) => {
      expect(draft).to.be.null;
    });
  });

  specify('removeDraft deletes a draft', function() {
    return setDraft('form-subm-user_A-patient-form', { updated: 'now' })
      .then(() => removeDraft('form-subm-user_A-patient-form'))
      .then(() => getDraft('form-subm-user_A-patient-form'))
      .then(value => {
        expect(value).to.be.null;
      });
  });

  specify('clearDrafts empties all drafts', function() {
    return Promise.all([
      setDraft('form-subm-user_A-patient-form', { updated: 'a' }),
      setDraft('form-subm-user_B-patient-form', { updated: 'b' }),
    ])
      .then(() => clearDrafts())
      .then(() => Promise.all([
        getDraft('form-subm-user_A-patient-form'),
        getDraft('form-subm-user_B-patient-form'),
      ]))
      .then(([a, b]) => {
        expect(a).to.be.null;
        expect(b).to.be.null;
      });
  });

  specify('pruneOtherDrafts keeps only drafts prefixed for the current user', function() {
    return Promise.all([
      setDraft('form-subm-1-patient-form', { updated: 'current' }),
      setDraft('form-subm-12-patient-form', { updated: 'collision' }),
      setDraft('form-subm-user_B-patient-form', { updated: 'other' }),
    ])
      .then(() => pruneOtherDrafts('1'))
      .then(() => Promise.all([
        getDraft('form-subm-1-patient-form'),
        getDraft('form-subm-12-patient-form'),
        getDraft('form-subm-user_B-patient-form'),
      ]))
      .then(([current, collision, other]) => {
        expect(current).to.not.be.null;
        expect(collision).to.be.null;
        expect(other).to.be.null;
      });
  });

  specify('pruneOtherDrafts is a no-op when no currentUserId is provided', function() {
    return setDraft('form-subm-user_A-patient-form', { updated: 'a' })
      .then(() => pruneOtherDrafts(undefined))
      .then(() => getDraft('form-subm-user_A-patient-form'))
      .then(value => {
        expect(value).to.not.be.null;
      });
  });

  specify('operations fail soft when IndexedDB is unavailable', function() {
    idb.__reset();
    cy.stub(window.indexedDB, 'open').throws(new DOMException('blocked', 'SecurityError'));

    return setDraft('form-subm-user_A-patient-form', { updated: 'a' })
      .then(() => getDraft('form-subm-user_A-patient-form'))
      .then(value => {
        expect(value).to.be.null;
      });
  });
});
