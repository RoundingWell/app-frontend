import { Radio, Behavior } from 'marionette';

export default Behavior.extend({
  ui: {
    iframe: 'iframe',
  },
  onInitialize() {
    this.channel = Radio.channel(`form${ this.view.model.id }`);
  },
  replies: {
    send(message, args = {}, requestId) {
      const iframeWindow = this.getUI('iframe')[0].contentWindow;
      iframeWindow.postMessage({ message, args, requestId }, window.origin);
    },
    focus() {
      Radio.trigger('user-activity', 'iframe:focus', this.getUI('iframe')[0]);
    },
  },
  onAttach() {
    this.channel.reply(this.replies, this);

    this.messageHandler = event => {
      const { data, origin, source } = event;
      const iframeWindow = this.getUI('iframe')[0].contentWindow;
      /* istanbul ignore next: security check */
      if (origin !== window.origin || source !== iframeWindow || !data || !data.message) return;

      if (data.message === 'form:interact') {
        Radio.trigger('user-activity', 'iframe:focus', this.getUI('iframe')[0]);
      }

      this.channel.request(data.message, data.args, data.requestId);
    };

    window.addEventListener('message', this.messageHandler);
  },
  onBeforeDetach() {
    window.removeEventListener('message', this.messageHandler);
    this.channel.stopReplying(this.replies, this);
  },
});
