import Radio from 'backbone.radio';
import Store from 'backbone.store';

import 'js/base/setup'; // wires Backbone.ajax -> js/base/fetch
import 'js/entities-service'; // registers store models + entities channel replies

import idb from './idb';
import { setResponse, getResponse, clearCache } from './entity-cache';

const ROLES_RESPONSE = {
  data: [
    {
      id: 'r1',
      type: 'roles',
      attributes: { name: 'admin', permissions: ['clinicians:admin'] },
      relationships: {
        clinicians: { data: [{ id: 'c1', type: 'clinicians' }] },
      },
    },
    {
      id: 'r2',
      type: 'roles',
      attributes: { name: 'nurse', permissions: [] },
      relationships: {
        clinicians: { data: [] },
      },
    },
  ],
  included: [
    { id: 'c1', type: 'clinicians', attributes: { name: 'Dr A' } },
  ],
  meta: { total: 2 },
};

function stripVolatile(attrs) {
  // __cached_ts is stamped once per response by the fetch layer. Strip from
  // comparisons so structural equivalence isn't affected by the timestamp value.
  // eslint-disable-next-line no-unused-vars
  const { __cached_ts, ...rest } = attrs;
  return rest;
}

function stripStampsFromResponse(resp) {
  const clone = JSON.parse(JSON.stringify(resp));
  const stripFromResource = r => {
    if (r && r.attributes) delete r.attributes.__cached_ts;
  };
  if (Array.isArray(clone.data)) clone.data.forEach(stripFromResource);
  else if (clone.data) stripFromResource(clone.data);
  if (Array.isArray(clone.included)) clone.included.forEach(stripFromResource);
  return clone;
}

// Cache write is fire-and-forget from inside parse; poll for it to land.
function waitForCache(key, attempts = 20) {
  return getResponse(key).then(resp => {
    if (resp) return resp;
    if (attempts <= 0) throw new Error(`cache write for ${ key } never landed`);
    return new Promise(r => setTimeout(r, 25))
      .then(() => waitForCache(key, attempts - 1));
  });
}

context('cache/response-cache — replay equivalence', function() {
  beforeEach(function() {
    idb.__reset();
    Radio.reply('auth', 'getToken', () => Promise.resolve(null));
    return clearCache();
  });

  afterEach(function() {
    Store.resetAll();
    idb.__reset();
    Radio.stopReplying('auth', 'getUserId');
    Radio.stopReplying('auth', 'getToken');
  });

  specify('cache replay yields the same collection + store state as a live fetch', function() {
    Radio.reply('auth', 'getUserId', () => 'user_test'); // sync

    // --- Path A: live fetch via cy.intercept ---
    cy.intercept('GET', '/api/roles*', { body: ROLES_RESPONSE }).as('rolesFetch');

    return Radio.request('entities', 'fetch:roles:collection').then(liveCollection => {
      const liveModelAttrs = liveCollection.map(m => stripVolatile(m.attributes));
      const liveMeta = liveCollection.meta;
      const liveClinician = Radio.request('entities', 'clinicians:model', 'c1');
      const liveClinicianAttrs = stripVolatile(liveClinician.attributes);

      return waitForCache('user_test||/api/roles')
        .then(cachedResp => {
          // The cached response carries __cached_ts stamps applied at the fetch
          // layer; strip them for structural comparison with the input fixture.
          expect(stripStampsFromResponse(cachedResp)).to.deep.equal(ROLES_RESPONSE);

          // --- Reset and replay ---
          Store.resetAll();
          // Re-seed the cache so the replay path is exercised even after Store reset
          // (clearResponses + Store.resetAll do not touch IDB on the cache side).
          return setResponse('user_test||/api/roles', ROLES_RESPONSE);
        })
        .then(() => {
          return Radio.request('entities', 'fetch:roles:collection');
        })
        .then(replayCollection => {
          const replayModelAttrs = replayCollection.map(m => stripVolatile(m.attributes));
          const replayMeta = replayCollection.meta;
          const replayClinician = Radio.request('entities', 'clinicians:model', 'c1');
          const replayClinicianAttrs = stripVolatile(replayClinician.attributes);

          expect(replayModelAttrs).to.deep.equal(liveModelAttrs);
          expect(replayMeta).to.deep.equal(liveMeta);
          // included record matches across paths
          expect(replayClinicianAttrs).to.deep.equal(liveClinicianAttrs);
        });
    });
  });

  specify('cache miss falls through to live fetch', function() {
    Radio.reply('auth', 'getUserId', () => 'user_test'); // sync
    cy.intercept('GET', '/api/roles*', { body: ROLES_RESPONSE }).as('rolesFetch');

    // cy.wrap keeps cy.wait in the Cypress command queue, not a raw-Promise .then.
    cy.wrap(Radio.request('entities', 'fetch:roles:collection')).then(collection => {
      expect(collection.length).to.equal(2);
    });
    cy.wait('@rolesFetch');
  });

  specify('no userId — falls through to live fetch, no cache read', function() {
    // Sync undefined: the cache branch checks userId synchronously.
    Radio.reply('auth', 'getUserId', () => undefined);
    cy.intercept('GET', '/api/roles*', { body: ROLES_RESPONSE }).as('rolesFetch');

    cy.wrap(Radio.request('entities', 'fetch:roles:collection')).then(collection => {
      expect(collection.length).to.equal(2);
    });
    cy.wait('@rolesFetch');
  });
});
