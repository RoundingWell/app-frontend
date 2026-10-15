import { object } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import router, { getPositionalParamNames } from 'js/router';

export default App.extend({
  channelName: 'router',

  radioRequests: {
    navigate: 'navigate',
    back: 'back',
  },

  initialize() {
    this.listenTo(Radio.channel('event-router'), 'all', this.onEventRouter);
  },

  navigate(...args) {
    return router.navigate(...args).finished;
  },

  back(fallback) {
    if (!router.canGoBack) return fallback();

    return router.back();
  },

  // A trigger on 'event-router' only requests navigation. Names that are not
  // routes, such as notFound and unknownError, are handled by their listeners.
  onEventRouter(name, ...args) {
    if (name === 'default') {
      this.navigate('root').catch(addError);
      return;
    }

    if (!router.hasRoute(name)) return;

    this.navigate(name, object(getPositionalParamNames(name), args)).catch(addError);
  },
});
