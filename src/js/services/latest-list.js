import Radio from 'backbone.radio';

import App from 'js/base/app';

export default App.extend({
  channelName: 'history',

  radioRequests: {
    'apply:route': 'applyRoute',
    'set:latestList': 'setLatestList',
    'has:latestList': 'hasLatestList',
    'go:latestList': 'goLatestList',
  },

  applyRoute(routeContext) {
    const { event, eventArgs, definition: { meta } } = routeContext;

    if (meta.isList) {
      this.setLatestList(event, eventArgs);
      return;
    }

    if (meta.clearLatestList) this.setLatestList(false);
  },

  setLatestList(event,
    /* istanbul ignore next */
    eventArgs = []) {
    this._latestList = event;
    this._latestListArgs = eventArgs;
  },

  hasLatestList() {
    return !!this._latestList;
  },

  goLatestList() {
    /* istanbul ignore if */
    if (!this.hasLatestList()) return;
    Radio.trigger('event-router', this._latestList, ...this._latestListArgs);
  },
});
