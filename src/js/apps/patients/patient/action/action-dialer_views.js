import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import DialerComponent from 'js/apps/patients/shared/components/dialer_component.js';

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

    const dialerComponent = new DialerComponent({
      action: this.model,
      state: { isDisabled },
    });

    this.showChildView('dialerButton', dialerComponent);
  },
});

export {
  DialerView,
};
