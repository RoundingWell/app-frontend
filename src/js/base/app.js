import { bind, isArray, noop, uniqueId } from 'underscore';
import { App } from 'marionette.toolkit';

import handleErrors from 'js/utils/handle-errors';

export default App.extend({
  triggerStart(options) {
    this._isLoading = true;

    this._fetchId = uniqueId('fetch');
    const triggerSyncData = bind(this.triggerMethod, this, 'sync:data', this._fetchId, options);
    const triggerFail = bind(this.triggerSyncFail, this, this._fetchId, options);
    const promise = this.beforeStart(options);

    if (!promise) {
      triggerSyncData();
      return;
    }

    Promise.all(isArray(promise) ? promise : [promise])
      .then(triggerSyncData)
      .catch(triggerFail);
  },
  beforeStart: noop,
  onSyncData(fetchId, options, args = []) {
    if (!this._isRunning || this._fetchId !== fetchId) return;

    this._isLoading = false;

    this.finallyStart.call(this, options, ...args);
  },
  triggerSyncFail(fetchId, options, ...args) {
    if (!this._isRunning || this._fetchId !== fetchId) return;

    this._isLoading = false;

    this.triggerMethod('fail', options, ...args);
  },
  onFail(options, error) {
    handleErrors(error);
  },
  isRunning() {
    return this._isRunning && !this.isLoading();
  },
  _isLoading: false,
  isLoading() {
    return this._isLoading;
  },
});
