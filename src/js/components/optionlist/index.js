import { extend, result } from 'underscore';

import Picklist from 'js/components/picklist';

// NOTE: Use this if you do not intend to keep the selected state

const CLASS_OPTIONS = [
  'align',
  'ignoreEl',
  'popWidth',
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
    }, result(this, 'position'));
  },
  onClose() {
    this.destroy();
  },
  onPicklistSelect({ model }) {
    if (model.get('isDisabled')) return;

    this.triggerMethod('select', model);

    this.destroy();
  },
});
