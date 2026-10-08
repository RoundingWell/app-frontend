import { isEqual } from 'underscore';
import { Radio } from 'marionette';
import Store from 'backbone.store';

import 'js/base/setup'; // wires Backbone.ajax -> js/base/fetch
import 'js/entities-service'; // registers store models + entities channel replies

import Collection from 'js/base/collection';

import idb from './idb';
import { getResponse, clearCache } from './entity-cache';

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
function waitForCache(key, attempts = 20, expectedResponse) {
  return getResponse(key).then(resp => {
    if (resp && (!expectedResponse || isEqual(stripStampsFromResponse(resp), expectedResponse))) return resp;
    if (attempts <= 0) throw new Error(`cache write for ${ key } never landed`);
    return new Promise(r => setTimeout(r, 25))
      .then(() => waitForCache(key, attempts - 1, expectedResponse));
  });
}

context('cache/response-cache — replay equivalence', function() {
  let releaseRefresh;
  let fetches;
  let cacheWrites;

  beforeEach(function() {
    releaseRefresh = null;
    fetches = cy.spy(Collection.prototype, 'fetch');
    cacheWrites = cy.spy(idb, 'put');
    idb.__reset();
    Radio.reply('auth', 'getToken', () => Promise.resolve(null));
    return clearCache();
  });

  afterEach(async function() {
    if (releaseRefresh) releaseRefresh();
    try {
      // The replay promise resolves before its background fetch and cache write.
      await Promise.allSettled(fetches.returnValues);
      await Promise.allSettled(cacheWrites.returnValues);
    } finally {
      Store.resetAll();
      idb.__reset();
      Radio.stopReplying('auth', 'getUserId');
      Radio.stopReplying('auth', 'getToken');
    }
  });

  specify('replays cached state before a distinct live refresh completes', function() {
    const dbKey = 'user_test||/api/roles';
    const liveResponse = JSON.parse(JSON.stringify(ROLES_RESPONSE));
    liveResponse.data[0].attributes.name = 'live-admin';
    liveResponse.included[0].attributes.name = 'Live clinician';
    liveResponse.meta.total = 99;

    let liveModelAttrs;
    let liveMeta;
    let liveClinicianAttrs;
    let replayCollection;

    Radio.reply('auth', 'getUserId', () => 'user_test');

    cy
      .intercept('GET', '/api/roles*', { body: ROLES_RESPONSE })
      .as('rolesFetch');

    cy
      .then(() => Radio.request('entities', 'fetch:roles:collection'))
      .then(collection => {
        liveModelAttrs = collection.map(model => stripVolatile(model.attributes));
        liveMeta = collection.meta;
        liveClinicianAttrs = stripVolatile(Radio.request('entities', 'clinicians:model', 'c1').attributes);
      });

    cy.wait('@rolesFetch');

    cy
      .then(() => waitForCache(dbKey))
      .then(cachedResponse => {
        expect(stripStampsFromResponse(cachedResponse)).to.deep.equal(ROLES_RESPONSE);
        Store.resetAll();
      });

    const refreshGate = new Cypress.Promise(resolve => {
      releaseRefresh = resolve;
    });
    let markRefreshStarted;
    const refreshStarted = new Cypress.Promise(resolve => {
      markRefreshStarted = resolve;
    });

    cy
      .intercept('GET', '/api/roles*', req => {
        markRefreshStarted();
        return refreshGate.then(() => req.reply({ body: liveResponse }));
      })
      .as('rolesRefresh');

    cy.then(() => {
      Radio.request('entities', 'fetch:roles:collection').then(collection => {
        replayCollection = collection;
      });
    });

    cy.then(async() => {
      await refreshStarted;

      try {
        expect(replayCollection, 'cached replay completes while the live response is held').to.exist;
        expect(replayCollection.map(model => stripVolatile(model.attributes))).to.deep.equal(liveModelAttrs);
        expect(replayCollection.meta).to.deep.equal(liveMeta);
        expect(stripVolatile(Radio.request('entities', 'clinicians:model', 'c1').attributes)).to.deep.equal(liveClinicianAttrs);
      } finally {
        releaseRefresh();
      }
    });

    cy.wait('@rolesRefresh');

    cy
      .wrap(null)
      .should(() => {
        expect(replayCollection.get('r1').get('name'), 'completed live refresh').to.equal('live-admin');
        expect(replayCollection.meta.total).to.equal(99);
        expect(Radio.request('entities', 'clinicians:model', 'c1').get('name')).to.equal('Live clinician');
      });

    cy
      .then(() => waitForCache(dbKey, 20, liveResponse))
      .then(cachedResponse => {
        expect(stripStampsFromResponse(cachedResponse)).to.deep.equal(liveResponse);
      });
  });

  specify('cache miss falls through to live fetch', function() {
    Radio.reply('auth', 'getUserId', () => 'user_test'); // sync

    cy
      .intercept('GET', '/api/roles*', { body: ROLES_RESPONSE })
      .as('rolesFetch');

    cy
      .then(() => Radio.request('entities', 'fetch:roles:collection'))
      .then(collection => {
        expect(collection.length).to.equal(2);
      });

    cy.wait('@rolesFetch');
  });

  specify('no userId — falls through to live fetch, no cache read', function() {
    // Sync undefined: the cache branch checks userId synchronously.
    Radio.reply('auth', 'getUserId', () => undefined);

    cy
      .intercept('GET', '/api/roles*', { body: ROLES_RESPONSE })
      .as('rolesFetch');

    cy
      .then(() => Radio.request('entities', 'fetch:roles:collection'))
      .then(collection => {
        expect(collection.length).to.equal(2);
      });

    cy.wait('@rolesFetch');
  });
});
