import { Behavior, Radio } from 'marionette';

import { isTextInput, hasHotkeyModifier } from 'js/utils/user-activity';

import { getFocusableElements, trapFocus } from 'js/utils/accessibility/focus-trap';

export default Behavior.extend({
  events: {
    keydown: 'onKeydown',
  },
  onAttach() {
    this.focusFrame = window.requestAnimationFrame(() => {
      if (this.el.contains(document.activeElement)) return;

      const autofocusTarget = this.el.querySelector('[autofocus]');
      autofocusTarget?.focus();
      if (this.el.contains(document.activeElement)) return;

      const focusTarget = getFocusableElements(this.el)[0] || this.el;

      focusTarget.focus();
    });
  },
  onKeydown(event) {
    trapFocus(event, this.el);

    if (event.key !== 'Escape' || event.defaultPrevented) return;

    if (isTextInput(event.target) || hasHotkeyModifier(event)) {
      event.preventDefault();
      return;
    }

    if (Radio.request('close-request', 'close:top')) {
      event.preventDefault();
    }
  },
  onBeforeDestroy() {
    if (this.focusFrame != null) window.cancelAnimationFrame(this.focusFrame);
  },
});
