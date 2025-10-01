import { extend, result } from 'underscore';
import { normalizeMethods } from 'marionette';

import App from './app';

export default App.extend({
  constructor: function() {
    this._current = null;

    this.initRouter();

    this.on('before:stop', this.stopCurrent);

    App.apply(this, arguments);
  },

  initRouter() {
    const eventRoutes = result(this, 'eventRoutes', {});
    this._eventRoutes = normalizeMethods(this, eventRoutes);
  },

  // Start a route from a currentRoute passed from a routerapp
  startRoute(currentRoute) {
    this.triggerMethod('before:startRoute', currentRoute);

    const { event, eventArgs } = currentRoute;
    const action = this._eventRoutes[event];

    if (!action) return;

    action.apply(this, eventArgs);

    this.triggerMethod('startRoute', currentRoute);
  },

  mixinOptions(options) {
    const appOptions = result(this, 'currentAppOptions');

    return extend({}, appOptions, options);
  },

  // handler that ensures one running app per type
  startCurrent(appName, options) {
    this.stopCurrent();

    const app = this.startChildApp(appName, this.mixinOptions(options));

    this._current = app;

    return app;
  },

  getCurrent() {
    return this._current;
  },

  stopCurrent() {
    if (!this._current) return;

    this._current.stop();
    this._current = null;
  },
});
