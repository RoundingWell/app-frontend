import $ from 'jquery';
import { keys } from 'underscore';
import Radio from 'backbone.radio';
import { Behavior } from 'marionette';

export default Behavior.extend({
  ui: {
    iframe: 'iframe',
  },
  onInitialize() {
    this.channel = Radio.channel(`form${ this.view.model.id }`);
  },
  replies: {
    send(message, args = {}, requestId) {
      const iframeWindow = this.ui.iframe[0].contentWindow;
      iframeWindow.postMessage({ message, args, requestId }, window.origin);
    },
    focus() {
      Radio.trigger('user-activity', 'iframe:focus', this.ui.iframe[0]);
    },
  },
  onAttach() {
    this.channel.reply(this.replies, this);

    this.messageHandler = ({ originalEvent }) => {
      const { data, origin } = originalEvent;
      const iframeWindow = this.ui.iframe[0].contentWindow;
      /* istanbul ignore next: security check */
      if (origin !== window.origin || originalEvent.source !== iframeWindow || !data || !data.message) return;

      if (data.message === 'form:interact') {
        Radio.trigger('user-activity', 'iframe:focus', this.ui.iframe[0]);
      }

      this.channel.request(data.message, data.args, data.requestId);
    };

    $(window).on('message', this.messageHandler);
  },
  onBeforeDetach() {
    $(window).off('message', this.messageHandler);
    this.channel.stopReplying(keys(this.replies).join(' '));
  },
});
