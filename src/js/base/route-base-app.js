import App from './app';

// Internal application-selection policy. URL matching, route scope comparisons,
// and error presentation belong to the caller; Marionette owns child teardown.
export default App.extend({
  constructor: function() {
    this._selectedChild = null;
    this._selectionIntent = null;
    this._stoppingChild = null;
    this.on('stop', () => {
      this._selectedChild = null;
    });

    App.apply(this, arguments);
  },

  getCurrent() {
    return this._selectedChild?.app || null;
  },

  getCurrentSelection() {
    // A child being retired cannot be reused by a new selection.
    return this._stoppingChild ? null : this._selectedChild;
  },

  invalidateSelection() {
    this._selectionIntent = null;
  },

  async selectChild(appName, { scope, reuse = false, start }) {
    const app = this.getChildApp(appName);
    if (!app) throw new Error(`Child application "${ appName }" is not registered`);

    const intent = {};
    this._selectionIntent = intent;

    if (!reuse || this._stoppingChild) {
      const stopped = await this._stopSelectedChild();
      if (!stopped || this._selectionIntent !== intent) return;
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
        if (!app.isRunning()) await this._stopSelectedChild();
        return;
      }

      return app;
    } catch(error) {
      if (this._selectionIntent !== intent) return;

      // Failed preparation can leave owned descendants running. Clean those
      // up before forgetting the selection; rejected cleanup retains it.
      await this._stopSelectedChild();
      throw error;
    }
  },

  stopCurrent() {
    this.invalidateSelection();
    return this._stopSelectedChild();
  },

  _stopSelectedChild() {
    if (this._stoppingChild) return this._stoppingChild;
    const selection = this._selectedChild;
    if (!selection) return Promise.resolve(true);

    const stopping = Promise.resolve().then(() => selection.app.stop())
      .then(stopped => {
        if (stopped && this._selectedChild === selection) this._selectedChild = null;
        return stopped;
      })
      .finally(() => {
        if (this._stoppingChild === stopping) this._stoppingChild = null;
      });

    this._stoppingChild = stopping;
    return stopping;
  },

  // Invalidate even for an already-stopped owner: Marionette intentionally
  // permits explicit child activation beneath a stopped, nonterminal owner.
  stop() {
    this.invalidateSelection();
    return this._observeSelectionStop(App.prototype.stop.apply(this, arguments));
  },

  _observeSelectionStop(operation) {
    // Already-stopped owners clean up descendants without emitting stop again.
    // Preserve Marionette's shared operation promise and any newer selection.
    operation.then(stopped => {
      if (stopped && !this._selectionIntent) this._selectedChild = null;
    }, () => {});
    return operation;
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
