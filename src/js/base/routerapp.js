import { isFunction, result } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from './app';
import { bindApplicationRouter } from './routing/application-router';
import { createBackboneRouteTransport } from './routing/backbone-transport';

// Optional declarative shorthand over the composition API. Domain Applications
// can install the same binding in initialize without extending this adapter.
export default App.extend({
  routerAppName: '',
  startOnRoute: true,
  constructor: function(options = {}) {
    this.workspaceSlug = options.workspaceSlug;
    this.routeRegion = options.routeRegion;
    this.initRouter(options);
    // Mandatory setup precedes consumer initialize: ErrorApp registers its
    // catch-all there. preinitialize/initialize remain safe extension points.
    App.apply(this, arguments);
  },
  initRouter(options = {}) {
    this.routing = bindApplicationRouter(this, {
      definitions: result(this, 'eventRoutes'),
      workspaceSlug: this.workspaceSlug,
      region: this.routeRegion,
      transport: options.transport || createBackboneRouteTransport({ channel: Radio.channel('event-router') }),
      startOnRoute: this.startOnRoute,
      resolveAction: action => (isFunction(action) ? action : this[action]).bind(this),
      beforeDispatch: route => this.triggerMethod('before:appRoute', this, route),
      afterDispatch: route => this.triggerMethod('appRoute', this, route),
      onError: (error, route) => this.triggerMethod('route:error', error, route),
      onCleanupError: (error, child) => this.triggerMethod('child:cleanup:error', error, child),
      onNoMatch: () => this.onNoMatch(),
    });
    this.router = this.routing.connection.router;
  },
  onNoMatch() {
    return this.routing.leave();
  },
  getRouteTriggers() {
    return this.routing.table.triggers;
  },
  routeAction(event, action, ...args) {
    return this.routing.accept(this.routing.table.context(event, args));
  },
  onChildCleanupError(error) {
    addError(error);
  },
  onRouteError(error) {
    window.reportError(error);
  },
  startCurrent(name, options) {
    return this.routing.startCurrent(name, options);
  },
  startRoute(name, options) {
    return this.routing.startRoute(name, options);
  },
  selectChild(name, options) {
    return this.routing.select(name, options);
  },
  invalidateSelection() {
    this.routing.invalidate();
  },
  getCurrent() {
    return this.routing.getCurrent();
  },
  getCurrentSelection() {
    return this.routing.getSelection();
  },
  stopCurrent() {
    return this.routing.stopCurrent();
  },
  getCurrentRoute() {
    return this.routing.getRoute();
  },
  getCurrentRouteMeta() {
    return this.getCurrentRoute()?.definition.meta;
  },
  translateEvent(event, ...args) {
    return this.routing.href(event, ...args);
  },
  replaceRoute(event, ...args) {
    return this.routing.replaceRoute(event, ...args);
  },
  navigateRoute(event, ...args) {
    return this.routing.navigateRoute(event, ...args);
  },
  replaceUrl(url) {
    return this.routing.write(url, { replace: true });
  },
});
