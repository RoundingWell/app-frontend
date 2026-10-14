import { Radio } from 'marionette';

import App from 'js/base/app';

import router from 'js/router';

import { ErrorView } from 'js/apps/globals/error/error_views';

export default App.extend({
  viewEvents: {
    'click:back': 'stop',
  },

  initialize() {
    this.listenTo(Radio.channel('event-router'), {
      notFound: this.showNotFound,
      unknownError: this.showError,
    });

    this.listenTo(router, 'route', this.onRoute);
  },

  // The error renders at the current URL and goes away with the next route
  onRoute({ name }) {
    if (name === 'notFound') {
      this.showNotFound();
      return;
    }

    this.stop();
  },

  showNotFound() {
    this.restart({ is404: true });
  },

  showError(status) {
    this.restart({ status });
  },

  onStart(app, options) {
    this.showView(new ErrorView(options));
  },
});
