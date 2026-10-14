import { isArray, mapObject, pick, result } from 'underscore';
import Backbone from 'backbone';

import { addError } from 'js/datadog';

import App from './app';
import { bindRouteApplication } from './routing/application-binding';

// Optional scoped-detail shorthand. This adapter owns no URLs or transport.
export default App.extend({
  constructor: function() {
    this.routing = bindRouteApplication(this, {
      getScope: options => this.getRouteScope(options),
      getActions: () => mapObject(this.normalizeMethods(result(this, 'routeActions', {})), action => action.bind(this)),
      getChildOptions: options => this.mixinOptions(options),
      readRoute: () => this.getState().get('currentRoute'),
      writeRoute: route => this.getState().set('currentRoute', route),
      beforeDispatch: route => this.triggerMethod('before:startRoute', route),
      afterDispatch: route => this.triggerMethod('startRoute', route),
      onError: (error, route) => this.triggerMethod('route:error', error, route),
      onCleanupError: (error, child) => this.triggerMethod('child:cleanup:error', error, child),
    });
    App.apply(this, arguments);
  },
  createState() {
    return new Backbone.Model({ currentRoute: null });
  },
  getRouteScope(options = {}) {
    const scope = result(this, 'routeScope');
    if (!isArray(scope)) throw new Error('SubRouterApp requires a routeScope array');
    return pick(options, scope);
  },
  setCurrentRoute(route) {
    this.routing.setRoute(route);
  },
  getCurrentRoute() {
    return this.routing.getRoute();
  },
  startRoute(route, options) {
    return this.routing.accept(route, options);
  },
  startCurrentRoute() {
    return this.routing.dispatchCurrent();
  },
  onChildCleanupError(error) {
    addError(error);
  },
  onRouteError(error) {
    window.reportError(error);
  },
  mixinOptions(options) {
    return { ...result(this, 'currentAppOptions'), ...options };
  },
  startCurrent(name, options) {
    return this.routing.startCurrent(name, options);
  },
  getCurrent() {
    return this.routing.getCurrent();
  },
  getCurrentSelection() {
    return this.routing.getSelection();
  },
  invalidateSelection() {
    this.routing.invalidate();
  },
  selectChild(name, options) {
    return this.routing.select(name, options);
  },
  stopCurrent() {
    return this.routing.stopCurrent();
  },
});
