import { Region } from 'marionette';

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
    'region': 'getSidebarRegion',
  },

  // each sidebar app owns a Region over the shared host element so that a
  // stopping app cannot empty its replacement's root
  getSidebarRegion() {
    return new Region({ el: this.getRegion().el });
  },

  async startSidebarApp(app, appOptions, viewOptions) {
    if (this.currentApp === app) return this.currentApp;

    // claim the sidebar before awaiting so an interleaved start supersedes
    // this one instead of attaching a second layout to the host element
    const stopping = this.stopSidebarApp();

    this.currentApp = app;

    await stopping;

    if (this.currentApp !== app) return;

    app.showView(new LayoutView(viewOptions));

    this.listenTo(app.getView(), 'close', () => {
      app.triggerMethod('close', app);
    });

    this.listenToOnce(app, 'stop', () => {
      if (this.currentApp !== app) return;

      delete this.currentApp;
    });

    await app.start(appOptions);

    return this.currentApp === app ? app : undefined;
  },

  stopSidebarApp() {
    if (!this.currentApp) return;

    const app = this.currentApp;

    delete this.currentApp;

    return app.stop();
  },
});
