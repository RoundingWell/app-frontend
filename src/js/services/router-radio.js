import { contains, has, object } from 'underscore';
import { Radio } from 'marionette';

import { addError } from 'js/datadog';

import App from 'js/base/app';

import router, { eventNavigationReport, getPositionalParamNames } from 'js/router';

export default App.extend({
  channelName: 'router',

  radioRequests: {
    'navigate': 'navigate',
    'navigate:event': 'navigateEvent',
  },

  initialize() {
    this.listenTo(Radio.channel('event-router'), 'all', this.onEventRouter);
  },

  navigate(name, params = {}, options) {
    if (router.hasRoute(name) && contains(router.getParamNames(name), 'workspace') && !has(params, 'workspace')) {
      params = {
        ...params,
        workspace: Radio.request('workspace', 'current').get('slug'),
      };
    }
    return router.navigate(name, params, {
      focusReset: 'manual',
      scroll: 'manual',
      ...options,
    }).finished;
  },

  navigateEvent(name, params, options) {
    const report = {};
    const info = {
      ...options?.info,
      [eventNavigationReport]: report,
    };
    let finished;
    try {
      finished = this.navigate(name, params, {
        ...options,
        info,
      });
    } catch(error) {
      delete info[eventNavigationReport];
      throw error;
    }
    return finished.catch(error => {
      if (!report.handled || !Object.is(report.handled.error, error)) addError(error);
    }).finally(() => delete info[eventNavigationReport]);
  },

  // Radio remains synchronous; these events request named navigation.
  onEventRouter(name, ...args) {
    if (name === 'default') {
      this.navigateEvent('root');
      return;
    }

    if (name.startsWith('workspace:')) {
      this.navigateEvent('workspace', {
        workspace: name.substring('workspace:'.length),
      });
      return;
    }

    if (!router.hasRoute(name)) return;

    const names = getPositionalParamNames(name);
    const extra = args[names.length];
    const options = name === 'worklist' ?
      {
        info: {
          worklist: extra,
        },
      } :
      {
        info: {
          entryTarget: extra,
          status: name === 'unknownError' ? args[0] : undefined,
        },
      };
    if (name === 'notFound') options.history = 'replace';
    this.navigateEvent(name, object(names, args.slice(0, names.length)), options);
  },
});
