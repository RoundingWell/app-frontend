import { find, reject } from 'underscore';
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

  register(layer, close) {
    const current = find(this.layers, { layer });

    if (current) {
      current.close = close;
      return;
    }

    this.layers.push({ layer, close });
    this.syncWatcher();
  },

  unregister(layer) {
    const nextLayers = reject(this.layers, { layer });
    if (nextLayers.length === this.layers.length) return;

    this.layers = nextLayers;
    this.syncWatcher();
  },

  onHotkeyClose(event) {
    if (!this.requestClose()) return;
    event?.preventDefault();
  },

  requestClose() {
    if (this.isClosing) return false;

    this.isClosing = true;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.isClosing = false;
    }, 0);

    return this.closeTop();
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

    if (!this.CloseWatcher || !this.layers.length) return;

    const watcher = new this.CloseWatcher();
    this.watcher = watcher;
    watcher.addEventListener('close', () => {
      if (this.watcher === watcher) this.watcher = null;
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
