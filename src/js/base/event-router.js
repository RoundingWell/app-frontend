import {
  bind,
  drop,
  each,
  extend,
  isArray,
  isEqual,
  isFunction,
  isRegExp,
  pick,
  reject,
  result,
  uniqueId,
} from 'underscore';
import Backbone from 'backbone';

import { translateRoute } from './routing/route-table.js';

export default Backbone.Router.extend({
  constructor: function(options = {}) {
    extend(this, pick(options, ['channel', 'routeTriggers', 'history']));

    this.history = this.history || Backbone.history;
    this.cid = uniqueId('eventrouter');
    this._ch = this.channel;
    this._routeArgs = [];

    this.listenTo(this._ch, 'all', this.navigateFromEvent);

    Backbone.Router.apply(this, arguments);
    this._initRoutes();
  },

  getChannel() {
    return this._ch;
  },

  _initRoutes() {
    this._routeTriggers = result(this, 'routeTriggers', {});
    each(this._routeTriggers, this._addRouteTrigger, this);
  },

  _addRouteTrigger(routes, event) {
    routes = isArray(routes) ? routes : [routes];

    each(routes, route => {
      this.route(route, event, bind(this._ch.trigger, this._ch, event));
    });
  },

  // Backbone's route semantics, borrowing the explicitly supplied history owner.
  route(route, name, callback) {
    const pattern = isRegExp(route) ? route : this._routeToRegExp(route);
    if (isFunction(name)) {
      callback = name;
      name = '';
    }
    callback = callback || this[name];
    this.history.route(pattern, fragment => {
      const args = this._extractParameters(pattern, fragment);
      this._routeArgs.push([name, ...args]);
      let executed;
      try {
        executed = this.execute(callback, args, name);
      } finally {
        this._routeArgs.pop();
      }
      if (executed === false) return;
      this.trigger(`route:${ name }`, ...args);
      this.trigger('route', name, args);
      this.history.trigger('route', this, name, args);
    });
    this.history.handlers[0].cid = this.cid;
    return this;
  },

  navigate(fragment, options) {
    this.history.navigate(fragment, options);
    return this;
  },

  navigateFromEvent(event) {
    const route = this.getDefaultRoute(event);
    const eventArgs = drop(arguments, 0);

    if (!route) {
      this.trigger.apply(this, ['noMatch', ...eventArgs]);
      return this;
    }

    if (isEqual(eventArgs, this._routeArgs.at(-1))) return this;

    return this.navigate(this.translateRoute(route, drop(eventArgs, 1)), { trigger: false });
  },

  getDefaultRoute(event) {
    const routes = this._routeTriggers[event];

    return isArray(routes) ? routes[0] : routes;
  },

  translateRoute(route, eventArgs) {
    return translateRoute(route, eventArgs);
  },

  destroy() {
    this.history.handlers = reject(this.history.handlers, { cid: this.cid });
    this.stopListening();
    this.trigger('destroy', this);
    return this;
  },
});
