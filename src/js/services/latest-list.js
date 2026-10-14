import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import router from 'js/router';

export default App.extend({
  channelName: 'history',

  radioRequests: {
    'has:latestList': 'hasLatestList',
    'go:latestList': 'goLatestList',
  },

  initialize() {
    this.listenTo(router, 'route', this.onRoute);
  },

  onRoute({ url, info, meta }) {
    if (!meta.isList) return;

    this._latestList = { url, info };
  },

  hasLatestList() {
    return !!this._latestList;
  },

  goLatestList() {
    const { url, info } = this._latestList;

    Radio.request('router', 'navigate', url.href, { info }).catch(addError);
  },
});
