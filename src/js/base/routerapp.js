import { isArray, isEqual, isFunction, map, partial, reduce, rest, result } from 'underscore';
import Backbone from 'backbone';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import CurrentChildApp from './current-child-app';
import EventRouter from './event-router';

export default CurrentChildApp.extend({
  // Set in router apps for nav selection
  routerAppName: '',
  startOnRoute: true,

  constructor: function(options = {}) {
    this.workspaceSlug = options.workspaceSlug;
    this.routeRegion = options.routeRegion;
    this._routeIntent = null;

    this.initRouter();

    // if the app does not handle a given route, stop
    this.listenTo(this.router, 'noMatch', this.onNoMatch);

    this.on('before:stop', this._clearRouteIntent);

    CurrentChildApp.apply(this, arguments);
  },

  initRouter() {
    this._routes = result(this, 'eventRoutes');

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
    this.stop().catch(error => this.triggerMethod('route:error', error, routeContext));
    this._currentRoute = null;
  },

  // For each route in the hash creates a routeTriggers hash,
  // prefixing every (non-root) route or alias with the workspace slug
  getRouteTriggers() {
    return reduce(this._routes, (routeTriggers, { route, root }, eventName) => {
      routeTriggers[eventName] = isArray(route) ?
        map(route, pattern => this._prefixRoute(pattern, root)) :
        this._prefixRoute(route, root);

      return routeTriggers;
    }, {});
  },

  _prefixRoute(route, root) {
    if (root) return route;

    if (!this.workspaceSlug) {
      throw new Error('RouterApp requires workspaceSlug for non-root routes');
    }

    return route ? `${ this.workspaceSlug }/${ route }` : this.workspaceSlug;
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
    const definition = this._routes[event];
    const routeIntent = {};

    const routeContext = {
      event,
      eventArgs: args,
      definition: {
        action: definition.action,
        route: isArray(definition.route) ? definition.route[0] : definition.route,
        root: definition.root,
        meta: definition.meta || {},
      },
    };
    this.invalidateSelection();
    this._currentRoute = routeContext;
    this._routeIntent = routeIntent;

    return this.activateRoute(routeContext, routeIntent).catch(error => {
      if (this._routeIntent === routeIntent) this.triggerMethod('route:error', error, routeContext);
    });
  },

  async activateRoute(routeContext, routeIntent) {
    if (this.startOnRoute) {
      const region = this.routeRegion || this.getRegion();
      const started = await this.start(region ? { region } : undefined);
      if (!started || this._routeIntent !== routeIntent) return;
    }

    return this.dispatchRoute(routeContext);
  },

  onRouteError(error) {
    addError(error);
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

  _clearRouteIntent() {
    this._routeIntent = null;
  },

  // takes an event and translates data into the applicable url fragment
  translateEvent(event) {
    const route = this.router.getDefaultRoute(event);

    return this.router.translateRoute(route, rest(arguments));
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
