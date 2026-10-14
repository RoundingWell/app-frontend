import { has, isArray, isEqual, isFunction, isString, map, reduce, result } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import RouteBaseApp from './route-base-app';

export default RouteBaseApp.extend({
  // Set in router apps for nav selection
  routerAppName: '',
  startOnRoute: true,

  constructor: function(options = {}) {
    this.workspaceSlug = options.workspaceSlug;
    this.routeRegion = options.routeRegion;
    this._routeIntent = null;

    this.initRouter();

    this.on('before:stop', this._clearRouteIntent);

    RouteBaseApp.apply(this, arguments);
  },

  // Mounts this app's routes with the router. The router-radio service
  // dispatches matches back through routeEvent.
  initRouter() {
    this._routes = result(this, 'eventRoutes');

    const unmountRoutes = Radio.request('router', 'mount', this);

    this.on('before:destroy', unmountRoutes);
  },

  // if the app does not handle a given route, stop
  onNoMatch() {
    this._currentRoute = null;
    this.stop();
  },

  // Events without a `route` render in place and have no URL.
  // Every other route or alias is prefixed with the workspace slug unless `root`.
  getRouteDefinitions() {
    return reduce(this._routes, (definitions, { route, root, meta, redirect }, name) => {
      if (route === undefined) return definitions;

      const [path, ...aliases] = isArray(route) ? route : [route];

      definitions.push({
        name,
        path: this._prefixRoute(path, root),
        aliases: map(aliases, alias => this._prefixAlias(alias, root)),
        meta,
        redirect: redirect && ((...args) => this._resolveAction(redirect).apply(this, args)),
      });

      return definitions;
    }, []);
  },

  _prefixAlias(alias, root) {
    const { path, ...options } = isString(alias) ? { path: alias } : alias;

    return { ...options, path: this._prefixRoute(path, root) };
  },

  _prefixRoute(route, root) {
    if (root) return `/${ route }`;

    if (!this.workspaceSlug) {
      throw new Error('RouterApp requires workspaceSlug for non-root routes');
    }

    return `/${ this.workspaceSlug }/${ route }`;
  },

  _resolveAction(action) {
    return isFunction(action) ? action : this[action];
  },

  hasRoute(event) {
    return has(this._routes, event);
  },

  // applies the route's action
  // starts this routerapp if necessary
  // triggers before and after events
  routeEvent(event, ...args) {
    const definition = this._routes[event];

    // Redirect-only routes resolve to another route and have nothing to apply
    if (!definition.action) return;

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

  onChildCleanupError(error) {
    addError(error);
  },

  onRouteError(error) {
    window.reportError(error);
  },

  dispatchRoute(routeContext) {
    const { definition, eventArgs } = routeContext;

    this.triggerMethod('before:appRoute', this, routeContext);

    const activation = this._resolveAction(definition.action).apply(this, eventArgs);

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
});
