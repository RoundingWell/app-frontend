import Backbone from 'backbone';

import App from 'js/base/app';

export default App.extend({
  channelName: 'history',
  radioRequests: {
    'go:back': 'goBack',
  },
  initialize() {
    const navigate = Backbone.history.navigate;
    this._prevHistory = [Backbone.history.getFragment()];

    // Patch Backbone history navigate to track history
    Backbone.history.navigate = (route, options) => {
      const navigated = navigate.call(Backbone.history, route, options);

      /* istanbul ignore next: supports backbone.navigate api, but likely unused */
      if (navigated === false) return false;

      this.setPrevious(route, options);

      this.triggerChange();

      return navigated;
    };

    window.addEventListener('popstate', () => {
      const fragment = Backbone.history.getFragment();

      // If the current url will be at the top of the stack, assume back button
      if (fragment === this._prevHistory.at(1)) {
        this._prevHistory.shift();
      } else {
        this._prevHistory.unshift(fragment);
      }

      this.triggerChange();
    });
  },
  setPrevious(route, { replace }) {
    if (replace) {
      this._prevHistory[0] = route;
      return;
    }

    this._prevHistory.unshift(route);
  },
  triggerChange() {
    this.getChannel().trigger('change:route', this._prevHistory[0]);
  },
  goBack(handleEmptyHistory) {
    if (this._prevHistory.length < 2) {
      handleEmptyHistory();
      return;
    }

    // Remove the current route from the stack
    this._prevHistory.shift();

    // Navigate to the previous route
    Backbone.history.navigate(this._prevHistory.shift(), { trigger: true });
  },
});
