import { extend, isEqual, isFunction, partial, reduce, rest, result } from 'underscore';
import Backbone from 'backbone';
import Radio from 'backbone.radio';
import EventRouter from 'backbone.eventrouter';
import App from './app';

export default App.extend({
  // Set in router apps for nav selection
  routerAppName: '',

  constructor: function() {
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

  // For each route in the hash creates a routeTriggers hash
  getRouteTriggers() {
    return reduce(this._routes, function(routeTriggers, { route, root }, eventName) {
      if (root) {
        routeTriggers[eventName] = route;
        return routeTriggers;
      }

      const currentWorkspace = Radio.request('workspace', 'current');
      const workspace = currentWorkspace.get('slug');
      routeTriggers[eventName] = route ? `${ workspace }/${ route }` : workspace;

      return routeTriggers;
    }, {});
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

    this.triggerMethod('before:appRoute', event, ...args);

    Radio.request('nav', 'select', this.routerAppName, event, args);
    Radio.request('sidebar', 'stop');

    this.setLatestList(event, args);

    this._currentRoute = {
      event,
      eventArgs: args,
    };

    if (!isFunction(action)) {
      action = this[action];
    }

    action.apply(this, args);

    this.triggerMethod('appRoute', event, ...args);
  },

  setLatestList(event, eventArgs) {
    if (this._routes[event].isList) {
      Radio.request('history', 'set:latestList', event, eventArgs);
      return;
    }

    if (!this._routes[event].clearLatestList) return;

    Radio.request('history', 'set:latestList', false);
  },

  // handler that ensures one running app
  startCurrent(appName, options) {
    this.stopCurrent();

    this._currentAppName = appName;
    this._currentAppOptions = options;

    options = extend({
      currentRoute: this._currentRoute,
    }, options);

    const app = this.startChildApp(appName, options);

    this._current = app;

    return app;
  },

  startRoute(appName, options) {
    if (this.isCurrent(appName, options)) {
      return this.getCurrent().startRoute(this.getCurrentRoute());
    }
    return this.startCurrent(appName, options);
  },

  getCurrent() {
    return this._current;
  },

  isCurrent(appName, options) {
    return (appName === this._currentAppName)
      && (isEqual(options, this._currentAppOptions));
  },

  getCurrentRoute() {
    return this._currentRoute;
  },

  stopCurrent() {
    if (!this._current) return;

    this._current.stop();
    this._current = null;
    this._currentAppName = null;
    this._currentAppOptions = null;
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
