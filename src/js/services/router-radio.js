import { find, object, without } from 'underscore';
import { Radio } from 'marionette';

import App from 'js/base/app';

import router from 'js/router';

// Radio names that render in place instead of navigating
const IN_PLACE_EVENTS = ['notFound', 'unknownError'];

export default App.extend({
  channelName: 'router',

  radioRequests: {
    mount: 'mountRouterApp',
    navigate: 'navigate',
    back: 'back',
  },

  initialize() {
    this.routerApps = [];

    this.listenTo(Radio.channel('event-router'), 'all', this.onEventRouter);
    this.listenTo(router, 'route', this.onRoute);
  },

  mountRouterApp(app) {
    this.routerApps.push(app);

    const unmount = router.mount(app.getRouteDefinitions());

    return () => {
      unmount();
      this.routerApps = without(this.routerApps, app);
    };
  },

  navigate(...args) {
    return router.navigate(...args).finished;
  },

  back(fallback) {
    if (!router.canGoBack) return fallback();

    return router.back();
  },

  // A trigger on 'event-router' only requests navigation. RouterApps are
  // dispatched from the router's `route` event.
  onEventRouter(name, ...args) {
    if (name === 'default') {
      this.navigate('root');
      return;
    }

    if (IN_PLACE_EVENTS.includes(name)) {
      this.dispatch(name, args);
      return;
    }

    // A workspace switch unmounts area routes until the new workspace loads
    if (!router.hasRoute(name)) return;

    const paramNames = router.getParamNames(name);

    this.navigate(name, object(paramNames, args), { info: { args: args.slice(paramNames.length) } });
  },

  onRoute({ name, params, info }) {
    const paramNames = IN_PLACE_EVENTS.includes(name) ? [] : router.getParamNames(name);
    const args = paramNames.map(paramName => params[paramName]);

    this.dispatch(name, [...args, ...(info?.args || [])]);
  },

  dispatch(name, args) {
    const owner = find(this.routerApps, app => app.hasRoute(name));

    for (const app of without(this.routerApps, owner)) app.triggerMethod('no:match');

    owner.routeEvent(name, ...args);
  },
});
