import { bind, delay as _delay, extend, result } from 'underscore';
import hbs from 'handlebars-inline-precompile';
import { animate } from 'animejs';
import { View } from 'marionette';

import './tooltip.scss';

const CLASS_OPTIONS = [
  'anchor',
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
];

export default View.extend({
  className: 'tooltip',
  constructor: function(options) {
    this.mergeOptions(options, CLASS_OPTIONS);
    this.setListeners();

    this.listenTo(this.uiView, 'before:render', () => this.destroy());
    this.listenTo(this.uiView, 'destroy', () => this.destroy());

    View.apply(this, arguments);
  },
  attributes() {
    return {
      ...(this.id && { id: this.id }),
      'role': 'tooltip',
    };
  },
  template: hbs`{{ message }}{{{ messageHtml }}}`,
  templateContext() {
    return {
      message: this.message,
      messageHtml: this.messageHtml,
    };
  },
  setListeners() {
    const ui = this.anchor;

    if (!ui) return;

    if (ui.on) {
      ui.on('pointerenter.tooltip', bind(this.showTooltip, this));
      ui.on('mouseleave.tooltip', bind(this.hideTooltip, this));
      ui.on('pointerdown.tooltip', bind(this.showTooltip, this));
      ui.on('focus.tooltip', bind(this.showTooltip, this));
      ui.on('blur.tooltip', bind(this.hideTooltip, this));
      return;
    }

    this._uiListeners = [
      ['pointerover', bind(this.onPointerOver, this)],
      ['mouseleave', bind(this.hideTooltip, this)],
      ['pointerdown', bind(this.showTooltip, this)],
      ['focus', bind(this.showTooltip, this)],
      ['blur', bind(this.hideTooltip, this)],
    ];

    this._uiListeners.forEach(([eventName, listener]) => {
      ui.addEventListener(eventName, listener);
    });
  },
  onPointerOver(event) {
    if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;

    this.showTooltip();
  },
  showTooltip() {
    clearTimeout(this.delayTimeout);

    const delay = result(this, 'delay');

    this.delayTimeout = _delay(bind(this.show, this), delay);
  },
  hideTooltip() {
    clearTimeout(this.delayTimeout);

    if (this.isShown()) {
      this.region.detachView();
    }
  },
  isShown() {
    return this.region?.currentView === this;
  },
  show() {
    const current = this.region.currentView;

    if (current && current !== this) {
      this.region.detachView();
    }

    this.region.show(this, this.regionOptions());

    return this;
  },
  onBeforeDestroy() {
    clearTimeout(this.delayTimeout);

    const ui = this.anchor;

    if (ui?.off) {
      ui.off('.tooltip');
    }

    this._uiListeners?.forEach(([eventName, listener]) => {
      ui.removeEventListener(eventName, listener);
    });
  },
  onAttach() {
    animate(this.el, {
      opacity: { to: 1, duration: 500 },
    });
  },
  /* istanbul ignore next */
  delay() {
    if (_TEST_) return 0;

    return this.shouldDelay ? 200 : 0;
  },
  position() {
    const ui = this.anchor;
    const el = ui?.[0] || (ui?.addEventListener ? ui : undefined);

    return this.uiView.getBounds(el);
  },
  regionOptions() {
    const orientation = result(this, 'orientation');
    const ignoreEl = result(this, 'ignoreEl');

    return extend({ orientation, ignoreEl }, result(this, 'position'));
  },
}, {
  setRegion(region) {
    this.prototype.region = region;
  },
});
