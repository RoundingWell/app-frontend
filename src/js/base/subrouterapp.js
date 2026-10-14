import { extend, isArray, mapObject, pick, result } from 'underscore';
import Backbone from 'backbone';

import { addError } from 'js/datadog';

import RouteBaseApp from './route-base-app';
import { createRouteDelivery } from './routing/route-delivery';
import { createRouteActions } from './routing/route-actions';

export default RouteBaseApp.extend({
  constructor: function() {
    this.dispatchCurrentRoute = createRouteActions({
      getActions: () => mapObject(this.normalizeMethods(result(this, 'routeActions', {})), action => action.bind(this)),
      before: route => this.triggerMethod('before:startRoute', route),
      after: route => this.triggerMethod('startRoute', route),
      onError: (error, route) => this.triggerMethod('route:error', error, route),
      isCurrent: route => this.getCurrentRoute() === route,
    });
    this.routeDelivery = createRouteDelivery({
      start: options => this.start(options),
      read: () => this.getCurrentRoute(),
      write: route => this.setCurrentRoute(route),
      dispatch: () => this.startCurrentRoute(),
    });
    this.on('start', () => this.routeDelivery.activated());
    this.on('before:stop', () => this.routeDelivery.invalidate());

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
    const started = await this.routeDelivery.accept(routeContext, options);
    if (started) return this;
  },

  // synchronously dispatches the current route to its action
  startCurrentRoute() {
    return this.dispatchCurrentRoute(this.getCurrentRoute());
  },

  onChildCleanupError(error) {
    addError(error);
  },

  onRouteError(error) {
    window.reportError(error);
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
});
