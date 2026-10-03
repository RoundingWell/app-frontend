import { Radio } from 'marionette';

import App from 'js/base/app';

export default App.extend({
  channelName: 'sidebar',

  radioRequests: {
    'stop': 'stopSidebarApp',
    'start': 'startSidebarApp',
  },

  async startSidebarApp(app, appOptions) {
    this.stopSidebarApp();
    const claim = {};

    this.currentApp = app;
    this.currentClaim = claim;

    try {
      app.stop();

      /* istanbul ignore if: defensive reentry from a sidebar's synchronous stop handler */
      if (this.currentClaim !== claim) return;

      this.listenToOnce(app, 'stop', () => {
        if (this.currentClaim !== claim) return;

        delete this.currentApp;
        delete this.currentClaim;
      });

      const started = await app.start({ ...appOptions, region: this.getRegion() });

      if (!started) return;
    } catch(error) {
      delete this.currentApp;
      delete this.currentClaim;
      app.stop();
      Radio.trigger('event-router', 'unknownError', error?.response?.status);
      return;
    }

    return app;
  },

  stopSidebarApp() {
    const app = this.currentApp;
    delete this.currentApp;
    delete this.currentClaim;
    return app ? app.stop() : true;
  },

  onBeforeStop() {
    this.stopSidebarApp();
  },
});
