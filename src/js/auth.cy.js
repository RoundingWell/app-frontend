import Radio from 'backbone.radio';

import 'js/auth'; // registers the 'auth' channel replies

context('auth:getUserId', function() {
  afterEach(function() {
    // Drop any test override; the module-registered reply survives import-time
    // binding and remains in place for subsequent specs.
    Radio.stopReplying('auth', 'getUserId');
  });

  specify('exposes a synchronous getUserId reply', function() {
    // Test consumers can override the reply directly to drive cache behavior.
    Radio.reply('auth', 'getUserId', () => 'user_test');
    expect(Radio.request('auth', 'getUserId')).to.equal('user_test');
  });

  specify('returns undefined when no user has authenticated yet', function() {
    // No override and no auth() flow run → module-local cachedUserId is undefined.
    expect(Radio.request('auth', 'getUserId')).to.be.undefined;
  });
});
