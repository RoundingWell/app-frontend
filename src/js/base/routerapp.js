import { isEqual, isFunction, partial, reduce, result } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import RouteBaseApp from './route-base-app';
import EventRouter from './event-router';
import { createRouteTable } from './routing/route-table';
import { createRouteDispatch } from './routing/route-dispatch';

export default RouteBaseApp.extend({
  // Set in router apps for nav selection
  routerAppName: '',
  startOnRoute: true,

  constructor: function(options = {}) {
    this.workspaceSlug = options.workspaceSlug;
    this.routeRegion = options.routeRegion;
    this.routeDispatch = createRouteDispatch({
      prepare: () => this.prepareRoute(),
      dispatch: ({ route }) => this.dispatchRoute(route),
      onError: (error, route) => this.triggerMethod('route:error', error, route),
    });

    this.initRouter();

    // if the app does not handle a given route, stop
    this.listenTo(this.router, 'noMatch', this.onNoMatch);

    this.on('before:stop', () => this.routeDispatch.invalidate());
    this.on('before:destroy', () => this.routeDispatch.dispose());

    RouteBaseApp.apply(this, arguments);
  },

  initRouter() {
    this._routes = result(this, 'eventRoutes');

    this.routeTable = createRouteTable(this._routes, { workspaceSlug: this.workspaceSlug });
    const routeTriggers = this.getRouteTriggers();

    this.router = new EventRouter({
      channel: Radio.channel('event-router'),
      routeTriggers,
    });

    this.on('before:destroy', () => this.router.destroy());

    this.bindRouteEvents();
  },

  onNoMatch() {
    const routeContext = this.getCurrentRoute();
    this._currentRoute = null;
    this.routeDispatch.invalidate();
    try {
      this.stop();
    } catch(error) {
      this.triggerMethod('route:error', error, routeContext);
    }
  },

  getRouteTriggers() {
    return this.routeTable.triggers;
  },

  getEventActions(eventRoutes, routeAction) {
    return reduce(eventRoutes, function(eventActions, { action }, eventName) {
      eventActions[eventName] = partial(routeAction, eventName, action);

      return eventActions;
    }, {});
  },

  // handle route events
  // accepts a hash of 'some:event' : 'actionFunction'
  // listens to the router channel and calls the appropriate
  // action via the routeAction handler
  bindRouteEvents() {
    const eventActions = this.getEventActions(this._routes, this.routeAction);

    this.listenTo(this.router.getChannel(), eventActions);
  },

  // applies the route's action
  // starts this routerapp if necessary
  // triggers before and after events
  routeAction(event, action, ...args) {
    const routeContext = this.routeTable.context(event, args);
    this.invalidateSelection();
    this._currentRoute = routeContext;
    return this.routeDispatch.accept(routeContext);
  },

  prepareRoute() {
    if (!this.startOnRoute) return true;
    const region = this.routeRegion || this.getRegion();
    return this.start(region ? { region } : undefined);
  },

  onChildCleanupError(error) {
    addError(error);
  },

  onRouteError(error) {
    window.reportError(error);
  },

  dispatchRoute(routeContext) {
    const { definition, eventArgs } = routeContext;

    this.triggerMethod('before:appRoute', this, routeContext);

    let { action } = definition;
    if (!isFunction(action)) {
      action = this[action];
    }

    const activation = action.apply(this, eventArgs);

    this.triggerMethod('appRoute', this, routeContext);

    return activation;
  },

  startCurrent(appName, options) {
    const routeContext = this.getCurrentRoute();
    const child = this.getChildApp(appName);

    return this.selectChild(appName, {
      scope: child && this.getChildScope(child, options),
      start: app => {
        if (isFunction(app.setCurrentRoute)) app.setCurrentRoute(routeContext);
        return app.start({ ...options, region: this.getRegion() });
      },
    });
  },

  getChildScope(child, options) {
    return isFunction(child.getRouteScope) ? child.getRouteScope(options) : undefined;
  },

  startRoute(appName, options) {
    const child = this.getChildApp(appName);
    const scope = child && this.getChildScope(child, options);
    const routeContext = this.getCurrentRoute();

    return this.selectChild(appName, {
      scope,
      reuse: this.isCurrent(appName, scope),
      start: app => app.startRoute(routeContext, { ...options, region: this.getRegion() }),
    });
  },

  isCurrent(appName, scope) {
    const selection = this.getCurrentSelection();
    return selection?.appName === appName && isEqual(scope, selection.scope);
  },

  getCurrentRoute() {
    return this._currentRoute;
  },

  getCurrentRouteMeta() {
    return this._currentRoute && this._currentRoute.definition.meta;
  },

  translateEvent(event, ...args) {
    return this.routeTable.href(event, ...args);
  },

  // takes an event and changes the URL without triggering or adding to the history
  replaceRoute() {
    const url = this.translateEvent.apply(this, arguments);

    this.replaceUrl(url);
  },

  navigateRoute() {
    const url = this.translateEvent.apply(this, arguments);

    Backbone.history.navigate(url, { trigger: false });
  },

  replaceUrl(url) {
    Backbone.history.navigate(url, { trigger: false, replace: true });
  },
});
