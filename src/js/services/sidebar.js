import App from 'js/base/app';

import { LayoutView } from 'js/services/sidebar/sidebar_views';

export const SidebarMixin = {
  showContentView(name, view, options) {
    const contentView = this.getView().getChildView('content');
    const region = contentView.getRegion(name);
    region.show(view, options);
    return view;
  },
};

export default App.extend({
  channelName: 'sidebar',

  radioRequests: {
    'stop': 'stopSidebarApp',
    'start': 'startSidebarApp',
  },

  async startSidebarApp(app, appOptions, viewOptions) {
    // claim the sidebar before awaiting so an interleaved start supersedes
    // this one instead of attaching a second layout to the host element
    const stopping = this.stopSidebarApp();
    const claim = {};

    this.currentApp = app;
    this.currentClaim = claim;

    try {
      await stopping;

      if (this.currentClaim !== claim) return;

      await app.stop();

      if (this.currentClaim !== claim) return;

      const view = app.setView(new LayoutView(viewOptions));

      this.listenTo(view, 'close', () => {
        app.triggerMethod('close', app);
      });

      this.listenToOnce(app, 'stop', () => {
        if (this.currentClaim !== claim) return;

        delete this.currentApp;
        delete this.currentClaim;
      });

      const started = await app.start({ ...appOptions, region: this.getRegion() });

      if (!started) return;

      if (this.currentClaim !== claim) {
        if (this.currentApp !== app) await app.stop();
        return;
      }

      app.showView();
    } catch(error) {
      await this._cleanupFailedStart(app, claim);
      throw error;
    }

    return app;
  },

  async _cleanupFailedStart(app, claim) {
    const ownsClaim = this.currentClaim === claim;

    if (ownsClaim) {
      delete this.currentApp;
      delete this.currentClaim;
    }

    if (ownsClaim || this.currentApp !== app) await this._trackStop(app.stop());
  },

  _trackStop(stopping) {
    const pending = Promise.resolve(stopping).finally(() => {
      this.pendingStops.delete(pending);
    });

    this.pendingStops ||= new Set();
    this.pendingStops.add(pending);
    return pending;
  },

  stopSidebarApp() {
    if (!this.currentApp) return Promise.all(this.pendingStops || []);

    const app = this.currentApp;

    delete this.currentApp;
    delete this.currentClaim;

    return this._trackStop(app.stop());
  },

  prepareStop() {
    return this.stopSidebarApp();
  },
});
