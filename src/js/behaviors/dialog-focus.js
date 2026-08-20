import Radio from 'backbone.radio';
import { Behavior } from 'marionette';

import { getFocusableElements, trapFocus } from 'js/utils/accessibility/focus-trap';

export default Behavior.extend({
  events: {
    keydown: 'onKeydown',
  },
  initialize() {
    const focusedElement = document.activeElement;
    this.focusReturn = Radio.request('nav', 'capture:focus:return', focusedElement) || {
      element: focusedElement,
    };
  },
  onAttach() {
    this.focusFrame = window.requestAnimationFrame(() => {
      if (this.el.contains(document.activeElement)) return;

      const autofocusTarget = this.el.querySelector('[autofocus]');
      const focusTarget = (autofocusTarget?.getClientRects().length && autofocusTarget)
        || getFocusableElements(this.el)[0]
        || this.el;

      focusTarget.focus();
    });
  },
  onKeydown(event) {
    trapFocus(event, this.el);
  },
  onBeforeDestroy() {
    if (this.focusFrame != null) window.cancelAnimationFrame(this.focusFrame);
  },
  onDestroy() {
    if (this.focusFrame != null) window.cancelAnimationFrame(this.focusFrame);

    window.requestAnimationFrame(() => {
      const { element, restore } = this.focusReturn;
      if (!element?.isConnected) return;

      if (restore) {
        restore();
        return;
      }

      element.focus();
    });
  },
});
