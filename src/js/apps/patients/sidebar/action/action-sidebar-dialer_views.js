import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';
import 'scss/modules/sidebar.scss';

import DialerComponent from 'js/apps/patients/shared/components/dialer_component.js';

import './action-sidebar.scss';

const DialerView = View.extend({
  className: 'flex u-margin--t-8',
  template: hbs`
    <h4 class="sidebar__label u-margin--t-8">{{ @intl.patients.sidebar.action.dialerView.label }}</h4>
    <div class="flex-grow" data-dialer-button-region></div>
  `,
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
