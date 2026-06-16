import idb from './idb';

// A stand-in for an IDBOpenDBRequest whose open never settles — what a blocked
// version upgrade (another tab holding an older version open) looks like to idb.
function neverSettlingRequest() {
  const request = {
    then() {
      return request;
    },
    catch() {
      return request;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return request;
}

// Like the above, but the open can be completed later via resolveWith(db).
// Backed by a real promise so every subscriber (idb internals, the orphan
// guard, Promise.race) resolves correctly regardless of when it subscribed.
function pendingRequest() {
  let resolveOpen;
  const opened = new Promise(resolve => {
    resolveOpen = resolve;
  });
  return {
    then(onFulfilled, onRejected) {
      return opened.then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return opened.catch(onRejected);
    },
    addEventListener() {},
    removeEventListener() {},
    resolveWith(db) {
      resolveOpen(db);
    },
  };
}

// A stand-in for the live IDBDatabase the idb library hands back after a
// successful open. It records the versionchange/close listeners idb wires up so
// a test can fire them and exercise the blocking()/terminated() handlers.
function openedDatabase() {
  const handlers = {};
  const close = cy.stub();
  const db = {
    close,
    get() {
      return Promise.resolve(undefined);
    },
    addEventListener(type, handler) {
      (handlers[type] || (handlers[type] = [])).push(handler);
    },
  };
  return {
    db,
    close,
    fire(type) {
      (handlers[type] || []).forEach(fn => fn({}));
    },
  };
}

context('cache/idb', function() {
  beforeEach(function() {
    idb.__reset();
    return idb.clear('entities');
  });

  afterEach(function() {
    idb.__reset();
  });

  specify('set then get round-trips a value', function() {
    return idb.put('entities', 'u|/api/roles', { a: 1 })
      .then(() => idb.get('entities', 'u|/api/roles'))
      .then(value => {
        expect(value).to.deep.equal({ a: 1 });
      });
  });

  specify('get returns undefined for a missing key', function() {
    return idb.get('entities', 'nope').then(value => {
      expect(value).to.be.undefined;
    });
  });

  specify('delete removes a key', function() {
    return idb.put('entities', 'u|/api/teams', { x: 1 })
      .then(() => idb.delete('entities', 'u|/api/teams'))
      .then(() => idb.get('entities', 'u|/api/teams'))
      .then(value => {
        expect(value).to.be.undefined;
      });
  });

  specify('clear empties the store', function() {
    return Promise.all([
      idb.put('entities', 'a', { n: 1 }),
      idb.put('entities', 'b', { n: 2 }),
    ])
      .then(() => idb.clear('entities'))
      .then(() => Promise.all([idb.get('entities', 'a'), idb.get('entities', 'b')]))
      .then(([a, b]) => {
        expect(a).to.be.undefined;
        expect(b).to.be.undefined;
      });
  });

  specify('operations fail soft when IndexedDB is unavailable', function() {
    idb.__reset();
    const open = cy.stub(window.indexedDB, 'open').throws(new DOMException('blocked', 'SecurityError'));

    return idb.put('entities', 'k', { a: 1 })
      .then(() => idb.get('entities', 'k'))
      .then(value => {
        expect(value).to.be.undefined;
        // The failed open is memoized as unavailable — later ops don't retry it.
        expect(open).to.be.calledOnce;
      });
  });

  specify('operations fail soft when the open is blocked and never settles', function() {
    idb.__reset();
    cy.stub(window.indexedDB, 'open').returns(neverSettlingRequest());

    cy.clock();
    const result = {};
    cy.then(() => {
      result.op = idb.get('entities', 'k');
    });
    cy.tick(5000);
    cy.then(() => result.op).then(value => {
      expect(value).to.be.undefined;
    });
  });

  specify('stays unavailable after a blocked open times out, without re-waiting', function() {
    idb.__reset();
    cy.stub(window.indexedDB, 'open').returns(neverSettlingRequest());

    cy.clock();
    const result = {};
    cy.then(() => {
      result.first = idb.get('entities', 'k');
    });
    cy.tick(5000);
    cy.then(() => result.first).then(value => {
      expect(value).to.be.undefined;
      // A second read must resolve WITHOUT advancing the clock again — the
      // timed-out open is memoized as unavailable, so callers fail fast rather
      // than each paying another timeout.
      result.second = idb.get('entities', 'k');
    });
    cy.then(() => result.second).then(value => {
      expect(value).to.be.undefined;
    });
  });

  specify('closes a connection that finishes opening after the timeout', function() {
    idb.__reset();
    const request = pendingRequest();
    const lateClose = cy.stub();
    cy.stub(window.indexedDB, 'open').returns(request);

    cy.clock();
    const result = {};
    cy.then(() => {
      result.op = idb.get('entities', 'k');
    });
    cy.tick(5000);
    cy.then(() => result.op).then(value => {
      expect(value).to.be.undefined;
    });
    cy.then(() => {
      // The open completes only after we gave up: the orphaned connection must
      // be closed so it cannot linger or block a later upgrade.
      request.resolveWith({ close: lateClose, addEventListener() {} });
      // Let the open's late resolution (and the orphan-close handler) settle.
      return request.then(() => null).then(() => null);
    });
    cy.then(() => {
      expect(lateClose).to.be.calledOnce;
    });
  });

  specify('blocking() closes the connection and reopens on the next read', function() {
    idb.__reset();
    const request = pendingRequest();
    const open = cy.stub(window.indexedDB, 'open').returns(request);

    cy.clock();
    const ctx = {};
    cy.then(() => {
      ctx.conn = openedDatabase();
      ctx.first = idb.get('entities', 'k');
    });
    // Resolve after a command boundary so the open's race adoption is wired up.
    cy.then(() => {
      request.resolveWith(ctx.conn.db);
    });
    cy.then(() => ctx.first).then(() => {
      expect(open).to.be.calledOnce;
      // Another tab starts a newer-version upgrade: versionchange fires
      // blocking(), which must close our connection so the upgrade proceeds...
      ctx.conn.fire('versionchange');
      expect(ctx.conn.close).to.be.calledOnce;
      // ...and drop the memo so the next read reopens instead of reusing it.
      ctx.second = idb.get('entities', 'k');
      expect(open).to.be.calledTwice;
    });
  });

  specify('terminated() drops the memo so the next read reopens', function() {
    idb.__reset();
    const request = pendingRequest();
    const open = cy.stub(window.indexedDB, 'open').returns(request);

    cy.clock();
    const ctx = {};
    cy.then(() => {
      ctx.conn = openedDatabase();
      ctx.first = idb.get('entities', 'k');
    });
    // Resolve after a command boundary so the open's race adoption is wired up.
    cy.then(() => {
      request.resolveWith(ctx.conn.db);
    });
    cy.then(() => ctx.first).then(() => {
      expect(open).to.be.calledOnce;
      // The connection closes underneath us: terminated() drops the memo so a
      // later read reopens rather than handing back a dead connection.
      ctx.conn.fire('close');
      ctx.second = idb.get('entities', 'k');
      expect(open).to.be.calledTwice;
    });
  });
});
