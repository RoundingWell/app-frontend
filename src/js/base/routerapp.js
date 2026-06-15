import { isArray, isEqual, isFunction, map, partial, reduce, rest, result } from 'underscore';
import Backbone from 'backbone';
import EventRouter from 'backbone.eventrouter';
import App from './app';

export default App.extend({
  // Set in router apps for nav selection
  routerAppName: '',

  constructor: function(options = {}) {
    this.workspaceSlug = options.workspaceSlug;

    this.initRouter();

    // if the app does not handle a given route, stop
    this.listenTo(this.router, 'noMatch', this.onNoMatch);

    this.on('before:stop', this.stopCurrent);

    App.apply(this, arguments);
  },

  initRouter() {
    this._routes = result(this, 'eventRoutes');

    const routeTriggers = this.getRouteTriggers();

    this.router = new EventRouter({ routeTriggers });

    this.on('before:destroy', () => this.router.destroy());

    this.bindRouteEvents();
  },

  onNoMatch() {
    this.stop();
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
    if (!this.isRunning()) {
      this.start();
    }

    const definition = this._routes[event];

    this._currentRoute = {
      event,
      eventArgs: args,
      definition: {
        action: definition.action,
        route: isArray(definition.route) ? definition.route[0] : definition.route,
        root: definition.root,
        meta: definition.meta || {},
      },
    };

    this.triggerMethod('before:appRoute', this, this._currentRoute);

    if (!isFunction(action)) {
      action = this[action];
    }

    action.apply(this, args);

    this.triggerMethod('appRoute', this, this._currentRoute);
  },

  // handler that ensures one running app
  startCurrent(appName, options) {
    this.stopCurrent();

    const child = this.getChildApp(appName);

    // only SubRouterApp children participate in route dispatch and scope identity;
    // plain list/leaf children (worklist, schedule, programs-all) do neither
    if (isFunction(child.setCurrentRoute)) {
      child.setCurrentRoute(this.getCurrentRoute());
    }

    this._currentAppName = appName;
    this._currentAppScope = this.getChildScope(child, options);
    this._current = child;

    // child apps are singletons; ensure exactly one stop listener
    this.stopListening(child, 'stop');
    this.listenTo(child, 'stop', this._handleChildStop);

    this.startChildApp(appName, options);

    return child;
  },

  getChildScope(child, options) {
    return isFunction(child.getRouteScope) ? child.getRouteScope(options) : undefined;
  },

  startRoute(appName, options) {
    const child = this.getChildApp(appName);
    const scope = this.getChildScope(child, options);
    const current = this.getCurrent();

    if (current && this.isCurrent(appName, scope) && (current.isRunning() || current.isLoading())) {
      return current.startRoute(this.getCurrentRoute());
    }

    return this.startCurrent(appName, options);
  },

  getCurrent() {
    return this._current;
  },

  isCurrent(appName, scope) {
    return (appName === this._currentAppName)
      && (isEqual(scope, this._currentAppScope));
  },

  getCurrentRoute() {
    return this._currentRoute;
  },

  getCurrentRouteMeta() {
    return this._currentRoute && this._currentRoute.definition.meta;
  },

  _handleChildStop() {
    // Preserve the current child through Toolkit restart().
    if (this._current && this._current.isRestarting()) return;

    this._clearCurrent();
  },

  stopCurrent() {
    if (!this._current) return;

    const current = this._current;

    this.stopListening(current, 'stop');
    this._clearCurrent();

    current.stop();
  },

  _clearCurrent() {
    this._current = null;
    this._currentAppName = null;
    this._currentAppScope = null;
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
