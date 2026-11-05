import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/buttons.scss';

import intl from 'js/i18n';

import Optionlist from 'js/components/optionlist';

import './action.scss';

const i18n = intl.patients.patient.action.addFlowViews;

const AddFlowOptlist = Optionlist.extend({
  attr: 'name',
  align: 'right',
  popWidth: 248,
  isSelectlist: true,
  placeholderText: i18n.addFlowOptlist.placeholderText,
  headingText: i18n.addFlowOptlist.headingText,
  itemTemplateContext() {
    return {
      icon: {
        icon: 'folder',
        type: 'fas',
        classes: 'patient-action__add-flow-icon',
      },
    };
  },
});

const AddFlowView = View.extend({
  tagName: 'button',
  className: 'button button--outline button--pill patient-action__add-flow',
  attributes: {
    type: 'button',
  },
  template: hbs`{{far "folder-closed"}}<span>{{ @intl.patients.patient.action.addFlowViews.addFlowView.label }}</span>`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const optionlist = new AddFlowOptlist({
      anchor: this.el,
      uiView: this,
      lists: [{ collection: this.collection }],
    });

    this.listenTo(optionlist, 'select', flow => {
      this.triggerMethod('select', flow);
    });

    optionlist.show();
  },
  setSaving(isSaving) {
    this.el.disabled = isSaving;
  },
});

export {
  AddFlowView,
};
