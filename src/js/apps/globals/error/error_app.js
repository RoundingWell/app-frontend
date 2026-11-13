import App from 'js/base/app';

import router from 'js/router';

import { ErrorView } from 'js/apps/globals/error/error_views';

export default App.extend({
  channelName: 'error',
  radioRequests: {
    'show:notFound': 'showNotFound',
  },
  viewEvents: {
    'click:back': 'stop',
  },

  initialize() {
    this.listenTo(router, 'route', this.onRoute);
  },

  // The error renders at the current URL and goes away with the next route
  onRoute({ name, info }) {
    if (name === 'notFound') {
      this.showNotFound();
      return;
    }

    if (name === 'unknownError') {
      this.showError(info?.status);
      return;
    }

    this.stop();
  },

  showNotFound() {
    this.restart({
      is404: true,
    });
  },

  showError(status) {
    this.restart({
      status,
    });
  },

  onStart(app, options) {
    this.showView(new ErrorView(options));
  },
});
