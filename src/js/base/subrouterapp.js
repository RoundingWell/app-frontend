import { extend, pick, result } from 'underscore';
import Backbone from 'backbone';

import App from './app';

export default App.extend({
  constructor: function() {
    this._current = null;

    this.on('before:stop', this.stopCurrent);

    App.apply(this, arguments);
  },

  createState() {
    return new Backbone.Model({ currentRoute: null });
  },

  // declarative scope identity used by a parent RouterApp to decide reuse;
  // without a declared routeScope, fall back to full-option identity
  getRouteScope(options = {}) {
    const scope = result(this, 'routeScope');
    return scope ? pick(options, scope) : options;
  },

  setCurrentRoute(routeContext) {
    this.getState().set('currentRoute', routeContext);
  },

  getCurrentRoute() {
    return this.getState().get('currentRoute');
  },

  // records the newest route, dispatching only when already running;
  // while loading or stopped the route is retained for startCurrentRoute()
  startRoute(routeContext) {
    this.setCurrentRoute(routeContext);

    if (this.isRunning()) {
      this.startCurrentRoute();
    }
  },

  // synchronously dispatches the current route to its action
  startCurrentRoute() {
    const currentRoute = this.getCurrentRoute();

    if (!currentRoute) return;

    this.triggerMethod('before:startRoute', currentRoute);

    const { event, eventArgs } = currentRoute;
    const routeActions = this.normalizeMethods(result(this, 'routeActions', {}));
    const action = routeActions[event];

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

    const stopping = this._current.stop();
    this._current = null;

    return stopping;
  },
});
