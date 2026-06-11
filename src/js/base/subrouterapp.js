import { extend, pick, result } from 'underscore';
import { normalizeMethods } from 'marionette';

import App from './app';

export default App.extend({
  constructor: function() {
    this._current = null;
    this._currentRoute = null;

    this.initRouter();

    this.on('before:stop', this.stopCurrent);
    this.on('before:stop', this.clearCurrentRoute);

    App.apply(this, arguments);
  },

  // route actions dispatch a matched route to a local handler
  // (distinct from RouterApp's `eventRoutes` URL definitions)
  initRouter() {
    const routeActions = result(this, 'routeActions', {});
    this._routeActions = normalizeMethods(this, routeActions);
  },

  // declarative scope identity used by a parent RouterApp to decide reuse;
  // without a declared routeScope, fall back to full-option identity
  getRouteScope(options = {}) {
    const scope = result(this, 'routeScope');
    return scope ? pick(options, scope) : options;
  },

  setCurrentRoute(routeContext) {
    this._currentRoute = routeContext;
  },

  getCurrentRoute() {
    return this._currentRoute;
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
    const action = this._routeActions[event];

    if (!action) return;

    action.apply(this, eventArgs);

    this.triggerMethod('startRoute', currentRoute);
  },

  // clears the current route on a normal stop, but preserves it across a
  // Toolkit restart() so the route can be re-dispatched after re-fetching
  clearCurrentRoute() {
    if (!this.isRestarting()) {
      this._currentRoute = null;
    }
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
