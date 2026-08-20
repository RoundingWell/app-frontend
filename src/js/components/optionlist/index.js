import { defer, extend, result } from 'underscore';

import { getAdjacentFocusableElement } from 'js/utils/accessibility/focus-trap';

import Picklist from 'js/components/picklist';

// NOTE: Use this if you do not intend to keep the selected state

const CLASS_OPTIONS = [
  'align',
  'ignoreEl',
  'popWidth',
  'presentation',
  'position',
  'uiView',
  'ui',
];

const attr = 'text';
const align = 'left';
const popWidth = null;

export default Picklist.extend({
  attr,
  align,
  popWidth,
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);
    this.focusEl = this.ui && this.ui[0] ? this.ui[0] : this.uiView.el;

    this.listenTo(this.uiView, 'render destroy', this.destroy);

    Picklist.apply(this, arguments);
  },
  viewTriggers: {
    'close': 'close',
  },
  viewEvents: {
    'watch:change': 'onWatchChange',
    'picklist:item:select': 'onPicklistSelect',
  },
  position() {
    return this.uiView.getBounds(this.ui);
  },
  regionOptions() {
    return extend({
      ignoreEl: this.ignoreEl || this.ui[0],
      popWidth: this.popWidth,
      align: this.align,
      presentation: this.presentation || (this.isSelectlist ? 'fullscreen' : 'anchored'),
    }, result(this, 'position'));
  },
  onClose(dismissal) {
    this.restoreFocusOnDestroy = dismissal?.reason !== 'tab';
    if (!this.restoreFocusOnDestroy) {
      this.focusAfterDestroy = getAdjacentFocusableElement(this.focusEl, {
        exclude: this.getView().el,
        reverse: dismissal.reverse,
      });
    }

    this.destroy();
  },
  onPicklistSelect({ model }) {
    if (model.get('isDisabled')) return;

    this.triggerMethod('select', model);

    this.destroy();
  },
  onDestroy() {
    const focusEl = this.focusEl;
    const focusAfterDestroy = this.focusAfterDestroy;
    if (this.restoreFocusOnDestroy === false && !focusAfterDestroy) return;

    defer(() => {
      if (focusAfterDestroy?.isConnected) {
        focusAfterDestroy.focus();
        return;
      }

      if (!focusEl || !focusEl.isConnected || focusEl.disabled) return;

      focusEl.focus();
    });
  },
});
