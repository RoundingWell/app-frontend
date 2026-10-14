import { Radio } from 'marionette';

import App from 'js/base/app';

import router from 'js/router';

export default App.extend({
  channelName: 'history',
  radioRequests: {
    'go:back': 'goBack',
  },
  initialize() {
    this._href = window.location.href;

    this.listenTo(router, 'route', this.onRoute);
  },
  // Refreshing the current URL is not a route change
  onRoute({ url }) {
    if (url.href === this._href) return;

    this._href = url.href;
    this.getChannel().trigger('change:route', url.pathname);
  },
  goBack(handleEmptyHistory) {
    Radio.request('router', 'back', handleEmptyHistory);
  },
});
