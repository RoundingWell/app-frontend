import { bind, delay as _delay, extend, result } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { animate } from 'animejs';
import { View } from 'marionette';

import Component from 'js/base/component';

import './tooltip.scss';

const CLASS_OPTIONS = [
  'className',
  'delay',
  'id',
  'ignoreEl',
  'message',
  'messageHtml',
  'orientation',
  'position',
  'shouldDelay',
  'uiView',
  'ui',
];
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const TooltipView = View.extend({
  attributes() {
    const id = this.getOption('id');

    return {
      ...(id && { id }),
      'role': 'tooltip',
    };
  },
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
  /* istanbul ignore next */
  delay(event) {
    if (_TEST_) return 0;

    return this.shouldDelay && event && event.type === 'pointerenter' ? 200 : 0;
  },
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

    this.ui.on('pointerdown.tooltip', bind(this.showTooltip, this));

    this.ui.on('focus.tooltip', bind(this.showTooltip, this));

    this.ui.on('blur.tooltip', bind(this.hideTooltip, this));

    this.ui.on('keydown.tooltip', bind(this.onKeydown, this));
  },
  showTooltip(event) {
    clearTimeout(this.delayTimeout);

    const delay = this.delay(event);

    this.delayTimeout = _delay(bind(this.show, this), delay);
  },
  onKeydown(event) {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    this.hideTooltip();
  },
  hideTooltip() {
    clearTimeout(this.delayTimeout);

    this.empty();
  },
  onBeforeDestroy() {
    clearTimeout(this.delayTimeout);
  },
  onShow() {
    const prefersReducedMotion = window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches;

    animate(this.getView().el, {
      opacity: { to: 1, duration: prefersReducedMotion ? 0 : 150 },
    });
  },
  viewOptions() {
    return {
      className: result(this, 'className'),
      id: result(this, 'id'),
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
