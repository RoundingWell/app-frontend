import { Behavior, Radio } from 'marionette';

import { getFocusableElements, trapFocus } from 'js/utils/accessibility/focus-trap';

export default Behavior.extend({
  events: {
    keydown: 'onKeydown',
  },
  onInitialize() {
    this.focusReturn = { element: document.activeElement };
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

    if (event.key === 'Escape' && Radio.request('close-request', 'close:top')) {
      event.preventDefault();
    }
  },
  onBeforeDestroy() {
    if (this.focusFrame != null) window.cancelAnimationFrame(this.focusFrame);
  },
  onDestroy() {
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
