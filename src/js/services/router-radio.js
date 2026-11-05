import { contains, has, object } from 'underscore';
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

  navigate(name, params = {}, options) {
    if (router.hasRoute(name) && contains(router.getParamNames(name), 'workspace') && !has(params, 'workspace')) {
      params = { ...params, workspace: Radio.request('workspace', 'current').get('slug') };
    }
    return router.navigate(name, params, { focusReset: 'manual', scroll: 'manual', ...options }).finished;
  },

  back(fallback) {
    if (!router.canGoBack()) return fallback();

    return router.back();
  },

  // Radio remains synchronous; these events request named navigation.
  onEventRouter(name, ...args) {
    if (name === 'default') {
      this.navigate('root').catch(addError);
      return;
    }

    if (name.startsWith('workspace:')) {
      this.navigate('workspace', { workspace: name.substring('workspace:'.length) }).catch(addError);
      return;
    }

    if (!router.hasRoute(name)) return;

    const names = getPositionalParamNames(name);
    const extra = args[names.length];
    const options = name === 'worklist' ? { query: extra } : { info: { entryTarget: extra, status: name === 'unknownError' ? args[0] : undefined } };
    this.navigate(name, object(names, args.slice(0, names.length)), options).catch(addError);
  },
});
