import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import DialerButtonView from 'js/apps/patients/shared/components/dialer_view.js';

import './action.scss';

const DialerView = View.extend({
  template: hbs`<div data-dialer-button-region></div>`,
  regions: {
    dialerButton: '[data-dialer-button-region]',
  },
  modelEvents: {
    'change:_state': 'render',
  },
  onRender() {
    this.showDialerButton();
  },
  showDialerButton() {
    const isDisabled = this.model.isDone() || !this.getOption('canEdit');

    const dialerButtonView = new DialerButtonView({
      action: this.model,
      isDisabled,
    });

    this.showChildView('dialerButton', dialerButtonView);
  },
});

export {
  DialerView,
};
