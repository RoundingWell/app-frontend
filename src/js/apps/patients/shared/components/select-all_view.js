import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

const i18n = intl.patients.shared.components.selectAllView;

const SelectAllView = View.extend({
  tagName: 'button',
  className: 'button button--checkbox',
  attributes() {
    const isDisabled = this.getOption('isDisabled');
    const isSelectAll = this.getOption('isSelectAll');
    const isSelectNone = this.getOption('isSelectNone');
    const itemType = this.getOption('itemType') === 'flows' ? 'Flows' : 'Actions';
    const attributes = {
      'aria-checked': isSelectAll ? 'true' : isSelectNone || isDisabled ? 'false' : 'mixed',
      'aria-label': isSelectAll ? i18n[`clear${ itemType }`] : i18n[`select${ itemType }`],
      'role': 'checkbox',
      'type': 'button',
    };

    if (isDisabled) attributes.disabled = 'disabled';

    return attributes;
  },
  triggers: {
    'click': 'click',
  },
  getTemplate() {
    if (this.getOption('isSelectAll')) {
      return hbs`{{fas "square-check" classes="button__checkbox-icon button__checkbox-icon--selected"}}`;
    }
    if (this.getOption('isSelectNone') || this.getOption('isDisabled')) {
      return hbs`{{fal "square" classes="button__checkbox-icon button__checkbox-icon--empty"}}`;
    }

    return hbs`{{fas "square-minus" classes="button__checkbox-icon button__checkbox-icon--mixed"}}`;
  },
});

export default SelectAllView;
