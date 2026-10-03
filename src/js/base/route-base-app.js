import App from './app';

// Internal application-selection policy. URL matching, route scope comparisons,
// and error presentation belong to the caller; Marionette owns child teardown.
export default App.extend({
  constructor: function() {
    this._selectedChild = null;
    this._selectionIntent = null;

    App.apply(this, arguments);
  },

  getCurrent() {
    return this._selectedChild?.app || null;
  },

  getCurrentSelection() {
    return this._selectedChild;
  },

  invalidateSelection() {
    this._selectionIntent = null;
  },

  async selectChild(appName, { scope, reuse = false, start }) {
    const app = this.getChildApp(appName);
    if (!app) throw new Error(`Child application "${ appName }" is not registered`);

    const intent = {};
    this._selectionIntent = intent;

    if (!reuse) {
      this._stopSelectedChild();
      if (this._selectionIntent !== intent) return;
    }

    const selection = { app, appName, scope };
    this._selectedChild = selection;

    return this._activateSelectedChild(selection, intent, start);
  },

  async _activateSelectedChild({ app }, intent, start) {
    try {
      const started = await start(app);
      if (this._selectionIntent !== intent) return;

      if (!started) {
        // A superseding child restart may still own a live run. Retain it so
        // the next selection can stop it before activating another child.
        if (!app.isRunning()) this._cleanupSelectedChild(app);
        return;
      }

      return app;
    } catch(error) {
      if (this._selectionIntent !== intent) return;

      // Failed preparation can leave owned descendants running. Clean those
      // up before forgetting the selection; failed cleanup retains it.
      this._cleanupSelectedChild(app);
      throw error;
    }
  },

  _cleanupSelectedChild(app) {
    try {
      this._stopSelectedChild();
    } catch(error) {
      // Cleanup is observable independently; it must not replace the original
      // activation failure or turn canceled activation into a failure.
      this.triggerMethod('child:cleanup:error', error, app);
    }
  },

  stopCurrent() {
    this.invalidateSelection();
    return this._stopSelectedChild();
  },

  _stopSelectedChild() {
    const selection = this._selectedChild;
    if (!selection) return true;

    selection.app.stop();
    if (this._selectedChild === selection) this._selectedChild = null;
    return true;
  },

  // Invalidate even for an already-stopped owner: Marionette intentionally
  // permits explicit child activation beneath a stopped, nonterminal owner.
  stop() {
    this.invalidateSelection();
    return this._observeSelectionStop(App.prototype.stop.apply(this, arguments));
  },

  _observeSelectionStop(stopped) {
    // Already-stopped owners clean up descendants without emitting stop again.
    if (stopped && !this._selectionIntent) this._selectedChild = null;
    return stopped;
  },

  restart() {
    this.invalidateSelection();
    return App.prototype.restart.apply(this, arguments);
  },

  destroy() {
    this.invalidateSelection();
    return this._observeSelectionStop(App.prototype.destroy.apply(this, arguments));
  },
});
