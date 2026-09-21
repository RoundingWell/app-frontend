import { extend, pick, result } from 'underscore';
import Backbone from 'backbone';

import App from './app';

export default App.extend({
  constructor: function() {
    this._current = null;
    this._currentClaim = null;
    this._stoppingCurrent = null;
    this._runId = 0;
    this._routeIntent = null;

    this.on('stop', this._clearCurrent);
    this.on('start', () => this._runId++);
    this.on('before:stop', this._clearRouteIntent);

    App.apply(this, arguments);
  },

  createState() {
    return new Backbone.Model({ currentRoute: null });
  },

  // declarative scope identity used by a parent RouterApp to decide reuse;
  // without a declared routeScope, fall back to full-option identity
  getRouteScope(options = {}) {
    const scope = result(this, 'routeScope');
    return scope ? pick(options, scope) : options;
  },

  setCurrentRoute(routeContext) {
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

    action.apply(this, eventArgs);

    this.triggerMethod('startRoute', currentRoute);
  },

  mixinOptions(options) {
    const appOptions = result(this, 'currentAppOptions');

    return extend({}, appOptions, options);
  },

  // handler that ensures one running app per type
  async startCurrent(appName, options) {
    const app = this.getChildApp(appName);
    if (!app) throw new Error(`Child application "${ appName }" is not registered`);

    const routeContext = this.getCurrentRoute();
    const stopping = this.stopCurrent();
    const claim = {};

    this._currentClaim = claim;

    await stopping;

    if (!this._isCurrentClaim(claim, routeContext)) return;

    this._current = app;

    try {
      const started = await app.start(this.mixinOptions(options));

      if (!started) {
        this._clearCurrentClaim(claim);
        return;
      }

      return this._isCurrentClaim(claim, routeContext) && app === this.getCurrent() ? app : undefined;
    } catch(error) {
      this._clearCurrentClaim(claim);

      throw error;
    }
  },

  _isCurrentClaim(claim, routeContext) {
    return this._currentClaim === claim && this.getCurrentRoute() === routeContext;
  },

  _clearCurrentClaim(claim) {
    if (this._currentClaim === claim) this._clearCurrent();
  },

  getCurrent() {
    return this._current;
  },

  stopCurrent() {
    if (!this._current) return this._stoppingCurrent || undefined;

    const current = this._current;

    this._clearCurrent();

    const stopping = Promise.resolve(current.stop()).finally(() => {
      if (this._stoppingCurrent === stopping) this._stoppingCurrent = null;
    });

    this._stoppingCurrent = stopping;

    return stopping;
  },

  _clearCurrent() {
    this._current = null;
    this._currentClaim = null;
  },

  _clearRouteIntent() {
    this._routeIntent = null;
  },
});
