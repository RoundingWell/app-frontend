import { bind, isArray, some } from 'underscore';
import { Radio, Behavior } from 'marionette';

export default Behavior.extend({
  initialize() {
    this.listenTo(Radio.channel('user-activity'), 'document:keydown', this.keydown);
  },

  keyEvents: {},

  triggerEvent(event, domEvent, keyCode) {
    if (domEvent.which === keyCode) {
      this.view.triggerMethod(event, domEvent);

      return true;
    }
  },

  keydown(domEvent) {
    some(this.getOption('keyEvents'), (keyCode, event) => {
      if (!isArray(keyCode)) {
        this.triggerEvent(event, domEvent, keyCode);
        return;
      }

      return some(keyCode, bind(this.triggerEvent, this, event, domEvent));
    });
  },
});
