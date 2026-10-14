import App from './app';
import { bindRouteApplication } from './routing/application-binding';

// Optional selection-only shorthand, also used by nonrouting owners such as
// AppFrame. Consumers can instead bind a plain Application in initialize.
export default App.extend({
  constructor: function() {
    this.routing = bindRouteApplication(this, {
      dispatchOnStart: false,
      onCleanupError: (error, child) => this.triggerMethod('child:cleanup:error', error, child),
    });
    App.apply(this, arguments);
  },
  getCurrent() {
    return this.routing.getCurrent();
  },
  getCurrentSelection() {
    return this.routing.getSelection();
  },
  invalidateSelection() {
    this.routing.invalidate();
  },
  selectChild(name, options) {
    return this.routing.select(name, options);
  },
  stopCurrent() {
    return this.routing.stopCurrent();
  },
});
