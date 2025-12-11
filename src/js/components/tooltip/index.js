import { bind, delay as _delay, extend, result } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { animate } from 'animejs';
import { View } from 'marionette';

import Component from 'js/base/component';

import './tooltip.scss';

const CLASS_OPTIONS = [
  'className',
  'delay',
  'ignoreEl',
  'message',
  'messageHtml',
  'orientation',
  'position',
  'shouldShowOnClick',
  'uiView',
  'ui',
];

const TooltipView = View.extend({
  template: hbs`{{ message }}{{{ messageHtml }}}`,
  templateContext() {
    return {
      message: this.getOption('message'),
      messageHtml: this.getOption('messageHtml'),
    };
  },
});

export default Component.extend({
  ViewClass: TooltipView,
  className: 'tooltip',
  delay: /* istanbul ignore next: Branch only for testing */ _TEST_ ? 0 : 200,
  shouldShowOnClick: true,
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);

    this.setListeners();

    this.listenTo(this.uiView, 'render destroy', this.destroy);

    Component.apply(this, arguments);
  },
  setListeners() {
    if (!this.ui) return;

    this.ui.on('pointerenter.tooltip', bind(this.showTooltip, this));

    this.ui.on('mouseleave.tooltip', bind(this.hideTooltip, this));

    const shouldShowOnClick = result(this, 'shouldShowOnClick');

    if (shouldShowOnClick) {
      this.ui.on('pointerdown.tooltip', bind(this.showTooltip, this));
    }
  },
  showTooltip() {
    clearTimeout(this.delayTimeout);

    const delay = result(this, 'delay');

    this.delayTimeout = _delay(bind(this.show, this), delay);
  },
  hideTooltip() {
    clearTimeout(this.delayTimeout);

    this.empty();
  },
  onBeforeDestroy() {
    clearTimeout(this.delayTimeout);
  },
  onShow() {
    animate(this.getView().el, {
      opacity: { to: 1, duration: 500 },
    });
  },
  viewOptions() {
    return {
      className: result(this, 'className'),
      message: result(this, 'message'),
      messageHtml: result(this, 'messageHtml'),
    };
  },
  position() {
    return this.uiView.getBounds(this.ui);
  },
  regionOptions() {
    const orientation = result(this, 'orientation');
    const ignoreEl = result(this, 'ignoreEl');
    return extend({ orientation, ignoreEl }, result(this, 'position'));
  },
});
