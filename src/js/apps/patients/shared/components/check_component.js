import hbs from 'handlebars-inline-precompile';
import { Component } from 'marionette.toolkit';

import 'scss/modules/buttons.scss';

export default Component.extend({
  initialize() {
    if (!this.getOption('selectLabel') || !this.getOption('deselectLabel')) {
      throw new TypeError('CheckComponent requires selectLabel and deselectLabel');
    }
  },
  stateEvents: {
    'change:isSelected': 'onStateChangeIsSelected',
  },
  viewEvents: {
    'click': 'onClick',
  },
  viewOptions() {
    const isSelected = this.getState('isSelected');
    const ariaLabel = isSelected ? this.getOption('deselectLabel') : this.getOption('selectLabel');
    const template = isSelected ?
      hbs`{{fas "square-check" classes="button__checkbox-icon button__checkbox-icon--selected"}}` :
      hbs`{{fal "square" classes="button__checkbox-icon button__checkbox-icon--empty"}}`;

    return {
      tagName: 'button',
      className: 'button button--checkbox js-select',
      attributes: {
        'aria-checked': String(isSelected),
        'aria-label': ariaLabel,
        'role': 'checkbox',
        'type': 'button',
      },
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
