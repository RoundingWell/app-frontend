import App from 'js/base/app';

import { LayoutView } from 'js/services/sidebar/sidebar_views';

export const SidebarMixin = {
  showContentView(name, view, options) {
    const contentView = this.getView().getChildView('content');
    const region = contentView.getRegion(name);
    region.show(view, options);
    return view;
  },
  showFooterView(name, view, options) {
    const footerView = this.getView().getChildView('footer');
    const region = footerView.getRegion(name);
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

  startSidebarApp(app, appOptions, viewOptions) {
    if (this.currentApp === app) return this.currentApp;

    this.stopSidebarApp();

    this.currentApp = app;

    app.setRegion(this.getRegion());
    app.showView(new LayoutView(viewOptions));

    app.start(appOptions);

    this.listenTo(app.getView(), 'close', () => {
      app.triggerMethod('close', app);
    });

    this.listenTo(app, 'stop', () => {
      this.getRegion().empty();
      delete this.currentApp;
    });

    return this.currentApp;
  },

  stopSidebarApp() {
    if (!this.currentApp) return;

    this.currentApp.stop();

    delete this.currentApp;
  },
});
