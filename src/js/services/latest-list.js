import { omit } from 'underscore';
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

  onRoute({ name, params, info, meta }) {
    if (!meta.isList) return;

    this._latestList = { name, params: omit(params, 'workspace'), info };
  },

  hasLatestList() {
    return !!this._latestList;
  },

  goLatestList() {
    const { name, params, info } = this._latestList;

    Radio.request('router', 'navigate', name, params, { info }).catch(addError);
  },
});
