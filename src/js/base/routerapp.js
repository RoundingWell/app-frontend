import { isEqual, isFunction, result } from 'underscore';

import { addError } from 'js/datadog';

import { getPositionalParamNames } from 'js/router';

import RouteBaseApp from './route-base-app';

// An area of the app. WorkspaceApp selects it by route and shows the match
// through `showRoute`, which calls the area's action handlers.
export default RouteBaseApp.extend({
  constructor: function() {
    this._routes = result(this, 'eventRoutes');
    this._routeIntent = null;

    this.on('before:stop', this._clearRouteIntent);

    RouteBaseApp.apply(this, arguments);
  },

  // Dispatches a match to the action registered for its route name. Handlers
  // take the route's params by position, then the trailing `info.args`.
  showRoute({ name, params, info }) {
    const args = [...getPositionalParamNames(name).map(paramName => params[paramName]), ...(info?.args || [])];
    const definition = this._routes[name];
    const routeIntent = {};
    const routeContext = {
      event: name,
      eventArgs: args,
      definition: { action: definition.action },
    };

    this.invalidateSelection();
    this._currentRoute = routeContext;
    this._routeIntent = routeIntent;

    return this.activateRoute(routeContext).catch(error => {
      if (this._routeIntent === routeIntent) this.triggerMethod('route:error', error, routeContext);
    });
  },

  async activateRoute({ definition, eventArgs }) {
    return this[definition.action](...eventArgs);
  },

  onChildCleanupError(error) {
    addError(error);
  },

  onRouteError(error) {
    window.reportError(error);
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

  _clearRouteIntent() {
    this._routeIntent = null;
  },
});
