import Radio from 'backbone.radio';

export default class CloseRequestManager {
  constructor({ CloseWatcher = window.CloseWatcher } = {}) {
    this.CloseWatcher = CloseWatcher;
    this.layers = [];
    this.channel = Radio.channel('close-request');
    this.channel.reply('close:top', this.closeTop, this);
    this.channel.reply('register', this.register, this);
    this.channel.reply('unregister', this.unregister, this);
    Radio.channel('hotkey').on('close', this.onHotkeyClose, this);
  }

  register(layer, close) {
    this.unregister(layer);
    this.layers.push({ layer, close });
    this.syncWatcher();
  }

  unregister(layer) {
    const nextLayers = this.layers.filter(item => item.layer !== layer);
    if (nextLayers.length === this.layers.length) return;

    this.layers = nextLayers;
    this.syncWatcher();
  }

  onHotkeyClose(event) {
    if (!this.closeTop()) return;
    event?.preventDefault();
  }

  closeTop() {
    const top = this.layers.at(-1);
    if (!top) return false;

    top.close();
    return true;
  }

  syncWatcher() {
    this.watcher?.destroy();
    this.watcher = null;

    if (!this.CloseWatcher || !this.layers.length) return;

    const watcher = new this.CloseWatcher();
    this.watcher = watcher;
    watcher.addEventListener('close', () => {
      if (this.watcher === watcher) this.watcher = null;
      this.closeTop();
    }, { once: true });
  }

  destroy() {
    this.watcher?.destroy();
    this.watcher = null;
    this.layers = [];
    this.channel.stopReplying(null, null, this);
    Radio.channel('hotkey').off('close', this.onHotkeyClose, this);
  }
}
