import hbs from 'handlebars-inline-precompile';
import { Component } from 'marionette.toolkit';

import 'scss/modules/buttons.scss';

export default Component.extend({
  stateEvents: {
    'change:isSelected': 'onStateChangeIsSelected',
  },
  viewEvents: {
    'click': 'onClick',
  },
  viewOptions() {
    const isSelected = this.getState('isSelected');
    const template = isSelected ? hbs`{{fas "square-check"}}` : hbs`{{fal "square"}}`;

    return {
      tagName: 'button',
      className: 'button--checkbox js-select',
      template,
      triggers: {
        'click': 'click',
      },
    };
  },
  onClick(view, domEvent) {
    this.toggleState('isSelected');
    this.triggerMethod('select', domEvent);
  },
  onStateChangeIsSelected(state, isSelected) {
    this.show();
    this.triggerMethod('change:isSelected', isSelected);
  },
});
