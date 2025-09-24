import { View } from 'marionette';

import hbs from 'handlebars-inline-precompile';

import 'scss/modules/buttons.scss';

import Optionlist from 'js/components/optionlist';

import intl from 'js/i18n';

import './add-workflow.scss';

const i18n = intl.patients.shared.addWorkflow.addWorkflowViews;

const AddWorkflowOptlist = Optionlist.extend({
  popWidth: 248,
  isSelectlist: true,
  placeholderText: i18n.addWorkflowOptlist.placeholderText,
  itemTemplateContext() {
    const isProgramAction = this.model.get('itemType') === 'program-actions';
    const actionIcon = this.model.get('hasOutreach') ? 'share-from-square' : 'file-lines';
    return {
      icon: {
        icon: isProgramAction ? actionIcon : 'folder',
        type: isProgramAction ? 'far' : 'fas',
        classes: 'add-workflow__picklist-icon',
      },
    };
  },
});

const AddButtonView = View.extend({
  tagName: 'button',
  className: 'button-primary',
  headingText: i18n.addWorkflowOptlist.headingText,
  template: hbs`{{far "circle-plus"}}<span>{{ @intl.patients.shared.addWorkflow.addWorkflowViews.addButtonView.label }}</span>{{far "angle-down"}}`,
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

    optionlist.show();
  },
});

const itemClasses = {
  new: 'u-text--italic',
  noResults: 'picklist__message',
};

export {
  AddButtonView,
  i18n,
  itemClasses,
};
