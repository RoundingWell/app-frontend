import { Radio } from 'marionette';

import router from 'js/router';

import App from 'js/base/app';

export default App.extend({
  channelName: 'history',
  radioRequests: {
    'go:back': 'goBack',
  },
  initialize() {
    this.listenTo(router, 'route', this.onRoute);
  },
  // A replace with no info is a refresh or redirect hop, not a navigation
  onRoute({ url, navigationType, info }) {
    if (navigationType === 'replace' && info === undefined) return;

    this.getChannel().trigger('change:route', url.pathname);
  },
  goBack(handleEmptyHistory) {
    Radio.request('router', 'back', handleEmptyHistory);
  },
});
