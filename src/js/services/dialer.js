import Radio from 'backbone.radio';

import App from 'js/base/app';

export default App.extend({
  channelName: 'dialer',
  radioRequests: {
    'call': 'call',
    'init': 'init',
    'five9CallComplete': 'five9CallComplete',
  },
  async init() {
    if (this._initialized) return;

    const dialerSetting = Radio.request('settings', 'get', 'dialer');

    if (dialerSetting === 'five9') {
      const currentOrg = Radio.request('bootstrap', 'organization');
      const providerName = currentOrg.get('name');

      const { call, init } = await import('@roundingwell/care-ops-five9');
      this.call = call;
      init({ region: this.getRegion(), providerName });
      this._initialized = true;
    }
  },
  five9CallComplete(data) {
    Radio.request('entities', 'save:artifacts:model', {
      artifact: 'five9-call-log',
      identifier: data.sessionID,
      values: data,
    });
  },
});
