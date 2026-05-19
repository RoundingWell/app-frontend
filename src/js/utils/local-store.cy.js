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

  specify('remove deletes the key', function() {
    localStore.set('del-key', 'value');
    localStore.remove('del-key');
    expect(localStore.get('del-key')).to.be.undefined;
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
});
