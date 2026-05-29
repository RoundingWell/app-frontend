import Radio from 'backbone.radio';

import 'js/auth'; // registers the 'auth' channel replies

context('auth:getUserId', function() {
  afterEach(function() {
    Radio.stopReplying('auth', 'getUserId');
  });

  specify('exposes a synchronous getUserId reply that consumers can override', function() {
    Radio.reply('auth', 'getUserId', () => 'user_test');
    expect(Radio.request('auth', 'getUserId')).to.equal('user_test');
  });
});
