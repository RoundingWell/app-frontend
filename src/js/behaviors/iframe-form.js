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

    $(window).on('message', ({ originalEvent }) => {
      const { data, origin } = originalEvent;
      /* istanbul ignore next: security check */
      if (origin !== window.origin || !data || !data.message) return;

      this.channel.request(data.message, data.args, data.requestId);
    });
  },
  onBeforeDetach() {
    $(window).off('message');
    this.channel.stopReplying(keys(this.replies).join(' '));
  },
});
