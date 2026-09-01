import { View } from 'marionette';

import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import Optionlist from 'js/components/optionlist';

import intl from 'js/i18n';

import 'scss/domain/action-icons.scss';
import './add-workflow.scss';

const i18n = intl.patients.shared.addWorkflow.addWorkflowViews;

const AddWorkflowOptlist = Optionlist.extend({
  popWidth: 248,
  isSelectlist: true,
  placeholderText: i18n.addWorkflowOptlist.placeholderText,
  itemTemplateContext() {
    const isProgramAction = this.model.get('itemType') === 'program-actions';
    const defaultActionIcon = this.model.get('hasOutreach') ? 'share-from-square' : 'file-lines';
    const hasCustomIcon = this.model.get('customIcon')?.icon;

    if (hasCustomIcon) {
      const customIcon = this.model.get('customIcon');

      return {
        icon: {
          icon: customIcon.icon,
          type: customIcon.iconType,
          classes: `action-icon action-icon--${ customIcon.color }`,
        },
      };
    }

    return {
      icon: {
        icon: isProgramAction ? defaultActionIcon : 'folder',
        type: isProgramAction ? 'far' : 'fas',
        classes: 'add-workflow__picklist-icon',
      },
    };
  },
});

const AddButtonView = View.extend({
  tagName: 'button',
  className: 'button button--outline button--pill add-workflow__button',
  attributes: {
    type: 'button',
  },
  headingText: i18n.addWorkflowOptlist.headingText,
  template: hbs`{{far "circle-plus"}}<span>{{ label }}</span>`,
  templateContext() {
    return {
      label: this.getOption('label') || i18n.addButtonView.label,
    };
  },
  triggers: {
    'click': 'click',
  },
  onClick() {
    const optionlist = new AddWorkflowOptlist({
      headingText: this.getOption('headingText'),
      ui: this.$el,
      uiView: this,
      lists: this.getOption('lists'),
    });

    this.listenTo(optionlist, 'select', model => {
      const programItem = model.get('programItem');

      const isProgramAction = model.get('itemType') === 'program-actions';
      const messageType = isProgramAction ? 'add:programAction' : 'add:programFlow';

      this.triggerMethod(messageType, programItem);
    });

    optionlist.show();
  },
});

export {
  AddButtonView,
  i18n,
};
