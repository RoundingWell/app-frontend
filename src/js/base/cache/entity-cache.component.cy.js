import dayjs from 'dayjs';

import idb from './idb';
import {
  ENTRY_VERSION,
  getResponse,
  setResponse,
  clearCache,
  pruneOtherPartitions,
} from './entity-cache';

const SAMPLE = {
  data: [{ id: 'r1', type: 'roles', attributes: { name: 'admin' } }],
  included: [],
  meta: { total: 1 },
};

context('cache/entity-cache — getResponse / setResponse', function() {
  beforeEach(function() {
    idb.__reset();
    return clearCache();
  });

  afterEach(function() {
    idb.__reset();
  });

  specify('round-trips a response by key', function() {
    return setResponse('u|/api/roles', SAMPLE)
      .then(() => getResponse('u|/api/roles'))
      .then(resp => {
        expect(resp).to.deep.equal(SAMPLE);
      });
  });

  specify('returns null for a missing key', function() {
    return getResponse('u|/api/missing').then(resp => {
      expect(resp).to.be.null;
    });
  });

  specify('returns null when entryVersion does not match', function() {
    return idb.put('entities', 'u|/api/roles', {
      entryVersion: 9999,
      ts: dayjs.utc().format(),
      response: SAMPLE,
    })
      .then(() => getResponse('u|/api/roles'))
      .then(resp => {
        expect(resp).to.be.null;
      });
  });

  specify('returns null for an entry older than the TTL (1 week)', function() {
    return idb.put('entities', 'u|/api/roles', {
      entryVersion: ENTRY_VERSION,
      ts: dayjs.utc().subtract(8, 'day').format(),
      response: SAMPLE,
    })
      .then(() => getResponse('u|/api/roles'))
      .then(resp => {
        expect(resp).to.be.null;
      });
  });

  specify('setResponse snapshots input — subsequent mutations do not leak into the cache', function() {
    const mutable = JSON.parse(JSON.stringify(SAMPLE));
    return setResponse('u|/api/roles', mutable).then(() => {
      mutable.data[0].attributes.name = 'POISONED';
      return getResponse('u|/api/roles');
    }).then(resp => {
      expect(resp.data[0].attributes.name).to.equal('admin');
    });
  });
});

/* eslint-disable-next-line */
context('cache/entity-cache — invalidation', function() {
  beforeEach(function() {
    idb.__reset();
    return clearCache();
  });

  afterEach(function() {
    idb.__reset();
  });

  specify('clearCache empties all cached responses', function() {
    return Promise.all([
      setResponse('u1|/api/roles', SAMPLE),
      setResponse('u2|/api/teams', SAMPLE),
    ])
      .then(() => clearCache())
      .then(() => Promise.all([getResponse('u1|/api/roles'), getResponse('u2|/api/teams')]))
      .then(([a, b]) => {
        expect(a).to.be.null;
        expect(b).to.be.null;
      });
  });

  specify('pruneOtherPartitions deletes entries not prefixed with the current user', function() {
    return Promise.all([
      setResponse('user_A|/api/roles', SAMPLE),
      setResponse('user_A|/api/teams', SAMPLE),
      setResponse('user_B|/api/roles', SAMPLE),
    ])
      .then(() => pruneOtherPartitions('user_A'))
      .then(() => Promise.all([
        getResponse('user_A|/api/roles'),
        getResponse('user_A|/api/teams'),
        getResponse('user_B|/api/roles'),
      ]))
      .then(([a1, a2, b]) => {
        expect(a1).to.not.be.null;
        expect(a2).to.not.be.null;
        expect(b).to.be.null;
      });
  });

  specify('pruneOtherPartitions is a no-op when no currentUserId is provided', function() {
    return setResponse('user_A|/api/roles', SAMPLE)
      .then(() => pruneOtherPartitions(undefined))
      .then(() => getResponse('user_A|/api/roles'))
      .then(resp => {
        expect(resp).to.not.be.null;
      });
  });
});
