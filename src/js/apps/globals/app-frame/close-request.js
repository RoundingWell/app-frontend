import { reject, sortBy } from 'underscore';
import { MnObject, Radio } from 'marionette';

export default MnObject.extend({
  channelName: 'close-request',
  radioRequests: {
    'close:top': 'requestClose',
    'register': 'register',
    'unregister': 'unregister',
  },
  initialize({ CloseWatcher = window.CloseWatcher } = {}) {
    this.CloseWatcher = CloseWatcher;
    this.layers = [];
    this.listenTo(Radio.channel('hotkey'), 'close', this.onHotkeyClose);
  },

  register(layer, close, priority = 0) {
    this.layers.push({ layer, close, priority });
    this.layers = sortBy(this.layers, 'priority');
    this.syncWatcher();
  },

  unregister(layer) {
    const nextLayers = reject(this.layers, { layer });
    if (nextLayers.length === this.layers.length) return;

    this.layers = nextLayers;
    this.deferWatcher();
    this.syncWatcher();
  },

  onHotkeyClose(event) {
    if (!this.requestClose()) return;
    event?.preventDefault();
  },

  requestClose() {
    if (this.closeTimer != null) return false;

    this.deferWatcher();
    return this.closeTop();
  },

  deferWatcher() {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.syncWatcher();
    }, 0);
  },

  closeTop() {
    const top = this.layers.at(-1);
    if (!top) return false;

    top.close();
    return true;
  },

  syncWatcher() {
    this.watcher?.destroy();
    this.watcher = null;

    if (this.closeTimer != null || !this.CloseWatcher || !this.layers.length) return;

    const watcher = new this.CloseWatcher();
    this.watcher = watcher;
    watcher.addEventListener('close', () => {
      this.watcher = null;
      this.requestClose();
    }, { once: true });
  },

  onBeforeDestroy() {
    clearTimeout(this.closeTimer);
    this.watcher?.destroy();
    this.watcher = null;
    this.layers = [];
  },
});
