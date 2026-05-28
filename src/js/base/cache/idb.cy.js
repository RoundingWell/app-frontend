import idb from './idb';

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
    cy.stub(window.indexedDB, 'open').throws(new DOMException('blocked', 'SecurityError'));

    return idb.put('entities', 'k', { a: 1 })
      .then(() => idb.get('entities', 'k'))
      .then(value => {
        expect(value).to.be.undefined;
      });
  });
});
