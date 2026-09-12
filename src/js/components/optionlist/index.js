import { extend, result } from 'underscore';

import Picklist from 'js/components/picklist';

// NOTE: Use this if you do not intend to keep the selected state

const CLASS_OPTIONS = [
  'align',
  'anchor',
  'ignoreEl',
  'popWidth',
  'position',
  'uiView',
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
  show() {
    this.region.show(this, this.regionOptions());
  },
  position() {
    return this.uiView.getBounds(this.anchor);
  },
  regionOptions() {
    return extend({
      ignoreEl: this.ignoreEl || this.anchor[0],
      popWidth: this.popWidth,
      align: this.align,
    }, result(this, 'position'));
  },
  onClose() {
    this.destroy();
  },
  onPicklistItemSelect({ model }) {
    if (model.get('isDisabled')) return;

    this.trigger('select', model);

    this.destroy();
  },
}, {
  setRegion(region) {
    this.prototype.region = region;
  },
});
