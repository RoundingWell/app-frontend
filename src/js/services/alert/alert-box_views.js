import { bind } from 'underscore';
import { animate } from 'animejs';
import { View, CollectionView } from 'marionette';

import AlertTemplate from './alert-box.hbs';

import './alert-box.scss';

const OPTIONS = ['alertType', 'text', 'html', 'hasUndo'];

const icons = {
  success: 'circle-check',
  info: 'circle-info',
  error: 'circle-xmark',
};

const AlertView = View.extend({
  className: 'alert-box',
  alertType: 'info',
  template: AlertTemplate,
  triggers: {
    'click .js-dismiss': 'click:dismiss',
    'click .js-undo': 'click:undo',
  },
  initialize(options) {
    this.mergeOptions(options, OPTIONS);
  },
  onRender() {
    this.$el.attr('role', this.alertType === 'error' ? 'alert' : 'status');
  },
  onAttach() {
    animate(this.el, {
      translateY: [-10, 0],
      opacity: [{ from: 0 }, { to: 1, duration: 900 }],
      ease: 'inOutQuad',
    });
  },
  onClickDismiss() {
    this.dismiss();
  },
  onClickUndo() {
    if (this.isDismissed) return;

    this._dismiss();

    this.triggerMethod('undo', this);
  },
  _dismiss() {
    this.isDismissed = true;

    animate(this.el, {
      opacity: [{ from: 1 }, { to: 0, duration: 800 }],
      ease: 'inSine',
      onComplete: bind(this.destroy, this),
    });
  },
  dismiss() {
    if (this.isDismissed) return;

    this._dismiss();

    this.triggerMethod('dismiss', this);
  },
  templateContext() {
    return {
      alertType: this.alertType,
      text: this.text,
      html: this.html,
      hasUndo: this.hasUndo,
      iconType: icons[this.alertType],
    };
  },
});

const AlertsView = CollectionView.extend({
  className: 'alert-box__container',
  onRemoveChild() {
    if (this.children.length) return;

    this.destroy();
  },
});

export { AlertView, AlertsView };
