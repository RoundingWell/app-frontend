import Radio from 'backbone.radio';

import App from 'js/base/app';

export default App.extend({
  channelName: 'history',

  radioRequests: {
    'set:latestList': 'setLatestList',
    'has:latestList': 'hasLatestList',
    'go:latestList': 'goLatestList',
  },

  setLatestList(routeContext) {
    const { event, eventArgs, definition: { meta } } = routeContext;

    if (meta.isList) {
      this._setLatestList(event, eventArgs);
      return;
    }

    if (meta.clearLatestList) this._setLatestList(false);
  },

  _setLatestList(event,
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
