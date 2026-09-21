import { extend, isArray, pick, result } from 'underscore';
import Backbone from 'backbone';

import { addError } from 'js/datadog';

import RouteBaseApp from './route-base-app';

export default RouteBaseApp.extend({
  constructor: function() {
    this._runId = 0;
    this._routeIntent = null;

    this.on('start', () => this._runId++);
    this.on('before:stop', this._clearRouteIntent);

    RouteBaseApp.apply(this, arguments);
  },

  createState() {
    return new Backbone.Model({ currentRoute: null });
  },

  // Explicit resource identity; route-specific startup options never define scope.
  getRouteScope(options = {}) {
    const scope = result(this, 'routeScope');
    if (!isArray(scope)) throw new Error('SubRouterApp requires a routeScope array');
    return pick(options, scope);
  },

  setCurrentRoute(routeContext) {
    this.invalidateSelection();
    this.getState().set('currentRoute', routeContext);
  },

  getCurrentRoute() {
    return this.getState().get('currentRoute');
  },

  // records the newest route and ensures it is dispatched by the active run
  async startRoute(routeContext, options) {
    const runId = this._runId;
    const routeIntent = {};
    this.setCurrentRoute(routeContext);
    this._routeIntent = routeIntent;

    const started = await this.start(options);

    if (!started || this._routeIntent !== routeIntent) return;
    if (this._runId === runId) this.startCurrentRoute();

    return this;
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

    const activation = action.apply(this, eventArgs);
    // onStart notifications do not await returned promises. Observe action
    // failures here as well as on routes dispatched into an already-active run.
    const completion = Promise.resolve(activation).catch(error => {
      if (this.getCurrentRoute() === currentRoute && this.isRunning()) {
        this.triggerMethod('route:error', error, currentRoute);
      }
    });

    this.triggerMethod('startRoute', currentRoute);

    return completion;
  },

  onRouteError(error) {
    addError(error);
  },

  mixinOptions(options) {
    const appOptions = result(this, 'currentAppOptions');

    return extend({}, appOptions, options);
  },

  startCurrent(appName, options) {
    return this.selectChild(appName, {
      start: app => app.start(this.mixinOptions(options)),
    });
  },

  _clearRouteIntent() {
    this._routeIntent = null;
  },
});
