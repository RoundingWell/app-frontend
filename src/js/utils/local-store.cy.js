import localStore from './local-store';

context('localStore', function() {
  beforeEach(function() {
    localStorage.clear();
  });

  specify('get returns parsed value for existing key', function() {
    localStorage.setItem('test-key', JSON.stringify({ foo: 'bar' }));
    expect(localStore.get('test-key')).to.deep.equal({ foo: 'bar' });
  });

  specify('get returns undefined for missing key', function() {
    expect(localStore.get('no-such-key')).to.be.undefined;
  });

  specify('get returns undefined for invalid JSON', function() {
    localStorage.setItem('bad-json', '{not valid}');
    expect(localStore.get('bad-json')).to.be.undefined;
  });

  specify('set stores value readable by get', function() {
    localStore.set('my-key', { a: 1 });
    expect(localStore.get('my-key')).to.deep.equal({ a: 1 });
  });

  specify('set with undefined removes the key', function() {
    localStore.set('rm-key', 'value');
    localStore.set('rm-key', undefined);
    expect(localStore.get('rm-key')).to.be.undefined;
  });

  specify('set does not throw when storage is unavailable', function() {
    cy.stub(localStorage, 'setItem').throws(new DOMException('blocked', 'SecurityError'));
    expect(() => localStore.set('key', 'val')).not.to.throw();
  });

  specify('set rethrows QuotaExceededError', function() {
    cy.stub(localStorage, 'setItem').throws(new DOMException('quota', 'QuotaExceededError'));
    expect(() => localStore.set('key', 'val')).to.throw('quota');
  });

  specify('set rethrows unexpected errors', function() {
    cy.stub(localStorage, 'setItem').throws(new Error('unexpected'));
    expect(() => localStore.set('key', 'val')).to.throw('unexpected');
  });

  specify('remove deletes the key', function() {
    localStore.set('del-key', 'value');
    localStore.remove('del-key');
    expect(localStore.get('del-key')).to.be.undefined;
  });

  specify('remove does not throw when storage is unavailable', function() {
    cy.stub(localStorage, 'removeItem').throws(new DOMException('blocked', 'SecurityError'));
    expect(() => localStore.remove('key')).not.to.throw();
  });

  specify('each iterates all entries with (value, key)', function() {
    localStore.set('k1', 1);
    localStore.set('k2', 2);

    const seen = {};
    localStore.each((value, key) => {
      seen[key] = value;
    });

    expect(seen).to.deep.equal({ k1: 1, k2: 2 });
  });

  specify('each is safe when callback removes keys', function() {
    localStore.set('form-subm-a', { submission: 'a' });
    localStore.set('form-subm-b', { submission: 'b' });
    localStore.set('keep', 'yes');

    localStore.each((value, key) => {
      if (String(key).startsWith('form-subm-')) localStore.remove(key);
    });

    expect(localStore.get('form-subm-a')).to.be.undefined;
    expect(localStore.get('form-subm-b')).to.be.undefined;
    expect(localStore.get('keep')).to.equal('yes');
  });

  specify('each does not throw when storage is unavailable', function() {
    cy.stub(localStorage, 'key').throws(new DOMException('blocked', 'SecurityError'));
    expect(() => localStore.each(() => {})).not.to.throw();
  });
});
