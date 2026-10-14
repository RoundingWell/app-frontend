import App from './app';
import { createChildSelection } from './routing/child-selection';

// Optional Application adapter; selection is also usable by plain Applications.
export default App.extend({
  constructor: function() {
    this.selection = createChildSelection({
      getChild: name => this.getChildApp(name),
      onCleanupError: (error, app) => this.triggerMethod('child:cleanup:error', error, app),
    });
    App.apply(this, arguments);
  },
  getCurrent() {
    return this.selection.getCurrent();
  },
  getCurrentSelection() {
    return this.selection.getSelection();
  },
  invalidateSelection() {
    this.selection.invalidate();
  },
  selectChild(appName, options) {
    return this.selection.select(appName, options);
  },
  stopCurrent() {
    return this.selection.stop();
  },
  // Public overrides are required for already-stopped owners, which do not emit
  // stop again. Mandatory invalidation cannot depend on subclass lifecycle hooks.
  stop() {
    this.invalidateSelection();
    const stopped = App.prototype.stop.apply(this, arguments);
    if (stopped) this.selection.clear();
    return stopped;
  },
  restart() {
    this.invalidateSelection();
    return App.prototype.restart.apply(this, arguments);
  },
  destroy() {
    this.invalidateSelection();
    const destroyed = App.prototype.destroy.apply(this, arguments);
    if (destroyed) this.selection.clear();
    return destroyed;
  },
});
