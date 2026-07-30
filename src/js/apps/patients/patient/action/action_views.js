import Backbone from 'backbone';
import hbs from 'handlebars-inline-precompile';
import { View } from 'marionette';

import 'scss/modules/sidebar.scss';

import intl from 'js/i18n';

import PreloadRegion from 'js/regions/preload_region';

import Optionlist from 'js/components/optionlist';

import './action.scss';

const HeadingView = View.extend({
  template: hbs`{{formatMessage (intlGet "patients.patient.action.actionViews.headingView.headingText") outreach=outreach}}`,
});

const MenuView = View.extend({
  tagName: 'button',
  className: 'button--icon js-menu',
  template: hbs`{{far "ellipsis"}}`,
  triggers: {
    'click': 'click',
  },
  onClick() {
    const menuOptions = new Backbone.Collection([{}]);

    const optionlist = new Optionlist({
      ui: this.$el,
      uiView: this,
      headingText: intl.patients.patient.action.actionViews.menuView.menuOptions.headingText,
      itemTemplate: hbs`{{far "trash-can" classes="sidebar__delete-icon"}}<span>{{ @intl.patients.patient.action.actionViews.menuView.menuOptions.delete }}</span>`,
      lists: [{ collection: menuOptions }],
      align: 'right',
      popWidth: 248,
    });

    this.listenTo(optionlist, 'select', () => {
      this.triggerMethod('delete');
    });

    optionlist.show();
  },
});

const LayoutView = View.extend({
  className: 'patient-action flex-region',
  template: hbs`
    <div class="patient-action__header">
      <div data-heading-region></div>
      <div data-menu-region></div>
    </div>
    <div data-action-region></div>
    <div data-dialer-region></div>
    <div data-form-region></div>
    <div data-attachments-region></div>
    <div class="patient-action__activity" data-activity-region></div>
  `,
  regions: {
    heading: '[data-heading-region]',
    menu: '[data-menu-region]',
    action: '[data-action-region]',
    dialer: '[data-dialer-region]',
    form: {
      el: '[data-form-region]',
      replaceElement: true,
    },
    activity: {
      el: '[data-activity-region]',
      regionClass: PreloadRegion,
    },
    attachments: {
      el: '[data-attachments-region]',
      regionClass: PreloadRegion,
    },
  },
});

export {
  LayoutView,
  HeadingView,
  MenuView,
};
