import {
  bind,
  drop,
  each,
  extend,
  isArray,
  isEqual,
  pick,
  reduce,
  reject,
  result,
  uniqueId,
} from 'underscore';
import Backbone from 'backbone';

const namedParamRegex = /(\(\?)?:\w+/;

export default Backbone.Router.extend({
  constructor: function(options = {}) {
    extend(this, pick(options, ['channel', 'routeTriggers']));

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

  route(route, name, callback) {
    const addRoute = Backbone.Router.prototype.route;

    const wrappedCallback = bind(function() {
      const args = drop(arguments, 0);

      this._routeArgs.push([name, ...args]);

      try {
        callback.apply(this, args);
      } finally {
        this._routeArgs.pop();
      }
    }, this);

    const router = addRoute.call(this, route, name, wrappedCallback);

    Backbone.history.handlers[0].cid = this.cid;
    return router;
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
    return reduce(eventArgs, (translatedRoute, arg) => {
      return translatedRoute.replace(namedParamRegex, arg);
    }, route);
  },

  destroy() {
    Backbone.history.handlers = reject(Backbone.history.handlers, { cid: this.cid });
    this.stopListening();
    this.trigger('destroy', this);
    return this;
  },
});
